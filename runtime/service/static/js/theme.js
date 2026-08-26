(function(){
    const KEY = 'studio_theme';
    const LEGACY_KEY = 'canvas_theme';
    const THEMES = ['light', 'dark'];
    const CYCLE_ORDER = ['light', 'dark'];

    function normalizeTheme(theme){
        return THEMES.includes(theme) ? theme : 'light';
    }

    function currentTheme(){
        return normalizeTheme(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || 'light');
    }

    function themeTargets(){
        return [document.documentElement, document.body].filter(Boolean);
    }

    function applyTheme(theme){
        const next = normalizeTheme(theme);
        const dark = next === 'dark';
        themeTargets().forEach(node => {
            node.classList.toggle('studio-theme-dark', dark);
            node.classList.toggle('theme-dark', dark);
        });
        window.dispatchEvent(new CustomEvent('studio-theme-change', { detail: { theme: next } }));
    }

    function syncThemePeers(theme, sourceWindow){
        const next = normalizeTheme(theme);
        try {
            if(window.parent && window.parent !== window && window.parent !== sourceWindow){
                window.parent.postMessage({ type: 'studio-theme', theme: next }, '*');
            }
        } catch(e) {}
        document.querySelectorAll('iframe').forEach(frame => {
            try {
                if(frame.contentWindow && frame.contentWindow !== sourceWindow){
                    frame.contentWindow.postMessage({ type: 'studio-theme', theme: next }, '*');
                }
            } catch(e) {}
        });
    }

    let themeSyncLock = false;

    window.StudioTheme = {
        key: KEY,
        themes: THEMES,
        get: currentTheme,
        apply: applyTheme,
        normalize: normalizeTheme,
        set(theme){
            const next = normalizeTheme(theme);
            localStorage.setItem(KEY, next);
            localStorage.setItem(LEGACY_KEY, next);
            applyTheme(next);
            return next;
        },
        cycle(){
            const current = currentTheme();
            const idx = CYCLE_ORDER.indexOf(current);
            const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
            return this.set(next);
        },
        toggle(sourceWindow){
            if(themeSyncLock) return currentTheme();
            themeSyncLock = true;
            try {
                const next = this.cycle();
                syncThemePeers(next, sourceWindow || null);
                return next;
            } finally {
                themeSyncLock = false;
            }
        }
    };

    applyTheme(currentTheme());

    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(currentTheme());
    });
    window.addEventListener('message', event => {
        if(event.data?.type !== 'studio-theme') return;
        const incoming = normalizeTheme(event.data.theme);
        if(themeSyncLock) return;
        themeSyncLock = true;
        try {
            if(currentTheme() !== incoming) window.StudioTheme.set(incoming);
            else applyTheme(incoming);
        } finally {
            themeSyncLock = false;
        }
    });
    window.addEventListener('storage', event => {
        if(event.key === KEY || event.key === LEGACY_KEY) applyTheme(currentTheme());
    });

    const nativeFetch = window.fetch.bind(window);
    const generationRequests = new Map();
    const generationTaskIds = new Set();
    let generationSequence = 0;

    function isGenerationRequest(input, init={}){
        const url = String(typeof input === 'string' ? input : input?.url || '');
        const method = String(init.method || 'GET').toUpperCase();
        if(method === 'GET' && /\/api\/canvas-image-tasks\/[^/?]+(?:\?|$)/.test(url)) return false;
        if(/\/api\/(canvas-image-tasks|canvas-video|online-image|angle\/generate|angle\/poll_status|generate)|\/api\/workflows\/[^/?]+\/run(?:\?|$)|\/generate(?:\?|$)/.test(url)) return true;
        if(/\/api\/chat(?:\?|$)/.test(url)){
            try { return JSON.parse(init.body || '{}').mode === 'image'; } catch(e) { return false; }
        }
        return false;
    }
    function syncCancelButton(){
        const button = document.getElementById('studioGenerationCancel');
        if(button) button.hidden = generationRequests.size === 0 && generationTaskIds.size === 0;
    }
    async function registerGenerationTask(response, sourceUrl=''){
        try {
            const data = await response.clone().json();
            const ids = [data?.task_id, data?.data?.taskId, ...(data?.taskIds || []), ...((data?.result?.taskIds) || [])].filter(Boolean);
            const status = String(data?.status || data?.data?.status || '').toLowerCase();
            const createsAsyncTask = ['queued','pending','running','processing'].includes(status);
            if(createsAsyncTask) ids.forEach(id => generationTaskIds.add(String(id)));
            const finishedId = data?.id;
            if(finishedId && ['succeeded','failed','cancelled'].includes(String(data?.status || '').toLowerCase())) generationTaskIds.delete(String(finishedId));
            const queriedId = new URL(sourceUrl, location.href).searchParams.get('taskId');
            if(queriedId && !['queued','pending','running','processing'].includes(status)) generationTaskIds.delete(String(queriedId));
            syncCancelButton();
        } catch(e) {}
    }
    async function cancelAllGeneration(){
        generationRequests.forEach(item => item.controller.abort());
        const taskIds = [...generationTaskIds];
        generationTaskIds.clear();
        generationRequests.clear();
        syncCancelButton();
        await Promise.all(taskIds.map(run_id => nativeFetch('/api/generation/cancel', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({run_id})
        }).catch(() => null)));
        window.dispatchEvent(new CustomEvent('studio-generation-cancelled'));
    }
    window.fetch = async function(input, init={}){
        if(!isGenerationRequest(input, init)) return nativeFetch(input, init);
        const controller = new AbortController();
        const sourceUrl = String(typeof input === 'string' ? input : input?.url || '');
        const runId = `generation-${Date.now()}-${++generationSequence}-${Math.random().toString(36).slice(2, 9)}`;
        const headers = new Headers(init.headers || {});
        headers.set('X-Generation-Run-ID', runId);
        generationTaskIds.add(runId);
        generationRequests.set(runId, {controller});
        syncCancelButton();
        if(init.signal) init.signal.addEventListener('abort', () => controller.abort(), {once:true});
        try {
            const response = await nativeFetch(input, {...init, headers, signal:controller.signal});
            await registerGenerationTask(response, sourceUrl);
            return response;
        } finally {
            generationRequests.delete(runId);
            generationTaskIds.delete(runId);
            syncCancelButton();
        }
    };
    window.StudioGenerationCancel = {cancelAll:cancelAllGeneration, active:() => generationRequests.size};
    document.addEventListener('DOMContentLoaded', () => {
        if(document.getElementById('studioGenerationCancel')) return;
        const button = document.createElement('button');
        button.id = 'studioGenerationCancel';
        button.type = 'button';
        button.hidden = true;
        button.textContent = '取消生成';
        button.title = '停止当前图片或视频生成';
        button.onclick = cancelAllGeneration;
        button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;height:38px;padding:0 16px;border:1px solid rgba(255,59,48,.25);border-radius:999px;background:var(--ui-surface-elevated, #fff);color:var(--ui-danger, #d92d20);font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:var(--ui-shadow-pop, 0 10px 28px rgba(15,23,42,.14));cursor:pointer;';
        document.body.appendChild(button);
        syncCancelButton();
    });
})();
