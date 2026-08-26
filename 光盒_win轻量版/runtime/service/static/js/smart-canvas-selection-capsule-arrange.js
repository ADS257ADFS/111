/**
 * Smart Canvas — selection capsule: graph-aware arrangement.
 * @see SmartCanvasSelectionCapsule (shell)
 */
(function(global){
    'use strict';

    const shared = () => global.SmartCanvasSelectionCapsuleShared;

    function canArrange(){
        return (shared()?.getSelectedNodes?.() || []).length >= 2;
    }

    function handleArrangeAction(resync){
        const api = shared()?.d?.();
        if(!api) return;
        if(!canArrange()){
            api.toast?.('请至少选择两个节点再整理');
            return;
        }
        if(api.arrangeSelectedNodes?.()) resync?.();
    }

    function syncArrangeButton(){
        const button = document.getElementById('selectionCapsuleArrangeBtn');
        if(!button) return;
        button.classList.toggle('is-muted', !canArrange());
    }

    const api = Object.freeze({canArrange, handleArrangeAction, syncArrangeButton});
    global.SmartCanvasCore?.register?.('selectionCapsuleArrange', api);
    global.SmartCanvasSelectionCapsuleArrange = api;
})(window);
