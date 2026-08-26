/**
 * Smart Canvas — build prompt + reference resolution for generation runs.
 * Cascade orchestration remains in smart-canvas.js for now.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || null;
    }

    function S(){
        const c = d();
        if(!c) throw new Error('[SmartCanvasPromptRequest] deps not registered');
        return c;
    }

function promptInputNodesFor(node){
    return S().inputNodesFor(node).filter(input => input?.type === 'smart-prompt' || input?.type === 'smart-loop');
}
function inputPromptTextFor(node, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    const directText = promptInputNodesFor(node).map(input => S().textForNode(input, ctx)).filter(Boolean);
    const relayText = Array.isArray(ctx?.relayPromptNodeIds)
        ? ctx.relayPromptNodeIds.map(id => S().getNodes().find(n => n.id === id)).map(input => S().textForNode(input, ctx)).filter(Boolean)
        : [];
    const seen = new Set();
    return [...directText, ...relayText].filter(text => {
        const key = String(text || '').trim();
        if(!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).join('\n\n');
}
function inputRefKey(img){
    if(!img?.url) return '';
    const nodeId = img.nodeId || '';
    const imageIndex = Number.isFinite(Number(img.imageIndex)) ? String(Number(img.imageIndex)) : '';
    if(nodeId && imageIndex !== '') return `${nodeId}|${imageIndex}`;
    return `url|${img.url}`;
}
function blockedInputRefKeys(node){
    return new Set(Array.isArray(node?.blockedInputRefs) ? node.blockedInputRefs.filter(Boolean) : []);
}
function isInputRefBlocked(node, img){
    if(!node || !img?.url) return false;
    return blockedInputRefKeys(node).has(inputRefKey(img));
}
function defaultReferenceImagesFor(node, consume=false, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    if(!node) return [];
    const upstream = S().uniqueReferenceImages(S().defaultInputImagesFor(node, consume, ctx));
    if(S().smartImageUsesWorkflowInput(node, ctx)) return upstream;
    if(upstream.length) return upstream;
    const self = S().selfReferenceImagesForNode(node, consume, ctx).filter(img => img?.url);
    if(self.length) return S().uniqueReferenceImages(self);
    return [];
}
function collectPromptParts(){
    const parts = [];
    const walk = node => {
        if(node.nodeType === Node.TEXT_NODE){
            if(node.textContent) parts.push({type:'text', text:node.textContent});
            return;
        }
        if(node.nodeType !== Node.ELEMENT_NODE) return;
        if(node.classList?.contains('mention-image-token')){
            parts.push({type:'image', url:node.dataset.url || '', name:node.dataset.name || '鍥剧墖', nodeId:node.dataset.nodeId || '', imageIndex:Number(node.dataset.imageIndex || 0)});
            return;
        }
        if(node.tagName === 'BR') parts.push({type:'text', text:'\n'});
        node.childNodes.forEach(walk);
        if(node !== S().promptInput && ['DIV','P'].includes(node.tagName)) parts.push({type:'text', text:'\n'});
    };
    S().promptInput.childNodes.forEach(walk);
    return parts;
}
function originalPromptTextFromParts(parts){
    let text = '';
    (parts || []).forEach(part => {
        if(part.type === 'text'){
            text += part.text || '';
            return;
        }
        if(part.type === 'image') text += `@${part.name || '鍥剧墖'}`;
    });
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function buildPromptRequest(node, overrideDefaultImages=null, consumeDefault=false, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    const parts = collectPromptParts();
    const originalPrompt = originalPromptTextFromParts(parts);
    const blockedRefs = blockedInputRefKeys(node);
    const hasOverrideImages = Array.isArray(overrideDefaultImages);
    const sourceDefaultImages = hasOverrideImages ? overrideDefaultImages : defaultReferenceImagesFor(node, consumeDefault, ctx);
    const orderedDefaultImages = global.SmartCanvasComposerInputThumbs?.orderedInputThumbItems?.(node, sourceDefaultImages) || sourceDefaultImages;
    const filteredDefaultImages = orderedDefaultImages
        .filter(img => !blockedRefs.has(inputRefKey(img)));
    const defaultRefs = S().uniqueReferenceImages(filteredDefaultImages);
    const refs = defaultRefs.map((img, index) => ({...img, role:`image_${index + 1}`}));
    let hasMentionToken = false;
    const refMap = new Map();
    refs.forEach((img, index) => refMap.set(img.url, index + 1));
    let body = '';
    parts.forEach(part => {
        if(part.type === 'text'){
            body += part.text;
            return;
        }
        if(!part.url) return;
        hasMentionToken = true;
        const mentionedKey = inputRefKey(part);
        if(blockedRefs.has(mentionedKey)){
            body += `@${part.name || '鍥剧墖'}`;
            return;
        }
        if(!refMap.has(part.url)){
            refMap.set(part.url, refs.length + 1);
            refs.push({url:part.url, name:part.name || `图${refs.length + 1}`, nodeId:part.nodeId, imageIndex:part.imageIndex, role:`image_${refs.length + 1}`});
        }
        body += `图${refMap.get(part.url)}`;
    });
    body = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const displayPrompt = originalPrompt || body;
    if(hasMentionToken && refs.length){
        const mapText = refs.map((img, i) => `Image ${i + 1}: ${img.name || `Image ${i + 1}`}`).join('\n');
        return {
            prompt:`${S().tr('smart.refMapHeader')}\n${mapText}\n\n${S().tr('smart.refUserNeed')}\n${body}`,
            displayPrompt,
            refs:refs.map((img, index) => ({url:img.url, name:img.name || `Image ${index + 1}`, role:`image_${index + 1}`})),
            mentioned:true
        };
    }
    return {
        prompt:body,
        displayPrompt,
        refs:refs.map((img, index) => ({url:img.url, name:img.name || `图${index + 1}`, role:`image_${index + 1}`})),
        mentioned:false
    };
}
function loadNodePromptDraftToInput(node){
    if(node?.promptDraftHtml) {
        const hasToken = String(node.promptDraftHtml || '').includes('mention-image-token');
        const draftText = typeof node.promptDraftText === 'string'
            ? node.promptDraftText
            : String(node.runPrompt || '');
        S().promptInput.innerHTML = hasToken
            ? node.promptDraftHtml
            : (S().promptHtmlWithMentionTokens(draftText, node.runPromptRefs || []) || node.promptDraftHtml);
    } else {
        const draftText = typeof node?.promptDraftText === 'string'
            ? node.promptDraftText
            : String(node?.runPrompt || '');
        const rebuilt = S().promptHtmlWithMentionTokens(draftText, node?.runPromptRefs || []);
        if(rebuilt) S().promptInput.innerHTML = rebuilt;
        else S().setPromptText(draftText);
    }
}
function buildPromptRequestForNode(node, defaultImages, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    const oldHtml = S().promptInput.innerHTML;
    loadNodePromptDraftToInput(node);
    try {
        return buildPromptRequest(node, defaultImages, false, ctx);
    } finally {
        S().promptInput.innerHTML = oldHtml;
    }
}
    const api = Object.freeze({
        registerDeps,
        promptInputNodesFor,
        inputPromptTextFor,
        inputRefKey,
        blockedInputRefKeys,
        isInputRefBlocked,
        defaultReferenceImagesFor,
        collectPromptParts,
        originalPromptTextFromParts,
        buildPromptRequest,
        loadNodePromptDraftToInput,
        buildPromptRequestForNode,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('promptRequest', api);
    }
    global.SmartCanvasPromptRequest = api;
})(window);
