import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import http from 'http';

const execAsync = promisify(exec);

const WIDTH = 512;
const HEIGHT = 512;
const FPS = 60;
const DURATION = 3;
const FRAMES = FPS * DURATION; // 180 frames

function startServer(glbPath) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/model.glb') {
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Access-Control-Allow-Origin', '*');
        fs.createReadStream(glbPath).pipe(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function renderGLBtoGIF(glbPath, outputPath) {
  const absoluteGlbPath = path.resolve(glbPath);
  const framesDir = '/tmp/glb-frames';

  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true });
  }
  fs.mkdirSync(framesDir, { recursive: true });

  // Start local server to serve GLB
  const { server, port } = await startServer(absoluteGlbPath);
  const modelUrl = `http://localhost:${port}/model.glb`;
  console.log(`Serving GLB at ${modelUrl}`);

  console.log(`Rendering ${FRAMES} frames at ${FPS}fps (${WIDTH}x${HEIGHT})...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>body { margin: 0; overflow: hidden; }</style></head>
    <body>
      <script type="importmap">
        { "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }}
      </script>
      <script type="module">
        import * as THREE from 'three';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(${WIDTH}, ${HEIGHT});
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        scene.add(light);
        const fill = new THREE.DirectionalLight(0xffffff, 0.3);
        fill.position.set(-5, 0, -5);
        scene.add(fill);

        let model;
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        loader.load('${modelUrl}', (gltf) => {
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          model.position.sub(center);
          model.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
          camera.position.set(0, 0.5, 3);
          camera.lookAt(0, 0, 0);
          scene.add(model);
          window.modelReady = true;
        }, null, (e) => { window.modelError = e.message; });

        window.renderFrame = (r) => {
          if (model) model.rotation.y = r;
          renderer.render(scene, camera);
        };
      </script>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.modelReady || window.modelError', { timeout: 120000 });

  const error = await page.evaluate(() => window.modelError);
  if (error) throw new Error(error);

  console.log('Rendering frames...');
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((r) => window.renderFrame(r), (i / FRAMES) * Math.PI * 2);
    await page.screenshot({ path: `${framesDir}/frame_${String(i).padStart(4, '0')}.png` });
    if (i % 30 === 0) console.log(`Frame ${i + 1}/${FRAMES}`);
  }

  await browser.close();
  server.close();
  console.log('Creating GIF with ffmpeg...');

  const ffmpegCmd = `ffmpeg -y -framerate ${FPS} -i ${framesDir}/frame_%04d.png -vf "scale=${WIDTH}:${HEIGHT}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" -loop 0 "${outputPath}"`;

  await execAsync(ffmpegCmd);

  fs.rmSync(framesDir, { recursive: true });
  const size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`✅ Done: ${outputPath} (${size} MB)`);
}

const glbPath = process.argv[2];
const outputPath = process.argv[3] || 'output.gif';

if (!glbPath) {
  console.error('Usage: node glb-to-gif.mjs <input.glb> [output.gif]');
  process.exit(1);
}

renderGLBtoGIF(glbPath, outputPath).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
