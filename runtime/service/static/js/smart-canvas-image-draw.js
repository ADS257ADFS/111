/**
 * Smart Canvas — image edit draw/text canvas (mask, brush, labels, inline text).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    const MASK_BRUSH_ALPHA = 115;
    const MASK_BRUSH_COLOR = `rgba(255,255,255,${MASK_BRUSH_ALPHA / 255})`;

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || null;
    }

    function S(){
        const c = d();
        if(!c) throw new Error('[SmartCanvasImageDraw] deps not registered');
        return c;
    }

    function cropImageDisplaySize(){
        return global.SmartCanvasImageEdit?.cropImageDisplaySize?.() ?? {w:1, h:1};
    }

function editDrawCanvas(){ return document.getElementById('editDrawCanvas'); }
function editTextCanvas(){ return document.getElementById('editTextCanvas'); }
function editTextContext(){ return editTextCanvas()?.getContext('2d') || null; }
function selectedEditTextItem(){ return S().editTextItems.find(item => item.id === S().editTextSelectedId) || null; }
function defaultEditTextText(){ return window.StudioI18n?.lang?.() === 'en' ? 'Double-click to edit' : '双击编辑'; }
function editTextSizeFromBrush(){ return Math.max(14, Math.min(120, Math.round(editBrushSize() * 2))); }
function createEditTextItem(text, point, preset={}){
    const size = Math.max(10, Math.min(120, Number(preset.size) || editTextSizeFromBrush()));
    return {id:S().uid('txt'), text:String(text || defaultEditTextText()).trim(), x:Number(point?.x || 0), y:Number(point?.y || 0), color:preset.color || brushColor(), size};
}
function textItemFont(item){
    const size = Math.max(10, Math.min(120, Number(item?.size) || 28));
    return `900 ${size}px Arial, sans-serif`;
}
function measureEditTextItem(item, ctx=editTextContext()){
    if(!item || !ctx) return {x:0, y:0, w:0, h:0};
    const size = Math.max(10, Math.min(120, Number(item.size) || 28));
    ctx.save();
    ctx.font = textItemFont(item);
    const metrics = ctx.measureText(String(item.text || ''));
    ctx.restore();
    const width = Math.max(1, metrics.width || 1);
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : size * 0.8;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size * 0.25;
    const pad = Math.max(4, Math.round(size * 0.18));
    return {x:item.x - width / 2 - pad, y:item.y - (ascent + descent) / 2 - pad, w:width + pad * 2, h:ascent + descent + pad * 2, textW:width, textH:ascent + descent, pad};
}
function hitEditTextItem(point){
    const ctx = editTextContext();
    if(!ctx) return null;
    for(let i = S().editTextItems.length - 1; i >= 0; i--){
        const item = S().editTextItems[i];
        const box = measureEditTextItem(item, ctx);
        if(point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return item;
    }
    return null;
}
function renderEditTextCanvas(){
    const canvasEl = editTextCanvas();
    const ctx = editTextContext();
    if(!canvasEl || !ctx) return;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    S().editTextItems.forEach(item => {
        if(!item?.text) return;
        const selected = item.id === S().editTextSelectedId;
        const box = measureEditTextItem(item, ctx);
        ctx.save();
        ctx.font = textItemFont(item);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.color || brushColor();
        ctx.strokeStyle = 'rgba(255,255,255,.92)';
        ctx.lineWidth = Math.max(2, (Number(item.size) || 28) / 8);
        ctx.strokeText(String(item.text || ''), item.x, item.y);
        ctx.fillText(String(item.text || ''), item.x, item.y);
        if(selected){
            ctx.setLineDash([7, 5]);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(15,23,42,.72)';
            ctx.strokeRect(box.x, box.y, box.w, box.h);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(15,23,42,.92)';
            ctx.beginPath();
            ctx.arc(item.x + box.w / 2 - box.pad, item.y - box.h / 2 + box.pad, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
    positionEditTextInlineEditor();
}
function syncTextToolState(force=false){
    const cropCanvasEl = document.getElementById('cropCanvas');
    cropCanvasEl?.classList.toggle('text-mode', S().imageEditMode === 'brush' && S().brushTool === 'text');
}
function syncSelectedEditTextStyleFromBrush(){
    if(S().imageEditMode !== 'brush' || S().brushTool !== 'text' || S().editTextInlineEditor) return;
    const item = selectedEditTextItem();
    if(!item) return;
    const nextSize = editTextSizeFromBrush();
    const nextColor = brushColor();
    if(item.size === nextSize && item.color === nextColor) return;
    beginTextEditChange();
    item.size = nextSize;
    item.color = nextColor;
    renderEditTextCanvas();
    syncTextToolState(true);
}
function beginTextEditChange(){
    if(S().editTextDirty) return;
    pushEditDrawHistory();
    S().editTextDirty = true;
}
function setSelectedEditTextItem(id){
    S().editTextSelectedId = id || '';
    renderEditTextCanvas();
    syncTextToolState(true);
}
function confirmSelectedEditTextItem(){
    const selected = selectedEditTextItem();
    if(!selected) return false;
    if(!String(selected.text || '').trim()) S().editTextItems = S().editTextItems.filter(item => item.id !== selected.id);
    S().editTextSelectedId = '';
    S().editTextDrag = null;
    S().editTextDirty = false;
    renderEditTextCanvas();
    syncTextToolState(true);
    return true;
}
function editTextCanvasScale(){
    const canvasEl = editTextCanvas();
    const rect = canvasEl?.getBoundingClientRect?.();
    return {x:(rect?.width || canvasEl?.width || 1) / Math.max(1, canvasEl?.width || 1), y:(rect?.height || canvasEl?.height || 1) / Math.max(1, canvasEl?.height || 1), rect};
}
function selectInlineEditorText(el){
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}
function inlineEditorText(){
    return String(S().editTextInlineEditor?.el?.innerText || S().editTextInlineEditor?.el?.textContent || '').replace(/\u00a0/g, ' ');
}
function autosizeEditTextInlineEditor(){
    const editor = S().editTextInlineEditor;
    if(!editor?.el) return;
    const el = editor.el;
    el.style.width = 'auto';
    el.style.height = 'auto';
    el.style.width = `${Math.max(Number(editor.minW || 48), el.scrollWidth + 10)}px`;
    el.style.height = `${Math.max(Number(editor.minH || 28), el.scrollHeight + 4)}px`;
}
function positionEditTextInlineEditor(){
    const editor = S().editTextInlineEditor;
    if(!editor?.el) return;
    const item = S().editTextItems.find(x => x.id === editor.itemId);
    const canvasEl = editTextCanvas();
    const cropCanvasEl = document.getElementById('cropCanvas');
    if(!item || !canvasEl || !cropCanvasEl) return;
    const box = measureEditTextItem(item, editTextContext());
    const scale = editTextCanvasScale();
    const hostRect = cropCanvasEl.getBoundingClientRect();
    const canvasRect = scale.rect || canvasEl.getBoundingClientRect();
    const left = canvasRect.left - hostRect.left + box.x * scale.x;
    const top = canvasRect.top - hostRect.top + box.y * scale.y;
    const w = Math.max(48, box.w * scale.x);
    const h = Math.max(28, box.h * scale.y);
    editor.minW = w;
    editor.minH = h;
    editor.el.style.left = `${left}px`;
    editor.el.style.top = `${top}px`;
    editor.el.style.minWidth = `${w}px`;
    editor.el.style.minHeight = `${h}px`;
    editor.el.style.font = `900 ${Math.max(10, (Number(item.size) || 28) * scale.y)}px Arial, sans-serif`;
    editor.el.style.color = item.color || brushColor();
    autosizeEditTextInlineEditor();
}
function removeEditTextInlineEditor(commit=true){
    const editor = S().editTextInlineEditor;
    if(!editor) return;
    const item = S().editTextItems.find(x => x.id === editor.itemId);
    const next = inlineEditorText().trim();
    S().editTextInlineEditor = null;
    editor.el.remove();
    if(!item) return;
    if(commit){
        if(next !== String(editor.before || '')){
            beginTextEditChange();
            if(next) item.text = next;
            else {
                S().editTextItems = S().editTextItems.filter(x => x.id !== item.id);
                S().editTextSelectedId = '';
            }
        }
    } else {
        item.text = editor.before || item.text || defaultEditTextText();
    }
    S().editTextDirty = false;
    renderEditTextCanvas();
    syncTextToolState(true);
}
function beginEditTextInline(item){
    if(!item) return;
    removeEditTextInlineEditor(true);
    S().editTextSelectedId = item.id;
    const host = document.getElementById('cropCanvas');
    if(!host) return;
    const el = document.createElement('div');
    el.className = 'edit-text-inline';
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.textContent = item.text || defaultEditTextText();
    host.appendChild(el);
    S().editTextInlineEditor = {el, itemId:item.id, before:item.text || ''};
    positionEditTextInlineEditor();
    el.addEventListener('input', autosizeEditTextInlineEditor);
    el.addEventListener('keydown', event => {
        if(event.key === 'Enter' && !event.shiftKey){ event.preventDefault(); removeEditTextInlineEditor(true); }
        else if(event.key === 'Escape'){ event.preventDefault(); removeEditTextInlineEditor(false); }
    });
    el.addEventListener('blur', () => removeEditTextInlineEditor(true));
    requestAnimationFrame(() => { el.focus(); selectInlineEditorText(el); });
    renderEditTextCanvas();
    syncTextToolState(true);
}
function editTextPoint(event){ return editDrawPoint(event); }
function beginEditText(event){
    if(S().imageEditMode !== 'brush' || S().brushTool !== 'text') return;
    event.preventDefault(); event.stopPropagation();
    removeEditTextInlineEditor(true);
    const canvasEl = editTextCanvas();
    const point = editTextPoint(event);
    const hit = hitEditTextItem(point);
    if(hit){
        S().editTextSelectedId = hit.id;
        S().editTextDrag = {id:hit.id, pointerId:event.pointerId, startX:hit.x, startY:hit.y, sx:event.clientX, sy:event.clientY, moved:false, hasHistory:false};
        canvasEl.setPointerCapture?.(event.pointerId);
        canvasEl.style.cursor = 'grabbing';
        syncTextToolState(true);
        renderEditTextCanvas();
        return;
    }
    if(selectedEditTextItem()){
        confirmSelectedEditTextItem();
        return;
    }
    beginTextEditChange();
    const item = createEditTextItem(defaultEditTextText(), point, {color:brushColor(), size:editTextSizeFromBrush()});
    S().editTextItems.push(item);
    S().editTextSelectedId = item.id;
    canvasEl.style.cursor = 'text';
    renderEditTextCanvas();
    syncTextToolState(true);
}
function updateEditTextCursor(event){
    const canvasEl = editTextCanvas();
    if(!canvasEl || S().imageEditMode !== 'brush' || S().brushTool !== 'text') return;
    const hit = hitEditTextItem(editTextPoint(event));
    canvasEl.style.cursor = hit ? 'move' : 'text';
}
function moveEditText(event){
    if(!S().editTextDrag){
        updateEditTextCursor(event);
        return;
    }
    event.preventDefault(); event.stopPropagation();
    const item = S().editTextItems.find(x => x.id === S().editTextDrag.id);
    if(!item) return;
    const dx = event.clientX - S().editTextDrag.sx;
    const dy = event.clientY - S().editTextDrag.sy;
    if(!S().editTextDrag.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    S().editTextDrag.moved = true;
    if(!S().editTextDrag.hasHistory){
        beginTextEditChange();
        S().editTextDrag.hasHistory = true;
    }
    const canvasEl = editTextCanvas();
    const rect = canvasEl?.getBoundingClientRect?.();
    const scaleX = canvasEl ? canvasEl.width / Math.max(1, rect?.width || canvasEl.width) : 1;
    const scaleY = canvasEl ? canvasEl.height / Math.max(1, rect?.height || canvasEl.height) : 1;
    item.x = S().editTextDrag.startX + dx * scaleX;
    item.y = S().editTextDrag.startY + dy * scaleY;
    renderEditTextCanvas();
}
function endEditText(event){
    if(S().editTextDrag && event?.pointerId != null) editTextCanvas()?.releasePointerCapture?.(event.pointerId);
    S().editTextDrag = null;
    S().editTextDirty = false;
    renderEditTextCanvas();
    syncTextToolState(true);
    if(event) updateEditTextCursor(event);
}
function editTextHasContent(){ return S().editTextItems.some(item => String(item?.text || '').trim().length > 0); }
function resizeEditTextCanvas(){
    const img = document.getElementById('cropImage');
    const canvasEl = editTextCanvas();
    if(!img || !canvasEl) return;
    const display = cropImageDisplaySize();
    const w = Math.max(1, img.naturalWidth || img.clientWidth || 1);
    const h = Math.max(1, img.naturalHeight || img.clientHeight || 1);
    if(canvasEl.width !== w) canvasEl.width = w;
    if(canvasEl.height !== h) canvasEl.height = h;
    canvasEl.style.width = `${display.w}px`;
    canvasEl.style.height = `${display.h}px`;
    renderEditTextCanvas();
}
function resizeEditDrawCanvas(){
    const img = document.getElementById('cropImage');
    const canvasEl = editDrawCanvas();
    const display = cropImageDisplaySize();
    const w = Math.max(1, img.naturalWidth || img.clientWidth || 1);
    const h = Math.max(1, img.naturalHeight || img.clientHeight || 1);
    if(canvasEl.width !== w || canvasEl.height !== h){ canvasEl.width = w; canvasEl.height = h; }
    canvasEl.style.width = `${display.w}px`;
    canvasEl.style.height = `${display.h}px`;
    resizeEditTextCanvas();
    if(S().imageEditMode === 'grid') global.SmartCanvasImageEdit?.refreshGridSplitPreview?.();
}
function editDrawSnapshot(){
    const canvasEl = editDrawCanvas();
    return {
        imageData:canvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height),
        labelCounter:S().brushLabelCounter,
        textItems:S().editTextItems.map(item => ({...item})),
        textSelectedId:S().editTextSelectedId || ''
    };
}
function restoreEditDrawSnapshot(snapshot){
    if(!snapshot) return;
    removeEditTextInlineEditor(false);
    editDrawCanvas().getContext('2d').putImageData(snapshot.imageData || snapshot, 0, 0);
    if(snapshot.labelCounter) S().brushLabelCounter = snapshot.labelCounter;
    S().editTextItems = (snapshot.textItems || []).map(item => ({...item}));
    S().editTextSelectedId = snapshot.textSelectedId || '';
    renderEditTextCanvas();
    syncTextToolState(true);
}
function pushEditDrawHistory(){
    S().editDrawUndoStack.push(editDrawSnapshot());
    if(S().editDrawUndoStack.length > S().EDIT_DRAW_HISTORY_MAX) S().editDrawUndoStack.shift();
    S().editDrawRedoStack = [];
    syncEditDrawingHistoryButtons();
}
function syncEditDrawingHistoryButtons(){
    ['maskUndoBtn','brushUndoBtn'].forEach(id => { const btn = document.getElementById(id); if(btn){ btn.disabled = !S().editDrawUndoStack.length; btn.style.opacity = S().editDrawUndoStack.length ? '1' : '.42'; } });
    ['maskRedoBtn','brushRedoBtn'].forEach(id => { const btn = document.getElementById(id); if(btn){ btn.disabled = !S().editDrawRedoStack.length; btn.style.opacity = S().editDrawRedoStack.length ? '1' : '.42'; } });
}
function undoEditDrawing(){
    if(!S().editDrawUndoStack.length) return;
    S().editDrawRedoStack.push(editDrawSnapshot());
    restoreEditDrawSnapshot(S().editDrawUndoStack.pop());
    syncEditDrawingHistoryButtons();
}
function redoEditDrawing(){
    if(!S().editDrawRedoStack.length) return;
    S().editDrawUndoStack.push(editDrawSnapshot());
    restoreEditDrawSnapshot(S().editDrawRedoStack.pop());
    syncEditDrawingHistoryButtons();
}
function editCanvasHasPixels(){
    if(editTextHasContent()) return true;
    const canvasEl = editDrawCanvas();
    const data = canvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height).data;
    for(let i = 3; i < data.length; i += 4) if(data[i] > 0) return true;
    return false;
}
function clearEditDrawing(silent=false){
    removeEditTextInlineEditor(false);
    const canvasEl = editDrawCanvas();
    if(!silent && editCanvasHasPixels()) pushEditDrawHistory();
    canvasEl.getContext('2d').clearRect(0, 0, canvasEl.width, canvasEl.height);
    const textCanvasEl = editTextCanvas();
    textCanvasEl?.getContext('2d')?.clearRect(0, 0, textCanvasEl.width, textCanvasEl.height);
    S().editTextItems = [];
    S().editTextSelectedId = '';
    S().editTextDrag = null;
    S().editTextDirty = false;
    S().brushLabelCounter = 1;
    syncTextToolState(true);
    syncEditDrawingHistoryButtons();
}
function resetEditDrawingHistory(){
    removeEditTextInlineEditor(false);
    S().editDrawUndoStack = [];
    S().editDrawRedoStack = [];
    S().brushLabelCounter = 1;
    S().editTextItems = [];
    S().editTextSelectedId = '';
    S().editTextDrag = null;
    S().editTextDirty = false;
    renderEditTextCanvas();
    syncTextToolState(true);
    syncEditDrawingHistoryButtons();
}
function setBrushTool(tool){
    if(tool !== 'text') removeEditTextInlineEditor(true);
    S().brushTool = ['free','rect','ellipse','label','text'].includes(tool) ? tool : 'free';
    syncBrushToolButtons();
    syncTextToolState(true);
}
function syncBrushToolButtons(){
    document.querySelectorAll('[data-brush-tool]').forEach(btn => {
        const active = btn.dataset.brushTool === S().brushTool;
        btn.classList.toggle('primary', active);
        btn.classList.toggle('secondary', !active);
    });
    document.getElementById('cropCanvas')?.classList.toggle('text-mode', S().imageEditMode === 'brush' && S().brushTool === 'text');
}
function editDrawPoint(event){
    const canvasEl = editDrawCanvas();
    const rect = canvasEl.getBoundingClientRect();
    return {x:(event.clientX - rect.left) * canvasEl.width / Math.max(1, rect.width), y:(event.clientY - rect.top) * canvasEl.height / Math.max(1, rect.height)};
}
function gridCustomLineHit(point){
    const canvasEl = editDrawCanvas();
    const threshold = Math.max(8, Math.min(canvasEl.width, canvasEl.height) / 80);
    let best = -1, bestDist = Infinity;
    S().gridCustomLines.forEach((line, index) => {
        const dist = line.type === 'h' ? Math.abs(point.y - line.pos * canvasEl.height) : Math.abs(point.x - line.pos * canvasEl.width);
        if(dist < bestDist && dist <= threshold){ best = index; bestDist = dist; }
    });
    return best;
}
function setGridCustomLinePos(index, point){
    const canvasEl = editDrawCanvas();
    const line = S().gridCustomLines[index];
    if(!line) return;
    line.pos = line.type === 'h'
        ? Math.max(0.001, Math.min(0.999, point.y / Math.max(1, canvasEl.height)))
        : Math.max(0.001, Math.min(0.999, point.x / Math.max(1, canvasEl.width)));
}
function editBrushSize(){ return Number(document.getElementById(S().imageEditMode === 'mask' ? 'maskBrushSize' : 'paintBrushSize')?.value || 20); }
function brushColor(){ return document.getElementById('paintBrushColor')?.value || '#ff2d55'; }
function setupDrawStyle(ctx){
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = editBrushSize();
    ctx.strokeStyle = S().imageEditMode === 'mask' ? MASK_BRUSH_COLOR : brushColor();
    ctx.fillStyle = S().imageEditMode === 'mask' ? MASK_BRUSH_COLOR : brushColor();
    ctx.globalCompositeOperation = 'source-over';
}
function normalizeMaskPreviewCanvas(canvasEl=editDrawCanvas()){
    if(S().imageEditMode !== 'mask' || !canvasEl?.width || !canvasEl?.height) return;
    const ctx = canvasEl.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    const data = imageData.data;
    let changed = false;
    for(let i = 0; i < data.length; i += 4){
        if(data[i + 3] <= 0) continue;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        if(data[i + 3] > MASK_BRUSH_ALPHA) data[i + 3] = MASK_BRUSH_ALPHA;
        changed = true;
    }
    if(changed) ctx.putImageData(imageData, 0, 0);
}
function strokeFreeDrawPoint(point){
    if(!S().editDrawState) return;
    const ctx = editDrawCanvas().getContext('2d');
    setupDrawStyle(ctx);
    const dx = point.x - S().editDrawState.x;
    const dy = point.y - S().editDrawState.y;
    const dist = Math.hypot(dx, dy);
    const radius = Math.max(1, editBrushSize() / 2);
    if(dist > radius){
        const steps = Math.ceil(dist / Math.max(1, radius * 0.35));
        for(let i = 1; i <= steps; i++){
            const t = i / steps;
            const x = S().editDrawState.x + dx * t;
            const y = S().editDrawState.y + dy * t;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.beginPath();
    ctx.moveTo(S().editDrawState.x, S().editDrawState.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    S().editDrawState.x = point.x;
    S().editDrawState.y = point.y;
}
function circledNumber(n){ return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n); }
function drawBrushShape(ctx, start, end){
    setupDrawStyle(ctx);
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y), w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
    if(S().brushTool === 'rect') ctx.strokeRect(x, y, w, h);
    else if(S().brushTool === 'ellipse'){ ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2); ctx.stroke(); }
}
function drawNumberLabel(point){
    const ctx = editDrawCanvas().getContext('2d');
    const size = Math.max(18, editBrushSize() * 2.2);
    const text = circledNumber(S().brushLabelCounter++);
    setupDrawStyle(ctx);
    ctx.save(); ctx.font = `900 ${size}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size / 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(text, point.x, point.y); ctx.fillStyle = brushColor(); ctx.fillText(text, point.x, point.y); ctx.restore();
}
function beginEditDraw(event){
    if(S().imageEditMode === 'crop') return;
    event.preventDefault(); event.stopPropagation();
    const canvasEl = editDrawCanvas();
    canvasEl.setPointerCapture?.(event.pointerId);
    const p = editDrawPoint(event);
    if(S().imageEditMode === 'cutout'){ global.SmartCanvasImageEdit?.selectCutoutAt?.(p, event.shiftKey);
        canvasEl.releasePointerCapture?.(event.pointerId);
        return;
    }
    if(S().imageEditMode === 'grid'){
        if(!S().gridCustomMode) return;
        const hit = gridCustomLineHit(p);
        S().gridCustomHistory.push([...gridCustomLines.map(line => ({...line}))]);
        if(hit >= 0){ S().gridCustomDrag = {index:hit, pointerId:event.pointerId}; setGridCustomLinePos(hit, p); }
        else { S().gridCustomLines.push({type:S().gridCustomOrientation, pos:S().gridCustomOrientation === 'h' ? p.y / canvasEl.height : p.x / canvasEl.width}); S().gridCustomDrag = {index:S().gridCustomLines.length - 1, pointerId:event.pointerId}; }
        S().syncGridCustomUndoBtn?.(); global.SmartCanvasImageEdit?.refreshGridSplitPreview?.(); return;
    }
    const ctx = canvasEl.getContext('2d');
    pushEditDrawHistory();
    if(S().imageEditMode === 'brush' && S().brushTool === 'label'){ drawNumberLabel(p); S().editDrawState = null; canvasEl.releasePointerCapture?.(event.pointerId); return; }
    S().editDrawState = {x:p.x, y:p.y, sx:p.x, sy:p.y, pointerId:event.pointerId, snapshot:(S().imageEditMode === 'brush' && S().brushTool !== 'free') ? editDrawSnapshot() : null};
    setupDrawStyle(ctx);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + .01, p.y + .01);
    if(S().imageEditMode === 'mask' || S().brushTool === 'free') ctx.stroke();
    normalizeMaskPreviewCanvas(canvasEl);
}
function moveEditDraw(event){
    if(S().imageEditMode === 'grid' && S().gridCustomMode && S().gridCustomDrag){ event.preventDefault(); event.stopPropagation(); setGridCustomLinePos(S().gridCustomDrag.index, editDrawPoint(event)); global.SmartCanvasImageEdit?.refreshGridSplitPreview?.(); return; }
    if(!S().editDrawState || S().imageEditMode === 'crop' || S().imageEditMode === 'grid' || S().imageEditMode === 'cutout') return;
    event.preventDefault(); event.stopPropagation();
    const ctx = editDrawCanvas().getContext('2d');
    const p = editDrawPoint(event);
    if(S().imageEditMode === 'brush' && S().brushTool !== 'free'){ restoreEditDrawSnapshot(S().editDrawState.snapshot); drawBrushShape(ctx, {x:S().editDrawState.sx, y:S().editDrawState.sy}, p); return; }
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    if(events.length){
        events.forEach(ev => strokeFreeDrawPoint(editDrawPoint(ev)));
    } else {
        strokeFreeDrawPoint(p);
    }
    normalizeMaskPreviewCanvas();
}
function endEditDraw(event){
    if(S().editDrawState && event?.pointerId != null) editDrawCanvas().releasePointerCapture?.(event.pointerId);
    if(S().gridCustomDrag && event?.pointerId != null) editDrawCanvas().releasePointerCapture?.(event.pointerId);
    S().editDrawState = null; S().gridCustomDrag = null; syncEditDrawingHistoryButtons();
}
    const api = Object.freeze({
        registerDeps,
        editDrawCanvas, editTextCanvas, editTextContext, selectedEditTextItem, defaultEditTextText,
        editTextSizeFromBrush, createEditTextItem, textItemFont, measureEditTextItem, hitEditTextItem,
        renderEditTextCanvas, syncTextToolState, syncSelectedEditTextStyleFromBrush, beginTextEditChange,
        setSelectedEditTextItem, confirmSelectedEditTextItem, editTextCanvasScale, selectInlineEditorText,
        inlineEditorText, autosizeEditTextInlineEditor, positionEditTextInlineEditor, removeEditTextInlineEditor,
        beginEditTextInline, editTextPoint, beginEditText, updateEditTextCursor, moveEditText, endEditText,
        editTextHasContent, resizeEditTextCanvas, resizeEditDrawCanvas,
        editDrawSnapshot, restoreEditDrawSnapshot, pushEditDrawHistory, syncEditDrawingHistoryButtons,
        undoEditDrawing, redoEditDrawing, editCanvasHasPixels, clearEditDrawing, resetEditDrawingHistory,
        setBrushTool, syncBrushToolButtons, editDrawPoint, gridCustomLineHit, setGridCustomLinePos,
        editBrushSize, brushColor, setupDrawStyle, normalizeMaskPreviewCanvas, strokeFreeDrawPoint,
        circledNumber, drawBrushShape, drawNumberLabel, beginEditDraw, moveEditDraw, endEditDraw,
        MASK_BRUSH_ALPHA, MASK_BRUSH_COLOR,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('imageDraw', api);
    }
    global.SmartCanvasImageDraw = api;
})(window);
