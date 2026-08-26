/**
 * Smart Canvas — empty upload node chrome (blank area click / dblclick viewport).
 */
(function(global){
    'use strict';

    function isEmptyUploadNode(node){
        return false;
    }

    function isUploadDropTarget(target){
        return !!target?.closest?.('.node-drop,[data-upload-action]');
    }

    function isBlockedChromeTarget(target){
        return !!target?.closest?.('.node-delete,.node-port,.node-resize-handle,.mini-x,button,input,textarea,select');
    }

    function isBlankChromeTarget(target, nodeEl){
        if(!target || !nodeEl) return false;
        if(isUploadDropTarget(target) || isBlockedChromeTarget(target)) return false;
        return target.closest?.('.image-node.empty-node') === nodeEl;
    }

    function openEmptyUploadComposer(nodeId, api){
        if(!api || !nodeId) return false;
        api.hideSelectionGroupBox?.();
        api.setSelectionMarqueeActive?.(false);
        api.setSmartCascadeSilentSelection?.(false);
        api.setSelectedIds?.([]);
        api.setSelectedId?.(nodeId);
        api.setSelectedImage?.({nodeId, index:-1});
        api.syncSelectionUi?.();
        api.updateComposer?.();
        api.focusCanvasForShortcuts?.();
        const node = api.getNodes?.()?.find?.(n => n.id === nodeId);
        if(node) api.scheduleComposerReposition?.(node);
        return true;
    }

    function shouldPreserveClick(node, target){
        const nodeEl = target?.closest?.('.image-node.empty-node');
        if(!nodeEl || !isEmptyUploadNode(node)) return false;
        return isBlankChromeTarget(target, nodeEl);
    }

    let blankDragGesture = false;

    function markDragGesture(){
        blankDragGesture = true;
    }

    function consumeDragGesture(){
        if(!blankDragGesture) return false;
        blankDragGesture = false;
        return true;
    }

    function resetDragGesture(){
        blankDragGesture = false;
    }

    function bindBlankChromeGestures(nodeEl, nodeId, api){
        if(!nodeEl || !nodeId || !api || nodeEl.dataset.emptyChromeBound === '1') return;
        nodeEl.dataset.emptyChromeBound = '1';
    }

    function armBlankOpenOnMouseUp(nodeId, api, startX, startY, originTarget){
        const nodeEl = originTarget?.closest?.('.image-node.empty-node');
        if(!nodeEl || !nodeId || !api) return;
        const onUp = e => {
            if(e.button !== 0) return;
            document.removeEventListener('mouseup', onUp, true);
            const node = api.getNodes?.()?.find?.(n => n.id === nodeId);
            if(!isEmptyUploadNode(node)) return;
            const upBlank = isBlankChromeTarget(e.target, nodeEl);
            const downBlank = isBlankChromeTarget(originTarget, nodeEl);
            if(!upBlank && !downBlank) return;
            const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > 5;
            if(moved || consumeDragGesture()) return;
            openEmptyUploadComposer(nodeId, api);
        };
        document.addEventListener('mouseup', onUp, true);
    }

    function handleBlankClick(nodeId, event){
        const node = event?.__emptyNodeRef;
        const nodeEl = event?.currentTarget?.closest?.('.image-node') || event?.target?.closest?.('.image-node');
        if(!isEmptyUploadNode(node) || !isBlankChromeTarget(event?.target, nodeEl)) return false;
        if(consumeDragGesture()) return false;
        return openEmptyUploadComposer(nodeId, event?.__emptyNodeApi);
    }

    function handleBlankDoubleClick(nodeId, event){
        const node = event?.__emptyNodeRef;
        const nodeEl = event?.currentTarget?.closest?.('.image-node') || event?.target?.closest?.('.image-node');
        if(!isEmptyUploadNode(node) || !isBlankChromeTarget(event?.target, nodeEl)) return false;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        openEmptyUploadComposer(nodeId, event?.__emptyNodeApi);
        global.SmartCanvasDblClickViewport?.activateEmptyNode?.(nodeId, nodeEl);
        return true;
    }

    const api = Object.freeze({
        isEmptyUploadNode,
        isUploadDropTarget,
        isBlankChromeTarget,
        shouldPreserveClick,
        markDragGesture,
        consumeDragGesture,
        resetDragGesture,
        bindBlankChromeGestures,
        armBlankOpenOnMouseUp,
        openEmptyUploadComposer,
        handleBlankClick,
        handleBlankDoubleClick
    });
    global.SmartCanvasCore?.register?.('emptyNodeChrome', api);
    global.SmartCanvasEmptyNodeChrome = api;
})(window);
