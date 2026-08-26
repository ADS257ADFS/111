/**
 * Smart Canvas — cascade graph utilities (chain topology, loop resolution, connection keys).
 * Cascade graph utilities + run orchestration (runSmartCascade).
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
        if(!c) throw new Error('[SmartCanvasCascade] deps not registered');
        return c;
    }

    function nodes(){
        return S().getNodes();
    }

    function canvasConnections(){
        return S().getCanvas()?.connections || [];
    }

function primaryImageInputFor(node, options={}){
    const direct = options.includeFlow
        ? S().directImageInputsForKinds(node, ['input', 'flow'])[0]
        : S().directImageInputsFor(node)[0];
    if(direct) return direct;
    const inputs = options.includeFlow ? S().upstreamNodesForKinds(node, ['input', 'flow']) : (S().smartImageUsesWorkflowInput(node) ? S().workflowInputNodesFor(node) : S().inputNodesFor(node));
    const loop = inputs.find(n => n?.type === 'smart-loop');
    if(loop?.imageInput){
        const upstream = S().upstreamNodesForKinds(loop, options.includeFlow ? ['input', 'flow'] : ['input']).find(n => S().isSmartImageNode(n) && (n.images || []).some(img => img?.url));
        if(upstream) return upstream;
    }
    return null;
}
function hasDownstreamImageNode(node){
    return downstreamNodesForId(node?.id).some(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n));
}
function isGeneratedOutputForNode(sourceNode, targetNode){
    return Boolean(sourceNode?.id && targetNode?.sourceNodeId === sourceNode.id);
}
function downstreamWorkflowImageTargetsFor(node){
    return downstreamImageTargetsFor(node).filter(target => !isGeneratedOutputForNode(node, target));
}
function hasDownstreamWorkflowImageNode(node){
    return downstreamWorkflowImageTargetsFor(node).length > 0;
}
function smartImageChainTo(nodeId, options={}){
    const tail = nodes().find(n => n.id === nodeId);
    if(!S().isSmartImageNode(tail) || S().isHistoryGroupNode(tail)) return [];
    const chain = [];
    const seen = new Set();
    let cur = tail;
    while(cur && !seen.has(cur.id)){
        seen.add(cur.id);
        chain.unshift(cur);
        cur = primaryImageInputFor(cur, options);
    }
    return chain;
}
function upstreamNodesForId(nodeId, kinds=['input']){
    const result = [];
    const seen = new Set([nodeId]);
    const walk = id => {
        S().upstreamNodesForKinds(nodes().find(n => n.id === id), kinds).forEach(input => {
            if(seen.has(input.id)) return;
            seen.add(input.id);
            walk(input.id);
            result.push(input);
        });
    };
    walk(nodeId);
    return result;
}
function resolveSmartCascadeLoop(nodeId){
    const loops = upstreamNodesForId(nodeId, ['input', 'flow']).filter(n => n.type === 'smart-loop');
    if(!loops.length) return null;
    const loop = loops[loops.length - 1];
    return {node:loop, count:S().smartLoopCount(loop), mode:loop.mode === 'parallel' ? 'parallel' : 'serial'};
}
function relayLoopPromptNodesForEdge(sourceNode, targetNode){
    if(!sourceNode?.id || !targetNode?.id) return [];
    const directLoopIds = new Set(S().promptInputNodesFor(targetNode).filter(n => n?.type === 'smart-loop' && n.showPrompt).map(n => n.id));
    return S().inputNodesFor(sourceNode)
        .filter(n => n?.type === 'smart-loop' && n.showPrompt && !directLoopIds.has(n.id));
}
function relayLoopPromptNodesForTarget(node){
    if(!node?.id) return [];
    return S().inputNodesFor(node).filter(n => n?.type === 'smart-loop' && n.showPrompt);
}
function downstreamNodesForId(nodeId){
    const result = [];
    const seen = new Set([nodeId]);
    const walk = id => {
        canvasConnections()
            .filter(conn => conn.from === id && ['input','flow'].includes(conn.kind || 'flow'))
            .map(conn => nodes().find(n => n.id === conn.to))
            .filter(Boolean)
            .forEach(next => {
                if(seen.has(next.id)) return;
                seen.add(next.id);
                result.push(next);
                walk(next.id);
            });
    };
    walk(nodeId);
    return result;
}
function downstreamImageTargetsFor(node){
    if(!node?.id) return [];
    return canvasConnections()
        .filter(conn => conn.from === node.id && ['input','flow'].includes(conn.kind || 'flow'))
        .map(conn => nodes().find(n => n.id === conn.to))
        .filter(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n))
        .sort((a, b) => {
            const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
            if(ax !== bx) return ax - bx;
            return (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}
function downstreamCascadeTargetsFor(node){
    if(!node?.id) return [];
    return canvasConnections()
        .filter(conn => conn.from === node.id && ['input','flow'].includes(conn.kind || 'flow'))
        .map(conn => nodes().find(n => n.id === conn.to))
        .filter(n => n && !S().isHistoryGroupNode(n) && (S().isSmartImageNode(n) || n.type === 'smart-loop'))
        .sort((a, b) => {
            const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
            if(ax !== bx) return ax - bx;
            return (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}
function directLoopRunTargets(loop){
    if(!loop?.id) return [];
    return downstreamImageTargetsFor(loop)
        .filter(node => !hasDownstreamWorkflowImageNode(node));
}
function smartCascadeGraphForTail(tail){
    const path = smartImageChainTo(tail?.id, {includeFlow:true}).filter(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n));
    if(!path.length) return {root:null, path:[], edges:[], children:new Map()};
    const loop = resolveSmartCascadeLoop(tail?.id);
    const loopRoots = loop?.node?.id ? downstreamImageTargetsFor(loop.node) : [];
    const loopRoot = loopRoots.find(n => path.some(p => p.id === n.id));
    const root = loopRoot || path[0];
    const edges = [];
    const children = new Map();
    const seenEdges = new Set();
    const visiting = new Set();
    const walk = node => {
        if(!node?.id || visiting.has(node.id)) return;
        visiting.add(node.id);
        const targets = downstreamCascadeTargetsFor(node);
        children.set(node.id, targets);
        targets.forEach(target => {
            const key = `${node.id}->${target.id}`;
            if(!seenEdges.has(key)){
                seenEdges.add(key);
                edges.push({source:node, target, key});
            }
            walk(target);
        });
        visiting.delete(node.id);
    };
    walk(root);
    return {root, path, edges, children};
}
function cascadeTailForLoop(loopId){
    const loop = nodes().find(n => n.id === loopId && n.type === 'smart-loop');
    const directTargets = directLoopRunTargets(loop);
    if(directTargets.length) return directTargets[directTargets.length - 1];
    const directImages = downstreamImageTargetsFor({id:loopId});
    const directIds = new Set(directImages.map(n => n.id));
    const candidates = downstreamNodesForId(loopId)
        .filter(n => S().isSmartImageNode(n))
        .filter(n => !S().isHistoryGroupNode(n))
        .filter(n => canRunSmartCascade(n));
    if(!candidates.length) return null;
    return candidates.sort((a, b) => {
        const ad = directIds.has(a.id) ? 1 : 0;
        const bd = directIds.has(b.id) ? 1 : 0;
        if(ad !== bd) return ad - bd;
        const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
        if(ax !== bx) return bx - ax;
        return (Number(b.y) || 0) - (Number(a.y) || 0);
    })[0];
}
function canRunSmartCascade(node){
    if(!S().isSmartImageNode(node) || S().isHistoryGroupNode(node)) return false;
    const graph = smartCascadeGraphForTail(node);
    const loop = resolveSmartCascadeLoop(node.id);
    if(loop && isDirectLoopTargetRun(loop, node, graph)) return true;
    if(hasDownstreamImageNode(node)) return false;
    if(graph.edges.length) return true;
    return Boolean(loop);
}
function isDirectLoopTargetRun(loop, tail, graph){
    if(!loop?.node?.id || !tail?.id) return false;
    if(graph?.root?.id !== tail.id) return false;
    if(hasDownstreamWorkflowImageNode(tail)) return false;
    return downstreamImageTargetsFor(loop.node).some(node => node.id === tail.id);
}
function cascadeConnectionKeys(){
    const keys = new Set();
    const addKey = (from, to) => {
        if(from && to) keys.add(`${from}->${to}`);
    };
    const smartCascadeRuns = S().smartCascadeRuns;
    const activeLoopIds = new Set(smartCascadeRuns.keys());
    const loops = activeLoopIds.size
        ? nodes().filter(n => n?.type === 'smart-loop' && activeLoopIds.has(n.id))
        : nodes().filter(n => n?.type === 'smart-loop');
    loops.forEach(loop => {
        const tail = cascadeTailForLoop(loop.id);
        if(!tail) return;
        const graph = smartCascadeGraphForTail(tail);
        if(!graph.root) return;
        const chainIds = new Set(graph.path.map(n => n.id));
        graph.edges.forEach(edge => addKey(edge.source.id, edge.target.id));
        canvasConnections().forEach(conn => {
            if((conn.kind || 'flow') === 'history') return;
            const toNode = nodes().find(n => n.id === conn.to);
            if(conn.from === loop.id && (chainIds.has(conn.to) || downstreamNodesForId(conn.to).some(n => chainIds.has(n.id)))) addKey(conn.from, conn.to);
            if(toNode && chainIds.has(toNode.id)){
                S().inputNodesFor(toNode).filter(n => n?.type === 'smart-loop' && n.showPrompt).forEach(inputLoop => addKey(inputLoop.id, toNode.id));
            }
        });
    });
    return keys;
}

function activeSmartCascadeCount(){ return S().smartCascadeRuns.size; }
function smartCascadeRunForLoop(loopId){ return loopId ? S().smartCascadeRuns.get(loopId) || null : null; }
function smartCascadeIsLoopRunning(loopId){ return Boolean(smartCascadeRunForLoop(loopId)); }
function syncSmartCascadeLegacyState(preferredLoopId=''){
    const activeIds = [...S().smartCascadeRuns.keys()];
    S().smartCascadeRunning = activeIds.length > 0;
    S().smartCascadeActiveLoopId = preferredLoopId && S().smartCascadeRuns.has(preferredLoopId)
        ? preferredLoopId
        : (activeIds[0] || '');
    const activeRun = S().smartCascadeActiveLoopId ? S().smartCascadeRuns.get(S().smartCascadeActiveLoopId) : null;
    S().smartCascadeStopRequested = Boolean(activeRun?.stopRequested);
    S().smartCascadeRunPath = activeRun?.runPath || null;
}
function smartCascadeAnyRunning(){ return S().smartCascadeRunning || activeSmartCascadeCount() > 0; }
function smartCascadeEdgeState(edgeKey){
    for(const run of S().smartCascadeRuns.values()){
        const state = run?.runPath?.states?.[edgeKey];
        if(state) return state;
    }
    return S().smartCascadeRunPath?.states?.[edgeKey] || '';
}
function smartCascadePathForCtx(ctx=null){
    return ctx?.runState?.runPath || ctx?.runPath || S().smartCascadeRunPath;
}

function loopOutputSlotsForRoot(rootNode){
    if(!rootNode?.id) return [];
    return downstreamNodesForId(rootNode.id)
        .filter(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n))
        .sort((a, b) => {
            const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
            if(ax !== bx) return ax - bx;
            return (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}
function loopOutputSlotForRound(rootNode, loopNode, roundIndex, slotIndex){
    if(!rootNode?.id) return null;
    const candidates = loopOutputSlotsForRoot(rootNode)
        .filter(node => node.sourceNodeId === rootNode.id)
        .filter(node => !loopNode?.id || !node.loopSourceId || node.loopSourceId === loopNode.id);
    const untagged = candidates.filter(node => !Number.isFinite(Number(node.loopRoundIndex)) && !Number.isFinite(Number(node.loopSlotIndex)));
    return candidates.find(node => Number(node.loopRoundIndex) === Number(roundIndex))
        || candidates.find(node => Number(node.loopSlotIndex) === Number(slotIndex))
        || untagged[Math.max(0, Number(slotIndex) || 0)]
        || null;
}
function tagLoopOutputSlot(output, rootNode, loopNode, roundIndex, slotIndex){
    if(!output) return output;
    output.sourceNodeId = rootNode?.id || output.sourceNodeId || '';
    output.loopSourceId = loopNode?.id || output.loopSourceId || '';
    output.loopRootId = rootNode?.id || output.loopRootId || '';
    output.loopRoundIndex = Number(roundIndex) || 0;
    output.loopSlotIndex = Math.max(0, Number(slotIndex) || 0);
    return output;
}
function createLoopOutputSlot(rootNode, roundIndex, roundOffset=0, options={}){
    const rootRect = S().nodeRect(rootNode);
    const output = S().cloneSmartNode(rootNode, 0, 0);
    output.id = S().uid('smart');
    output.type = 'smart-image';
    output.x = (Number(rootNode.x) || 0) + (Number(rootRect.width) || 260) + 80;
    output.title = `Image ${roundIndex}`;
    output.images = [];
    output.pending = options.pending ? Math.max(1, Number(options.pending) || 1) : 0;
    output.running = Boolean(options.pending);
    output.queued = Boolean(options.queued);
    if(options.pending){
        output.runStartedAt = S().nowMs();
        output.runTimerHidden = false;
    }
    output.created_at = Date.now();
    delete output.w;
    delete output.h;
    delete output.historyFor;
    delete output.isHistoryGroup;
    delete output.sourceNodeId;
    delete output.runAt;
    delete output.runPrompt;
    delete output.runModelPrompt;
    delete output.runPromptRefs;
    delete output.runInputRefs;
    delete output.runFinishedAt;
    delete output.runElapsedMs;
    tagLoopOutputSlot(output, rootNode, options.loopNode || null, roundIndex, options.slotIndex ?? roundOffset);
    const slots = loopOutputSlotsForRoot(rootNode).map(nodeRect);
    let y = (Number(rootNode.y) || 0) + roundOffset * ((Number(rootRect.height) || 180) + 28);
    slots.forEach(rect => {
        if((Number(rect.x) || 0) >= (Number(output.x) || 0) - 24){
            y = Math.max(y, (Number(rect.y) || 0) + (Number(rect.height) || 0) + 28);
        }
    });
    output.y = y;
    nodes().push(output);
    S().addConnection(rootNode.id, output.id, 'flow');
        const runPath = smartCascadePathForCtx(options.ctx || options.runState);
        if(runPath?.states) runPath.states[`${rootNode.id}->${output.id}`] = 'wait';
    return output;
}

function finishLoopTargetPreviewState(node){
    if(!node) return;
    node.pending = 0;
    node.running = false;
    node.queued = false;
    delete node.pendingTasks;
    node.runFinishedAt = S().nowMs();
    if(!node.runStartedAt) node.runStartedAt = node.runFinishedAt;
    node.runElapsedMs = Math.max(0, node.runFinishedAt - Number(node.runStartedAt || node.runFinishedAt));
    node.runTimerHidden = false;
    if((node.images || []).some(img => img?.url)){
        node.title = node.images.length > 1 ? 'Group' : 'Image';
        node.scale = node.images.length > 1 ? S().MEDIA_GROUP_DEFAULT_SCALE : S().MEDIA_NODE_DEFAULT_SCALE;
        node.outputKind = S().mediaKindForUrls(node.images || [], (node.images || []).some(isVideoMediaItem) ? 'video' : 'image');
        delete node.w;
        delete node.h;
    }
}
function refsForDirectLoopRound(loopNode, loopIndex, total){
    if(!loopNode?.imageInput) return [];
    return S().outputImagesForNode(loopNode, true, {index:loopIndex, total, nodeId:loopNode.id})
        .filter(ref => ref?.url)
        .map((ref, index) => ({
            ...ref,
            role:ref.role || `image_${index + 1}`,
            name:ref.name || S().trf('canvas.loopImageLabel', {n:loopIndex + index})
        }));
}
function showDirectLoopRoundPreview(loopNode, target, refs, loopIndex, total){
    if(!loopNode?.imageInput || !S().isSmartImageNode(target)) return false;
    const cleanRefs = (refs || []).filter(ref => ref?.url);
    if(!cleanRefs.length) return false;
    const preview = cleanRefs.map((ref, index) => S().stripImageGenerationMeta({
        url:ref.url || '',
        name:ref.name || S().trf('canvas.loopImageLabel', {n:loopIndex + index}),
        kind:ref.kind || (S().isVideoMediaItem(ref) ? 'video' : 'image'),
        nodeId:ref.nodeId || '',
        imageIndex:ref.imageIndex ?? '',
        loopInputPreview:true
    })).filter(ref => ref.url);
    if(!preview.length) return false;
    target.images = preview;
    target.pending = 0;
    target.running = true;
    target.runStartedAt = S().nowMs();
    delete target.runFinishedAt;
    delete target.runElapsedMs;
    target.runTimerHidden = false;
    target.runInputRefs = cleanRefs.map(ref => ({
        url:ref.url || '',
        name:ref.name || '',
        nodeId:ref.nodeId || '',
        imageIndex:ref.imageIndex ?? '',
        kind:ref.kind || ''
    })).filter(ref => ref.url);
    target.outputKind = S().mediaKindForUrls(preview, preview.some(isVideoMediaItem) ? 'video' : 'image');
    target.scale = preview.length > 1 ? S().MEDIA_GROUP_DEFAULT_SCALE : S().MEDIA_NODE_DEFAULT_SCALE;
    target.title = total > 1 ? `Image ${loopIndex}/${total}` : (target.title || 'Image');
    delete target.w;
    delete target.h;
    S().render();
    return true;
}

function syncCascadeRunButton(node){
    if(node === undefined) node = S().selectedNode();
    if(!S().cascadeRunBtn) return;
    const visible = canRunSmartCascade(node);
    S().cascadeRunBtn.style.display = visible ? 'inline-flex' : 'none';
    const nodeLoopId = resolveSmartCascadeLoop(node?.id)?.node?.id || '';
    const loopRunState = smartCascadeRunForLoop(nodeLoopId);
    const runningForNode = Boolean(loopRunState);
    S().cascadeRunBtn.disabled = !visible || (!runningForNode && Boolean(node?.running)) || Boolean(loopRunState?.stopRequested);
    S().cascadeRunBtn.classList.toggle('is-stop', runningForNode);
    S().cascadeRunBtn.innerHTML = runningForNode
        ? `<i data-lucide="square"></i><span>${S().escapeHtml(smartCascadeStopText(Boolean(loopRunState?.stopRequested)))}</span>`
        : `<i data-lucide="workflow"></i><span>${S().escapeHtml(S().tr('smart.loopRunAll'))}</span>`;
    S().refreshIcons();
}
async function generateUrlsForCurrentSettings(node, prompt, refs, runSettings){
    if(runSettings === undefined) runSettings = S().settings;
    const activeSettings = runSettings || S().settings;
    if(activeSettings.engine === 'comfy') return generateComfyUrlsWithSettings(activeSettings, prompt, refs);
    if(S().isApiLikeEngine(activeSettings.engine) && activeSettings.apiKind === 'video'){
        return {urls:await S().runApiVideoGeneration(prompt, refs, activeSettings), kind:'video'};
    }
    if(S().isApiLikeEngine(activeSettings.engine)){
        const taskResult = await S().runApiGeneration(prompt, refs, activeSettings, node);
        const taskIds = Array.isArray(taskResult?.taskIds) ? taskResult.taskIds : [];
        if(taskIds.length){
            const settled = await Promise.all(taskIds.map(taskId => S().pollSmartCanvasTask(taskId)));
            const urls = settled.flatMap(result => S().resultMediaUrls(result?.images || result)).filter(Boolean);
            return {urls, kind:S().mediaKindForUrls(urls, 'image')};
        }
        const urls = S().resultMediaUrls(taskResult);
        return {urls, kind:S().mediaKindForUrls(urls, 'image')};
    }
    const urls = activeSettings.engine === 'runninghub'
        ? await S().runRunningHubGeneration(prompt, refs, activeSettings)
        : activeSettings.engine === 'modelscope'
        ? await S().runModelscopeGeneration(prompt, refs, activeSettings)
        : [];
    return {urls, kind:S().mediaKindForUrls(urls, 'image')};
}
async function generateComfyUrlsWithSettings(runSettings, prompt, refs){
    const allRefs = refs || [];
    const imageRefs = S().imageRefsOnly(allRefs);
    const mode = runSettings.comfyMode || 'text';
    if(mode === 'text'){
        const data = await fetch('/api/generate', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({prompt, width:Number(runSettings.width || 1024), height:Number(runSettings.height || 1024), workflow_json:'Z-Image.json', type:'zimage'})
        }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
        const urls = S().resultMediaUrls(data);
        return {urls, kind:S().mediaKindForUrls(urls, 'image')};
    }
    if(mode === 'enhance'){
        if(!imageRefs.length) throw new Error(S().tr('smart.errEnhanceNeedRefs'));
        const inputName = await S().comfyNameForRef(imageRefs[0]);
        const data = await fetch('/api/generate', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({workflow_json:'Z-Image-Enhance.json', type:'enhance', params:{"15":{image:inputName},"204":{value:Number(runSettings.enhanceStrength ?? 0.5)}}})
        }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
        const urls = S().resultMediaUrls(data);
        return {urls, kind:S().mediaKindForUrls(urls, 'image')};
    }
    if(mode === 'edit'){
        if(!imageRefs.length) throw new Error(S().tr('smart.errEditNeedRefs'));
        const names = [];
        for(const ref of imageRefs.slice(0, 3)) names.push(await S().comfyNameForRef(ref));
        const data = await fetch('/api/generate', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({prompt, workflow_json:'Flux2-Klein.json', type:'klein', params:{"168":{text:prompt},"158":{noise_seed:Math.floor(Math.random()*1000000)},"278":{image:names[0] || ""},"270":{image:names[1] || ""},"292":{image:names[2] || ""},"313":{value:Boolean(names[1])},"314":{value:Boolean(names[2])}}})
        }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
        const urls = S().resultMediaUrls(data);
        return {urls, kind:S().mediaKindForUrls(urls, 'image')};
    }
    const workflowName = runSettings.comfyWorkflow || S().comfyWorkflows[0]?.name || '';
    if(!workflowName) throw new Error(S().tr('smart.errNeedWorkflow'));
    const wf = await fetch(`/api/workflows/${encodeURIComponent(workflowName)}`).then(async r => {
        if(!r.ok) throw new Error(await r.text());
        return r.json();
    });
    const fields = wf.config?.fields || [];
    const values = {};
    fields.filter(f => S().comfyFieldKind(f) === 'prompt').forEach((field, index) => {
        values[field.id] = index === 0 ? prompt : (field.default ?? '');
    });
    const assignMediaFields = async (mediaFields, mediaRefs) => {
        for(let i = 0; i < mediaFields.length && i < mediaRefs.length; i++){
            values[mediaFields[i].id] = await S().comfyNameForRef(mediaRefs[i]);
        }
    };
    await assignMediaFields(fields.filter(f => S().comfyFieldKind(f) === 'image'), imageRefs);
    await assignMediaFields(fields.filter(f => S().comfyFieldKind(f) === 'video'), S().videoRefsOnly(allRefs));
    await assignMediaFields(fields.filter(f => S().comfyFieldKind(f) === 'audio'), S().audioRefsOnly(allRefs));
    fields.filter(f => S().comfyFieldKind(f) === 'setting').forEach(field => {
        if(S().comfyRandomEnabledField(field) && S().smartComfyRandomActiveFor(runSettings, field.id)){
            values[field.id] = S().smartComfyRandomValue(field);
        } else {
            values[field.id] = runSettings.comfyParams?.[field.id] ?? field.default;
        }
    });
    const result = await fetch(`/api/workflows/${encodeURIComponent(workflowName)}/run`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({config:wf.config || {fields:[]}, fields:values})
    }).then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); });
    const urls = S().resultMediaUrls(result);
    const fallbackKind = result.videos?.length ? 'video' : result.audios?.length ? 'audio' : result.texts?.length ? 'text' : 'image';
    return {urls, kind:S().mediaKindForUrls(urls, fallbackKind)};
}
async function runCascadeStepIntoNode(sourceNode, targetNode, inputRefs, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    const outputNode = targetNode || sourceNode;
    if(!sourceNode || !targetNode || !outputNode) return [];
    const requestNode = sourceNode?.type === 'smart-loop' ? targetNode : sourceNode;
    const previousSettings = S().cloneSmartSettings(S().settings);
    const runSettings = {...S().cloneSmartSettings(S().settings), ...S().cloneSmartSettings(S().smartSettingsForNode(requestNode) || {})};
    S().settings = runSettings;
    const outpaintSize = S().validOutpaintSize(requestNode);
    const selfRefs = sourceNode?.type === 'smart-loop' ? [] : S().selfReferenceImagesForNode(sourceNode, false, ctx).filter(img => img?.url);
    const upstreamRefs = S().defaultReferenceImagesFor(requestNode, false, ctx).filter(img => img?.url);
    const sourceRefs = (upstreamRefs.length ? upstreamRefs : selfRefs).filter(img => img?.url);
    const refsForRequest = sourceRefs.length
        ? sourceRefs
        : (inputRefs && inputRefs.length ? inputRefs : null);
    const request = S().buildPromptRequestForNode(
        requestNode,
        refsForRequest,
        ctx
    );
    const prompt = (request.prompt || '').trim();
    const displayPrompt = (request.displayPrompt || '').trim();
    if(!prompt || (!displayPrompt && !(runSettings.engine === 'comfy' && runSettings.comfyMode === 'enhance'))){
        S().settings = previousSettings;
        throw new Error('Chain node is missing prompt');
    }
    const meta = {
        prompt,
        displayPrompt:request.displayPrompt || '',
        promptRefs:(request.refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? ''})).filter(ref => ref.url),
        inputRefs:(request.refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? '', kind:ref.kind || ''})).filter(ref => ref.url),
        sourceNodeId:sourceNode.id,
        settings:JSON.parse(JSON.stringify(runSettings)),
        createdAt:Date.now()
    };
    if(requestNode.promptDraftHtml != null){
        meta.promptHtml = requestNode.promptDraftHtml;
        meta.promptText = requestNode.promptDraftText || request.displayPrompt || '';
    }
    const logKind = S().isApiLikeEngine(runSettings.engine) && runSettings.apiKind === 'video' ? 'video' : 'image';
    const runLog = S().smartRunSnapshot(requestNode, prompt, request.refs || [], logKind);
    const runLogStart = S().nowMs();
    const targetPromptState = {
        promptDraftHtml:targetNode.promptDraftHtml,
        promptDraftText:targetNode.promptDraftText,
        runPrompt:targetNode.runPrompt,
        runModelPrompt:targetNode.runModelPrompt,
        runPromptRefs:targetNode.runPromptRefs ? targetNode.runPromptRefs.map(ref => ({...ref})) : undefined,
        runInputRefs:targetNode.runInputRefs ? targetNode.runInputRefs.map(ref => ({...ref})) : undefined,
        runSettings:targetNode.runSettings ? S().cloneSmartSettings(targetNode.runSettings) : undefined,
        sourceNodeId:targetNode.sourceNodeId,
        runAt:targetNode.runAt
    };
    outputNode.running = true;
    outputNode.runStartedAt = S().nowMs();
    delete outputNode.runFinishedAt;
    delete outputNode.runElapsedMs;
    outputNode.runTimerHidden = false;
    S().rememberRecentSmartSettings(runSettings, requestNode);
    S().render();
    S().settings = previousSettings;
    try {
        const result = await generateUrlsForCurrentSettings(outputNode, prompt, request.refs || [], runSettings);
        if(!result.urls?.length) throw new Error(result.kind === 'video' ? S().tr('smart.errNoOutVideos') : S().tr('smart.errNoOutImages'));
        if(outpaintSize) delete requestNode.outpaintSize;
        S().addSmartGenerationLog({run:{...runLog, kind:result.kind || logKind}, outputs:result.urls, runMs:S().nowMs() - runLogStart});
        const ext = result.kind === 'video' ? 'mp4' : result.kind === 'audio' ? 'mp3' : result.kind === 'text' ? 'txt' : 'png';
        const additions = result.urls.map((item, i) => {
            const url = typeof item === 'string' ? item : item?.url || '';
            return S().stripImageGenerationMeta({url, name:(typeof item === 'object' && item.name) || `output-${i + 1}.${ext}`, kind:(typeof item === 'object' && item.kind) || result.kind, generatedResult:true});
        }).filter(item => item.url);
        S().replaceOutputsToNodeWithHistory(outputNode, additions, result.kind, null, {skipShift:Boolean(ctx?.nodeId)});
        outputNode.runPrompt = targetPromptState.runPrompt;
        outputNode.runModelPrompt = targetPromptState.runModelPrompt;
        outputNode.runPromptRefs = targetPromptState.runPromptRefs || [];
        outputNode.runInputRefs = targetPromptState.runInputRefs || [];
        outputNode.runSettings = targetPromptState.runSettings;
        outputNode.sourceNodeId = targetPromptState.sourceNodeId;
        outputNode.runAt = targetPromptState.runAt;
        if(targetPromptState.promptDraftHtml === undefined) delete outputNode.promptDraftHtml;
        else outputNode.promptDraftHtml = targetPromptState.promptDraftHtml;
        if(targetPromptState.promptDraftText === undefined) delete outputNode.promptDraftText;
        else outputNode.promptDraftText = targetPromptState.promptDraftText;
        ['runPrompt','runModelPrompt','runSettings','sourceNodeId','runAt'].forEach(key => {
            if(targetPromptState[key] === undefined) delete outputNode[key];
        });
        S().settings = previousSettings;
        S().render();
        return additions;
    } catch(e) {
        outputNode.running = false;
        S().addSmartGenerationLog({run:runLog, outputs:[], runMs:S().nowMs() - runLogStart, error:e.message || String(e)});
        S().settings = previousSettings;
        S().render();
        throw e;
    }
}
async function runLoopRoundIntoSlot(loopNode, rootNode, outputSlot, loopIndex, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    if(!loopNode || !rootNode || !outputSlot) return [];
    const previousSettings = S().cloneSmartSettings(S().settings);
    const edgeKey = `${rootNode.id}->${outputSlot.id}`;
    const runSettings = {...S().cloneSmartSettings(S().settings), ...S().cloneSmartSettings(S().smartSettingsForNode(rootNode) || {})};
    S().settings = runSettings;
    try {
        const refsForRequest = S().outputImagesForNode(loopNode, true, ctx).filter(img => img?.url);
        const request = S().buildPromptRequestForNode(rootNode, refsForRequest.length ? refsForRequest : null, ctx);
        const prompt = (request.prompt || '').trim();
        const displayPrompt = (request.displayPrompt || '').trim();
        if(!prompt || (!displayPrompt && !(runSettings.engine === 'comfy' && runSettings.comfyMode === 'enhance'))) throw new Error('Chain node is missing prompt');
        const meta = {
            prompt,
            displayPrompt:request.displayPrompt || '',
            promptRefs:(request.refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? ''})).filter(ref => ref.url),
            inputRefs:(request.refs || []).map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? '', kind:ref.kind || ''})).filter(ref => ref.url),
            sourceNodeId:rootNode.id,
            settings:JSON.parse(JSON.stringify(runSettings)),
            createdAt:Date.now()
        };
        const logKind = S().isApiLikeEngine(runSettings.engine) && runSettings.apiKind === 'video' ? 'video' : 'image';
        const runLog = S().smartRunSnapshot(rootNode, prompt, request.refs || [], logKind);
        const runLogStart = S().nowMs();
        const expectedCount = S().isApiLikeEngine(runSettings.engine) && runSettings.apiKind !== 'video'
            ? Math.max(1, Number(runSettings.count || 1) || 1)
            : 1;
        outputSlot.queued = false;
        outputSlot.running = true;
        outputSlot.pending = expectedCount;
        outputSlot.runStartedAt = S().nowMs();
        delete outputSlot.runFinishedAt;
        delete outputSlot.runElapsedMs;
        outputSlot.runTimerHidden = false;
        const runPath = smartCascadePathForCtx(ctx);
        if(runPath?.states) {
            runPath.states[edgeKey] = 'active';
            S().refreshConnectionLayer();
        }
        S().render();
        S().settings = previousSettings;
        let result;
        if(S().isApiLikeEngine(runSettings.engine) && runSettings.apiKind !== 'video'){
            const taskResult = await S().runApiGeneration(prompt, request.refs || [], runSettings, requestNode);
            const taskIds = Array.isArray(taskResult?.taskIds) ? taskResult.taskIds : [];
            if(!taskIds.length) throw new Error(S().tr('smart.errRunFailed'));
            const existing = S().cleanHistoryImages(outputSlot.images || []);
            if(existing.length){
                const history = S().ensureHistoryGroupForNode(outputSlot);
                history.images = S().cleanHistoryImages([...existing, ...(history.images || [])]);
                history.title = '历史分组';
                history.outputKind = 'image';
                history.scale = S().MEDIA_GROUP_DEFAULT_SCALE;
                delete history.w;
                delete history.h;
                outputSlot.images = [];
            }
            outputSlot.pendingTasks = taskIds.map(taskId => ({taskId, kind:'image'}));
            outputSlot.pending = Math.max(taskIds.length, Number(outputSlot.pending || 0) || taskIds.length);
            outputSlot.running = false;
            S().render();
            S().scheduleSave();
            await S().saveCanvas();
            await S().resumeSmartPendingNode(outputSlot);
            result = {urls:(outputSlot.images || []).map(img => img?.url ? img : null).filter(Boolean), kind:'image'};
        } else {
            result = await generateUrlsForCurrentSettings(outputSlot, prompt, request.refs || [], runSettings);
        }
        if(!result.urls?.length) throw new Error(result.kind === 'video' ? S().tr('smart.errNoOutVideos') : S().tr('smart.errNoOutImages'));
        let additions;
        if(S().isApiLikeEngine(runSettings.engine) && runSettings.apiKind !== 'video'){
            additions = (outputSlot.images || []).map(img => S().stripImageGenerationMeta({...img})).filter(img => img?.url);
            if(meta) S().attachRunMeta(outputSlot, meta);
        } else {
            const ext = result.kind === 'video' ? 'mp4' : result.kind === 'audio' ? 'mp3' : result.kind === 'text' ? 'txt' : 'png';
            additions = result.urls.map((item, i) => {
                const url = typeof item === 'string' ? item : item?.url || '';
                return S().stripImageGenerationMeta({url, name:(typeof item === 'object' && item.name) || `output-${i + 1}.${ext}`, kind:(typeof item === 'object' && item.kind) || result.kind, generatedResult:true});
            }).filter(item => item.url);
            S().replaceOutputsToNodeWithHistory(outputSlot, additions, result.kind, meta, {skipShift:Boolean(ctx?.nodeId)});
        }
        if(runPath?.states) {
            runPath.states[edgeKey] = 'done';
            S().refreshConnectionLayer();
        }
        S().addSmartGenerationLog({run:{...runLog, kind:result.kind || logKind}, outputs:result.urls, runMs:S().nowMs() - runLogStart});
        return additions;
    } catch(e) {
        outputSlot.queued = false;
        outputSlot.pending = 0;
        outputSlot.running = false;
        throw e;
    } finally {
        S().settings = previousSettings;
    }
}
function appendCascadeRefsToReceiver(node, refs, ctx){
    if(ctx === undefined) ctx = S().smartLoopContext;
    if(!node || !refs?.length) return [];
    const additions = refs
        .filter(ref => ref?.url)
        .map((ref, i) => S().stripImageGenerationMeta({
            url:ref.url,
            name:ref.name || `output-${i + 1}.png`,
            kind:ref.kind || (S().isVideoMediaItem(ref) ? 'video' : 'image')
        }));
    if(!additions.length) return [];
    S().replaceOutputsToNodeWithHistory(node, additions, S().mediaKindForUrls(additions, additions.some(isVideoMediaItem) ? 'video' : 'image'), null, {skipShift:Boolean(ctx?.nodeId)});
    S().render();
    return additions;
}
function cascadeRefsFromOutputs(outputs, targetNode){
    return (outputs || []).filter(img => img?.url).map((img, index) => ({
        url:img.url,
        name:img.name || `图${index + 1}`,
        kind:img.kind || 'image',
        role:`image_${index + 1}`,
        nodeId:targetNode?.id || '',
        imageIndex:targetNode ? (targetNode.images || []).length - outputs.length + index : index
    }));
}
function smartCascadeStopText(stopping=false){
    return stopping ? '停止中...' : '停止运行';
}
function smartCascadeAbortError(){
    const err = new Error('Cascade stopped');
    err.smartCascadeStopped = true;
    return err;
}
function throwIfSmartCascadeStopRequested(runState=null){
    if(runState?.stopRequested || (!runState && S().smartCascadeStopRequested)) throw smartCascadeAbortError();
}
function requestSmartCascadeStop(loopId=''){
    const runState = loopId ? smartCascadeRunForLoop(loopId) : (S().smartCascadeRuns.get(S().smartCascadeActiveLoopId) || [...S().smartCascadeRuns.values()][0] || null);
    if(runState){
        if(runState.stopRequested) return;
        runState.stopRequested = true;
        syncSmartCascadeLegacyState(runState.runKey || runState.loopId || loopId);
    } else {
        if(!S().smartCascadeRunning || S().smartCascadeStopRequested) return;
        S().smartCascadeStopRequested = true;
    }
    S().toast('Stop requested. Current task will finish first.');
    S().render();
}
function smartCascadeParallelLimit(chain=[]){
    const hasComfy = (chain || []).some(node => S().smartSettingsForNode(node)?.engine === 'comfy');
    return hasComfy ? Math.max(1, Math.min(6, Number(S().comfyInstanceCount) || 1)) : 6;
}
async function runSmartCascadeRoundsWithLimit(roundIndexes, limit, runner, runState=null){
    let next = 0;
    const workerCount = Math.max(1, Math.min(Number(limit) || 1, roundIndexes.length));
    const workers = Array.from({length:workerCount}, async () => {
        while(next < roundIndexes.length){
            if(runState?.stopRequested || (!runState && S().smartCascadeStopRequested)) break;
            const roundOffset = next++;
            const current = roundIndexes[roundOffset];
            try {
                await runner(current, roundOffset);
            } catch(e) {
                if(e?.smartCascadeStopped) break;
                throw e;
            }
        }
    });
    await Promise.all(workers);
}
async function runSmartCascade(targetNode=null){
    const tail = targetNode || S().selectedNode();
    if(!canRunSmartCascade(tail)){ S().toast('Select the end image node of a chain'); return; }
    S().savePromptDraftForCurrent();
    const graph = smartCascadeGraphForTail(tail);
    const chain = graph.path;
    const loop = resolveSmartCascadeLoop(tail.id);
    const loopId = loop?.node?.id || '';
    if(loopId && smartCascadeIsLoopRunning(loopId)){ requestSmartCascadeStop(loopId); return; }
    if(!loopId && smartCascadeAnyRunning()){ requestSmartCascadeStop(); return; }
    const directLoopTargetRun = Boolean(loop && isDirectLoopTargetRun(loop, tail, graph));
    const singleNodeLoopRun = Boolean(loop && (chain.length === 1 || directLoopTargetRun));
    if(!graph.edges.length && !singleNodeLoopRun){ S().toast(S().tr('smart.loopNoChain')); return; }
    const originalSelected = S().selectedId;
    const originalSettings = S().cloneSmartSettings(S().settings);
    const originalPromptHtml = S().promptInput.innerHTML;
    const runKey = loopId || `cascade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runState = {runKey, loopId, stopRequested:false, runPath:null};
    S().smartCascadeRuns.set(runKey, runState);
    syncSmartCascadeLegacyState(runKey);
    S().smartCascadeSilentSelection = true;
    S().runBtn.disabled = true;
    S().cascadeRunBtn.disabled = false;
    S().pushUndo();
    const totalRounds = loop?.count || 1;
    const startIndex = Math.max(1, Number(loop?.node?.loopStart) || 1);
    const batchSize = loop?.node?.imageInput ? Math.max(1, Math.min(100, Number(loop.node.imageBatchSize) || 1)) : 1;
    const endIndex = startIndex + (totalRounds - 1) * batchSize;
    const loopMode = loop?.mode === 'parallel' ? 'parallel' : 'serial';
    const parallelLimit = loopMode === 'parallel' && totalRounds > 1 ? smartCascadeParallelLimit(chain) : 1;
    const precreateSingleSlots = singleNodeLoopRun && loopMode === 'parallel' && totalRounds > 1 && parallelLimit > 1;
    let singleLoopSlots = [];
    if(singleNodeLoopRun){
        runState.runPath = {states:{}};
        S().smartCascadeRunPath = runState.runPath;
    }
    if(singleNodeLoopRun){
        singleLoopSlots = Array.from({length:totalRounds}, (_, round) => {
            const loopIndex = startIndex + round * batchSize;
            const slot = loopOutputSlotForRound(tail, loop.node, loopIndex, round);
            return slot ? tagLoopOutputSlot(slot, tail, loop.node, loopIndex, round) : null;
        });
        singleLoopSlots.filter(Boolean).forEach(slot => { runState.runPath.states[`${tail.id}->${slot.id}`] = 'wait'; });
        if(precreateSingleSlots){
            for(let slotOffset = 0; slotOffset < totalRounds; slotOffset++){
                if(singleLoopSlots[slotOffset]) continue;
                const loopIndex = startIndex + slotOffset * batchSize;
                singleLoopSlots[slotOffset] = createLoopOutputSlot(tail, loopIndex, slotOffset, {queued:true, loopNode:loop.node, slotIndex:slotOffset, runState});
            }
        }
        S().render();
    }
    if(!singleNodeLoopRun){
        const runStates = {};
        if(loop?.node?.id && graph.root?.id) runStates[`${loop.node.id}->${graph.root.id}`] = 'wait';
        graph.edges.forEach(edge => { runStates[edge.key] = 'wait'; });
        runState.runPath = {states:runStates};
        S().smartCascadeRunPath = runState.runPath;
        S().refreshConnectionLayer();
        S().updateComposer();
    }
    try {
        const runRound = async (loopIndex=startIndex, options={}) => {
            throwIfSmartCascadeStopRequested(runState);
            const ctx = loop ? {index:loopIndex, total:endIndex, nodeId:loop.node.id, forceWorkflow:chain.length > 1 && !singleNodeLoopRun, runState} : {runState};
            if(parallelLimit === 1) S().smartLoopContext = ctx;
            if(singleNodeLoopRun){
                const refs = refsForDirectLoopRound(loop.node, loopIndex, endIndex);
                if(directLoopTargetRun && parallelLimit === 1) showDirectLoopRoundPreview(loop.node, tail, refs, loopIndex, endIndex);
                const slotIndex = Math.max(0, Math.floor((loopIndex - startIndex) / batchSize));
                const outputTarget = tagLoopOutputSlot(
                    options.outputTarget || singleLoopSlots[slotIndex] || loopOutputSlotForRound(tail, loop.node, loopIndex, slotIndex) || createLoopOutputSlot(tail, loopIndex, slotIndex, {loopNode:loop.node, slotIndex, runState}),
                    tail,
                    loop.node,
                    loopIndex,
                    slotIndex
                );
                singleLoopSlots[slotIndex] = outputTarget;
                await runLoopRoundIntoSlot(loop.node, tail, outputTarget, loopIndex, ctx);
                return;
            }
            const producedRefs = new Map();
            const runBranch = async (source, incomingRefs=[]) => {
                throwIfSmartCascadeStopRequested(runState);
                let targets = graph.children.get(source.id) || [];
                const loopPrompts = S().isSmartImageNode(source) ? S().upstreamLoopPromptNodesFor(source) : [];
                const sourceLoopPrompts = S().isSmartImageNode(source) ? relayLoopPromptNodesForTarget(source) : [];
                if(runState.runPath && sourceLoopPrompts.length && source?.id){
                    sourceLoopPrompts.forEach(loopNode => {
                        runState.runPath.states[`${loopNode.id}->${source.id}`] = 'done';
                    });
                    S().refreshConnectionLayer();
                }
                if(loopPrompts.length && targets.length > 1){
                    const firstLoop = loopPrompts[0];
                    const startBase = Math.max(1, Number(firstLoop.loopStart) || 1);
                    const currentIndex = Math.max(1, Number(ctx?.index || startBase) || startBase);
                    const selectedTarget = targets[(currentIndex - 1) % targets.length];
                    if(runState.runPath && firstLoop?.id && source?.id){
                        runState.runPath.states[`${firstLoop.id}->${source.id}`] = 'done';
                        S().refreshConnectionLayer();
                    }
                    targets = [selectedTarget].filter(Boolean);
                }
                let sharedRefs = incomingRefs;
                for(let index = 0; index < targets.length; index++){
                    throwIfSmartCascadeStopRequested(runState);
                    const target = targets[index];
                    const edgeKey = `${source.id}->${target.id}`;
                    let outputs = [];
                    const relayLoops = S().isSmartImageNode(source) && S().isSmartImageNode(target)
                        ? relayLoopPromptNodesForEdge(source, target)
                        : [];
                    const stepCtx = relayLoops.length && S().isSmartImageNode(target)
                        ? {...(ctx || {}), relayPromptNodeIds:[...new Set([...(ctx?.relayPromptNodeIds || []), ...relayLoops.map(n => n.id)])]}
                        : ctx;
                    try {
                        if(runState.runPath && relayLoops.length && source?.id && S().isSmartImageNode(target)){
                            relayLoops.forEach(loopNode => {
                                runState.runPath.states[`${loopNode.id}->${source.id}`] = 'done';
                            });
                            S().refreshConnectionLayer();
                        }
                        if(runState.runPath){
                            runState.runPath.states[edgeKey] = 'active';
                            S().refreshConnectionLayer();
                        }
                        if(target.type === 'smart-loop'){
                            outputs = S().outputImagesForNode(source, true, ctx).filter(img => img?.url);
                            sharedRefs = cascadeRefsFromOutputs(outputs, source);
                        } else if(index === 0){
                            outputs = await runCascadeStepIntoNode(source, target, incomingRefs, stepCtx);
                            sharedRefs = cascadeRefsFromOutputs(outputs, target);
                        } else {
                            outputs = appendCascadeRefsToReceiver(target, sharedRefs, stepCtx);
                        }
                    } catch(err) {
                        if(/缺少提示词|需要输入文本|need prompt/i.test(err.message || '') && incomingRefs.length){
                            outputs = appendCascadeRefsToReceiver(target, incomingRefs, stepCtx);
                            if(index === 0){
                                sharedRefs = cascadeRefsFromOutputs(outputs, target);
                            }
                        } else {
                            throw err;
                        }
                    }
                    if(runState.runPath){
                        runState.runPath.states[edgeKey] = 'done';
                        S().refreshConnectionLayer();
                    }
                    const refs = target.type === 'smart-loop' ? sharedRefs : (index === 0 ? sharedRefs : cascadeRefsFromOutputs(outputs, target));
                    producedRefs.set(target.id, refs);
                    throwIfSmartCascadeStopRequested(runState);
                    await runBranch(target, refs);
                }
            };
            const rootRefs = S().defaultReferenceImagesFor(graph.root, true, ctx).filter(img => img?.url);
            producedRefs.set(graph.root.id, rootRefs);
            await runBranch(graph.root, rootRefs);
        };
        const roundIndexes = Array.from({length:totalRounds}, (_, round) => startIndex + round * batchSize);
        if(loopMode === 'parallel' && totalRounds > 1){
            const parallelTargets = singleNodeLoopRun
                ? singleLoopSlots
                : [];
            if(parallelTargets.length) S().render();
            await runSmartCascadeRoundsWithLimit(roundIndexes, parallelLimit, (loopIndex, roundOffset) => {
                const outputTarget = parallelTargets[roundOffset] || null;
                return runRound(loopIndex, {outputTarget});
            }, runState);
        } else {
            for(const loopIndex of roundIndexes){
                throwIfSmartCascadeStopRequested(runState);
                await runRound(loopIndex);
            }
        }
        throwIfSmartCascadeStopRequested(runState);
        if(parallelLimit === 1) S().smartLoopContext = null;
        S().selectedId = '';
        S().selectedIds = [];
        S().selectedImage = {nodeId:'', index:-1};
        S().activeComposerSubject = null;
        S().lastComposerNodeId = '';
        S().composer.classList.remove('open');
        S().settings = originalSettings;
        S().promptInput.innerHTML = originalPromptHtml;
        S().scheduleSave();
        S().toast(totalRounds > 1
            ? S().trf(loopMode === 'parallel' ? 'smart.loopParallelRoundsDone' : 'smart.loopRunRoundsDone', {n:totalRounds})
            : S().tr('smart.loopRunDone'));
    } catch(e) {
        if(parallelLimit === 1) S().smartLoopContext = null;
        S().selectedId = originalSelected;
        S().settings = originalSettings;
        S().promptInput.innerHTML = originalPromptHtml;
        S().toast(e?.smartCascadeStopped ? 'Cascade stopped' : (e.message || S().tr('smart.errRunFailed')).slice(0, 160));
    } finally {
        S().smartCascadeRuns.delete(runKey);
        syncSmartCascadeLegacyState();
        S().smartCascadeSilentSelection = false;
        S().runBtn.disabled = smartCascadeAnyRunning();
        S().cascadeRunBtn.disabled = false;
        if(directLoopTargetRun) finishLoopTargetPreviewState(tail);
        S().scheduleSave();
        S().render();
    }
}
function runSmartCascadeFromLoop(loopId){
    const loop = nodes().find(n => n.id === loopId && n.type === 'smart-loop');
    if(!loop){ S().toast('娌℃湁鎵惧埌寰幆鑺傜偣'); return; }
    const tail = cascadeTailForLoop(loop.id);
    if(!tail){ S().toast('Connect the loop node to a downstream image chain'); return; }
    S().selectedId = tail.id;
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    runSmartCascade(tail);
}
    const api = Object.freeze({
        registerDeps,
        primaryImageInputFor,
        hasDownstreamImageNode,
        isGeneratedOutputForNode,
        downstreamWorkflowImageTargetsFor,
        hasDownstreamWorkflowImageNode,
        smartImageChainTo,
        upstreamNodesForId,
        resolveSmartCascadeLoop,
        relayLoopPromptNodesForEdge,
        relayLoopPromptNodesForTarget,
        downstreamNodesForId,
        downstreamImageTargetsFor,
        downstreamCascadeTargetsFor,
        directLoopRunTargets,
        smartCascadeGraphForTail,
        cascadeTailForLoop,
        canRunSmartCascade,
        isDirectLoopTargetRun,
        cascadeConnectionKeys,
        activeSmartCascadeCount,
        smartCascadeRunForLoop,
        smartCascadeIsLoopRunning,
        syncSmartCascadeLegacyState,
        smartCascadeAnyRunning,
        smartCascadeEdgeState,
        smartCascadePathForCtx,
        loopOutputSlotsForRoot,
        loopOutputSlotForRound,
        tagLoopOutputSlot,
        createLoopOutputSlot,
        finishLoopTargetPreviewState,
        refsForDirectLoopRound,
        showDirectLoopRoundPreview,
        syncCascadeRunButton,
        generateUrlsForCurrentSettings,
        generateComfyUrlsWithSettings,
        runCascadeStepIntoNode,
        runLoopRoundIntoSlot,
        appendCascadeRefsToReceiver,
        cascadeRefsFromOutputs,
        smartCascadeStopText,
        smartCascadeAbortError,
        throwIfSmartCascadeStopRequested,
        requestSmartCascadeStop,
        smartCascadeParallelLimit,
        runSmartCascadeRoundsWithLimit,
        runSmartCascade,
        runSmartCascadeFromLoop,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('cascade', api);
    }
    global.SmartCanvasCascade = api;
})(window);
