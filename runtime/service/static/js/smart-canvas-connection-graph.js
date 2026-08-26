/**
 * Smart Canvas — node connection graph (add/connect, upstream/downstream queries, line topology).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasConnectionGraph] deps not registered');
        return c;
    }

    function nodeList(){
        return S().getNodes();
    }

    function canvasState(){
        return S().getCanvas();
    }

function addConnection(fromId, toId, kind='flow'){
    if(!fromId || !toId || fromId === toId) return;
    const c = canvasState();
    if(!c) return;
    c.connections = c.connections || [];
    if(c.connections.some(conn => conn.from === fromId && conn.to === toId && (conn.kind || 'flow') === kind)) return;
    c.connections.push({from:fromId, to:toId, kind});
    if(kind === 'input'){
        const target = nodeList().find(node => node.id === toId);
        S().syncUpstreamTextIntoDraft?.(target);
    }
}

function connectInputNode(fromId, toId){
    const from = nodeList().find(n => n.id === fromId);
    const to = nodeList().find(n => n.id === toId);
    if(!from || !to || from.id === to.id) return false;
    if(to.type === 'smart-loop'){
        const looksImage = S().isSmartImageNode(from) || (from.type === 'smart-loop' && from.imageInput);
        const looksPrompt = from.type === 'smart-prompt' || (from.type === 'smart-loop' && from.showPrompt);
        if(looksImage && !to.imageInput) to.imageInput = true;
        if(looksPrompt && !to.showPrompt) to.showPrompt = true;
        if(looksImage || looksPrompt) S().fitSmartLoopNode(to);
        const canImage = Boolean(to.imageInput) && looksImage;
        const canPrompt = Boolean(to.showPrompt) && looksPrompt;
        if(!canImage && !canPrompt) return false;
    }
    to.inputNodeIds = Array.from(new Set([...(to.inputNodeIds || []), from.id]));
    addConnection(from.id, to.id, 'input');
    return true;
}

function upstreamNodesForKinds(node, kinds=['input']){
    if(!node) return [];
    const allowed = new Set(kinds);
    const ids = new Set(allowed.has('input') ? (node.inputNodeIds || []) : []);
    (canvasState()?.connections || []).forEach(conn => {
        if(conn.to === node.id && allowed.has(conn.kind || 'flow')) ids.add(conn.from);
    });
    return [...ids].map(id => nodeList().find(n => n.id === id)).filter(Boolean);
}

function inputNodesFor(node){
    return upstreamNodesForKinds(node, ['input']);
}

function workflowInputNodesFor(node){
    return upstreamNodesForKinds(node, ['input', 'flow']);
}

function connectionMidpoint(conn){
    const fromNode = nodeList().find(n => n.id === conn?.from);
    const toNode = nodeList().find(n => n.id === conn?.to);
    if(!fromNode || !toNode) return null;
    const fr = S().nodeRect(fromNode), tr = S().nodeRect(toNode);
    if((conn.kind || 'flow') === 'history'){
        return {x:(fr.x + fr.width / 2 + tr.x + tr.width / 2) / 2, y:(fr.y + fr.height + tr.y) / 2};
    }
    return {x:(fr.x + fr.width + tr.x) / 2, y:(fr.y + fr.height / 2 + tr.y + tr.height / 2) / 2};
}

function insertionConnectionForNode(node){
    if(!node || node.type !== 'smart-loop' || !canvasState()?.connections?.length) return null;
    const r = S().nodeRect(node);
    const cx = (Number(r.x) || 0) + (Number(r.width) || 0) / 2;
    const cy = (Number(r.y) || 0) + (Number(r.height) || 0) / 2;
    let best = null;
    (canvasState().connections || []).forEach((conn, index) => {
        const kind = conn.kind || 'flow';
        if(!['input','flow'].includes(kind)) return;
        if(conn.from === node.id || conn.to === node.id) return;
        const fromNode = nodeList().find(n => n.id === conn.from);
        const toNode = nodeList().find(n => n.id === conn.to);
        if(!fromNode || !toNode || S().isHistoryGroupNode(fromNode) || S().isHistoryGroupNode(toNode)) return;
        const mid = connectionMidpoint(conn);
        if(!mid) return;
        const score = Math.hypot(cx - mid.x, cy - mid.y);
        if(score > 96) return;
        if(!best || score < best.score) best = {conn, index, score};
    });
    return best;
}

function insertLoopNodeIntoConnection(loopNode, hit){
    if(!loopNode || loopNode.type !== 'smart-loop' || !hit?.conn) return false;
    const conn = hit.conn;
    const kind = conn.kind || 'flow';
    const c = canvasState();
    if(!c) return false;
    c.connections = (c.connections || []).filter((item, index) => index !== hit.index);
    nodeList().forEach(n => {
        if(Array.isArray(n.inputNodeIds)) n.inputNodeIds = n.inputNodeIds.filter(id => !(n.id === conn.to && id === conn.from));
    });
    addConnection(conn.from, loopNode.id, kind === 'flow' ? 'flow' : 'input');
    connectInputNode(loopNode.id, conn.to);
    return true;
}

function updateLoopInsertPreview(){
    const node = S().dragState ? nodeList().find(n => n.id === S().dragState.id) : null;
    const next = node?.type === 'smart-loop' && S().dragState.ctrlGroup && (S().dragState.group || []).length <= 1
        ? insertionConnectionForNode(node)
        : null;
    const nextPreview = next ? {index:next.index} : null;
    const changed = (S().loopInsertPreview?.index ?? -1) !== (nextPreview?.index ?? -1);
    S().loopInsertPreview = nextPreview;
    if(changed) S().refreshConnectionLayer();
    return next;
}

function lineConnectionsFor(node){
    if(!node) return [];
    return (canvasState()?.connections || []).filter(conn => {
        if(!conn?.from || !conn?.to || conn.from === conn.to) return false;
        return ['input', 'flow'].includes(conn.kind || 'flow');
    });
}

function connectedLineNodeIds(node){
    if(!node) return [];
    const conns = lineConnectionsFor(node);
    const upstream = [];
    const downstream = [];
    const seenUp = new Set([node.id]);
    const seenDown = new Set([node.id]);
    const walkUp = id => {
        conns.filter(conn => conn.to === id).forEach(conn => {
            if(seenUp.has(conn.from)) return;
            seenUp.add(conn.from);
            walkUp(conn.from);
            upstream.push(conn.from);
        });
    };
    const walkDown = id => {
        conns.filter(conn => conn.from === id).forEach(conn => {
            if(seenDown.has(conn.to)) return;
            seenDown.add(conn.to);
            downstream.push(conn.to);
            walkDown(conn.to);
        });
    };
    walkUp(node.id);
    walkDown(node.id);
    return [...upstream, node.id, ...downstream];
}

function upstreamLineNodeIds(node){
    if(!node) return [];
    const conns = lineConnectionsFor(node);
    const upstream = [];
    const seen = new Set([node.id]);
    const walk = id => {
        conns.filter(conn => conn.to === id).forEach(conn => {
            if(seen.has(conn.from)) return;
            seen.add(conn.from);
            walk(conn.from);
            upstream.push(conn.from);
        });
    };
    walk(node.id);
    return [...upstream, node.id];
}

function lineImagesFor(node){
    const ids = upstreamLineNodeIds(node);
    return ids.flatMap(id => {
        const source = nodeList().find(n => n.id === id);
        return S().imagesForNode(source);
    }).filter(img => img?.url);
}

function upstreamLineReferenceImagesFor(node, consume=false, ctx=null){
    if(!node) return [];
    const loopCtx = ctx ?? S().smartLoopContext;
    return S().uniqueReferenceImages(
        upstreamNodesForKinds(node, ['input','flow'])
            .flatMap(input => S().outputImagesForNode(input, consume, loopCtx))
            .filter(img => img?.url)
    );
}

function outgoingConnectionsFor(node, kinds=['input']){
    if(!node) return [];
    const allowed = new Set(kinds);
    return (canvasState()?.connections || []).filter(conn => conn.from === node.id && allowed.has(conn.kind || 'flow'));
}

function outgoingInputConnectionsFor(node){
    return outgoingConnectionsFor(node, ['input']);
}

function incomingLineConnectionsFor(node, kinds=['input','flow']){
    if(!node?.id) return [];
    const allowed = new Set(kinds);
    return (canvasState()?.connections || []).filter(conn => conn.to === node.id && allowed.has(conn.kind || 'flow'));
}

function nodeHasIncomingSourceLine(node){
    return incomingLineConnectionsFor(node, ['input','flow']).length > 0;
}

function upstreamLoopPromptNodesFor(node){
    return S().promptInputNodesFor(node).filter(input => input?.type === 'smart-loop' && input.showPrompt);
}

function directImageInputsFor(node){
    const upstream = S().smartImageUsesWorkflowInput(node) ? workflowInputNodesFor(node) : inputNodesFor(node);
    return upstream
        .filter(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n) && (n.images || []).some(img => img?.url))
        .sort((a, b) => {
            const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
            if(ax !== bx) return bx - ax;
            return (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}

function directImageInputsForKinds(node, kinds=['input']){
    const upstream = upstreamNodesForKinds(node, kinds);
    return upstream
        .filter(n => S().isSmartImageNode(n) && !S().isHistoryGroupNode(n) && (n.images || []).some(img => img?.url))
        .sort((a, b) => {
            const ax = Number(a.x) || 0, bx = Number(b.x) || 0;
            if(ax !== bx) return bx - ax;
            return (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}

function disconnectConnection(index){
    if(!canvasState() || !Array.isArray(canvasState().connections)) return;
    const conn = canvasState().connections[index];
    if(!conn) return;
    S().pushUndo();
    canvasState().connections.splice(index, 1);
    const toNode = nodeList().find(n => n.id === conn.to);
    if(toNode && Array.isArray(toNode.inputNodeIds)){
        toNode.inputNodeIds = toNode.inputNodeIds.filter(id => id !== conn.from);
    }
    if((conn.kind || 'flow') === 'history'){
        const group = nodeList().find(n => n.id === conn.to && S().isHistoryGroupNode(n) && n.historyFor === conn.from);
        S().demoteHistoryGroupNode(group);
    }
    S().render();
    S().scheduleSave();
}

function disconnectConnections(spec){
 if(!canvasState() || !Array.isArray(canvasState().connections)) return;
 const indices = (Array.isArray(spec) ? spec : String(spec).split(','))
 .map(v => Number(v))
 .filter(n => Number.isInteger(n) && n >= 0 && n < canvasState().connections.length);
 if(!indices.length) return;
 const set = new Set(indices);
 const removed = canvasState().connections.filter((_, i) => set.has(i));
 if(!removed.length) return;
 S().pushUndo();
 canvasState().connections = canvasState().connections.filter((_, i) => !set.has(i));
 removed.forEach(conn => {
 const toNode = nodeList().find(n => n.id === conn.to);
 if(toNode && Array.isArray(toNode.inputNodeIds)){
 toNode.inputNodeIds = toNode.inputNodeIds.filter(id => id !== conn.from);
 }
 if(toNode && ['input','flow'].includes(conn.kind || 'flow')) S().clearDetachedRunInputRefs(toNode);
 if((conn.kind || 'flow') === 'history'){
 const group = nodeList().find(n => n.id === conn.to && S().isHistoryGroupNode(n) && n.historyFor === conn.from);
 S().demoteHistoryGroupNode(group);
 }
 });
 S().render();
 S().scheduleSave();
}


    function cleanupDetachedRunInputRefs(){
 if(!S().canvasUsesConnections) return false;
 let changed = false;
 S().getNodes().forEach(node => {
 const hadRefs = Array.isArray(node?.runInputRefs) && node.runInputRefs.length;
 const hadPromptRefs = Array.isArray(node?.runPromptRefs) && node.runPromptRefs.length;
 const hadSource = Boolean(node?.sourceNodeId);
 clearDetachedRunInputRefs(node);
 if(hadRefs !== (Array.isArray(node?.runInputRefs) && node.runInputRefs.length)
 || hadPromptRefs !== (Array.isArray(node?.runPromptRefs) && node.runPromptRefs.length)
 || hadSource !== Boolean(node?.sourceNodeId)){
 changed = true;
 }
 });
 return changed;
}
    function clearDetachedRunInputRefs(node){
 if(!node) return;
 const hasUpstream = Boolean((S().canvas?.connections || []).some(conn => conn.to === node.id && ['input','flow'].includes(conn.kind || 'flow')));
 if(hasUpstream || (!S().canvasUsesConnections && Array.isArray(node.inputNodeIds) && node.inputNodeIds.some(id => S().getNodes().some(n => n.id === id)))) return;
 delete node.runInputRefs;
 delete node.runPromptRefs;
 delete node.sourceNodeId;
}
    const api = Object.freeze({
        clearDetachedRunInputRefs,
        cleanupDetachedRunInputRefs,
        registerDeps,
        addConnection,
        connectInputNode,
        upstreamNodesForKinds,
        inputNodesFor,
        workflowInputNodesFor,
        connectionMidpoint,
        insertionConnectionForNode,
        insertLoopNodeIntoConnection,
        updateLoopInsertPreview,
        lineConnectionsFor,
        connectedLineNodeIds,
        upstreamLineNodeIds,
        lineImagesFor,
        upstreamLineReferenceImagesFor,
        outgoingConnectionsFor,
        outgoingInputConnectionsFor,
        incomingLineConnectionsFor,
        nodeHasIncomingSourceLine,
        upstreamLoopPromptNodesFor,
        directImageInputsFor,
        directImageInputsForKinds,
        disconnectConnection,
        disconnectConnections
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('connectionGraph', api);
    }
    global.SmartCanvasConnectionGraph = api;
})(window);
