/**
 * Smart Canvas — provider/model selection and API settings sanitization.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasProviderSelection] deps not registered');
        return c;
    }
    function apiProviders(){ return S().getApiProviders(); }

const DEFAULT_VIDEO_MODELS = ['veo3-fast','veo3','sora','runway','kling','pika','minimax-video','wan-v2','seedance-1.0-pro','jimeng-vide-3.0','jimeng-video-3.0-pro'];
const JIMENG_IMAGE2IMAGE_UNSUPPORTED = ['3.0', '3.1'];
const JIMENG_SEEDANCE_VIDEO_MODELS = ['seedance2.0_vip', 'seedance2.0fast_vip', 'seedance2.0', 'seedance2.0fast'];
const JIMENG_VIDEO_MODELS_BY_COMMAND = {
    text2video: JIMENG_SEEDANCE_VIDEO_MODELS,
    multimodal2video: JIMENG_SEEDANCE_VIDEO_MODELS,
    image2video: ['3.0', '3.0fast', '3.0pro', '3.5pro', ...JIMENG_SEEDANCE_VIDEO_MODELS],
    frames2video: ['3.0', '3.5pro', ...JIMENG_SEEDANCE_VIDEO_MODELS],
};
const VIDEO_REFERENCE_MODES = ['text','omni','image','frames','reference'];

const VIDEO_MODEL_CAPABILITY_REGISTRY = new Map();

function registerVideoModels(names, profile){
    names.forEach(name => VIDEO_MODEL_CAPABILITY_REGISTRY.set(String(name).trim().toLowerCase(), profile));
}

const range = (start, end) => Array.from({length:end - start + 1}, (_, index) => start + index);
const CONTROL_NONE = Object.freeze({aspects:[], resolutions:[], durations:[], audio:'none'});

registerVideoModels([
    'Seedance 2.0',
    'Seedance 2.0 Fast',
    'seedance2.0',
    'seedance2.0_vip',
    'seedance2.0fast',
    'seedance2.0fast_vip',
    'doubao-seedance-2-0-260128',
    'doubao-seedance-2-0-fast-260128',
], {
    family:'seedance-2.0',
    modes:{text:true, omni:true, image:true, frames:true, reference:false},
    controls:{
        aspects:['adaptive','16:9','4:3','1:1','3:4','9:16','21:9'],
        resolutions:['480p','720p','1080p'],
        durations:range(4, 15),
        audio:'toggle'
    },
    defaultDuration:5
});

registerVideoModels([
    'Seedance 2.0 Mini',
    'seedance-2.0-mini',
    'doubao-seedance-2-0-mini',
], {
    family:'seedance-2.0-mini',
    modes:{text:true, omni:true, image:true, frames:true, reference:false},
    controls:{
        aspects:['16:9','4:3','1:1','3:4','9:16','21:9'],
        resolutions:['480p','720p'],
        durations:range(4, 12),
        audio:'toggle'
    },
    defaultDuration:5
});

registerVideoModels(['MiniMax-Hailuo-02'], {
    family:'hailuo-02',
    modes:{text:true, omni:false, image:true, frames:true, reference:false},
    controls:{aspects:[], resolutions:['768p','1080p'], durations:[6,10], audio:'none'},
    modeControls:{image:{resolutions:['512p','768p','1080p']}, frames:{resolutions:['768p','1080p']}},
    durationByResolution:{'1080p':[6]}
});

registerVideoModels(['MiniMax-Hailuo-2.3'], {
    family:'hailuo-2.3',
    modes:{text:true, omni:false, image:true, frames:false, reference:false},
    controls:{aspects:[], resolutions:['768p','1080p'], durations:[6,10], audio:'none'},
    durationByResolution:{'1080p':[6]}
});

registerVideoModels(['MiniMax-Hailuo-2.3-Fast'], {
    family:'hailuo-2.3-fast',
    modes:{text:false, omni:false, image:true, frames:false, reference:false},
    controls:{aspects:[], resolutions:['768p','1080p'], durations:[6,10], audio:'none'},
    durationByResolution:{'1080p':[6]}
});

registerVideoModels([
    'Kling O1',
    'Kling-O1',
    'Kling-Video-O1',
    'Kling VIDEO O1',
    'Kling VIDEO 3.0 Omni',
    'Kling-Video-3.0-Omni',
], {family:'kling-omni', modes:{text:true, omni:true, image:true, frames:true, reference:true}, controls:CONTROL_NONE});

registerVideoModels([
    'veo-3.1-generate-preview',
    'veo-3.1-fast-generate-preview',
    'Veo 3.1',
    'Veo 3.1 Fast',
    'veo-3.1',
    'veo-3.1-fast',
], {
    family:'veo-3.1',
    modes:{text:true, omni:false, image:true, frames:true, reference:true},
    controls:{aspects:['16:9','9:16'], resolutions:['720p','1080p','4k'], durations:[4,6,8], audio:'always'},
    defaultDuration:8,
    modeControls:{reference:{durations:[8]}},
    durationByResolution:{'1080p':[8], '4k':[8]}
});

registerVideoModels([
    'viduq1', 'viduq1-classic', 'vidu2.0',
    'viduq2', 'viduq2-pro', 'viduq2-turbo',
    'viduq3', 'viduq3-pro', 'viduq3-turbo', 'viduq3-mix',
    'Vidu Q2',
], {
    family:'vidu-q2',
    modes:{text:true, omni:false, image:true, frames:true, reference:true},
    controls:{
        aspects:['16:9','9:16','1:1','3:4','4:3'],
        resolutions:['360p','540p','720p','1080p'],
        durations:range(1, 8),
        audio:'none'
    },
    defaultDuration:5
});

registerVideoModels(['Wan 2.6','Wan2.6','wan-2.6'], {
    family:'wan-2.6',
    modes:{text:true, omni:false, image:true, frames:true, reference:true},
    controls:{aspects:['16:9','9:16','1:1'], resolutions:['720p','1080p'], durations:[5,10,15], audio:'toggle'},
    defaultDuration:5
});

registerVideoModels([
    'grok-video-1.5-10s',
    'grok-video-1.5-15s',
    'grok-imagine-video-1.5',
    'grok-imagine-video-1.5-preview',
], {
    family:'grok-video-1.5',
    modes:{text:true, omni:false, image:true, frames:false, reference:true},
    controls:{
        aspects:['16:9','9:16','1:1','4:3','3:4','3:2','2:3'],
        resolutions:['480p','720p','1080p'],
        durations:range(1, 15),
        audio:'always'
    },
    modeControls:{reference:{resolutions:['480p','720p']}}
});

registerVideoModels(['grok-video-10s','grok-video-6s','grok-imagine-video'], {
    family:'grok-video',
    modes:{text:true, omni:false, image:true, frames:false, reference:true},
    controls:{
        aspects:['16:9','9:16','1:1','4:3','3:4','3:2','2:3'],
        resolutions:['480p','720p'],
        durations:range(1, 15),
        audio:'always'
    }
});

registerVideoModels([
    'kling-3.0-turbo', 'kling-video', 'kling-video-extend',
    'kling-motion-control', 'kling-multi-elements', 'kling-effects',
    'Kling 3.0',
], {family:'kling', modes:{text:true, omni:false, image:true, frames:true, reference:false}, controls:CONTROL_NONE});

registerVideoModels([
    'kling-omni-video',
    'Kling 3.0 Omni',
], {family:'kling-omni', modes:{text:true, omni:true, image:true, frames:true, reference:true}, controls:CONTROL_NONE});

registerVideoModels([
    'omni-flash', 'omni-flash-components', 'omni_flash-10s',
    'Gemini Omni Flash',
], {family:'gemini-omni', modes:{text:true, omni:true, image:true, frames:true, reference:true}, controls:CONTROL_NONE});

registerVideoModels([
    'happyhorse-1.0-i2v', 'happyhorse-1.1-i2v',
    'HappyHorse 1.0', 'HappyHorse 1.1',
], {family:'happyhorse', modes:{text:false, omni:false, image:true, frames:false, reference:false}, controls:CONTROL_NONE});

// 只对能够对应到公开模型家族的别名做匹配；完全陌生的模型不猜能力。
const VIDEO_FAMILY_HINTS = [
    [/grok.*1\.5/, 'grok-video-1.5'],
    [/grok.*video/, 'grok-video'],
    [/seedance.*mini/, 'seedance-2.0-mini'],
    [/seedance/, 'seedance-2.0'],
    [/vidu.*q?2/, 'vidu-q2'],
    [/wan.*2[.-]?6/, 'wan-2.6'],
    [/veo.*3[.-]?1/, 'veo-3.1'],
];

function profileForFamily(family){
    for(const profile of VIDEO_MODEL_CAPABILITY_REGISTRY.values()){
        if(profile.family === family) return profile;
    }
    return null;
}

function videoModelCapabilities(modelName=''){
    const officialName = String(modelName || '').trim().toLowerCase();
    const matched = VIDEO_MODEL_CAPABILITY_REGISTRY.get(officialName);
    if(matched) return {family:matched.family, recognized:true, modes:{...matched.modes}, profile:matched};
    if(officialName){
        for(const [pattern, family] of VIDEO_FAMILY_HINTS){
            if(pattern.test(officialName)){
                const profile = profileForFamily(family);
                if(profile) return {family, recognized:true, modes:{...profile.modes}, profile};
            }
        }
        return {
            family:'generic',
            recognized:false,
            modes:{text:false, omni:false, image:false, frames:false, reference:false},
            profile:null
        };
    }
    return {
        family:'unknown',
        recognized:false,
        modes:{text:false, omni:false, image:false, frames:false, reference:false},
        profile:null
    };
}

function videoModelOptions(target){
    const capabilities = videoModelCapabilities(target?.videoModel || '');
    if(!capabilities.recognized || !capabilities.profile) return {...CONTROL_NONE};
    const mode = currentVideoReferenceMode(target);
    const base = capabilities.profile.controls || CONTROL_NONE;
    const perMode = capabilities.profile.modeControls?.[mode] || {};
    const options = {
        aspects:[...(perMode.aspects || base.aspects || [])],
        resolutions:[...(perMode.resolutions || base.resolutions || [])],
        durations:[...(perMode.durations || base.durations || [])],
        audio:perMode.audio || base.audio || 'none'
    };
    const fixedDuration = String(target?.videoModel || '').toLowerCase().match(/(?:^|[-_])(\d{1,2})s(?:$|[-_])/i)?.[1];
    if(fixedDuration) options.durations = [Number(fixedDuration)];
    const resolution = String(target?.videoResolution || '').toLowerCase();
    const constrainedDurations = capabilities.profile.durationByResolution?.[resolution];
    if(Array.isArray(constrainedDurations)) options.durations = [...constrainedDurations];
    return options;
}

function currentVideoReferenceMode(target){
    const explicit = String(target?.videoReferenceMode || '');
    if(VIDEO_REFERENCE_MODES.includes(explicit)) return explicit;
    if(target?.videoUseFrameRoles) return 'frames';
    if(target?.videoMultimodal) return 'omni';
    return 'image';
}

function videoModeUsesSize(target){
    const options = videoModelOptions(target);
    return options.aspects.length > 0 || options.resolutions.length > 0;
}

function isFrontendProviderVisible(provider){
    return String(provider?.id || '').toLowerCase() !== 'jimeng';
}

function imageProviders(){
    if(window.SmartCanvasProviders) return SmartCanvasProviders.imageProviders().filter(isFrontendProviderVisible);
    return (apiProviders() || []).filter(p => isFrontendProviderVisible(p) && p.enabled !== false && p.id !== 'modelscope' && p.id !== 'volcengine' && (p.image_models || []).length);
}


function chatApiProviders(){
    return (apiProviders() || []).filter(p => isFrontendProviderVisible(p) && p.enabled !== false && (p.chat_models || []).length);
}


function resolveChatProviderId(providerId=''){
    const providers = chatApiProviders();
    if(providers.some(p => p.id === providerId)) return providerId;
    // 自定义文本绑定允许指向未配置 chat_models 的中转站，不做回退。
    const customs = window.SmartCanvasModeBindings?.customEntries?.('text') || [];
    if(providerId && customs.some(entry => entry.provider_id === providerId)) return providerId;
    return providers[0]?.id || 'comfly';
}


function providerChatModels(providerId){
    const provider = chatApiProviders().find(p => p.id === providerId);
    return [...new Set(provider?.chat_models || [])];
}


function ownerChatProviderForModel(modelName){
    const target = String(modelName || '').trim();
    if(!target) return '';
    const owner = chatApiProviders().find(p => (p.chat_models || []).includes(target));
    return owner?.id || '';
}


function ownerAudioProviderForModel(modelName){
    const target = String(modelName || '').trim();
    if(!target) return '';
    const list = (apiProviders() || []).filter(p => isFrontendProviderVisible(p) && p.enabled !== false && (p.audio_models || []).length);
    const owner = list.find(p => (p.audio_models || []).includes(target));
    return owner?.id || '';
}


function resolveChatModel(model='', providerId=''){
    // 自定义文本绑定的真实模型可能不在中转站 chat_models 列表里，原样保留。
    const customs = window.SmartCanvasModeBindings?.customEntries?.('text') || [];
    if(model && customs.some(entry => entry.model === model)) return model;
    const models = providerChatModels(resolveChatProviderId(providerId));
    return models.includes(model) ? model : (models[0] || model || 'gpt-4o-mini');
}


function chatProviderOptions(selectedId=''){
    const selected = resolveChatProviderId(selectedId);
    return chatApiProviders().map(provider => `<option value="${S().escapeHtml(provider.id)}" ${provider.id === selected ? 'selected' : ''}>${S().escapeHtml(provider.name || provider.id)}</option>`).join('');
}


function chatModelOptions(selectedModel='', providerId=''){
    const selectedProvider = resolveChatProviderId(providerId);
    const models = providerChatModels(selectedProvider);
    const selected = resolveChatModel(selectedModel, selectedProvider);
    return [...new Set([selected, ...models].filter(Boolean))].map(model => `<option value="${S().escapeHtml(model)}" ${model === selected ? 'selected' : ''}>${S().escapeHtml(model)}</option>`).join('');
}


function apiProviderById(providerId){
    return (apiProviders() || []).find(p => isFrontendProviderVisible(p) && p.id === providerId) || imageProviders()[0] || null;
}


function providerImageModels(providerId){
    return (apiProviders() || []).find(p => isFrontendProviderVisible(p) && p.id === providerId)?.image_models || [];
}


function sanitizeSmartApiSelection(target=S().settings){
    if(!target || typeof target !== 'object') return target;
    if(String(target.provider_id || '').toLowerCase() === 'jimeng'){
        target.provider_id = imageProviders()[0]?.id || '';
        target.model = '';
    }
    if(String(target.videoProvider || '').toLowerCase() === 'jimeng'){
        target.videoProvider = videoApiProviders()[0]?.id || '';
        target.videoModel = '';
    }
    if(target.engine === 'volcengine'){
        if(target.apiKind === 'video'){
            target.videoProvider = 'volcengine';
            const models = volcengineVideoModels();
            if(!models.includes(target.videoModel)) target.videoModel = models[0] || '';
        } else {
            target.provider_id = 'volcengine';
            const models = providerImageModels('volcengine');
            if(!models.includes(target.model)) target.model = models[0] || '';
        }
        return target;
    }
    const MB = window.SmartCanvasModeBindings;
    const customKept = (mode, model, providerId) => (MB?.customEntries?.(mode) || [])
        .some(entry => entry.model === model && entry.provider_id === providerId);
    if(target.provider_id && !customKept('image', target.model, target.provider_id)){
        const models = providerImageModels(target.provider_id);
        if(models.length && !models.includes(target.model)) target.model = models[0] || '';
    }
    if(target.videoProvider && !customKept('video', target.videoModel, target.videoProvider)){
        const models = providerVideoModels(target.videoProvider);
        if(models.length && !models.includes(target.videoModel)) target.videoModel = models[0] || '';
    }
    if(target.apiKind === 'audio' && global.SmartCanvasModeBindings){
        SmartCanvasModeBindings.applyBindingToSettings(target, 'audio');
    }
    if(target.apiKind === 'video') syncVideoCountFromSettings(target);
    return target;
}

function videoApiProviders(){
    if(window.SmartCanvasProviders){
        const fromConfig = SmartCanvasProviders.videoProviders().filter(isFrontendProviderVisible);
        if(fromConfig.length) return fromConfig;
    }
    const fromConfig = (apiProviders() || []).filter(p => isFrontendProviderVisible(p) && p.enabled !== false && (p.video_models || []).length);
    if(fromConfig.length) return fromConfig;
    return [{id:'comfly', name:'Comfly', video_models:DEFAULT_VIDEO_MODELS, enabled:true}];
}


function videoProviderById(providerId){
    return videoApiProviders().find(p => p.id === providerId) || videoApiProviders()[0] || null;
}


function smartVideoGenerationCount(runSettings){
    const source = runSettings || S().settings;
    const raw = Number(source?.count ?? source?.videoCount ?? 1) || 1;
    return Math.max(1, Math.min(4, raw));
}


function effectiveApiRunCount(runSettings=S().settings){
    if(S().isApiLikeEngine(runSettings?.engine) && runSettings?.apiKind === 'video'){
        return smartVideoGenerationCount(runSettings);
    }
    return Math.max(1, Number(runSettings?.count || 1) || 1);
}


function syncVideoCountFromSettings(target=S().settings){
    if(!target || typeof target !== 'object') return target;
    if(target.apiKind === 'video' || target.engine === 'volcengine'){
        const count = smartVideoGenerationCount(target);
        target.count = count;
        target.videoCount = count;
    }
    return target;
}


function shouldSerializeSmartVideoRequests(runSettings){
    const provider = videoProviderById(runSettings?.videoProvider || '');
    const baseUrl = String(provider?.base_url || '').toLowerCase();
    const model = String(runSettings?.videoModel || '').toLowerCase();
    return /agnes-ai\.com/.test(baseUrl) || /^agnes-video/.test(model);
}


function providerVideoModels(providerId){
    const provider = videoApiProviders().find(p => p.id === providerId);
    const models = provider?.video_models || DEFAULT_VIDEO_MODELS;
    return [...new Set(models)];
}


function ownerVideoProviderForModel(modelName){
    const target = String(modelName || '').trim();
    if(!target) return '';
    const owner = videoApiProviders().find(p => (p.video_models || []).includes(target));
    return owner?.id || '';
}


function isAgnesVideoHostProvider(provider){
    return /agnes-ai\.com/i.test(String(provider?.base_url || ''));
}


function preferredAgnesVideoProvider(providers){
    return (providers || []).find(p =>
        p.enabled !== false &&
        isAgnesVideoHostProvider(p) &&
        (p.video_models || []).some(m => /^agnes-video/i.test(String(m || '')))
    ) || null;
}


function normalizeVideoProviderDefaults(providers){
    const list = providers || [];
    const agnes = preferredAgnesVideoProvider(list);
    if(!S().settings.videoProvider || !list.some(p => p.id === S().settings.videoProvider)){
        const owner = ownerVideoProviderForModel(S().settings.videoModel);
        S().settings.videoProvider = owner || agnes?.id || list[0]?.id || 'comfly';
    }
    const models = providerVideoModels(S().settings.videoProvider);
    if(!S().settings.videoModel || !models.includes(S().settings.videoModel)){
        if(isAgnesVideoHostProvider(videoProviderById(S().settings.videoProvider))){
            S().settings.videoModel = models.find(m => /^agnes-video/i.test(String(m || ''))) || models[0] || 'agnes-video-v2.0';
        } else if(agnes && !ownerVideoProviderForModel(S().settings.videoModel)){
            S().settings.videoProvider = agnes.id;
            S().settings.videoModel = (agnes.video_models || []).find(m => /^agnes-video/i.test(String(m || ''))) || 'agnes-video-v2.0';
        } else {
            S().settings.videoModel = models[0] || 'veo3-fast';
        }
    }
}


function ownerImageProviderForModel(modelName){
    const target = String(modelName || '').trim();
    if(!target) return '';
    const owner = imageProviders().find(p => (p.image_models || []).includes(target));
    return owner?.id || '';
}


function volcengineProvider(){ 
 return (apiProviders() || []).find(p => p.id === 'volcengine' && p.enabled !== false) || { 
 id:'volcengine', 
 name:'火山引擎', 
 image_models:[], 
 video_models:DEFAULT_VIDEO_MODELS, 
 enabled:true 
 }; 
}


function volcengineVideoModels(){ 
 const provider = (apiProviders() || []).find(p => p.id === 'volcengine'); 
 return [...new Set(provider?.video_models || DEFAULT_VIDEO_MODELS)]; 
}


function normalizeSmartVideoModeSettings(target, preferMultimodal=false){
    if(!target || typeof target !== 'object') return target;
    let mode = currentVideoReferenceMode(target);
    const capabilities = videoModelCapabilities(target.videoModel);
    target.videoModelCapabilityRecognized = capabilities.recognized;
    if(!capabilities.recognized) return target;
    if(preferMultimodal && mode !== 'frames' && target._videoMultimodalUserSet !== true) mode = 'omni';
    if(!capabilities.modes[mode]){
        if(mode === 'omni' && capabilities.modes.frames) mode = 'frames';
        else if(mode === 'reference' && capabilities.modes.image) mode = 'image';
        else mode = VIDEO_REFERENCE_MODES.find(item => capabilities.modes[item]) || 'text';
    }
    target.videoReferenceMode = mode;
    target.videoUseFrameRoles = mode === 'frames';
    target.videoMultimodal = mode === 'omni' || mode === 'reference';
    const options = videoModelOptions(target);
    if(options.aspects.length && !options.aspects.includes(target.videoAspect)) target.videoAspect = options.aspects[0];
    if(!options.aspects.length) target.videoAspect = '';
    const normalizedResolution = String(target.videoResolution || '').toLowerCase();
    if(options.resolutions.length && !options.resolutions.includes(normalizedResolution)) target.videoResolution = options.resolutions[0];
    else if(options.resolutions.length) target.videoResolution = normalizedResolution;
    else target.videoResolution = '';
    const refreshedOptions = videoModelOptions(target);
    const duration = Number(target.videoDuration);
    if(refreshedOptions.durations.length && !refreshedOptions.durations.includes(duration)){
        const preferredDuration = Number(capabilities.profile?.defaultDuration);
        target.videoDuration = refreshedOptions.durations.includes(preferredDuration) ? preferredDuration : refreshedOptions.durations[0];
    }
    if(refreshedOptions.audio === 'always') target.videoGenerateAudio = true;
    if(refreshedOptions.audio === 'none') target.videoGenerateAudio = false;
    return target;
}

function videoModelDisplayName(modelName, providerId=''){
    const model = String(modelName || '').trim();
    const provider = videoProviderById(providerId) || videoApiProviders().find(item => (item.video_models || []).includes(model));
    return String(provider?.model_aliases?.[model] || model).trim();
}

function filterJimengImageModels(models){ 
 if(S().settings.provider_id !== 'jimeng' || !S().jimengImageEditMode()) return models; 
 return (models || []).filter(m => !JIMENG_IMAGE2IMAGE_UNSUPPORTED.includes(String(m))); 
}

function filterJimengVideoModels(models){ 
 if(S().settings.videoProvider !== 'jimeng') return models; 
 const allowed = JIMENG_VIDEO_MODELS_BY_COMMAND[S().jimengVideoCommand()]; 
 if(!allowed) return models; // multiframe2video 等：官方规格未知，不过滤 
 return (models || []).filter(m => allowed.includes(String(m))); 
}

function modelscopeProvider(){ 
 return (S().getApiProviders() || []).find(p => p.id === 'modelscope' && p.enabled !== false) || null; 
}

function modelscopeImageModels(){ 
 return modelscopeProvider()?.image_models || ['Tongyi-MAI/Z-Image-Turbo']; 
}

    const api = Object.freeze({
        registerDeps,
        get DEFAULT_VIDEO_MODELS(){ return DEFAULT_VIDEO_MODELS; },
        imageProviders,
        chatApiProviders,
        resolveChatProviderId,
        providerChatModels,
        resolveChatModel,
        chatProviderOptions,
        chatModelOptions,
        apiProviderById,
        providerImageModels,
        sanitizeSmartApiSelection,
        videoApiProviders,
        videoProviderById,
        smartVideoGenerationCount,
        effectiveApiRunCount,
        syncVideoCountFromSettings,
        shouldSerializeSmartVideoRequests,
        providerVideoModels,
        videoModelDisplayName,
        ownerVideoProviderForModel,
        isAgnesVideoHostProvider,
        preferredAgnesVideoProvider,
        normalizeVideoProviderDefaults,
        ownerImageProviderForModel,
        ownerChatProviderForModel,
        ownerAudioProviderForModel,
        volcengineProvider,
        volcengineVideoModels,
        videoModelCapabilities,
        videoModelOptions,
        currentVideoReferenceMode,
        videoModeUsesSize,
        normalizeSmartVideoModeSettings,
        filterJimengImageModels,
        filterJimengVideoModels,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('providerSelection', api);
    global.SmartCanvasProviderSelection = api;
})(window);
