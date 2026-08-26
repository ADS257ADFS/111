/** Camera-angle generation panel for the selected canvas image. */
(function(global){
    'use strict';

    const presets = Object.freeze([
        {key:'left-top', label:'左上', azimuth:315, elevation:30},
        {key:'top', label:'俯视', azimuth:0, elevation:90},
        {key:'right-top', label:'右上', azimuth:45, elevation:30},
        {key:'left', label:'左视', azimuth:270, elevation:0},
        {key:'front', label:'正视', azimuth:0, elevation:0},
        {key:'right', label:'右视', azimuth:90, elevation:0},
        {key:'left-bottom', label:'左下', azimuth:315, elevation:-30},
        {key:'bottom', label:'仰视', azimuth:0, elevation:-60},
        {key:'right-bottom', label:'右下', azimuth:45, elevation:-30}
    ]);
    let session = null;

    function d(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }
    function presetForKey(key){ return presets.find(item => item.key === key) || null; }
    function signedAzimuth(value){
        const angle = ((Number(value) || 0) % 360 + 360) % 360;
        return angle > 180 ? angle - 360 : angle;
    }
    function horizontalCameraInstruction(horizontal){
        const signed = signedAzimuth(horizontal);
        if(signed === 0) return 'Place the camera directly in front of the subject for a true frontal view.';
        if(Math.abs(signed) === 180) return 'Orbit the camera 180 degrees around the subject and render a true rear view. The back surfaces must be dominant and the original front surfaces must not remain visible.';
        const degrees = Math.abs(signed);
        const side = signed > 0 ? 'right' : 'left';
        const profile = degrees === 90
            ? `Render a true ${side}-side profile. The ${side} side must be the dominant visible surface and the original front face must become edge-on or leave the frame.`
            : `Render the corresponding ${side}-side three-quarter view so the visible face proportions clearly change from the source image.`;
        return `Orbit the camera ${degrees} degrees to the subject's ${side} around the vertical axis. ${profile}`;
    }
    function verticalCameraInstruction(vertical){
        if(vertical === 90) return 'Place the camera directly above the subject for a true overhead top-down view. Top surfaces must dominate and vertical side faces must be strongly foreshortened.';
        if(vertical === -90) return 'Place the camera directly below the subject for a true bottom-up view. Underside surfaces must dominate.';
        if(vertical > 0) return `Raise the camera ${vertical} degrees above eye level and look downward at the subject. Top surfaces must become more visible than in the source image.`;
        if(vertical < 0) return `Lower the camera ${Math.abs(vertical)} degrees below eye level and look upward at the subject. Underside surfaces must become more visible than in the source image.`;
        return 'Keep the camera at eye level with no upward or downward tilt.';
    }
    function promptForAngles(azimuth, elevation, label=''){
        const horizontal = ((Math.round(Number(azimuth) || 0) % 360) + 360) % 360;
        const vertical = Math.max(-90, Math.min(90, Math.round(Number(elevation) || 0)));
        return [
            'CAMERA TRANSFORMATION IS MANDATORY. Use reference image 1 only as the identity and scene reference; do not copy the source viewpoint or its 2D composition.',
            `Target camera preset: ${label || 'custom view'}. Camera metadata: azimuth ${horizontal} degrees, elevation ${vertical} degrees.`,
            horizontalCameraInstruction(horizontal),
            verticalCameraInstruction(vertical),
            'Re-render the scene as a genuinely new 3D camera view. Reconstruct newly revealed surfaces and correct occlusion, perspective, foreshortening, object overlap, and cast shadows for the target camera.',
            'Keep the same subject and scene identity, object count, geometry, materials, colors, branding, readable text, lighting design, and background style, but do not preserve the original framing when it conflicts with the target view.',
            'Do not mirror, rotate, warp, crop, or paste the source pixels. The result is incorrect if it keeps the same visible faces, silhouette, overlap, or perspective as the source image.',
            'Return one coherent photorealistic image only, never a collage, diagram, split screen, contact sheet, labels, arrows, or camera UI.'
        ].join(' ');
    }
    function currentItem(s){
        const selector = `.image-node[data-id="${CSS.escape(s.nodeId)}"] [data-image-index="${s.imageIndex}"]`;
        return s.shell.querySelector(selector) || s.item;
    }
    function currentRect(s){ return currentItem(s)?.getBoundingClientRect?.() || null; }
    function cameraPositionForAngles(azimuth, elevation){
        const horizontal = ((Number(azimuth) || 0) % 360 + 360) % 360;
        const vertical = Math.max(-90, Math.min(90, Number(elevation) || 0));
        const azimuthRadians = horizontal * Math.PI / 180;
        const elevationRadians = vertical * Math.PI / 180;
        const elevationRadius = Math.cos(elevationRadians);
        const orbitX = Math.sin(azimuthRadians) * elevationRadius;
        const orbitDepth = Math.cos(azimuthRadians) * elevationRadius;
        return {
            left:50 + orbitX * 37,
            top:50 + orbitDepth * 14 - Math.sin(elevationRadians) * 34,
            depth:(orbitDepth + 1) / 2
        };
    }
    function panelHtml(){
        const buttons = presets.map(item => `<button type="button" data-mv-preset="${item.key}"><span>${item.label}</span></button>`).join('');
        return `<div class="multi-view-head"><strong>多角度编辑</strong><button type="button" data-mv-reset><span>重置参数</span><i data-lucide="rotate-ccw"></i></button></div>
            <div class="multi-view-body">
                <div class="multi-view-orbit" aria-hidden="true">
                    <span class="multi-view-sphere"></span>
                    <span class="multi-view-source-card"><img alt="当前图片"></span>
                    <span class="multi-view-camera"><i data-lucide="video"></i></span>
                    <i class="multi-view-orbit-arrow top" data-lucide="chevron-up"></i>
                    <i class="multi-view-orbit-arrow right" data-lucide="chevron-right"></i>
                    <i class="multi-view-orbit-arrow bottom" data-lucide="chevron-down"></i>
                    <i class="multi-view-orbit-arrow left" data-lucide="chevron-left"></i>
                </div>
                <div class="multi-view-controls">
                    <strong>摄像机方位</strong>
                    <div class="multi-view-presets">${buttons}</div>
                    <label class="multi-view-slider"><span>水平</span><span data-mv-value="azimuth">0°</span><input type="range" min="0" max="359" step="1" value="0" data-mv-axis="azimuth"></label>
                    <label class="multi-view-slider"><span>垂直</span><span data-mv-value="elevation">0°</span><input type="range" min="-90" max="90" step="1" value="0" data-mv-axis="elevation"></label>
                </div>
            </div>
            <button type="button" class="multi-view-apply" data-mv-apply><i data-lucide="sparkles"></i><span>应用</span></button>`;
    }
    function updatePanel(s){
        s.panel.querySelector('[data-mv-value="azimuth"]').textContent = `${Math.round(s.azimuth)}°`;
        s.panel.querySelector('[data-mv-value="elevation"]').textContent = `${Math.round(s.elevation)}°`;
        s.panel.querySelector('[data-mv-axis="azimuth"]').value = String(s.azimuth);
        s.panel.querySelector('[data-mv-axis="elevation"]').value = String(s.elevation);
        s.panel.querySelectorAll('[data-mv-preset]').forEach(button => {
            const preset = presetForKey(button.dataset.mvPreset);
            button.classList.toggle('active', Boolean(preset && preset.azimuth === s.azimuth && preset.elevation === s.elevation));
        });
        const camera = s.panel.querySelector('.multi-view-camera');
        const position = cameraPositionForAngles(s.azimuth, s.elevation);
        Object.assign(camera.style, {
            left:`${position.left}%`,
            top:`${position.top}%`,
            transform:`translate(-50%,-50%) scale(${(0.78 + position.depth * 0.24).toFixed(3)})`,
            zIndex:String(Math.round(2 + position.depth * 4))
        });
        const card = s.panel.querySelector('.multi-view-source-card');
        card.style.transform = `translate(-50%,-50%) perspective(360px) rotateY(${-signedAzimuth(s.azimuth) * 0.42}deg) rotateX(${s.elevation * 0.34}deg)`;
    }
    function setAngles(s, azimuth, elevation){
        s.azimuth = ((Math.round(Number(azimuth) || 0) % 360) + 360) % 360;
        s.elevation = Math.max(-90, Math.min(90, Math.round(Number(elevation) || 0)));
        updatePanel(s);
    }
    function positionPanel(){
        const s = session;
        if(!s) return;
        const image = currentRect(s);
        if(!image) return;
        const shell = s.shell.getBoundingClientRect();
        const width = s.panel.offsetWidth || 620;
        const half = width / 2;
        const center = Math.max(half + 12, Math.min(s.shell.clientWidth - half - 12, image.left - shell.left + image.width / 2));
        s.panel.style.left = `${center}px`;
        s.panel.style.top = `${image.bottom - shell.top + 14}px`;
    }
    function fitViewport(s){
        const deps = d();
        const image = currentRect(s);
        if(!deps?.shell || !image) return;
        const shellRect = deps.shell.getBoundingClientRect();
        const currentScale = Math.max(0.0001, Number(deps.viewport.scale) || 1);
        const worldRect = {
            x:(image.left - shellRect.left - deps.viewport.x) / currentScale,
            y:(image.top - shellRect.top - deps.viewport.y) / currentScale,
            width:image.width / currentScale,
            height:image.height / currentScale
        };
        const top = 70;
        const panelReserve = Math.min(334, Math.max(258, deps.shell.clientHeight * 0.38));
        const availW = Math.max(180, deps.shell.clientWidth - 48);
        const availH = Math.max(140, deps.shell.clientHeight - top - panelReserve - 28);
        const targetScale = Math.max(0.06, Math.min(3, Math.min(availW / worldRect.width, availH / worldRect.height) * 0.96));
        const centerX = worldRect.x + worldRect.width / 2;
        const alignedX = scale => global.SmartCanvasViewport?.composerAlignedViewportX?.(centerX, scale)
            ?? deps.shell.clientWidth / 2 - centerX * scale;
        deps.animateViewportTo?.({
            x:alignedX(targetScale),
            y:top - worldRect.y * targetScale,
            scale:targetScale
        }, {
            duration:280,
            resolveX:({scale}) => alignedX(scale),
            onDone(){
                positionPanel();
                global.SmartCanvasViewport?.settleImageAtComposerCenter?.(centerX, targetScale, 520, {requireOpen:false});
            }
        });
    }
    function restore(s){
        const deps = d();
        if(!deps) return;
        deps.animateViewportTo?.({...s.returnViewport}, {
            duration:220,
            onDone(){
                if(s.composerWasOpen) deps.updateComposer?.();
                deps.positionImageQuickToolbar?.();
            }
        });
    }
    function close(options={}){
        const s = session;
        if(!s) return;
        session = null;
        cancelAnimationFrame(s.frame);
        s.panel.remove();
        s.item?.classList?.remove('multi-view-active');
        s.shell.classList.remove('multi-view-open');
        s.shell.removeEventListener('pointerdown', s.blankHandler, true);
        global.removeEventListener('resize', positionPanel);
        global.removeEventListener('keydown', s.keyHandler);
        if(options.restoreViewport !== false) restore(s);
    }
    async function apply(){
        const s = session;
        const deps = d();
        if(!s || s.applying) return;
        s.applying = true;
        s.panel.classList.add('is-applying');
        const active = presets.find(item => item.azimuth === s.azimuth && item.elevation === s.elevation);
        const options = {
            nodeId:s.nodeId,
            imageIndex:s.imageIndex,
            azimuth:s.azimuth,
            elevation:s.elevation,
            label:active?.label || '',
            prompt:promptForAngles(s.azimuth, s.elevation, active?.label || '')
        };
        try {
            close();
            await global.SmartCanvasGeneration?.runQuickMultiViewGeneration?.(options);
        } catch(error){
            console.error('[SmartCanvasMultiView] generation failed', error);
            deps?.toast?.(`多视角生成失败：${String(error?.message || error)}`);
        }
    }
    function bind(s){
        ['pointerdown','mousedown','click'].forEach(type => s.panel.addEventListener(type, event => event.stopPropagation()));
        s.panel.addEventListener('click', event => {
            const presetButton = event.target.closest('[data-mv-preset]');
            if(presetButton){
                const preset = presetForKey(presetButton.dataset.mvPreset);
                if(preset) setAngles(s, preset.azimuth, preset.elevation);
                return;
            }
            if(event.target.closest('[data-mv-reset]')){ setAngles(s, 0, 0); return; }
            if(event.target.closest('[data-mv-apply]')) apply();
        });
        s.panel.querySelectorAll('[data-mv-axis]').forEach(input => input.addEventListener('input', event => {
            const value = Number(event.target.value) || 0;
            if(event.target.dataset.mvAxis === 'azimuth') setAngles(s, value, s.elevation);
            else setAngles(s, s.azimuth, value);
        }));
    }
    function track(){
        if(!session) return;
        positionPanel();
        session.frame = requestAnimationFrame(track);
    }
    function open(options={}){
        const deps = d();
        const nodeId = options.nodeId || deps?.selectedImage?.nodeId;
        const imageIndex = Number(options.imageIndex ?? deps?.selectedImage?.index ?? 0);
        const node = deps?.nodes?.find?.(item => item.id === nodeId);
        const image = deps?.imageForDisplay?.(node?.images?.[imageIndex]);
        if(!deps || !node || !image?.url) return false;
        if(session) close({restoreViewport:false});
        global.SmartCanvasInlineBrush?.close?.();
        global.SmartCanvasInlineImageTools?.close?.();
        deps.selectedId = nodeId;
        deps.selectedIds = [];
        deps.selectedImage = {nodeId, index:imageIndex};
        deps.syncSelectionUi?.();
        const item = deps.selectedImageElement?.();
        const media = item?.querySelector?.('img');
        if(!item || !media){ deps.toast?.('当前内容不能进行多视角编辑'); return false; }
        const panel = document.createElement('section');
        panel.className = 'multi-view-panel';
        panel.setAttribute('aria-label', '多角度编辑');
        panel.innerHTML = panelHtml();
        panel.querySelector('.multi-view-source-card img').src = deps.displayMediaUrl?.(image) || image.url;
        session = {
            node, nodeId, imageIndex, image, item, media, panel, shell:deps.shell,
            azimuth:0, elevation:0, applying:false, frame:0,
            composerWasOpen:Boolean(deps.composer?.classList.contains('open')),
            returnViewport:{x:deps.viewport.x, y:deps.viewport.y, scale:deps.viewport.scale},
            blankHandler:null, keyHandler:null
        };
        session.blankHandler = event => {
            if(event.button !== 0 || event.target.closest?.('.multi-view-panel,.image-quick-toolbar,.multi-view-active')) return;
            close();
        };
        session.keyHandler = event => { if(event.key === 'Escape') close(); };
        item.classList.add('multi-view-active');
        deps.shell.classList.add('multi-view-open');
        deps.shell.appendChild(panel);
        deps.composer?.classList.remove('open');
        bind(session);
        setAngles(session, 0, 0);
        deps.shell.addEventListener('pointerdown', session.blankHandler, true);
        global.addEventListener('resize', positionPanel);
        global.addEventListener('keydown', session.keyHandler);
        requestAnimationFrame(() => fitViewport(session));
        track();
        global.lucide?.createIcons?.({attrs:{'stroke-width':1.8}});
        return true;
    }

    const api = Object.freeze({presets, presetForKey, promptForAngles, cameraPositionForAngles, open, close, apply, isOpen:() => Boolean(session)});
    global.SmartCanvasCore?.register?.('multiView', api);
    global.SmartCanvasMultiView = api;
})(window);
