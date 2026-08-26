(function(global){
    'use strict';

    let appContext = null;
    let renderedPanelSignature = '';

    function uid(prefix){
        return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    }

    function objectById(context, objectId){
        return context.store.getState().scene?.objects?.find(item => item?.id === objectId) || null;
    }

    function commitTransformField(context, field){
        const objectId = field.dataset.director3dTransformObjectId;
        const kind = field.dataset.director3dTransformKind;
        const axis = field.dataset.director3dTransformAxis;
        const object = objectById(context, objectId);
        const rotationDegrees = kind === 'rotation' && field.dataset.director3dTransformFormat === 'degrees';
        const axes = rotationDegrees ? ['x', 'y', 'z'] : (kind === 'rotation' ? ['x', 'y', 'z', 'w'] : ['x', 'y', 'z']);
        const index = axes.indexOf(axis);
        const value = Number(field.value);
        if(!object || object.locked || index < 0 || !Number.isFinite(value)){
            const current = object?.transform?.[kind]?.[index];
            if(Number.isFinite(Number(current))) field.value = String(current);
            return;
        }
        const fallback = kind === 'scale' ? [1, 1, 1] : (kind === 'rotation' ? [0, 0, 0, 1] : [0, 0, 0]);
        const transformMath = global.Director3DTransformFieldMath;
        const source = rotationDegrees
            ? transformMath?.eulerDegreesFromQuaternion(object.transform?.rotation || fallback) || [0, 0, 0]
            : object.transform?.[kind] || fallback;
        const next = axes.map((_, componentIndex) => Number(source[componentIndex] ?? fallback[componentIndex]));
        next[index] = value;
        if(kind === 'position') context.sceneActions.setObjectPosition(object.id, next);
        else if(kind === 'rotation') context.sceneActions.setObjectRotation(object.id, rotationDegrees ? transformMath?.quaternionFromEulerDegrees(next) || fallback : next);
        else if(kind === 'scale') context.sceneActions.setObjectScale(object.id, next);
    }

    function panelSignature(state){
        return JSON.stringify({
            objects:(state.scene?.objects || []).map(object => ({id:object.id, name:object.name, visible:object.visible, locked:object.locked, color:object.metadata?.color || object.material?.color || '', transform:object.transform || {}})),
            outliner:state.scene?.extensions?.outliner || {},
            selection:state.selection,
            cameraShots:(state.cameraShots || []).map(shot => ({id:shot.id, name:shot.name, locked:shot.locked, aspectRatio:shot.aspectRatio})),
            currentShotId:state.currentShotId,
            viewMode:state.viewMode,
            projectAspectRatio:state.projectAspectRatio
        });
    }

    function renderState(state){
        const signature = panelSignature(state);
        if(signature !== renderedPanelSignature){
            const Panels = global.Director3DUIPanels;
            Panels.renderModelLibrary(document.getElementById('director3dMannequinPanel'), global.Director3DPrimitiveCatalog);
            Panels.renderShotPanel(document.getElementById('director3dShotPanel'), state, appContext?.shotStore, global.Director3DAspectRatio);
            Panels.renderObjectPanel(document.getElementById('director3dObjectPanel'), state, appContext?.outlinerStore);
            renderedPanelSignature = signature;
        }
        appContext?.timelineUI?.render(state);
    }

    function addModel(context, modelId){
        const catalog = global.Director3DPrimitiveCatalog;
        const objects = context.store.getState().scene?.objects || [];
        const object = catalog?.createObject?.(modelId, {id:uid('obj'), index:objects.length + 1});
        if(object) context.sceneActions.addObject(object);
    }

    function addShot(context){
        const nextIndex = context.shotStore.list().length + 1;
        const cameraState = context.viewport?.currentCameraState?.();
        const viewMode = context.store.getState().viewMode;
        const shot = context.shotStore.addShot({
            name: `机位 ${nextIndex}`,
            cameraState,
            target: cameraState?.target
        });
        if(['front', 'side', 'top'].includes(viewMode)) context.shotStore.selectShot(shot.id);
        else context.shotStore.setCurrentShot(shot.id);
    }

    function bindActions(context){
        document.addEventListener('click', event => {
            const actionButton = event.target.closest?.('[data-director3d-action]');
            if(!actionButton) return;
            event.preventDefault();
            event.stopPropagation();
            if(actionButton.dataset.director3dAction !== 'export-image') return;
            context.bridge.exportRenderedImage(context.store, context.viewport?.exportImage?.());
        });

        document.getElementById('director3dMannequinPanel')?.addEventListener('click', event => {
            const button = event.target.closest('[data-director3d-model]');
            if(button) addModel(context, button.dataset.director3dModel);
        });

        document.getElementById('director3dShotPanel')?.addEventListener('click', event => {
            const lock = event.target.closest('[data-director3d-lock-shot]');
            if(lock){
                event.preventDefault();
                event.stopPropagation();
                context.timelineUI.clearPreview?.();
                context.shotStore.toggleShotLocked(lock.dataset.director3dLockShot);
                return;
            }
            const remove = event.target.closest('[data-director3d-delete-shot]');
            if(remove){
                event.preventDefault();
                event.stopPropagation();
                context.timelineUI.clearPreview?.();
                context.shotStore.removeShot(remove.dataset.director3dDeleteShot);
                return;
            }
            const shot = event.target.closest('[data-director3d-shot-id]');
            if(shot){
                context.timelineUI.clearPreview?.();
                context.shotStore.setCurrentShot(shot.dataset.director3dShotId);
                return;
            }
            const ratio = event.target.closest('[data-director3d-shot-ratio]');
            if(ratio){
                context.timelineUI.clearPreview?.();
                context.shotStore.setAspectRatio(ratio.dataset.director3dShotRatio);
                return;
            }
            if(event.target.closest('[data-director3d-add-shot]')){
                context.timelineUI.clearPreview?.();
                addShot(context);
            }
        });

        const objectPanel = document.getElementById('director3dObjectPanel');
        objectPanel?.addEventListener('click', event => {
            if(event.target.closest('[data-director3d-add-group]')){
                context.outlinerStore.createGroup();
                return;
            }
            const toggleGroup = event.target.closest('[data-director3d-toggle-group]');
            if(toggleGroup){
                context.outlinerStore.toggleCollapsed(toggleGroup.dataset.director3dToggleGroup);
                return;
            }
            const renameGroup = event.target.closest('[data-director3d-rename-group]');
            if(renameGroup){
                event.preventDefault();
                event.stopPropagation();
                const group = context.outlinerStore.groups().find(item => item.id === renameGroup.dataset.director3dRenameGroup);
                const nextName = group ? global.prompt?.('重命名分组', group.name) : null;
                if(nextName !== null && nextName !== undefined) context.outlinerStore.renameGroup(group.id, nextName);
                return;
            }
            const moveGroup = event.target.closest('[data-director3d-move-group]');
            if(moveGroup){
                event.preventDefault();
                event.stopPropagation();
                context.outlinerStore.moveGroup(moveGroup.dataset.director3dMoveGroup, Number(moveGroup.dataset.director3dGroupTargetIndex));
                return;
            }
            const deleteGroup = event.target.closest('[data-director3d-delete-group]');
            if(deleteGroup){
                event.preventDefault();
                event.stopPropagation();
                context.outlinerStore.removeGroup(deleteGroup.dataset.director3dDeleteGroup);
                return;
            }
            const duplicate = event.target.closest('[data-director3d-duplicate-object]');
            if(duplicate){
                event.preventDefault();
                event.stopPropagation();
                const object = objectById(context, duplicate.dataset.director3dDuplicateObject);
                if(object) context.sceneActions.duplicateObject(object.id, {id:uid('obj'), name:`${object.name || object.id} copy`});
                return;
            }
            const resetTransform = event.target.closest('[data-director3d-reset-object-transform]');
            if(resetTransform){
                event.preventDefault();
                event.stopPropagation();
                context.sceneActions.resetObjectTransform(resetTransform.dataset.director3dResetObjectTransform);
                return;
            }
            const remove = event.target.closest('[data-director3d-delete-object]');
            if(remove){
                event.preventDefault();
                event.stopPropagation();
                context.outlinerStore.removeObject(remove.dataset.director3dDeleteObject);
                context.sceneActions.removeObject(remove.dataset.director3dDeleteObject);
                return;
            }
            const visible = event.target.closest('[data-director3d-toggle-object-visible]');
            if(visible){
                event.preventDefault();
                event.stopPropagation();
                const object = objectById(context, visible.dataset.director3dToggleObjectVisible);
                if(object) context.sceneActions.setObjectVisible(object.id, object.visible === false);
                return;
            }
            const lock = event.target.closest('[data-director3d-toggle-object-lock]');
            if(lock){
                event.preventDefault();
                event.stopPropagation();
                const object = objectById(context, lock.dataset.director3dToggleObjectLock);
                if(object) context.sceneActions.setObjectLocked(object.id, !object.locked);
                return;
            }
            const color = event.target.closest('[data-director3d-object-color]');
            if(color){
                event.preventDefault();
                event.stopPropagation();
                context.sceneActions.setObjectColor(color.dataset.director3dObjectId, color.dataset.director3dObjectColor);
                return;
            }
            const row = event.target.closest('[data-director3d-select-object], [data-director3d-object-id]');
            if(row) context.sceneActions.selectObject(row.dataset.director3dSelectObject || row.dataset.director3dObjectId);
        });

        objectPanel?.addEventListener('change', event => {
            const field = event.target.closest?.('[data-director3d-transform-kind]');
            if(field) commitTransformField(context, field);
        });
        objectPanel?.addEventListener('keydown', event => {
            if(event.key !== 'Enter') return;
            const field = event.target.closest?.('[data-director3d-transform-kind]');
            if(!field) return;
            event.preventDefault();
            field.blur();
        });

        let draggingObjectId = '';
        objectPanel?.addEventListener('dragstart', event => {
            const row = event.target.closest('[data-director3d-object-id]');
            if(!row) return;
            draggingObjectId = row.dataset.director3dObjectId || '';
            event.dataTransfer?.setData?.('text/plain', draggingObjectId);
            if(event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        });
        objectPanel?.addEventListener('dragend', () => { draggingObjectId = ''; });
        objectPanel?.addEventListener('dragover', event => {
            const group = event.target.closest('[data-director3d-group-drop-id]');
            if(!group || !draggingObjectId) return;
            event.preventDefault();
            if(event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        });
        objectPanel?.addEventListener('drop', event => {
            const group = event.target.closest('[data-director3d-group-drop-id]');
            if(!group || !draggingObjectId) return;
            event.preventDefault();
            context.outlinerStore.moveObjectToGroup(draggingObjectId, group.dataset.director3dGroupDropId || '');
            draggingObjectId = '';
        });
    }

    function ensureViewportExportButton(){
        const viewport = document.getElementById('director3dViewport');
        if(!viewport || viewport.querySelector('[data-director3d-action="export-image"]')) return;
        const button = document.createElement('button');
        button.className = 'director3d-send-shot-button';
        button.type = 'button';
        button.dataset.director3dAction = 'export-image';
        button.title = '发送当前机位到画布';
        button.setAttribute('aria-label', '发送当前机位到画布');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12"></path><path d="M13 6l6 6-6 6"></path><path d="M5 5h4"></path><path d="M5 19h4"></path></svg>';
        viewport.appendChild(button);
    }

    function boot(){
        const store = global.Director3DStore.createStore(null);
        const history = global.Director3DHistory.createHistory();
        const commandBus = global.Director3DCommandBus.createCommandBus({store, history});
        const sceneActions = global.Director3DSceneActions.createSceneActions({store});
        const outlinerStore = global.Director3DOutlinerStore.createOutlinerStore({store});
        const shotStore = global.Director3DShotStore.createShotStore({store});
        const timelineStore = global.Director3DTimelineStore.createTimelineStore({store});
        const catalog = global.Director3DToolCatalog.createCatalog();
        const viewport = global.Director3DViewportStage.createStage({
            container: document.getElementById('director3dViewport'),
            store,
            shotStore,
            sceneActions
        });
        global.Director3DBuiltInTools.createBuiltInTools().forEach(tool => catalog.add(tool));
        const timelineUI = global.Director3DTimelineUI.createTimelineUI({
            container: document.getElementById('director3dTimeline'),
            store,
            timelineStore,
            shotStore,
            viewport,
            selectObject: objectId => sceneActions.selectObject(objectId),
            selectShot: shotId => {
                const state = store.getState();
                if(state.currentShotId === shotId && state.viewMode === 'shot') return true;
                return shotStore.setCurrentShot(shotId);
            },
            previewShot: shotId => global.Director3DUIPanels.setShotPreview(document.getElementById('director3dShotPanel'), shotId)
        });
        const animationExporter = global.Director3DAnimationExporter.createAnimationExporter({store, viewport});
        const animationExportSettings = global.Director3DAnimationExportSettings.createAnimationExportSettings({store});
        const animationExportUI = global.Director3DAnimationExportUI.createAnimationExportUI({
            root:document.getElementById('director3dApp'),
            exporter:animationExporter,
            settings:animationExportSettings
        });
        document.getElementById('director3dTimeline')?.addEventListener('director3d:export-animation', () => {
            animationExportUI.open();
        });
        appContext = {store, history, commandBus, sceneActions, outlinerStore, shotStore, timelineStore, timelineUI, animationExporter, animationExportSettings, animationExportUI, catalog, viewport, bridge: global.Director3DIframeClient};
        ensureViewportExportButton();
        store.subscribe(renderState);
        appContext.autoKeyframe = global.Director3DAutoKeyframe.createAutoKeyframe({store, timelineStore});
        bindActions(appContext);
        global.Director3DIframeClient.init(store, renderState);
        global.Director3DApp = Object.freeze(appContext);
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
    else boot();
})(window);
