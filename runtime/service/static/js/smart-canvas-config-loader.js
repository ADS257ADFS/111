/**
 * Smart Canvas — API/Comfy config fetch and refresh from settings panel.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasConfigLoader] deps not registered');
        return c;
    }

function injectRunningHubProvider(publicSettings){
    const settings = publicSettings && typeof publicSettings === 'object' ? publicSettings : {};
    const others = (S().apiProviders || []).filter(provider => provider?.id !== 'runninghub');
    const apps = Array.isArray(settings.apps) ? settings.apps.filter(item => item?.enabled !== false) : [];
    const workflows = Array.isArray(settings.workflows) ? settings.workflows.filter(item => item?.enabled !== false) : [];
    if(!apps.length && !workflows.length){
        S().apiProviders = others;
        return;
    }
    S().apiProviders = [...others, {
        id:'runninghub',
        name:'RunningHub',
        protocol:'runninghub',
        enabled:true,
        has_key:Boolean(settings.has_key),
        rh_apps:apps,
        rh_workflows:workflows
    }];
}

async function loadConfig(){
    try {
        let cfg = {};
        const wfPromise = fetch('/api/workflows').then(r => r.ok ? r.json() : {workflows:[]}).catch(() => ({workflows:[]}));
        const runningHubPromise = fetch('/api/runninghub/settings', {cache:'no-store'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        const customModelsPromise = fetch('/api/custom-models', {cache:'no-store'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        let runningHubSettings = {};
        if(window.SmartCanvasProviders){
            const [, wf, runningHub] = await Promise.all([SmartCanvasProviders.load(true), wfPromise, runningHubPromise]);
            S().syncApiProvidersFromModule();
            cfg = SmartCanvasProviders.getConfigSnapshot() || {};
            S().comfyWorkflows = Array.isArray(wf.workflows) ? wf.workflows : [];
            runningHubSettings = runningHub;
        } else {
            const [res, wf, runningHub] = await Promise.all([
                fetch('/api/config', {cache:'no-store'}),
                wfPromise,
                runningHubPromise
            ]);
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            cfg = await res.json();
            S().apiProviders = Array.isArray(cfg.api_providers) ? cfg.api_providers : [];
            if(global.SmartCanvasModeBindings){
                SmartCanvasModeBindings.setBindings(cfg.mode_bindings || null);
                SmartCanvasModeBindings.setProviders(Array.isArray(cfg.api_providers) ? cfg.api_providers : []);
            }
            S().comfyWorkflows = Array.isArray(wf.workflows) ? wf.workflows : [];
            runningHubSettings = runningHub;
        }
        S().apiProviders = (S().apiProviders || []).filter(provider => String(provider?.id || '').toLowerCase() !== 'jimeng');
        injectRunningHubProvider(runningHubSettings);
        S().comfyInstanceCount = Math.max(1, (Array.isArray(cfg.comfy_instances) ? cfg.comfy_instances : []).filter(Boolean).length || 1);
        S().lastConfigRefreshAt = Date.now();
        S().sanitizeSmartApiSelection(S().settings);
        if(global.SmartCanvasModeBindings){
            const customModels = await customModelsPromise;
            SmartCanvasModeBindings.setCustomModels?.(customModels?.models || null);
            SmartCanvasModeBindings.applyAllBindings(S().settings, S().selectedNode());
        }
        S().updateProviderModels();
        const openNode = S().selectedNode();
        if(openNode && S().composer?.classList.contains('open')) S().renderComposerHeadParams();
    } catch(e) {
        console.warn('[loadConfig]', e);
        S().toast(S().tr('smart.toastApiSettingsFail'));
    }
}


async function refreshSmartConfigFromSettings(){
    await loadConfig();
    S().renderDynamicParams();
    const node = S().selectedNode();
    if(node?.type === 'smart-prompt') {
        S().applySettingsToNode?.(node);
        S().render();
    }
}


    const api = Object.freeze({
        registerDeps,
        injectRunningHubProvider,
        loadConfig,
        refreshSmartConfigFromSettings
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('configLoader', api);
    global.SmartCanvasConfigLoader = api;
})(window);
