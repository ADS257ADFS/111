(function(global){
    'use strict';

    const MIN_SCALE = 0.04;
    const MAX_SCALE = 8;
    const ZOOM_FACTOR = 1.2;
    let bound = false;
    let state = null;
    let editorPanelHome = null;

    function deps(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }

    function elements(){
        return {
            overlay:document.getElementById('imageLightbox'),
            stage:document.getElementById('imageLightboxStage'),
            media:document.getElementById('imageLightboxMedia'),
            image:document.getElementById('imageLightboxImage'),
            title:document.getElementById('imageLightboxTitle'),
            resolution:document.getElementById('imageLightboxResolution'),
            zoomValue:document.getElementById('imageLightboxZoomValue'),
            close:document.getElementById('imageLightboxClose'),
            prev:document.getElementById('imageLightboxPrev'),
            next:document.getElementById('imageLightboxNext'),
            zoomOut:document.getElementById('imageLightboxZoomOut'),
            zoomIn:document.getElementById('imageLightboxZoomIn'),
            fit:document.getElementById('imageLightboxFit'),
            actual:document.getElementById('imageLightboxActual'),
            download:document.getElementById('imageLightboxDownload'),
            editorHost:document.getElementById('imageLightboxEditorHost'),
            toolButtons:Array.from(document.querySelectorAll('[data-image-lightbox-tool]'))
        };
    }

    function clampScale(value){
        return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(value) || 1));
    }

    function currentEntry(){
        return state?.entries?.[state.position] || null;
    }

    function setApplicationPreviewMode(active){
        try {
            if(global.parent && global.parent !== global){
                global.parent.document.documentElement.classList.toggle('canvas-image-lightbox-active', Boolean(active));
                global.parent.document.body?.classList.toggle('canvas-image-lightbox-active', Boolean(active));
            }
        } catch(e) {}
    }

    function applyTransform(){
        if(!state) return;
        const el = elements();
        el.media.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
        el.zoomValue.textContent = `${Math.round(state.scale * 100)}%`;
    }

    function syncToolState(){
        const el = elements();
        el.toolButtons.forEach(button => button.classList.toggle('active', button.dataset.imageLightboxTool === state?.selectedTool));
    }

    function rememberEditorPanelHome(){
        if(editorPanelHome?.panel) return editorPanelHome;
        const modal = document.getElementById('imageEditModal');
        const panel = modal?.querySelector(':scope > .image-edit-panel');
        if(!modal || !panel) return null;
        editorPanelHome = {modal, panel, next:panel.nextSibling};
        return editorPanelHome;
    }

    function mountEditorPanel(){
        const home = rememberEditorPanelHome();
        const el = elements();
        if(!home || !el.editorHost || !state) return false;
        el.editorHost.hidden = false;
        el.editorHost.appendChild(home.panel);
        el.overlay.classList.add('editing');
        state.editing = true;
        requestAnimationFrame(() => {
            const d = deps();
            const editor = global.SmartCanvasImageEdit;
            if(d){
                d.imageEditBaseW = 0;
                d.imageEditBaseH = 0;
                d.imageEditZoom = 1;
            }
            editor?.ensureImageEditBaseSize?.(true);
            editor?.applyImageEditZoom?.();
            if(d?.imageEditMode === 'crop') editor?.resetCropBox?.();
            else if(d?.imageEditMode === 'outpaint') editor?.resetOutpaintBox?.();
            editor?.syncImageEditOverflow?.();
            syncEditorZoomValue();
        });
        return true;
    }

    function restoreEditorPanel(){
        const home = editorPanelHome;
        const el = elements();
        if(home?.modal && home?.panel && home.panel.parentNode !== home.modal){
            if(home.next?.parentNode === home.modal) home.modal.insertBefore(home.panel, home.next);
            else home.modal.appendChild(home.panel);
        }
        if(el.editorHost) el.editorHost.hidden = true;
        el.overlay?.classList.remove('editing');
    }

    function syncEditorZoomValue(){
        if(!state?.editing) return;
        const d = deps();
        const el = elements();
        if(!d || !el.zoomValue) return;
        el.zoomValue.textContent = `${Math.round((Number(d.imageEditZoom) || 1) * 100)}%`;
    }

    function adjustEditorZoom(factor){
        if(!state?.editing) return false;
        const d = deps();
        const editor = global.SmartCanvasImageEdit;
        if(!d || typeof editor?.applyImageEditZoom !== 'function') return false;
        const oldZoom = Math.max(.15, Number(d.imageEditZoom) || 1);
        const nextZoom = Math.max(.15, Math.min(6, oldZoom * factor));
        d.imageEditZoom = nextZoom;
        editor.applyImageEditZoom(nextZoom / oldZoom);
        syncEditorZoomValue();
        return true;
    }

    function fitCurrent(){
        if(state?.editing){
            global.SmartCanvasImageEdit?.resetImageEditZoom?.();
            syncEditorZoomValue();
            return;
        }
        fitToStage();
    }

    function fitToStage(){
        if(!state) return;
        const el = elements();
        const rect = el.stage.getBoundingClientRect();
        const naturalW = el.image.naturalWidth || 1;
        const naturalH = el.image.naturalHeight || 1;
        state.fitScale = clampScale(Math.min((rect.width - 56) / naturalW, (rect.height - 56) / naturalH));
        state.scale = state.fitScale;
        state.panX = 0;
        state.panY = 0;
        applyTransform();
    }

    function setScale(nextScale, anchorX, anchorY){
        if(!state) return;
        const oldScale = state.scale;
        const next = clampScale(nextScale);
        if(next === oldScale) return;
        if(Number.isFinite(anchorX) && Number.isFinite(anchorY)){
            const rect = elements().stage.getBoundingClientRect();
            const x = anchorX - (rect.left + rect.width / 2) - state.panX;
            const y = anchorY - (rect.top + rect.height / 2) - state.panY;
            const ratio = next / oldScale;
            state.panX -= x * (ratio - 1);
            state.panY -= y * (ratio - 1);
        }
        state.scale = next;
        applyTransform();
    }

    function entriesForNode(d, node){
        return (node?.images || []).map((item, imageIndex) => ({item, imageIndex})).filter(({item}) => {
            return (d.mediaKindForItem?.(item) || item?.kind || 'image') === 'image';
        });
    }

    function sourceFor(d, entry, imageEl){
        return d.displayMediaUrl?.(entry?.item) || entry?.item?.url || imageEl?.querySelector?.('img')?.src || imageEl?.src || '';
    }

    function loadCurrent(imageEl = null){
        if(!state) return false;
        const d = deps();
        const el = elements();
        const entry = currentEntry();
        if(!d || !entry || !el.image) return false;
        const source = sourceFor(d, entry, imageEl);
        if(!source) return false;
        const item = entry.item || {};
        const node = d.nodes?.find?.(candidate => candidate.id === state.nodeId);
        el.title.textContent = item.name || item.title || node?.title || '图片预览';
        el.resolution.textContent = '';
        el.image.alt = item.name || item.title || '预览图片';
        el.image.onload = () => {
            if(!state) return;
            el.resolution.textContent = `${el.image.naturalWidth} × ${el.image.naturalHeight}`;
            fitToStage();
        };
        el.image.onerror = () => {
            if(!state) return;
            el.resolution.textContent = '图片加载失败';
        };
        el.image.src = source;
        el.prev.disabled = state.entries.length < 2;
        el.next.disabled = state.entries.length < 2;
        if(el.image.complete && el.image.naturalWidth) el.image.onload();
        return true;
    }

    function open(nodeId, imageIndex = 0, imageEl = null, options = {}){
        const d = deps();
        const el = elements();
        const node = d?.nodes?.find?.(candidate => candidate.id === nodeId);
        if(!node || !el.overlay || !el.stage || !el.image) return false;
        const entries = entriesForNode(d, node);
        const position = entries.findIndex(entry => entry.imageIndex === Number(imageIndex));
        if(!entries.length || position < 0) return false;
        bind();
        state = {
            nodeId,
            entries,
            position,
            scale:1,
            fitScale:1,
            panX:0,
            panY:0,
            drag:null,
            selectedTool:['crop','outpaint','grid'].includes(options?.selectedTool) ? options.selectedTool : ''
        };
        el.overlay.hidden = false;
        el.overlay.classList.add('open');
        el.overlay.setAttribute('aria-hidden', 'false');
        d.shell?.classList.add('image-lightbox-active');
        setApplicationPreviewMode(true);
        syncToolState();
        loadCurrent(imageEl);
        el.close?.focus?.({preventScroll:true});
        if(state.selectedTool){
            const requestedTool = state.selectedTool;
            requestAnimationFrame(() => {
                if(state && !state.editing) activateTool(requestedTool);
            });
        }
        return true;
    }

    function close(options = {}){
        const d = deps();
        const el = elements();
        if(!state || !el.overlay) return false;
        if(state.editing){
            state.closing = true;
            global.SmartCanvasImageEdit?.closeImageEditor?.();
            restoreEditorPanel();
        }
        state = null;
        el.overlay.classList.remove('open');
        el.overlay.setAttribute('aria-hidden', 'true');
        el.overlay.hidden = true;
        el.image.removeAttribute('src');
        el.media.classList.remove('dragging');
        d?.shell?.classList.remove('image-lightbox-active');
        if(!options?.preserveApplicationLayer) setApplicationPreviewMode(false);
        if(!options?.preserveApplicationLayer) d?.shell?.focus?.({preventScroll:true});
        return true;
    }

    function activateTool(mode){
        if(!state || !['crop','outpaint','grid'].includes(mode)) return false;
        const d = deps();
        const editor = global.SmartCanvasImageEdit;
        const entry = currentEntry();
        if(!d || !entry || typeof editor?.openImageEditor !== 'function'){
            setApplicationPreviewMode(false);
            return false;
        }
        state.selectedTool = mode;
        syncToolState();
        if(state.editing){
            editor.setImageEditMode?.(mode, true);
            editor.setImageEditorContext?.(mode);
            syncEditorZoomValue();
            return true;
        }
        editor.openImageEditor(state.nodeId, entry.imageIndex);
        editor.setImageEditMode?.(mode, true);
        editor.setImageEditorContext?.(mode);
        mountEditorPanel();
        syncEditorZoomValue();
        setApplicationPreviewMode(true);
        return true;
    }

    function onEmbeddedEditorClosed(){
        if(!state?.editing){
            restoreEditorPanel();
            return false;
        }
        const wasClosing = Boolean(state.closing);
        const activeImageIndex = currentEntry()?.imageIndex ?? 0;
        restoreEditorPanel();
        state.editing = false;
        state.selectedTool = '';
        syncToolState();
        if(wasClosing) return true;
        const d = deps();
        const node = d?.nodes?.find?.(candidate => candidate.id === state.nodeId);
        const entries = entriesForNode(d, node);
        if(entries.length){
            state.entries = entries;
            const nextPosition = entries.findIndex(entry => entry.imageIndex === activeImageIndex);
            state.position = nextPosition >= 0 ? nextPosition : Math.min(state.position, entries.length - 1);
            loadCurrent();
        }
        setApplicationPreviewMode(true);
        return true;
    }

    function move(offset){
        if(!state || state.entries.length < 2) return;
        state.position = (state.position + offset + state.entries.length) % state.entries.length;
        state.panX = 0;
        state.panY = 0;
        state.scale = 1;
        loadCurrent();
    }

    function downloadCurrent(){
        const d = deps();
        const item = currentEntry()?.item;
        if(!d || !item?.url) return;
        const name = d.downloadNameForMediaItem?.(item, 'image') || item.name || 'image';
        const link = document.createElement('a');
        link.href = `/api/download-output?url=${encodeURIComponent(item.url)}&name=${encodeURIComponent(name)}`;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function bind(){
        if(bound) return;
        const el = elements();
        if(!el.overlay) return;
        bound = true;
        el.close.addEventListener('click', close);
        el.prev.addEventListener('click', () => move(-1));
        el.next.addEventListener('click', () => move(1));
        el.zoomOut.addEventListener('click', () => state?.editing ? adjustEditorZoom(1 / ZOOM_FACTOR) : setScale(state.scale / ZOOM_FACTOR));
        el.zoomIn.addEventListener('click', () => state?.editing ? adjustEditorZoom(ZOOM_FACTOR) : setScale(state.scale * ZOOM_FACTOR));
        el.fit.addEventListener('click', fitCurrent);
        el.actual.addEventListener('click', () => {
            if(!state) return;
            if(state.editing){
                fitCurrent();
                return;
            }
            state.panX = 0;
            state.panY = 0;
            setScale(1);
            applyTransform();
        });
        el.zoomValue.addEventListener('click', fitCurrent);
        el.download.addEventListener('click', downloadCurrent);
        el.toolButtons.forEach(button => button.addEventListener('click', () => activateTool(button.dataset.imageLightboxTool)));
        document.getElementById('imageEditStage')?.addEventListener('wheel', () => {
            if(state?.editing) requestAnimationFrame(syncEditorZoomValue);
        }, {passive:true});
        el.overlay.addEventListener('click', event => {
            if(event.target === el.overlay || event.target === el.stage) close();
        });
        el.stage.addEventListener('wheel', event => {
            if(!state) return;
            event.preventDefault();
            event.stopPropagation();
            const direction = event.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
            setScale(state.scale * direction, event.clientX, event.clientY);
        }, {passive:false});
        el.image.addEventListener('dblclick', event => {
            event.preventDefault();
            event.stopPropagation();
            const atFit = Math.abs(state.scale - state.fitScale) < 0.01;
            if(atFit){
                state.panX = 0;
                state.panY = 0;
                setScale(1, event.clientX, event.clientY);
            } else {
                fitToStage();
            }
        });
        el.image.addEventListener('mousedown', event => {
            if(!state || event.button !== 1) return;
            event.preventDefault();
            event.stopPropagation();
            state.drag = {x:event.clientX, y:event.clientY, panX:state.panX, panY:state.panY};
            el.media.classList.add('dragging');
        });
        window.addEventListener('mousemove', event => {
            if(!state?.drag) return;
            state.panX = state.drag.panX + event.clientX - state.drag.x;
            state.panY = state.drag.panY + event.clientY - state.drag.y;
            applyTransform();
        });
        window.addEventListener('mouseup', () => {
            if(!state) return;
            state.drag = null;
            el.media.classList.remove('dragging');
        });
        el.image.addEventListener('auxclick', event => {
            if(event.button === 1) event.preventDefault();
        });
        window.addEventListener('keydown', event => {
            if(!state) return;
            if(event.key === 'Escape'){
                event.preventDefault();
                event.stopImmediatePropagation();
                close();
            } else if(event.key === 'ArrowLeft'){
                event.preventDefault();
                move(-1);
            } else if(event.key === 'ArrowRight'){
                event.preventDefault();
                move(1);
            } else if(event.key === '+' || event.key === '='){
                event.preventDefault();
                if(state.editing) adjustEditorZoom(ZOOM_FACTOR);
                else setScale(state.scale * ZOOM_FACTOR);
            } else if(event.key === '-'){
                event.preventDefault();
                if(state.editing) adjustEditorZoom(1 / ZOOM_FACTOR);
                else setScale(state.scale / ZOOM_FACTOR);
            } else if(event.key === '0'){
                event.preventDefault();
                fitCurrent();
            }
        }, true);
        window.addEventListener('resize', () => {
            if(!state) return;
            if(state.editing) global.SmartCanvasImageEdit?.syncImageEditOverflow?.();
            else fitToStage();
        });
        window.addEventListener('pagehide', () => setApplicationPreviewMode(false));
    }

    global.SmartCanvasImageLightbox = Object.freeze({
        open,
        close,
        activateTool,
        onEmbeddedEditorClosed,
        isOpen:() => Boolean(state),
        isEditing:() => Boolean(state?.editing)
    });
})(window);
