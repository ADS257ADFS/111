/**
 * Smart Canvas — multi-client node merge and busy-state normalization.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeMerge] deps not registered');
        return c;
    }
    function nodes(){ return S().getNodes(); }

function smartNodeHasDisplayResult(node){ 
 return Boolean((node?.images || []).some(img => img?.url && !img.loopInputPreview)); 
}
function smartNodeHasCompletedResult(node){ 
 if(!smartNodeHasDisplayResult(node)) return false; 
 if(node?.runFinishedAt) return true; 
 return !node?.jimengPending && !S().smartPendingTasks(node).length && !Number(node?.pending || 0) && !node?.queued; 
}
function smartNodeInFlight(node){ 
 if(smartNodeHasCompletedResult(node)) return false; 
 return Boolean(node && (node.running || node.pending || node.queued || node.jimengPending || S().smartPendingTasks(node).length)); 
}
function clearSmartNodeBusyState(node){ 
 if(!node) return node; 
 S().smartNodeRunTokens.delete(node.id); 
 node.running = false; 
 node.pending = 0; 
 node.queued = false; 
 delete node.jimengPending; 
 delete node.pendingTasks; 
 return node; 
}
function markSmartNodeComplete(node, meta=null){ 
 if(!node) return node; 
 const keepHidden = node.runTimerHidden === true; 
 clearSmartNodeBusyState(node); 
 node.runFinishedAt = Number(node.runFinishedAt || 0) || S().nowMs(); 
 if(!node.runStartedAt) node.runStartedAt = meta?.createdAt || node.runFinishedAt; 
 node.runElapsedMs = Math.max(0, Number(node.runFinishedAt || S().nowMs()) - Number(node.runStartedAt || node.runFinishedAt || S().nowMs())); 
 node.runTimerHidden = meta?.hideTimer === true || keepHidden; 
 return node; 
}
function completeSmartNodeWithImages(node, images){ 
 const copy = {...node, images}; 
 if(smartNodeHasDisplayResult(copy)) markSmartNodeComplete(copy); 
 return copy; 
}
function completedDownstreamOutputForNode(sourceNode){ 
 if(!sourceNode?.id) return null; 
 const startedAt = Number(sourceNode.runStartedAt || 0); 
 return S().downstreamImageTargetsFor(sourceNode).find(target => { 
 if(!smartNodeHasCompletedResult(target)) return false; 
 if(target.sourceNodeId && target.sourceNodeId !== sourceNode.id) return false; 
 const finishedAt = Number(target.runFinishedAt || 0); 
 return !startedAt || !finishedAt || finishedAt >= startedAt; 
 }) || null; 
}
function clearSourceBusyStateIfDownstreamDone(sourceNode, options={}){ 
 if(!sourceNode || !smartNodeInFlight(sourceNode)) return false; 
 if(sourceNode.jimengPending || S().smartPendingTasks(sourceNode).length) return false; 
 if(!completedDownstreamOutputForNode(sourceNode)) return false; 
 clearSmartNodeBusyState(sourceNode); 
 if(!sourceNode.runFinishedAt){ 
 sourceNode.runFinishedAt = S().nowMs(); 
 if(!sourceNode.runStartedAt) sourceNode.runStartedAt = sourceNode.runFinishedAt; 
 sourceNode.runElapsedMs = Math.max(0, sourceNode.runFinishedAt - Number(sourceNode.runStartedAt || sourceNode.runFinishedAt)); 
 sourceNode.runTimerHidden = options.hideTimer === true || sourceNode.runTimerHidden === true; 
 } 
 return true; 
}
function clearCompletedSourceBusyStates(){ 
 let changed = false; 
 (nodes() || []).forEach(node => { 
 if(clearSourceBusyStateIfDownstreamDone(node)) changed = true; 
 }); 
 return changed; 
}
function clearCompletedNodeBusyStates(){ 
 let changed = false; 
 (nodes() || []).forEach(node => { 
 if(!node || !smartNodeHasCompletedResult(node) || !smartNodeInFlight(node)) return; 
 markSmartNodeComplete(node); 
 changed = true; 
 }); 
 if(clearCompletedSourceBusyStates()) changed = true; 
 return changed; 
}
function mergeSmartConnections(localConns, remoteConns, nodeIds){ 
 const out = []; 
 const seen = new Set(); 
 [...(localConns || []), ...(remoteConns || [])].forEach(c => { 
 if(!c || !nodeIds.has(c.from) || !nodeIds.has(c.to)) return; 
 const key = `${c.from}->${c.to}:${c.kind || 'flow'}`; 
 if(seen.has(key)) return; 
 seen.add(key); 
 out.push(c); 
 }); 
 return out; 
}
function mergeSmartImageLists(localImgs, remoteImgs){ 
 const out = []; 
 const seen = new Set(); 
 (localImgs || []).forEach(img => { 
 const u = img && img.url; 
 if(u && seen.has(u)) return; 
 if(u) seen.add(u); 
 out.push(img); 
 }); 
 (remoteImgs || []).forEach(img => { 
 const u = img && img.url; 
 if(!u || seen.has(u)) return; 
 seen.add(u); 
 out.push(img); 
 }); 
 return out; 
}
function mergeSmartNode(local, remote){ 
 const images = mergeSmartImageLists(local.images, remote.images); 
 const localDone = smartNodeHasCompletedResult(local); 
 const remoteDone = smartNodeHasCompletedResult(remote); 
 const localBusy = smartNodeInFlight(local); 
 const remoteBusy = smartNodeInFlight(remote); 
 if(localDone && remoteBusy && !remoteDone) return completeSmartNodeWithImages(local, images); 
 if(remoteDone && localBusy && !localDone) return completeSmartNodeWithImages(remote, images); 
 if(localDone && remoteDone){ 
 const localFinished = Number(local.runFinishedAt || 0); 
 const remoteFinished = Number(remote.runFinishedAt || 0); 
 return completeSmartNodeWithImages(remoteFinished >= localFinished ? remote : local, images); 
 } 
 // 本地正在生成/排队的节点完全以本地为准，只把对方可能多出来的图并进来，绝不被对方旧状态冲掉 
 if(smartNodeInFlight(local)){ 
 return {...local, images}; 
 } 
 // 否则以对方（最新保存方）的布局/标题/设置为基底，但图片取并集——双方生成结果都不丢 
 const merged = {...remote, images}; 
 return smartNodeHasDisplayResult(merged) && (merged.pending || merged.queued || S().smartPendingTasks(merged).length) 
 ? completeSmartNodeWithImages(merged, images) 
 : merged; 
}
function mergeSmartNodeLists(localNodes, remoteNodes){ 
 const localById = new Map((localNodes || []).map(n => [n.id, n])); 
 const remoteById = new Map((remoteNodes || []).map(n => [n.id, n])); 
 const order = []; 
 const seen = new Set(); 
 (localNodes || []).forEach(n => { if(!seen.has(n.id)){ seen.add(n.id); order.push(n.id); } }); 
 (remoteNodes || []).forEach(n => { if(!seen.has(n.id)){ seen.add(n.id); order.push(n.id); } }); 
 return order.map(id => { 
 const local = localById.get(id); 
 const remote = remoteById.get(id); 
 if(local && !remote) return local; // 仅本地存在：保留（我新建的节点；对方删了也宁可复活也不丢结果） 
 if(remote && !local) return remote; // 仅对方存在：加入对方新建的节点 
 return mergeSmartNode(local, remote); 
 }).filter(Boolean); 
}

function usedCanvasOutputUrls(){ 
 const used = new Set(); 
 (nodes() || []).forEach(node => (node.images || []).forEach(img => { 
 if(img?.url && !img.loopInputPreview) used.add(img.url); 
 })); 
 return used; 
}

function recoverStuckLoopOutputsFromLogs(){ 
 const used = usedCanvasOutputUrls(); 
 let changed = false; 
 const slots = (nodes() || []) 
 .filter(node => node && S().isSmartImageNode(node) && !S().isHistoryGroupNode(node)) 
 .filter(node => (node.loopSourceId || node.loopRootId || Number.isFinite(Number(node.loopSlotIndex))) && !smartNodeHasDisplayResult(node)) 
 .filter(node => (node.pending || node.running || node.queued) && !S().smartPendingTasks(node).length) 
 .sort((a, b) => (Number(a.loopSlotIndex || 0) - Number(b.loopSlotIndex || 0)) || (Number(a.y || 0) - Number(b.y || 0))); 
 slots.forEach(slot => { 
 const sourceId = slot.loopRootId || slot.sourceNodeId || ''; 
 const output = S().successfulRecentComfyLogOutputs(sourceId).find(item => !used.has(item.url)); 
 if(!output) return; 
 const kind = S().mediaKindForUrls([output.url], 'image'); 
 const ext = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : kind === 'text' ? 'txt' : 'png'; 
 slot.images = [S().stripImageGenerationMeta({url:output.url, name:`comfy-recovered-${Number(slot.loopSlotIndex || 0) + 1}.${ext}`, kind, generatedResult:true})]; 
 markSmartNodeComplete(slot); 
 if(kind) slot.outputKind = kind; 
 slot.title = slot.title || 'Image'; 
 slot.scale = S().mediaNodeDefaultScale(slot); 
 delete slot.w; 
 delete slot.h; 
 used.add(output.url); 
 changed = true; 
 clearSourceBusyStateIfDownstreamDone(nodes().find(n => n.id === sourceId)); 
 }); 
 return changed; 
}

    const api = Object.freeze({ registerDeps, smartNodeHasDisplayResult,
        smartNodeHasCompletedResult,
        smartNodeInFlight,
        clearSmartNodeBusyState,
        markSmartNodeComplete,
        completeSmartNodeWithImages,
        completedDownstreamOutputForNode,
        clearSourceBusyStateIfDownstreamDone,
        clearCompletedSourceBusyStates,
        clearCompletedNodeBusyStates,
        mergeSmartConnections,
        mergeSmartImageLists,
        mergeSmartNode,
        mergeSmartNodeLists,
        usedCanvasOutputUrls,
        recoverStuckLoopOutputsFromLogs });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeMerge', api);
    global.SmartCanvasNodeMerge = api;
})(window);
