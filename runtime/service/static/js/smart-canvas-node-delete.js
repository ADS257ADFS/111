/**
 * Smart Canvas — node and image deletion.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        if(!deps) throw new Error('[SmartCanvasNodeDelete] deps not registered');
        return deps;
    }
    function nodes(){ return S().getNodes(); }

function deleteNode(id){
    if(!S().undoSuppressed) S().pushUndo();
    const deleteIds = new Set([id]);
    nodes().forEach(node => {
        if(S().isHistoryGroupNode(node) && node.historyFor === id) deleteIds.add(node.id);
    });
    S().nodes = nodes().filter(node => !deleteIds.has(node.id));
    if(S().canvas) S().canvas.connections = (S().canvas.connections || []).filter(c => !deleteIds.has(c.from) && !deleteIds.has(c.to));
    nodes().forEach(node => {
        if(Array.isArray(node.inputNodeIds)) node.inputNodeIds = node.inputNodeIds.filter(inputId => !deleteIds.has(inputId));
    });
    if(S().selectedId === id) S().selectedId = '';
    S().selectedIds = S().selectedIds.filter(selected => !deleteIds.has(selected));
    if(deleteIds.has(S().selectedImage.nodeId)) S().selectedImage = {nodeId:'', index:-1};
    S().render();
    clearTimeout(S().saveTimer);
    S().saveTimer = null;
    S().saveCanvas();
}
function clearNodeMediaBeforeDelete(id){
    const node = nodes().find(n => n.id === id);
    if(!node || (node.type && node.type !== 'smart-image')) return false;
    const hadMedia = Boolean((node.images || []).length || node.pending);
    if(!hadMedia) return false;
    S().pushUndo();
    node.images = [];
    node.pending = 0;
    node.running = false;
    node.title = S().tr('smart.createImportNode');
    delete node.w;
    delete node.h;
    const history = S().historyGroupForNode(node);
    if(history){
        S().nodes = nodes().filter(n => n.id !== history.id);
        if(S().canvas) S().canvas.connections = (S().canvas.connections || []).filter(c => c.from !== history.id && c.to !== history.id);
    }
    if(S().selectedImage.nodeId === id) S().selectedImage = {nodeId:'', index:-1};
    S().selectedId = id;
    S().selectedIds = [];
    S().render();
    S().scheduleSave();
    return true;
}
function deleteNodeFromButton(id){
    deleteNode(id);
}
function deleteImage(id, imageIndex){
    const node = nodes().find(n => n.id === id);
    if(!node || imageIndex < 0) return;
    S().pushUndo();
    node.images = (node.images || []).filter((_, index) => index !== imageIndex);
    if(node.images.length <= 1) node.title = 'Image';
    if(S().selectedImage.nodeId === id) S().selectedImage = {nodeId:id, index:Math.min(S().selectedImage.index, node.images.length - 1)};
    if(S().selectedImage.index < 0) S().selectedImage = {nodeId:'', index:-1};
    S().render();
    S().scheduleSave();
}

    const api = Object.freeze({ registerDeps, deleteNode, clearNodeMediaBeforeDelete, deleteNodeFromButton, deleteImage });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeDelete', api);
    global.SmartCanvasNodeDelete = api;
})(window);
