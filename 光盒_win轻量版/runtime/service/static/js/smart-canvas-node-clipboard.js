/**
 * Smart Canvas — copy/paste/alt-drag duplicate for nodes.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeClipboard] deps not registered');
        return c;
    }

function copySelectedNodes(nodeIds){
    if(!S().canvas) return false;
    const ids = Array.isArray(nodeIds) && nodeIds.length ? nodeIds : S().selectedNodeIds();
    const copiedNodes = ids.map(id => S().nodes.find(n => n.id === id)).filter(Boolean);
    if(!copiedNodes.length) return false;
    const idSet = new Set(copiedNodes.map(n => n.id));
    const copiedConnections = (S().canvas.connections || []).filter(c => idSet.has(c.from) && idSet.has(c.to));
    S().nodeClipboard = {
        nodes:JSON.parse(JSON.stringify(copiedNodes)),
        connections:JSON.parse(JSON.stringify(copiedConnections))
    };
    S().toast(`Copied ${copiedNodes.length} nodes`);
    return true;
}


function pasteNodes(){
    if(!S().canvas || !S().nodeClipboard?.nodes?.length) return false;
    S().lastNodePasteAt = Date.now();
    S().pushUndo();
    const sourceNodes = S().nodeClipboard.nodes;
    const xs = sourceNodes.map(n => Number(n.x) || 0);
    const ys = sourceNodes.map(n => Number(n.y) || 0);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const p = S().lastMouseWorld || S().viewportCenter();
    const dx = p.x - cx;
    const dy = p.y - cy;
    const idMap = new Map();
    const copies = sourceNodes.map(n => {
        const copy = S().cloneSmartNode(n, dx, dy);
        idMap.set(n.id, copy.id);
        return copy;
    });
    copies.forEach(copy => {
        if(Array.isArray(copy.inputNodeIds)){
            copy.inputNodeIds = copy.inputNodeIds.map(id => idMap.get(id)).filter(Boolean);
        }
        if(copy.sourceNodeId) copy.sourceNodeId = idMap.get(copy.sourceNodeId) || '';
    });
    const newConnections = (S().nodeClipboard.connections || []).map(conn => ({
        ...conn,
        from:idMap.get(conn.from),
        to:idMap.get(conn.to)
    })).filter(conn => conn.from && conn.to && conn.from !== conn.to);
    S().canvas.connections = [...(S().canvas.connections || []), ...newConnections];
    S().nodes.push(...copies);
    S().selectedId = copies.length === 1 ? copies[0].id : '';
    S().selectedIds = copies.length > 1 ? copies.map(n => n.id) : [];
    S().selectedImage = {nodeId:'', index:-1};
    S().render();
    S().scheduleSave();
    return true;
}


function duplicateForAltDrag(node){
    const ids = (S().isNodeSelected(node.id) ? S().selectedNodeIds() : [node.id]);
    const sourceNodes = ids.map(id => S().nodes.find(n => n.id === id)).filter(Boolean);
    if(!sourceNodes.length) return node;
    S().pushUndo();
    const idMap = new Map();
    const copies = sourceNodes.map(n => {
        const copy = S().cloneSmartNode(n, 0, 0);
        idMap.set(n.id, copy.id);
        return copy;
    });
    copies.forEach(copy => {
        if(Array.isArray(copy.inputNodeIds)) copy.inputNodeIds = copy.inputNodeIds.map(id => idMap.get(id)).filter(Boolean);
        if(copy.sourceNodeId) copy.sourceNodeId = idMap.get(copy.sourceNodeId) || '';
    });
    const idSet = new Set(sourceNodes.map(n => n.id));
    const copiedConnections = (S().canvas.connections || []).filter(c => idSet.has(c.from) && idSet.has(c.to));
    const newConnections = copiedConnections.map(conn => ({...conn, from:idMap.get(conn.from), to:idMap.get(conn.to)})).filter(conn => conn.from && conn.to && conn.from !== conn.to);
    S().canvas.connections = [...(S().canvas.connections || []), ...newConnections];
    S().nodes.push(...copies);
    S().selectedId = '';
    S().selectedIds = [];
    S().selectedImage = {nodeId:'', index:-1};
    const dragCopy = copies.find(c => c.id === idMap.get(node.id)) || copies[0];
    S().render();
    S().scheduleSave();
    return dragCopy;
}


    const api = Object.freeze({
        registerDeps,
        copySelectedNodes,
        pasteNodes,
        duplicateForAltDrag
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeClipboard', api);
    global.SmartCanvasNodeClipboard = api;
})(window);
