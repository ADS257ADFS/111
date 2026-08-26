/**
 * Smart Canvas — settings clone/sanitize helpers for persistence.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasSettingsStorage] deps not registered');
        return c;
    }

function cloneSmartSettings(source=S().settings){
    try {
        return JSON.parse(JSON.stringify(source || {}));
    } catch(e) {
        return {...(source || {})};
    }
}

function settingsForStorage(source=S().settings){
    return cloneSmartSettings(source);
}

function isApiLikeEngine(engine){
    return ['api', 'volcengine'].includes(String(engine || '').toLowerCase());
}

function mediaItemForStorage(item){
    if(!item || typeof item !== 'object') return item;
    const clean = {...item};
    delete clean.cloudUrl;
    delete clean.uploadedUrl;
    delete clean.originalRemoteUrl;
    delete clean.tempCloudUrl;
    return clean;
}

function smartSettingsModeKey(source=S().settings){
    const engine = ['api','comfy'].includes(source?.engine) ? source.engine : 'api';
    if(engine === 'api') return `api:${source?.apiKind === 'video' ? 'video' : 'image'}`;
    if(engine === 'comfy') return `comfy:${['text','enhance','edit','custom'].includes(source?.comfyMode) ? source.comfyMode : 'text'}`;
    return 'api:image';
}

    const api = Object.freeze({
        registerDeps,
        cloneSmartSettings,
        settingsForStorage,
        isApiLikeEngine,
        mediaItemForStorage,
        smartSettingsModeKey
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('settingsStorage', api);
    global.SmartCanvasSettingsStorage = api;
})(window);
