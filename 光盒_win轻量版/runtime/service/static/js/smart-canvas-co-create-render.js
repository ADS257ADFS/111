/**
 * Smart Canvas — co-create grouped output (node body + layout only).
 */
(function(global){
    'use strict';

    const GRID_GAP = 6;
    const GROUP_GAP = 8;
    const LABEL_H = 14;
    const LABEL_GAP = 4;
    const SHELL_PAD = 24; // .image-node.co-create-node padding: 12px × 2 (border-box)
    const BASE_CELL = 120;

    function groupMeta(node){
        return Array.isArray(node?.coCreateGroupMeta) ? node.coCreateGroupMeta : [];
    }

    function hasGroupedOutput(node){
        if(!node || node.type === 'smart-prompt' || node.type === 'smart-loop') return false;
        if(groupMeta(node).length) return true;
        if((node.pendingTasks || []).some(task => task.coCreateGroupIndex != null)) return true;
        return (node.images || []).some(img => img && (img.coCreateGroupIndex != null || img.coCreatePrompt));
    }

    function imageAspectRatio(img){
        const w = Number(img?.natural_w || img?.width || img?.w || 0);
        const h = Number(img?.natural_h || img?.height || img?.h || 0);
        if(w > 0 && h > 0) return w / h;
        return 0;
    }

    function resolveImageAspectRatio(img, node){
        const ar = imageAspectRatio(img);
        if(ar > 0) return ar;
        if(img?.generatedResult) return 1;
        const refAr = Number(node?.coCreateRefAspect);
        if(refAr > 0) return refAr;
        return 1;
    }

    function cellSizeForAspect(aspectRatio, scale){
        const s = Number(scale) > 0 ? scale : 1;
        const ar = aspectRatio > 0 ? aspectRatio : 1;
        const base = Math.round(BASE_CELL * s);
        if(ar >= 1){
            return { cellW: base, cellH: Math.max(48, Math.round(base / ar)) };
        }
        return { cellW: Math.max(48, Math.round(base * ar)), cellH: base };
    }

    function gridCols(count){
        const c = Math.max(1, Number(count) || 1);
        if(c <= 1) return 1;
        return Math.min(4, Math.max(2, Math.ceil(Math.sqrt(c))));
    }

    function imagesByGroup(node){
        const imgs = (node.images || []).map((img, index) => ({ img, index }));
        const meta = groupMeta(node);
        if(!meta.length){
            const map = new Map();
            imgs.forEach(entry => {
                const gi = Number(entry.img?.coCreateGroupIndex);
                const key = Number.isFinite(gi) ? gi : 0;
                if(!map.has(key)) map.set(key, []);
                map.get(key).push(entry);
            });
            return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([groupIndex, items]) => ({
                groupIndex,
                prompt: items[0]?.img?.coCreatePrompt || '',
                items
            }));
        }
        return meta.map(group => ({
            groupIndex: group.groupIndex,
            prompt: group.prompt || '',
            items: imgs.filter(entry => Number(entry.img?.coCreateGroupIndex) === Number(group.groupIndex))
        }));
    }

    function perGroupCount(node){
        return Math.max(1, Number(node?.coCreatePerGroupCount) || 1);
    }

    function buildDisplayGroups(node){
        const grouped = imagesByGroup(node);
        if(grouped.length) return grouped;
        const meta = groupMeta(node);
        if(!meta.length) return [];
        return meta.map(group => ({
            groupIndex: group.groupIndex,
            prompt: group.prompt || '',
            items: []
        }));
    }

    function slotsForGroup(group, perGroup, pending){
        if(!pending) return 0;
        return Math.max(0, perGroup - (group.items || []).length);
    }

    function measureGroupGrid(group, node, scale, perGroup, pending){
        const items = group.items || [];
        const slots = slotsForGroup(group, perGroup, pending);
        const cellSizes = items.map(entry => cellSizeForAspect(resolveImageAspectRatio(entry.img, node), scale));
        const placeholderAr = items.length
            ? resolveImageAspectRatio(items[items.length - 1].img, node)
            : (Number(node?.coCreateRefAspect) > 0 ? Number(node.coCreateRefAspect) : 1);
        const slotSize = cellSizeForAspect(placeholderAr, scale);
        for(let i = 0; i < slots; i++) cellSizes.push(slotSize);
        if(!cellSizes.length) cellSizes.push(slotSize);

        const count = cellSizes.length;
        const cols = gridCols(count);
        const rows = Math.ceil(count / cols);
        let gridW = 0;
        let gridH = 0;
        for(let r = 0; r < rows; r++){
            let rowW = 0;
            let rowH = 0;
            for(let c = 0; c < cols; c++){
                const idx = r * cols + c;
                if(idx >= count) break;
                if(c) rowW += GRID_GAP;
                rowW += cellSizes[idx].cellW;
                rowH = Math.max(rowH, cellSizes[idx].cellH);
            }
            gridH += rowH;
            if(r < rows - 1) gridH += GRID_GAP;
            gridW = Math.max(gridW, rowW);
        }
        return { count, cols, rows, gridW, gridH, cellSizes, slots, slotSize };
    }

    function measureOutput(node, images, scale){
        const displayGroups = buildDisplayGroups(node);
        if(!displayGroups.length) return null;
        const perGroup = perGroupCount(node);
        const pending = Math.max(0, Number(node?.pending) || 0);
        let maxGridW = 0;
        let contentH = 0;
        displayGroups.forEach((group, index) => {
            if(index) contentH += GROUP_GAP;
            const metrics = measureGroupGrid(group, node, scale, perGroup, pending);
            maxGridW = Math.max(maxGridW, metrics.gridW);
            contentH += LABEL_H + LABEL_GAP + metrics.gridH;
        });
        const sample = cellSizeForAspect(1, scale);
        return {
            width: Math.max(64, SHELL_PAD + maxGridW),
            height: Math.max(64, SHELL_PAD + contentH),
            cols: gridCols(perGroup),
            rows: Math.ceil(perGroup / gridCols(perGroup)),
            thumb: Math.max(sample.cellW, sample.cellH),
            coThumbW: sample.cellW,
            coThumbH: sample.cellH,
            single: false,
            coCreate: true,
            scale
        };
    }

    function renderNodeBody(node, layout, h){
        if(!hasGroupedOutput(node)) return '';
        const scale = Number(layout?.scale) > 0 ? Number(layout.scale) : 1;
        const esc = h.escapeHtml;
        const escAttr = h.escapeAttr;
        const tr = h.tr;
        const displayGroups = buildDisplayGroups(node);
        if(!displayGroups.length) return '';

        const perGroup = perGroupCount(node);
        const pending = Math.max(0, Number(node?.pending) || 0);
        const waveLoader = () => `<div class="generation-wave-loader generation-ig-loader" role="img" aria-label="生成中" aria-hidden="true"><span class="generation-ig-dots" aria-hidden="true"></span><span class="generation-ig-glow" aria-hidden="true"></span></div>`;
        const body = displayGroups.map(group => {
            const metrics = measureGroupGrid(group, node, scale, perGroup, pending);
            const promptLabel = esc(String(group.prompt || '').trim() || tr('smart.coCreateUntitled') || '提示词');
            const cells = [];
            group.items.forEach((entry, itemIdx) => {
                const img = h.imageForDisplay(entry.img);
                const size = metrics.cellSizes[itemIdx] || cellSizeForAspect(resolveImageAspectRatio(entry.img, node), scale);
                const selected = h.selectedImage?.nodeId === node.id && h.selectedImage?.index === entry.index;
                cells.push(`<div class="thumb-item co-create-thumb-item ${selected ? 'image-selected' : ''}" data-image-index="${entry.index}" data-media-signature="${escAttr(`${h.mediaKindForItem(img)}:${img?.url || ''}`)}" style="width:${size.cellW}px;height:${size.cellH}px"><div class="co-create-thumb-frame">${h.thumbMediaHtml(img)}</div>${h.imageResolutionBadgeHtml(img)}<button class="mini-x image-delete" type="button" data-image-index="${entry.index}" title="${esc(tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button></div>`);
            });
            for(let i = 0; i < metrics.slots; i++){
                const size = metrics.slotSize;
                cells.push(`<div class="loading-cell" style="width:${size.cellW}px;height:${size.cellH}px">${waveLoader()}</div>`);
            }
            return `<div class="co-create-group" data-co-create-group="${group.groupIndex}">
                <div class="co-create-group-head" data-co-create-drag="1" title="${promptLabel}">${promptLabel}</div>
                <div class="co-create-group-grid" style="grid-template-columns:repeat(${metrics.cols}, max-content)">${cells.join('')}</div>
            </div>`;
        }).join('');

        return `<div class="co-create-output" data-co-create-drag="1">${body}</div>`;
    }

    function adjustLayout(node, layout, images, scale){
        if(!hasGroupedOutput(node)) return null;
        return measureOutput(node, images, scale);
    }

    function blocksThumbReorder(node){
        return hasGroupedOutput(node);
    }

    function isNodeDragSurface(node, target){
        if(!hasGroupedOutput(node) || !target) return false;
        if(target.closest?.('.image-delete,.mini-x,[data-inline-generation-cancel],[data-pending-slot-cancel],.node-resize-handle,.node-port,.co-create-thumb-item')) return false;
        return Boolean(target.closest?.('[data-co-create-drag],.co-create-output'));
    }

    function allowsThumbDetach(node){
        return hasGroupedOutput(node);
    }

    const api = Object.freeze({
        hasGroupedOutput,
        imagesByGroup,
        renderNodeBody,
        adjustLayout,
        blocksThumbReorder,
        isNodeDragSurface,
        allowsThumbDetach
    });

    global.SmartCanvasCoCreateRender = api;
})(window);
