/**
 * WebGL shader welcome intro (adapted from ShaderAnimation / three.js).
 * Full-screen play → brief zoom+blur → reveal dark fullscreen canvas.
 */
const THREE_URL = "/static/vendor/js/three-0.160.0.module.js?v=2026.08.27.shader1";
const PLAY_MS = 2800;
const EXIT_MS = 720;
const ROOT_ID = "lightboxShaderIntro";
const STAGE_ID = "lightboxShaderIntroStage";

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  #define TWO_PI 6.2831853072
  #define PI 3.14159265359

  precision highp float;
  uniform vec2 resolution;
  uniform float time;

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    float t = time * 0.05;
    float lineWidth = 0.002;

    vec3 color = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 5; i++) {
        color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
      }
    }

    gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
  }
`;

function finishIntro(root) {
  document.documentElement.classList.remove("lightbox-shader-intro-active");
  root.classList.add("is-done");
  root.setAttribute("aria-hidden", "true");
  try {
    window.dispatchEvent(new CustomEvent("lightbox-shader-intro-done"));
  } catch (_) {}
}

function startExit(root, cleanup) {
  if (!root || root.classList.contains("is-exiting") || root.classList.contains("is-done")) return;
  root.classList.add("is-exiting");
  window.setTimeout(() => {
    try {
      cleanup();
    } catch (_) {}
    finishIntro(root);
  }, EXIT_MS);
}

async function boot() {
  const root = document.getElementById(ROOT_ID);
  const stage = document.getElementById(STAGE_ID);
  if (!root || !stage) return;

  document.documentElement.classList.add("lightbox-shader-intro-active");

  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch (err) {
    console.warn("[shader-intro] three.js load failed", err);
    finishIntro(root);
    return;
  }

  const camera = new THREE.Camera();
  camera.position.z = 1;

  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  stage.appendChild(renderer.domElement);

  let animationId = 0;
  let disposed = false;

  const onResize = () => {
    if (disposed) return;
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    uniforms.resolution.value.x = renderer.domElement.width;
    uniforms.resolution.value.y = renderer.domElement.height;
  };

  const animate = () => {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    uniforms.time.value += 0.05;
    renderer.render(scene, camera);
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);
    try {
      if (renderer.domElement && renderer.domElement.parentNode === stage) {
        stage.removeChild(renderer.domElement);
      }
    } catch (_) {}
    try {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    } catch (_) {}
  };

  onResize();
  window.addEventListener("resize", onResize, { passive: true });
  animate();

  window.setTimeout(() => startExit(root, cleanup), PLAY_MS);
  window.setTimeout(() => {
    if (!root.classList.contains("is-done")) startExit(root, cleanup);
  }, PLAY_MS + EXIT_MS + 2500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
