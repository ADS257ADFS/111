/**
 * Smart Canvas — selection capsule multi-select snapshot & delete-target resolution.
 * Do not edit smart-canvas.js for delete-target logic; change this file instead.
 */
(function(global){
    'use strict';

    const shared = () => global.SmartCanvasSelectionCapsuleShared;

    let multiSelectSnapshot = [];

    function readSelectionIds(){
        return shared()?.readSelectionIds?.() || [];
    }

    function refreshMultiSelectSnapshot(ids){
        const list = (ids || readSelectionIds()).filter(Boolean);
        if(list.length > 1) multiSelectSnapshot = list.slice();
    }

    function clearMultiSelectSnapshot(){
        multiSelectSnapshot = [];
    }

    function onMarqueeFinished(selectedIds){
        if(Array.isArray(selectedIds) && selectedIds.length > 1) refreshMultiSelectSnapshot(selectedIds);
    }

    function getDeleteTargetIds(){
        const current = readSelectionIds();
        if(current.length > 1){
            multiSelectSnapshot = current.slice();
            return current.slice();
        }
        if(multiSelectSnapshot.length > 1){
            if(!current.length || (current.length === 1 && multiSelectSnapshot.includes(current[0]))){
                return multiSelectSnapshot.slice();
            }
            if(current.length === 1 && !multiSelectSnapshot.includes(current[0])){
                multiSelectSnapshot = [];
            }
        }
        if(current.length === 1) return current.slice();
        return multiSelectSnapshot.length > 1 ? multiSelectSnapshot.slice() : [];
    }

    function resolveDeleteTargetIds(selectedIds, selectedId){
        const multi = Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : [];
        if(multi.length > 1){
            refreshMultiSelectSnapshot(multi);
            return multi.slice();
        }
        const resolved = getDeleteTargetIds();
        if(resolved.length) return resolved;
        const single = String(selectedId || '').trim();
        return single ? [single] : [];
    }

    function takeDeleteTargetIds(){
        const ids = getDeleteTargetIds();
        multiSelectSnapshot = [];
        return ids;
    }

    function hasDeleteTargets(){
        return getDeleteTargetIds().length > 0;
    }

    const api = Object.freeze({
        refreshMultiSelectSnapshot,
        clearMultiSelectSnapshot,
        onMarqueeFinished,
        getDeleteTargetIds,
        resolveDeleteTargetIds,
        takeDeleteTargetIds,
        hasDeleteTargets
    });

    global.SmartCanvasCore?.register?.('selectionCapsuleSelection', api);
    global.SmartCanvasSelectionCapsuleSelection = api;
})(window);
