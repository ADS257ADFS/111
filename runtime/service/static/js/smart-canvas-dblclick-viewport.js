(function(global){
    'use strict';

    /** @type {{ kind:'image'|'prompt', nodeId:string, imageIndex:number, returnViewport:{x:number,y:number,scale:number}, isZoomedIn:boolean } | null} */
    let toggleState = null;
    const ACTIVATE_DEBOUNCE_MS = 120;
    let lastImageActivate = {nodeId:'', imageIndex:-1, time:0};
    let lastPromptActivate = {nodeId:'', time:0};

    function deps(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }

    function normalizeImageIndex(imageIndex){
        const index = Number(imageIndex);
        return Number.isFinite(index) ? index : 0;
    }

    function snapshotViewport(d){
        const v = d.viewport;
        return { x: v.x, y: v.y, scale: v.scale };
    }

    function viewportMatches(a, b, tolerance = { xy: 4, scale: 0.025 }){
        if(!a || !b) return false;
        return Math.abs(a.x - b.x) <= tolerance.xy
            && Math.abs(a.y - b.y) <= tolerance.xy
            && Math.abs(a.scale - b.scale) <= tolerance.scale;
    }

    function sameImageTarget(nodeId, imageIndex){
        return toggleState?.kind === 'image'
            && toggleState.nodeId === nodeId
            && toggleState.imageIndex === normalizeImageIndex(imageIndex);
    }

    function samePromptTarget(nodeId){
        return toggleState?.kind === 'prompt' && toggleState.nodeId === nodeId;
    }

    function isViewportZoomedIn(d){
        if(!toggleState?.returnViewport) return false;
        return !viewportMatches(d.viewport, toggleState.returnViewport);
    }

    function shouldSkipDuplicateImageActivate(nodeId, imageIndex){
        const now = Date.now();
        const index = normalizeImageIndex(imageIndex);
        if(lastImageActivate.nodeId === nodeId
            && lastImageActivate.imageIndex === index
            && now - lastImageActivate.time < ACTIVATE_DEBOUNCE_MS){
            return true;
        }
        lastImageActivate = {nodeId, imageIndex:index, time:now};
        return false;
    }

    function shouldSkipDuplicatePromptActivate(nodeId){
        const now = Date.now();
        if(lastPromptActivate.nodeId === nodeId && now - lastPromptActivate.time < ACTIVATE_DEBOUNCE_MS) return true;
        lastPromptActivate = {nodeId, time:now};
        return false;
    }

    function afterZoomOut(d){
        const node = d.nodes?.find?.(n => n.id === toggleState?.nodeId);
        if(node){
            d.positionComposerForNode?.(node);
            d.positionImageQuickToolbar?.();
        }
    }

    function scheduleViewportFit(run){
        requestAnimationFrame(() => requestAnimationFrame(run));
    }

    function zoomOut(d){
        if(!toggleState?.returnViewport) return false;
        const target = {...toggleState.returnViewport};
        d.animateViewportTo?.(target, { duration: 280, onDone: () => afterZoomOut(d) });
        toggleState.isZoomedIn = false;
        return true;
    }

    function prepareZoomIn(kind, nodeId, imageIndex = -1){
        const d = deps();
        if(!d) return false;
        toggleState = {
            kind,
            nodeId,
            imageIndex: kind === 'image' ? normalizeImageIndex(imageIndex) : -1,
            returnViewport: snapshotViewport(d),
            isZoomedIn: true
        };
        return false;
    }

    /** @returns {boolean} true = zoom-out handled, caller should skip zoom-in */
    function handleImageZoom(nodeId, imageIndex){
        const d = deps();
        if(!d) return false;
        const index = normalizeImageIndex(imageIndex);
        if(sameImageTarget(nodeId, index) && toggleState?.returnViewport){
            if(toggleState.isZoomedIn || isViewportZoomedIn(d)) return zoomOut(d);
        }
        return prepareZoomIn('image', nodeId, index);
    }

    /** @returns {boolean} true = zoom-out handled, caller should skip zoom-in */
    function handlePromptZoom(nodeId){
        const d = deps();
        if(!d) return false;
        if(samePromptTarget(nodeId) && toggleState?.returnViewport){
            if(toggleState.isZoomedIn || isViewportZoomedIn(d)) return zoomOut(d);
        }
        return prepareZoomIn('prompt', nodeId, -1);
    }

    function activateImage(nodeId, imageIndex = 0, imageEl = null){
        if(!nodeId) return false;
        if(shouldSkipDuplicateImageActivate(nodeId, imageIndex)) return true;
        return Boolean(global.SmartCanvasImageLightbox?.open?.(nodeId, normalizeImageIndex(imageIndex), imageEl));
    }

    function activatePrompt(nodeId){
        if(!nodeId) return false;
        if(shouldSkipDuplicatePromptActivate(nodeId)) return true;
        if(handlePromptZoom(nodeId)) return true;
        const d = deps();
        const node = d?.nodes?.find?.(n => n.id === nodeId);
        if(!node) return false;
        scheduleViewportFit(() => d.fitViewportToPromptNode?.(node));
        return true;
    }

    function activateEmptyNode(nodeId, nodeEl = null){
        return activateImage(nodeId, -1, nodeEl);
    }

    const api = Object.freeze({
        handleImageZoom,
        handlePromptZoom,
        activateImage,
        activatePrompt,
        activateEmptyNode
    });
    global.SmartCanvasCore?.register?.('dblclickViewport', api);
    global.SmartCanvasDblClickViewport = api;
})(window);
