(function(global){
    'use strict';

    function icon(kind){
        if(kind === 'cancel') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"></path><path d="M18 6 6 18"></path></svg>';
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="12" height="14" rx="2"></rect><path d="m15 10 6-3v10l-6-3z"></path></svg>';
    }

    function downloadResult(result){
        const url = global.URL?.createObjectURL?.(result.blob);
        if(!url) throw new Error('Cannot create an animation download URL');
        const anchor = global.document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        global.setTimeout?.(() => global.URL.revokeObjectURL?.(url), 1000);
    }

    function createAnimationExportUI({root, exporter, settings} = {}){
        if(!root || !exporter?.exportWebM || !settings?.read || !settings?.update){
            throw new Error('Director3DAnimationExportUI requires a root, exporter, and settings store');
        }

        let controller = null;
        let panel = null;
        let settingsPanel = null;

        function removePanel(){
            panel?.remove?.();
            panel = null;
        }

        function removeSettings(){
            settingsPanel?.remove?.();
            settingsPanel = null;
        }

        function open(){
            if(controller || settingsPanel) return;
            const current = settings.read();
            settingsPanel = global.document.createElement('section');
            settingsPanel.className = 'director3d-animation-export-settings';
            settingsPanel.innerHTML = `
                <div class="director3d-animation-export-settings-card" role="dialog" aria-modal="true" aria-label="动画导出设置">
                    <div class="director3d-animation-export-settings-heading"><strong>动画导出</strong><button type="button" data-director3d-close-animation-settings title="关闭" aria-label="关闭">${icon('cancel')}</button></div>
                    <label>高度<select data-director3d-export-height><option value="540" ${current.height === 540 ? 'selected' : ''}>540 px</option><option value="720" ${current.height === 720 ? 'selected' : ''}>720 px</option><option value="1080" ${current.height === 1080 ? 'selected' : ''}>1080 px</option></select></label>
                    <label>帧率<select data-director3d-export-frame-rate><option value="12" ${current.frameRate === 12 ? 'selected' : ''}>12 FPS</option><option value="24" ${current.frameRate === 24 ? 'selected' : ''}>24 FPS</option><option value="30" ${current.frameRate === 30 ? 'selected' : ''}>30 FPS</option></select></label>
                    <button type="button" class="director3d-animation-export-start" data-director3d-start-animation>开始渲染</button>
                </div>
            `;
            root.appendChild(settingsPanel);
            settingsPanel.querySelector('[data-director3d-close-animation-settings]')?.addEventListener('click', removeSettings);
            settingsPanel.querySelector('[data-director3d-start-animation]')?.addEventListener('click', () => {
                const height = settingsPanel.querySelector('[data-director3d-export-height]')?.value;
                const frameRate = settingsPanel.querySelector('[data-director3d-export-frame-rate]')?.value;
                const next = settings.update({height, frameRate});
                removeSettings();
                start(next).catch(error => console.warn('Director3D animation export failed', error));
            });
        }

        function render(state){
            removePanel();
            panel = global.document.createElement('section');
            panel.className = 'director3d-animation-export-progress';
            panel.setAttribute('aria-live', 'polite');
            panel.dataset.director3dAnimationExportState = state?.status || (state?.active ? 'rendering' : 'idle');
            const total = Math.max(1, Number(state?.total || 1));
            const index = Math.max(0, Number(state?.index || 0));
            const percent = Math.round((index / total) * 100);
            panel.innerHTML = `
                <span>${state?.label || '渲染动画'} ${percent}%</span>
                ${state?.active ? `<button type="button" data-director3d-cancel-animation title="取消渲染" aria-label="取消渲染">${icon('cancel')}</button>` : ''}
            `;
            root.appendChild(panel);
            panel.querySelector('[data-director3d-cancel-animation]')?.addEventListener('click', () => controller?.abort());
        }

        async function start(options = settings.read()){
            if(controller) return;
            controller = new AbortController();
            render({active:true, status:'rendering', label:'渲染动画', index:0, total:1});
            try {
                const result = await exporter.exportWebM({
                    height:options.height,
                    frameRate:options.frameRate,
                    signal:controller.signal,
                    onProgress:progress => render({active:true, status:'rendering', label:'渲染动画', ...progress})
                });
                render({active:false, status:'complete', label:'动画完成', index:1, total:1});
                downloadResult(result);
                global.setTimeout?.(removePanel, 1400);
                return result;
            } catch(error) {
                if(error?.name === 'AbortError') render({active:false, status:'cancelled', label:'已取消', index:0, total:1});
                else render({active:false, status:'failed', label:'渲染失败', index:0, total:1});
                global.setTimeout?.(removePanel, 1600);
                if(error?.name !== 'AbortError') throw error;
                return null;
            } finally {
                controller = null;
            }
        }

        return Object.freeze({open, start, dispose(){ removeSettings(); removePanel(); }});
    }

    global.Director3DAnimationExportUI = Object.freeze({createAnimationExportUI});
})(window);
