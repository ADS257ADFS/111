/**
 * Smart Canvas — canvas node/image selection state and UI sync.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeSelection] deps not registered');
        return c;
    }
    function nodes(){ return S().getNodes(); }

function clearSelection(){
    S().savePromptDraftForCurrent();
    S().selectedId = '';
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    S().smartGroupCapsuleOnly = false;
    global.SmartCanvasConnectionSelection?.clear?.();
    global.SmartCanvasSelectionCapsuleSelection?.clearMultiSelectSnapshot?.();
    S().hideImageQuickToolbar();
    S().hideSelectionGroupBox();
    S().updateComposer?.();
}

function clearImageClickTimer(){
    if(S().imageClickTimer){
        clearTimeout(S().imageClickTimer);
        S().imageClickTimer = null;
    }
}

function activateImageDoubleClick(nodeId, imageIndex=0, imageEl=null){
    if(!nodeId) return;
    S().imageDblClickState = {nodeId:'', index:-1, time:0};
    selectCanvasImage(nodeId, imageIndex);
    window.SmartCanvasIsolatedFeatures?.handleImageDoubleClick?.(nodeId, imageIndex, imageEl);
}

function activatePromptNodeDoubleClick(node){
    if(!node) return;
    S().selectedId = node.id;
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    syncSelectionUi();
    window.SmartCanvasIsolatedFeatures?.handlePromptDoubleClick?.(node);
}

function noteImageClickForDouble(nodeId, imageIndex=0, imageEl=null){
    const now = Date.now();
    if(S().imageDblClickState.nodeId === nodeId && S().imageDblClickState.index === imageIndex && now - S().imageDblClickState.time <= S().IMAGE_DBLCLICK_MS){
        activateImageDoubleClick(nodeId, imageIndex, imageEl);
        return true;
    }
    S().imageDblClickState = {nodeId, index:imageIndex, time:now};
    return false;
}

function selectedImageElement(){
    if(!S().selectedImage.nodeId || S().selectedImage.index < 0) return null;
    const node = nodes().find(n => n.id === S().selectedImage.nodeId);
    if(!node?.images?.[S().selectedImage.index]?.url) return null;
    const nodeEl = S().world.querySelector(`.image-node[data-id="${CSS.escape(S().selectedImage.nodeId)}"]`);
    return nodeEl?.querySelector(`.thumb-item[data-image-index="${S().selectedImage.index}"],.image-wrap[data-image-index="${S().selectedImage.index}"]`) || null;
}

function engageSmartGroup(groupId, e){
    if(!groupId || !e) return false;
    const group = nodes().find(n => n.id === groupId && S().isSmartGroupNode(n));
    if(!group) return false;
    showSmartGroupCapsule(groupId);
    return S().queueSmartNodeDrag(e, groupId);
}

function showSmartGroupCapsule(groupId){
    const group = nodes().find(n => n.id === groupId && S().isSmartGroupNode(n));
    if(!group) return false;
    S().hideRunTimerForNode(group);
    S().selectedId = group.id;
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    S().smartGroupCapsuleOnly = true;
    S().selectionMarqueeActive = true;
    if(S().smartCascadeAnyRunning()) S().smartCascadeSilentSelection = false;
    syncSelectionUi();
    S().updateComposer();
    S().positionSelectionGroupBox();
    window.SmartCanvasIsolatedFeatures?.syncCapsule?.();
    return true;
}

function selectSmartGroup(groupId){
    const group = nodes().find(n => n.id === groupId && S().isSmartGroupNode(n));
    if(!group) return false;
    S().hideRunTimerForNode(group);
    S().selectedId = group.id;
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    S().smartGroupCapsuleOnly = false;
    S().selectionMarqueeActive = true;
    if(S().smartCascadeAnyRunning()) S().smartCascadeSilentSelection = false;
    syncSelectionUi();
    S().updateComposer();
    S().positionSelectionGroupBox();
    return true;
}

function selectCanvasImage(nodeId, imageIndex=0){
    const owner = nodes().find(n => n.id === nodeId);
    if(!owner) return;
    S().hideRunTimerForNode(owner);
    S().selectionMarqueeActive = false;
    S().hideSelectionGroupBox();
    S().selectedId = nodeId;
    S().selectedIds = [];
    S().selectedImage = {nodeId, index:imageIndex};
    if(S().smartCascadeAnyRunning()) S().smartCascadeSilentSelection = false;
    syncSelectionUi();
    S().updateComposer();
}

function selectCanvasImageFromEvent(event, stopClick=false){
    if(event.button !== undefined && event.button !== 0) return false;
    if(event.target.closest('.image-delete,.image-quick-toolbar')) return false;
    const item = event.target.closest('.thumb-item,.image-wrap');
    const nodeEl = item?.closest('.image-node');
    if(!item || !nodeEl?.dataset?.id) return false;
    const imageIndex = Number(item.dataset.imageIndex || 0);
    selectCanvasImage(nodeEl.dataset.id, imageIndex);
    if(stopClick){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }
    return true;
}

function syncSelectionUi(){
    S().world.querySelectorAll('.image-node').forEach(el => {
        const id = el.dataset.id || '';
        el.classList.toggle('selected', isNodeSelected(id));
        el.querySelectorAll('.thumb-item,.image-wrap').forEach(item => {
            const index = Number(item.dataset.imageIndex || 0);
            item.classList.toggle('image-selected', S().selectedImage.nodeId === id && S().selectedImage.index === index);
        });
    });
    S().positionImageQuickToolbar();
    if(S().selectionMarqueeActive) S().positionSelectionGroupBox();
    if(S().composer?.classList.contains('open')){
        const node = S().selectedNode();
        if(node) S().positionComposerForNode(node);
    }
}

function isNodeSelected(id){
    if(S().selectedId === id || S().selectedIds.includes(id)) return true;
    if(S().smartGroupCapsuleOnly) return false;
    if(!S().selectionMarqueeActive || !S().selectedId) return false;
    const group = nodes().find(n => n.id === S().selectedId && S().isSmartGroupNode(n));
    if(!group) return false;
    if(id === group.id) return true;
    return Boolean(S().smartGroupContainingNode(id)?.id === group.id);
}

function selectedNodeIds(){
    return S().selectedIds.length ? S().selectedIds.slice() : (S().selectedId ? [S().selectedId] : []);
}

function isEditableTarget(target){
    const el = target || document.activeElement;
    return !!el?.closest?.('input, textarea, select, option, [contenteditable="true"], .prompt-node-control, .prompt-input');
}

function focusCanvasForShortcuts(){
    try {
        window.focus();
        S().shell?.focus?.({ preventScroll: true });
    } catch(e) {}
}

function selectedNode(){
    return nodes().find(n => n.id === S().selectedId) || null;
}

    const api = Object.freeze({
        registerDeps,
        clearSelection,
        clearImageClickTimer,
        activateImageDoubleClick,
        activatePromptNodeDoubleClick,
        noteImageClickForDouble,
        selectedImageElement,
        engageSmartGroup,
        showSmartGroupCapsule,
        selectSmartGroup,
        selectCanvasImage,
        selectCanvasImageFromEvent,
        syncSelectionUi,
        isNodeSelected,
        selectedNodeIds,
        selectedNode,
        isEditableTarget,
        focusCanvasForShortcuts
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeSelection', api);
    global.SmartCanvasNodeSelection = api;
})(window);
