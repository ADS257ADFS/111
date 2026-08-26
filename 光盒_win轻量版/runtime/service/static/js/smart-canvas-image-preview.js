/**
 * Smart Canvas — image preview, compare slider, and panorama viewer.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

    async function downloadPreviewFile(item){
        const ctx = d();
        if(!item?.url) return;
        const name = ctx.downloadNameForMediaItem?.(item, 'output') || 'output';
        try {
            return await global.SmartCanvasDownloadCenter?.saveItem?.(item, {
                filename:name,
                sourceElement:document.getElementById('previewFrame') || document.querySelector('.image-node.selected')
            });
        } catch(error) {
            ctx.toast?.((error?.message || '下载失败').slice(0,160));
        }
    }

    function applyPreviewTransform(){
        const ctx = d();
        const frame = document.getElementById('previewFrame');
        if(frame){
            frame.style.transform = ctx.panoramaState?.enabled ? '' : `translate(${ctx.previewPan?.x || 0}px, ${ctx.previewPan?.y || 0}px) scale(${ctx.previewZoom ?? 1})`;
        }
        ctx.updateZoomLabel?.();
    }

    function resetPreviewTransform(){
        const ctx = d();
        ctx.previewZoom = 1.0;
        ctx.previewPan = {x:0, y:0};
        ctx.previewComparePos = 50;
        document.getElementById('previewStage')?.style.setProperty('--compare-pos', `${ctx.previewComparePos}%`);
        applyPreviewTransform();
    }

    function panoramaRatioValue(){
        const ctx = d();
        const presets = ctx.getPanoramaRatioPresets?.() || {};
        const preset = presets[ctx.panoramaState?.ratio];
        if(preset) return preset;
        return {
            w:Math.max(1, Number(ctx.panoramaState?.customW) || 16),
            h:Math.max(1, Number(ctx.panoramaState?.customH) || 9)
        };
    }

    function panoramaResolutionValue(){
        const longSide = 1536;
        const ratio = panoramaRatioValue();
        const aspect = ratio.w / Math.max(1, ratio.h);
        if(aspect >= 1){
            return {w:longSide, h:Math.max(1, Math.round(longSide / aspect))};
        }
        return {w:Math.max(1, Math.round(longSide * aspect)), h:longSide};
    }

    function panoramaSource(){
        const ctx = d();
        const editing = ctx.currentEditImage?.() || {};
        const image = editing.image || {};
        if(ctx.mediaKindForItem?.(image) !== 'image') return '';
        return ctx.displayMediaUrl?.(image.url ? image : (image.url || '')) || '';
    }

    function panoramaFallbackSource(){
        const ctx = d();
        const image = ctx.currentEditImage?.().image || {};
        return image?.url ? ctx.proxiedMediaUrl?.(image) || '' : '';
    }

    function isLikelyPanoramaImage(node, image, naturalW=0, naturalH=0){
        const ctx = d();
        if(ctx.mediaKindForItem?.(image || {}) !== 'image') return false;
        const text = [
            image?.name,
            image?.title,
            node?.title,
            node?.runPrompt,
            node?.runModelPrompt,
            node?.promptDraftText,
            node?.runSettings?.ratio,
            node?.runSettings?.msRatio,
            node?.runSettings?.size,
            node?.runSettings?.customSize
        ].filter(Boolean).join(' ');
        if(/(?:360|全景|环景|panorama|equirect|spherical|vr\b)/i.test(text)) return true;
        const w = Number(naturalW || image?.natural_w || image?.width || image?.w || 0);
        const h = Number(naturalH || image?.natural_h || image?.height || image?.h || 0);
        if(!(w > 0 && h > 0)) return false;
        const aspect = w / h;
        return aspect >= 1.9 && aspect <= 2.1;
    }

    async function ensurePanoramaRenderer(){
        const ctx = d();
        const ps = ctx.panoramaState;
        const canvas = document.getElementById('panoramaCanvas');
        if(!canvas || !ps) return false;
        if(!ps.three){
            ps.threeLoadPromise = ps.threeLoadPromise || import('/static/vendor/js/three-0.160.0.module.js?v=2026.05.30');
            ps.three = await ps.threeLoadPromise;
        }
        const THREE = ps.three;
        if(!ps.renderer){
            ps.renderer = new THREE.WebGLRenderer({
                canvas,
                antialias:true,
                alpha:false,
                preserveDrawingBuffer:true
            });
            ps.renderer.setPixelRatio(1);
            ps.renderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        if(!ps.scene){
            ps.scene = new THREE.Scene();
            ps.camera = new THREE.PerspectiveCamera(ps.fov, 16 / 9, 1, 1200);
            const geometry = new THREE.SphereGeometry(500, 96, 64);
            geometry.scale(-1, 1, 1);
            const material = new THREE.MeshBasicMaterial({color:0xffffff});
            ps.sphere = new THREE.Mesh(geometry, material);
            ps.scene.add(ps.sphere);
        }
        return Boolean(ps.renderer && ps.scene && ps.camera && ps.sphere);
    }

    function applyPanoramaTexture(img){
        const ctx = d();
        const ps = ctx.panoramaState;
        const THREE = ps?.three;
        if(!THREE || !ps?.sphere || !img?.naturalWidth || !img?.naturalHeight) return false;
        if(ps.texture){
            ps.texture.dispose?.();
            ps.texture = null;
        }
        const texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        ps.texture = texture;
        ps.sphere.material.map = texture;
        ps.sphere.material.needsUpdate = true;
        return true;
    }

    function drawPanoramaFrame(){
        const ctx = d();
        const ps = ctx.panoramaState;
        const canvas = document.getElementById('panoramaCanvas');
        const img = ps?.image;
        const {renderer, scene, camera, sphere, three:THREE} = ps || {};
        if(!ps?.enabled || !canvas || !renderer || !scene || !camera || !sphere || !THREE || !img?.naturalWidth || !img?.naturalHeight) return false;
        const width = Math.max(1, canvas.width);
        const height = Math.max(1, canvas.height);
        renderer.setSize(width, height, false);
        camera.fov = Math.max(35, Math.min(100, ps.fov));
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        const pitch = Math.max(-85, Math.min(85, ps.pitch));
        const phi = THREE.MathUtils.degToRad(90 - pitch);
        const theta = THREE.MathUtils.degToRad(ps.yaw);
        const target = new THREE.Vector3(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
        );
        camera.position.set(0, 0, 0);
        camera.lookAt(target);
        renderer.render(scene, camera);
        return true;
    }

    function renderPanoramaFrame(){
        const ctx = d();
        if(!drawPanoramaFrame()) return;
        ctx.panoramaState.animationId = requestAnimationFrame(renderPanoramaFrame);
    }

    function startPanoramaLoop(){
        const ctx = d();
        const ps = ctx.panoramaState;
        if(ps.animationId) cancelAnimationFrame(ps.animationId);
        ps.animationId = requestAnimationFrame(renderPanoramaFrame);
    }

    function stopPanoramaLoop(){
        const ctx = d();
        const ps = ctx.panoramaState;
        if(ps.animationId) cancelAnimationFrame(ps.animationId);
        ps.animationId = 0;
    }

    function resizePanoramaViewer(){
        const stage = document.getElementById('panoramaStage');
        const frame = document.getElementById('previewFrame');
        const canvas = document.getElementById('panoramaCanvas');
        if(!stage) return;
        const ratio = panoramaRatioValue();
        const aspect = Math.max(0.08, Math.min(12, ratio.w / ratio.h));
        const maxW = Math.max(260, Math.min(1180, window.innerWidth - 116));
        const maxH = Math.max(220, Math.min(780, window.innerHeight - 220));
        let w = maxW;
        let h = w / aspect;
        if(h > maxH){
            h = maxH;
            w = h * aspect;
        }
        w = Math.max(160, Math.round(w));
        h = Math.max(160, Math.round(h));
        stage.style.width = `${w}px`;
        stage.style.height = `${h}px`;
        stage.style.aspectRatio = `${ratio.w} / ${ratio.h}`;
        if(frame){
            frame.style.width = `${w}px`;
            frame.style.height = `${h}px`;
        }
        if(canvas){
            const render = panoramaResolutionValue();
            const nextW = Math.max(1, Math.round(render.w));
            const nextH = Math.max(1, Math.round(render.h));
            if(canvas.width !== nextW) canvas.width = nextW;
            if(canvas.height !== nextH) canvas.height = nextH;
        }
    }

    function disposePanoramaTexture(){
        const ctx = d();
        const ps = ctx.panoramaState;
        if(ps.texture){
            ps.texture.dispose?.();
            ps.texture = null;
        }
        if(ps.sphere?.material){
            ps.sphere.material.map = null;
            ps.sphere.material.needsUpdate = true;
        }
        ps.image = null;
    }

    async function loadPanoramaTexture(src, allowFallback=true){
        const ctx = d();
        const ps = ctx.panoramaState;
        if(!src) return;
        const token = ++ps.loadToken;
        const stage = document.getElementById('panoramaStage');
        stage?.classList.remove('ready');
        let ready = false;
        try {
            ready = await ensurePanoramaRenderer();
        } catch(e) {
            console.warn('panorama renderer init failed', e);
            ready = false;
        }
        if(!ready){
            stage?.classList.add('ready');
            ctx.toast?.(ctx.tr?.('smart.panoramaLoadFailed'));
            return;
        }
        if(token !== ps.loadToken) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const fallback = allowFallback ? panoramaFallbackSource() : '';
        const done = () => {
            if(token !== ps.loadToken) return;
            disposePanoramaTexture();
            if(!applyPanoramaTexture(img)){
                stage?.classList.add('ready');
                ctx.toast?.(ctx.tr?.('smart.panoramaLoadFailed'));
                return;
            }
            ps.image = img;
            ps.loadedSrc = src;
            stage?.classList.add('ready');
            resizePanoramaViewer();
            startPanoramaLoop();
        };
        const fail = () => {
            if(token !== ps.loadToken) return;
            if(fallback && fallback !== src){
                loadPanoramaTexture(fallback, false);
                return;
            }
            stage?.classList.add('ready');
            ctx.toast?.(ctx.tr?.('smart.panoramaLoadFailed'));
        };
        img.onload = done;
        img.onerror = fail;
        img.src = src;
        if(img.complete && img.naturalWidth) done();
    }

    function refreshPanoramaControls(){
        const ctx = d();
        const ps = ctx.panoramaState;
        const controls = document.getElementById('panoramaControls');
        const custom = document.getElementById('panoramaCustomRatio');
        if(controls) controls.style.display = ps.enabled ? 'inline-flex' : 'none';
        if(custom) custom.style.display = ps.enabled && ps.ratio === 'custom' ? 'inline-flex' : 'none';
        document.querySelectorAll('[data-panorama-ratio]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panoramaRatio === ps.ratio);
        });
        const w = document.getElementById('panoramaRatioW');
        const h = document.getElementById('panoramaRatioH');
        if(w && document.activeElement !== w) w.value = ps.customW;
        if(h && document.activeElement !== h) h.value = ps.customH;
    }

    function setPanoramaEnabled(enabled){
        const ctx = d();
        const ps = ctx.panoramaState;
        const next = Boolean(enabled);
        if(ps.enabled === next) return;
        ps.enabled = next;
        const stage = document.getElementById('previewStage');
        const pano = document.getElementById('panoramaStage');
        const currentImg = document.getElementById('previewCurrentImage');
        const compareLayer = document.getElementById('previewCompareLayer');
        const compareHandle = document.getElementById('previewCompareHandle');
        const toggle = document.getElementById('panoramaToggleBtn');
        const exportBtn = document.getElementById('panoramaExportBtn');
        const compareToggle = document.getElementById('compareToggleBtn');
        const compareThumbs = document.getElementById('compareThumbs');
        const previewTools = document.getElementById('imagePreviewTools');
        stage?.classList.toggle('panorama-on', next);
        previewTools?.classList.toggle('panorama-tools-on', next);
        if(pano) pano.style.display = next ? 'block' : 'none';
        if(currentImg) currentImg.style.display = next ? 'none' : 'block';
        if(compareLayer && next) compareLayer.style.display = 'none';
        if(compareHandle && next) compareHandle.style.display = 'none';
        if(toggle) toggle.classList.toggle('active', next);
        if(exportBtn) exportBtn.style.display = next ? 'inline-flex' : 'none';
        if(compareToggle) compareToggle.style.display = next ? 'none' : 'inline-flex';
        if(compareThumbs && next){ compareThumbs.style.display = 'none'; compareThumbs.innerHTML = ''; }
        ctx.previewCompareOn = next ? false : ctx.previewCompareOn;
        if(next){
            ctx.previewPan = {x:0, y:0};
            ctx.previewZoom = 1.0;
            applyPreviewTransform();
            resizePanoramaViewer();
            loadPanoramaTexture(panoramaSource());
            updatePreviewMetaHint(ctx.tr?.('smart.panoramaHint'));
        } else {
            stopPanoramaLoop();
            const frame = document.getElementById('previewFrame');
            if(frame){ frame.style.width = ''; frame.style.height = ''; }
            refreshComparePanel();
        }
        refreshPanoramaControls();
        ctx.updateZoomLabel?.();
    }

    function togglePanoramaPreview(){
        const ctx = d();
        const image = ctx.currentEditImage?.().image || {};
        if(ctx.mediaKindForItem?.(image) !== 'image') return;
        setPanoramaEnabled(!ctx.panoramaState.enabled);
    }

    function resetPanoramaView(){
        const ctx = d();
        const ps = ctx.panoramaState;
        ps.fov = 75;
        ps.yaw = 0;
        ps.pitch = 0;
        resizePanoramaViewer();
        ctx.updateZoomLabel?.();
    }

    function disposePanoramaPreview(){
        const ctx = d();
        const ps = ctx.panoramaState;
        stopPanoramaLoop();
        disposePanoramaTexture();
        ps.enabled = false;
        ps.drag = null;
        ps.loadedSrc = '';
        ps.loadToken++;
        const stage = document.getElementById('panoramaStage');
        stage?.classList.remove('ready');
        if(stage) stage.style.display = 'none';
        document.getElementById('previewStage')?.classList.remove('panorama-on', 'panning');
        document.getElementById('imagePreviewTools')?.classList.remove('panorama-tools-on');
        document.getElementById('panoramaControls')?.style.setProperty('display', 'none');
        document.getElementById('panoramaToggleBtn')?.classList.remove('active');
        document.getElementById('panoramaExportBtn')?.style.setProperty('display', 'none');
    }

    function applyPanoramaRatio(value){
        const ctx = d();
        const ps = ctx.panoramaState;
        const presets = ctx.getPanoramaRatioPresets?.() || {};
        ps.ratio = presets[value] ? value : 'custom';
        refreshPanoramaControls();
        resizePanoramaViewer();
    }

    function setPreviewComparePos(clientX){
        const ctx = d();
        const frame = document.getElementById('previewFrame');
        const stage = document.getElementById('previewStage');
        if(!frame || !stage) return;
        const rect = frame.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / Math.max(1, rect.width)) * 100));
        ctx.previewComparePos = pct;
        stage.style.setProperty('--compare-pos', `${pct}%`);
    }

    function syncPreviewFrameSize(){
        const ctx = d();
        if(ctx.panoramaState?.enabled){
            resizePanoramaViewer();
            return;
        }
        const frame = document.getElementById('previewFrame');
        const currentImg = document.getElementById('previewCurrentImage');
        const currentVideo = document.getElementById('previewCurrentVideo');
        const compareImg = document.getElementById('previewCompareImage');
        const currentMedia = currentVideo && currentVideo.style.display !== 'none' ? currentVideo : currentImg;
        if(!frame || !currentMedia) return;
        const w = currentMedia.clientWidth || currentMedia.videoWidth || currentMedia.naturalWidth || 1;
        const h = currentMedia.clientHeight || currentMedia.videoHeight || currentMedia.naturalHeight || 1;
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
        if(compareImg){
            compareImg.style.width = `${w}px`;
            compareImg.style.height = `${h}px`;
        }
    }

    function previewResolutionText(){
        const ctx = d();
        const editing = ctx.currentEditImage?.() || {};
        const image = editing.image || {};
        const currentImg = document.getElementById('previewCurrentImage');
        const currentVideo = document.getElementById('previewCurrentVideo');
        const cropImg = document.getElementById('cropImage');
        const w = Number(image.natural_w || image.width || image.w || 0) || Number(currentVideo?.videoWidth || 0) || Number(currentImg?.naturalWidth || 0) || Number(cropImg?.naturalWidth || 0);
        const h = Number(image.natural_h || image.height || image.h || 0) || Number(currentVideo?.videoHeight || 0) || Number(currentImg?.naturalHeight || 0) || Number(cropImg?.naturalHeight || 0);
        if(!w || !h) return '';
        return `${ctx.tr?.('smart.resolution')}: ${Math.round(w)} x ${Math.round(h)}`;
    }

    function updatePreviewMetaHint(extraText){
        const ctx = d();
        const text = extraText === undefined ? ctx.previewMetaExtraText : (extraText || '');
        ctx.previewMetaExtraText = text || '';
        const hint = document.getElementById('previewMetaHint');
        if(!hint) return;
        hint.textContent = [previewResolutionText(), ctx.previewMetaExtraText].filter(Boolean).join(' · ');
    }

    function rememberPreviewImageResolution(){
        const ctx = d();
        const editing = ctx.currentEditImage?.() || {};
        const image = editing.image;
        if(!image) return;
        const currentImg = document.getElementById('previewCurrentImage');
        const currentVideo = document.getElementById('previewCurrentVideo');
        const cropImg = document.getElementById('cropImage');
        const w = Number(currentVideo?.videoWidth || 0) || Number(currentImg?.naturalWidth || 0) || Number(cropImg?.naturalWidth || 0);
        const h = Number(currentVideo?.videoHeight || 0) || Number(currentImg?.naturalHeight || 0) || Number(cropImg?.naturalHeight || 0);
        if(w > 0 && h > 0 && (!image.natural_w || !image.natural_h)){
            image.natural_w = w;
            image.natural_h = h;
            ctx.scheduleSave?.();
        }
    }

    function previewCompareSources(){
        const ctx = d();
        const editing = ctx.currentEditImage?.() || {};
        const node = editing.node;
        if(!node) return [];
        const savedRefs = Array.isArray(node.runInputRefs) ? node.runInputRefs.filter(ref => ref?.url) : [];
        const upstream = savedRefs.length ? savedRefs : ctx.inputImagesFor?.(node) || [];
        const dedup = [];
        const seen = new Set();
        for(const img of upstream){
            if(!img?.url || seen.has(img.url) || ctx.mediaKindForItem?.(img) !== 'image') continue;
            seen.add(img.url);
            dedup.push(img);
        }
        if(dedup.length) return dedup;
        const sourceId = node.sourceNodeId;
        if(sourceId){
            const src = ctx.getNodes?.()?.find(n => n.id === sourceId);
            if(src && (src.images || []).length){
                for(const img of src.images){
                    if(!img?.url || seen.has(img.url) || ctx.mediaKindForItem?.(img) !== 'image') continue;
                    seen.add(img.url);
                    dedup.push(img);
                }
            }
        }
        return dedup;
    }

    function refreshComparePanel(){
        const ctx = d();
        const stage = document.getElementById('previewStage');
        const compareImg = document.getElementById('previewCompareImage');
        const currentImg = document.getElementById('previewCurrentImage');
        const currentVideo = document.getElementById('previewCurrentVideo');
        const compareLayer = document.getElementById('previewCompareLayer');
        const compareHandle = document.getElementById('previewCompareHandle');
        const thumbsEl = document.getElementById('compareThumbs');
        const toggle = document.getElementById('compareToggleBtn');
        const panoramaToggle = document.getElementById('panoramaToggleBtn');
        const editing = ctx.currentEditImage?.() || {};
        const curUrl = editing.image?.url || '';
        const isVideoPreview = ctx.mediaKindForItem?.(editing.image || {}) === 'video';
        if(panoramaToggle){
            panoramaToggle.style.display = isVideoPreview ? 'none' : 'inline-flex';
            panoramaToggle.classList.toggle('active', ctx.panoramaState?.enabled);
        }
        if(ctx.panoramaState?.enabled && !isVideoPreview){
            currentImg.onload = null;
            currentImg.onerror = null;
            currentImg.style.display = 'none';
            stage?.classList.remove('compare-on');
            if(compareLayer) compareLayer.style.display = 'none';
            if(compareHandle) compareHandle.style.display = 'none';
            if(thumbsEl){ thumbsEl.style.display = 'none'; thumbsEl.innerHTML = ''; }
            if(toggle) toggle.classList.remove('active');
            updatePreviewMetaHint(ctx.tr?.('smart.panoramaHint'));
            return;
        }
        const onCurrentLoaded = () => {
            rememberPreviewImageResolution();
            syncPreviewFrameSize();
            updatePreviewMetaHint();
        };
        if(isVideoPreview){
            currentImg.onload = null;
            currentImg.onerror = null;
            currentImg.removeAttribute('src');
            currentImg.style.display = 'none';
            if(currentVideo){
                const previewSrc = ctx.displayMediaUrl?.(editing.image || curUrl);
                currentVideo.style.display = 'block';
                currentVideo.onloadedmetadata = onCurrentLoaded;
                currentVideo.onloadeddata = onCurrentLoaded;
                if(currentVideo.getAttribute('src') !== previewSrc){
                    currentVideo.src = previewSrc;
                    currentVideo.load?.();
                }
                if(currentVideo.readyState >= 1) requestAnimationFrame(onCurrentLoaded);
            }
            ctx.previewCompareOn = false;
            ctx.previewCompareIndex = -1;
            stage.classList.remove('compare-on');
            if(compareLayer) compareLayer.style.display = 'none';
            if(compareHandle) compareHandle.style.display = 'none';
            if(thumbsEl){ thumbsEl.style.display = 'none'; thumbsEl.innerHTML = ''; }
            if(toggle){
                toggle.disabled = true;
                toggle.style.opacity = '.45';
                toggle.classList.remove('active');
                toggle.title = ctx.tr?.('smart.compareEmpty');
            }
            if(panoramaToggle) panoramaToggle.style.display = 'none';
            updatePreviewMetaHint(editing.node?.runPrompt ? `${ctx.tr?.('smart.runPromptPrefix')}${editing.node.runPrompt.slice(0, 60)}` : '');
            return;
        }
        if(currentVideo){
            currentVideo.pause?.();
            currentVideo.onloadedmetadata = null;
            currentVideo.onloadeddata = null;
            currentVideo.removeAttribute('src');
            currentVideo.load?.();
            currentVideo.style.display = 'none';
        }
        currentImg.style.display = 'block';
        currentImg.onload = onCurrentLoaded;
        currentImg.onerror = () => {
            if(currentImg.dataset.proxyFallbackTried === '1') return;
            const fallback = ctx.proxiedMediaUrl?.(editing.image || curUrl);
            if(!fallback || fallback === currentImg.getAttribute('src')) return;
            currentImg.dataset.proxyFallbackTried = '1';
            currentImg.src = fallback;
        };
        const previewSrc = ctx.displayMediaUrl?.(editing.image || curUrl);
        if(currentImg.getAttribute('src') !== previewSrc) {
            currentImg.dataset.proxyFallbackTried = '';
            currentImg.src = previewSrc;
        }
        if(currentImg.complete && currentImg.naturalWidth) requestAnimationFrame(onCurrentLoaded);
        const sources = previewCompareSources();
        const hasSource = sources.length > 0;
        if(toggle){
            toggle.disabled = !hasSource;
            toggle.style.opacity = hasSource ? '1' : '.45';
            toggle.title = hasSource ? ctx.tr?.('smart.compareHover') : ctx.tr?.('smart.compareEmpty');
            toggle.classList.toggle('active', hasSource && ctx.previewCompareOn);
        }
        if(!hasSource){
            ctx.previewCompareOn = false;
            ctx.previewCompareIndex = -1;
            stage.classList.remove('compare-on');
            if(compareLayer) compareLayer.style.display = 'none';
            if(compareHandle) compareHandle.style.display = 'none';
            thumbsEl.style.display = 'none';
            updatePreviewMetaHint(editing.node?.runPrompt ? `${ctx.tr?.('smart.runPromptPrefix')}${editing.node.runPrompt.slice(0, 60)}` : '');
            return;
        }
        const sliderActive = ctx.previewCompareOn && ctx.previewCompareIndex >= 0 && ctx.previewCompareIndex < sources.length;
        if(sliderActive){
            const src = sources[ctx.previewCompareIndex];
            compareImg.src = src?.url || '';
            compareImg.onload = syncPreviewFrameSize;
            syncPreviewFrameSize();
            stage.classList.add('compare-on');
            if(compareLayer) compareLayer.style.display = '';
            if(compareHandle) compareHandle.style.display = '';
        } else {
            stage.classList.remove('compare-on');
            if(compareLayer) compareLayer.style.display = 'none';
            if(compareHandle) compareHandle.style.display = 'none';
        }
        if(ctx.previewCompareOn){
            thumbsEl.style.display = 'inline-flex';
            thumbsEl.innerHTML = sources.map((s, i) => `<button type="button" class="compare-thumb ${i === ctx.previewCompareIndex ? 'active' : ''}" data-compare-idx="${i}" title="${ctx.escapeHtml?.(i === ctx.previewCompareIndex ? ctx.tr?.('smart.compareCancelTip') : ctx.tr?.('smart.compareUseTip'))}"><img src="${ctx.escapeHtml?.(s.url)}"></button>`).join('');
            thumbsEl.querySelectorAll('[data-compare-idx]').forEach(btn => {
                btn.onclick = e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = Number(btn.dataset.compareIdx);
                    ctx.previewCompareIndex = (ctx.previewCompareIndex === idx) ? -1 : idx;
                    refreshComparePanel();
                };
            });
        } else {
            thumbsEl.style.display = 'none';
            thumbsEl.innerHTML = '';
        }
        let txt = editing.node?.runPrompt ? `${ctx.tr?.('smart.runPromptPrefix')}${editing.node.runPrompt.slice(0, 60)}` : '';
        if(ctx.previewCompareOn && !sliderActive) txt = (txt ? `${txt} · ` : '') + ctx.tr?.('smart.compareHintPick');
        updatePreviewMetaHint(txt);
    }

    function togglePreviewCompare(){
        const ctx = d();
        const sources = previewCompareSources();
        if(!sources.length){
            ctx.toast?.(ctx.tr?.('smart.compareNoSource'));
            return;
        }
        ctx.previewCompareOn = !ctx.previewCompareOn;
        if(ctx.previewCompareOn && (ctx.previewCompareIndex < 0 || ctx.previewCompareIndex >= sources.length)) ctx.previewCompareIndex = 0;
        if(!ctx.previewCompareOn) ctx.previewCompareIndex = -1;
        refreshComparePanel();
    }

    async function exportPanoramaFrame(){
        const ctx = d();
        if(!ctx.panoramaState?.enabled) return;
        const canvasEl = document.getElementById('panoramaCanvas');
        if(!canvasEl){
            ctx.toast?.(ctx.tr?.('smart.panoramaExportFailed'));
            return;
        }
        try {
            if(!drawPanoramaFrame()) throw new Error(ctx.tr?.('smart.panoramaExportFailed'));
            const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
            if(!blob) throw new Error(ctx.tr?.('smart.panoramaExportFailed'));
            const editing = ctx.currentEditImage?.() || {};
            const rawName = editing.image?.name || ctx.fileNameFromUrl?.(editing.image?.url || '') || 'panorama';
            const base = String(rawName).replace(/\.[a-z0-9]{2,8}$/i, '') || 'panorama';
            const filename = ctx.safeExportFileName?.(`${base}-panorama.png`, 'panorama.png') || `${base}-panorama.png`;
            const uploaded = await ctx.uploadFiles?.([new File([blob], filename, {type:'image/png'})]);
            const frame = uploaded?.[0];
            if(!frame?.url) throw new Error(ctx.tr?.('smart.panoramaExportFailed'));
            frame.kind = 'image';
            frame.natural_w = canvasEl.width;
            frame.natural_h = canvasEl.height;
            const rect = editing.node ? ctx.nodeRect?.(editing.node) : null;
            const point = rect
                ? {x:rect.x + rect.width + 240, y:rect.y + rect.height / 2}
                : ctx.viewportCenter?.() || {x:0, y:0};
            ctx.pushUndo?.();
            const newNode = ctx.createImageNodeAt?.(point, [frame], {select:true, skipUndo:true});
            ctx.selectedIds = [];
            ctx.selectedImage = {nodeId:newNode.id, index:0};
            ctx.render?.();
            ctx.scheduleSave?.();
            ctx.toast?.(ctx.tr?.('smart.panoramaExportDone'));
        } catch(e) {
            ctx.toast?.((e.message || ctx.tr?.('smart.panoramaExportFailed')).slice(0, 120));
        }
    }

    function currentPreviewVideo(){
        const ctx = d();
        if(!ctx.imageEditModal?.classList?.contains('open')) return null;
        if(ctx.mediaKindForItem?.(ctx.currentEditImage?.().image || {}) !== 'video') return null;
        return document.getElementById('previewCurrentVideo');
    }

    function videoFrameStep(){
        const ctx = d();
        const image = ctx.currentEditImage?.().image || {};
        const fps = Number(image.fps || image.frameRate || image.frame_rate || image.framespersecond || image.frames_per_second || 0);
        return 1 / Math.max(1, Math.min(120, Number.isFinite(fps) && fps > 0 ? fps : 30));
    }

    function seekPreviewVideoFrames(direction){
        const video = currentPreviewVideo();
        if(!video || video.readyState < 1) return false;
        video.pause?.();
        const step = videoFrameStep();
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        const maxTime = duration ? Math.max(0, duration - step / 2) : Number.MAX_SAFE_INTEGER;
        video.currentTime = Math.max(0, Math.min(maxTime, Number(video.currentTime || 0) + direction * step));
        return true;
    }

    function waitForVideoEvent(video, eventName, timeout=1500){
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if(done) return;
                done = true;
                clearTimeout(timer);
                video.removeEventListener(eventName, finish);
                resolve();
            };
            const timer = setTimeout(finish, timeout);
            video.addEventListener(eventName, finish, {once:true});
        });
    }

    async function seekVideoForFrame(video, time){
        if(Math.abs(Number(video.currentTime || 0) - time) <= 0.002) return;
        video.currentTime = time;
        await waitForVideoEvent(video, 'seeked', 2200);
    }

    async function exportVideoFrame(which='current'){
        const ctx = d();
        const video = currentPreviewVideo();
        if(!video){ ctx.toast?.('No video frame to export'); return; }
        if(video.readyState < 2) await waitForVideoEvent(video, 'loadeddata', 2200);
        if(!video.videoWidth || !video.videoHeight){ ctx.toast?.('Video is not loaded yet'); return; }
        const originalTime = Number(video.currentTime || 0);
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        const step = videoFrameStep();
        const target = which === 'first'
            ? 0
            : which === 'last'
                ? Math.max(0, duration - step / 2)
                : originalTime;
        const suffix = which === 'first' ? 'first-frame' : which === 'last' ? 'last-frame' : 'current-frame';
        try {
            video.pause?.();
            await seekVideoForFrame(video, target);
            const canvasEl = document.createElement('canvas');
            canvasEl.width = video.videoWidth;
            canvasEl.height = video.videoHeight;
            const c2d = canvasEl.getContext('2d');
            c2d.drawImage(video, 0, 0, canvasEl.width, canvasEl.height);
            const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
            if(!blob) throw new Error('Frame export failed');
            const editing = ctx.currentEditImage?.() || {};
            const rawName = editing.image?.name || ctx.fileNameFromUrl?.(editing.image?.url || '') || 'video';
            const base = String(rawName).replace(/\.[a-z0-9]{2,8}$/i, '') || 'video';
            const filename = ctx.safeExportFileName?.(`${base}-${suffix}.png`, `${suffix}.png`) || `${base}-${suffix}.png`;
            const uploaded = await ctx.uploadFiles?.([new File([blob], filename, {type:'image/png'})]);
            const frame = uploaded?.[0];
            if(!frame?.url) throw new Error('Export to canvas failed');
            frame.kind = 'image';
            frame.natural_w = video.videoWidth;
            frame.natural_h = video.videoHeight;
            const rect = editing.node ? ctx.nodeRect?.(editing.node) : null;
            const point = rect
                ? {x:rect.x + rect.width + 240, y:rect.y + rect.height / 2}
                : ctx.viewportCenter?.() || {x:0, y:0};
            ctx.pushUndo?.();
            const newNode = ctx.createImageNodeAt?.(point, [frame], {select:true, skipUndo:true});
            ctx.selectedIds = [];
            ctx.selectedImage = {nodeId:newNode.id, index:0};
            ctx.render?.();
            ctx.scheduleSave?.();
            ctx.toast?.('已导出到画布');
            if(which !== 'current') await seekVideoForFrame(video, originalTime);
        } catch(e) {
            ctx.toast?.((e.message || 'Frame export failed').slice(0, 120));
        }
    }

    const api = Object.freeze({
        registerDeps,
        downloadPreviewFile,
        applyPreviewTransform,
        resetPreviewTransform,
        panoramaRatioValue,
        panoramaResolutionValue,
        panoramaSource,
        panoramaFallbackSource,
        isLikelyPanoramaImage,
        ensurePanoramaRenderer,
        applyPanoramaTexture,
        drawPanoramaFrame,
        renderPanoramaFrame,
        startPanoramaLoop,
        stopPanoramaLoop,
        resizePanoramaViewer,
        disposePanoramaTexture,
        loadPanoramaTexture,
        refreshPanoramaControls,
        setPanoramaEnabled,
        togglePanoramaPreview,
        resetPanoramaView,
        disposePanoramaPreview,
        applyPanoramaRatio,
        setPreviewComparePos,
        syncPreviewFrameSize,
        previewResolutionText,
        updatePreviewMetaHint,
        rememberPreviewImageResolution,
        previewCompareSources,
        refreshComparePanel,
        togglePreviewCompare,
        exportPanoramaFrame,
        currentPreviewVideo,
        videoFrameStep,
        seekPreviewVideoFrames,
        waitForVideoEvent,
        seekVideoForFrame,
        exportVideoFrame,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('imagePreview', api);
    }

    global.SmartCanvasImagePreview = api;
})(window);
