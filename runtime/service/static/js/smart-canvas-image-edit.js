/**
 * Smart Canvas — image edit overlay, quick toolbar, stage overflow.
 * Editor body (crop/mask/brush/grid/cutout/HD popover). Draw/text canvas in smart-canvas-image-draw.js.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

    function S(){
        const ctx = d();
        if(!ctx) throw new Error('[SmartCanvasImageEdit] deps not registered');
        return ctx;
    }

    function preview(){
        return global.SmartCanvasImagePreview;
    }

let gridOperationMode = 'split';

    function imageQuickToolbarPosition(itemRect, shellRect, toolbarHeight){
        return {
            left:(itemRect.left + itemRect.right) / 2 - shellRect.left,
            top:itemRect.top - shellRect.top - toolbarHeight - 12
        };
    }

    function hideImageQuickToolbar(){
        const toolbar = deps?.imageQuickToolbar;
        if(!toolbar) return;
        global.ImageQuickToolbar?.resetInteractionState?.(toolbar);
        toolbar.classList.remove('open');
        toolbar.hidden = true;
        delete toolbar.dataset.nodeId;
        delete toolbar.dataset.imageIndex;
        delete toolbar.dataset.mediaKind;
        closeComposerHdPopover();
    }

    function positionImageQuickToolbar(){
        const ctx = d();
        const toolbar = ctx?.imageQuickToolbar;
        if(!toolbar) return;
        const item = ctx?.selectedImageElement?.();
        if(!item){
            hideImageQuickToolbar();
            return;
        }
        const shell = ctx?.shell;
        if(!shell) return;
        const nodeId = ctx.selectedImage.nodeId;
        const imageIndex = String(ctx.selectedImage.index);
        const toolbarTargetChanged = toolbar.dataset.nodeId !== nodeId
            || toolbar.dataset.imageIndex !== imageIndex;
        if(toolbarTargetChanged) global.ImageQuickToolbar?.resetInteractionState?.(toolbar);
        const nodes = ctx.getNodes?.() || ctx.nodes || [];
        const node = nodes.find(item => item.id === nodeId);
        const mediaItem = ctx.imageForDisplay?.(node?.images?.[Number(imageIndex)]);
        const mediaKind = item.querySelector?.('video') ? 'video' : (ctx.mediaKindForItem?.(mediaItem) || 'image');
        const toolbarKindChanged = toolbar.dataset.mediaKind !== mediaKind;
        toolbar.dataset.nodeId = ctx.selectedImage.nodeId;
        toolbar.dataset.imageIndex = String(ctx.selectedImage.index);
        toolbar.dataset.mediaKind = mediaKind;
        if(toolbarKindChanged) global.ImageQuickToolbar?.render?.(toolbar);
        toolbar.hidden = false;
        toolbar.style.display = 'flex';
        const shellRect = shell.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const toolbarH = toolbar.offsetHeight || 40;
        // Keep the toolbar attached to the image even when that places part or
        // all of it outside the canvas viewport. The canvas edge must never
        // push the toolbar away from its selected image.
        const {left, top} = imageQuickToolbarPosition(itemRect, shellRect, toolbarH);
        toolbar.style.left = `${left}px`;
        toolbar.style.top = `${top}px`;
        toolbar.classList.add('open');
        positionImageHdPopover();
    }

    function cutoutTolerance(){
        const input = document.getElementById('cutoutTolerance');
        const value = Math.max(0, Math.min(255, Number(input?.value || 0)));
        if(input) input.value = value;
        const label = document.getElementById('cutoutToleranceValue');
        if(label) label.textContent = String(value);
        return value;
    }

    function cutoutSourcePixels(){
        const ctx = d();
        const img = document.getElementById('cropImage');
        if(!img?.naturalWidth || !img?.naturalHeight) return null;
        if(ctx?.cutoutSourceImageData?.width === img.naturalWidth && ctx?.cutoutSourceImageData?.height === img.naturalHeight) return ctx.cutoutSourceImageData;
        const source = document.createElement('canvas');
        source.width = img.naturalWidth;
        source.height = img.naturalHeight;
        const c2d = source.getContext('2d', {willReadFrequently:true});
        c2d.drawImage(img, 0, 0, source.width, source.height);
        const imageData = c2d.getImageData(0, 0, source.width, source.height);
        if(ctx) ctx.cutoutSourceImageData = imageData;
        return imageData;
    }

    function renderCutoutSelection(){
        const ctx = d();
        const canvasEl = ctx?.editDrawCanvas?.();
        if(!canvasEl) return;
        const c2d = canvasEl.getContext('2d');
        c2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const mask = ctx?.cutoutSelectionMask;
        if(!mask?.length){
            const hint = document.getElementById('cutoutSelectionHint');
            if(hint) hint.textContent = '点击图片选择相近颜色区域，按住 Shift 可连续选择';
            return;
        }
        const overlay = c2d.createImageData(canvasEl.width, canvasEl.height);
        for(let index = 0; index < mask.length; index++){
            if(!mask[index]) continue;
            const offset = index * 4;
            overlay.data[offset] = 0;
            overlay.data[offset + 1] = 122;
            overlay.data[offset + 2] = 255;
            overlay.data[offset + 3] = 92;
        }
        c2d.putImageData(overlay, 0, 0);
        const selected = mask.reduce((sum, value) => sum + value, 0);
        const hint = document.getElementById('cutoutSelectionHint');
        if(hint) hint.textContent = selected ? `已选择 ${selected.toLocaleString()} 像素` : '没有选中区域';
    }

    function pushCutoutHistory(){
        const ctx = d();
        if(!ctx) return;
        const history = ctx.cutoutHistory || [];
        history.push(ctx.cutoutSelectionMask ? new Uint8Array(ctx.cutoutSelectionMask) : null);
        if(history.length > 40) history.shift();
        ctx.cutoutHistory = history;
    }

    function undoCutoutSelection(){
        const ctx = d();
        if(!ctx?.cutoutHistory?.length){
            ctx?.toast?.('没有可撤销的抠图操作');
            return;
        }
        ctx.cutoutSelectionMask = ctx.cutoutHistory.pop();
        ctx.cutoutLastSeed = null;
        ctx.cutoutLastAction = null;
        renderCutoutSelection();
    }

    function selectCutoutAt(point, additive=false, recordHistory=true){
        const ctx = d();
        if(!ctx) return;
        try {
            const source = cutoutSourcePixels();
            if(!source || !global.MagicWand) return;
            ctx.cutoutLastSeed = {x:Math.floor(point.x), y:Math.floor(point.y)};
            const contiguous = document.getElementById('cutoutContiguous')?.checked !== false;
            if(recordHistory) pushCutoutHistory();
            const baseMask = additive && ctx.cutoutSelectionMask ? new Uint8Array(ctx.cutoutSelectionMask) : null;
            const selected = global.MagicWand.selectByColor(source, ctx.cutoutLastSeed.x, ctx.cutoutLastSeed.y, cutoutTolerance(), contiguous);
            ctx.cutoutSelectionMask = baseMask ? global.MagicWand.unionMasks(baseMask, selected) : selected;
            ctx.cutoutLastAction = {point:{...ctx.cutoutLastSeed}, additive:Boolean(additive), baseMask};
            renderCutoutSelection();
        } catch(error){
            console.error(error);
            ctx.toast?.('无法读取此图片像素，请重新上传图片后再抠图');
        }
    }

    function refreshCutoutFromControls(){
        const ctx = d();
        cutoutTolerance();
        if(ctx?.imageEditMode === 'cutout' && ctx.cutoutLastAction){
            const {point, additive, baseMask} = ctx.cutoutLastAction;
            ctx.cutoutSelectionMask = baseMask ? new Uint8Array(baseMask) : null;
            selectCutoutAt(point, additive, false);
        }
    }

    function invertCutoutSelection(){
        const ctx = d();
        if(!ctx?.cutoutSelectionMask?.length){
            ctx?.toast?.('请先点击图片选择区域');
            return;
        }
        pushCutoutHistory();
        ctx.cutoutSelectionMask = global.MagicWand.invertMask(ctx.cutoutSelectionMask);
        ctx.cutoutLastAction = null;
        renderCutoutSelection();
    }

    function clearCutoutSelection(silent=false){
        const ctx = d();
        if(!ctx) return;
        if(!silent && ctx.cutoutSelectionMask?.length) pushCutoutHistory();
        ctx.cutoutSelectionMask = null;
        ctx.cutoutSourceImageData = null;
        ctx.cutoutLastSeed = null;
        ctx.cutoutLastAction = null;
        if(silent) ctx.cutoutHistory = [];
        const canvasEl = ctx.editDrawCanvas?.();
        canvasEl?.getContext('2d')?.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const hint = document.getElementById('cutoutSelectionHint');
        if(hint) hint.textContent = '点击图片选择相近颜色区域，按住 Shift 可连续选择';
        cutoutTolerance();
    }

    function closeComposerHdPopover(){
        const popover = d()?.imageHdPopover;
        if(popover?.style) popover.style.display = 'none';
    }

    function setComposerHdScale(scale){
        const ctx = d();
        if(!ctx) return;
        const next = Math.max(1, Math.min(4, Number(scale) || 1));
        ctx.composerHdScale = next;
        ctx.imageHdPopover?.querySelectorAll('[data-hd-scale]').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.hdScale || 1) === next);
        });
    }

    function showImageHdPopover(){
        const ctx = d();
        const popover = ctx?.imageHdPopover;
        if(!popover) return;
        popover.style.display = 'block';
        setComposerHdScale(ctx.composerHdScale || 1);
        positionImageHdPopover();
    }

    function positionImageHdPopover(){
        const ctx = d();
        const popover = ctx?.imageHdPopover;
        if(!popover || popover.style.display === 'none') return;
        const toolbar = ctx?.imageQuickToolbar;
        if(!toolbar) return;
        const rect = toolbar.getBoundingClientRect();
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + 6}px`;
    }

    function showImageQuickToolbar(nodeId, imageIndex=0){
        const ctx = d();
        if(ctx){
            ctx.selectedImage = {nodeId, index:imageIndex};
            ctx.syncSelectionUi?.();
            return;
        }
        positionImageQuickToolbar();
    }

    function shellEl(){
        return d()?.shell || document.getElementById('shell');
    }

    function enterImageEditOverlay(){
        shellEl()?.classList?.add('image-edit-active');
        hideImageQuickToolbar();
    }

    function exitImageEditOverlay(){
        shellEl()?.classList?.remove('image-edit-active');
    }

    function syncImageEditOverflow(){
        const stage = document.getElementById('imageEditStage');
        const crop = document.getElementById('cropCanvas');
        if(!stage || !crop) return;
        const rect = crop.getBoundingClientRect();
        const pad = 36;
        stage.classList.toggle('overflow-x', rect.width + pad > stage.clientWidth);
        stage.classList.toggle('overflow-y', rect.height + pad > stage.clientHeight);
    }

    function ensureImageEditBaseSize(force=false){
        const ctx = d();
        if(!ctx) return;
        if(ctx.imageEditBaseW && ctx.imageEditBaseH && !force) return;
        const img = document.getElementById('cropImage');
        const naturalW = img?.naturalWidth || img?.clientWidth || 0;
        const naturalH = img?.naturalHeight || img?.clientHeight || 0;
        if(!naturalW || !naturalH) return;
        const stage = document.getElementById('imageEditStage');
        const embedded = Boolean(document.getElementById('imageLightboxEditorHost')?.contains(img));
        const maxW = embedded && stage?.clientWidth
            ? Math.max(1, Math.min(1300, stage.clientWidth - 36))
            : Math.max(1, Math.min(1300, window.innerWidth - 100));
        const maxH = embedded && stage?.clientHeight
            ? Math.max(1, Math.min(840, stage.clientHeight - 36))
            : Math.max(1, Math.min(840, window.innerHeight - 200));
        const fit = Math.min(1, maxW / naturalW, maxH / naturalH);
        ctx.imageEditBaseW = Math.max(1, Math.round(naturalW * fit));
        ctx.imageEditBaseH = Math.max(1, Math.round(naturalH * fit));
    }

    function cropImageDisplaySize(){
        const ctx = d();
        const img = document.getElementById('cropImage');
        const clientW = Number(img?.clientWidth || 0);
        const clientH = Number(img?.clientHeight || 0);
        if(clientW > 2 && clientH > 2) return {w:clientW, h:clientH};
        ensureImageEditBaseSize();
        const zoom = ctx?.imageEditZoom ?? 1;
        const fallbackW = Math.round((ctx?.imageEditBaseW || Number(img?.naturalWidth || 0) || 1) * zoom);
        const fallbackH = Math.round((ctx?.imageEditBaseH || Number(img?.naturalHeight || 0) || 1) * zoom);
        return {w:Math.max(1, fallbackW), h:Math.max(1, fallbackH)};
    }

    function updateZoomLabel(){
        const ctx = d();
        const el = document.getElementById('imageEditZoomLabel');
        if(!el || !ctx) return;
        const panoramaState = ctx.panoramaState;
        if(ctx.imageEditMode === 'preview' && panoramaState?.enabled){
            el.textContent = Math.round((75 / Math.max(1, panoramaState.fov)) * 100) + '%';
            return;
        }
        const zoom = ctx.imageEditMode === 'preview' ? ctx.previewZoom : ctx.imageEditZoom;
        el.textContent = Math.round((Number(zoom) || 1) * 100) + '%';
    }

    function applyImageEditZoom(scaleOverride=null){
        const ctx = d();
        if(!ctx) return;
        ensureImageEditBaseSize();
        if(!ctx.imageEditBaseW) return;
        const img = document.getElementById('cropImage');
        if(!img) return;
        const oldW = cropImageDisplaySize().w;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.width = Math.round(ctx.imageEditBaseW * ctx.imageEditZoom) + 'px';
        img.style.height = Math.round(ctx.imageEditBaseH * ctx.imageEditZoom) + 'px';
        ctx.resizeEditDrawCanvas?.();
        const cropState = ctx.getCropState?.();
        if(cropState){
            const scale = Number(scaleOverride) || (oldW > 0 ? cropImageDisplaySize().w / oldW : 1);
            cropState.x = Math.round(cropState.x * scale);
            cropState.y = Math.round(cropState.y * scale);
            cropState.w = Math.round(cropState.w * scale);
            cropState.h = Math.round(cropState.h * scale);
            clampCrop();
            renderCropBox();
        }
        if(ctx.imageEditMode === 'grid') refreshGridSplitPreview();
        syncImageEditOverflow();
        updateZoomLabel();
    }

    function resetImageEditZoom(){
        const ctx = d();
        if(!ctx) return;
        if(ctx.imageEditMode === 'preview'){
            if(ctx.panoramaState?.enabled){
                preview()?.resetPanoramaView?.();
                return;
            }
            preview()?.resetPreviewTransform?.();
            return;
        }
        const stage = document.getElementById('imageEditStage');
        ctx.imageEditZoom = 1.0;
        applyImageEditZoom();
        if(stage){
            stage.scrollLeft = 0;
            stage.scrollTop = 0;
        }
    }

    function syncGridCustomCursor(){
        const ctx = d();
        const el = document.getElementById('cropCanvas');
        if(!el || !ctx) return;
        el.classList.toggle('grid-custom-h', ctx.imageEditMode === 'grid' && ctx.gridCustomMode && ctx.gridCustomOrientation === 'h');
        el.classList.toggle('grid-custom-v', ctx.imageEditMode === 'grid' && ctx.gridCustomMode && ctx.gridCustomOrientation === 'v');
    }

    function refreshGridSplitPreview(){
        const ctx = d();
        const canvasEl = ctx?.editDrawCanvas?.();
        if(!canvasEl) return;
        const g = canvasEl.getContext('2d');
        g.clearRect(0, 0, canvasEl.width, canvasEl.height);
        global.SmartCanvasImageGridJoin?.renderGridJoinPreview?.();
        if(!ctx || ctx.imageEditMode !== 'grid') return;
        if(getGridOperationMode() === 'join') return;
        const countEl = document.getElementById('gridSplitCount');
        const lineWidth = Math.max(2, Math.round(Math.min(canvasEl.width, canvasEl.height) / 320));
        const drawLine = (x1, y1, x2, y2) => {
            g.save();
            g.lineWidth = lineWidth + 2;
            g.strokeStyle = 'rgba(2,6,23,0.72)';
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke();
            g.lineWidth = lineWidth;
            g.strokeStyle = 'rgba(255,255,255,0.92)';
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke();
            g.restore();
        };
        if(ctx.gridCustomMode){
            const gap = Math.max(0, Math.min(240, Number(document.getElementById('gridGapSize')?.value || 0)));
            const hLines = (ctx.gridCustomLines || []).filter(l => l.type === 'h');
            const vLines = (ctx.gridCustomLines || []).filter(l => l.type === 'v');
            if(countEl) countEl.textContent = ctx.tr?.('canvas.gridWillOutput')?.replace?.('{n}', (hLines.length + 1) * (vLines.length + 1)) ?? '';
            hLines.forEach(l => {
                const y = l.pos * canvasEl.height;
                if(gap > 0){
                    drawLine(0, y - gap / 2, canvasEl.width, y - gap / 2);
                    drawLine(0, y + gap / 2, canvasEl.width, y + gap / 2);
                } else drawLine(0, y, canvasEl.width, y);
            });
            vLines.forEach(l => {
                const x = l.pos * canvasEl.width;
                if(gap > 0){
                    drawLine(x - gap / 2, 0, x - gap / 2, canvasEl.height);
                    drawLine(x + gap / 2, 0, x + gap / 2, canvasEl.height);
                } else drawLine(x, 0, x, canvasEl.height);
            });
            return;
        }
        const {rows, cols, gap} = ctx.gridSplitSettings?.() || {rows:1, cols:1, gap:0};
        if(countEl) countEl.textContent = ctx.tr?.('canvas.gridWillOutput')?.replace?.('{n}', rows * cols) ?? '';
        for(let i = 1; i < cols; i++){
            const x = i * canvasEl.width / cols;
            if(gap > 0){
                drawLine(x - gap / 2, 0, x - gap / 2, canvasEl.height);
                drawLine(x + gap / 2, 0, x + gap / 2, canvasEl.height);
            } else drawLine(x, 0, x, canvasEl.height);
        }
        for(let i = 1; i < rows; i++){
            const y = i * canvasEl.height / rows;
            if(gap > 0){
                drawLine(0, y - gap / 2, canvasEl.width, y - gap / 2);
                drawLine(0, y + gap / 2, canvasEl.width, y + gap / 2);
            } else drawLine(0, y, canvasEl.width, y);
        }
    }

    function renderCropBox(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        const cropCanvasEl = document.getElementById('cropCanvas');
        const img = document.getElementById('cropImage');
        const draw = ctx?.editDrawCanvas?.();
        const textCanvas = ctx?.editTextCanvas?.();
        let boxX = cropState.x;
        let boxY = cropState.y;
        if(ctx.imageEditMode === 'outpaint' && cropCanvasEl && img){
            cropCanvasEl.style.width = `${Math.round(cropState.w)}px`;
            cropCanvasEl.style.height = `${Math.round(cropState.h)}px`;
            img.style.position = 'absolute';
            img.style.left = `${Math.round(cropState.x)}px`;
            img.style.top = `${Math.round(cropState.y)}px`;
            boxX = 0;
            boxY = 0;
            if(draw){
                draw.style.left = img.style.left;
                draw.style.top = img.style.top;
            }
            if(textCanvas){
                textCanvas.style.left = img.style.left;
                textCanvas.style.top = img.style.top;
            }
            updateOutpaintResolutionLabel();
        } else if(cropCanvasEl && img){
            cropCanvasEl.style.width = '';
            cropCanvasEl.style.height = '';
            img.style.position = '';
            img.style.left = '';
            img.style.top = '';
            if(draw){
                draw.style.left = '';
                draw.style.top = '';
            }
            if(textCanvas){
                textCanvas.style.left = '';
                textCanvas.style.top = '';
            }
        }
        const box = document.getElementById('cropBox');
        if(box){
            box.style.left = `${boxX}px`;
            box.style.top = `${boxY}px`;
            box.style.width = `${cropState.w}px`;
            box.style.height = `${cropState.h}px`;
        }
        const outpaintFrame = document.getElementById('outpaintFrame');
        if(outpaintFrame){
            outpaintFrame.style.left = ctx.imageEditMode === 'outpaint' ? '0px' : `${boxX}px`;
            outpaintFrame.style.top = ctx.imageEditMode === 'outpaint' ? '0px' : `${boxY}px`;
            outpaintFrame.style.width = `${cropState.w}px`;
            outpaintFrame.style.height = `${cropState.h}px`;
        }
    }

    function outpaintNaturalSize(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        const img = document.getElementById('cropImage');
        if(!img || !cropState) return {w:1, h:1};
        const display = cropImageDisplaySize();
        const scaleX = Math.max(1, Number(img.naturalWidth || 1)) / Math.max(1, Number(display.w || img.clientWidth || 1));
        const scaleY = Math.max(1, Number(img.naturalHeight || 1)) / Math.max(1, Number(display.h || img.clientHeight || 1));
        return {
            w:Math.max(1, Math.round((cropState.w || 1) * scaleX)),
            h:Math.max(1, Math.round((cropState.h || 1) * scaleY))
        };
    }

    function updateOutpaintResolutionLabel(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        const label = document.getElementById('outpaintResolution');
        const cropCanvasEl = document.getElementById('cropCanvas');
        if(!label || !cropState) return;
        const size = outpaintNaturalSize();
        const warning = ctx?.exceedsFourKStandard?.(size.w, size.h);
        cropCanvasEl?.classList.toggle('outpaint-warning', !!warning);
        label.textContent = `${Math.round(size.w)} x ${Math.round(size.h)}`;
    }

    function clampOutpaint(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        const {w, h} = ctx.cropBounds?.() || cropImageDisplaySize();
        cropState.w = Math.max(w, cropState.w);
        cropState.h = Math.max(h, cropState.h);
        cropState.x = Math.min(cropState.w - w, Math.max(0, cropState.x));
        cropState.y = Math.min(cropState.h - h, Math.max(0, cropState.y));
    }

    function clampCrop(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        if(ctx.imageEditMode === 'outpaint') return clampOutpaint();
        const {w, h} = ctx.cropBounds?.() || cropImageDisplaySize();
        cropState.w = Math.max(24, Math.min(cropState.w, w));
        cropState.h = Math.max(24, Math.min(cropState.h, h));
        cropState.x = Math.max(0, Math.min(cropState.x, w - cropState.w));
        cropState.y = Math.max(0, Math.min(cropState.y, h - cropState.h));
    }

    function resetOutpaintBox(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        ensureImageEditBaseSize(true);
        applyImageEditZoom();
        const {w, h} = ctx.cropBounds?.() || cropImageDisplaySize();
        cropState.w = w;
        cropState.h = h;
        cropState.x = 0;
        cropState.y = 0;
        clampOutpaint();
        renderCropBox();
    }

    function resetCropBox(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        if(ctx.imageEditMode === 'outpaint') return resetOutpaintBox();
        const {w, h} = ctx.cropBounds?.() || cropImageDisplaySize();
        cropState.x = Math.round(w * 0.08);
        cropState.y = Math.round(h * 0.08);
        cropState.w = Math.round(w * 0.84);
        cropState.h = Math.round(h * 0.84);
        renderCropBox();
    }

    function setImageEditMode(mode, userTouched=false){
        const ctx = d();
        if(!ctx) return;
        const editKind = ctx.mediaKindForItem?.(ctx.currentEditImage?.()?.image || {});
        const isVideoPreview = editKind === 'video';
        if(isVideoPreview && mode !== 'preview') mode = 'preview';
        if(userTouched) ctx.imageEditModeTouched = true;
        const prev = ctx.imageEditMode;
        if(mode !== 'brush') ctx.removeEditTextInlineEditor?.(true);
        ctx.imageEditMode = ['preview','crop','outpaint','mask','brush','grid','cutout'].includes(mode) ? mode : 'preview';
        const cropCanvasEl = document.getElementById('cropCanvas');
        const previewStageEl = document.getElementById('previewStage');
        const editStageEl = document.getElementById('imageEditStage');
        const editPanelEl = document.querySelector('.image-edit-panel');
        const previewDownloadBtn = document.getElementById('previewDownloadBtn');
        const previewDownloadAllBtn = document.getElementById('previewDownloadAllBtn');
        const modeBar = document.querySelector('.image-edit-mode');
        const videoFrameTools = document.getElementById('videoFrameTools');
        const zoomLabel = document.getElementById('imageEditZoomLabel');
        const cancelBtn = document.getElementById('imageEditCancelBtn');
        const isPreview = ctx.imageEditMode === 'preview';
        if(!isPreview && ctx.panoramaState?.enabled) preview()?.disposePanoramaPreview?.();
        if(cropCanvasEl) cropCanvasEl.style.display = isPreview ? 'none' : '';
        if(previewStageEl) previewStageEl.style.display = isPreview ? 'inline-flex' : 'none';
        editStageEl?.classList.toggle('preview-mode', isPreview);
        editPanelEl?.classList.toggle('video-preview-mode', isVideoPreview);
        if(previewDownloadBtn) previewDownloadBtn.style.display = isPreview ? 'inline-flex' : 'none';
        if(previewDownloadAllBtn){
            previewDownloadAllBtn.style.display = isPreview && !isVideoPreview && (ctx.previewDownloadGroupItems?.()?.length || 0) > 1 ? 'inline-flex' : 'none';
        }
        if(modeBar) modeBar.style.display = isVideoPreview ? 'none' : '';
        if(videoFrameTools) videoFrameTools.style.display = isVideoPreview && isPreview ? 'flex' : 'none';
        if(zoomLabel) zoomLabel.style.display = isVideoPreview ? 'none' : '';
        if(cancelBtn){
            cancelBtn.style.display = '';
            cancelBtn.textContent = isVideoPreview ? '关闭' : ctx.tr?.('common.cancel');
        }
        if(cropCanvasEl){
            cropCanvasEl.classList.toggle('mask-mode', ctx.imageEditMode === 'mask');
            cropCanvasEl.classList.toggle('brush-mode', ctx.imageEditMode === 'brush');
            cropCanvasEl.classList.toggle('grid-mode', ctx.imageEditMode === 'grid');
            cropCanvasEl.classList.toggle('outpaint-mode', ctx.imageEditMode === 'outpaint');
            cropCanvasEl.classList.toggle('cutout-mode', ctx.imageEditMode === 'cutout');
        }
        syncGridCustomCursor();
        document.querySelectorAll('[data-image-edit-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.imageEditMode === ctx.imageEditMode));
        document.getElementById('imagePreviewTools')?.classList.toggle('active', isPreview && !isVideoPreview);
        document.getElementById('imageMaskTools')?.classList.toggle('active', ctx.imageEditMode === 'mask');
        document.getElementById('imageBrushTools')?.classList.toggle('active', ctx.imageEditMode === 'brush');
        document.getElementById('imageGridTools')?.classList.toggle('active', ctx.imageEditMode === 'grid');
        document.getElementById('imageCutoutTools')?.classList.toggle('active', ctx.imageEditMode === 'cutout');
        if(ctx.imageEditMode === 'grid' && getGridOperationMode() === 'join' && !global.SmartCanvasImageGridJoin?.canGridJoinCurrentNode?.()){
            setGridOperationMode('split');
        }
        syncGridOperationControls();
        ctx.syncGridGapValue?.();
        const applyBtn = document.getElementById('imageEditApplyBtn');
        const compareToggleBtn = document.getElementById('compareToggleBtn');
        const panoramaToggleBtn = document.getElementById('panoramaToggleBtn');
        const panoramaExportBtn = document.getElementById('panoramaExportBtn');
        const compareThumbs = document.getElementById('compareThumbs');
        const imageEditTitle = document.getElementById('imageEditTitle');
        const imageEditSub = document.getElementById('imageEditSub');
        if(compareToggleBtn) compareToggleBtn.style.display = isPreview && !isVideoPreview ? 'inline-flex' : 'none';
        if(panoramaToggleBtn) panoramaToggleBtn.style.display = isPreview && !isVideoPreview ? 'inline-flex' : 'none';
        if(panoramaExportBtn) panoramaExportBtn.style.display = isPreview && !isVideoPreview && ctx.panoramaState?.enabled ? 'inline-flex' : 'none';
        if(compareThumbs) compareThumbs.style.display = 'none';
        if(isPreview){
            if(imageEditTitle) imageEditTitle.textContent = isVideoPreview ? '预览视频' : ctx.tr?.('smart.previewImage');
            if(imageEditSub) imageEditSub.textContent = isVideoPreview ? '' : ctx.tr?.('smart.previewHint');
            if(applyBtn) applyBtn.style.display = 'none';
            preview()?.refreshComparePanel?.();
        } else {
            ensureImageEditBaseSize(true);
            applyImageEditZoom();
            if(applyBtn) applyBtn.style.display = '';
            const icon = ctx.imageEditMode === 'crop' ? 'crop' : ctx.imageEditMode === 'outpaint' ? 'expand' : ctx.imageEditMode === 'mask' ? 'brush' : ctx.imageEditMode === 'brush' ? 'paintbrush' : ctx.imageEditMode === 'cutout' ? 'wand-sparkles' : 'grid-3x3';
            const labelKey = ctx.imageEditMode === 'crop' ? 'canvas.applyCrop' : ctx.imageEditMode === 'outpaint' ? 'canvas.applyOutpaint' : ctx.imageEditMode === 'mask' ? 'canvas.applyMask' : ctx.imageEditMode === 'brush' ? 'canvas.applyBrush' : 'canvas.applyGrid';
            const titleKey = ctx.imageEditMode === 'crop' ? 'canvas.cropImage' : ctx.imageEditMode === 'outpaint' ? 'canvas.outpaintImage' : ctx.imageEditMode === 'mask' ? 'canvas.maskEdit' : ctx.imageEditMode === 'brush' ? 'canvas.brushEdit' : 'canvas.modeGrid';
            const subKey = ctx.imageEditMode === 'crop' ? 'canvas.cropHint' : ctx.imageEditMode === 'outpaint' ? 'canvas.outpaintHint' : ctx.imageEditMode === 'mask' ? 'canvas.maskHint2' : ctx.imageEditMode === 'brush' ? 'canvas.brushHint' : 'canvas.gridHint';
            if(imageEditTitle) imageEditTitle.textContent = ctx.imageEditMode === 'cutout' ? '智能抠图' : ctx.tr?.(titleKey);
            if(imageEditSub) imageEditSub.textContent = ctx.imageEditMode === 'cutout' ? '点击图片选择相近颜色区域，通过容差控制选择范围' : ctx.tr?.(subKey);
            const applyLabel = ctx.imageEditMode === 'grid' && getGridOperationMode() === 'join' ? '输出拼接' : (ctx.imageEditMode === 'cutout' ? '应用抠图' : ctx.tr?.(labelKey));
            if(applyBtn) applyBtn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${applyLabel}</span>`;
            if(ctx.imageEditMode === 'crop'){
                requestAnimationFrame(() => {
                    resetCropBox();
                    syncImageEditOverflow();
                });
            } else if(ctx.imageEditMode === 'outpaint'){
                requestAnimationFrame(() => {
                    resetOutpaintBox();
                    syncImageEditOverflow();
                });
            }
        }
        ctx.resizeEditDrawCanvas?.();
        if(ctx.imageEditMode === 'grid') refreshGridSplitPreview();
        else if(ctx.imageEditMode === 'cutout' && prev !== 'cutout') clearCutoutSelection(true);
        else if(prev === 'cutout') clearCutoutSelection(true);
        else if(ctx.imageEditMode === 'crop' || ctx.imageEditMode === 'outpaint' || prev === 'grid') ctx.clearEditDrawing?.(true);
        ctx.syncEditDrawingHistoryButtons?.();
        ctx.syncBrushToolButtons?.();
        ctx.syncTextToolState?.(true);
        ctx.refreshIcons?.();
    }

    function openImageEditor(nodeId, imageIndex=0){
        const ctx = d();
        if(!ctx) return;
        const node = ctx.getNodes?.()?.find(n => n.id === nodeId);
        const image = ctx.imageForDisplay?.(node?.images?.[imageIndex]);
        if(!image?.url) return;
        const kind = ctx.mediaKindForItem?.(image);
        if(kind !== 'image' && kind !== 'video'){
            preview()?.downloadPreviewFile?.(image);
            return;
        }
        ctx.selectedId = nodeId;
        ctx.selectedImage = {nodeId, index:imageIndex};
        ctx.previewNavState = {nodeId, index:imageIndex, count:(node.images || []).filter(img => img?.url).length};
        ctx.setCropState?.({nodeId, imageIndex, x:0, y:0, w:0, h:0});
        ctx.gridCustomMode = false;
        ctx.gridCustomLines = [];
        ctx.gridCustomHistory = [];
        ctx.gridCustomDrag = null;
        ctx.gridCustomOrientation = 'h';
        ctx.cutoutSelectionMask = null;
        ctx.cutoutSourceImageData = null;
        ctx.cutoutLastSeed = null;
        ctx.cutoutHistory = [];
        ctx.cutoutLastAction = null;
        ctx.imageEditZoom = 1.0;
        ctx.imageEditBaseW = 0;
        ctx.imageEditBaseH = 0;
        ctx.imageEditModeTouched = false;
        ctx.editTextItems = [];
        ctx.editTextSelectedId = '';
        ctx.editTextDrag = null;
        ctx.editTextDirty = false;
        global.SmartCanvasImageGridJoin?.resetGridJoinState?.();
        setGridOperationMode('split');
        const toggle = document.getElementById('gridCustomToggle');
        if(toggle){ toggle.classList.add('secondary'); toggle.classList.remove('primary'); }
        ctx.syncGridCustomControls?.();
        ['gridHorizontalLines','gridVerticalLines'].forEach(id => { const el = document.getElementById(id); if(el) el.disabled = false; });
        const orientH = document.getElementById('gridOrientH'), orientV = document.getElementById('gridOrientV');
        if(orientH){ orientH.classList.add('primary'); orientH.classList.remove('secondary'); }
        if(orientV){ orientV.classList.add('secondary'); orientV.classList.remove('primary'); }
        ctx.syncGridCustomUndoBtn?.();
        syncGridOperationControls();
        updateZoomLabel();
        const img = document.getElementById('cropImage');
        img.style.width = '';
        img.style.height = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        enterImageEditOverlay();
        ctx.imageEditModal?.classList?.add('open');
        ctx.previewCompareOn = false;
        ctx.previewCompareIndex = -1;
        preview()?.disposePanoramaPreview?.();
        preview()?.resetPreviewTransform?.();
        if(kind === 'video'){
            img.onload = null;
            img.onerror = null;
            img.removeAttribute('src');
            delete img.dataset.proxyFallbackTried;
            setImageEditMode('preview');
            updatePreviewNavButtons();
            ctx.refreshIcons?.();
            return;
        }
        img.onload = () => {
            const targetImage = node.images?.[imageIndex];
            if(targetImage && img.naturalWidth && img.naturalHeight && (!targetImage.natural_w || !targetImage.natural_h)){
                targetImage.natural_w = img.naturalWidth;
                targetImage.natural_h = img.naturalHeight;
                ctx.scheduleSave?.();
            }
            ctx.imageEditBaseW = img.clientWidth;
            ctx.imageEditBaseH = img.clientHeight;
            updateZoomLabel();
            ctx.resizeEditDrawCanvas?.();
            ctx.resetEditDrawingHistory?.();
            ctx.clearEditDrawing?.(true);
            resetCropBox();
            if(!ctx.imageEditModeTouched) setImageEditMode('preview');
            else preview()?.refreshComparePanel?.();
            if(ctx.imageEditMode === 'preview' && preview()?.isLikelyPanoramaImage?.(node, targetImage || image, img.naturalWidth, img.naturalHeight)){
                preview()?.setPanoramaEnabled?.(true);
            }
            if(!ctx.panoramaState?.enabled) preview()?.updatePreviewMetaHint?.();
            syncImageEditOverflow();
            ctx.refreshIcons?.();
        };
        img.onerror = () => {
            if(img.dataset.proxyFallbackTried === '1') return;
            const fallback = ctx.proxiedMediaUrl?.(image);
            if(!fallback || fallback === img.getAttribute('src')) return;
            img.dataset.proxyFallbackTried = '1';
            img.src = fallback;
        };
        img.dataset.proxyFallbackTried = '';
        img.crossOrigin = 'anonymous';
        img.src = ctx.displayMediaUrl?.(image) || image.url;
        setImageEditMode('preview');
        updatePreviewNavButtons();
        ctx.refreshIcons?.();
    }

    function closeImageEditor(){
        const ctx = d();
        if(!ctx) return;
        const wasPromoted = Boolean(ctx.shell?.classList?.contains('image-edit-promoted'));
        exitImageEditOverlay();
        ctx.imageEditModal?.classList?.remove('open');
        ctx.shell?.classList?.remove('image-edit-promoted');
        if(wasPromoted){
            try {
                if(global.parent && global.parent !== global){
                    global.parent.document.documentElement.classList.remove('canvas-image-lightbox-active');
                    global.parent.document.body?.classList.remove('canvas-image-lightbox-active');
                }
            } catch(e) {}
        }
        document.querySelector('.image-edit-panel')?.classList.remove('video-preview-mode','quick-tool-panel','crop-panel','outpaint-panel','brush-panel','grid-panel','panorama-panel','compare-panel','cutout-panel','default-panel');
        const img = document.getElementById('cropImage');
        const previewVideo = document.getElementById('previewCurrentVideo');
        img.onload = null;
        img.onerror = null;
        img.removeAttribute('src');
        delete img.dataset.proxyFallbackTried;
        img.style.width = '';
        img.style.height = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        img.style.position = '';
        img.style.left = '';
        img.style.top = '';
        if(previewVideo){
            previewVideo.pause?.();
            previewVideo.onloadedmetadata = null;
            previewVideo.onloadeddata = null;
            previewVideo.removeAttribute('src');
            previewVideo.load?.();
            previewVideo.style.display = 'none';
        }
        ctx.clearEditDrawing?.(true);
        ctx.setCropState?.(null);
        ctx.cropDrag = null;
        ctx.editDrawState = null;
        ctx.resetEditDrawingHistory?.();
        ctx.gridCustomDrag = null;
        global.SmartCanvasImageGridJoin?.resetGridJoinState?.();
        setGridOperationMode('split');
        ctx.cutoutSelectionMask = null;
        ctx.cutoutSourceImageData = null;
        ctx.cutoutLastSeed = null;
        ctx.cutoutHistory = [];
        ctx.cutoutLastAction = null;
        ctx.previewNavState = {nodeId:'', index:0, count:0};
        ctx.imageEditZoom = 1.0;
        ctx.imageEditBaseW = 0;
        ctx.imageEditBaseH = 0;
        ctx.imageEditModeTouched = false;
        preview()?.disposePanoramaPreview?.();
        ctx.previewPanDrag = null;
        ctx.previewCompareDrag = false;
        ctx.imageEditPanDrag = null;
        preview()?.resetPreviewTransform?.();
        document.getElementById('imageEditStage')?.classList.remove('overflow-x', 'overflow-y', 'preview-mode');
        const cropCanvasEl = document.getElementById('cropCanvas');
        cropCanvasEl?.classList.remove('grid-custom-h', 'grid-custom-v', 'outpaint-mode', 'outpaint-warning', 'dragging-image', 'text-mode', 'cutout-mode', 'grid-join-mode');
        document.getElementById('cropImage')?.classList.remove('grid-join-hidden');
        const joinCanvas = document.getElementById('gridJoinCanvas');
        if(joinCanvas){
            joinCanvas.innerHTML = '';
            joinCanvas.style.display = 'none';
            joinCanvas.style.width = '';
            joinCanvas.style.height = '';
        }
        if(cropCanvasEl){
            cropCanvasEl.style.width = '';
            cropCanvasEl.style.height = '';
        }
        const textCanvas = ctx.editTextCanvas?.();
        if(textCanvas){
            textCanvas.style.left = '';
            textCanvas.style.top = '';
        }
        updatePreviewNavButtons();
        global.SmartCanvasImageLightbox?.onEmbeddedEditorClosed?.();
    }

    function updatePreviewNavButtons(){
        const ctx = d();
        if(!ctx) return;
        const node = ctx.getNodes?.()?.find(n => n.id === ctx.previewNavState?.nodeId);
        const count = Math.max(0, (node?.images || []).filter(img => img?.url).length);
        const nav = {...(ctx.previewNavState || {}), count};
        ctx.previewNavState = nav;
        const show = ctx.imageEditModal?.classList?.contains('open') && count > 1;
        document.getElementById('previewPrevBtn')?.classList.toggle('visible', show);
        document.getElementById('previewNextBtn')?.classList.toggle('visible', show);
    }

    function navigatePreviewImage(delta){
        const ctx = d();
        if(!ctx?.imageEditModal?.classList?.contains('open')) return;
        const node = ctx.getNodes?.()?.find(n => n.id === ctx.previewNavState?.nodeId);
        const images = (node?.images || []).filter(img => img?.url);
        if(!node || images.length <= 1) return;
        const count = images.length;
        const next = (Number(ctx.previewNavState?.index || 0) + Number(delta || 0) + count) % count;
        openImageEditor(node.id, next);
    }

    function openImagePreview(nodeId, imageIndex=0){
        openImageEditor(nodeId, imageIndex);
        setImageEditMode('preview');
    }

    function imageQuickActionMeta(action){
        const meta = {
            crop:{title:'裁切构图', sub:'调整画面边界，保留最适合电商展示的商品主体。', panel:'crop-panel'},
            outpaint:{title:'扩图画布', sub:'向外扩展背景空间，为主图、海报或详情页留出构图区域。', panel:'outpaint-panel'},
            brush:{title:'画笔标注', sub:'用画笔、形状、编号和文字标记修改方向。', panel:'brush-panel'},
            grid:{title:'宫格切分', sub:'把图片切成多张模块图，适合详情页分屏和社媒九宫格。', panel:'grid-panel'},
            panorama:{title:'全景预览', sub:'用沉浸视角检查空间、材质和 360 度产品展示效果。', panel:'panorama-panel'},
            compare:{title:'多视角对比', sub:'对比上游参考图与当前结果，检查修改前后的差异。', panel:'compare-panel'},
            cutout:{title:'智能抠图', sub:'按颜色容差选择区域，Shift 可连续选择，应用后扣掉选区。', panel:'cutout-panel'}
        };
        return meta[action] || {title:'图片工具', sub:'处理当前选中的图片。', panel:'default-panel'};
    }

    function setImageEditorContext(action=''){
        const panel = document.querySelector('.image-edit-panel');
        if(!panel) return;
        panel.classList.remove('quick-tool-panel','crop-panel','outpaint-panel','brush-panel','grid-panel','panorama-panel','compare-panel','cutout-panel','default-panel');
        if(!action) return;
        const meta = imageQuickActionMeta(action);
        panel.classList.add('quick-tool-panel', meta.panel);
        document.getElementById('imageEditTitle').textContent = meta.title;
        document.getElementById('imageEditSub').textContent = meta.sub;
    }

    function openImageQuickAction(action, nodeId, imageIndex){
        const ctx = d();
        if(!ctx) return;
        const nid = nodeId ?? ctx.selectedImage?.nodeId;
        const idx = imageIndex ?? ctx.selectedImage?.index ?? 0;
        if(!nid || idx < 0) return;
        if(action === 'download'){
            ctx.downloadNodeImage?.(nid, idx);
            return;
        }
        if(action === 'hd'){
            ctx.showImageHdPopover?.();
            return;
        }
        if(action === 'cutout' || action === 'vector'){
            ctx.toast?.('功能开发中，敬请期待');
            return;
        }
        if(action === 'brush'){
            global.SmartCanvasInlineBrush?.open?.({nodeId:nid, imageIndex:idx});
            return;
        }
        if(action === 'compare'){
            global.SmartCanvasMultiView?.open?.({nodeId:nid, imageIndex:idx});
            return;
        }
        if(['crop','outpaint','grid'].includes(action)){
            global.SmartCanvasImageLightbox?.open?.(nid, idx, null, {selectedTool:action});
            return;
        }
        if(action === 'panorama'){
            global.SmartCanvasInlineImageTools?.open?.({mode:action, nodeId:nid, imageIndex:idx});
            return;
        }
        openImageEditor(nid, idx);
        setImageEditorContext(action);
        if(action === 'panorama'){
            setImageEditMode('preview', true);
            setImageEditorContext(action);
            requestAnimationFrame(() => preview()?.setPanoramaEnabled?.(true));
            return;
        }
        if(action === 'compare'){
            setImageEditMode('preview', true);
            setImageEditorContext(action);
            requestAnimationFrame(() => {
                if(!ctx.previewCompareOn) preview()?.togglePreviewCompare?.();
            });
            return;
        }
        setImageEditMode(action, true);
        setImageEditorContext(action);
    }

    function beginCropDrag(event, mode){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        event.preventDefault();
        event.stopPropagation();
        if(ctx.imageEditMode === 'outpaint' && mode === 'move') return;
        ctx.cropDrag = {mode, sx:event.clientX, sy:event.clientY, start:{...cropState}};
    }

    function resizeOutpaintFromDrag(dx, dy){
        const ctx = d();
        const cropDrag = ctx?.cropDrag;
        const cropState = ctx?.getCropState?.();
        const start = cropDrag?.start;
        if(!start || !cropState) return;
        let growX = 0, growY = 0;
        if(cropDrag.mode === 'outpaint-left') growX = -dx;
        else if(cropDrag.mode === 'outpaint-right') growX = dx;
        else if(cropDrag.mode === 'outpaint-top') growY = -dy;
        else if(cropDrag.mode === 'outpaint-bottom') growY = dy;
        else if(cropDrag.mode === 'outpaint-corner'){ growX = dx; growY = dy; }
        const {w, h} = ctx.cropBounds?.() || cropImageDisplaySize();
        const nextW = Math.max(w, start.w + growX * 2);
        const nextH = Math.max(h, start.h + growY * 2);
        cropState.w = nextW;
        cropState.h = nextH;
        cropState.x = start.x + Math.round((nextW - start.w) / 2);
        cropState.y = start.y + Math.round((nextH - start.h) / 2);
        clampOutpaint();
    }

    function applyCropDragMove(event){
        const ctx = d();
        const cropDrag = ctx?.cropDrag;
        const cropState = ctx?.getCropState?.();
        if(!cropDrag || !cropState) return false;
        const dx = event.clientX - cropDrag.sx;
        const dy = event.clientY - cropDrag.sy;
        if(cropDrag.mode === 'move'){
            cropState.x = cropDrag.start.x + dx;
            cropState.y = cropDrag.start.y + dy;
        } else if(cropDrag.mode === 'image'){
            cropState.x = cropDrag.start.x + dx;
            cropState.y = cropDrag.start.y + dy;
        } else if(String(cropDrag.mode || '').startsWith('outpaint-')){
            resizeOutpaintFromDrag(dx, dy);
        } else {
            cropState.w = cropDrag.start.w + dx;
            cropState.h = cropDrag.start.h + dy;
        }
        clampCrop();
        renderCropBox();
        return true;
    }

    function endCropDrag(){
        const ctx = d();
        if(!ctx?.cropDrag) return false;
        document.getElementById('cropCanvas')?.classList.remove('dragging-image');
        ctx.cropDrag = null;
        return true;
    }

    async function uploadCroppedBlob(blob, name){
        const form = new FormData();
        form.append('files', blob, name);
        const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r => r.json());
        return data.files?.[0];
    }

    async function uploadImageBlobs(blobs){
        const form = new FormData();
        blobs.forEach(item => form.append('files', item.blob, item.name));
        const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r => r.json());
        return data.files || [];
    }

    function replaceEditedImage(file){
        const ctx = d();
        const {node, index} = ctx?.currentEditImage?.() || {};
        if(!node || !file) return false;
        node.images[index] = {...(node.images[index] || {}), url:file.url, name:file.name, kind:file.kind || ctx.mediaKindForItem?.(file), natural_w:0, natural_h:0};
        if((node.images || []).length === 1){ delete node.w; delete node.h; }
        ctx.selectedId = node.id;
        ctx.selectedImage = {nodeId:node.id, index};
        return true;
    }

    function maskCanvasFromDrawCanvas(src){
        const mask = document.createElement('canvas');
        mask.width = src.width;
        mask.height = src.height;
        const srcCtx = src.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
        const ctx = mask.getContext('2d');
        const out = ctx.createImageData(mask.width, mask.height);
        for(let i = 0; i < srcData.data.length; i += 4){
            const painted = srcData.data[i + 3] > 8;
            const v = painted ? 255 : 0;
            out.data[i] = v;
            out.data[i + 1] = v;
            out.data[i + 2] = v;
            out.data[i + 3] = 255;
        }
        ctx.putImageData(out, 0, 0);
        return mask;
    }

    async function applyImageCrop(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        const {node, image} = ctx.currentEditImage?.() || {};
        const img = document.getElementById('cropImage');
        if(!node || !image || !img.naturalWidth || !img.naturalHeight) return;
        const scaleX = img.naturalWidth / (img.clientWidth || 1);
        const scaleY = img.naturalHeight / (img.clientHeight || 1);
        const sx = Math.max(0, Math.round(cropState.x * scaleX));
        const sy = Math.max(0, Math.round(cropState.y * scaleY));
        const sw = Math.max(1, Math.round(cropState.w * scaleX));
        const sh = Math.max(1, Math.round(cropState.h * scaleY));
        const canvasEl = document.createElement('canvas');
        canvasEl.width = sw;
        canvasEl.height = sh;
        canvasEl.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const base = (image.name || 'image').replace(/\.[^.]+$/, '');
        const file = blob ? await uploadCroppedBlob(blob, `${base}_crop.png`) : null;
        if(file && replaceEditedImage(file)){
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    async function applyImageOutpaint(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        const {node, image} = ctx.currentEditImage?.() || {};
        const img = document.getElementById('cropImage');
        if(!node || !image || !img.naturalWidth || !img.naturalHeight) return;
        clampOutpaint();
        const scaleX = img.naturalWidth / (img.clientWidth || 1);
        const scaleY = img.naturalHeight / (img.clientHeight || 1);
        const outW = Math.max(img.naturalWidth, Math.round(cropState.w * scaleX));
        const outH = Math.max(img.naturalHeight, Math.round(cropState.h * scaleY));
        const dx = Math.round(cropState.x * scaleX);
        const dy = Math.round(cropState.y * scaleY);
        const canvasEl = document.createElement('canvas');
        canvasEl.width = outW;
        canvasEl.height = outH;
        const c2d = canvasEl.getContext('2d');
        c2d.fillStyle = '#ffffff';
        c2d.fillRect(0, 0, outW, outH);
        c2d.drawImage(img, dx, dy, img.naturalWidth, img.naturalHeight);
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const base = (image.name || 'image').replace(/\.[^.]+$/, '');
        const file = blob ? await uploadCroppedBlob(blob, `${base}_outpaint.png`) : null;
        if(file && replaceEditedImage(file)){
            ctx.applyOutpaintSizeToSmartParams?.(outW, outH);
            ctx.setPromptDraftForNode?.(node, 'Remove white area and fill the scene');
            if(ctx.promptInput) ctx.promptInput.dataset.preserveDraftOnce = '1';
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    async function applyImageMask(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState || !ctx.editCanvasHasPixels?.()) return;
        const {node, image} = ctx.currentEditImage?.() || {};
        if(!node || !image) return;
        const mask = maskCanvasFromDrawCanvas(ctx.editDrawCanvas?.());
        const blob = await new Promise(resolve => mask.toBlob(resolve, 'image/png'));
        const base = (image.name || 'image').replace(/\.[^.]+$/, '');
        const file = blob ? await uploadCroppedBlob(blob, `${base}_mask.png`) : null;
        if(file){
            node.images.push({url:file.url, name:file.name, role:'mask'});
            ctx.selectedId = node.id;
            ctx.selectedImage = {nodeId:node.id, index:node.images.length - 1};
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    async function applyImageBrush(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        ctx.removeEditTextInlineEditor?.(true);
        if(!ctx.editCanvasHasPixels?.()) return;
        const {node, image} = ctx.currentEditImage?.() || {};
        const img = document.getElementById('cropImage');
        if(!node || !image || !img.naturalWidth || !img.naturalHeight) return;
        const canvasEl = document.createElement('canvas');
        canvasEl.width = img.naturalWidth;
        canvasEl.height = img.naturalHeight;
        const c2d = canvasEl.getContext('2d');
        c2d.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
        c2d.drawImage(ctx.editDrawCanvas?.(), 0, 0);
        c2d.drawImage(ctx.editTextCanvas?.(), 0, 0);
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const base = (image.name || 'image').replace(/\.[^.]+$/, '');
        const file = blob ? await uploadCroppedBlob(blob, `${base}_paint.png`) : null;
        if(file && replaceEditedImage(file)){
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    async function applyImageCutout(){
        const ctx = d();
        const cropState = ctx?.getCropState?.();
        if(!cropState || !ctx.cutoutSelectionMask?.some(value => value)){
            ctx.toast?.('请先点击图片选择需要扣除的区域');
            return;
        }
        const {node, image} = ctx.currentEditImage?.() || {};
        const img = document.getElementById('cropImage');
        if(!node || !image || !img.naturalWidth || !img.naturalHeight) return;
        const canvasEl = document.createElement('canvas');
        canvasEl.width = img.naturalWidth;
        canvasEl.height = img.naturalHeight;
        const c2d = canvasEl.getContext('2d', {willReadFrequently:true});
        c2d.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
        const output = c2d.getImageData(0, 0, canvasEl.width, canvasEl.height);
        global.MagicWand.applyMaskToAlpha(output.data, ctx.cutoutSelectionMask);
        c2d.putImageData(output, 0, 0);
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const base = (image.name || 'image').replace(/\.[^.]+$/, '');
        const file = blob ? await uploadCroppedBlob(blob, `${base}_cutout.png`) : null;
        if(file && replaceEditedImage(file)){
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    async function applyImageGridSplit(){
        const ctx = d();
        if(getGridOperationMode() === 'join') return global.SmartCanvasImageGridJoin?.applyImageGridJoin?.();
        const cropState = ctx?.getCropState?.();
        if(!cropState) return;
        const {node, image} = ctx.currentEditImage?.() || {};
        const img = document.getElementById('cropImage');
        if(!node || !image || !img.naturalWidth || !img.naturalHeight) return;
        const rects = ctx.gridSplitRects?.(img.naturalWidth, img.naturalHeight)?.sort((a, b) => (Number(a.row || 0) - Number(b.row || 0)) || (Number(a.col || 0) - Number(b.col || 0))) || [];
        if(!rects.length) return;
        const base = ctx.safeExportFileName?.((ctx.downloadNameForMediaItem?.(image, 'image') || 'image').replace(/\.[^.]+$/, ''), 'image') || 'image';
        const digits = String(rects.length).length;
        const blobs = [];
        for(let i = 0; i < rects.length; i++){
            const rect = rects[i];
            const canvasEl = document.createElement('canvas');
            canvasEl.width = rect.w;
            canvasEl.height = rect.h;
            canvasEl.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
            const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
            const order = String(i + 1).padStart(digits, '0');
            if(blob) blobs.push({blob, name:`${base}_${order}_r${rect.row + 1}_c${rect.col + 1}.png`});
        }
        const files = await uploadImageBlobs(blobs);
        if(files.length){
            const layout = ctx.gridLayoutFromRects?.(rects);
            const outputNode = ctx.createNode?.((node.x || 0) + ctx.imageLayout?.(node.images || [], ctx.nodeScale?.(node), node).width + 40, node.y || 0, files.map((file, i) => ({
                url:file.url,
                name:file.name,
                grid:{...layout, row:rects[i]?.row || 0, col:rects[i]?.col || 0, w:rects[i]?.w || 1, h:rects[i]?.h || 1}
            })));
            if(outputNode) outputNode.title = 'Grid';
            closeImageEditor();
            ctx.render?.();
            ctx.scheduleSave?.();
        }
    }

    function applyImageEdit(){
        const ctx = d();
        if(!ctx) return;
        if(ctx.imageEditMode === 'preview') return;
        if(ctx.imageEditMode === 'outpaint') return applyImageOutpaint();
        if(ctx.imageEditMode === 'mask') return applyImageMask();
        if(ctx.imageEditMode === 'brush') return applyImageBrush();
        if(ctx.imageEditMode === 'grid') return applyImageGridSplit();
        if(ctx.imageEditMode === 'cutout') return applyImageCutout();
        return applyImageCrop();
    }

function openGroupImagePreview(group, startNodeId, startIndex=0){
    const ctx = d();
    if(!ctx) return;
 if(!ctx.isSmartGroupNode?.(group)){ openImagePreview(startNodeId, startIndex); return; }
 const refs = ctx.smartGroupImageRefs?.(group);
 if(refs.length <= 1){ openImagePreview(startNodeId, startIndex); return; }
 const seq = refs.map(r => ({nodeId:r.nodeId, index:r.index}));
 let pos = seq.findIndex(s => s.nodeId === startNodeId && Number(s.index) === Number(startIndex));
 if(pos < 0) pos = 0;
 openImagePreview(seq[pos].nodeId, seq[pos].index);
 if(!ctx.imageEditModal.classList.contains('open')) return;
 ctx.previewNavState.groupId = group.id;
 ctx.previewNavState.seq = seq;
 ctx.previewNavState.seqPos = pos;
 // 恢复分组上下文后重算导航/下载全部按钮（openImageEditor 已把 ctx.previewNavState 重置成单节点态）。
 setImageEditMode('preview');
}
function openImagePreviewSmart(nodeId, imageIndex=0){
    const ctx = d();
    if(!ctx) return;
 const group = ctx.smartGroupContainingNode?.(nodeId);
 if(group){
 openGroupImagePreview(group, nodeId, imageIndex);
 return;
 }
 openImagePreview(nodeId, imageIndex);
}
    function syncGridGapValue(){
    const input = document.getElementById('gridGapSize');
    const value = Math.max(0, Math.min(240, Number(input?.value || 0)));
    if(input) input.value = value;
    const label = document.getElementById('gridGapValue');
    if(label) label.textContent = String(value);
    return value;
}
    function gridSplitSettings(){
    const hLines = Math.max(0, Math.min(20, Number(document.getElementById('gridHorizontalLines')?.value || 0)));
    const vLines = Math.max(0, Math.min(20, Number(document.getElementById('gridVerticalLines')?.value || 0)));
    return {rows:hLines + 1, cols:vLines + 1, gap:syncGridGapValue()};
}
    function gridSplitRects(width, height){
    if(S().gridCustomMode) return gridSplitRectsCustom(width, height);
    const {rows, cols, gap} = gridSplitSettings();
    const halfGap = gap / 2, rects = [];
    for(let row = 0; row < rows; row++){
        const topLine = row * height / rows, bottomLine = (row + 1) * height / rows;
        const y1 = Math.round(row === 0 ? 0 : topLine + halfGap), y2 = Math.round(row === rows - 1 ? height : bottomLine - halfGap);
        for(let col = 0; col < cols; col++){
            const leftLine = col * width / cols, rightLine = (col + 1) * width / cols;
            const x1 = Math.round(col === 0 ? 0 : leftLine + halfGap), x2 = Math.round(col === cols - 1 ? width : rightLine - halfGap);
            if(x2 > x1 && y2 > y1) rects.push({row, col, x:x1, y:y1, w:x2 - x1, h:y2 - y1});
        }
    }
    return rects;
}
    function gridSplitRectsCustom(width, height){
    const gap = Math.max(0, Math.min(240, Number(document.getElementById('gridGapSize')?.value || 0)));
    const halfGap = gap / 2;
    const rawH = [...new Set(S().gridCustomLines.filter(l => l.type === 'h').map(l => l.pos * height))].sort((a, b) => a - b);
    const rawV = [...new Set(S().gridCustomLines.filter(l => l.type === 'v').map(l => l.pos * width))].sort((a, b) => a - b);
    const hCuts = [0, ...rawH, height], vCuts = [0, ...rawV, width], rects = [];
    for(let row = 0; row < hCuts.length - 1; row++) for(let col = 0; col < vCuts.length - 1; col++){
        const y1 = Math.round(row === 0 ? hCuts[row] : hCuts[row] + halfGap), y2 = Math.round(row === hCuts.length - 2 ? hCuts[row + 1] : hCuts[row + 1] - halfGap);
        const x1 = Math.round(col === 0 ? vCuts[col] : vCuts[col] + halfGap), x2 = Math.round(col === vCuts.length - 2 ? vCuts[col + 1] : vCuts[col + 1] - halfGap);
        if(x2 > x1 && y2 > y1) rects.push({row, col, x:x1, y:y1, w:x2 - x1, h:y2 - y1});
    }
    return rects;
}
    function gridLayoutFromRects(rects){
    return {type:'grid-split', groupId:S().uid('grid'), rows:Math.max(1, ...rects.map(r => Number(r.row || 0) + 1)), cols:Math.max(1, ...rects.map(r => Number(r.col || 0) + 1))};
}
    function applyGridPreset(rows, cols){
    S().gridCustomMode = false; S().gridCustomLines = []; S().gridCustomHistory = []; S().gridCustomDrag = null;
    const h = document.getElementById('gridHorizontalLines'), v = document.getElementById('gridVerticalLines');
    if(h){ h.disabled = false; h.value = String(Math.max(0, Number(rows || 1) - 1)); }
    if(v){ v.disabled = false; v.value = String(Math.max(0, Number(cols || 1) - 1)); }
    document.getElementById('gridCustomToggle')?.classList.remove('primary');
    document.getElementById('gridCustomToggle')?.classList.add('secondary');
    syncGridCustomControls();
    syncGridCustomCursor(); syncGridCustomUndoBtn(); refreshGridSplitPreview();
}
    function syncGridCustomControls(){
    const custom = document.getElementById('gridCustomControls');
    if(custom) custom.style.display = S().gridCustomMode ? 'flex' : 'none';
    document.querySelectorAll('.grid-preset-row').forEach(row => {
        row.style.display = S().gridCustomMode ? 'none' : 'flex';
    });
}
    function toggleGridCustomMode(){
    S().gridCustomMode = !S().gridCustomMode;
    if(S().gridCustomMode){ S().gridCustomLines = []; S().gridCustomHistory = []; }
    S().gridCustomDrag = null;
    const toggle = document.getElementById('gridCustomToggle');
    toggle.classList.toggle('primary', S().gridCustomMode); toggle.classList.toggle('secondary', !S().gridCustomMode);
    ['gridHorizontalLines','gridVerticalLines'].forEach(id => { const el = document.getElementById(id); if(el) el.disabled = S().gridCustomMode; });
    syncGridCustomControls();
    syncGridCustomCursor(); syncGridCustomUndoBtn(); refreshGridSplitPreview();
}
    function setGridCustomOrientation(orient){
    S().gridCustomOrientation = orient;
    document.getElementById('gridOrientH').classList.toggle('primary', orient === 'h');
    document.getElementById('gridOrientH').classList.toggle('secondary', orient !== 'h');
    document.getElementById('gridOrientV').classList.toggle('primary', orient === 'v');
    document.getElementById('gridOrientV').classList.toggle('secondary', orient !== 'v');
    syncGridCustomCursor();
}
    function clearGridCustomLines(){
        const ctx = d();
        if(!ctx) return;
        ctx.gridCustomHistory = [];
        ctx.gridCustomLines = [];
        ctx.gridCustomDrag = null;
        syncGridCustomUndoBtn();
        refreshGridSplitPreview();
    }

    function undoGridCustomLine(){
        const ctx = d();
        if(!ctx || !ctx.gridCustomHistory.length) return;
        ctx.gridCustomLines = ctx.gridCustomHistory.pop();
        ctx.gridCustomDrag = null;
        syncGridCustomUndoBtn();
        refreshGridSplitPreview();
    }

    function syncGridCustomUndoBtn(){
    const btn = document.getElementById('gridUndoBtn');
    if(!btn) return;
    btn.disabled = S().gridCustomHistory.length === 0;
    btn.style.opacity = S().gridCustomHistory.length === 0 ? '0.4' : '1';
}
    function currentEditImage(){
    const node = S().getNodes().find(n => n.id === S().getCropState()?.nodeId);
    const index = Number(S().getCropState()?.imageIndex || 0);
    return {node, index, image:S().imageForDisplay(node?.images?.[index])};
}
    function cropBounds(){
    return cropImageDisplaySize();
}
    function applyOutpaintSizeToSmartParams(width, height){
    const w = Math.max(1, Math.round(Number(width) || 0));
    const h = Math.max(1, Math.round(Number(height) || 0));
    if(!w || !h) return;
    const subject = currentEditImage().node;
    if(!subject || !S().isSmartImageNode(subject)) return;
    subject.outpaintSize = {width:w, height:h};
    subject.runSettings = S().withOutpaintDisplaySettings(subject, S().cloneSmartSettings(subject.runSettings || S().settings));
    if(S().activeSettingsSubject()?.id === subject.id){
        S().settings = S().smartSettingsForNode(subject);
        S().renderDynamicParams();
    }
}
    function getGridOperationMode(){
    return gridOperationMode;
}
    function setGridOperationMode(mode){
    gridOperationMode = mode === 'join' && global.SmartCanvasImageGridJoin?.canGridJoinCurrentNode() ? 'join' : 'split';
    if(mode === 'join' && gridOperationMode !== 'join') d()?.toast('请从包含多张图片的分组打开宫格拼接');
    syncGridOperationControls();
    refreshGridSplitPreview();
}
    function syncGridOperationControls(){
    const join = gridOperationMode === 'join';
    document.getElementById('gridSplitModeBtn')?.classList.toggle('primary', !join);
    document.getElementById('gridSplitModeBtn')?.classList.toggle('secondary', join);
    const joinBtn = document.getElementById('gridJoinModeBtn');
    if(joinBtn){
        joinBtn.disabled = !global.SmartCanvasImageGridJoin?.canGridJoinCurrentNode();
        joinBtn.classList.toggle('primary', join);
        joinBtn.classList.toggle('secondary', !join);
    }
    document.querySelectorAll('.grid-split-control').forEach(el => { el.style.display = join ? 'none' : (el.id === 'gridRegularControls' ? 'contents' : ''); });
    document.querySelectorAll('.grid-join-control').forEach(el => { el.style.display = join ? 'flex' : 'none'; });
    global.SmartCanvasImageGridJoin?.syncGridJoinSizeControls();
    if(!join) syncGridCustomControls();
    document.getElementById('cropCanvas')?.classList.toggle('grid-join-mode', join);
    document.getElementById('cropImage')?.classList.toggle('grid-join-hidden', join);
    if(join) global.SmartCanvasImageGridJoin?.ensureGridJoinLayout();
    else window.SmartCanvasImageGridJoin?.clearGridJoinDrag?.();
}
    const api = Object.freeze({
        syncGridOperationControls,
        setGridOperationMode,
        getGridOperationMode,
        applyOutpaintSizeToSmartParams,
        cropBounds,
        currentEditImage,
        syncGridCustomUndoBtn,
        undoGridCustomLine,
        clearGridCustomLines,
        setGridCustomOrientation,
        toggleGridCustomMode,
        syncGridCustomControls,
        applyGridPreset,
        gridLayoutFromRects,
        gridSplitRectsCustom,
        gridSplitRects,
        gridSplitSettings,
        syncGridGapValue,
        registerDeps,
        enterImageEditOverlay,
        exitImageEditOverlay,
        hideImageQuickToolbar,
        positionImageQuickToolbar,
        imageQuickToolbarPosition,
        showImageQuickToolbar,
        syncImageEditOverflow,
        ensureImageEditBaseSize,
        cropImageDisplaySize,
        applyImageEditZoom,
        resetImageEditZoom,
        updateZoomLabel,
        syncGridCustomCursor,
        refreshGridSplitPreview,
        setImageEditMode,
        renderCropBox,
        clampCrop,
        clampOutpaint,
        resetCropBox,
        resetOutpaintBox,
        updateOutpaintResolutionLabel,
        openImageEditor,
        closeImageEditor,
        updatePreviewNavButtons,
        navigatePreviewImage,
        openImagePreview,
        openGroupImagePreview,
        openImagePreviewSmart,
        imageQuickActionMeta,
        setImageEditorContext,
        openImageQuickAction,
        beginCropDrag,
        resizeOutpaintFromDrag,
        applyCropDragMove,
        endCropDrag,
        uploadCroppedBlob,
        uploadImageBlobs,
        replaceEditedImage,
        maskCanvasFromDrawCanvas,
        applyImageCrop,
        applyImageOutpaint,
        applyImageMask,
        applyImageBrush,
        applyImageCutout,
        applyImageGridSplit,
        applyImageEdit,
        cutoutTolerance,
        cutoutSourcePixels,
        renderCutoutSelection,
        undoCutoutSelection,
        selectCutoutAt,
        refreshCutoutFromControls,
        invertCutoutSelection,
        clearCutoutSelection,
        closeComposerHdPopover,
        setComposerHdScale,
        showImageHdPopover,
        positionImageHdPopover,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('imageEdit', api);
    }

    global.SmartCanvasImageEdit = api;
})(window);
