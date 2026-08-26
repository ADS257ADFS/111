/**
 * Smart Canvas — per-node composer prompt draft save/load.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasPromptDraft] deps not registered');
        return c;
    }

function currentComposerSubject(){
    return S().selectedNode();
}

function savePromptDraftForCurrent(){
    if(global.SmartCanvasComposerText?.saveInputIfActive?.()) return;
    if(S().promptInput?.dataset?.promptLocked === '1') return;
    const subject = S().activeComposerNode();
    if(!subject) return;
    if(S().promptInput?.dataset?.preserveDraftOnce === '1' && subject.promptDraftHtml){
        delete S().promptInput.dataset.preserveDraftOnce;
        return;
    }
    subject.promptDraftHtml = S().promptInput.innerHTML;
    subject.promptDraftText = S().promptPlainText();
    subject.promptDraftTouched = true;
    subject.runSettings = S().cloneSmartSettings(S().settings);
}

function syncUpstreamTextIntoDraft(subject){
    if(!S().isSmartImageNode(subject)) return false;
    const upstreamText = String(S().inputPromptTextFor?.(subject) || '').trim();
    const previousSeed = String(subject.inputPromptSeedText || '').trim();
    if(!upstreamText){
        delete subject.inputPromptSeedText;
        return false;
    }
    if(previousSeed === upstreamText) return false;

    const hasDraft = typeof subject.promptDraftText === 'string';
    const currentText = String(hasDraft ? subject.promptDraftText : (subject.runPrompt || '')).trim();
    let nextText = currentText;
    let changed = false;

    if(!previousSeed){
        if(!currentText){
            nextText = upstreamText;
            changed = true;
        } else if(currentText !== upstreamText && !currentText.startsWith(`${upstreamText}\n\n`)){
            nextText = `${upstreamText}\n\n${currentText}`;
            changed = true;
        }
    } else if(currentText === previousSeed){
        nextText = upstreamText;
        changed = true;
    } else if(currentText.startsWith(`${previousSeed}\n\n`)){
        nextText = `${upstreamText}${currentText.slice(previousSeed.length)}`;
        changed = true;
    }

    // Once absorbed, the main composer draft is authoritative. Remembering the
    // source prevents re-seeding the text whenever the node is selected again.
    subject.inputPromptSeedText = upstreamText;
    if(!changed) return false;
    subject.promptDraftText = nextText;
    subject.promptDraftHtml = S().escapeHtml(nextText);
    return true;
}

function setPromptDraftForNode(node, text){
    if(!S().isSmartImageNode(node)) return;
    const value = String(text || '');
    node.promptDraftHtml = S().escapeHtml(value);
    node.promptDraftText = value;
    node.promptDraftTouched = true;
    if(S().activeSettingsSubject()?.id === node.id && S().promptInput){
        S().promptInput.textContent = value;
        delete S().promptInput.dataset.preserveDraftOnce;
    }
}

function loadPromptDraft(subject){
    if(subject?.promptDraftHtml){
        const hasToken = String(subject.promptDraftHtml || '').includes('mention-image-token');
        const draftText = typeof subject.promptDraftText === 'string'
            ? subject.promptDraftText
            : String(subject.runPrompt || '');
        S().promptInput.innerHTML = hasToken
            ? subject.promptDraftHtml
            : (S().promptHtmlWithMentionTokens(draftText, subject.runPromptRefs || []) || subject.promptDraftHtml);
    } else if(typeof subject?.runPrompt === 'string' || typeof subject?.promptDraftText === 'string'){
        const text = typeof subject?.promptDraftText === 'string'
            ? subject.promptDraftText
            : String(subject?.runPrompt || '');
        const rebuilt = S().promptHtmlWithMentionTokens(text, subject.runPromptRefs || []);
        if(rebuilt) S().promptInput.innerHTML = rebuilt;
        else S().setPromptText(text);
    } else {
        S().setPromptText('');
    }
}

    const api = Object.freeze({
        registerDeps,
        currentComposerSubject,
        savePromptDraftForCurrent,
        setPromptDraftForNode,
        syncUpstreamTextIntoDraft,
        loadPromptDraft
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('promptDraft', api);
    global.SmartCanvasPromptDraft = api;
})(window);
