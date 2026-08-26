/**
 * Smart Canvas — selection capsule shared context (deps + media helpers).
 * Delete / multi-select snapshot logic lives in selection + delete modules.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerSharedDeps(next){ deps = next; }
    function d(){ return deps; }
    function getSelectedIds(){ return d()?.getSelectedNodeIds?.() || []; }

    function readSelectionIds(){
        return d()?.getSelectedNodeIds?.() || [];
    }

    function getSelectedNodes(){
        const api = d();
        const list = api?.nodes;
        if(!Array.isArray(list)) return [];
        return getSelectedIds().map(id => list.find(node => node.id === id)).filter(Boolean);
    }
    function mediaUrl(img){
        if(!img) return '';
        if(typeof img === 'string') return img;
        return String(img.url || img.path || img.src || '').trim();
    }
    function collectMediaItems(){
        const api = d();
        const items = [];
        const seen = new Set();
        const pushItem = (img) => {
            const url = mediaUrl(img);
            if(!url || seen.has(url)) return;
            seen.add(url);
            const item = api?.imageForDisplay?.(img) || img;
            items.push({...item, url: mediaUrl(item) || url});
        };
        getSelectedNodes().forEach(node => {
            if(api?.isSmartGroupNode?.(node)){
                const refs = api.smartGroupImageRefs?.(node) || [];
                if(refs.length){ refs.forEach(ref => pushItem(ref.item || ref.source)); return; }
                (node.images || []).forEach(pushItem);
                api?.smartGroupMembers?.(node)?.forEach(member => { (member.images || []).forEach(pushItem); });
                return;
            }
            (node.images || []).forEach(pushItem);
        });
        return items;
    }
    const api = Object.freeze({
        registerSharedDeps,
        d,
        getSelectedIds,
        getSelectedNodes,
        mediaUrl,
        collectMediaItems,
        readSelectionIds
    });
    global.SmartCanvasCore?.register?.('selectionCapsuleShared', api);
    global.SmartCanvasSelectionCapsuleShared = api;
})(window);
