/**
 * Smart Canvas — node type normalization and legacy migration helpers.
 */
(function(global){
    'use strict';
    const AUDIO_PANEL_PREVIOUS_DEFAULT_WIDTH = 400;
    const AUDIO_PANEL_PREVIOUS_DEFAULT_HEIGHT = 200;
    const AUDIO_PANEL_DEFAULT_WIDTH = 460;
    const AUDIO_PANEL_DEFAULT_HEIGHT = 230;
    const UNIFIED_TEXT_PREVIOUS_DEFAULT_WIDTH = 400;
    const UNIFIED_TEXT_DEFAULT_WIDTH = 460;
    const UNIFIED_TEXT_PREVIOUS_DEFAULT_MAIN_HEIGHT = 120;
    const UNIFIED_TEXT_AUDIO_PARITY_MAIN_HEIGHT = 150;
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeModel] deps not registered');
        return c;
    }

function isHistoryGroupNode(node){
    return Boolean(S().isSmartImageNode(node) && (node.isHistoryGroup || node.historyFor));
}

function normalizeSmartImageMode(mode){
    return 'self';
}

function smartImageMode(node){
    return 'self';
}

function setSmartImageMode(node, mode){
    if(!S().isSmartImageNode(node)) return;
    delete node.imageMode;
}

function smartImageUsesWorkflowInput(node, ctx=S().smartLoopContext){
    return Boolean(S().isSmartImageNode(node) && ctx?.forceWorkflow);
}

function typedPlaceholderKind(node, preferredKind){
    if(['image', 'video', 'audio'].includes(preferredKind)) return preferredKind;
    const candidate = node?.pendingOutputKind || node?.outputKind || node?.portLinkKind || node?.runSettings?.apiKind;
    return ['image', 'video', 'audio'].includes(candidate) ? candidate : 'image';
}

function clearGenerationBatchMeta(node){
    if(!node || typeof node !== 'object') return;
    node.pending = 0;
    node.running = false;
    node.queued = false;
    node.jimengPending = false;
    delete node.pendingTasks;
    delete node._cancelledPendingSlots;
    delete node._cancelledTaskIds;
    delete node.lastGenerationError;
    delete node.pendingOutputKind;
    delete node._pendingOutputSourceId;
    delete node._pendingCellW;
    delete node._pendingCellH;
    delete node._pendingCellAspect;
    delete node._selectAfterRunId;
    delete node._runMetaTargetId;
    delete node.runStartedAt;
    delete node.runFinishedAt;
    delete node.runElapsedMs;
    delete node.w;
    delete node.h;
}

function applyTypedPlaceholderDefaultSize(node, preferredKind, options={}){
    if(!node || typeof node !== 'object') return node;
    const kind = typedPlaceholderKind(node, preferredKind);
    const hasExplicitSize = Number(node.w) > 24 && Number(node.h) > 24;
    const hasPreviousAudioDefault = Number(node.w) === AUDIO_PANEL_PREVIOUS_DEFAULT_WIDTH
        && Number(node.h) === AUDIO_PANEL_PREVIOUS_DEFAULT_HEIGHT;
    if(kind === 'audio' && (options.force === true || !hasExplicitSize || hasPreviousAudioDefault)){
        node.w = AUDIO_PANEL_DEFAULT_WIDTH;
        node.h = AUDIO_PANEL_DEFAULT_HEIGHT;
    } else if(kind !== 'audio' && options.force === true){
        delete node.w;
        delete node.h;
    }
    return node;
}

function ensureTypedPlaceholder(node, preferredKind){
    if(!node || typeof node !== 'object') return node;
    if(node.type !== 'smart-image' || (Array.isArray(node.images) && node.images.length)) return node;
    const kind = typedPlaceholderKind(node, preferredKind);
    node.type = 'smart-image';
    node.typePlaceholder = true;
    node.portLinkKind = kind;
    node.outputKind = kind;
    node.title = ({image:'Image', video:'Video', audio:'Audio'})[kind];
    node.runTimerHidden = true;
    clearGenerationBatchMeta(node);
    applyTypedPlaceholderDefaultSize(node, kind);
    return node;
}

function normalizeLegacySmartNode(node){
    if(!node || typeof node !== 'object') return node;
    if(node.type === 'smart-container'){
        const fallbackImage = node.inputImage?.url ? S().stripImageGenerationMeta({
            url:node.inputImage.url,
            name:node.inputImage.name || 'image',
            kind:node.inputImage.kind || S().mediaKindForItem(node.inputImage),
            natural_w:Number(node.inputImage.natural_w || 0),
            natural_h:Number(node.inputImage.natural_h || 0)
        }) : null;
        const images = Array.isArray(node.images) && node.images.length
            ? node.images
            : (fallbackImage ? [fallbackImage] : []);
        const normalized = {
            ...node,
            type:'smart-image',
            title:images.length > 1 ? 'Group' : (images.length ? 'Image' : 'Image'),
            images
        };
        delete normalized.imageMode;
        delete normalized.inputImage;
        delete normalized.steps;
        delete normalized.resultGrouping;
        if(!images.length) ensureTypedPlaceholder(normalized);
        return normalized;
    }
    if(!node.type) node.type = 'smart-image';
    if(node.type === 'smart-image') delete node.imageMode;
    if(node.type === 'smart-image' && node.historyFor) node.isHistoryGroup = true;
    const nodeImages = Array.isArray(node.images) ? node.images : [];
    if(node.type === 'smart-image' && nodeImages.length <= 1 && Number(node.scale) === 2){
        const image = nodeImages[0];
        const naturalW = Number(image?.natural_w || image?.width || 0);
        const naturalH = Number(image?.natural_h || image?.height || 0);
        const previousFit = naturalW > 0 && naturalH > 0 ? Math.min(520 / naturalW, 440 / naturalH) : 0;
        const previousW = previousFit ? Math.max(72, Math.round(naturalW * previousFit)) : 520;
        const previousH = previousFit ? Math.max(72, Math.round(naturalH * previousFit)) : 360;
        const usesPreviousDefaultSize = nodeImages.length === 0
            || (!S().isAudioMediaItem(image)
                && Math.abs(Number(node.w) - previousW) <= 1
                && Math.abs(Number(node.h) - previousH) <= 1);
        if(usesPreviousDefaultSize) node.scale = 2.3;
        if(nodeImages.length === 1 && usesPreviousDefaultSize){
            node.w = Math.round(Number(node.w) * 1.15);
            node.h = Math.round(Number(node.h) * 1.15);
        }
    }
    const legacyTextMainHeight = Math.round(Number(node.promptMainHeight));
    const isUnifiedText = node.type === 'smart-prompt'
        && node.llmEnabled === true
        && node.llmComposerUnified === true;
    if(isUnifiedText){
        if(Number(node.w) === UNIFIED_TEXT_PREVIOUS_DEFAULT_WIDTH) node.w = UNIFIED_TEXT_DEFAULT_WIDTH;
        if(legacyTextMainHeight === UNIFIED_TEXT_PREVIOUS_DEFAULT_MAIN_HEIGHT){
            node.promptMainHeight = UNIFIED_TEXT_AUDIO_PARITY_MAIN_HEIGHT;
        }
        if(Number(node.h) === AUDIO_PANEL_PREVIOUS_DEFAULT_HEIGHT) node.h = AUDIO_PANEL_DEFAULT_HEIGHT;
    }
    const isIdleUnifiedText = node.type === 'smart-prompt'
        && node.llmEnabled === true
        && node.llmComposerUnified === true
        && !String(node.text || '').trim()
        && !node.pending
        && !node.running;
    if(isIdleUnifiedText && [122, 220].includes(legacyTextMainHeight)){
        node.promptMainHeight = UNIFIED_TEXT_AUDIO_PARITY_MAIN_HEIGHT;
        node.h = AUDIO_PANEL_DEFAULT_HEIGHT;
    }
    const images = nodeImages;
    const isIdleEmptyImage = node.type === 'smart-image'
        && images.length === 0
        && !node.pending
        && !node.running
        && !node.jimengPending
        && !node.queued;
    if(isIdleEmptyImage && node.typePlaceholder !== true){
        ensureTypedPlaceholder(node);
    } else if(isIdleEmptyImage){
        applyTypedPlaceholderDefaultSize(node);
    }
    return node;
}

function validOutpaintSize(node){
    const w = Math.round(Number(node?.outpaintSize?.width || 0));
    const h = Math.round(Number(node?.outpaintSize?.height || 0));
    return w > 0 && h > 0 ? {width:w, height:h} : null;
}

function parseSizePair(value){
    const match = String(value || '').match(/(\d+)\s*x\s*(\d+)/i);
    return match ? {width:Number(match[1]), height:Number(match[2])} : null;
}

    const api = Object.freeze({
        registerDeps,
        isHistoryGroupNode,
        normalizeSmartImageMode,
        smartImageMode,
        setSmartImageMode,
        smartImageUsesWorkflowInput,
        typedPlaceholderKind,
        clearGenerationBatchMeta,
        applyTypedPlaceholderDefaultSize,
        ensureTypedPlaceholder,
        normalizeLegacySmartNode,
        validOutpaintSize,
        parseSizePair
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeModel', api);
    global.SmartCanvasNodeModel = api;
})(window);
