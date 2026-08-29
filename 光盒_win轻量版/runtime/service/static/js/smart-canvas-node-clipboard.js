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

    function cloneNodePayload(node){
        if(typeof S().serializableSmartNode === 'function'){
            return S().serializableSmartNode(node);
        }
        return JSON.parse(JSON.stringify(node || {}));
    }

function copySelectedNodes(nodeIds){
    if(!S().canvas) return false;
    const ids = Array.isArray(nodeIds) && nodeIds.length ? nodeIds : (S().selectedNodeIds?.() || []);
    const copiedNodes = ids.map(id => S().nodes.find(n => n.id === id)).filter(Boolean);
    if(!copiedNodes.length){
        S().toast?.(S().tr?.('smart.toastNothingToCopy') || '请先选中要复制的对象');
        return false;
    }
    try {
        const idSet = new Set(copiedNodes.map(n => n.id));
        const copiedConnections = (S().canvas.connections || []).filter(c => idSet.has(c.from) && idSet.has(c.to));
        S().nodeClipboard = {
            nodes: copiedNodes.map(cloneNodePayload),
            connections: JSON.parse(JSON.stringify(copiedConnections))
        };
        const count = copiedNodes.length;
        S().toast?.(count === 1 ? (S().tr?.('smart.toastCopiedOne') || '已复制 1 个对象') : (S().trf?.('smart.toastCopiedMany', {count}) || `已复制 ${count} 个对象`));
        return true;
    } catch(err) {
        console.error('[SmartCanvasNodeClipboard] copy failed', err);
        S().toast?.(S().tr?.('smart.toastCopyFailed') || '复制失败');
        return false;
    }
}


function pasteNodes(){
    if(!S().canvas || !S().nodeClipboard?.nodes?.length){
        S().toast?.(S().tr?.('smart.toastNothingToPaste') || '剪贴板为空，请先复制');
        return false;
    }
    S().lastNodePasteAt = Date.now();
    S().pushUndo();
    const sourceNodes = S().nodeClipboard.nodes;
    const xs = sourceNodes.map(n => Number(n.x) || 0);
    const ys = sourceNodes.map(n => Number(n.y) || 0);
    const cx = (Math.min(...xs) + Math.max(...xs) ) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const p = S().lastMouseWorld || S().viewportCenter();
    const dx = p.x - cx;
    const dy = p.y - cy;
    const idMap = new Map();
    const copies = sourceNodes.map(n => {
        const copy = S().cloneSmartNode(n, dx, dy);
        if(!copy?.id) return null;
        idMap.set(n.id, copy.id);
        return copy;
    }).filter(Boolean);
    if(!copies.length){
        S().toast?.(S().tr?.('smart.toastPasteFailed') || '粘贴失败');
        return false;
    }
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
    S().toast?.(copies.length === 1 ? (S().tr?.('smart.toastPastedOne') || '已粘贴 1 个对象') : (S().trf?.('smart.toastPastedMany', {count: copies.length}) || `已粘贴 ${copies.length} 个对象`));
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
