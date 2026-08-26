/**
 * Smart Canvas — selection capsule batch delete (keyboard + capsule button).
 * Do not edit smart-canvas.js / ui-chrome for delete behavior; change this file instead.
 */
(function(global){
    'use strict';

    const shared = () => global.SmartCanvasSelectionCapsuleShared;
    const selection = () => global.SmartCanvasSelectionCapsuleSelection;

    function expandDeleteIds(ids){
        const api = shared()?.d?.();
        const out = [];
        const seen = new Set();
        (ids || []).forEach(id => {
            const node = api?.nodes?.find(n => n.id === id);
            if(api?.isSmartGroupNode?.(node)){
                [node.id, ...(api.smartGroupMembers?.(node) || []).map(member => member.id)].forEach(memberId => {
                    if(!memberId || seen.has(memberId)) return;
                    seen.add(memberId);
                    out.push(memberId);
                });
                return;
            }
            if(!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function resolveTargetsFromContext(ctx){
        return selection()?.resolveDeleteTargetIds?.(ctx?.selectedIds, ctx?.selectedId) || [];
    }

    function deleteNodesBatch(rawIds){
        const api = shared()?.d?.();
        if(!api) return false;
        const ids = (rawIds || []).filter(Boolean);
        if(!ids.length) return false;
        const deleteIds = new Set();
        ids.forEach(id => {
            deleteIds.add(id);
            api.nodes?.forEach?.(node => {
                if(api.isHistoryGroupNode?.(node) && node.historyFor === id) deleteIds.add(node.id);
            });
        });
        if(!deleteIds.size) return false;
        api.nodes = (api.nodes || []).filter(node => !deleteIds.has(node.id));
        if(api.canvas) api.canvas.connections = (api.canvas.connections || []).filter(c => !deleteIds.has(c.from) && !deleteIds.has(c.to));
        api.nodes.forEach(node => {
            if(Array.isArray(node.inputNodeIds)) node.inputNodeIds = node.inputNodeIds.filter(inputId => !deleteIds.has(inputId));
        });
        if(deleteIds.has(api.selectedId)) api.selectedId = '';
        if(Array.isArray(api.selectedIds)) api.selectedIds = api.selectedIds.filter(selected => !deleteIds.has(selected));
        const selectedImage = api.selectedImage;
        if(selectedImage && deleteIds.has(selectedImage.nodeId)) api.selectedImage = {nodeId:'', index:-1};
        return true;
    }

    function handleDeleteAction(presetIds){
        const api = shared()?.d?.();
        if(!api) return false;
        const source = Array.isArray(presetIds) && presetIds.length
            ? presetIds.slice()
            : (selection()?.takeDeleteTargetIds?.() || []);
        const ids = expandDeleteIds(source);
        if(!ids.length) return false;
        api.pushUndo?.();
        api.undoSuppressed = true;
        try {
            deleteNodesBatch(ids);
        } finally {
            api.undoSuppressed = false;
        }
        selection()?.clearMultiSelectSnapshot?.();
        api.render?.();
        api.scheduleSave?.();
        api.hideSelectionGroupBox?.();
        return true;
    }

    function handleCapsuleDelete(){
        const api = shared()?.d?.();
        return handleDeleteAction(selection()?.resolveDeleteTargetIds?.(api?.selectedIds, api?.selectedId));
    }

    function blockNodeDeleteHotkey(e, ctx){
        if(!ctx?.isEditableTarget?.(e.target)) return false;
        if(e.key === 'Backspace') return true;
        const sel = global.getSelection?.();
        if(sel && !sel.isCollapsed && String(sel).trim()) return true;
        const promptEl = e.target?.closest?.('.prompt-input');
        if(promptEl){
            const text = (promptEl.textContent || '').replace(/\u200B/g, '').trim();
            if(text) return true;
        }
        if(e.target?.matches?.('input, textarea, select')) return true;
        return false;
    }

    function isDeleteHotkey(e, ctx){
        if(e.key !== 'Delete' && e.key !== 'Backspace') return false;
        return Boolean(
            ctx?.selectedId ||
            ctx?.selectedIds?.length ||
            selection()?.hasDeleteTargets?.()
        );
    }

    function handleHotkey(e, ctx){
        if(global.SmartCanvasConnectionSelection?.hasSelection?.()) return false;
        if(!isDeleteHotkey(e, ctx)) return false;
        if(blockNodeDeleteHotkey(e, ctx)) return false;
        e.preventDefault();
        handleDeleteAction(resolveTargetsFromContext(ctx));
        return true;
    }

    const api = Object.freeze({
        expandDeleteIds,
        deleteNodesBatch,
        handleDeleteAction,
        handleCapsuleDelete,
        handleHotkey,
        isDeleteHotkey
    });

    global.SmartCanvasCore?.register?.('selectionCapsuleDelete', api);
    global.SmartCanvasSelectionCapsuleDelete = api;
})(window);
