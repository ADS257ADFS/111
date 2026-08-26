/**
 * Smart Canvas — per-mode recent run settings (localStorage).
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasSettingsRecent] deps not registered');
        return c;
    }

function loadRecentSmartSettings(){
    try {
        const data = JSON.parse(localStorage.getItem(S().RECENT_SMART_SETTINGS_KEY) || '{}');
        S().recentSmartSettingsByMode = data && typeof data === 'object' ? data : {};
    } catch(e) {
        S().recentSmartSettingsByMode = {};
    }
}

function saveRecentSmartSettings(){
    localStorage.setItem(S().RECENT_SMART_SETTINGS_KEY, JSON.stringify(S().recentSmartSettingsByMode));
}

function recentSmartSettingsForMode(modeKey=''){
    const key = modeKey || S().recentSmartSettingsByMode.__lastKey || S().smartSettingsModeKey(S().settings);
    const saved = S().recentSmartSettingsByMode[key];
    return saved && typeof saved === 'object' ? S().cloneSmartSettings(saved) : {};
}

function rememberRecentSmartSettings(source=S().settings, node=null){
    const clean = S().stripOutpaintDisplaySettings(S().settingsForStorage(source), node);
    S().sanitizeSmartApiSelection(clean);
    if(clean.outpaintResolutionLocked === true && clean.resolution === 'custom'){
        clean.resolution = '1k';
        clean.ratio = clean.ratio || 'square';
        clean.customWidth = '';
        clean.customHeight = '';
        clean.customSize = '';
    }
    delete clean.outpaintResolutionLocked;
    const key = S().smartSettingsModeKey(clean);
    S().recentSmartSettingsByMode[key] = S().settingsForStorage(clean);
    S().recentSmartSettingsByMode.__lastKey = key;
    saveRecentSmartSettings();
}

function applyRecentSmartSettingsForCurrentMode(){
    const requestedEngine = ['api','comfy'].includes(S().settings.engine) ? S().settings.engine : 'api';
    const requestedApiKind = S().settings.apiKind === 'video' ? 'video' : 'image';
    const key = S().smartSettingsModeKey(S().settings);
    const saved = recentSmartSettingsForMode(key);
    if(!Object.keys(saved).length){
        S().settings.engine = requestedEngine;
        if(S().isApiLikeEngine(requestedEngine)) S().settings.apiKind = requestedApiKind;
        S().sanitizeSmartApiSelection(S().settings);
        return;
    }
    S().settings = {...S().settings, ...saved, engine:requestedEngine};
    if(S().isApiLikeEngine(requestedEngine)) S().settings.apiKind = requestedApiKind;
    S().sanitizeSmartApiSelection(S().settings);
}

    const api = Object.freeze({
        registerDeps,
        loadRecentSmartSettings,
        saveRecentSmartSettings,
        recentSmartSettingsForMode,
        rememberRecentSmartSettings,
        applyRecentSmartSettingsForCurrentMode
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('settingsRecent', api);
    global.SmartCanvasSettingsRecent = api;
})(window);
