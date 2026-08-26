/**
 * Smart Canvas — grid join (multi-image stitch) in image editor.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;
    let gridJoinLayout = null;
    let gridJoinDrag = null;
    let gridJoinGroupId = '';
    let gridJoinOutputSize = 2048;
    let gridJoinUserMoved = false;
    const gridJoinImageCache = new Map();

    function registerDeps(next){
        deps = next;
    }

    function d(){
        return deps || global.SmartCanvasCore?.tryDeps?.() || null;
    }

    function isJoinMode(){
        return d()?.getGridOperationMode?.() === 'join';
    }

    function gridGapInputValue(){
        return Math.max(0, Math.min(240, Number(document.getElementById('gridGapSize')?.value || 0)));
    }

    function currentGridJoinItems(){
        const ctx = d();
        if(gridJoinGroupId){
            const group = ctx.getNodes?.()?.find(n => n.id === gridJoinGroupId && ctx.isSmartGroupNode?.(n));
            if(group){
                return ctx.smartGroupImageRefs?.(group)
                    ?.filter(r => ctx.mediaKindForItem?.(r.item) === 'image' && r.item?.url)
                    ?.map((r, index) => ({item:r.item, source:r.source, index})) || [];
            }
        }
        const node = ctx.currentEditImage?.().node;
        return (node?.images || [])
            .map((item, index) => ({item:ctx.imageForDisplay?.(item), source:item, index}))
            .filter(entry => ctx.mediaKindForItem?.(entry.item) === 'image' && entry.item?.url);
    }

    function canGridJoinCurrentNode(){
        return currentGridJoinItems().length > 1;
    }

    function gridJoinAutoDims(count){
        const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
        return {rows:Math.max(1, Math.ceil(count / cols)), cols};
    }

    function gridJoinNaturalSize(entry){
        const item = entry?.item || {};
        const cached = gridJoinImageCache.get(entry?.index);
        const w = Number(item.natural_w || item.width || cached?.naturalWidth || 0);
        const h = Number(item.natural_h || item.height || cached?.naturalHeight || 0);
        return {w:Math.max(1, w || 512), h:Math.max(1, h || 512)};
    }

    function gridJoinBaseCellSize(items){
        const sizes = items.map(gridJoinNaturalSize);
        const maxW = Math.max(1, ...sizes.map(size => size.w));
        const maxH = Math.max(1, ...sizes.map(size => size.h));
        const scale = Math.min(1, 420 / Math.max(maxW, maxH));
        return {w:Math.max(1, Math.round(maxW * scale)), h:Math.max(1, Math.round(maxH * scale)), scale};
    }

    function gridJoinItemDisplaySize(entry, cell){
        return {
            w:Math.max(1, Math.round(cell.w)),
            h:Math.max(1, Math.round(cell.h))
        };
    }

    function gridJoinVisualOrder(layout=gridJoinLayout){
        return (layout?.items || [])
            .slice()
            .sort((a, b) => (Number(a.y || 0) - Number(b.y || 0)) || (Number(a.x || 0) - Number(b.x || 0)))
            .map(item => Number(item.index));
    }

    function gridJoinCanvasSize(layout=gridJoinLayout){
        if(!layout) return {w:1, h:1};
        const gap = Math.max(0, Number(layout.gap || 0));
        const byGrid = {
            w:Math.max(1, Number(layout.cols || 1) * Number(layout.cellW || 1) + Math.max(0, Number(layout.cols || 1) - 1) * gap),
            h:Math.max(1, Number(layout.rows || 1) * Number(layout.cellH || 1) + Math.max(0, Number(layout.rows || 1) - 1) * gap)
        };
        const byItems = (layout.items || []).reduce((acc, item) => ({
            w:Math.max(acc.w, Number(item.x || 0) + Number(item.w || 0)),
            h:Math.max(acc.h, Number(item.y || 0) + Number(item.h || 0))
        }), byGrid);
        return {w:Math.ceil(byItems.w), h:Math.ceil(byItems.h)};
    }

    function gridJoinDragTarget(){
        if(!gridJoinDrag || !gridJoinLayout) return null;
        const dragged = gridJoinLayout.items.find(entry => Number(entry.index) === Number(gridJoinDrag.index));
        if(!dragged) return null;
        const dx = gridJoinDrag.dx || 0;
        const dy = gridJoinDrag.dy || 0;
        const cx = dragged.x + dx + dragged.w / 2;
        const cy = dragged.y + dy + dragged.h / 2;
        return (gridJoinLayout.items || [])
            .filter(entry => Number(entry.index) !== Number(gridJoinDrag.index))
            .map(entry => {
                const inside = cx >= entry.x && cx <= entry.x + entry.w && cy >= entry.y && cy <= entry.y + entry.h;
                const score = Math.hypot(cx - (entry.x + entry.w / 2), cy - (entry.y + entry.h / 2));
                return {entry, inside, score};
            })
            .filter(item => item.inside || item.score < Math.max(dragged.w, dragged.h, item.entry.w, item.entry.h) * 0.55)
            .sort((a, b) => (b.inside - a.inside) || a.score - b.score)[0]?.entry || null;
    }

    function setGridJoinLayoutOrder(order, rows=null, cols=null, gapOverride=null){
        const entries = currentGridJoinItems();
        if(!entries.length){ gridJoinLayout = null; return null; }
        const byIndex = new Map(entries.map(entry => [entry.index, entry]));
        const ordered = [
            ...order.map(index => byIndex.get(Number(index))).filter(Boolean),
            ...entries.filter(entry => !order.includes(entry.index))
        ];
        const auto = gridJoinAutoDims(ordered.length);
        const nextRows = Math.max(1, Number(rows || gridJoinLayout?.rows || auto.rows) || auto.rows);
        const nextCols = Math.max(1, Number(cols || gridJoinLayout?.cols || auto.cols) || auto.cols);
        const cell = gridJoinBaseCellSize(ordered);
        const gap = Math.max(0, Math.min(240, Number(gapOverride ?? document.getElementById('gridGapSize')?.value ?? 0)));
        const layoutItems = ordered.map((entry, orderIndex) => {
            const row = Math.floor(orderIndex / nextCols);
            const col = orderIndex % nextCols;
            const {w, h} = gridJoinItemDisplaySize(entry, cell);
            return {
                index:entry.index,
                x:col * (cell.w + gap),
                y:row * (cell.h + gap),
                w,
                h
            };
        });
        gridJoinLayout = {rows:nextRows, cols:nextCols, cellW:cell.w, cellH:cell.h, gap, items:layoutItems};
        return gridJoinLayout;
    }

    function ensureGridJoinLayout(rows=null, cols=null){
        const items = currentGridJoinItems();
        if(!items.length){ gridJoinLayout = null; return null; }
        const auto = gridJoinAutoDims(items.length);
        const nextRows = Math.max(1, Number(rows || gridJoinLayout?.rows || auto.rows) || auto.rows);
        const nextCols = Math.max(1, Number(cols || gridJoinLayout?.cols || auto.cols) || auto.cols);
        const byIndex = new Map(items.map(entry => [entry.index, entry]));
        const previousOrder = gridJoinVisualOrder()
            .map(index => byIndex.get(Number(index)))
            .filter(Boolean);
        const ordered = [
            ...previousOrder,
            ...items.filter(entry => !previousOrder.some(prev => Number(prev.index) === Number(entry.index)))
        ];
        const cell = gridJoinBaseCellSize(ordered);
        const gap = gridGapInputValue();
        const layoutItems = ordered.map((entry, order) => {
            const row = Math.floor(order / nextCols);
            const col = order % nextCols;
            const {w, h} = gridJoinItemDisplaySize(entry, cell);
            return {
                index:entry.index,
                x:col * (cell.w + gap),
                y:row * (cell.h + gap),
                w,
                h
            };
        });
        gridJoinLayout = {rows:nextRows, cols:nextCols, cellW:cell.w, cellH:cell.h, gap, items:layoutItems};
        return gridJoinLayout;
    }

    function loadGridJoinImage(entry){
        const cached = gridJoinImageCache.get(entry.index);
        if(cached?.complete && cached.naturalWidth) return Promise.resolve(cached);
        const ctx = d();
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                gridJoinImageCache.set(entry.index, img);
                resolve(img);
            };
            img.onerror = () => {
                if(img.dataset.proxyFallbackTried === '1'){
                    reject(new Error('图片加载失败'));
                    return;
                }
                const fallback = ctx.proxiedMediaUrl?.(entry.item);
                if(!fallback || fallback === img.src){
                    reject(new Error('图片加载失败'));
                    return;
                }
                img.dataset.proxyFallbackTried = '1';
                img.src = fallback;
            };
            img.src = ctx.displayMediaUrl?.(entry.item) || entry.item?.url || '';
        });
    }

    function renderGridJoinPreview(){
        const ctx = d();
        const host = document.getElementById('gridJoinCanvas');
        const countEl = document.getElementById('gridSplitCount');
        const cropCanvasEl = document.getElementById('cropCanvas');
        if(!host) return;
        host.innerHTML = '';
        if(ctx.imageEditMode !== 'grid' || !isJoinMode()){
            host.style.display = 'none';
            if(cropCanvasEl){ cropCanvasEl.style.width = ''; cropCanvasEl.style.height = ''; }
            return;
        }
        const items = currentGridJoinItems();
        if(items.length <= 1){
            host.style.display = 'none';
            if(cropCanvasEl){ cropCanvasEl.style.width = ''; cropCanvasEl.style.height = ''; }
            if(countEl) countEl.textContent = '分组需要至少 2 张图片';
            return;
        }
        const layout = ensureGridJoinLayout();
        const size = gridJoinCanvasSize(layout);
        const zoom = Math.max(0.05, Number(ctx.imageEditZoom ?? 1));
        const displayW = Math.max(1, Math.round(size.w * zoom));
        const displayH = Math.max(1, Math.round(size.h * zoom));
        host.style.display = 'block';
        host.style.width = `${Math.max(1, Math.round(size.w))}px`;
        host.style.height = `${Math.max(1, Math.round(size.h))}px`;
        host.style.transform = `scale(${zoom})`;
        host.style.transformOrigin = '0 0';
        if(cropCanvasEl){
            cropCanvasEl.style.width = `${displayW}px`;
            cropCanvasEl.style.height = `${displayH}px`;
        }
        const byIndex = new Map(items.map(entry => [entry.index, entry]));
        (layout.items || []).forEach(item => {
            const entry = byIndex.get(item.index);
            if(!entry) return;
            const img = document.createElement('img');
            img.className = 'grid-join-item';
            img.draggable = false;
            img.dataset.gridJoinIndex = String(item.index);
            img.style.left = `${Math.round(item.x)}px`;
            img.style.top = `${Math.round(item.y)}px`;
            img.style.width = `${Math.round(item.w)}px`;
            img.style.height = `${Math.round(item.h)}px`;
            img.alt = entry.item.name || `image-${item.index + 1}`;
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const hadNaturalSize = Boolean(entry.source.natural_w && entry.source.natural_h);
                gridJoinImageCache.set(item.index, img);
                if(!entry.source.natural_w && img.naturalWidth) entry.source.natural_w = img.naturalWidth;
                if(!entry.source.natural_h && img.naturalHeight) entry.source.natural_h = img.naturalHeight;
                if(!hadNaturalSize && img.naturalWidth && img.naturalHeight && ctx.imageEditMode === 'grid' && isJoinMode()){
                    ensureGridJoinLayout();
                    renderGridJoinPreview();
                }
            };
            img.onerror = () => {
                if(img.dataset.proxyFallbackTried === '1') return;
                const fallback = ctx.proxiedMediaUrl?.(entry.item);
                if(!fallback || fallback === img.getAttribute('src')) return;
                img.dataset.proxyFallbackTried = '1';
                img.src = fallback;
            };
            img.src = ctx.displayMediaUrl?.(entry.item) || entry.item?.url || '';
            host.appendChild(img);
        });
        if(countEl) countEl.textContent = `将拼接 ${items.length} 张图片 · 输出长边 ${Math.round(gridJoinOutputSize / 1024)}K`;
    }

    function resetGridJoinLayout(){
        gridJoinUserMoved = false;
        gridJoinLayout = null;
        ensureGridJoinLayout();
        renderGridJoinPreview();
    }

    function applyGridJoinPreset(rows, cols){
        gridJoinUserMoved = false;
        const order = gridJoinVisualOrder();
        if(order.length) setGridJoinLayoutOrder(order, rows, cols);
        else {
            gridJoinLayout = null;
            ensureGridJoinLayout(rows, cols);
        }
        renderGridJoinPreview();
    }

    async function applyImageGridJoin(){
        const ctx = d();
        const {node, image} = ctx.currentEditImage?.() || {};
        const items = currentGridJoinItems();
        if(!node || items.length <= 1){
            ctx.toast?.('请从包含多张图片的分组打开宫格拼接');
            return;
        }
        const layout = ensureGridJoinLayout();
        if(!layout?.items?.length) return;
        const size = gridJoinCanvasSize(layout);
        const targetLong = Math.max(256, Number(gridJoinOutputSize) || 2048);
        const outputScale = Math.max(1, targetLong / Math.max(1, Math.max(size.w, size.h)));
        const canvasEl = document.createElement('canvas');
        canvasEl.width = Math.max(1, Math.round(size.w * outputScale));
        canvasEl.height = Math.max(1, Math.round(size.h * outputScale));
        const c2d = canvasEl.getContext('2d');
        c2d.fillStyle = '#ffffff';
        c2d.fillRect(0, 0, canvasEl.width, canvasEl.height);
        const byIndex = new Map(items.map(entry => [entry.index, entry]));
        for(const item of layout.items || []){
            const entry = byIndex.get(item.index);
            if(!entry) continue;
            const img = await loadGridJoinImage(entry);
            drawImageCover(c2d, img, Math.round(item.x * outputScale), Math.round(item.y * outputScale), Math.round(item.w * outputScale), Math.round(item.h * outputScale));
        }
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        const base = ctx.safeExportFileName?.((ctx.downloadNameForMediaItem?.(image || items[0]?.item, 'image') || 'image').replace(/\.[^.]+$/, ''), 'image') || 'image';
        const file = blob ? await ctx.uploadCroppedBlob?.(blob, `${base}_join.png`) : null;
        if(file){
            const rect = ctx.nodeRect?.(node);
            const outputNode = ctx.createImageNodeAt?.({x:rect.x + rect.width + 240, y:rect.y + rect.height / 2}, [{
                url:file.url,
                name:file.name,
                kind:'image',
                natural_w:canvasEl.width,
                natural_h:canvasEl.height
            }], {select:true, skipUndo:true});
            if(outputNode) outputNode.title = 'Grid Join';
            ctx.closeImageEditor?.();
            ctx.render?.();
            ctx.scheduleSave?.();
            ctx.toast?.('已输出拼接图片');
        }
    }

    function beginGridJoinDrag(event){
        const ctx = d();
        if(ctx.imageEditMode !== 'grid' || !isJoinMode()) return;
        const itemEl = event.target?.closest?.('.grid-join-item');
        if(!itemEl) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Number(itemEl.dataset.gridJoinIndex);
        const item = gridJoinLayout?.items?.find(entry => Number(entry.index) === index);
        const host = document.getElementById('gridJoinCanvas');
        if(!item || !host) return;
        itemEl.setPointerCapture?.(event.pointerId);
        gridJoinDrag = {index, pointerId:event.pointerId, sx:event.clientX, sy:event.clientY, x:item.x, y:item.y};
        itemEl.classList.add('dragging');
    }

    function moveGridJoinDrag(event){
        const ctx = d();
        if(!gridJoinDrag || ctx.imageEditMode !== 'grid' || !isJoinMode()) return;
        event.preventDefault();
        event.stopPropagation();
        const item = gridJoinLayout?.items?.find(entry => Number(entry.index) === Number(gridJoinDrag.index));
        if(!item) return;
        const host = document.getElementById('gridJoinCanvas');
        const rect = host?.getBoundingClientRect();
        const logical = gridJoinCanvasSize();
        const scale = rect ? Math.max(0.001, rect.width / Math.max(1, logical.w)) : Math.max(0.001, ctx.imageEditZoom || 1);
        const dx = (event.clientX - gridJoinDrag.sx) / scale;
        const dy = (event.clientY - gridJoinDrag.sy) / scale;
        gridJoinDrag.dx = dx;
        gridJoinDrag.dy = dy;
        const el = host?.querySelector(`[data-grid-join-index="${CSS.escape(String(gridJoinDrag.index))}"]`);
        if(el) el.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
    }

    function endGridJoinDrag(event){
        if(!gridJoinDrag) return;
        const host = document.getElementById('gridJoinCanvas');
        const draggedEl = host?.querySelector(`[data-grid-join-index="${CSS.escape(String(gridJoinDrag.index))}"]`);
        if(draggedEl) draggedEl.classList.remove('dragging');
        const dragged = gridJoinLayout?.items?.find(entry => Number(entry.index) === Number(gridJoinDrag.index));
        const target = gridJoinDragTarget();
        if(dragged && target){
            const order = gridJoinVisualOrder();
            const from = order.indexOf(Number(dragged.index));
            const to = order.indexOf(Number(target.index));
            if(from >= 0 && to >= 0 && from !== to){
                order.splice(from, 1);
                order.splice(to, 0, Number(dragged.index));
                setGridJoinLayoutOrder(order, gridJoinLayout.rows, gridJoinLayout.cols, gridJoinLayout.gap);
                gridJoinUserMoved = true;
                renderGridJoinPreview();
            }
        }
        if(event?.pointerId != null) event.target?.releasePointerCapture?.(event.pointerId);
        gridJoinDrag = null;
    }

    function clearGridJoinDrag(){
        gridJoinDrag = null;
    }

    function openGroupGridJoin(group){
        const ctx = d();
        if(!ctx.isSmartGroupNode?.(group)) return;
        const refs = ctx.smartGroupImageRefs?.(group)?.filter(r => ctx.mediaKindForItem?.(r.item) === 'image') || [];
        if(refs.length <= 1){
            ctx.toast?.('分组至少需要 2 张图片才能宫格拼接');
            return;
        }
        const first = refs[0];
        ctx.openImageEditor?.(first.nodeId, first.index);
        if(!ctx.imageEditModal?.classList?.contains('open')) return;
        gridJoinGroupId = group.id;
        ctx.setImageEditMode?.('grid', true);
        ctx.setGridOperationMode?.('join');
    }

    function setGridJoinOutputSize(size){
        gridJoinOutputSize = Math.max(256, Math.min(8192, Number(size) || 2048));
        syncGridJoinSizeControls();
        d()?.refreshGridSplitPreview?.();
    }

    function syncGridJoinSizeControls(){
        document.querySelectorAll('[data-grid-join-size]').forEach(btn => {
            const active = Number(btn.dataset.gridJoinSize || 0) === Number(gridJoinOutputSize);
            btn.classList.toggle('active', active);
        });
    }

    function resetGridJoinState(){
        gridJoinLayout = null;
        gridJoinDrag = null;
        gridJoinGroupId = '';
        gridJoinUserMoved = false;
        gridJoinImageCache.clear();
    }

function drawImageCover(ctx, img, dx, dy, dw, dh){
 const sw = Math.max(1, Number(img?.naturalWidth || img?.videoWidth || img?.width || 1));
 const sh = Math.max(1, Number(img?.naturalHeight || img?.videoHeight || img?.height || 1));
 const targetW = Math.max(1, Number(dw || 1));
 const targetH = Math.max(1, Number(dh || 1));
 const scale = Math.max(targetW / sw, targetH / sh);
 const cropW = Math.max(1, targetW / scale);
 const cropH = Math.max(1, targetH / scale);
 const sx = Math.max(0, (sw - cropW) / 2);
 const sy = Math.max(0, (sh - cropH) / 2);
 ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, targetW, targetH);
}

    const api = Object.freeze({
        registerDeps,
        applyGridJoinPreset,
        applyImageGridJoin,
        beginGridJoinDrag,
        canGridJoinCurrentNode,
        currentGridJoinItems,
        endGridJoinDrag,
        moveGridJoinDrag,
        clearGridJoinDrag,
        ensureGridJoinLayout,
        gridJoinAutoDims,
        gridJoinBaseCellSize,
        gridJoinCanvasSize,
        gridJoinDragTarget,
        gridJoinItemDisplaySize,
        gridJoinNaturalSize,
        gridJoinVisualOrder,
        loadGridJoinImage,
        openGroupGridJoin,
        renderGridJoinPreview,
        resetGridJoinLayout,
        resetGridJoinState,
        setGridJoinLayoutOrder,
        setGridJoinOutputSize,
        syncGridJoinSizeControls,
        gridGapInputValue,
        drawImageCover,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('imageGridJoin', api);
    }

    global.SmartCanvasImageGridJoin = api;
})(window);
