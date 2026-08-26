/**
 * Smart Canvas — smart node / group quick-toolbar actions.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeToolbar] deps not registered');
        return c;
    }

function runSmartGroupToolbarAction(nodeId, action){ 
 const group = S().nodes.find(n => n.id === nodeId);
 if(!S().isSmartGroupNode(group)) return; 
 S().selectedId = nodeId; 
 S().selectedIds = []; 
 S().selectedImage = {nodeId:'', index:-1}; 
 if(action === 'arrange'){ 
 if(S().arrangeSmartGroupMembers(group)){ S().render(); S().scheduleSave(); S().toast('已整理分组'); } 
 else S().toast('分组内没有可整理的节点'); 
 return; 
 } 
 if(action === 'ungroup'){ S().ungroupNode(nodeId); return; } 
 // 图片已收进分组（group.images），预览/下载/拼接直接复用单节点机器（分组就是一个多图容器）。 
 const imageCount = (group.images || []).filter(img => img?.url).length; 
 if(!imageCount){ S().toast('分组内没有图片'); return; } 
 if(action === 'preview'){ 
 const first = (group.images || []).findIndex(img => img?.url); 
 S().openImagePreview(nodeId, Math.max(0, first)); 
 return; 
 } 
 if(action === 'download'){ S().zipDownloadImageItems(group.title, (group.images || []).map(S().imageForDisplay)); return; } 
 if(action === 'grid'){ 
 if(imageCount <= 1){ S().toast('分组至少需要 2 张图片才能宫格拼接'); return; } 
 const first = (group.images || []).findIndex(img => img?.url); 
 S().openImageEditor(nodeId, Math.max(0, first)); 
 if(S().imageEditModal.classList.contains('open')){ 
 S().setImageEditMode('grid', true); 
 S().setGridOperationMode('join'); 
 } 
 return; 
 } 
}
function runSmartNodeToolbarAction(nodeId, action){ 
 const node = S().nodes.find(n => n.id === nodeId);
 if(!node) return; 
 const index = S().smartNodeToolbarImageIndex(node); 
 const item = S().imageForDisplay(node.images?.[index]); 
 if(!item?.url) return; 
 const kind = S().mediaKindForItem(item); 
 S().selectedId = nodeId; 
 S().selectedIds = []; 
 S().selectedImage = {nodeId, index}; 
 if(action === 'download'){ 
 S().downloadPreviewFile(node.images?.[index] || item); 
 return; 
 } 
 if(action === 'canvas'){ 
 S().duplicateSmartNodeMediaToCanvas(node, index); 
 return; 
 } 
 if(kind !== 'image' && action !== 'preview'){ 
 S().toast('当前素材不支持该操作'); 
 return; 
 } 
 if(action === 'preview'){ 
 S().openImagePreview(nodeId, index); 
 return; 
 } 
 if(['crop','outpaint','grid'].includes(action)){
 global.SmartCanvasImageLightbox?.open?.(nodeId, index, null, {selectedTool:action});
 return;
 }
 const modeMap = {mask:'mask', brush:'brush'}; 
 S().openImageEditor(nodeId, index); 
 S().setImageEditMode(modeMap[action] || 'preview', true); 
 if(action === 'grid' && S().canGridJoinCurrentNode()){ 
 S().setGridOperationMode('join'); 
 } 
}

function smartNodeToolbarHtml(node){ 
 const isImageNode = node?.type === 'smart-image' || !node?.type; 
 const images = node?.images || []; 
 if(!isImageNode || !images.some(img => img?.url)) return ''; 
 const item = S().imageForDisplay(images[smartNodeToolbarImageIndex(node)] || images.find(img => img?.url)); 
 if(!item?.url) return ''; 
 const kind = S().mediaKindForItem(item); 
 const canEditImage = kind === 'image'; 
 const imageCount = images.filter(img => S().mediaKindForItem(S().imageForDisplay(img)) === 'image' && S().imageForDisplay(img)?.url).length; 
 const gridLabel = imageCount > 1 ? '宫格拼接' : '宫格切分'; 
 const actions = [ 
 {key:'preview', icon:'eye', label:'预览', enabled:kind === 'image' || kind === 'video'}, 
 {key:'crop', icon:'crop', label:'裁剪', enabled:canEditImage}, 
 {key:'outpaint', icon:'expand', label:'扩图', enabled:canEditImage}, 
 {key:'mask', icon:'brush', label:'遮罩', enabled:canEditImage}, 
 {key:'brush', icon:'paintbrush', label:'画笔', enabled:canEditImage}, 
 {key:'grid', icon:'grid-3x3', label:gridLabel, enabled:canEditImage}, 
 {key:'download', icon:'download', label:'下载', enabled:true} 
 ]; 
 return ` ${actions.map(action => ` 
 
 ${S().escapeHtml(action.label)} 
 `).join('')} `; 
}

function smartNodeToolbarImageIndex(node){ 
 const images = node?.images || []; 
 if(S().selectedImage.nodeId === node?.id){ 
 const index = Number(S().selectedImage.index); 
 if(Number.isFinite(index) && index >= 0 && index < images.length) return index; 
 } 
 return 0; 
}

function smartRecoverableImageTask(node){ 
 return S().smartPendingTasks(node).find(task => task.failed && task.recoverTaskId) || null; 
}

    const api = Object.freeze({
        registerDeps,
        runSmartGroupToolbarAction,
        runSmartNodeToolbarAction,
        smartNodeToolbarHtml,
        smartNodeToolbarImageIndex,
        smartRecoverableImageTask,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeToolbar', api);
    global.SmartCanvasNodeToolbar = api;
})(window);
