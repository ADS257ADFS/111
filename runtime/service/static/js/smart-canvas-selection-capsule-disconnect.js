/**
 * Smart Canvas — remove every connection touching the current multi-selection.
 * Links whose two endpoints are both outside the selection are preserved.
 */
(function(global){
    'use strict';

    const shared = () => global.SmartCanvasSelectionCapsuleShared;

    function selectedIds(){
        const api = shared()?.d?.();
        const ids = new Set((shared()?.readSelectionIds?.() || []).filter(Boolean));
        if(api?.selectedId) ids.add(api.selectedId);
        return [...ids];
    }

    function connectionEndpointIdsForSelection(ids){
        const api = shared()?.d?.();
        const endpoints = new Set((ids || []).filter(Boolean));
        const nodeList = Array.isArray(api?.nodes) ? api.nodes : [];
        const pending = [...endpoints];
        for(let cursor = 0; cursor < pending.length; cursor += 1){
            const id = pending[cursor];
            const node = nodeList.find(item => item.id === id);
            if(!node || !api?.isSmartGroupNode?.(node)) continue;
            const memberIds = [
                ...(Array.isArray(node.items) ? node.items : []),
                ...(api.smartGroupMembers?.(node) || []).map(member => member?.id)
            ].filter(Boolean);
            memberIds.forEach(memberId => {
                if(endpoints.has(memberId)) return;
                endpoints.add(memberId);
                pending.push(memberId);
            });
        }
        return [...endpoints];
    }

    function connectionIndicesForSelection(connections, ids){
        const selected = new Set((ids || []).filter(Boolean));
        if(!selected.size) return [];
        const indices = [];
        (connections || []).forEach((connection, index) => {
            if(selected.has(connection?.from) || selected.has(connection?.to)) indices.push(index);
        });
        return indices;
    }

    function matchingConnectionIndices(){
        const api = shared()?.d?.();
        const endpointIds = connectionEndpointIdsForSelection(selectedIds());
        return connectionIndicesForSelection(api?.canvas?.connections || [], endpointIds);
    }

    function connectionDomElementsForIndices(indices){
        const world = document.getElementById('world');
        if(!world?.querySelectorAll) return [];
        const elements = new Set();
        (indices || []).forEach(rawIndex => {
            const index = Number(rawIndex);
            if(!Number.isInteger(index) || index < 0) return;
            world.querySelectorAll(`.conn-hit[data-conn-index="${index}"]`).forEach(hit => {
                const line = hit.previousElementSibling;
                const end = hit.nextElementSibling;
                const cut = end?.nextElementSibling;
                [line, hit, end, cut].forEach(element => {
                    if(element) elements.add(element);
                });
            });
            world.querySelectorAll(`.conn-cut[data-conn-index="${index}"]`).forEach(cut => elements.add(cut));
        });
        return [...elements];
    }

    function removeConnectionDomForIndices(indices){
        const elements = connectionDomElementsForIndices(indices);
        elements.forEach(element => element.remove?.());
        return elements.length;
    }

    function handleDisconnectAction(resync){
        const api = shared()?.d?.();
        if(!api) return false;
        const indices = matchingConnectionIndices();
        if(!indices.length){
            api.toast?.('所选对象没有可消除的连线');
            return false;
        }
        removeConnectionDomForIndices(indices);
        global.SmartCanvasConnectionSelection?.clear?.({skipRefresh:true});
        api.disconnectConnections?.(indices);
        api.refreshConnectionLayer?.();
        resync?.();
        return true;
    }

    function syncDisconnectButton(){
        const button = document.getElementById('selectionCapsuleDisconnectBtn');
        if(!button) return;
        button.classList.toggle('is-muted', matchingConnectionIndices().length <= 0);
    }

    const api = Object.freeze({
        connectionEndpointIdsForSelection,
        connectionIndicesForSelection,
        connectionDomElementsForIndices,
        removeConnectionDomForIndices,
        matchingConnectionIndices,
        handleDisconnectAction,
        syncDisconnectButton
    });

    global.SmartCanvasCore?.register?.('selectionCapsuleDisconnect', api);
    global.SmartCanvasSelectionCapsuleDisconnect = api;
})(window);
