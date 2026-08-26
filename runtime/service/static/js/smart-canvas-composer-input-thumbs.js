/**
 * Smart Canvas — composer input thumb drag/reorder.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasComposerInputThumbs] deps not registered');
        return c;
    }

function inputThumbOrderKey(img){
    if(!img?.url) return '';
    return S().inputRefKey?.(img) || `url|${img.url}`;
}

function orderedInputThumbItems(node, items){
    const list = Array.isArray(items) ? items.slice() : [];
    const order = Array.isArray(node?.inputThumbOrder) ? node.inputThumbOrder.filter(Boolean) : [];
    if(list.length < 2 || !order.length) return list;
    const rank = new Map(order.map((key, index) => [key, index]));
    return list
        .map((item, index) => ({item, index, rank:rank.has(inputThumbOrderKey(item)) ? rank.get(inputThumbOrderKey(item)) : order.length + index}))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(entry => entry.item);
}

function bindInputThumbsDrag(node, items){
    if(!S().inputThumbsRow) return;
    const thumbs = [...S().inputThumbsRow.querySelectorAll('.input-thumb:not(.input-thumb-upload)')];
    const canReorder = Boolean(node && thumbs.length > 1);
    const clearTargets = () => thumbs.forEach(el => {
        delete el.dataset.dropPlacement;
        el.classList.remove('drop-before', 'drop-after', 'drop-target');
    });
    const thumbAtPoint = event => document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.input-thumb');
    thumbs.forEach(el => {
        el.draggable = false;
        el.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
        });
        if(!canReorder) return;
        el.addEventListener('dragstart', event => event.preventDefault());
        el.addEventListener('pointerdown', event => {
            if(event.button !== 0) return;
            const index = Number(el.dataset.thumbIndex);
            if(!Number.isInteger(index)) return;
            event.preventDefault();
            event.stopPropagation();
            clearTargets();
            const originRect = el.getBoundingClientRect();
            const state = {
                from:index,
                startX:event.clientX,
                startY:event.clientY,
                grabX:event.clientX - originRect.left,
                grabY:event.clientY - originRect.top,
                width:originRect.width,
                height:originRect.height,
                active:false,
                pointerId:event.pointerId,
                ghost:null
            };
            const positionGhost = pointerEvent => {
                if(!state.ghost) return;
                state.ghost.style.left = `${pointerEvent.clientX - state.grabX}px`;
                state.ghost.style.top = `${pointerEvent.clientY - state.grabY}px`;
            };
            const createGhost = pointerEvent => {
                const ghost = el.cloneNode(true);
                ghost.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
                ghost.classList.add('input-thumb-drag-ghost');
                ghost.removeAttribute('data-reorderable');
                ghost.style.width = `${state.width}px`;
                ghost.style.height = `${state.height}px`;
                state.ghost = ghost;
                positionGhost(pointerEvent);
                document.body.appendChild(ghost);
                document.body.classList.add('input-thumb-pointer-dragging');
                global.requestAnimationFrame(() => ghost.classList.add('is-lifted'));
            };
            const releaseGhost = target => {
                document.body.classList.remove('input-thumb-pointer-dragging');
                const ghost = state.ghost;
                if(!ghost) return;
                if(target){
                    const rect = target.getBoundingClientRect();
                    ghost.classList.remove('is-lifted');
                    ghost.classList.add('is-dropping');
                    ghost.style.left = `${rect.left}px`;
                    ghost.style.top = `${rect.top}px`;
                } else {
                    ghost.classList.remove('is-lifted');
                    ghost.classList.add('is-cancelled');
                }
                global.setTimeout(() => ghost.remove(), 150);
            };
            const move = moveEvent => {
                if(moveEvent.pointerId !== state.pointerId) return;
                if(!state.active && Math.hypot(moveEvent.clientX - state.startX, moveEvent.clientY - state.startY) >= 4){
                    state.active = true;
                    el.classList.add('dragging');
                    createGhost(moveEvent);
                }
                if(!state.active) return;
                moveEvent.preventDefault();
                positionGhost(moveEvent);
                clearTargets();
                const target = thumbAtPoint(moveEvent);
                if(target && target !== el && S().inputThumbsRow.contains(target)) target.classList.add('drop-target');
            };
            const finish = finishEvent => {
                if(finishEvent.pointerId !== state.pointerId) return;
                global.removeEventListener('pointermove', move, true);
                global.removeEventListener('pointerup', finish, true);
                global.removeEventListener('pointercancel', finish, true);
                const target = state.active ? thumbAtPoint(finishEvent) : null;
                const to = Number(target?.dataset?.thumbIndex);
                const validTarget = Boolean(target && target !== el && Number.isInteger(to) && S().inputThumbsRow.contains(target));
                releaseGhost(validTarget ? target : null);
                clearInputThumbDropMarkers();
                if(validTarget){
                    reorderInputThumb(node, items, state.from, to);
                }
            };
            global.addEventListener('pointermove', move, true);
            global.addEventListener('pointerup', finish, true);
            global.addEventListener('pointercancel', finish, true);
        });
    });
}

function reorderInputThumb(currentNode, items, from, to){
    if(!currentNode || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return false;
    const next = items.slice();
    [next[from], next[to]] = [next[to], next[from]];
    const persistent = Array.isArray(S().nodes) && S().nodes.includes(currentNode);
    if(persistent) S().pushUndo();
    currentNode.inputThumbOrder = next.map(inputThumbOrderKey).filter(Boolean);
    S().renderInputThumbsRow?.(currentNode);
    if(persistent) S().scheduleSave();
    return true;
}

    function addManualReferenceToSelectedNode(img, targetNode=null){
 const node = targetNode || S().activeComposerNode?.() || S().selectedNode();
 if(!node || !img?.url) return false;
 const kind = img.kind || S().mediaKindForItem(img);
 const ref = {
 url:img.url,
 name:img.alias || img.name || (kind === 'audio' ? '音频' : kind === 'video' ? '视频' : '图片'),
 kind,
 nodeId:img.nodeId || '',
 imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : '',
 asset_uris:img.asset_uris || {},
 manualAdded:true
 };
 if(img.originalLocalUrl) ref.originalLocalUrl = img.originalLocalUrl;
 const refs = Array.isArray(node.manualInputRefs) ? node.manualInputRefs.slice() : [];
 const key = S().inputRefKey(ref);
 const exists = refs.some(item => S().inputRefKey(item) === key || item.url === ref.url);
 if(exists){
 S().closeMentionPicker();
 return true;
 }
 S().pushUndo();
 refs.push(ref);
 node.manualInputRefs = refs;
 S().closeMentionPicker();
 S().renderInputThumbsRow(node);
 S().scheduleSave();
 return true;
}
    function removeManualReferenceFromSelectedNode(key){
 const node = S().selectedNode();
 if(!node || !key || !Array.isArray(node.manualInputRefs)) return;
 const refs = node.manualInputRefs.slice();
 const index = refs.findIndex(ref => S().inputRefKey(ref) === key || ref?.url === key.replace(/^url\|/, ''));
 if(index < 0) return;
 S().pushUndo();
 refs.splice(index, 1);
 node.manualInputRefs = refs;
 if(!refs.length) delete node.manualInputRefs;
 S().renderInputThumbsRow(node);
 S().scheduleSave();
}
    function bindInputThumbReferenceActions(){
 S().inputThumbsRow?.querySelectorAll('[data-input-upload-media]').forEach(btn => {
 btn.addEventListener('click', event => {
 event.preventDefault();
 event.stopPropagation();
 openInputMediaUpload();
 });
 });
 S().inputThumbsRow?.querySelectorAll('[data-input-add-reference]').forEach(btn => {
 btn.addEventListener('click', event => {
 event.preventDefault();
 event.stopPropagation();
 S().toggleAssetMentionPickerFromThumbs();
 });
 });
 S().inputThumbsRow?.querySelectorAll('[data-input-remove-reference]').forEach(btn => {
 btn.addEventListener('click', event => {
 event.preventDefault();
 event.stopPropagation();
 removeManualReferenceFromSelectedNode(btn.dataset.inputRemoveReference || '');
 });
 });
}

    function openInputMediaUpload(){
 const target = S().selectedNode();
 if(!target) return;
 const targetId = target.id;
 const picker = document.createElement('input');
 picker.type = 'file';
 picker.accept = 'image/*,video/*,audio/*';
 picker.multiple = true;
 picker.tabIndex = -1;
 picker.style.position = 'fixed';
 picker.style.left = '-9999px';
 picker.addEventListener('change', async () => {
 const files = [...(picker.files || [])].filter(file => S().isSupportedUploadFile?.(file));
 picker.remove();
 if(!files.length) return;
 const targetNode = S().nodes.find(node => node.id === targetId);
 if(!targetNode) return;
 try {
 const uploaded = await S().uploadFiles(files);
 if(!uploaded?.length) return;
 S().pushUndo();
 const targetRect = S().nodeRect(targetNode);
 const images = uploaded.map((file, index) => ({
 ...file,
 kind:file.kind || S().mediaKindForItem(file) || S().mediaKindForFile?.(files[index])
 }));
 const provisionalPoint = {x:targetRect.x - 180, y:targetRect.y + targetRect.height / 2};
 const sourceNode = S().createImageNodeAt(provisionalPoint, images, {select:false, skipUndo:true});
 if(!sourceNode) return;
 const sourceRect = S().nodeRect(sourceNode);
 sourceNode.x = targetRect.x - sourceRect.width - 120;
 sourceNode.y = targetRect.y + (targetRect.height - sourceRect.height) / 2;
 S().connectInputNode(sourceNode.id, targetNode.id);
 S().selectedId = targetNode.id;
 S().selectedIds = [];
 S().selectedImage = {nodeId:'', index:-1};
 S().render();
 S().updateComposer?.();
 S().scheduleSave();
 } catch(error) {
 S().toast?.(error?.message || '上传失败');
 }
 }, {once:true});
 document.body.appendChild(picker);
 picker.click();
 global.setTimeout(() => {
 if(!picker.isConnected) return;
 if(!picker.files?.length) picker.remove();
 }, 60000);
}
    function clearInputThumbDropMarkers(){
 S().inputThumbsRow?.querySelectorAll('.input-thumb.drop-before,.input-thumb.drop-after,.input-thumb.drop-target,.input-thumb.dragging')
 .forEach(el => {
 delete el.dataset.dropPlacement;
 el.classList.remove('drop-before', 'drop-after', 'drop-target', 'dragging');
 });
}
    function inputThumbDropPlacement(el, event){
 const rect = el.getBoundingClientRect();
 return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}
    const api = Object.freeze({
        inputThumbOrderKey,
        orderedInputThumbItems,
        inputThumbDropPlacement,
        clearInputThumbDropMarkers,
        bindInputThumbReferenceActions,
        removeManualReferenceFromSelectedNode,
        addManualReferenceToSelectedNode,
        openInputMediaUpload,
        registerDeps,
        bindInputThumbsDrag,
        reorderInputThumb
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('composerInputThumbs', api);
    global.SmartCanvasComposerInputThumbs = api;
})(window);
