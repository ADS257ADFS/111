/**
 * Startup shader intro — boot ASAP (three preloaded from index.html head).
 * CSS stage motion shows instantly; WebGL takes over on first frame.
 * Logo: opacity 0→1 over 2s, synced with motion start.
 */
const THREE_URL = "/static/vendor/js/three-0.160.0.module.js?v=2026.08.27.shader3";
const PLAY_MS = 6200;
const EXIT_MS = 620;
const ROOT_ID = "lightboxShaderIntro";
const STAGE_ID = "lightboxShaderIntroStage";
const RENDER_SCALE = 0.55;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
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

function startExit(root, stopAndCleanup) {
  if (!root || root.classList.contains("is-exiting") || root.classList.contains("is-done")) return;
  root.classList.add("is-exiting");
  try {
    stopAndCleanup();
  } catch (_) {}
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      enterFullscreenSoftware();
    }, 90);
  });
  window.setTimeout(() => {
    finishIntro(root);
  }, EXIT_MS);
}

export async function bootIntro(threePromise) {
  if (window.__shaderIntroBooted) return;
  window.__shaderIntroBooted = true;

  const root = document.getElementById(ROOT_ID);
  const stage = document.getElementById(STAGE_ID);
  if (!root || !stage) return;

  document.documentElement.classList.add("lightbox-shader-intro-active");
  root.classList.remove("is-shader-live");
  if (!root.classList.contains("is-label-visible")) {
    root.classList.add("is-label-visible");
  }

  const playStartMs = performance.now();

  let THREE;
  try {
    THREE = await (threePromise || window.__shaderIntroThreePromise || import(THREE_URL));
  } catch (err) {
    console.warn("[shader-intro] three.js load failed", err);
    root.classList.add("is-label-visible");
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
  scene.add(new THREE.Mesh(geometry, material));

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(1);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  stage.appendChild(canvas);

  let animationId = 0;
  let disposed = false;
  let revealArmed = false;
  let startMs = 0;
  let lastFrameMs = 0;
  const MIN_FRAME_MS = 1000 / 36;

  const onResize = () => {
    if (disposed || root.classList.contains("is-exiting")) return;
    const width = Math.max(1, stage.clientWidth || root.clientWidth || window.innerWidth);
    const height = Math.max(1, stage.clientHeight || root.clientHeight || window.innerHeight);
    const rw = Math.max(1, Math.floor(width * RENDER_SCALE));
    const rh = Math.max(1, Math.floor(height * RENDER_SCALE));
    renderer.setSize(rw, rh, false);
    uniforms.resolution.value.x = rw;
    uniforms.resolution.value.y = rh;
  };

  const revealMotionAndLogo = () => {
    if (revealArmed || disposed) return;
    revealArmed = true;
    root.classList.add("is-shader-live");
    const elapsed = performance.now() - playStartMs;
    const remaining = Math.max(0, PLAY_MS - elapsed);
    window.setTimeout(() => startExit(root, cleanup), remaining);
  };

  const animate = (now) => {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    const t = now || performance.now();
    if (lastFrameMs && t - lastFrameMs < MIN_FRAME_MS) return;
    lastFrameMs = t;
    if (!startMs) startMs = t;
    uniforms.time.value = 1.0 + (t - startMs) * 0.001 * 3;
    renderer.render(scene, camera);
    if (!revealArmed) {
      revealMotionAndLogo();
    }
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);
    try {
      if (canvas.parentNode === stage) stage.removeChild(canvas);
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

  window.setTimeout(() => {
    if (!root.classList.contains("is-done")) startExit(root, cleanup);
  }, PLAY_MS + EXIT_MS + 4000);
}
