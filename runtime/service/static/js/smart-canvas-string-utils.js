/**
 * Smart Canvas — uid and HTML escape helpers.
 */
(function(global){
    'use strict';

function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`; }


function escapeHtml(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
const escapeAttr = escapeHtml;


function optionHtml(value, label, selected){
    return `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(label ?? value)}</option>`;
}

    const api = Object.freeze({
        uid,
        escapeHtml,
        optionHtml,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('stringUtils', api);
    global.SmartCanvasStringUtils = api;
})(window);
