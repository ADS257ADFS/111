/**
 * Smart Canvas — strip generation meta from node images for storage/drag.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeMeta] deps not registered');
        return c;
    }

function stripImageGenerationMeta(img){
    if(!img) return img;
    delete img.runPrompt;
    delete img.runModelPrompt;
    delete img.runSettings;
    delete img.sourceNodeId;
    delete img.runAt;
    delete img.promptDraftHtml;
    delete img.promptDraftText;
    return img;
}

function imageMetaFromNode(node){
    return {};
}


function applyNodeMetaToImage(image, node){
    return stripImageGenerationMeta(image);
}


function inheritNodeMetaFromImage(node){
    if(!node) return;
    node.images = (node.images || []).map(img => stripImageGenerationMeta(img));
}


function canvasImageDragPayload(node, index=0){
    const img = node?.images?.[index];
    if(!img?.url) return null;
    return {url:img.url, name:img.name || node.title || 'image'};
}

    const api = Object.freeze({
        registerDeps,
        stripImageGenerationMeta,
        imageMetaFromNode,
        applyNodeMetaToImage,
        inheritNodeMetaFromImage,
        canvasImageDragPayload
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeMeta', api);
    global.SmartCanvasNodeMeta = api;
})(window);
