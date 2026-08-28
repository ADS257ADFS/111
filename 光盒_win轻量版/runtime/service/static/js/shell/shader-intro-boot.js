/**
 * Startup intro — raw WebGL (no Three.js). Boots synchronously when parsed.
 * First frame: shader motion + logo opacity 0→1 (2s) together.
 */
(function (global) {
  "use strict";

  var PLAY_MS = 6200;
  var EXIT_MS = 620;
  var ROOT_ID = "lightboxShaderIntro";
  var STAGE_ID = "lightboxShaderIntroStage";
  var RENDER_SCALE = 0.55;

  var VERT = [
    "attribute vec2 a_pos;",
    "void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "uniform vec2 u_resolution;",
    "uniform float u_time;",
    "void main() {",
    "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);",
    "  float t = u_time * 0.05;",
    "  float lineWidth = 0.002;",
    "  vec3 color = vec3(0.0);",
    "  for (int j = 0; j < 3; j++) {",
    "    for (int i = 0; i < 5; i++) {",
    "      color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));",
    "    }",
    "  }",
    "  gl_FragColor = vec4(color, 1.0);",
    "}",
  ].join("\n");

  var introSurfaceNotified = false;

  function notifyIntroSurfaceReady() {
    if (introSurfaceNotified) return true;
    try {
      var api = global.pywebview && global.pywebview.api;
      if (api && typeof api.notify_intro_surface_ready === "function") {
        api.notify_intro_surface_ready();
        introSurfaceNotified = true;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function ensureIntroSurfaceNotified() {
    if (!notifyIntroSurfaceReady()) {
      global.setTimeout(ensureIntroSurfaceNotified, 12);
    }
  }

  function enterFullscreenSoftware() {
    var api = global.pywebview && global.pywebview.api;
    if (!api) return Promise.resolve();
    if (typeof api.enter_app_from_intro === "function") {
      return Promise.resolve(api.enter_app_from_intro()).then(function (state) {
        document.documentElement.classList.toggle(
          "lightbox-window-maximized",
          state === "maximized"
        );
      });
    }
    if (typeof api.maximize_to_work_area === "function") {
      return Promise.resolve(api.maximize_to_work_area()).then(function () {
        document.documentElement.classList.add("lightbox-window-maximized");
      });
    }
    return Promise.resolve();
  }

  function finishIntro(root) {
    document.documentElement.classList.remove("lightbox-shader-intro-active");
    root.classList.add("is-done");
    root.setAttribute("aria-hidden", "true");
    try {
      global.dispatchEvent(new CustomEvent("lightbox-shader-intro-done"));
    } catch (_) {}
  }

  function startExit(root, cleanup) {
    if (!root || root.classList.contains("is-exiting") || root.classList.contains("is-done")) return;
    root.classList.add("is-exiting");
    try { cleanup(); } catch (_) {}
    requestAnimationFrame(function () {
      global.setTimeout(function () {
        enterFullscreenSoftware();
      }, 90);
    });
    global.setTimeout(function () {
      finishIntro(root);
    }, EXIT_MS);
  }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function createProgram(gl) {
    var program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    return program;
  }

  function boot() {
    if (global.__shaderIntroBooted) return;
    var root = document.getElementById(ROOT_ID);
    var stage = document.getElementById(STAGE_ID);
    if (!root || !stage) return;
    global.__shaderIntroBooted = true;

    document.documentElement.classList.add("lightbox-shader-intro-active");
    root.classList.remove("is-shader-live", "is-label-visible");

    var canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    stage.appendChild(canvas);

    var gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      root.classList.add("is-shader-live", "is-label-visible");
      ensureIntroSurfaceNotified();
      enterFullscreenSoftware().then(function () { finishIntro(root); });
      return;
    }

    var program = createProgram(gl);
    gl.useProgram(program);
    var posLoc = gl.getAttribLocation(program, "a_pos");
    var resLoc = gl.getUniformLocation(program, "u_resolution");
    var timeLoc = gl.getUniformLocation(program, "u_time");
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var animationId = 0;
    var disposed = false;
    var started = false;
    var startMs = 0;
    var playStartMs = 0;
    var lastFrameMs = 0;
    var MIN_FRAME_MS = 1000 / 36;

    function resize() {
      if (disposed || root.classList.contains("is-exiting")) return;
      var width = Math.max(1, stage.clientWidth || root.clientWidth || global.innerWidth || 1);
      var height = Math.max(1, stage.clientHeight || root.clientHeight || global.innerHeight || 1);
      var rw = Math.max(1, Math.floor(width * RENDER_SCALE));
      var rh = Math.max(1, Math.floor(height * RENDER_SCALE));
      canvas.width = rw;
      canvas.height = rh;
      gl.viewport(0, 0, rw, rh);
      gl.uniform2f(resLoc, rw, rh);
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      global.cancelAnimationFrame(animationId);
      global.removeEventListener("resize", resize);
      try {
        if (canvas.parentNode === stage) stage.removeChild(canvas);
      } catch (_) {}
      try {
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
      } catch (_) {}
    }

    function beginPlayback(now) {
      if (started) return;
      started = true;
      playStartMs = now || performance.now();
      root.classList.add("is-shader-live", "is-label-visible");
      ensureIntroSurfaceNotified();
      var remaining = PLAY_MS;
      global.setTimeout(function () {
        startExit(root, cleanup);
      }, remaining);
    }

    function frame(now) {
      if (disposed) return;
      animationId = global.requestAnimationFrame(frame);
      var t = now || performance.now();
      if (lastFrameMs && t - lastFrameMs < MIN_FRAME_MS) return;
      lastFrameMs = t;
      if (!startMs) startMs = t;
      gl.uniform1f(timeLoc, 1.0 + (t - startMs) * 0.001 * 3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!started) beginPlayback(t);
    }

    resize();
    global.addEventListener("resize", resize, { passive: true });
    frame();

    global.setTimeout(function () {
      if (!root.classList.contains("is-done")) startExit(root, cleanup);
    }, PLAY_MS + EXIT_MS + 4000);
  }

  boot();
})(window);
