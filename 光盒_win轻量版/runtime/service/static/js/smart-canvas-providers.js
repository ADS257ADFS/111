/**
 * Smart Canvas — API provider loading (isolated from composer/canvas/history).
 * Do not mutate provider list from other modules; use load() / ensureLoaded() only.
 */
(function(global){
    'use strict';

    let providers = [];
    let modeBindings = null;
    let configSnapshot = {};
    let loadedAt = 0;
    let loadPromise = null;

    const IMAGE_EXCLUDED_IDS = new Set(['modelscope', 'volcengine']);

    async function fetchJson(url){
        const res = await fetch(url, {
            cache: 'no-store',
            headers: {'Cache-Control': 'no-cache'}
        });
        if(!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
        return res.json();
    }

    async function load(force=false){
        if(!force && providers.length && Date.now() - loadedAt < 5000) return providers;
        if(loadPromise && !force) return loadPromise;
        const run = async () => {
            let lastError = null;
            for(let attempt = 0; attempt < 3; attempt++){
                try {
                    const cfg = await fetchJson('/api/config');
                    configSnapshot = cfg || {};
                    modeBindings = cfg?.mode_bindings || null;
                    if(global.SmartCanvasModeBindings){
                        SmartCanvasModeBindings.setBindings(modeBindings);
                        SmartCanvasModeBindings.setProviders(Array.isArray(cfg?.api_providers) ? cfg.api_providers : []);
                    }
                    const list = Array.isArray(cfg?.api_providers) ? cfg.api_providers : [];
                    if(list.length){
                        providers = list;
                        if(global.SmartCanvasModeBindings){
                            SmartCanvasModeBindings.setProviders(list);
                            SmartCanvasModeBindings.setBindings(cfg?.mode_bindings || null);
                        }
                        loadedAt = Date.now();
                        return providers;
                    }
                    lastError = new Error('api_providers empty');
                } catch(err){
                    lastError = err;
                }
                await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
            }
            if(lastError) console.warn('[SmartCanvasProviders] load failed:', lastError);
            return providers;
        };
        loadPromise = run().finally(() => { loadPromise = null; });
        return loadPromise;
    }

    async function ensureLoaded(){
        if(providers.length) return providers;
        return load(true);
    }

    function getProviders(){
        return providers;
    }

    function setProviders(list){
        providers = Array.isArray(list) ? list : [];
        loadedAt = Date.now();
    }

    function imageProviders(){
        return providers.filter(p =>
            p.enabled !== false &&
            !IMAGE_EXCLUDED_IDS.has(p.id) &&
            (p.image_models || []).length
        );
    }

    function videoProviders(){
        const fromConfig = providers.filter(p => p.enabled !== false && (p.video_models || []).length);
        if(fromConfig.length) return fromConfig;
        return [{id:'comfly', name:'Comfly', video_models:['veo3-fast'], enabled:true}];
    }

    function providerById(id){
        return providers.find(p => p.id === id) || null;
    }

    function imageModelsFor(providerId){
        return providerById(providerId)?.image_models || [];
    }

    function videoModelsFor(providerId){
        const provider = videoProviders().find(p => p.id === providerId);
        return [...new Set(provider?.video_models || [])];
    }

    function getConfigSnapshot(){
        return configSnapshot;
    }

    function getModeBindings(){
        return modeBindings;
    }

    global.SmartCanvasProviders = {
        load,
        ensureLoaded,
        getProviders,
        setProviders,
        getConfigSnapshot,
        getModeBindings,
        imageProviders,
        videoProviders,
        providerById,
        imageModelsFor,
        videoModelsFor,
        get loadedAt(){ return loadedAt; }
    };
})(window);
