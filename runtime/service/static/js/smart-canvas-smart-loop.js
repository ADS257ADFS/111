/**
 * Smart Canvas — smart-loop prompt fields and upstream image/text input resolution.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    const smartLoopPromptVisiting = new Set();

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasSmartLoop] deps not registered');
        return c;
    }

function nodeHasReferenceContent(node){
    return S().imagesForNode(node).some(img => img?.url);
}

function isSelfReferenceForNode(node, img){
    return Boolean(node?.id && img?.nodeId === node.id);
}

function candidateInputImagesFor(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    const inputs = (S().smartImageUsesWorkflowInput(node, ctx) ? workflowInputImagesFor(node, consume, ctx) : inputImagesFor(node, consume, ctx))
        .filter(img => img?.url);
    if(!inputs.length) return [];
    if(S().smartImageUsesWorkflowInput(node, ctx)) return inputs;
    return inputs;
}

function defaultInputImagesFor(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    return candidateInputImagesFor(node, consume, ctx);
}

function splitSmartPromptItems(text){
    const trimmed = String(text || '').trim();
    if(!trimmed) return [];
    const numbered = trimmed.split(/\s*(?:^|\s)\d+\s*[.。、，)]\s+/).map(s => s.trim()).filter(Boolean);
    if(numbered.length >= 2) return numbered;
    const lines = trimmed.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    return lines.length >= 2 ? lines : [trimmed];
}

function smartLoopPromptFieldValues(node){
    const fields = Array.isArray(node?.variablePrompts)
        ? node.variablePrompts.map(text => String(text || '').trim())
        : [];
    if(fields.length) return fields;
    return splitSmartPromptItems(node?.variablePrompt || '');
}

function smartLoopActivePromptFieldValues(node){
    return smartLoopPromptFieldValues(node).filter(Boolean);
}

function setSmartLoopPromptFieldValues(node, values){
    if(!node || node.type !== 'smart-loop') return;
    const fields = (values || []).map(text => String(text || '').trim());
    node.variablePrompts = fields.length ? fields : [''];
    node.variablePrompt = fields.filter(Boolean).join('\n');
}

function smartLoopPromptFieldText(node, fieldIndex){
    const values = smartLoopPromptFieldValues(node);
    return values[fieldIndex] || '';
}

function smartLoopSelectedLocalPrompt(node, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    const values = smartLoopActivePromptFieldValues(node);
    if(!values.length) return '';
    const startBase = Math.max(1, Number(node?.loopStart) || 1);
    const index = Math.max(1, Number(ctx?.index || startBase) || startBase);
    return values[(index - 1) % values.length] || '';
}

function smartLoopUpstreamPromptPreviewHeight(node){
    return smartLoopInputPromptItems(node).length ? 78 : 0;
}

function smartLoopInputPromptItems(node){
    if(!node?.showPrompt || smartLoopPromptVisiting.has(node.id)) return [];
    smartLoopPromptVisiting.add(node.id);
    try {
        return S().inputNodesFor(node).flatMap(input => {
            if(input.type === 'smart-prompt') return String(input.text || '').trim() ? [String(input.text || '').trim()] : [];
            if(input.type === 'smart-loop') {
                const text = smartLoopPrompt(input);
                return text ? [text] : [];
            }
            return [];
        }).filter(Boolean);
    } finally {
        smartLoopPromptVisiting.delete(node.id);
    }
}

function smartLoopSelectedInputPrompt(node, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    const items = smartLoopInputPromptItems(node);
    if(!items.length) return '';
    const startBase = Math.max(1, Number(node?.loopStart) || 1);
    const index = Math.max(1, Number(ctx?.index || startBase) || startBase);
    return items[(index - 1) % items.length] || '';
}

function smartLoopPrompt(node, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    if(!node?.showPrompt) return '';
    const count = S().smartLoopCount(node);
    const startBase = Math.max(1, Number(node.loopStart) || 1);
    const index = Math.max(1, Number(ctx?.index || startBase) || startBase);
    const total = Math.max(1, Number(ctx?.total || count) || count);
    const selected = smartLoopSelectedInputPrompt(node, ctx);
    const localPrompt = smartLoopSelectedLocalPrompt(node, ctx);
    const combined = [selected, localPrompt].map(text => String(text || '').trim()).filter(Boolean).join('\n\n');
    return String(combined || '')
        .replaceAll('[[COUNT]]', String(index))
        .replaceAll('[count]', String(index))
        .replaceAll(`[${S().tr('canvas.counterToken')}]`, String(index))
        .replaceAll('[[TOTAL]]', String(total))
        .replaceAll('[total]', String(total))
        .replaceAll('[[PROGRESS]]', `${index}/${total}`)
        .replaceAll('[progress]', `${index}/${total}`)
        .trim();
}

function smartLoopInputImages(node, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    if(!node?.imageInput) return [];
    const refs = S().inputNodesFor(node).flatMap(input => {
        if(input?.type === 'smart-loop') return smartLoopInputImages(input, ctx);
        return S().imagesForNode(input);
    }).filter(img => img?.url);
    if(!refs.length) return [];
    const startBase = Math.max(1, Number(node.loopStart) || 1);
    const batchSize = Math.max(1, Math.min(100, Number(node.imageBatchSize) || 1));
    const currentIndex = Math.max(1, Number(ctx?.index || startBase) || startBase);
    return refs.slice(Math.max(0, currentIndex - 1), Math.max(0, currentIndex - 1) + batchSize)
        .map((img, i) => ({...img, name:img.name || S().trf('canvas.loopImageLabel', {n:currentIndex + i})}));
}

function smartLoopPreviewImages(node){
    if(!node?.imageInput) return [];
    return S().inputNodesFor(node).flatMap(input => {
        if(input?.type === 'smart-loop') return smartLoopInputImages(input, {index:Number(node.loopStart) || 1});
        return S().imagesForNode(input);
    }).filter(img => img?.url);
}

function outputImagesForNode(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    if(node?.type === 'smart-loop') return smartLoopInputImages(node, ctx);
    if(global.SmartCanvasSmartGroup?.isSmartGroupNode?.(node)){
        return (global.SmartCanvasSmartGroup?.smartGroupImageRefs?.(node) || []).map(ref => ({
            ...(ref.item || ref.source || {}),
            nodeId:ref.nodeId || node.id,
            imageIndex:Number.isFinite(Number(ref.index)) ? Number(ref.index) : 0
        })).filter(img => img?.url);
    }
    return S().imagesForNode(node).filter(img => img?.url);
}

function selfReferenceImagesForNode(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    return outputImagesForNode(node, consume, ctx).filter(img => img?.url);
}

function textForNode(node, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    if(!node) return '';
    if(node.type === 'smart-prompt') return node.text || '';
    if(node.type === 'smart-loop') return smartLoopPrompt(node, ctx);
    return '';
}

function inputImagesFor(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    return S().upstreamNodesForKinds(node, ['input', 'flow']).flatMap(input => outputImagesForNode(input, consume, ctx));
}

function workflowInputImagesFor(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    return S().workflowInputNodesFor(node).flatMap(input => outputImagesForNode(input, consume, ctx));
}

function activeInputImagesFor(node, consume=false, ctx=null){
    ctx = ctx ?? S().smartLoopContext;
    return inputImagesFor(node, consume, ctx).filter(img => img?.url && !S().isInputRefBlocked(node, img));
}

function toggleInputRefBlocked(node, img){
    if(!node || !img?.url) return;
    const key = S().inputRefKey(img);
    if(!key) return;
    S().pushUndo();
    const blocked = S().blockedInputRefKeys(node);
    if(blocked.has(key)) blocked.delete(key);
    else blocked.add(key);
    node.blockedInputRefs = [...blocked];
    if(!node.blockedInputRefs.length) delete node.blockedInputRefs;
    S().renderInputThumbsRow(node);
    S().scheduleSave();
}

function smartLoopCount(node){
    return Math.max(1, Math.min(100, Number(node?.count || 1) || 1));
}

    function smartLoopRoundSettings(runSettings, ctx=smartLoopContext){
 const next = {...(runSettings || {})};
 const imageCountEngine = S().isApiLikeEngine(next.engine)
 ? next.apiKind !== 'video'
 : next.engine === 'modelscope';
 if(ctx?.nodeId && imageCountEngine){
 next.count = 1;
 }
 return next;
}
    function smartRunNeedsPrompt(sourceSettings=settings){
 sourceSettings = sourceSettings || settings;
 if(sourceSettings.engine === 'runninghub') return S().runningHubRunNeedsPrompt(sourceSettings);
 if(sourceSettings.engine === 'comfy' && sourceSettings.comfyMode === 'enhance') return false;
 return true;
}
    function isSmartLoopDefaultPrompt(text){
 const value = String(text || '').trim();
 if(!value) return false;
 return value === smartLoopDefaultPromptText()
 || value === '现在生成第《计数》张卖点图片'
 || value === 'Generate selling-point image 《计数》';
}
    function smartLoopDefaultPromptText(){
 return S().tr('smart.loopDefaultPrompt') || '现在生成第《计数》张卖点图片';
}
    const api = Object.freeze({
        smartLoopDefaultPromptText,
        isSmartLoopDefaultPrompt,
        smartRunNeedsPrompt,
        smartLoopRoundSettings,
        registerDeps,
        get smartLoopPromptVisiting(){ return smartLoopPromptVisiting; },
        nodeHasReferenceContent,
        isSelfReferenceForNode,
        candidateInputImagesFor,
        defaultInputImagesFor,
        splitSmartPromptItems,
        smartLoopPromptFieldValues,
        smartLoopActivePromptFieldValues,
        setSmartLoopPromptFieldValues,
        smartLoopPromptFieldText,
        smartLoopSelectedLocalPrompt,
        smartLoopUpstreamPromptPreviewHeight,
        smartLoopInputPromptItems,
        smartLoopSelectedInputPrompt,
        smartLoopPrompt,
        smartLoopInputImages,
        smartLoopPreviewImages,
        outputImagesForNode,
        selfReferenceImagesForNode,
        textForNode,
        inputImagesFor,
        workflowInputImagesFor,
        activeInputImagesFor,
        toggleInputRefBlocked,
        smartLoopCount
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('smartLoop', api);
    }
    global.SmartCanvasSmartLoop = api;
})(window);
