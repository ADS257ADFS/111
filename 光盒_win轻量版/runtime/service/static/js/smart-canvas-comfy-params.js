/**
 * Smart Canvas — ComfyUI workflow cache, field params, random overrides.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasComfyParams] deps not registered');
        return c;
    }
    function workflowCache(){ return S().getComfyWorkflowCache(); }

function comfyRandomEnabledField(field){ return field?.type === 'number' && field.random_enabled === true; }



function smartComfyRandomActive(fieldId){
    return smartComfyRandomActiveFor(S().settings, fieldId);
}


function smartComfyRandomActiveFor(source, fieldId){
    const active = source?.comfyRandomActive || {};
    return active[fieldId] !== false;
}


function toggleSmartComfyRandom(fieldId){
    S().settings.comfyRandomActive = S().settings.comfyRandomActive || {};
    S().settings.comfyRandomActive[fieldId] = !smartComfyRandomActive(fieldId);
    S().persistActiveSmartSettings();
    S().renderDynamicParams();
    S().scheduleSave();
}


function smartComfyRandomValue(field){
    const isFloat = Number(field.step) > 0 && Number(field.step) < 1;
    let min = Number.isFinite(Number(field.min)) ? Number(field.min) : null;
    let max = Number.isFinite(Number(field.max)) ? Number(field.max) : null;
    const name = `${field.input || ''} ${field.name || ''}`.toLowerCase();
    const looksSeed = name.includes('seed') || name.includes('noise') || name.includes('随机') || name.includes('噪');
    if(min === null) min = looksSeed ? 1 : 0;
    if(max === null || max <= min) max = looksSeed ? 4294967295 : 999999;
    if(looksSeed) max = Math.min(max, 4294967295);
    const value = min + Math.random() * (max - min);
    if(isFloat){
        const precision = Math.min(8, Math.max(1, String(field.step).split('.')[1]?.length || 2));
        return Number(value.toFixed(precision));
    }
    return Math.floor(value);
}


async function ensureComfyWorkflow(name){
    if(!name) return null;
    if(workflowCache()[name]) return workflowCache()[name];
    const data = await fetch(`/api/workflows/${encodeURIComponent(name)}`).then(r => r.ok ? r.json() : null).catch(() => null);
    if(data) workflowCache()[name] = data;
    return data;
}


function currentComfyFields(){
    return workflowCache()[S().settings.comfyWorkflow]?.config?.fields || [];
}


function comfyParamValue(field){
    S().settings.comfyParams = S().settings.comfyParams || {};
    if(S().settings.comfyParams[field.id] !== undefined) return S().settings.comfyParams[field.id];
    return field.default ?? (field.type === 'boolean' ? false : (field.type === 'number' || field.type === 'slider' ? 0 : ''));
}


function comfyFieldKind(field){
    if(['image','video','audio'].includes(field?.type)) return field.type;
    const key = `${field?.input || ''} ${field?.name || ''}`.toLowerCase();
    if(field?.type === 'textarea' || /prompt|text|提示词|正向|负向/.test(key)) return 'prompt';
    return 'setting';
}


function comfyParamsFromWorkflowValues(config, values={}){ 
 const params = {}; 
 (config?.fields || []).forEach(field => { 
 if(!field?.node || !field?.input) return; 
 let value = values[field.id]; 
 if(value === undefined) value = field.default; 
 if(field.type === 'number' || field.type === 'slider'){ 
 const n = Number(value); 
 if(Number.isFinite(n)) value = field.step && Number(field.step) < 1 ? n : Math.round(n); 
 } else if(field.type === 'boolean'){ 
 value = Boolean(value); 
 } else if(field.type === 'dropdown' && typeof value === 'string'){ 
 const s = value.trim(); 
 if(s && /^-?\d+(?:\.\d+)?(?:e-?\d+)?$/i.test(s)) value = s.includes('.') || /e/i.test(s) ? Number(s) : parseInt(s, 10); 
 } 
 params[field.node] = params[field.node] || {}; 
 params[field.node][field.input] = value; 
 }); 
 return params; 
}


    const api = Object.freeze({
        registerDeps,
        comfyRandomEnabledField,
        smartComfyRandomActive,
        smartComfyRandomActiveFor,
        toggleSmartComfyRandom,
        smartComfyRandomValue,
        ensureComfyWorkflow,
        currentComfyFields,
        comfyParamValue,
        comfyFieldKind,
        comfyParamsFromWorkflowValues
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('comfyParams', api);
    global.SmartCanvasComfyParams = api;
})(window);
