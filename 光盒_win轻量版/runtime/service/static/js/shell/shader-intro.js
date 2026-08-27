/**
 * Independent rounded shader startup panel → fullscreen dark software.
 * Waits for the animation to finish before expanding into the app.
 */
const THREE_URL = "/static/vendor/js/three-0.160.0.module.js?v=2026.08.27.shader2";
/* One visual shader cycle (~fract period at 60fps), then enter the app. */
const PLAY_MS = 6200;
const EXIT_MS = 700;
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

async function enterFullscreenSoftware() {
  const api = window.pywebview?.api;
  if (!api) return;
  try {
    if (typeof api.enter_app_from_intro === "function") {
      const state = await api.enter_app_from_intro();
      document.documentElement.classList.toggle(
        "lightbox-window-maximized",
        state === "maximized"
      );
      return;
    }
    if (typeof api.maximize_to_work_area === "function") {
      await api.maximize_to_work_area();
      document.documentElement.classList.add("lightbox-window-maximized");
    }
  } catch (err) {
    console.warn("[shader-intro] enter fullscreen failed", err);
  }
}

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
  /* Expand after the cheap opacity/scale fade starts — avoid resize+blur thrash. */
  window.setTimeout(() => {
    enterFullscreenSoftware();
  }, 120);
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
    await enterFullscreenSoftware();
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

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 1);
  /* Cap DPR — full-window fragment shader at 2x is a common stutter source. */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  stage.appendChild(renderer.domElement);

  let animationId = 0;
  let disposed = false;
  let exitArmed = false;
  let startMs = 0;

  const onResize = () => {
    if (disposed || root.classList.contains("is-exiting")) return;
    const width = Math.max(1, stage.clientWidth || root.clientWidth || window.innerWidth);
    const height = Math.max(1, stage.clientHeight || root.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    uniforms.resolution.value.x = renderer.domElement.width;
    uniforms.resolution.value.y = renderer.domElement.height;
  };

  const animate = (now) => {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    if (!startMs) startMs = now || performance.now();
    /* Clock from rAF timestamp — steadier than fixed += 0.05 under jank. */
    uniforms.time.value = 1.0 + ((now || performance.now()) - startMs) * 0.001 * 3;
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

  const armExit = () => {
    if (exitArmed) return;
    exitArmed = true;
    // Wait for one shader cycle, then expand into the app (no replay).
    window.setTimeout(() => startExit(root, cleanup), PLAY_MS);
  };

  onResize();
  window.addEventListener("resize", onResize, { passive: true });
  animate();
  // Start the play clock only after the first painted frame.
  requestAnimationFrame(() => requestAnimationFrame(armExit));

  window.setTimeout(() => {
    if (!root.classList.contains("is-done")) startExit(root, cleanup);
  }, PLAY_MS + EXIT_MS + 4000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
