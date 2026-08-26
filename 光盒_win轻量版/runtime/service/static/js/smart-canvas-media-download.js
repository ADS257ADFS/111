/**
 * Smart Canvas — preview/group download helpers and zip export.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasMediaDownload] deps not registered');
        return c;
    }

function safeExportFileName(name, fallback='download.zip'){
    const cleaned = String(name || fallback).replace(/[\\/:*?"<>|]+/g, '_').trim();
    return cleaned || fallback;
}
function extensionForMediaItem(item, fallback='.png'){
    const source = [item?.name, item?.url].map(value => String(value || '').split('?')[0].split('#')[0]).find(value => /\.[a-z0-9]{2,8}$/i.test(value));
    if(source) return source.match(/(\.[a-z0-9]{2,8})$/i)?.[1] || fallback;
    const kind = S().mediaKindForItem(item);
    if(kind === 'video') return '.mp4';
    if(kind === 'audio') return '.mp3';
    if(kind === 'text') return '.txt';
    return fallback;
}
function downloadNameForMediaItem(item, fallbackPrefix='canvas-output'){
    const localName = S().fileNameFromUrl(item?.url || '');
    const preferred = localName || item?.name || '';
    const ext = extensionForMediaItem(item);
    const randomName = `${fallbackPrefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}${ext}`;
    let name = safeExportFileName(preferred || randomName, randomName);
    if(!/\.[a-z0-9]{2,8}$/i.test(name)) name += ext;
    return name;
}
function sourceElementForNode(nodeId){
    return global.SmartCanvasDownloadCenter?.sourceElementForNode?.(nodeId)
        || document.querySelector('.image-node.selected');
}
async function downloadPreviewImage(){
    const node = S().nodes.find(n => n.id === S().previewNavState.nodeId);
    const image = node?.images?.[S().previewNavState.index];
    if(!image?.url) return;
    const name = downloadNameForMediaItem(image, 'image');
    return global.SmartCanvasDownloadCenter?.saveItem?.(image, {
        filename:name,
        nodeId:node?.id,
        sourceElement:document.getElementById('previewFrame') || sourceElementForNode(node?.id)
    });
}
async function downloadNodeImage(nodeId, imageIndex=0){
    const node = S().nodes.find(n => n.id === nodeId);
    const image = node?.images?.[imageIndex];
    if(!image?.url) return;
    const filename = downloadNameForMediaItem(image, 'output');
    try {
        return await global.SmartCanvasDownloadCenter?.saveItem?.(image, {
            filename, nodeId, sourceElement:sourceElementForNode(nodeId)
        });
    } catch(error) {
        S().toast((error?.message || '下载失败').slice(0,160));
    }
}
async function saveNodeImageAs(nodeId, imageIndex=0){
    const node = S().nodes.find(n => n.id === nodeId);
    const image = node?.images?.[imageIndex];
    if(!image?.url) return;
    const filename = downloadNameForMediaItem(image, 'output');
    try {
        return await global.SmartCanvasDownloadCenter?.saveItemAs?.(image, {filename});
    } catch(error) {
        S().toast((error?.message || '另存为失败').slice(0,160));
    }
}
function previewDownloadGroupItems(){
    const node = S().nodes.find(n => n.id === S().previewNavState.nodeId);
    return (node?.images || [])
        .filter(item => item?.url)
        .map((item, index) => ({...item, __index:index}))
        .sort((a, b) => {
            const ga = a.grid || {};
            const gb = b.grid || {};
            const rowDiff = Number(ga.row ?? a.__index) - Number(gb.row ?? b.__index);
            if(rowDiff) return rowDiff;
            const colDiff = Number(ga.col ?? a.__index) - Number(gb.col ?? b.__index);
            return colDiff || a.__index - b.__index;
        });
}
async function downloadPreviewGroup(){
    const node = S().nodes.find(n => n.id === S().previewNavState.nodeId);
    const items = previewDownloadGroupItems();
    if(!items.length) return;
    try {
        const filename = safeExportFileName(`${node?.title || 'image-group'}.zip`, 'image-group.zip');
        const response = await fetch('/api/canvas-assets/download', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                filename,
                urls:items.map(item => item.url).filter(Boolean),
                items:items.map((item, index) => ({url:item.url, name:downloadNameForMediaItem(item, `image-${String(index + 1).padStart(2, '0')}`)}))
            })
        });
        if(!response.ok) throw new Error((await response.text()) || '批量下载失败');
        const blob = await response.blob();
        await global.SmartCanvasDownloadCenter?.saveBlob?.(blob, filename, {
            sourceElement:sourceElementForNode(node?.id)
        });
    } catch(e) {
        S().toast((e.message || '批量下载失败').slice(0, 160));
    }
}
function downloadBlob(blob, filename){
 return global.SmartCanvasDownloadCenter?.saveBlob?.(
     blob,
     filename || 'smart-canvas-workflow.json',
     {sourceElement:document.querySelector('.image-node.selected')}
 );
}
function downloadSmartGroupImages(group){ 
 if(!S().isSmartGroupNode(group)) return; 
 return zipDownloadImageItems(group?.title, S().smartGroupImageRefs(group).map(r => r.item)); 
}
async function zipDownloadImageItems(title, items){ 
 const list = (items || []).filter(item => item?.url); 
 if(!list.length) return; 
 try { 
 const filename = safeExportFileName(`${title || 'image-group'}.zip`, 'image-group.zip'); 
 const response = await fetch('/api/canvas-assets/download', { 
 method:'POST', 
 headers:{'Content-Type':'application/json'}, 
 body:JSON.stringify({ 
 filename, 
 urls:list.map(item => item.url).filter(Boolean), 
 items:list.map((item, index) => ({url:item.url, name:downloadNameForMediaItem(item, `image-${String(index + 1).padStart(2, '0')}`)})) 
 }) 
 }); 
 if(!response.ok) throw new Error((await response.text()) || '批量下载失败'); 
 const blob = await response.blob(); 
 await global.SmartCanvasDownloadCenter?.saveBlob?.(blob, filename, {
 sourceElement:document.querySelector('.image-node.selected')
 });
 } catch(e) { 
 S().toast((e.message || '批量下载失败').slice(0, 160)); 
 } 
}
async function zipSaveImageItemsAs(title, items){
 const list = (items || []).filter(item => item?.url);
 if(!list.length) return;
 try {
 const filename = safeExportFileName(`${title || 'image-group'}.zip`, 'image-group.zip');
 const response = await fetch('/api/canvas-assets/download', {
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({
 filename,
 urls:list.map(item => item.url).filter(Boolean),
 items:list.map((item, index) => ({url:item.url, name:downloadNameForMediaItem(item, `image-${String(index + 1).padStart(2, '0')}`)}))
 })
 });
 if(!response.ok) throw new Error((await response.text()) || '无法生成压缩包');
 await global.SmartCanvasDownloadCenter?.saveBlobAs?.(await response.blob(), filename);
 } catch(error) {
 S().toast((error?.message || '另存为失败').slice(0,160));
 }
}

    const api = Object.freeze({
        registerDeps,
        safeExportFileName,
        extensionForMediaItem,
        downloadNameForMediaItem,
        downloadPreviewImage,
        downloadNodeImage,
        saveNodeImageAs,
        previewDownloadGroupItems,
        downloadPreviewGroup,
        downloadBlob,
        downloadSmartGroupImages,
        zipDownloadImageItems,
        zipSaveImageItemsAs,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('mediaDownload', api);
    global.SmartCanvasMediaDownload = api;
})(window);
