(function(global){
    'use strict';
    const shared = () => global.SmartCanvasSelectionCapsuleShared;
    async function handleDownloadAction(){
        const api = shared()?.d?.();
        const items = shared()?.collectMediaItems?.() || [];
        if(!api || !items.length){ api?.toast?.('没有可下载的内容'); return; }
        await api.zipDownloadImageItems?.('canvas-selection', items);
    }
    function syncDownloadButton(){
        const mediaCount = (shared()?.collectMediaItems?.() || []).length;
        const downloadBtn = document.getElementById('selectionCapsuleDownloadBtn');
        if(!downloadBtn) return;
        downloadBtn.disabled = false;
        downloadBtn.classList.toggle('is-muted', mediaCount <= 0);
    }
    const api = Object.freeze({ handleDownloadAction, syncDownloadButton });
    global.SmartCanvasCore?.register?.('selectionCapsuleDownload', api);
    global.SmartCanvasSelectionCapsuleDownload = api;
})(window);
