/**
 * Smart Canvas — composer prompt input read/write helpers.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasPromptInput] deps not registered');
        return c;
    }

function promptPlainText(){
    return S().promptInput.innerText.replace(/\u00a0/g, ' ').trim();
}

function setPromptInputLocked(locked){
    S().promptInput.dataset.promptLocked = locked ? '1' : '0';
    S().promptInput.setAttribute('contenteditable', locked ? 'false' : 'true');
    S().promptInput.classList.toggle('prompt-input-locked', Boolean(locked));
    if(locked) S().closeMentionPicker();
}

function setPromptText(text){
    S().promptInput.textContent = text || '';
}

function clearPromptInput(options={}){
    if(options.preserveDraft){
        S().promptInput.dataset.preserveDraftOnce = '1';
        S().closeMentionPicker();
        return;
    }
    S().promptInput.textContent = '';
    S().closeMentionPicker();
    if(S().activeComposerSubject){
        S().activeComposerSubject.promptDraftHtml = '';
        S().activeComposerSubject.promptDraftText = '';
    }
}

    const api = Object.freeze({
        registerDeps,
        promptPlainText,
        setPromptInputLocked,
        setPromptText,
        clearPromptInput
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('promptInput', api);
    global.SmartCanvasPromptInput = api;
})(window);
