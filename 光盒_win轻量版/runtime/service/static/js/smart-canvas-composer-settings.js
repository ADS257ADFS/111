/**
 * Smart Canvas — composer subject resolution and node/outpaint settings merge.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasComposerSettings] deps not registered');
        return c;
    }
    function nodeList(){ return S().getNodes(); }

function nearestFourKSizeFor(width, height){
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);
    const ratio = w / h;
    let best = null;
    Object.entries(S().SIZE_MAP).forEach(([key, values]) => {
        const size = S().parseSizePair(values?.['4k']);
        if(!size) return;
        const score = Math.abs(Math.log(ratio / (size.width / size.height)));
        if(!best || score < best.score) best = {...size, key, score};
    });
    return best;
}

function exceedsFourKStandard(width, height){
    const standard = nearestFourKSizeFor(width, height);
    if(!standard) return false;
    return Number(width) > standard.width || Number(height) > standard.height;
}

function withOutpaintDisplaySettings(node, baseSettings){
    const size = S().validOutpaintSize(node);
    if(!size) return baseSettings;
    const engine = ['api','comfy'].includes(baseSettings?.engine) ? baseSettings.engine : 'api';
    const next = {
        ...baseSettings,
        resolution:'custom',
        ratio:'',
        customWidth:size.width,
        customHeight:size.height,
        customSize:`${size.width}x${size.height}`,
        outpaintResolutionLocked:true
    };
    if(S().isApiLikeEngine(engine)) next.apiKind = 'image';
if(engine === 'comfy'){
        next.width = size.width;
        next.height = size.height;
    }
    return next;
}

function stripOutpaintDisplaySettings(settingsObj, node=null){
    const clean = S().cloneSmartSettings(settingsObj);
    const size = S().validOutpaintSize(node);
    const matchesOutpaintSize = size && clean.resolution === 'custom' && String(clean.customSize || '') === `${size.width}x${size.height}`;
    if(matchesOutpaintSize){
        clean.resolution = '1k';
        clean.ratio = clean.ratio || 'square';
        clean.customWidth = '';
        clean.customHeight = '';
        clean.customSize = '';
    }
if(size && Number(clean.width) === size.width && Number(clean.height) === size.height){
        clean.width = 1024;
        clean.height = 1024;
    }
    delete clean.outpaintResolutionLocked;
    return clean;
}

function smartSettingsForNode(node){
    const nodeSettings = stripOutpaintDisplaySettings(node?.runSettings || {}, node);
    const recentSettings = Object.keys(nodeSettings).length ? {} : S().recentSmartSettingsForMode();
    const base = {
        ...S().cloneSmartSettings(S().canvasDefaultSmartSettings || S().initialSmartSettings),
        ...recentSettings,
        ...nodeSettings
    };
    return S().syncVideoCountFromSettings(withOutpaintDisplaySettings(node, base));
}

function activeSettingsSubject(){
    const active = S().activeComposerSubject?.id
        ? (nodeList().find(n => n.id === S().activeComposerSubject.id) || S().activeComposerSubject)
        : S().selectedNode();
    return S().isSmartImageNode(active) ? active : null;
}

function activeComposerNode(){
    if(global.SmartCanvasMultiSelectCompose?.isSubject?.(S().activeComposerSubject)) return S().activeComposerSubject;
    if(!S().lastComposerNodeId) return null;
    const id = String(S().lastComposerNodeId).split(':')[0] || '';
    const node = nodeList().find(n => n.id === id);
    return S().isSmartImageNode(node) ? node : null;
}

function persistActiveSmartSettings(){
    if(!S().composer?.classList?.contains('open')) return;
    const subject = activeComposerNode();
    if(!subject) return;
    subject.runSettings = S().settingsForStorage(S().settings);
    S().rememberRecentSmartSettings(S().settings, subject);
}

function parseSizeValue(value){
    const match = String(value || '').trim().match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    return match ? {width:match[1], height:match[2]} : null;
}

function snapOutputSize(w, h){
    const width = Math.max(64, Math.floor(Number(w) / 16) * 16);
    const height = Math.max(64, Math.floor(Number(h) / 16) * 16);
    return `${width}x${height}`;
}

function scaleSizeToLongSide(w, h, longSide, pixelLimit=0){
    const width = Math.max(1, Number(w) || 1);
    const height = Math.max(1, Number(h) || 1);
    const cap = Math.max(64, Number(longSide) || 1024);
    const maxDim = Math.max(width, height);
    let scale = cap / maxDim;
    const limit = Math.max(0, Number(pixelLimit) || 0);
    if(limit > 0 && width * height * scale * scale > limit){
        scale = Math.sqrt(limit / (width * height));
    }
    return snapOutputSize(width * scale, height * scale);
}

function resolveImageDimensions(img){
    const size = imageSizeForRatio(img);
    if(size) return size;
    if(!img?.url) return null;
    const original = String(img.url || '').trim();
    const probe = S().world?.querySelector(`img[data-original-src="${CSS.escape(original)}"], img[src="${CSS.escape(S().displayMediaUrl(img) || original)}"]`);
    const w = Number(probe?.naturalWidth || probe?.videoWidth || 0);
    const h = Number(probe?.naturalHeight || probe?.videoHeight || 0);
    if(w > 0 && h > 0){
        img.natural_w = w;
        img.natural_h = h;
        return {w, h};
    }
    return null;
}

function sourceReferenceImageCandidates(node, refs=null){
    const seen = new Set();
    const list = [];
    const push = img => {
        const url = String(img?.url || '').trim();
        if(!url || seen.has(url)) return;
        seen.add(url);
        list.push(img);
    };
    (refs || []).forEach(push);
    S().upstreamLineReferenceImagesFor(node).forEach(push);
    S().defaultReferenceImagesFor(node, false).forEach(push);
    const self = sourceRatioImageForNode(node);
    if(self) push(self);
    return list;
}

function sourceReferenceImageForSize(node, refs=null){
    for(const img of sourceReferenceImageCandidates(node, refs)){
        if(resolveImageDimensions(img)) return img;
    }
    return null;
}

async function ensureImageDimensions(img){
    if(resolveImageDimensions(img)) return imageSizeForRatio(img);
    if(!img?.url) return null;
    return new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => {
            img.natural_w = probe.naturalWidth;
            img.natural_h = probe.naturalHeight;
            resolve(imageSizeForRatio(img));
        };
        probe.onerror = () => resolve(null);
        probe.src = S().displayMediaUrl(img) || img.url;
    });
}

async function sourceReferenceImageForSizeAsync(node, refs=null){
    const sync = sourceReferenceImageForSize(node, refs);
    if(sync) return sync;
    for(const img of sourceReferenceImageCandidates(node, refs)){
        if(await ensureImageDimensions(img)) return img;
    }
    return null;
}

function parseRatioValue(value){
    const raw = String(value || '').trim();
    const parts = raw.includes(':') ? raw.split(':') : raw.split(/[xX*]/);
    if(parts.length !== 2) return 0;
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    return w > 0 && h > 0 ? w / h : 0;
}

function apiImageSize(ratioValue, resolutionValue, customRatioValue='', customSizeValue='', sourceImage=null){
    if(resolutionValue === 'auto') return 'auto';
    if(resolutionValue === 'custom') return String(customSizeValue || '').trim();
    if(ratioValue === 'source'){
        const size = resolveImageDimensions(sourceImage) || imageSizeForRatio(sourceImage);
        if(size){
            const resolutionKey = resolutionValue || '1k';
            if(resolutionKey && S().RES_LONG_SIDE[resolutionKey]){
                return scaleSizeToLongSide(
                    size.w,
                    size.h,
                    S().RES_LONG_SIDE[resolutionKey],
                    S().RES_PIXEL_LIMIT[resolutionKey]
                );
            }
            return snapOutputSize(size.w, size.h);
        }
    }
    const resolutionKey = resolutionValue || '1k';
    if(ratioValue === 'custom' || ratioValue === 'source'){
        const parsed = parseRatioValue(customRatioValue);
        const longSide = S().RES_LONG_SIDE[resolutionKey] || 1024;
        if(parsed){
            const pixelLimit = S().RES_PIXEL_LIMIT[resolutionKey] || (longSide * longSide);
            const ratioWidth = parsed >= 1 ? parsed : 1;
            const ratioHeight = parsed >= 1 ? 1 : (1 / parsed);
            return scaleSizeToLongSide(ratioWidth, ratioHeight, longSide, pixelLimit);
        }
    }
    const ratioKey = ratioValue && S().SIZE_MAP[ratioValue] ? ratioValue : 'square';
    return S().SIZE_MAP[ratioKey]?.[resolutionKey] || S().SIZE_MAP.square[resolutionKey] || S().SIZE_MAP.square['1k'];
}

function gcdInt(a, b){
    a = Math.abs(Math.round(Number(a) || 0));
    b = Math.abs(Math.round(Number(b) || 0));
    while(b){ const t = b; b = a % b; a = t; }
    return a || 1;
}

function imageSizeForRatio(img){
    const w = Math.round(Number(img?.natural_w || img?.width || img?.w || 0));
    const h = Math.round(Number(img?.natural_h || img?.height || img?.h || 0));
    return w > 0 && h > 0 ? {w, h} : null;
}

function sourceRatioImageForNode(node){
    const images = (node?.images || []).filter(img => img?.url && !S().isAudioMediaItem(img));
    if(!images.length) return null;
    if(S().selectedImage.nodeId === node?.id && S().selectedImage.index >= 0 && S().imagesForNode(node)[S().selectedImage.index]){
        const selected = S().imagesForNode(node)[S().selectedImage.index];
        if(imageSizeForRatio(selected)) return selected;
    }
    return images.find(img => imageSizeForRatio(img)) || images[0];
}

function reducedRatioForImage(img){
    const size = imageSizeForRatio(img);
    if(!size) return null;
    const dVal = gcdInt(size.w, size.h);
    return {w:Math.max(1, Math.round(size.w / dVal)), h:Math.max(1, Math.round(size.h / dVal))};
}

function sourceImageRatioLabel(prefix=''){
    const node = activeComposerNode() || selectedNode();
    const ratio = reducedRatioForImage(sourceRatioImageForNode(node));
    if(!ratio) return '';
    return `${ratio.w}:${ratio.h}`;
}

function applySourceRatioToSettings(prefix='', node=null, refs=null){
    const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
    if(S().settings[ratioKey] !== 'source') return;
    const target = node || activeComposerNode() || selectedNode();
    const img = sourceReferenceImageForSize(target, refs);
    const ratio = reducedRatioForImage(img);
    if(!ratio) return;
    const customKey = prefix ? `${prefix}CustomRatio` : 'customRatio';
    const wKey = prefix ? `${prefix}CustomRatioWidth` : 'customRatioWidth';
    const hKey = prefix ? `${prefix}CustomRatioHeight` : 'customRatioHeight';
    S().settings[wKey] = ratio.w;
    S().settings[hKey] = ratio.h;
    S().settings[customKey] = `${ratio.w}:${ratio.h}`;
}

function sizeForRun(sourceSettings=settings, sourceImage=null){
    const fallbackResolution = sourceSettings.engine === 'api' && isGptImageAutoSizeModel(sourceSettings.model)
        ? 'auto'
        : '1k';
    return apiImageSize(
        sourceSettings.ratio || 'square',
        sourceSettings.resolution || fallbackResolution,
        sourceSettings.customRatio || '',
        sourceSettings.customSize || '',
        sourceImage
    ) || '1024x1024';
}

async function sizeForRunAsync(sourceSettings=settings, node=null, refs=null){
    const target = node || activeComposerNode() || selectedNode();
    applySourceRatioToSettings('', target, refs);
    let sourceImage = null;
    if(sourceSettings.ratio === 'source'){
        sourceImage = await sourceReferenceImageForSizeAsync(target, refs);
    }
    return sizeForRun(sourceSettings, sourceImage);
}

function isGptImageAutoSizeModel(model){ 
 const raw = String(model || '').trim().toLowerCase(); 
 const normalized = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); 
 const compact = raw.replace(/[^a-z0-9]+/g, ''); 
 return normalized === 'gpt-image-2' 
 || normalized.startsWith('gpt-image-2-') 
 || normalized.endsWith('-gpt-image-2') 
 || normalized.includes('-gpt-image-2-') 
 || compact === 'gptimage2' 
 || compact.startsWith('gptimage2') 
 || compact.endsWith('gptimage2'); 
}

function ratioLabel(prefix=''){
    const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
    const customKey = prefix ? `${prefix}CustomRatio` : 'customRatio';
    const sourceLabel = S().sourceImageRatioLabel(prefix) || S().tr('smart.imageRatio');
    const map = {square:'1:1', portrait:'2:3', landscape:'3:2', portrait43:'3:4', landscape43:'4:3', story:'9:16', wide:'16:9', ultrawide:'21:9', ultratall:'9:21', source:sourceLabel, custom:S().settings[customKey] || S().tr('smart.custom')};
    return map[S().settings[ratioKey] || 'square'] || '1:1';
}

function selectedImageForHd(node){
    const imgs = S().imagesForNode(node).filter(img => img?.url && S().mediaKindForItem(img) === 'image');
    if(S().selectedImage.nodeId === node?.id && S().selectedImage.index >= 0 && imgs[S().selectedImage.index]) return imgs[S().selectedImage.index];
    return imgs[0] || null;
}

function scaledImageSizeForSelectedNode(node, scale=1){
    const factor = Math.max(1, Math.min(4, Number(scale) || 1));
    const image = selectedImageForHd(node);
    const natural = S().imageSizeForRatio(image);
    let width = natural?.w || natural?.width || 0;
    let height = natural?.h || natural?.height || 0;
    if(!width || !height){
        const parsed = S().parseSizeValue(S().sizeForRun(S().settings));
        width = Number(parsed?.width || 0);
        height = Number(parsed?.height || 0);
    }
    if(!width || !height){
        const rect = S().nodeRect(node);
        width = Math.max(512, Math.round(Number(rect.width || 1024)));
        height = Math.max(512, Math.round(Number(rect.height || 1024)));
    }
    const snap = value => Math.max(64, Math.min(8192, Math.round((Number(value) || 1024) / 16) * 16));
    return {width:snap(width * factor), height:snap(height * factor)};
}

    const api = Object.freeze({
        registerDeps,
        nearestFourKSizeFor,
        exceedsFourKStandard,
        withOutpaintDisplaySettings,
        stripOutpaintDisplaySettings,
        smartSettingsForNode,
        activeSettingsSubject,
        activeComposerNode,
        persistActiveSmartSettings,
        parseSizeValue,
        snapOutputSize,
        scaleSizeToLongSide,
        resolveImageDimensions,
        sourceReferenceImageCandidates,
        sourceReferenceImageForSize,
        ensureImageDimensions,
        sourceReferenceImageForSizeAsync,
        parseRatioValue,
        apiImageSize,
        gcdInt,
        imageSizeForRatio,
        sourceRatioImageForNode,
        reducedRatioForImage,
        sourceImageRatioLabel,
        applySourceRatioToSettings,
        sizeForRun,
        sizeForRunAsync,
        isGptImageAutoSizeModel,
        ratioLabel,
        selectedImageForHd,
        scaledImageSizeForSelectedNode,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('composerSettings', api);
    global.SmartCanvasComposerSettings = api;
})(window);
