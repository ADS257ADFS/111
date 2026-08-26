/* Force the canvas tab active before shell scripts hydrate. */
(function(){
    try {
        var pageId = localStorage.getItem('studio_active_page') || 'canvas';
        if(pageId && pageId !== 'zimage') {
            document.querySelectorAll('.nav-item.active, .side-pill.active, .tool-button.active').forEach(function(n){
                n.classList.remove('active');
            });
            var target = document.querySelector('.floating-toolbar [onclick*="\'' + pageId + '\'"]') || document.querySelector('[onclick*="\'' + pageId + '\'"]');
            if(target) target.classList.add('active');
        }
    } catch(e) {}
})();

/* Bridge wheel input that lands on the outer shell into the canvas iframe. */
(function(){
    var excluded = '.floating-toolbar,.sidebar,.gpt-dock,.dock-resizer,.dock-open-btn,.top-user-btn,.shell-settings-modal,.shell-project-history-modal,.shell-user-menu,.shell-asset-backdrop,input,textarea,select,[contenteditable="true"]';
    window.addEventListener('wheel', function(event){
        var target = event.target instanceof Element ? event.target : null;
        if(target && target.closest(excluded)) return;
        var frame = window.getActiveCanvasFrame?.()
            || document.querySelector('#frame-canvas.active')
            || document.getElementById('frame-canvas');
        if(!frame || !frame.classList.contains('active') || !frame.contentWindow) return;
        if(event.cancelable) event.preventDefault();
        var rect = frame.getBoundingClientRect();
        var payload = {
            type: 'lightbox-canvas-wheel',
            clientX: event.clientX - rect.left,
            clientY: event.clientY - rect.top,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode
        };
        var controller = frame.contentWindow.SmartCanvasUiCanvas;
        if(controller && typeof controller.acceptWheelInput === 'function') controller.acceptWheelInput(payload);
        else frame.contentWindow.postMessage(payload, window.location.origin);
    }, {passive:false, capture:true});
})();
