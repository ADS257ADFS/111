(function(global){
    'use strict';

    const SCHEMA_VERSION = 4;

    function uid(prefix){
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    }

    function defaultCameraState(){
        return {
            id: 'camera_main',
            name: '主镜头',
            position: [4, 3, 6],
            target: [0, 0.8, 0],
            fov: 45,
            near: 0.1,
            far: 1000
        };
    }

    function finiteNumber(value, fallback = 0){
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function vector(value, fallback){
        return fallback.map((item, index) => finiteNumber(value?.[index], item));
    }

    function normalizeTransform(input = {}){
        const transform = input && typeof input === 'object' ? input : {};
        const next = {
            ...transform,
            position: vector(transform.position, [0, 0, 0]),
            rotation: vector(transform.rotation, [0, 0, 0, 1]),
            scale: vector(transform.scale, [1, 1, 1]).map(value => Math.max(0.02, value)),
            pivot: vector(transform.pivot, [0, 0, 0])
        };
        if(Array.isArray(transform.bakedMatrix) && transform.bakedMatrix.length === 16){
            next.bakedMatrix = transform.bakedMatrix.map(value => finiteNumber(value, 0));
        } else {
            delete next.bakedMatrix;
        }
        return next;
    }

    function normalizeSceneObject(input = {}){
        const object = input && typeof input === 'object' ? input : {};
        return {
            ...object,
            id: String(object.id || uid('obj')),
            name: String(object.name || '对象').slice(0, 120),
            parentId: String(object.parentId || ''),
            childrenIds: Array.isArray(object.childrenIds) ? object.childrenIds.map(id => String(id || '')).filter(Boolean) : [],
            visible: object.visible !== false,
            locked: Boolean(object.locked),
            transform: normalizeTransform(object.transform),
            materialIds: Array.isArray(object.materialIds) ? object.materialIds.map(id => String(id || '')).filter(Boolean) : [],
            components: {...(object.components || {})},
            metadata: {...(object.metadata || {})},
            extensions: {...(object.extensions || {})}
        };
    }

    function normalizeCameraState(input = {}, fallback = defaultCameraState()){
        const camera = input && typeof input === 'object' ? input : {};
        return {
            ...fallback,
            ...camera,
            position: vector(camera.position, fallback.position),
            target: vector(camera.target, fallback.target),
            fov: Math.max(1, finiteNumber(camera.fov, fallback.fov)),
            near: Math.max(0.001, finiteNumber(camera.near, fallback.near)),
            far: Math.max(1, finiteNumber(camera.far, fallback.far))
        };
    }

    function defaultScene(){
        return {
            id: 'scene_main',
            name: '导演台场景',
            units: 'meters',
            objects: [],
            materials: {
                mat_default: {
                    id: 'mat_default',
                    name: '默认材质',
                    type: 'standard',
                    color: '#8fb8ff',
                    roughness: 0.55,
                    metalness: 0
                }
            },
            cameras: {
                camera_main: defaultCameraState()
            },
            activeCameraId: 'camera_main',
            environment: {
                background: '#20242c',
                grid: true
            },
            timeline: {
                currentFrame: 0,
                frameRate: 24,
                durationFrames: 120,
                startFrame: 0,
                endFrame: 120,
                isPlaying: false,
                loopPlayback: true,
                autoKeyframe: false,
                objectTracks: {},
                cameraTracks: {},
                shotCuts: [],
                selection: {trackType:'', trackId:'', frame:-1}
            },
            metadata: {},
            extensions: {}
        };
    }

    function defaultShot(){
        return {
            id: 'shot_main',
            name: '主机位',
            aspectRatio: {
                key: '16:9',
                label: '16:9',
                width: 16,
                height: 9,
                value: 16 / 9,
                orientation: 'landscape'
            },
            cameraState: defaultCameraState(),
            target: [0, 0.8, 0],
            fov: 45,
            durationFrames: 120,
            keyframes: [],
            metadata: {}
        };
    }

    function normalizeScene(input = {}, base = defaultScene()){
        const source = input && typeof input === 'object' ? input : {};
        return {
            ...base,
            ...source,
            objects: Array.isArray(source.objects) ? source.objects.map(normalizeSceneObject) : [],
            materials: {...base.materials, ...(source.materials || {})},
            cameras: {...base.cameras, ...(source.cameras || {})},
            environment: {...base.environment, ...(source.environment || {})},
            timeline: normalizeTimeline(source.timeline, base.timeline),
            metadata: {...base.metadata, ...(source.metadata || {})},
            extensions: {...base.extensions, ...(source.extensions || {})}
        };
    }

    function normalizeFrame(value, fallback, durationFrames){
        return Math.max(0, Math.min(durationFrames, Math.round(finiteNumber(value, fallback))));
    }

    function normalizeTimelineSelection(input, durationFrames){
        const selection = input && typeof input === 'object' ? input : {};
        const trackType = ['object', 'camera', 'cut'].includes(selection.trackType) ? selection.trackType : '';
        const trackId = String(selection.trackId || '');
        const frame = normalizeFrame(selection.frame, -1, durationFrames);
        if(!trackType || !trackId || Number(selection.frame) < 0) return {trackType:'', trackId:'', frame:-1};
        return {trackType, trackId, frame};
    }

    function normalizeKeyframeInterpolation(value){
        return ['linear', 'smooth', 'hold'].includes(value) ? value : 'linear';
    }

    function normalizeObjectKeyframes(input, durationFrames){
        const frames = Array.isArray(input) ? input : [];
        const keyed = new Map();
        frames.forEach(frame => {
            if(!frame || typeof frame !== 'object') return;
            const index = normalizeFrame(frame.frame, 0, durationFrames);
            keyed.set(index, {
                frame:index,
                transform:normalizeTransform(frame.transform),
                interpolation:normalizeKeyframeInterpolation(frame.interpolation)
            });
        });
        return Array.from(keyed.values()).sort((a, b) => a.frame - b.frame);
    }

    function normalizeCameraKeyframes(input, durationFrames){
        const frames = Array.isArray(input) ? input : [];
        const keyed = new Map();
        frames.forEach(frame => {
            if(!frame || typeof frame !== 'object') return;
            const index = normalizeFrame(frame.frame, 0, durationFrames);
            keyed.set(index, {
                frame:index,
                cameraState:normalizeCameraState(frame.cameraState),
                interpolation:normalizeKeyframeInterpolation(frame.interpolation)
            });
        });
        return Array.from(keyed.values()).sort((a, b) => a.frame - b.frame);
    }

    function normalizeShotCuts(input, durationFrames){
        const cuts = Array.isArray(input) ? input : [];
        const keyed = new Map();
        cuts.forEach(cut => {
            if(!cut || typeof cut !== 'object') return;
            const shotId = String(cut.shotId || '');
            if(!shotId) return;
            keyed.set(normalizeFrame(cut.frame, 0, durationFrames), {
                frame:normalizeFrame(cut.frame, 0, durationFrames),
                shotId
            });
        });
        return Array.from(keyed.values()).sort((a, b) => a.frame - b.frame);
    }

    function normalizeTrackMap(input, normalizer, durationFrames){
        const tracks = input && typeof input === 'object' ? input : {};
        return Object.entries(tracks).reduce((next, [id, frames]) => {
            const stableId = String(id || '');
            if(stableId) next[stableId] = normalizer(frames, durationFrames);
            return next;
        }, {});
    }

    function normalizeTimeline(input = {}, base = {}){
        const timeline = input && typeof input === 'object' ? input : {};
        const durationFrames = Math.max(1, Math.round(finiteNumber(timeline.durationFrames, base.durationFrames || 120)));
        const startFrame = normalizeFrame(timeline.startFrame, base.startFrame || 0, durationFrames);
        const endFrame = Math.max(startFrame, normalizeFrame(timeline.endFrame, base.endFrame ?? durationFrames, durationFrames));
        return {
            ...base,
            ...timeline,
            currentFrame: Math.max(startFrame, Math.min(endFrame, normalizeFrame(timeline.currentFrame, base.currentFrame || startFrame, durationFrames))),
            frameRate: Math.max(1, Math.round(finiteNumber(timeline.frameRate, base.frameRate || 24))),
            durationFrames,
            startFrame,
            endFrame,
            isPlaying: Boolean(timeline.isPlaying),
            loopPlayback: timeline.loopPlayback !== false,
            autoKeyframe: Boolean(timeline.autoKeyframe),
            objectTracks: normalizeTrackMap(timeline.objectTracks, normalizeObjectKeyframes, durationFrames),
            cameraTracks: normalizeTrackMap(timeline.cameraTracks, normalizeCameraKeyframes, durationFrames),
            shotCuts: normalizeShotCuts(timeline.shotCuts, durationFrames),
            selection: normalizeTimelineSelection(timeline.selection, durationFrames)
        };
    }

    function defaultDirector3DState(){
        return {
            schemaVersion: SCHEMA_VERSION,
            id: uid('director3d'),
            scene: defaultScene(),
            camera: defaultCameraState(),
            projectAspectRatio: defaultShot().aspectRatio,
            cameraShots: [],
            currentShotId: '',
            viewMode: 'panorama',
            selection: {
                objectIds: [],
                lastObjectId: ''
            },
            tool: {
                activeTool: 'select',
                settings: {}
            },
            ui: {
                leftPanel: 'outliner',
                rightPanel: 'inspector'
            },
            assets: [],
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'isolated-director'
            },
            extensions: {}
        };
    }

    function migrateDirector3DState(input){
        if(!input || typeof input !== 'object') return defaultDirector3DState();
        const base = defaultDirector3DState();
        const state = {
            ...base,
            ...input,
            schemaVersion: SCHEMA_VERSION,
            scene: normalizeScene(input.scene, base.scene),
            camera: normalizeCameraState(input.camera, base.camera),
            projectAspectRatio: input.projectAspectRatio || base.projectAspectRatio,
            cameraShots: Array.isArray(input.cameraShots) ? input.cameraShots : [],
            currentShotId: input.currentShotId || '',
            viewMode: input.viewMode || base.viewMode,
            selection: {...base.selection, ...(input.selection || {})},
            tool: {...base.tool, ...(input.tool || {})},
            ui: {...base.ui, ...(input.ui || {})},
            metadata: {...base.metadata, ...(input.metadata || {})},
            extensions: {...base.extensions, ...(input.extensions || {})}
        };
        if(!Array.isArray(state.assets)) state.assets = [];
        if(!Array.isArray(state.cameraShots)) state.cameraShots = [];
        if(!state.cameraShots.some(shot => shot && shot.id === state.currentShotId)){
            state.currentShotId = state.cameraShots[0]?.id || '';
        }
        if(!['panorama', 'shot', 'quad', 'front', 'side', 'top'].includes(state.viewMode)) state.viewMode = 'panorama';
        state.metadata.updatedAt = Number(state.metadata.updatedAt || Date.now());
        return state;
    }

    global.Director3DSchema = Object.freeze({
        SCHEMA_VERSION,
        defaultDirector3DState,
        migrateDirector3DState,
        normalizeSceneObject,
        normalizeTransform,
        normalizeTimeline
    });
})(window);

