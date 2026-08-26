/**
 * Smart Canvas — i18n wrappers, toast, theme, icon refresh.
 */
(function(global){
    'use strict';

function tr(key){ return window.StudioI18n?.t ? window.StudioI18n.t(key) : key; }


function trf(key, values={}){
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), tr(key));
}


function refreshIcons(root=document){
    if(!window.lucide) return;
    // Re-processing every icon in a large canvas makes an otherwise tiny panel
    // toggle feel delayed. Callers can scope refreshes to the surface they just
    // changed; the document fallback remains for initial boot.
    try { lucide.createIcons({root:root || document}); }
    catch(_e) { lucide.createIcons(); }
}


function applyTheme(theme){
    const normalized = window.StudioTheme?.normalize?.(theme) || (theme === 'dark' ? 'dark' : 'light');
    const dark = normalized === 'dark';
    [document.documentElement, document.body].filter(Boolean).forEach(node => {
        node.classList.toggle('theme-dark', dark);
        node.classList.toggle('studio-theme-dark', dark);
    });
}


function toast(text){
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 1800);
}


    const api = Object.freeze({
        tr,
        trf,
        refreshIcons,
        applyTheme,
        toast
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('uiFeedback', api);
    global.SmartCanvasUiFeedback = api;
})(window);
