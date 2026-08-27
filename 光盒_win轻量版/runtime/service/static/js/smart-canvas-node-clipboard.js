/**
 * Smart Canvas — copy/paste/alt-drag duplicate for nodes.
 * Copy writes to the OS clipboard; paste reads OS clipboard first (files / workflow JSON).
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasNodeClipboard] deps not registered');
        return c;
    }

    const CLIPBOARD_FORMAT = 'infinite-smart-canvas-workflow';

    function buildClipboardPayload(copiedNodes, copiedConnections){
        return {
            format: CLIPBOARD_FORMAT,
            version: 1,
            canvas_type: 'smart',
            exported_at: Date.now(),
            nodes: copiedNodes.map(n => S().serializableSmartNode(n)),
            connections: copiedConnections
        };
    }

    function parseWorkflowClipboardText(text){
        const raw = String(text || '').trim();
        if(!raw || raw[0] !== '{') return null;
        try {
            const data = JSON.parse(raw);
            if(data?.format === CLIPBOARD_FORMAT && Array.isArray(data.nodes) && data.nodes.length) return data;
        } catch {}
        return null;
    }

    function primaryMediaForCopy(nodes){
        for(const node of nodes){
            for(const img of (node.images || [])){
                const url = String(img?.url || img?.path || img?.src || '').trim();
                if(!url) continue;
                const kind = S().mediaKindForItem?.(img) || 'image';
                if(kind === 'image' || kind === 'video' || kind === 'audio'){
                    return { url, kind, name: String(img?.name || node?.title || 'media').trim() || 'media' };
                }
            }
        }
        return null;
    }

    async function fetchMediaBlob(url){
        const u = String(url || '').trim();
        if(!u) return null;
        try {
            const res = await fetch(u, { credentials: 'same-origin' });
            if(!res.ok) return null;
            return await res.blob();
        } catch {
            return null;
        }
    }

    async function writeSystemClipboard(payload, copiedNodes){
        if(!global.navigator?.clipboard) return false;
        const json = JSON.stringify(payload);
        const media = primaryMediaForCopy(copiedNodes);
        try {
            if(media && global.navigator.clipboard.write && global.ClipboardItem){
                const blob = await fetchMediaBlob(media.url);
                if(blob){
                    const mime = blob.type || (media.kind === 'image' ? 'image/png' : 'application/octet-stream');
                    const clipPayload = {
                        'text/plain': new Blob([json], { type: 'text/plain' })
                    };
                    if(mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')){
                        clipPayload[mime] = blob;
                    }
                    await global.navigator.clipboard.write([new global.ClipboardItem(clipPayload)]);
                    return true;
                }
            }
            if(global.navigator.clipboard.writeText){
                await global.navigator.clipboard.writeText(json);
                return true;
            }
        } catch (err) {
            console.warn('[SmartCanvasNodeClipboard] write failed', err);
            try {
                if(global.navigator.clipboard.writeText){
                    await global.navigator.clipboard.writeText(json);
                    return true;
                }
            } catch {}
        }
        return false;
    }

    async function readSystemClipboardPayload(){
        if(!global.navigator?.clipboard) return null;
        try {
            if(global.navigator.clipboard.read){
                const items = await global.navigator.clipboard.read();
                for(const item of items){
                    if(item.types.includes('text/plain')){
                        const text = await (await item.getType('text/plain')).text();
                        const payload = parseWorkflowClipboardText(text);
                        if(payload) return payload;
                    }
                }
            }
            if(global.navigator.clipboard.readText){
                return parseWorkflowClipboardText(await global.navigator.clipboard.readText());
            }
        } catch (err) {
            console.warn('[SmartCanvasNodeClipboard] read failed', err);
        }
        return null;
    }

    function copySelectedNodes(nodeIds){
        if(!S().canvas) return false;
        const ids = Array.isArray(nodeIds) && nodeIds.length ? nodeIds : S().selectedNodeIds();
        const copiedNodes = ids.map(id => S().nodes.find(n => n.id === id)).filter(Boolean);
        if(!copiedNodes.length) return false;
        const idSet = new Set(copiedNodes.map(n => n.id));
        const copiedConnections = (S().canvas.connections || []).filter(c => idSet.has(c.from) && idSet.has(c.to));
        S().nodeClipboard = {
            nodes: JSON.parse(JSON.stringify(copiedNodes)),
            connections: JSON.parse(JSON.stringify(copiedConnections))
        };
        const payload = buildClipboardPayload(copiedNodes, S().nodeClipboard.connections);
        writeSystemClipboard(payload, copiedNodes).catch(() => {});
        S().toast(`Copied ${copiedNodes.length} nodes`);
        return true;
    }

    function pasteNodesPayload(data){
        if(!S().canvas || !data?.nodes?.length) return false;
        S().lastNodePasteAt = Date.now();
        S().pushUndo();
        const sourceNodes = data.nodes;
        const xs = sourceNodes.map(n => Number(n.x) || 0);
        const ys = sourceNodes.map(n => Number(n.y) || 0);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const p = S().lastMouseWorld || S().viewportCenter();
        const dx = p.x - cx;
        const dy = p.y - cy;
        const idMap = new Map();
        const copies = sourceNodes.map(n => {
            const copy = S().cloneSmartNode(n, dx, dy);
            idMap.set(n.id, copy.id);
            return copy;
        });
        copies.forEach(copy => {
            if(Array.isArray(copy.inputNodeIds)){
                copy.inputNodeIds = copy.inputNodeIds.map(id => idMap.get(id)).filter(Boolean);
            }
            if(copy.sourceNodeId) copy.sourceNodeId = idMap.get(copy.sourceNodeId) || '';
        });
        const newConnections = (data.connections || []).map(conn => ({
            ...conn,
            from: idMap.get(conn.from),
            to: idMap.get(conn.to)
        })).filter(conn => conn.from && conn.to && conn.from !== conn.to);
        S().canvas.connections = [...(S().canvas.connections || []), ...newConnections];
        S().nodes.push(...copies);
        S().selectedId = copies.length === 1 ? copies[0].id : '';
        S().selectedIds = copies.length > 1 ? copies.map(n => n.id) : [];
        S().selectedImage = { nodeId: '', index: -1 };
        S().render();
        S().scheduleSave();
        return true;
    }

    function pasteNodes(){
        return pasteNodesPayload(S().nodeClipboard);
    }

    function pasteWorkflowFromText(text){
        const payload = parseWorkflowClipboardText(text);
        if(!payload) return false;
        return pasteNodesPayload({
            nodes: payload.nodes.map(n => JSON.parse(JSON.stringify(n))),
            connections: JSON.parse(JSON.stringify(payload.connections || []))
        });
    }

    async function pasteFromClipboard(){
        if(!S().canvas) return false;
        const osPayload = await readSystemClipboardPayload();
        if(osPayload){
            return pasteNodesPayload({
                nodes: osPayload.nodes.map(n => JSON.parse(JSON.stringify(n))),
                connections: JSON.parse(JSON.stringify(osPayload.connections || []))
            });
        }
        return pasteNodes();
    }

    function duplicateForAltDrag(node){
        const ids = (S().isNodeSelected(node.id) ? S().selectedNodeIds() : [node.id]);
        const sourceNodes = ids.map(id => S().nodes.find(n => n.id === id)).filter(Boolean);
        if(!sourceNodes.length) return node;
        S().pushUndo();
        const idMap = new Map();
        const copies = sourceNodes.map(n => {
            const copy = S().cloneSmartNode(n, 0, 0);
            idMap.set(n.id, copy.id);
            return copy;
        });
        copies.forEach(copy => {
            if(Array.isArray(copy.inputNodeIds)) copy.inputNodeIds = copy.inputNodeIds.map(id => idMap.get(id)).filter(Boolean);
            if(copy.sourceNodeId) copy.sourceNodeId = idMap.get(copy.sourceNodeId) || '';
        });
        const idSet = new Set(sourceNodes.map(n => n.id));
        const copiedConnections = (S().canvas.connections || []).filter(c => idSet.has(c.from) && idSet.has(c.to));
        const newConnections = copiedConnections.map(conn => ({ ...conn, from: idMap.get(conn.from), to: idMap.get(conn.to) })).filter(conn => conn.from && conn.to && conn.from !== conn.to);
        S().canvas.connections = [...(S().canvas.connections || []), ...newConnections];
        S().nodes.push(...copies);
        S().selectedId = '';
        S().selectedIds = [];
        S().selectedImage = { nodeId: '', index: -1 };
        const dragCopy = copies.find(c => c.id === idMap.get(node.id)) || copies[0];
        S().render();
        S().scheduleSave();
        return dragCopy;
    }

    const api = Object.freeze({
        registerDeps,
        copySelectedNodes,
        pasteNodes,
        pasteFromClipboard,
        pasteWorkflowFromText,
        parseWorkflowClipboardText,
        duplicateForAltDrag
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('nodeClipboard', api);
    global.SmartCanvasNodeClipboard = api;
})(window);
