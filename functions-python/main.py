"""
Python Cloud Functions Gen 2 for Mesh Optimization

Provides mesh repair and analysis using Trimesh library.
These functions are admin-only and called from Node.js functions.
"""

import json
import tempfile
import os
from typing import Any

# Lazy imports for heavy libraries to avoid timeout during initialization
# numpy, trimesh, scipy will be imported when needed
from firebase_functions import https_fn, options


def get_trimesh():
    """Lazy load trimesh to avoid initialization timeout"""
    import trimesh
    return trimesh


def get_numpy():
    """Lazy load numpy to avoid initialization timeout"""
    import numpy as np
    return np



def get_mesh_stats(mesh) -> dict:
    """Extract statistics from a trimesh object."""
    bounds = mesh.bounds
    extents = bounds[1] - bounds[0]

    return {
        "vertex_count": len(mesh.vertices),
        "face_count": len(mesh.faces),
        "bounding_box": {
            "width": float(extents[0]),
            "height": float(extents[1]),
            "depth": float(extents[2]),
        },
        "is_watertight": bool(mesh.is_watertight),
        "volume": float(mesh.volume) if mesh.is_watertight else None,
        "center": mesh.centroid.tolist(),
    }


def analyze_mesh_issues(mesh) -> tuple[list, list, int]:
    """Analyze mesh for printing issues and generate recommendations."""
    issues = []
    recommendations = []
    score = 5  # Start with perfect score

    # Check watertight
    if not mesh.is_watertight:
        issues.append("Mesh is not watertight (has holes or gaps)")
        recommendations.append("Enable 'Fill Holes' to repair mesh")
        score -= 2

    # Check for degenerate faces
    np = get_numpy()
    face_areas = mesh.area_faces
    degenerate_count = np.sum(face_areas < 1e-10)
    if degenerate_count > 0:
        issues.append(f"Found {degenerate_count} degenerate faces (zero area)")
        recommendations.append("Consider mesh cleanup to remove degenerate faces")
        score -= 1

    # Check face count for printing
    face_count = len(mesh.faces)
    if face_count > 500000:
        issues.append(f"High polygon count ({face_count:,} faces) may slow printing software")
        recommendations.append("Enable simplification to reduce polygon count")
        score -= 1
    elif face_count < 100:
        issues.append(f"Very low polygon count ({face_count} faces)")
        recommendations.append("Model may appear faceted when printed")
        score -= 1

    # Check for inverted normals (approximate check)
    if hasattr(mesh, 'face_normals'):
        # Check if normals are consistently oriented
        try:
            mesh_copy = mesh.copy()
            mesh_copy.fix_normals()
            if not get_numpy().allclose(mesh.face_normals, mesh_copy.face_normals, atol=0.1):
                issues.append("Some face normals may be inverted")
                recommendations.append("Enable 'Fix Normals' to correct orientation")
                score -= 1
        except Exception:
            pass

    # Check size
    extents = mesh.extents
    max_dim = max(extents)
    min_dim = min(extents)

    if max_dim > 300:  # Larger than typical print bed
        issues.append(f"Model is large ({max_dim:.1f}mm) - may not fit print bed")
        recommendations.append("Consider scaling down to fit your printer")
        score -= 1
    elif max_dim < 10:
        issues.append(f"Model is small ({max_dim:.1f}mm) - fine details may not print")
        recommendations.append("Consider scaling up for better detail")

    if min_dim < 1:
        issues.append(f"Minimum dimension is very thin ({min_dim:.2f}mm)")
        recommendations.append("Very thin features may not print successfully")
        score -= 1

    return issues, recommendations, max(1, score)


@https_fn.on_request(
    region="asia-east1",
    memory=options.MemoryOption.GB_2,
    timeout_sec=540,
    cors=options.CorsOptions(cors_origins="*", cors_methods=["POST"]),
)
def trimesh_analyze(req: https_fn.Request) -> https_fn.Response:
    """
    Analyze a mesh file and return statistics and issues.

    Request body (JSON):
        - file_url: URL to download the mesh file
        - file_data: Base64 encoded mesh data (alternative to file_url)

    Response (JSON):
        - success: bool
        - analysis: mesh statistics and issues
        - error: error message if failed
    """
    try:
        data = req.get_json()
        if not data:
            return https_fn.Response(
                json.dumps({"success": False, "error": "No JSON data provided"}),
                status=400,
                content_type="application/json",
            )

        # Get mesh data
        import base64
        import urllib.request

        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = os.path.join(temp_dir, "input.glb")

            if "file_data" in data:
                # Decode base64 data
                file_bytes = base64.b64decode(data["file_data"])
                with open(input_path, "wb") as f:
                    f.write(file_bytes)
            elif "file_url" in data:
                # Download from URL
                urllib.request.urlretrieve(data["file_url"], input_path)
            else:
                return https_fn.Response(
                    json.dumps({"success": False, "error": "No file_data or file_url provided"}),
                    status=400,
                    content_type="application/json",
                )

            # Load mesh
            trimesh = get_trimesh()
            mesh = trimesh.load(input_path, force="mesh")

            if not isinstance(mesh, trimesh.Trimesh):
                # Handle scene with multiple meshes
                if hasattr(mesh, 'dump'):
                    meshes = mesh.dump()
                    if meshes:
                        mesh = trimesh.util.concatenate(meshes)
                    else:
                        return https_fn.Response(
                            json.dumps({"success": False, "error": "No mesh geometry found"}),
                            status=400,
                            content_type="application/json",
                        )

            # Get stats and issues
            stats = get_mesh_stats(mesh)
            issues, recommendations, score = analyze_mesh_issues(mesh)

            return https_fn.Response(
                json.dumps({
                    "success": True,
                    "analysis": {
                        **stats,
                        "issues": issues,
                        "recommendations": recommendations,
                        "printability_score": score,
                    },
                }),
                content_type="application/json",
            )

    except Exception as e:
        return https_fn.Response(
            json.dumps({"success": False, "error": str(e)}),
            status=500,
            content_type="application/json",
        )


@https_fn.on_request(
    region="asia-east1",
    memory=options.MemoryOption.GB_2,
    timeout_sec=540,
    cors=options.CorsOptions(cors_origins="*", cors_methods=["POST"]),
)
def trimesh_optimize(req: https_fn.Request) -> https_fn.Response:
    """
    Optimize a mesh for 3D printing.

    Request body (JSON):
        - file_data: Base64 encoded mesh data
        - options:
            - fill_holes: bool (default: True)
            - fix_normals: bool (default: True)
            - make_watertight: bool (default: True)
            - center_mesh: bool (default: True)
            - target_size: {width, height, depth} in mm (optional)
            - uniform_scale: float (optional)
            - print_bed_size: {width, height, depth} in mm (optional)
        - output_format: "glb" or "stl" (default: "glb")

    Response (JSON):
        - success: bool
        - file_data: Base64 encoded optimized mesh
        - original: original mesh stats
        - optimized: optimized mesh stats
        - operations: list of operations performed
        - warnings: list of warnings
        - error: error message if failed
    """
    try:
        data = req.get_json()
        if not data:
            return https_fn.Response(
                json.dumps({"success": False, "error": "No JSON data provided"}),
                status=400,
                content_type="application/json",
            )

        if "file_data" not in data:
            return https_fn.Response(
                json.dumps({"success": False, "error": "No file_data provided"}),
                status=400,
                content_type="application/json",
            )

        import base64

        options = data.get("options", {})
        output_format = data.get("output_format", "glb")

        operations = []
        warnings = []

        with tempfile.TemporaryDirectory() as temp_dir:
            # Write input file
            input_path = os.path.join(temp_dir, "input.glb")
            file_bytes = base64.b64decode(data["file_data"])
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            # Load mesh
            trimesh = get_trimesh()
            mesh = trimesh.load(input_path, force="mesh")

            if not isinstance(mesh, trimesh.Trimesh):
                if hasattr(mesh, 'dump'):
                    meshes = mesh.dump()
                    if meshes:
                        mesh = trimesh.util.concatenate(meshes)
                    else:
                        return https_fn.Response(
                            json.dumps({"success": False, "error": "No mesh geometry found"}),
                            status=400,
                            content_type="application/json",
                        )

            # Get original stats
            original_stats = get_mesh_stats(mesh)

            # Fill holes
            if options.get("fill_holes", True):
                try:
                    trimesh.repair.fill_holes(mesh)
                    operations.append("fill_holes")
                except Exception as e:
                    warnings.append(f"Fill holes failed: {str(e)}")

            # Fix normals
            if options.get("fix_normals", True):
                try:
                    mesh.fix_normals()
                    operations.append("fix_normals")
                except Exception as e:
                    warnings.append(f"Fix normals failed: {str(e)}")

            # Make watertight (more aggressive repair)
            if options.get("make_watertight", True) and not mesh.is_watertight:
                try:
                    # Try to fix winding and fill holes again
                    trimesh.repair.fix_winding(mesh)
                    trimesh.repair.fill_holes(mesh)
                    if mesh.is_watertight:
                        operations.append("make_watertight")
                    else:
                        warnings.append("Could not make mesh fully watertight")
                except Exception as e:
                    warnings.append(f"Watertight repair failed: {str(e)}")

            # Center mesh
            if options.get("center_mesh", True):
                mesh.vertices -= mesh.centroid
                # Place on ground plane (Z=0)
                mesh.vertices[:, 2] -= mesh.bounds[0, 2]
                operations.append("center_mesh")

            # Scaling operations
            if "target_size" in options and options["target_size"]:
                target = options["target_size"]
                current_extents = mesh.extents

                scales = []
                if target.get("width") and current_extents[0] > 0:
                    scales.append(target["width"] / current_extents[0])
                if target.get("height") and current_extents[1] > 0:
                    scales.append(target["height"] / current_extents[1])
                if target.get("depth") and current_extents[2] > 0:
                    scales.append(target["depth"] / current_extents[2])

                if scales:
                    scale_factor = min(scales)  # Maintain aspect ratio
                    mesh.apply_scale(scale_factor)
                    operations.append(f"scale:{scale_factor:.3f}")

            elif "uniform_scale" in options and options["uniform_scale"]:
                scale_factor = options["uniform_scale"]
                mesh.apply_scale(scale_factor)
                operations.append(f"scale:{scale_factor:.3f}")

            elif "print_bed_size" in options and options["print_bed_size"]:
                bed = options["print_bed_size"]
                current_extents = mesh.extents

                # Calculate scale with 5% margin
                margin = 0.95
                scales = [
                    (bed["width"] * margin) / current_extents[0] if current_extents[0] > 0 else 1,
                    (bed["height"] * margin) / current_extents[1] if current_extents[1] > 0 else 1,
                    (bed["depth"] * margin) / current_extents[2] if current_extents[2] > 0 else 1,
                ]

                scale_factor = min(scales)
                if scale_factor < 1.0:  # Only scale down, not up
                    mesh.apply_scale(scale_factor)
                    operations.append(f"fit_bed:{scale_factor:.3f}")

            # Get optimized stats
            optimized_stats = get_mesh_stats(mesh)

            # Export
            output_path = os.path.join(temp_dir, f"output.{output_format}")
            mesh.export(output_path)

            # Read output and encode
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            output_base64 = base64.b64encode(output_bytes).decode("utf-8")

            return https_fn.Response(
                json.dumps({
                    "success": True,
                    "file_data": output_base64,
                    "original": original_stats,
                    "optimized": optimized_stats,
                    "operations": operations,
                    "warnings": warnings,
                    "output_format": output_format,
                }),
                content_type="application/json",
            )

    except Exception as e:
        return https_fn.Response(
            json.dumps({"success": False, "error": str(e)}),
            status=500,
            content_type="application/json",
        )
