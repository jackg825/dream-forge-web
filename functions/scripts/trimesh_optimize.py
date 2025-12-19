#!/usr/bin/env python3
"""
Mesh optimization script using Trimesh library.
Called from Node.js Cloud Functions via child_process.

Usage:
    python3 trimesh_optimize.py <input_path> <output_path> '<options_json>'

Options JSON:
    {
        "fill_holes": true,
        "fix_normals": true,
        "make_watertight": true,
        "target_size": {"width": 100, "height": null, "depth": null},
        "uniform_scale": null,
        "print_bed_size": {"width": 200, "height": 200, "depth": 200}
    }
"""

import sys
import json
import numpy as np

try:
    import trimesh
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "trimesh not installed. Run: pip install trimesh[easy]"
    }))
    sys.exit(1)


def get_mesh_stats(mesh):
    """Get mesh statistics for preview."""
    bounds = mesh.bounds
    size = bounds[1] - bounds[0]

    # Check for watertight
    is_watertight = mesh.is_watertight if hasattr(mesh, 'is_watertight') else False

    # Calculate volume only if watertight
    volume = None
    if is_watertight:
        try:
            volume = float(mesh.volume)
        except Exception:
            pass

    return {
        "vertex_count": int(len(mesh.vertices)),
        "face_count": int(len(mesh.faces)),
        "bounding_box": {
            "width": float(size[0]),
            "height": float(size[1]),
            "depth": float(size[2])
        },
        "is_watertight": bool(is_watertight),
        "volume": volume,
        "center": [float(x) for x in mesh.centroid]
    }


def analyze_mesh_issues(mesh):
    """Analyze mesh for common issues."""
    issues = []
    recommendations = []

    # Check watertight
    if not mesh.is_watertight:
        issues.append("mesh_not_watertight")
        recommendations.append("enable_fill_holes")

    # Check for degenerate faces
    try:
        degenerate = mesh.degenerate_faces
        if len(degenerate) > 0:
            issues.append(f"degenerate_faces:{len(degenerate)}")
            recommendations.append("clean_mesh")
    except Exception:
        pass

    # Check face count
    face_count = len(mesh.faces)
    if face_count > 500000:
        issues.append("high_polygon_count")
        recommendations.append("simplify_mesh")

    return issues, recommendations


def apply_target_size(mesh, target):
    """Scale mesh to target dimensions while maintaining aspect ratio."""
    bounds = mesh.bounds
    current_size = bounds[1] - bounds[0]

    # Calculate scale factors for each specified dimension
    scales = []
    if target.get("width") is not None:
        scales.append(target["width"] / current_size[0])
    if target.get("height") is not None:
        scales.append(target["height"] / current_size[1])
    if target.get("depth") is not None:
        scales.append(target["depth"] / current_size[2])

    # Use minimum scale to maintain aspect ratio
    if scales:
        scale = min(scales)
        mesh.apply_scale(scale)
        return scale
    return 1.0


def fit_to_print_bed(mesh, bed_size):
    """Scale mesh to fit within print bed with 5% margin."""
    bounds = mesh.bounds
    current_size = bounds[1] - bounds[0]

    scale = min(
        bed_size["width"] / current_size[0],
        bed_size["height"] / current_size[1],
        bed_size["depth"] / current_size[2]
    ) * 0.95  # 5% margin for safety

    mesh.apply_scale(scale)
    return scale


def center_mesh(mesh):
    """Center mesh at origin and place on ground plane."""
    # Center at origin
    mesh.vertices -= mesh.centroid

    # Move to ground plane (z=0)
    min_z = mesh.bounds[0][2]
    mesh.vertices[:, 2] -= min_z


def optimize_mesh(input_path, output_path, options):
    """
    Optimize mesh with specified options.

    Returns dict with original/optimized stats and success status.
    """
    result = {
        "success": False,
        "original": None,
        "optimized": None,
        "operations": [],
        "warnings": []
    }

    try:
        # Load mesh
        mesh = trimesh.load(input_path, force="mesh")

        # Handle scenes (multi-mesh GLB)
        if isinstance(mesh, trimesh.Scene):
            # Concatenate all meshes in scene
            meshes = [g for g in mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                raise ValueError("No valid meshes found in scene")
            mesh = trimesh.util.concatenate(meshes)

        # Store original stats
        result["original"] = get_mesh_stats(mesh)

        # Analyze issues before repair
        issues, recommendations = analyze_mesh_issues(mesh)
        result["issues"] = issues
        result["recommendations"] = recommendations

        # Remove degenerate faces first
        try:
            mesh.remove_degenerate_faces()
            result["operations"].append("remove_degenerate_faces")
        except Exception as e:
            result["warnings"].append(f"remove_degenerate_faces failed: {str(e)}")

        # Fill holes
        if options.get("fill_holes", True):
            try:
                mesh.fill_holes()
                result["operations"].append("fill_holes")
            except Exception as e:
                result["warnings"].append(f"fill_holes failed: {str(e)}")

        # Fix normals (make all normals consistent)
        if options.get("fix_normals", True):
            try:
                mesh.fix_normals()
                result["operations"].append("fix_normals")
            except Exception as e:
                result["warnings"].append(f"fix_normals failed: {str(e)}")

        # Make watertight (more aggressive repair)
        if options.get("make_watertight", True):
            try:
                # Use trimesh's repair module
                trimesh.repair.fix_inversion(mesh)
                trimesh.repair.fix_normals(mesh)
                trimesh.repair.fix_winding(mesh)
                result["operations"].append("watertight_repair")
            except Exception as e:
                result["warnings"].append(f"watertight_repair failed: {str(e)}")

        # Apply scaling
        target_size = options.get("target_size")
        uniform_scale = options.get("uniform_scale")
        print_bed = options.get("print_bed_size")

        if target_size and any(v is not None for v in target_size.values()):
            scale = apply_target_size(mesh, target_size)
            result["operations"].append(f"scale_to_target:{scale:.4f}")
        elif uniform_scale is not None:
            mesh.apply_scale(uniform_scale)
            result["operations"].append(f"uniform_scale:{uniform_scale}")
        elif print_bed:
            scale = fit_to_print_bed(mesh, print_bed)
            result["operations"].append(f"fit_to_bed:{scale:.4f}")

        # Center and place on ground
        if options.get("center_mesh", True):
            center_mesh(mesh)
            result["operations"].append("center_and_ground")

        # Get optimized stats
        result["optimized"] = get_mesh_stats(mesh)

        # Determine output format from extension
        output_ext = output_path.lower().split(".")[-1]

        # Export
        if output_ext == "stl":
            mesh.export(output_path, file_type="stl")
        elif output_ext in ["glb", "gltf"]:
            mesh.export(output_path, file_type="glb")
        else:
            mesh.export(output_path)

        result["success"] = True
        result["output_format"] = output_ext

    except Exception as e:
        result["success"] = False
        result["error"] = str(e)

    return result


def analyze_only(input_path):
    """Analyze mesh without modifying it."""
    try:
        mesh = trimesh.load(input_path, force="mesh")

        if isinstance(mesh, trimesh.Scene):
            meshes = [g for g in mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                raise ValueError("No valid meshes found in scene")
            mesh = trimesh.util.concatenate(meshes)

        stats = get_mesh_stats(mesh)
        issues, recommendations = analyze_mesh_issues(mesh)

        # Calculate printability score (1-5)
        score = 5
        if not mesh.is_watertight:
            score -= 2
        if len(mesh.faces) > 500000:
            score -= 1
        if len(mesh.faces) > 1000000:
            score -= 1

        return {
            "success": True,
            "analysis": {
                **stats,
                "issues": issues,
                "recommendations": recommendations,
                "printability_score": max(1, score),
                "hole_count": len(mesh.outline_for_loop()) if hasattr(mesh, 'outline_for_loop') else 0
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python3 trimesh_optimize.py <input_path> [output_path] [options_json]"
        }))
        sys.exit(1)

    input_path = sys.argv[1]

    # If only input path, do analysis only
    if len(sys.argv) == 2:
        result = analyze_only(input_path)
        print(json.dumps(result))
        sys.exit(0 if result["success"] else 1)

    output_path = sys.argv[2]
    options = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

    result = optimize_mesh(input_path, output_path, options)
    print(json.dumps(result))
    sys.exit(0 if result["success"] else 1)
