/**
 * Smart Canvas — import workflow JSON into canvas.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasWorkflowImport] deps not registered');
        return c;
    }
    function nodes(){ return S().nodes; }


function smartWorkflowFilename(ext='json'){
    const title = String(S().canvas?.title || 'smart-canvas').trim() || 'smart-canvas';
    const safe = title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 48);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${safe}-workflow-${stamp}.${ext}`;
}

function normalizeImportedSmartWorkflow(data){
 if(Array.isArray(data)) return {nodes:data, connections:[]};
 if(Array.isArray(data?.nodes)) return {nodes:data.nodes, connections:Array.isArray(data.connections) ? data.connections : []};
 if(Array.isArray(data?.workflow?.nodes)) return {nodes:data.workflow.nodes, connections:Array.isArray(data.workflow.connections) ? data.workflow.connections : []};
 return {nodes:[], connections:[]};
}
function insertSmartWorkflowIntoCanvas(imported){
 const srcNodes = (imported.nodes || []).filter(Boolean);
 const srcConnections = (imported.connections || []).filter(Boolean);
 if(!S().canvas || !srcNodes.length) throw new Error('工作流中没有可导入的节点');
 S().pushUndo();
 const minX = Math.min(...srcNodes.map(n => Number(n.x || 0)));
 const minY = Math.min(...srcNodes.map(n => Number(n.y || 0)));
 const target = S().viewportCenter();
 const dx = target.x - minX;
 const dy = target.y - minY;
 const idMap = new Map();
 const newNodes = srcNodes.map(source => {
 const copy = S().serializableSmartNode(source);
 const oldId = copy.id || S().uid(copy.type || 'smart');
 copy.id = S().uid(copy.type || 'smart');
 copy.x = Number(copy.x || 0) + dx;
 copy.y = Number(copy.y || 0) + dy;
 copy.created_at = copy.created_at || Date.now();
 idMap.set(oldId, copy.id);
 return S().normalizeLegacySmartNode(copy);
 }).filter(Boolean);
 const newConnections = srcConnections
 .map(conn => ({...JSON.parse(JSON.stringify(conn)), from:idMap.get(conn.from), to:idMap.get(conn.to)}))
 .filter(conn => conn.from && conn.to);
 nodes().push(...newNodes);
 S().canvas.connections = [...(S().canvas.connections || []), ...newConnections];
 S().selectedIds = newNodes.length > 1 ? newNodes.map(node => node.id) : [];
 S().selectedId = newNodes.length === 1 ? newNodes[0].id : '';
 S().selectedImage = {nodeId:'', index:-1};
 S().activeComposerSubject = null;
 S().render();
 S().scheduleSave();
 S().toast(`已导入 ${newNodes.length} 个节点`);
}
async function importSmartWorkflowFile(file){
 if(!S().canvas || !file) return;
 try {
 if(S().smartWorkflowTransferSub) S().smartWorkflowTransferSub.textContent = '正在导入工作流...';
 const form = new FormData();
 form.append('file', file);
 const res = await fetch('/api/canvas-workflows/import', {method:'POST', body:form});
 if(!res.ok) throw new Error(await S().responseErrorMessage(res, '导入工作流失败'));
 const data = await res.json();
 insertSmartWorkflowIntoCanvas(normalizeImportedSmartWorkflow(data));
 S().closeSmartWorkflowTransferModal();
 } catch(err) {
 if(S().smartWorkflowTransferModal?.classList.contains('open')) S().updateSmartWorkflowTransferMeta();
 S().toast(err.message || '导入工作流失败');
 }
}

function selectedSmartWorkflowPayload(){
 const ids = S().selectedNodeIds();
 const idSet = new Set(ids);
 const selectedNodes = nodes().filter(node => idSet.has(node.id)).map(node => S().serializableSmartNode(node));
 const selectedSet = new Set(selectedNodes.map(node => node.id));
 const selectedConnections = (S().canvas?.connections || [])
 .filter(conn => selectedSet.has(conn.from) && selectedSet.has(conn.to))
 .map(conn => JSON.parse(JSON.stringify(conn)));
 return {
 format:'infinite-smart-canvas-workflow',
 version:1,
 canvas_type:'smart',
 exported_at:Date.now(),
 nodes:selectedNodes,
 connections:selectedConnections
 };
}

async function exportSelectedSmartWorkflow(includeResources=false){
 if(!S().canvas) return;
 const payload = selectedSmartWorkflowPayload();
 if(!payload.nodes.length){
 S().updateSmartWorkflowTransferMeta();
 S().toast('未选择节点，请先选中要导出的组件');
 return;
 }
 try {
 if(!includeResources){
 S().downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'}), smartWorkflowFilename('json'));
 S().toast('已导出智能画布工作流 JSON');
 return;
 }
 if(S().smartWorkflowExportMeta){
 S().smartWorkflowExportMeta.classList.add('busy');
 S().smartWorkflowExportMeta.textContent = '正在打包资源...';
 }
 const filename = smartWorkflowFilename('zip');
 const res = await fetch('/api/canvas-workflows/export', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({...payload, include_resources:true, filename})
 });
 if(!res.ok) throw new Error(await S().responseErrorMessage(res, '导出工作流失败'));
 S().downloadBlob(await res.blob(), filename);
 if(S().smartWorkflowExportMeta){
 S().smartWorkflowExportMeta.classList.remove('busy');
 S().smartWorkflowExportMeta.classList.add('success');
 S().smartWorkflowExportMeta.textContent = `已导出 ${payload.nodes.length} 个节点，包含可找到的本地资源`;
 }
 S().toast('已导出包含资源的智能画布工作流包');
 setTimeout(() => {
 if(S().smartWorkflowTransferModal?.classList.contains('open')) S().updateSmartWorkflowTransferMeta();
 }, 1600);
 } catch(err) {
 S().smartWorkflowExportMeta?.classList.remove('busy', 'success');
 S().toast(err.message || '导出工作流失败');
 }
}

    function closeSmartWorkflowTransferModal(){
 S().smartWorkflowTransferModal?.classList.remove('open');
 S().smartWorkflowToggle?.classList.remove('active');
 S().smartWorkflowImportDropZone?.classList.remove('drag-over');
}
    function openSmartWorkflowTransferModal(){
 if(!S().canvas){ S().toast('请先打开画布'); return; }
 S().toggleAssetLibrary(false);
 updateSmartWorkflowTransferMeta();
 S().smartWorkflowTransferModal?.classList.add('open');
 S().smartWorkflowToggle?.classList.add('active');
 S().refreshIcons();
}
    function updateSmartWorkflowTransferMeta(){
 const payload = selectedSmartWorkflowPayload();
 const nodeCount = payload.nodes.length;
 const connCount = payload.connections.length;
 S().smartWorkflowExportMeta?.classList.remove('busy', 'success');
 if(S().smartWorkflowExportMeta) S().smartWorkflowExportMeta.textContent = nodeCount ? `已选择 ${nodeCount} 个节点，${connCount} 条连线` : '未选择节点，请先选中要导出的组件';
 if(S().smartWorkflowTransferSub) S().smartWorkflowTransferSub.textContent = nodeCount ? '导出当前选中内容，或把工作流导入到当前画布' : '请先选中节点再导出；导入会追加到当前画布';
}
    const api = Object.freeze({
        updateSmartWorkflowTransferMeta,
        openSmartWorkflowTransferModal,
        closeSmartWorkflowTransferModal, registerDeps, normalizeImportedSmartWorkflow, insertSmartWorkflowIntoCanvas, importSmartWorkflowFile, selectedSmartWorkflowPayload, exportSelectedSmartWorkflow });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('workflowImport', api);
    global.SmartCanvasWorkflowImport = api;
})(window);
