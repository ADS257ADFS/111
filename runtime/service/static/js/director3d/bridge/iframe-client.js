(function(global){
    'use strict';

    const MESSAGE_PREFIX = 'director3d:';
    let nodeId = '';
    let ready = false;
    let saveTimer = 0;

    function sameOrigin(){
        return global.location?.origin || '';
    }

    function acceptsMessage(event){
        const origin = sameOrigin();
        return (!origin || event?.origin === origin) && (!global.parent || event?.source === global.parent);
    }

    function isDirector3DMessage(message){
        return Boolean(message && typeof message.type === 'string' && message.type.startsWith(MESSAGE_PREFIX));
    }

    function post(type, payload){
        if(!type || !type.startsWith(MESSAGE_PREFIX)) throw new Error('Director3D message type must use director3d: prefix');
        global.parent?.postMessage?.({type, nodeId, payload: payload || {}}, sameOrigin() || '*');
    }

    function scheduleAutoSave(store){
        if(!ready || !nodeId || !store?.getState) return;
        if(saveTimer) global.clearTimeout?.(saveTimer);
        saveTimer = global.setTimeout?.(() => saveState(store), 180) || 0;
    }

    function init(store, render){
        if(store?.subscribe) store.subscribe(() => scheduleAutoSave(store));
        global.addEventListener('message', event => {
            if(!acceptsMessage(event)) return;
            const message = event.data;
            if(!isDirector3DMessage(message)) return;
            if(message.type === 'director3d:init'){
                nodeId = String(message.nodeId || message.payload?.nodeId || '');
                store.replaceState(message.state || message.payload?.state || null);
                ready = true;
                render?.(store.getState());
                post('director3d:ready', {schemaVersion: global.Director3DSchema.SCHEMA_VERSION});
            }
        });

        global.requestAnimationFrame(() => {
            if(!ready){
                ready = true;
                render?.(store.getState());
            }
        });
    }

    function saveState(store){
        post('director3d:save-state', {state: store.getState()});
    }

    function currentShotFromState(state){
        const shots = Array.isArray(state.cameraShots) ? state.cameraShots : [];
        return shots.find(shot => shot && shot.id === state.currentShotId) || shots[0] || null;
    }

    function imagePayloadFromState(store, imageData, extension){
        const state = store.getState();
        const shot = currentShotFromState(state);
        const ratio = global.Director3DAspectRatio?.parse?.(shot?.aspectRatio || '16:9') || {key:'16:9', label:'16:9', value:16 / 9};
        return {
            name: `${shot?.name || 'director-shot'}-${ratio.key}.${extension || 'png'}`,
            imageData,
            cameraState: shot?.cameraState || state.camera,
            shotId: shot?.id || '',
            aspectRatio: ratio,
            viewMode: state.viewMode || 'panorama',
            sceneVersion: state.metadata.updatedAt
        };
    }

    function exportRenderedImage(store, imageData){
        if(!imageData) return exportPlaceholderImage(store);
        post('director3d:export-image', imagePayloadFromState(store, imageData, 'png'));
    }

    function exportPlaceholderImage(store){
        const state = store.getState();
        const shot = currentShotFromState(state);
        const ratio = global.Director3DAspectRatio?.parse?.(shot?.aspectRatio || '16:9') || {key:'16:9', label:'16:9', value:16 / 9};
        const height = 720;
        const width = Math.max(1, Math.round(height * ratio.value));
        const centerX = Math.round(width / 2);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#20242c"/><rect x="24" y="24" width="${Math.max(1, width - 48)}" height="${height - 48}" fill="none" stroke="#8fb8ff" stroke-width="3"/><text x="${centerX}" y="330" text-anchor="middle" font-family="Arial" font-size="36" fill="#ffffff">${shot?.name || '当前机位'}</text><text x="${centerX}" y="386" text-anchor="middle" font-family="Arial" font-size="22" fill="#9fb3c8">${ratio.label} camera export placeholder</text></svg>`;
        const imageData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        post('director3d:export-image', imagePayloadFromState(store, imageData, 'svg'));
    }

    global.Director3DIframeClient = Object.freeze({
        init,
        saveState,
        scheduleAutoSave,
        exportRenderedImage,
        exportPlaceholderImage,
        isDirector3DMessage,
        acceptsMessage
    });
})(window);

