/**
 * Smart Canvas — selection capsule: 打组 / 解组
 * @see SmartCanvasSelectionCapsule (shell)
 */
(function(global){
    'use strict';

    const shared = () => global.SmartCanvasSelectionCapsuleShared;

    function groupMode(){
        const api = shared()?.d?.();
        const nodes = shared()?.getSelectedNodes?.() || [];
        if(nodes.length === 1){
            if(api?.isSmartGroupNode?.(nodes[0])) return 'ungroup';
            const imageCount = (nodes[0].images || []).filter(img => shared()?.mediaUrl?.(img)).length;
            if(imageCount >= 2) return 'ungroup';
        }
        if(nodes.some(node => api?.isSmartGroupNode?.(node))) return 'none';
        return nodes.length >= 2 ? 'group' : 'none';
    }

    function handleGroupAction(resync){
        const api = shared()?.d?.();
        if(!api) return;
        const mode = groupMode();
        if(mode === 'group'){
            api.groupSelectedNodes?.();
            api.render?.();
            api.positionSelectionGroupBox?.();
            resync?.();
            return;
        }
        if(mode === 'ungroup'){
            const id = shared()?.getSelectedIds?.()?.[0];
            if(id && api.ungroupNode?.(id)){
                api.render?.();
                api.positionSelectionGroupBox?.();
                resync?.();
            }
            return;
        }
        api.toast?.('请至少选择两个节点再打组');
    }

    function syncGroupButton(){
        const api = shared()?.d?.();
        if(!api) return;
        const mode = groupMode();
        const groupBtn = document.getElementById('selectionCapsuleGroupBtn');
        if(!groupBtn) return;
        const label = groupBtn.querySelector('span');
        const icon = groupBtn.querySelector('[data-lucide]');
        if(mode === 'ungroup'){
            if(label) label.textContent = '解组';
            if(icon) icon.setAttribute('data-lucide', 'ungroup');
        } else {
            if(label) label.textContent = '打组';
            if(icon) icon.setAttribute('data-lucide', 'group');
        }
        groupBtn.disabled = mode === 'none';
        groupBtn.classList.toggle('is-muted', mode === 'none');
    }

    const api = Object.freeze({
        groupMode,
        handleGroupAction,
        syncGroupButton
    });

    global.SmartCanvasCore?.register?.('selectionCapsuleGroup', api);
    global.SmartCanvasSelectionCapsuleGroup = api;
})(window);
