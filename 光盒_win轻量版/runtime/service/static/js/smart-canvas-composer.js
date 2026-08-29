/**
 * Smart Canvas — composer panel module (generation UI shell).
 * Params rendering (renderDynamicParams, pills) remains in smart-canvas.js until next split phase.
 * @see SmartCanvasCore.BOUNDARIES.composer
 */
(function(global){
    'use strict';

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function positionComposerForNode(node){
        const deps = d();
        if(!deps?.composer) return;
        // Bottom sheet: fixed anchor at shell bottom; clear legacy node-relative inline coords.
        deps.composer.style.left = '';
        deps.composer.style.top = '';
        deps.composer.style.width = '';
        // Height is content-driven. Clear the legacy fixed-height override so
        // co-create prompt rows can grow the bottom sheet upward naturally.
        deps.composer.style.removeProperty('--composer-sheet-h');
    }

    function scheduleComposerReposition(node){
        if(!node) return;
        positionComposerForNode(node);
        requestAnimationFrame(() => positionComposerForNode(node));
    }

    function renderInputPromptPreview(node){
        const deps = d();
        const el = deps.inputPromptPreview;
        if(!el) return;
        el.classList.remove('has-text');
        el.innerHTML = '';
    }

    function renderInputThumbsRow(node){
        const deps = d();
        const row = deps.inputThumbsRow;
        if(!row) return;
        const multiRefs = global.SmartCanvasMultiSelectCompose?.referenceImagesForSubject?.(node);
        const textRefs = global.SmartCanvasComposerText?.referencesFor?.(node);
        const rawRefs = Array.isArray(multiRefs)
            ? multiRefs
            : Array.isArray(textRefs)
            ? textRefs
            : (node ? deps.visibleReferenceImagesFor(node) : []);
        const dedup = global.SmartCanvasComposerInputThumbs?.orderedInputThumbItems?.(node, rawRefs) || rawRefs;
        const count = Array.isArray(dedup) ? dedup.length : 0;
        row.classList.toggle('has-items', Boolean(node));
        row.classList.toggle('has-previews', count > 0);
        row.classList.toggle('is-stacked', count > 1);
        if(!node){ row.innerHTML = ''; return; }
        const thumbsHtml = dedup.map((img, i) => {
            const isVid = deps.isVideoMediaItem(img);
            const isSelf = node ? deps.isSelfReferenceForNode(node, img) : false;
            const title = isSelf
                ? deps.tr('smart.inputSelf')
                : (deps.smartImageMode(node) === 'workflow' ? deps.tr('smart.inputUpstreamWorkflow') : deps.tr('smart.inputUpstream'));
            const inner = isVid ? `<video src="${deps.escapeHtml(img.url)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>` : `<img src="${deps.escapeHtml(img.url)}" draggable="false">`;
            const label = `图${i + 1}`;
            const sourceUrl = img.originalLocalUrl || img.url || '';
            return `<div class="input-thumb ${isSelf ? 'input-self' : ''}" style="--thumb-i:${i}" draggable="false" data-reorderable="${count > 1 ? 'true' : 'false'}" data-thumb-index="${i}" data-node-id="${deps.escapeHtml(img.nodeId || '')}" data-image-index="${img.imageIndex ?? ''}" data-url="${deps.escapeHtml(img.url || '')}" data-source-url="${deps.escapeHtml(sourceUrl)}" title="${deps.escapeHtml(`${img.name || deps.tr('smart.inputNum').replace('{n}', String(i + 1))} · ${title}`)}">${inner}<span class="input-thumb-label">${deps.escapeHtml(label)}</span></div>`;
        }).join('');
        const uploadButton = `<button type="button" class="input-thumb input-thumb-upload" data-input-upload-media="1" title="上传并连接素材" aria-label="上传并连接素材"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-linecap="round"/></svg></button>`;
        row.innerHTML = `<div class="input-thumb-list" style="--thumb-count:${Math.max(count, 0)}">${thumbsHtml}${uploadButton}</div>`;
        if(typeof deps.bindInputThumbsDrag === 'function') deps.bindInputThumbsDrag(node, dedup);
        global.SmartCanvasComposerInputThumbs?.bindInputThumbReferenceActions?.();
    }

    function updateComposer(){
        const deps = d();
        if(!deps) return;
        global.SmartCanvasMultiSelectCompose?.syncUi?.();
        const node = global.SmartCanvasMultiSelectCompose?.composerSubject?.() || deps.selectedNode();
        const isPsdSubject = Boolean(node?.images?.length === 1 && deps.mediaKindForItem?.(node.images[0]) === 'psd');
        if(isPsdSubject){
            deps.savePromptDraftForCurrent();
            deps.composer.classList.remove('open', 'generating');
            if(deps.cascadeRunBtn) deps.cascadeRunBtn.style.display = 'none';
            global.SmartCanvasComposerText?.syncComposer?.(null);
            deps.activeComposerSubject = null;
            deps.lastComposerNodeId = '';
            deps.setPromptInputLocked(false);
            return;
        }
        const isGenerating = Boolean(node && (node.pending || node.running || node.jimengPending || node.queued));
        if(isGenerating){
            deps.savePromptDraftForCurrent();
            deps.composer.classList.remove('open', 'generating');
            if(deps.cascadeRunBtn) deps.cascadeRunBtn.style.display = 'none';
            global.SmartCanvasComposerText?.syncComposer?.(null);
            deps.activeComposerSubject = null;
            deps.lastComposerNodeId = '';
            deps.setPromptInputLocked(false);
            return;
        }
        const isTextSubject = global.SmartCanvasComposerText?.isTextSubject?.(node) === true;
        if(deps.smartCascadeSilentSelection && !deps.activeComposerSubject){
            deps.composer.classList.remove('open');
            if(deps.cascadeRunBtn) deps.cascadeRunBtn.style.display = 'none';
            deps.activeComposerSubject = null;
            deps.lastComposerNodeId = '';
            return;
        }
        deps.composer.classList.toggle('open', !!node);
        deps.composer.classList.remove('generating');
        if(!deps.isSmartImageNode(node) && !isTextSubject){
            if(deps.cascadeRunBtn) deps.cascadeRunBtn.style.display = 'none';
            deps.savePromptDraftForCurrent();
            deps.composer.classList.remove('open');
            global.SmartCanvasComposerText?.syncComposer?.(null);
            deps.activeComposerSubject = null;
            deps.lastComposerNodeId = '';
            deps.setPromptInputLocked(false);
            if(!node) deps.setPromptText('');
            return;
        }
        const subject = node;
        const composerKey = `${node.id}:${isTextSubject ? 'text' : 'node'}`;
        const switchedNode = deps.lastComposerNodeId !== composerKey;
        if(switchedNode) deps.savePromptDraftForCurrent();
        if(switchedNode && global.SmartCanvasCoCreate?.savePromptsToNode){
            const prevId = String(deps.lastComposerNodeId || '').split(':')[0];
            const prevNode = prevId ? deps.nodes.find(n => n.id === prevId) : null;
            if(prevNode) global.SmartCanvasCoCreate.savePromptsToNode(prevNode);
        }
        deps.lastComposerNodeId = composerKey;
        deps.activeComposerSubject = subject;
        if(isTextSubject){
            if(switchedNode) global.SmartCanvasComposerText?.loadInput?.(subject);
            deps.setPromptInputLocked(false);
            if(deps.cascadeRunBtn) deps.cascadeRunBtn.style.display = 'none';
            deps.promptInput.style.setProperty('--prompt-h', '84px');
            renderInputThumbsRow(node);
            renderInputPromptPreview(node);
            global.SmartCanvasComposerText?.syncComposer?.(node);
            scheduleComposerReposition(node);
            return;
        }
        if(switchedNode){
            deps.settings = deps.smartSettingsForNode(subject);
            global.SmartCanvasComposerText?.syncMediaSettingsFromNode?.(deps.settings, subject);
            const sourceImages = deps.sourceReferenceImageCandidates?.(subject) || [];
            const hasExplicitNodeRatio = subject?.runSettings?.ratioExplicit === true;
            if(deps.settings.apiKind !== 'video' && !hasExplicitNodeRatio){
                deps.settings.ratioExplicit = false;
                deps.settings.ratio = 'source';
                if(sourceImages.length){
                    deps.applySourceRatioToSettings?.('', subject);
                }
            }
        }
        const absorbedUpstreamText = global.SmartCanvasPromptDraft?.syncUpstreamTextIntoDraft?.(subject) === true;
        if(switchedNode || absorbedUpstreamText) deps.loadPromptDraft(subject);
        deps.setPromptInputLocked(false);
        deps.syncCascadeRunButton(node);
        deps.promptInput.style.setProperty('--prompt-h', '84px');
        renderInputThumbsRow(node);
        renderInputPromptPreview(node);
        deps.syncCascadeRunButton(node);
        deps.updateProviderModels();
        global.SmartCanvasComposerText?.syncComposer?.(node);
        global.SmartCanvasCoCreate?.syncComposer?.(node);
        scheduleComposerReposition(node);
    }

    const api = Object.freeze({
        positionComposerForNode,
        scheduleComposerReposition,
        renderInputPromptPreview,
        renderInputThumbsRow,
        updateComposer
    });

    global.SmartCanvasCore.register('composer', api);
    global.SmartCanvasComposer = api;
})(window);
