/**
 * Smart Canvas — run LLM on smart-prompt nodes.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasPromptLlm] deps not registered');
        return c;
    }
    function nodes(){ return S().getNodes(); }

async function fetchPromptLLMText(node){
    const message = (node.llmInstruction || node.text || '').trim();
    if(!message) throw new Error(S().tr('smart.promptLlmNeedText'));
    const primaryMediaRefs = S().promptNodeInputMediaForLLM(node) || [];
    const connectedMediaRefs = (node.inputNodeIds || [])
        .map(id => nodes().find(candidate => candidate.id === id))
        .filter(Boolean)
        .flatMap(source => {
            let refs = [];
            try { refs = S().outputImagesForNode(source) || []; } catch(_error) {}
            return refs.length ? refs : (Array.isArray(source.images) ? source.images.filter(item => item?.url) : []);
        });
    const mediaRefs = primaryMediaRefs.length ? primaryMediaRefs : connectedMediaRefs;
    const images = S().imageRefsOnly(mediaRefs).map(img => img.url).filter(Boolean).slice(0, 8);
    const videos = S().videoRefsOnly(mediaRefs).map(video => video.url).filter(Boolean);
    const provider = S().resolveChatProviderId(node.llmProvider || '');
    const model = S().resolveChatModel(node.llmModel || '', provider);
    const result = await fetch('/api/canvas-llm', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            message,
            messages:[],
            images,
            videos,
            model,
            provider
        })
    }).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    return (result.text || '').trim();
}

async function runPromptLLMNode(nodeId){
    const node = nodes().find(n => n.id === nodeId);
    if(!node || node.type !== 'smart-prompt') return;
    node.llmEnabled = true;
    node.running = true;
    S().render();
    try {
        node.text = await fetchPromptLLMText(node);
        node.llmProvider = S().resolveChatProviderId(node.llmProvider || '');
        node.llmModel = S().resolveChatModel(node.llmModel || '', node.llmProvider);
        S().scheduleSave();
    } catch(e) {
        S().toast((e.message || S().tr('smart.promptLlmFailed')).slice(0, 160));
    } finally {
        node.running = false;
        S().render();
    }
}

async function runPromptLLMNodeBatch(nodeId, count){
    const node = nodes().find(n => n.id === nodeId);
    if(!node || node.type !== 'smart-prompt') return;
    const total = Math.max(1, Number(count) || 1);
    if(total <= 1) return runPromptLLMNode(nodeId);
    node.llmEnabled = true;
    node.pending = total;
    node.running = true;
    node.text = '';
    S().render();
    const parts = [];
    try {
        for(let index = 0; index < total; index += 1){
            parts.push(await fetchPromptLLMText(node));
            node.pending = Math.max(0, total - index - 1);
            S().render();
        }
        node.text = parts.filter(Boolean).join('\n\n---\n\n');
        node.llmProvider = S().resolveChatProviderId(node.llmProvider || '');
        node.llmModel = S().resolveChatModel(node.llmModel || '', node.llmProvider);
        S().scheduleSave();
    } catch(e) {
        if(parts.length) node.text = parts.filter(Boolean).join('\n\n---\n\n');
        S().toast((e.message || S().tr('smart.promptLlmFailed')).slice(0, 160));
    } finally {
        node.pending = 0;
        node.running = false;
        S().render();
    }
}


    const api = Object.freeze({
        registerDeps,
        fetchPromptLLMText,
        runPromptLLMNode,
        runPromptLLMNodeBatch
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('promptLlm', api);
    global.SmartCanvasPromptLlm = api;
})(window);
