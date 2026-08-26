(function(global){
    'use strict';
    let deps = null;
    let installed = false;
    let skipNextBlankClick = false;
    const selected = new Set();
    function fn(name){
        return typeof global[name] === 'function' ? global[name] : null;
    }
    function d(){ return deps; }
    function isSelected(index){ return selected.has(Number(index)); }
    function selectedClass(index){ return isSelected(index) ? 'conn-selected' : ''; }
    function selectedEndClass(index){ return isSelected(index) ? 'conn-selected-end' : ''; }
    function hasSelection(){ return selected.size > 0; }
    function selectedIndices(){ return [...selected].filter(n => Number.isInteger(n) && n >= 0); }
    function clearNodeSelectionOnly(){
        const core = global.SmartCanvasCore?.tryDeps?.() || null;
        if(core){
            core.selectedId = '';
            core.selectedIds = [];
            core.selectedImage = {nodeId:'', index:-1};
            core.smartGroupCapsuleOnly = false;
        }
        global.SmartCanvasSelectionCapsuleSelection?.clearMultiSelectSnapshot?.();
        fn('syncSelectionUi')?.();
        d()?.hideSelectionGroupBox?.();
        d()?.hideImageQuickToolbar?.();
    }
    function clearNodeSelection(){
        fn('clearSelection')?.();
        fn('syncSelectionUi')?.();
        d()?.hideSelectionGroupBox?.();
        d()?.hideImageQuickToolbar?.();
    }
    function clear(opts = {}){
        if(!selected.size) return;
        selected.clear();
        if(!opts.skipRefresh) applySelectionVisuals();
    }
    function clearAllSelections(){
        clearNodeSelection();
        clear();
    }
    function hasSettledNodeMarquee(){
        const core = global.SmartCanvasCore?.tryDeps?.() || null;
        const box = document.getElementById('selectionBox');
        return Boolean((core?.selectedIds?.length || 0) > 1 && box?.classList?.contains?.('is-settled'));
    }
    function hasNodeSelection(){
        const core = global.SmartCanvasCore?.tryDeps?.() || null;
        return Boolean(core?.selectedId || (core?.selectedIds?.length || 0) > 0);
    }
    function applySelectionVisuals(){
        const world = d()?.world || document.getElementById('world');
        if(!world) return;
        world.querySelectorAll('[data-conn-index].conn-hit').forEach(hit => {
            const index = Number(hit.dataset.connIndex);
            const line = hit.previousElementSibling;
            const end = hit.nextElementSibling;
            const cut = end?.nextElementSibling;
            const on = isSelected(index);
            line?.classList?.toggle('conn-selected', on);
            end?.classList?.toggle('conn-selected-end', on);
            cut?.classList?.toggle('is-selected', on);
        });
    }
    function addIndices(indices, shiftKey){
        const list = [...new Set(indices.map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0))];
        if(!list.length) return;
        clearNodeSelectionOnly();
        if(shiftKey){
            list.forEach(idx => {
                if(selected.has(idx)) selected.delete(idx);
                else selected.add(idx);
            });
        } else {
            selected.clear();
            list.forEach(idx => selected.add(idx));
        }
        applySelectionVisuals();
    }
    function selectIndex(index, event){
        const idx = Number(index);
        if(!Number.isInteger(idx) || idx < 0) return;
        clearNodeSelection();
        if(event?.shiftKey){
            if(selected.has(idx)) selected.delete(idx);
            else selected.add(idx);
        } else {
            selected.clear();
            selected.add(idx);
        }
        applySelectionVisuals();
        fn('focusCanvasForShortcuts')?.();
    }
    function deleteIndices(indices){
        const list = [...new Set(indices.map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0))];
        if(!list.length) return;
        selected.clear();
        const disconnectMany = fn('disconnectConnections');
        const disconnectOne = fn('disconnectConnection');
        if(list.length === 1) disconnectOne?.(list[0]);
        else disconnectMany?.(list);
        applySelectionVisuals();
    }
    function deleteSelected(){
        const indices = selectedIndices();
        if(!indices.length) return false;
        deleteIndices(indices);
        return true;
    }
    function stopConnEvent(event){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }
    function connWorldPoints(conn, nodes, nodeRect){
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if(!fromNode || !toNode) return null;
        const fr = nodeRect(fromNode);
        const tr = nodeRect(toNode);
        const isHistory = (conn.kind || 'flow') === 'history';
        return {
            fx: isHistory ? fr.x + fr.width / 2 : fr.x + fr.width,
            fy: isHistory ? fr.y + fr.height : fr.y + fr.height / 2,
            tx: isHistory ? tr.x + tr.width / 2 : tr.x,
            ty: isHistory ? tr.y : tr.y + tr.height / 2,
            isHistory
        };
    }
    function cubicPoint(fx, fy, tx, ty, isHistory, t){
        const dx = Math.max(50, Math.abs(tx - fx) * 0.45);
        const dy = Math.max(36, Math.abs(ty - fy) * 0.45);
        const c1x = isHistory ? fx : fx + dx;
        const c1y = isHistory ? fy + dy : fy;
        const c2x = isHistory ? tx : tx - dx;
        const c2y = isHistory ? ty - dy : ty;
        const u = 1 - t;
        return {
            x: u * u * u * fx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * tx,
            y: u * u * u * fy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ty
        };
    }
    function pointInRect(x, y, minX, minY, maxX, maxY){
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
    function connIntersectsRect(conn, nodes, nodeRect, minX, minY, maxX, maxY){
        const pts = connWorldPoints(conn, nodes, nodeRect);
        if(!pts) return false;
        const span = Math.hypot(pts.tx - pts.fx, pts.ty - pts.fy);
        const steps = Math.max(12, Math.min(96, Math.ceil(span / 18)));
        let previous = cubicPoint(pts.fx, pts.fy, pts.tx, pts.ty, pts.isHistory, 0);
        if(pointInRect(previous.x, previous.y, minX, minY, maxX, maxY)) return true;
        for(let i = 1; i <= steps; i++){
            const current = cubicPoint(pts.fx, pts.fy, pts.tx, pts.ty, pts.isHistory, i / steps);
            if(pointInRect(current.x, current.y, minX, minY, maxX, maxY)) return true;
            const segMinX = Math.min(previous.x, current.x);
            const segMaxX = Math.max(previous.x, current.x);
            const segMinY = Math.min(previous.y, current.y);
            const segMaxY = Math.max(previous.y, current.y);
            if(segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY){
                const dx = current.x - previous.x;
                const dy = current.y - previous.y;
                const edges = [
                    ['x', minX, minY, maxY], ['x', maxX, minY, maxY],
                    ['y', minY, minX, maxX], ['y', maxY, minX, maxX]
                ];
                for(const [axis, edge, low, high] of edges){
                    const delta = axis === 'x' ? dx : dy;
                    if(Math.abs(delta) < 1e-9) continue;
                    const start = axis === 'x' ? previous.x : previous.y;
                    const t = (edge - start) / delta;
                    if(t < 0 || t > 1) continue;
                    const cross = axis === 'x' ? previous.y + dy * t : previous.x + dx * t;
                    if(cross >= low && cross <= high) return true;
                }
            }
            previous = current;
        }
        return false;
    }
    function connectionsInWorldRect(rect){
        const core = global.SmartCanvasCore?.tryDeps?.() || null;
        const canvas = core?.canvas;
        const nodes = core?.nodes;
        const nodeRect = fn('nodeRect');
        if(!canvas?.connections?.length || !nodes?.length || !nodeRect || !rect) return [];
        const {minX, minY, maxX, maxY} = rect;
        const hits = [];
        canvas.connections.forEach((conn, index) => {
            if(!nodes.some(n => n.id === conn.from) || !nodes.some(n => n.id === conn.to)) return;
            if(connIntersectsRect(conn, nodes, nodeRect, minX, minY, maxX, maxY)) hits.push(index);
        });
        return hits;
    }
    function worldRectFromScreenRect(screenRect){
        const screenToWorld = fn('screenToWorld');
        if(!screenToWorld || !screenRect) return null;
        const a = screenToWorld({ clientX: screenRect.left, clientY: screenRect.top });
        const b = screenToWorld({ clientX: screenRect.right, clientY: screenRect.bottom });
        return {
            minX: Math.min(a.x, b.x),
            minY: Math.min(a.y, b.y),
            maxX: Math.max(a.x, b.x),
            maxY: Math.max(a.y, b.y)
        };
    }
    function selectConnectionsFromMarquee(screenRect, shiftKey){
        const worldRect = worldRectFromScreenRect(screenRect);
        if(!worldRect) return;
        const hits = connectionsInWorldRect(worldRect);
        if(hits.length) addIndices(hits, shiftKey);
        else if(!shiftKey) clear();
    }
    function selectConnectionsAfterMarquee(screenRect, shiftKey){
        // Node selection owns the marquee whenever it contains at least one
        // node. Connector hit testing is a fallback only for an empty-node
        // marquee, so connected nodes remain available to grouping actions.
        if(hasNodeSelection()) return false;
        selectConnectionsFromMarquee(screenRect, shiftKey);
        return true;
    }
    function onShellMouseupCapture(event){
        if(event.button !== 0) return;
        const box = document.getElementById('selectionBox');
        if(!box || box.style.display === 'none' || !box.classList.contains('is-dragging')) return;
        const rect = box.getBoundingClientRect();
        if(Math.hypot(rect.width, rect.height) < 4) return;
        const shiftKey = Boolean(event.shiftKey);
        skipNextBlankClick = true;
        setTimeout(() => {
            selectConnectionsAfterMarquee(rect, shiftKey);
            skipNextBlankClick = false;
        }, 0);
    }
    function onWorldPointerCapture(event){
        const hit = event.target?.closest?.('.conn-hit[data-conn-index]');
        const cut = event.target?.closest?.('.conn-cut[data-conn-index]');
        if((hit || cut) && !event.shiftKey && hasSettledNodeMarquee()){
            stopConnEvent(event);
            clearAllSelections();
            return;
        }
        if(hit){
            stopConnEvent(event);
            if(event.type === 'dblclick') deleteIndices([hit.dataset.connIndex]);
            else if(event.type === 'click') selectIndex(hit.dataset.connIndex, event);
            return;
        }
        if(cut && event.type === 'click'){
            stopConnEvent(event);
            deleteIndices([cut.dataset.connIndex]);
            return;
        }
        if(event.type === 'click' && event.target?.closest?.('.image-node') && !event.target?.closest?.('.conn-hit,.conn-cut,.node-port')){
            if(hasSelection()) clear();
        }
    }
    function onShellBlankClick(event){
        if(event.button !== 0) return;
        if(skipNextBlankClick) return;
        if(event.target?.closest?.('.image-node,.conn-hit,.conn-cut,.selection-box,.selection-box-capsule,.selection-capsule-bar,.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-quick-toolbar,.create-menu,.port-link-pick-menu,.smart-minimap,.canvas-bottom-chrome,.asset-panel')) return;
        clearAllSelections();
    }
    function onWorldClickBubble(event){
        if(event.target?.closest?.('.conn-hit,.conn-cut,.connection-layer')) return;
        if(hasSelection()) clear();
    }
    function onKeydown(event){
        if(fn('isEditableTarget')?.(event.target)) return;
        if(handleDeleteHotkey(event)) return;
        handleEscapeHotkey(event);
    }
    function handleDeleteHotkey(event){
        if(!hasSelection()) return false;
        if(event.key !== 'Delete' && event.key !== 'Backspace') return false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        deleteSelected();
        return true;
    }
    function handleEscapeHotkey(event){
        if(event.key !== 'Escape' || !hasSelection()) return false;
        clear();
        return true;
    }
    function observeConnectionLayer(){
        const world = document.getElementById('world');
        if(!world || world.nodeType !== 1 || typeof MutationObserver !== 'function' || typeof Node !== 'function' || !(world instanceof Node)) return;
        const obs = new MutationObserver(() => applySelectionVisuals());
        try {
            obs.observe(world, { childList: true, subtree: true });
        } catch(error){
            console.warn('[SmartCanvasConnectionSelection] observer unavailable', error);
        }
    }
    function bindShell(){
        const shell = document.getElementById('shell');
        if(!shell || shell.dataset.connSelectionShellBound === '1') return;
        shell.dataset.connSelectionShellBound = '1';
        shell.addEventListener('mouseup', onShellMouseupCapture, true);
        shell.addEventListener('click', onShellBlankClick, false);
    }
    function bindWorld(){
        const world = document.getElementById('world');
        if(!world || world.dataset.connSelectionBound === '1') return;
        world.dataset.connSelectionBound = '1';
        world.addEventListener('click', onWorldPointerCapture, true);
        world.addEventListener('dblclick', onWorldPointerCapture, true);
        world.addEventListener('click', onWorldClickBubble, false);
    }
    function resolveApis(){
        const disconnectOne = fn('disconnectConnection');
        if(!disconnectOne) return null;
        const core = global.SmartCanvasCore?.tryDeps?.() || null;
        return {
            world: document.getElementById('world'),
            refreshConnectionLayer: fn('refreshConnectionLayer'),
            disconnectConnection: disconnectOne,
            disconnectConnections: fn('disconnectConnections') || disconnectOne,
            isEditableTarget: fn('isEditableTarget'),
            focusCanvasForShortcuts: fn('focusCanvasForShortcuts'),
            hideSelectionGroupBox: core?.hideSelectionGroupBox,
            hideImageQuickToolbar: core?.hideImageQuickToolbar
        };
    }
    function registerDeps(next){ deps = next; }
    function install(){
        if(installed) return true;
        const apis = resolveApis();
        if(!apis?.disconnectConnection) return false;
        registerDeps(apis);
        bindWorld();
        bindShell();
        observeConnectionLayer();
        if(!document.documentElement.dataset.connSelectionKeyBound){
            document.documentElement.dataset.connSelectionKeyBound = '1';
            document.addEventListener('keydown', onKeydown, true);
        }
        installed = true;
        applySelectionVisuals();
        return true;
    }
    const api = Object.freeze({
        registerDeps,
        selectedClass,
        selectedEndClass,
        isSelected,
        hasSelection,
        selectedIndices,
        selectIndex,
        selectConnectionsFromMarquee,
        selectConnectionsAfterMarquee,
        deleteSelected,
        clear,
        install,
        handleDeleteHotkey,
        handleEscapeHotkey
    });
    global.SmartCanvasCore?.register?.('connectionSelection', api);
    global.SmartCanvasConnectionSelection = api;
    function boot(){
        if(install()) return;
        requestAnimationFrame(boot);
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})(window);
