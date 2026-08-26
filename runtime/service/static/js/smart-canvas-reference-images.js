/**
 * Smart Canvas — dedupe and merge reference images for prompt/composer runs.
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
        if(!c) throw new Error('[SmartCanvasReferenceImages] deps not registered');
        return c;
    }

function uniqueReferenceImages(images){
    const refs = [];
    const seen = new Set();
    (images || []).forEach((img, index) => {
        if(!img?.url || seen.has(img.url)) return;
        seen.add(img.url);
        refs.push({
            ...img,
            name:img.name || `图${refs.length + 1}`,
            role:img.role || `image_${refs.length + 1}`,
            imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index
        });
    });
    return refs;
}

function selectedSelfReferenceForNode(node){
    const selected = global.SmartCanvasCore?.tryDeps?.()?.selectedImage;
    const index = Number(selected?.index);
    if(!node?.id || selected?.nodeId !== node.id || !Number.isInteger(index) || index < 0) return null;
    const image = node.images?.[index];
    if(!image?.url) return null;
    return {...image, nodeId:node.id, imageIndex:index, name:image.name || '当前图片', role:'image_1', selfReference:true};
}

function visibleReferenceImagesFor(node){
    const selectedSelf = selectedSelfReferenceForNode(node);
    const base = selectedSelf ? [selectedSelf] : S().defaultReferenceImagesFor(node);
    return uniqueReferenceImages([...base, ...S().collectMentionedImagesFromPrompt()]);
}

function referenceImagesFor(node){
    return S().defaultReferenceImagesFor(node);
}

    function manualReferenceImagesFor(node){
 if(!node || !Array.isArray(node.manualInputRefs)) return [];
 return node.manualInputRefs.filter(img => img?.url).map((img, index) => ({
 ...img,
 kind:img.kind || S().mediaKindForItem(img),
 name:img.name || `图${index + 1}`,
 imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index,
 manualAdded:true
 }));
}
    function loadSmartOriginalImageDimensions(url){
 const src = S().displayMediaUrl({url:S().smartOriginalMediaUrl(url)});
 if(!src || /^data:/i.test(src) || /^blob:/i.test(src)) return Promise.resolve(null);
 return new Promise(resolve => {
 const img = new Image();
 img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? {w:img.naturalWidth, h:img.naturalHeight} : null);
 img.onerror = () => resolve(null);
 img.src = src;
 });
}
    const api = Object.freeze({
        loadSmartOriginalImageDimensions,
        manualReferenceImagesFor,
        registerDeps,
        uniqueReferenceImages,
        selectedSelfReferenceForNode,
        visibleReferenceImagesFor,
        referenceImagesFor
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('referenceImages', api);
    }
    global.SmartCanvasReferenceImages = api;
})(window);
