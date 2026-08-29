/**
 * Smart Canvas — chrome UI (left sidebar, panels, composer, keyboard).
 * @see SmartCanvasCore.BOUNDARIES.uiChrome
 */
(function(global){
    'use strict';
    let chromeBound = false;

    function clearPromptCaretOutside(ctx, event){
        const input = ctx?.promptInput;
        const target = event?.target;
        if(!input || !target || input.contains(target)) return false;
        const selection = global.getSelection?.();
        const selectionBelongsToInput = Boolean(
            selection?.anchorNode && input.contains(selection.anchorNode)
        );
        if(document.activeElement === input) input.blur?.();
        if(selectionBelongsToInput) selection.removeAllRanges?.();
        ctx.closeMentionPicker?.();
        return true;
    }
    function bindTopActions(ctx){
        /* new canvas / asset / settings → smart-canvas-left-rail.js */
    }

    function bindChrome(ctx){
        if(!ctx) return;
        if(chromeBound) return;
        chromeBound = true;
        const liveCtx = () => {
            try {
                return global.SmartCanvasUiContext?.buildSmartCanvasUiContext?.() || ctx;
            } catch {
                return ctx;
            }
        };
        try {
            bindTopActions(ctx);
            global.SmartCanvasLeftRail?.bindLeftRail?.(ctx);
            global.SmartCanvasBottomChrome?.bindBottomChrome?.(ctx);
window.addEventListener('paste', e => {
    const current = liveCtx();
    if(current.isEditableTarget?.(e.target)) return;
    const files = [...(e.clipboardData?.files || [])].filter(current.isSupportedUploadFile);
    if(files.length){
        e.preventDefault();
        current.lastImagePasteAt = Date.now();
        current.handleFiles(files, current.selectedId);
        return;
    }
    if(current.nodeClipboard?.nodes?.length){
        e.preventDefault();
        current.pasteNodes();
    }
});
window.addEventListener('keydown', e => {
    const current = liveCtx();
    const key = String(e.key || '').toLowerCase();
    if((e.ctrlKey || e.metaKey) && key === 'z' && ctx.imageEditModal?.classList.contains('open') && ctx.imageEditMode === 'cutout' && !ctx.isEditableTarget(e.target)){
        e.preventDefault();
        ctx.undoCutoutSelection();
        return;
    }
    if(ctx.imageEditModal?.classList.contains('open') && !ctx.isEditableTarget(e.target)){
        if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
            e.preventDefault();
            if(!ctx.seekPreviewVideoFrames(e.key === 'ArrowLeft' ? -1 : 1)){
                ctx.navigatePreviewImage(e.key === 'ArrowLeft' ? -1 : 1);
            }
            return;
        }
    }
    if(!e.ctrlKey && !e.metaKey && !e.altKey && !ctx.isEditableTarget(e.target)){
        if(key === 'z'){
            if(e.repeat) return;
            e.preventDefault();
            ctx.toggleZoomPreview();
            return;
        }
        if(key === 'a'){
            if(e.repeat) return;
            e.preventDefault();
            ctx.toggleAssetLibrary();
            return;
        }
    }
    if((e.ctrlKey || e.metaKey) && key === 'c' && !current.isEditableTarget(e.target)){
        const selectionText = window.getSelection?.().toString() || '';
        if(selectionText) return;
        e.preventDefault();
        current.focusCanvasForShortcuts?.();
        current.copySelectedNodes();
        return;
    }
    if((e.ctrlKey || e.metaKey) && key === 'v' && !current.isEditableTarget(e.target)){
        const requestedAt = Date.now();
        // Prefer immediate node paste when internal clipboard has content.
        if(current.nodeClipboard?.nodes?.length){
            e.preventDefault();
            current.focusCanvasForShortcuts?.();
            current.pasteNodes();
            return;
        }
        setTimeout(() => {
            const latest = liveCtx();
            if(latest.lastImagePasteAt >= requestedAt) return;
            if(latest.lastNodePasteAt >= requestedAt) return;
            if(!latest.nodeClipboard?.nodes?.length) return;
            latest.pasteNodes();
        }, 90);
    }
    if(e.key === 'Escape' && ctx.imageEditModal?.classList.contains('open')){
        ctx.closeImageEditor();
        return;
    }
    if((e.ctrlKey || e.metaKey) && key === 'z' && !ctx.isEditableTarget(e.target)){
        e.preventDefault();
        ctx.performUndo();
        return;
    }
    if(global.SmartCanvasIsolatedFeatures?.handleDeleteHotkey?.(e, ctx)) return;
    if(e.ctrlKey && e.shiftKey && key === 'g' && !ctx.isEditableTarget(e.target)){
        e.preventDefault();
        const ids = ctx.selectedIds.length ? ctx.selectedIds.slice() : (ctx.selectedId ? [ctx.selectedId] : []);
        const ok = ids.map(id => ctx.ungroupNode(id)).some(Boolean);
        if(ok) return;
    }
    if(e.ctrlKey && String(e.key).toLowerCase() === 'g' && !e.shiftKey && !ctx.isEditableTarget(e.target)){
        e.preventDefault();
        ctx.groupSelectedNodes();
    }
});
if(ctx.runBtn) ctx.runBtn.onclick = async () => {
    if(await window.SmartCanvasMultiSelectCompose?.runIfActive?.()) return;
    if(await window.SmartCanvasComposerText?.runIfActive?.()) return;
    return ctx.runGeneration();
};
if(ctx.regenerateBtn && typeof ctx.runSelectedImageRegeneration === 'function') ctx.regenerateBtn.onclick = ctx.runSelectedImageRegeneration;
if(ctx.imageHdPopover){
    ctx.imageHdPopover.querySelectorAll('[data-hd-scale]').forEach(btn => {
        btn.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            ctx.setComposerHdScale(btn.dataset.hdScale);
        };
    });
}
if(ctx.imageHdCancel) ctx.imageHdCancel.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    ctx.setComposerHdScale(1);
    ctx.closeComposerHdPopover();
};
if(ctx.imageHdApply) ctx.imageHdApply.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    ctx.closeComposerHdPopover();
    ctx.runGeneration({overwrite:true, hdScale:ctx.composerHdScale});
};
if(ctx.cascadeRunBtn) ctx.cascadeRunBtn.onclick = () => {
    const node = ctx.selectedNode();
    const loopId = ctx.resolveSmartCascadeLoop(node?.id)?.node?.id || '';
    if(loopId && ctx.smartCascadeIsLoopRunning(loopId)) {
        ctx.requestSmartCascadeStop(loopId);
        return;
    }
    ctx.runSmartCascade();
};
if(ctx.fileInput) ctx.fileInput.onchange = () => {
    const groupPoint = ctx.pendingGroupUploadPoint;
    if(!ctx.fileInput.files?.length){
        ctx.pendingGroupUploadPoint = null;
        ctx.uploadTargetId = '';
        return;
    }
    const targetId = groupPoint ? '' : (ctx.uploadTargetId || ctx.selectedId);
    ctx.handleFiles(ctx.fileInput.files, targetId, groupPoint ? {point:groupPoint} : {});
    ctx.pendingGroupUploadPoint = null;
    ctx.uploadTargetId = '';
    ctx.fileInput.value = '';
};
if(ctx.assetCloseBtn && ctx.assetCloseBtn.dataset.boundAssetClose !== '1'){
    ctx.assetCloseBtn.dataset.boundAssetClose = '1';
    const closeAssetPanel = event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        ctx.toggleAssetLibrary?.(false);
    };
    ctx.assetCloseBtn.addEventListener('pointerdown', closeAssetPanel, true);
    ctx.assetCloseBtn.addEventListener('click', closeAssetPanel, true);
}
ctx.assetPanel?.addEventListener('pointerdown', e => e.stopPropagation());
ctx.assetPanel?.addEventListener('mousedown', e => e.stopPropagation());
ctx.assetPanel?.addEventListener('click', e => {
    if(ctx.handleAssetPromptToolHit?.(e)) return;
    const hasOpenPrompt = document.getElementById('assetPromptLibrary')?.querySelector?.('.asset-prompt-item.is-open');
    if(hasOpenPrompt && !e.target.closest('.asset-prompt-item,.asset-prompt-tools,.asset-prompt-category-bar,.asset-tabs,.asset-head,[data-prompt-open],button,input,textarea,select')){
        window.SmartCanvasAssetPromptUi?.closeDetail?.();
    }
    e.stopPropagation();
});
ctx.assetPanel?.addEventListener('wheel', e => {
    e.stopPropagation();
    const scroller = e.target.closest?.('.asset-grid,.asset-prompt-list') || ctx.assetGrid;
    if(!scroller || getComputedStyle(scroller).display === 'none') return;
    const canScroll = scroller.scrollHeight > scroller.clientHeight || scroller.scrollWidth > scroller.clientWidth;
    if(!canScroll) return;
    e.preventDefault();
    scroller.scrollTop += e.deltaY;
    scroller.scrollLeft += e.deltaX;
}, {passive:false, capture:true});
ctx.assetDialogBackdrop?.addEventListener('pointerdown', e => e.stopPropagation());
ctx.assetDialogBackdrop?.addEventListener('mousedown', e => e.stopPropagation());
ctx.assetDialogBackdrop?.addEventListener('click', e => e.stopPropagation());
ctx.promptPresetPanel?.addEventListener('pointerdown', e => e.stopPropagation());
ctx.promptPresetPanel?.addEventListener('mousedown', e => e.stopPropagation());
ctx.promptPresetPanel?.addEventListener('click', e => e.stopPropagation());
ctx.promptTemplatePanel?.addEventListener('pointerdown', e => e.stopPropagation());
ctx.promptTemplatePanel?.addEventListener('mousedown', e => e.stopPropagation());
ctx.promptTemplatePanel?.addEventListener('wheel', e => e.stopPropagation(), {passive:false});
ctx.promptTemplatePanel?.addEventListener('click', e => {
    e.stopPropagation();
    const apply = e.target.closest('[data-template-apply]');
    if(apply){ ctx.applyPromptTemplateToNode(apply.dataset.templateApply || 'positive'); return; }
    if(e.target.closest('[data-template-save-current]')){ ctx.saveCurrentPromptAsTemplate(); return; }
    if(e.target.closest('[data-template-new]')){ ctx.createBlankPromptTemplate(); return; }
    if(e.target.closest('[data-template-edit]')) { ctx.promptTemplateEditing = true; ctx.renderPromptTemplatePanel(); return; }
    if(e.target.closest('[data-template-edit-cancel]')) { ctx.promptTemplateEditing = false; ctx.renderPromptTemplatePanel(); return; }
    if(e.target.closest('[data-template-edit-save]')){ ctx.savePromptTemplateEdit(); return; }
    if(e.target.closest('[data-template-delete]')){ ctx.deletePromptTemplate(); return; }
    const cat = e.target.closest('[data-template-cat]');
    if(cat){
        ctx.promptTemplateCategory = cat.dataset.templateCat || 'all';
        ctx.promptTemplateSelectedId = '';
        ctx.promptTemplateEditing = false;
        ctx.renderPromptTemplatePanel({preserveScroll:false});
        return;
    }
    const catEdit = e.target.closest('[data-template-cat-edit]');
    if(catEdit){
        const id = catEdit.dataset.templateCatEdit || '';
        ctx.renamePromptTemplateGroup(id);
        return;
    }
    const catDelete = e.target.closest('[data-template-cat-delete]');
    if(catDelete){
        ctx.deletePromptTemplateGroup(catDelete.dataset.templateCatDelete || '');
        return;
    }
    if(e.target.closest('[data-template-group-edit]')){
        ctx.promptTemplateGroupEditMode = !ctx.promptTemplateGroupEditMode;
        ctx.renderPromptTemplatePanel({preserveScroll:false});
        return;
    }
    if(e.target.closest('[data-template-cat-new]')) { ctx.createPromptTemplateGroup(); return; }
    const card = e.target.closest('[data-template-id]');
    if(card){
        ctx.promptTemplateSelectedId = card.dataset.templateId || '';
        ctx.promptTemplateEditing = false;
        ctx.renderPromptTemplatePanel();
        return;
    }
});
if(ctx.promptPresetClose) ctx.promptPresetClose.onclick = ctx.closePromptPresetPanel;
if(ctx.promptTemplateClose) ctx.promptTemplateClose.onclick = ctx.closePromptTemplatePanel;
if(ctx.promptTemplateSearch) ctx.promptTemplateSearch.oninput = () => ctx.renderPromptTemplatePanel({preserveScroll:false});
if(ctx.promptTemplateLibrarySelect) ctx.promptTemplateLibrarySelect.onchange = () => {
    ctx.activePromptLibraryId = ctx.promptTemplateLibrarySelect.value || 'system';
    ctx.promptTemplateSelectedId = '';
    ctx.promptTemplateEditing = false;
    ctx.renderPromptTemplatePanel({preserveScroll:false});
};
if(ctx.composerTemplateBtn) ctx.composerTemplateBtn.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    if(ctx.promptTemplatePanel?.classList?.contains('open') && ctx.promptTemplatePanel.dataset.target === 'composer'){
        ctx.closePromptTemplatePanel();
        return;
    }
    ctx.openPromptTemplatePanel(ctx.activeComposerNode()?.id || ctx.selectedNode()?.id || '', ctx.promptTemplateSelectedId, {target:'composer'});
};
if(ctx.promptPresetSelect) ctx.promptPresetSelect.onchange = () => ctx.renderPromptPresetPanel(ctx.promptPresetSelect.value);
[ctx.promptPresetName, ctx.promptPresetText].forEach(input => {
    input?.addEventListener('input', () => {
        ctx.resetPromptPresetDeleteState();
        ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetEditing'));
    });
});
if(ctx.promptPresetApply) ctx.promptPresetApply.onclick = () => {
    const preset = ctx.currentPromptPreset(ctx.promptPresetSelect.value);
    const node = ctx.promptPresetPanelNode();
    if(!preset || !node) return;
    node.promptPresetId = preset.id;
    node.text = preset.text || '';
    ctx.closePromptPresetPanel();
    ctx.render();
    ctx.scheduleSave();
};
if(ctx.promptPresetSave) ctx.promptPresetSave.onclick = () => {
    const preset = ctx.currentPromptPreset(ctx.promptPresetSelect.value);
    if(!preset) return;
    const name = ctx.promptPresetName.value.trim();
    const text = ctx.promptPresetText.value.trim();
    if(!name || !text){ ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetRequired'), 'warn'); return; }
    const idx = ctx.promptPresets.findIndex(p => p.id === preset.id);
    if(idx >= 0) ctx.promptPresets[idx] = {...ctx.promptPresets[idx], name, text, updatedAt:Date.now()};
    ctx.savePromptPresets();
    const node = ctx.promptPresetPanelNode();
    if(node?.promptPresetId === preset.id) node.text = text;
    ctx.renderPromptPresetPanel(preset.id, ctx.tr('smart.promptPresetSaved'));
    ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetSaved'), 'ok');
    ctx.render();
    ctx.scheduleSave();
};
if(ctx.promptPresetNew) ctx.promptPresetNew.onclick = () => {
    const node = ctx.promptPresetPanelNode();
    const preset = ctx.createPromptPresetFromNode(node, {openPanel:false});
    if(!preset) return;
    ctx.renderPromptPresetPanel(preset.id, ctx.tr('smart.promptPresetSavedNew'));
    ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetSavedNew'), 'ok');
    ctx.promptPresetName?.focus();
    ctx.promptPresetName?.select();
};
if(ctx.promptPresetDelete) ctx.promptPresetDelete.onclick = () => {
    const preset = ctx.currentPromptPreset(ctx.promptPresetSelect.value);
    if(!preset) return;
    if(!ctx.promptPresetDeleteArmed){
        ctx.promptPresetDeleteArmed = true;
        ctx.promptPresetDelete.textContent = ctx.tr('smart.promptPresetDeleteAgain');
        ctx.promptPresetDelete.classList.add('confirm-danger');
        ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetDeleteConfirm').replace('{name}', preset.name || ctx.tr('smart.promptPresetUnnamed')), 'warn');
        return;
    }
    ctx.promptPresets = ctx.promptPresets.filter(p => p.id !== preset.id);
    ctx.nodes.forEach(node => { if(node.promptPresetId === preset.id) node.promptPresetId = ''; });
    ctx.savePromptPresets();
    ctx.renderPromptPresetPanel(ctx.promptPresets[0]?.id || '', ctx.tr('smart.promptPresetDeleted'));
    ctx.setPromptPresetStatus(ctx.tr('smart.promptPresetDeleted'), 'ok');
    ctx.render();
    ctx.scheduleSave();
};
document.querySelectorAll('[data-asset-tab]').forEach(btn => {
    btn.onclick = () => {
        ctx.assetTab = ['image','prompt','audio','video'].includes(btn.dataset.assetTab) ? btn.dataset.assetTab : 'image';
        ctx.renderAssetLibrary();
        window.SmartCanvasAssetLibrary?.syncComposerAssetShortcuts?.();
    };
});
document.querySelectorAll('[data-composer-asset-library]').forEach(btn => {
    btn.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        const mode = ctx.apiKindToggle?.querySelector('[data-kind].active')?.dataset.kind
            || window.SmartCanvasComposerText?.modeFor?.(ctx.activeComposerNode?.() || ctx.selectedNode?.())
            || 'image';
        const tab = mode === 'text' ? 'prompt' : (['image','audio','video'].includes(mode) ? mode : 'image');
        const activePanelTab = ctx.assetLibraryOpen && ctx.assetPanel?.classList.contains('open') && ctx.assetTab === tab;
        if(activePanelTab){
            ctx.toggleAssetLibrary(false);
            return;
        }
        ctx.assetTab = tab;
        ctx.toggleAssetLibrary(true);
        ctx.renderAssetLibrary();
    };
});
if(ctx.assetLibrarySelect) ctx.assetLibrarySelect.onchange = () => {
    ctx.activeAssetLibraryId = ctx.assetLibrarySelect.value || '';
    ctx.activeAssetCategoryId = '';
    ctx.mentionAssetCategoryId = '';
    ctx.normalizeActiveAssetCategory?.();
    ctx.renderAssetLibrary();
};
if(ctx.assetCategorySelect) ctx.assetCategorySelect.onchange = () => {
    ctx.activeAssetCategoryId = ctx.assetCategorySelect.value;
    ctx.normalizeActiveAssetCategory?.();
    ctx.renderAssetLibrary();
};
document.querySelectorAll('[data-asset-grid-size]').forEach(btn => {
    btn.onclick = () => {
        ctx.setAssetGridSize?.(btn.dataset.assetGridSize || 'm');
        ctx.renderAssetLibrary();
    };
});
ctx.assetDropZone?.addEventListener('dragover', e => {
    if(ctx.hasCanvasImageDrag(e) || ctx.hasSmartImageDropData(e.dataTransfer)){
        e.preventDefault();
        e.stopPropagation();
        ctx.assetDropZone?.classList.add('drag-over');
    }
});
ctx.assetDropZone?.addEventListener('dragleave', () => ctx.assetDropZone?.classList.remove('drag-over'));
ctx.assetDropZone?.addEventListener('drop', ctx.handleAssetPanelDrop);
ctx.assetPanel?.addEventListener('dragover', ctx.handleAssetPanelDragOver);
ctx.assetPanel?.addEventListener('dragleave', e => { if(!ctx.assetPanel?.contains(e.relatedTarget)) ctx.setAssetDragOver(false); });
ctx.assetPanel?.addEventListener('drop', ctx.handleAssetPanelDrop);
ctx.composer?.addEventListener('pointerdown', event => {
    clearPromptCaretOutside(ctx, event);
    event.stopPropagation();
});
ctx.composer?.addEventListener('mousedown', event => event.stopPropagation());
ctx.composer?.addEventListener('click', event => {
    if(!event.target.closest('.smart-control')) ctx.closeAllSmartPopovers();
    event.stopPropagation();
});
ctx.promptInput?.addEventListener('input', ctx.maybeOpenMentionPicker);
ctx.promptInput?.addEventListener('input', () => {
    delete ctx.promptInput.dataset.preserveDraftOnce;
    ctx.savePromptDraftForCurrent();
    ctx.renderInputThumbsRow(ctx.activeSettingsSubject?.() || ctx.selectedNode());
    ctx.scheduleSave();
});
ctx.promptInput?.addEventListener('keyup', ctx.maybeOpenMentionPicker);
ctx.promptInput?.addEventListener('mouseup', ctx.saveMentionRange);
ctx.promptInput?.addEventListener('focus', ctx.saveMentionRange);
ctx.promptInput?.addEventListener('keydown', event => {
    if(event.key === 'Escape') ctx.closeMentionPicker();
});
ctx.promptInput?.addEventListener('mouseover', event => {
    const token = event.target.closest?.('.mention-image-token');
    if(!token) return;
    let media = ctx.mentionPreview.querySelector('img,video');
    const isVideo = token.dataset.kind === 'video' || ctx.isVideoMediaItem({url:token.dataset.url, kind:token.dataset.kind});
    if(isVideo && media?.tagName?.toLowerCase() !== 'video'){
        media?.replaceWith(document.createElement('video'));
        media = ctx.mentionPreview.querySelector('video');
    } else if(!isVideo && media?.tagName?.toLowerCase() !== 'img'){
        media?.replaceWith(document.createElement('img'));
        media = ctx.mentionPreview.querySelector('img');
    }
    if(isVideo){
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.disablePictureInPicture = true;
        media.setAttribute('disablepictureinpicture', '');
        media.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
        media.src = token.dataset.url || '';
        media.play?.().catch(() => {});
    } else {
        media.src = token.dataset.url || '';
        media.alt = 'preview';
    }
    const rect = token.getBoundingClientRect();
    ctx.mentionPreview.style.left = `${Math.min(window.innerWidth - 236, rect.left)}px`;
    ctx.mentionPreview.style.top = `${Math.min(window.innerHeight - 236, rect.bottom + 8)}px`;
    ctx.mentionPreview.style.display = 'block';
});
ctx.promptInput?.addEventListener('mouseout', event => {
    if(event.target.closest?.('.mention-image-token')){
        ctx.mentionPreview.style.display = 'none';
        const media = ctx.mentionPreview.querySelector('img,video');
        media?.pause?.();
        media?.removeAttribute('src');
        media?.load?.();
    }
});
ctx.mentionPicker?.addEventListener('mousedown', event => event.stopPropagation());
document.addEventListener('click', event => {
    if(!event.target.closest('.smart-control')) ctx.closeAllSmartPopovers();
    if(!event.target.closest('.mention-picker') && !event.target.closest('#promptInput')) ctx.closeMentionPicker();
    if(!event.target.closest('.prompt-preset-panel') && !event.target.closest('.prompt-preset-edit') && !event.target.closest('.prompt-preset-save')) ctx.closePromptPresetPanel();
    if(!event.target.closest('.prompt-template-panel') && !event.target.closest('.prompt-preset-edit') && !event.target.closest('#composerTemplateBtn')) ctx.closePromptTemplatePanel();
});
document.addEventListener('keydown', event => {
    if(event.key === 'Escape') { ctx.closeAllSmartPopovers(); ctx.closeCreateMenu(); ctx.closeSmartCanvasLog(); ctx.closeSmartCanvasShortcuts(); ctx.closePromptPresetPanel(); ctx.closePromptTemplatePanel(); }
});
document.getElementById('cropBox')?.addEventListener('mousedown', event => liveCtx().beginCropDrag(event, 'move'));
document.getElementById('cropHandle')?.addEventListener('mousedown', event => liveCtx().beginCropDrag(event, 'resize'));
document.getElementById('outpaintFrame')?.addEventListener('mousedown', event => {
    if(event.target.closest('[data-outpaint-handle]')) return;
    liveCtx().beginCropDrag(event, 'image');
});
document.querySelectorAll('[data-outpaint-handle]').forEach(handle => {
    handle.addEventListener('mousedown', event => liveCtx().beginCropDrag(event, `outpaint-${handle.dataset.outpaintHandle || 'corner'}`));
});
document.getElementById('cropImage')?.addEventListener('mousedown', event => {
    const live = liveCtx();
    if(live.imageEditMode !== 'outpaint' || !live.cropState) return;
    document.getElementById('cropCanvas')?.classList.add('dragging-image');
    live.beginCropDrag(event, 'image');
});
document.querySelectorAll('[data-image-edit-mode]').forEach(btn => {
    btn.addEventListener('click', event => {
        event.stopPropagation();
        const mode = btn.dataset.imageEditMode || 'crop';
        const handler = global.setImageEditMode || liveCtx().setImageEditMode;
        handler?.(mode, true);
    });
});
ctx.imageEditModal?.addEventListener('pointerdown', event => {
    event.stopPropagation();
});
ctx.imageEditModal?.addEventListener('mousedown', event => {
    event.stopPropagation();
});
ctx.imageEditModal?.addEventListener('mousemove', event => {
    if(ctx.previewPanDrag || ctx.previewCompareDrag || ctx.panoramaState.drag || ctx.imageEditPanDrag || ctx.cropDrag) return;
    event.stopPropagation();
});
ctx.imageEditModal?.addEventListener('click', event => {
    event.stopPropagation();
    if(event.target === ctx.imageEditModal) ctx.closeImageEditor();
});
ctx.imageEditModal?.addEventListener('wheel', event => {
    event.stopPropagation();
}, {passive:false});
document.getElementById('previewStage')?.addEventListener('mousedown', event => {
    if(ctx.imageEditMode !== 'preview' || event.button !== 0) return;
    if(event.target.closest('.preview-tools-overlay, .preview-download-overlay')) return;
    if(event.target.closest('.preview-compare-handle')) return;
    if(event.target.closest('video')) return;
    event.preventDefault();
    event.stopPropagation();
    if(ctx.panoramaState.enabled){
        ctx.panoramaState.drag = {
            clientX:event.clientX,
            clientY:event.clientY,
            yaw:ctx.panoramaState.yaw,
            pitch:ctx.panoramaState.pitch
        };
        document.getElementById('previewStage')?.classList.add('panning');
        return;
    }
    ctx.previewPanDrag = {clientX:event.clientX, clientY:event.clientY, startX:ctx.previewPan.x, startY:ctx.previewPan.y};
});
document.getElementById('imageEditStage')?.addEventListener('mousedown', event => {
    if(ctx.imageEditMode === 'preview' || event.button !== 0) return;
    if(event.target.closest('.image-edit-actions, .preview-tools-overlay, .preview-download-overlay, .crop-box, .crop-handle')) return;
    if(event.target.closest('#editDrawCanvas, #editTextCanvas, .edit-text-inline') && ctx.imageEditMode !== 'crop') return;
    const stage = event.currentTarget;
    if(stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.imageEditPanDrag = {
        clientX:event.clientX,
        clientY:event.clientY,
        scrollLeft:stage.scrollLeft,
        scrollTop:stage.scrollTop
    };
});
document.getElementById('previewCompareHandle')?.addEventListener('mousedown', event => {
    if(ctx.imageEditMode !== 'preview' || !ctx.previewCompareOn || ctx.previewCompareIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.previewPanDrag = null;
    ctx.previewCompareDrag = true;
    ctx.setPreviewComparePos(event.clientX);
});
document.getElementById('previewCompareHandle')?.addEventListener('pointerdown', event => {
    if(ctx.imageEditMode !== 'preview' || !ctx.previewCompareOn || ctx.previewCompareIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    ctx.previewPanDrag = null;
    ctx.previewCompareDrag = true;
    ctx.setPreviewComparePos(event.clientX);
});
document.getElementById('previewCompareHandle')?.addEventListener('pointermove', event => {
    if(!ctx.previewCompareDrag) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.setPreviewComparePos(event.clientX);
});
document.getElementById('previewCompareHandle')?.addEventListener('pointerup', event => {
    if(ctx.previewCompareDrag){
        event.preventDefault();
        event.stopPropagation();
    }
    ctx.previewCompareDrag = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
});
document.getElementById('previewCompareHandle')?.addEventListener('pointercancel', event => {
    ctx.previewCompareDrag = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
});
document.getElementById('editDrawCanvas')?.addEventListener('pointerdown', ctx.beginEditDraw);
document.getElementById('editDrawCanvas')?.addEventListener('pointermove', ctx.moveEditDraw);
document.getElementById('editDrawCanvas')?.addEventListener('pointerup', ctx.endEditDraw);
document.getElementById('editDrawCanvas')?.addEventListener('pointercancel', ctx.endEditDraw);
document.getElementById('editDrawCanvas')?.addEventListener('pointerleave', ctx.endEditDraw);
document.getElementById('editTextCanvas')?.addEventListener('pointerdown', ctx.beginEditText);
document.getElementById('editTextCanvas')?.addEventListener('pointermove', ctx.moveEditText);
document.getElementById('editTextCanvas')?.addEventListener('pointerup', ctx.endEditText);
document.getElementById('editTextCanvas')?.addEventListener('pointercancel', ctx.endEditText);
document.getElementById('editTextCanvas')?.addEventListener('pointerleave', ctx.endEditText);
document.getElementById('editTextCanvas')?.addEventListener('dblclick', event => {
    if(ctx.imageEditMode !== 'brush' || ctx.brushTool !== 'text') return;
    event.preventDefault(); event.stopPropagation();
    const hit = ctx.hitEditTextItem(ctx.editTextPoint(event));
    if(hit){
        ctx.setSelectedEditTextItem(hit.id);
        ctx.beginEditTextInline(hit);
    }
});
['paintBrushSize','paintBrushColor'].forEach(id => {
    const control = document.getElementById(id);
    if(!control) return;
    control.addEventListener('input', ctx.syncSelectedEditTextStyleFromBrush);
    control.addEventListener('change', () => { ctx.editTextDirty = false; });
});
['gridHorizontalLines','gridVerticalLines','gridGapSize'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        ctx.syncGridGapValue();
        ctx.refreshGridSplitPreview();
    });
});
document.querySelectorAll('[data-panorama-ratio]').forEach(btn => {
    btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        ctx.applyPanoramaRatio(btn.dataset.panoramaRatio || 'wide');
    });
});
['panoramaRatioW','panoramaRatioH'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        ctx.panoramaState.ratio = 'custom';
        ctx.panoramaState.customW = Math.max(1, Math.min(999, Number(document.getElementById('panoramaRatioW')?.value || 16)));
        ctx.panoramaState.customH = Math.max(1, Math.min(999, Number(document.getElementById('panoramaRatioH')?.value || 9)));
        ctx.refreshPanoramaControls();
        ctx.resizePanoramaViewer();
    });
});
document.getElementById('imageEditStage')?.addEventListener('wheel', event => {
    if(!ctx.cropState) return;
    event.preventDefault();
    event.stopPropagation();
    if(ctx.imageEditMode === 'preview'){
        if(ctx.seekPreviewVideoFrames(event.deltaY > 0 ? 1 : -1)) return;
        if(ctx.panoramaState.enabled){
            const factor = event.deltaY < 0 ? 0.92 : 1 / 0.92;
            ctx.panoramaState.fov = Math.max(35, Math.min(100, ctx.panoramaState.fov * factor));
            ctx.updateZoomLabel();
            return;
        }
        const oldZoom = ctx.previewZoom;
        const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
        ctx.previewZoom = Math.max(0.05, ctx.previewZoom * factor);
        const frame = document.getElementById('previewFrame');
        const rect = frame?.getBoundingClientRect();
        if(rect){
            const originX = event.clientX - rect.left - rect.width / 2;
            const originY = event.clientY - rect.top - rect.height / 2;
            const ratio = ctx.previewZoom / oldZoom;
            ctx.previewPan.x -= originX * (ratio - 1);
            ctx.previewPan.y -= originY * (ratio - 1);
        }
        ctx.applyPreviewTransform();
        return;
    }
    const stage = event.currentTarget;
    const oldZoom = ctx.imageEditZoom;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    ctx.imageEditZoom = Math.max(0.15, Math.min(6.0, ctx.imageEditZoom * factor));
    const stageRect = stage.getBoundingClientRect();
    const mx = event.clientX - stageRect.left;
    const my = event.clientY - stageRect.top;
    const contentX = stage.scrollLeft + mx;
    const scale = ctx.imageEditZoom / oldZoom;
    const contentY = stage.scrollTop + my;
    ctx.applyImageEditZoom(scale);
    stage.scrollLeft = contentX * scale - mx;
    stage.scrollTop = contentY * scale - my;
}, {passive:false});
window.addEventListener('resize', () => {
    if(ctx.cropState) ctx.syncImageEditOverflow();
    if(ctx.panoramaState.enabled) ctx.resizePanoramaViewer();
});
                } catch(err) {
            console.error('[SmartCanvasUiChrome]', err);
            chromeBound = false;
        }
    }

    const api = Object.freeze({ bindChrome, bindTopActions, clearPromptCaretOutside });
    global.SmartCanvasCore.register('uiChrome', api);
    global.SmartCanvasUiChrome = api;
})(window);
