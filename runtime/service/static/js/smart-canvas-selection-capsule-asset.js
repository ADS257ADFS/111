(function(global){
    'use strict';
    const shared = () => global.SmartCanvasSelectionCapsuleShared;
    function closeAssetMenu(){}
    async function openAssetLibrary(){
        const api = shared()?.d?.();
        if(!api) return;
        window.SmartCanvasAssetOpenGuard?.arm?.();
        api.toggleAssetLibrary?.(true);
        await api.loadAssetLibrary?.();
        api.positionSelectionGroupBox?.();
        api.refreshIcons?.();
    }
    function syncAssetButton(){
        const assetBtn = document.getElementById('selectionCapsuleAssetBtn');
        if(!assetBtn) return;
        assetBtn.disabled = false;
        assetBtn.classList.remove('is-muted');
    }
    function bindAssetMenuDismiss(){}
    const api = Object.freeze({ closeAssetMenu, openAssetLibrary, syncAssetButton, bindAssetMenuDismiss });
    global.SmartCanvasCore?.register?.('selectionCapsuleAsset', api);
    global.SmartCanvasSelectionCapsuleAsset = api;
})(window);
