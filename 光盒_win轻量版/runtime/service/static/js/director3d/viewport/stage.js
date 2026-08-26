(function(global){
    'use strict';

    const THREE_URL = '/static/vendor/js/three-0.160.0.module.js';
    const MIN_OBJECT_SCALE = 0.08;
    const MIN_GIZMO_DISPLAY_SCALE = 0.64;
    const MAX_GIZMO_DISPLAY_SCALE = 1.45;
    function clamp(value, min, max){
        return Math.min(max, Math.max(min, value));
    }

    function buildDemoScene(THREE){
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf3f3f3);
        scene.fog = new THREE.Fog(0xf3f3f3, 18, 92);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(420, 420),
            new THREE.MeshBasicMaterial({color: 0xffffff, depthWrite: false})
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.012;
        ground.name = 'whiteHorizonPlane';
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(420, 420, 0xd7dce3, 0xeaedf2);
        grid.name = 'softInfiniteGrid';
        grid.material.transparent = true;
        grid.material.opacity = 0.42;
        scene.add(grid);

        const ambient = new THREE.HemisphereLight(0xffffff, 0xd9dee7, 0.72);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
        keyLight.position.set(-4, 7, 5);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xcbd5e1, 0.32);
        fillLight.position.set(5, 3, -4);
        scene.add(fillLight);

        const objectGroup = new THREE.Group();
        objectGroup.name = 'director3dSceneObjects';
        scene.add(objectGroup);

        return {scene, objectGroup};
    }

    function createStage({container, store, shotStore, sceneActions, aspectRatio = global.Director3DAspectRatio} = {}){
        if(!container || !store?.getState || !shotStore?.current){
            throw new Error('Director3DViewportStage requires container, store, and shotStore');
        }
        const Cameras = global.Director3DViewportCameras;
        if(!Cameras){
            throw new Error('Director3DViewportStage requires Director3DViewportCameras');
        }
        const SceneObjects = global.Director3DSceneObjects;
        if(!SceneObjects){
            throw new Error('Director3DViewportStage requires Director3DSceneObjects');
        }
        const Overlay = global.Director3DViewportOverlay;
        if(!Overlay){
            throw new Error('Director3DViewportStage requires Director3DViewportOverlay');
        }
        const CameraIcons = global.Director3DViewportCameraIcons;
        if(!CameraIcons){
            throw new Error('Director3DViewportStage requires Director3DViewportCameraIcons');
        }
        const CameraTargets = global.Director3DViewportCameraTargets;
        if(!CameraTargets){
            throw new Error('Director3DViewportStage requires Director3DViewportCameraTargets');
        }
        const Gizmo = global.Director3DTransformGizmo;
        if(!Gizmo){
            throw new Error('Director3DViewportStage requires Director3DTransformGizmo');
        }
        const actions = sceneActions || global.Director3DSceneActions?.createSceneActions?.({store});
        if(!actions){
            throw new Error('Director3DViewportStage requires Director3DSceneActions');
        }

        container.innerHTML = '';
        const host = Overlay.createElement('director3d-viewport-canvas-host');
        host.style.cursor = 'grab';
        container.appendChild(host);
        const maskApi = Overlay.createShotMask(container);
        const quadLayer = Overlay.createQuadLayer(container);
        const fallback = Overlay.createFallbackStage(host);

        let disposed = false;
        let threeApi = null;
        let lastState = store.getState();
        let lastLayout = null;
        let workView = Cameras.viewFromState(lastState, shotStore.current());
        let isDragging = false;
        let dragMode = '';
        let lastPointer = null;
        let activeShotViewId = lastState.viewMode === 'shot' ? lastState.currentShotId : '';
        let animationFrame = 0;
        let expandedQuadView = '';
        let activeQuadFrameId = '';
        let pointerStart = null;
        let gizmoAxisDrag = null;
        let gizmoRotateDrag = null;
        let gizmoScaleDrag = null;
        let shotTargetDrag = null;
        let gizmoMode = 'move';
        let lastGizmoObjectId = '';
        let activeRotateAxis = '';
        let activeRotateVisualAxis = '';
        let viewModeTransition = false;
        let panoramaView = {
            target: workView.target.slice(0, 3),
            distance: workView.distance,
            yaw: workView.yaw,
            pitch: workView.pitch
        };
        const orthoViews = {
            top: {target: [0, 0.7, 0], span: 8},
            front: {target: [0, 0.7, 0], span: 8},
            side: {target: [0, 0.7, 0], span: 8}
        };

        function syncOrthoTargetsToWorkView(){
            Object.keys(orthoViews).forEach(id => {
                orthoViews[id].target = workView.target.slice(0, 3);
            });
        }

        function syncAllViewTargetsFromOrtho(viewId){
            const source = orthoViews[viewId];
            if(!source) return;
            const target = source.target.slice(0, 3);
            workView.target = target.slice(0, 3);
            Object.keys(orthoViews).forEach(id => {
                orthoViews[id].target = target.slice(0, 3);
            });
        }

        function syncOrthoSpans(span){
            Object.keys(orthoViews).forEach(id => {
                orthoViews[id].span = span;
            });
        }

        function viewportSize(){
            const rect = container.getBoundingClientRect?.() || {};
            return {
                width: Math.max(1, Math.round(rect.width || container.clientWidth || 1)),
                height: Math.max(1, Math.round(rect.height || container.clientHeight || 1))
            };
        }

        function currentRatio(){
            const shot = shotStore.current();
            return aspectRatio.parse(shot?.aspectRatio || '16:9');
        }

        function renderOverlay(state = lastState){
            const size = viewportSize();
            let layout = global.Director3DViewportLayout.describeViewport({
                viewMode: state.viewMode,
                width: size.width,
                height: size.height,
                aspectRatio: currentRatio()
            });
            if(layout.mode !== 'quad') expandedQuadView = '';
            if(layout.mode === 'quad' && expandedQuadView){
                const frame = layout.frames.find(item => item.id === expandedQuadView) || layout.frames[0];
                layout = {
                    mode: 'quad',
                    expanded: true,
                    frames: [{...frame, x: 0, y: 0, width: size.width, height: size.height}],
                    dimOutsideFrame: false
                };
            }
            lastLayout = layout;
            const shouldShowShotFrame = layout.mode === 'shot'
                || (['front', 'side', 'top'].includes(layout.mode) && state.currentShotId);
            if(shouldShowShotFrame){
                const shotFrame = layout.mode === 'shot'
                    ? layout.frames[0]
                    : global.Director3DViewportLayout.computeShotFrame({
                        width: size.width,
                        height: size.height,
                        aspectRatio: currentRatio()
                    });
                Overlay.setShotMask(maskApi, size, shotFrame);
            } else Overlay.hideShotMask(maskApi);
            if(layout.mode === 'quad') Overlay.setQuadLabels(quadLayer, layout.frames);
            else {
                quadLayer.hidden = true;
                quadLayer.innerHTML = '';
            }
            return layout;
        }

        function frameFromPoint(x, y){
            if(!lastLayout?.frames?.length) return null;
            const rect = container.getBoundingClientRect();
            const localX = x - rect.left;
            const localY = y - rect.top;
            return lastLayout.frames.find(frame =>
                localX >= frame.x && localX <= frame.x + frame.width &&
                localY >= frame.y && localY <= frame.y + frame.height
            ) || null;
        }

        function quadViewFromPointer(event){
            if(['front', 'side', 'top'].includes(lastState.viewMode)) return lastState.viewMode;
            if(lastState.viewMode !== 'quad') return '';
            if(expandedQuadView) return expandedQuadView;
            return frameFromPoint(event.clientX, event.clientY)?.id || '';
        }

        function handleMiddleClickViewToggle(event){
            if(lastState.viewMode !== 'quad'){
                expandedQuadView = '';
                if(!shotStore.setViewMode?.('quad')) store.patchState({viewMode: 'quad'});
                return true;
            }
            if(expandedQuadView){
                expandedQuadView = '';
                renderScene(lastState);
                return true;
            }
            const frame = frameFromPoint(event.clientX, event.clientY);
            if(!frame) return false;
            expandedQuadView = frame.id;
            renderScene(lastState);
            return true;
        }

        function isViewportControlEvent(event){
            return Boolean(event.target?.closest?.('[data-director3d-action], button, a, input, select, textarea, [role="button"]'));
        }

        function panOrthoView(viewId, dx, dy){
            const view = orthoViews[viewId];
            if(!view) return false;
            const panScale = view.span * 0.0018;
            if(viewId === 'top'){
                view.target[0] -= dx * panScale;
                view.target[2] -= dy * panScale;
            } else if(viewId === 'front'){
                view.target[0] -= dx * panScale;
                view.target[1] += dy * panScale;
            } else {
                view.target[2] += dx * panScale;
                view.target[1] += dy * panScale;
            }
            syncAllViewTargetsFromOrtho(viewId);
            return true;
        }

        function renderFrameForPointer(event, forcedFrameId = ''){
            const size = viewportSize();
            if(lastLayout?.mode === 'quad'){
                if(forcedFrameId) return lastLayout.frames.find(frame => frame.id === forcedFrameId) || lastLayout.frames[0];
                return frameFromPoint(event.clientX, event.clientY) || lastLayout.frames[0];
            }
            return {id: lastState.viewMode || 'perspective', x: 0, y: 0, width: size.width, height: size.height};
        }

        function cameraForPointer(event, forcedFrameId = ''){
            const frame = renderFrameForPointer(event, forcedFrameId);
            if(lastLayout?.mode === 'quad') return {
                frame,
                camera: Cameras.quadCameraForFrame(threeApi.THREE, frame, threeApi.camera, orthoViews)
            };
            if(['front', 'side', 'top'].includes(lastState.viewMode)) return {
                frame,
                camera: Cameras.quadCameraForFrame(threeApi.THREE, frame, lastState.viewMode, orthoViews)
            };
            return {frame, camera: threeApi.camera};
        }

        function rayFromPointer(event, forcedFrameId = ''){
            const {frame, camera} = cameraForPointer(event, forcedFrameId);
            const rect = container.getBoundingClientRect();
            const localX = event.clientX - rect.left - frame.x;
            const localY = event.clientY - rect.top - frame.y;
            const pointer = new threeApi.THREE.Vector2(
                (localX / Math.max(1, frame.width)) * 2 - 1,
                -(localY / Math.max(1, frame.height)) * 2 + 1
            );
            threeApi.raycaster.setFromCamera(pointer, camera);
            return {ray: threeApi.raycaster.ray.clone(), frameId: frame.id};
        }

        function screenPointFromWorld(point, frame, camera){
            const projected = point.clone().project(camera);
            return new threeApi.THREE.Vector2(
                frame.x + ((projected.x + 1) / 2) * frame.width,
                frame.y + ((1 - projected.y) / 2) * frame.height
            );
        }

        function screenAxisFromWorldAxis(event, frameId, center, axis){
            const {frame, camera} = cameraForPointer(event, frameId);
            const start = screenPointFromWorld(center, frame, camera);
            const end = screenPointFromWorld(center.clone().add(axis), frame, camera);
            const screenAxis = end.sub(start);
            if(screenAxis.lengthSq() < 0.0001) return null;
            return screenAxis;
        }

        function selectedSceneObject(){
            const objects = Array.isArray(lastState.scene?.objects) ? lastState.scene.objects : [];
            const selection = lastState.selection?.objectIds || [];
            const id = lastState.selection?.lastObjectId || selection[0] || '';
            return objects.find(object => object && object.id === id) || null;
        }

        function patchMovedObjectPosition(objectId, position){
            actions.setObjectPosition(objectId, [position.x, position.y, position.z]);
        }

        function patchObjectRotation(objectId, quaternion){
            actions.setObjectRotation(objectId, [quaternion.x, quaternion.y, quaternion.z, quaternion.w]);
        }

        function patchObjectScale(objectId, scale){
            actions.setObjectScale(objectId, [scale.x, scale.y, scale.z]);
        }

        function patchObjectScaleAndPosition(objectId, scale, position){
            actions.setObjectScaleAndPosition(objectId, [scale.x, scale.y, scale.z], [position.x, position.y, position.z]);
        }

        function axisVector(axisName){
            return new threeApi.THREE.Vector3(
                axisName === 'x' ? 1 : 0,
                axisName === 'y' ? 1 : 0,
                axisName === 'z' ? 1 : 0
            );
        }

        function objectQuaternion(object){
            const rotation = Array.isArray(object?.transform?.rotation) ? object.transform.rotation : [0, 0, 0, 1];
            return new threeApi.THREE.Quaternion(
                Number(rotation[0] || 0),
                Number(rotation[1] || 0),
                Number(rotation[2] || 0),
                Number(rotation[3] || 1)
            ).normalize();
        }

        function objectScale(object){
            const scale = Array.isArray(object?.transform?.scale) ? object.transform.scale : [1, 1, 1];
            return new threeApi.THREE.Vector3(
                Math.max(MIN_OBJECT_SCALE, Number(scale[0] || 1)),
                Math.max(MIN_OBJECT_SCALE, Number(scale[1] || 1)),
                Math.max(MIN_OBJECT_SCALE, Number(scale[2] || 1))
            );
        }

        function bakeObjectTransform(objectId){
            const state = store.getState();
            const objects = Array.isArray(state.scene?.objects) ? state.scene.objects : [];
            const object = objects.find(item => item?.id === objectId);
            if(!object || object.locked) return;
            const transform = object.transform || {};
            const previousBaked = new threeApi.THREE.Matrix4();
            if(Array.isArray(transform.bakedMatrix) && transform.bakedMatrix.length === 16){
                previousBaked.fromArray(transform.bakedMatrix.map(value => Number(value) || 0));
            }
            const localTransform = new threeApi.THREE.Matrix4().compose(
                new threeApi.THREE.Vector3(0, 0, 0),
                objectQuaternion(object),
                objectScale(object)
            );
            const nextBaked = localTransform.multiply(previousBaked);
            actions.bakeObjectTransform(objectId, nextBaked.toArray());
        }

        function gizmoDisplayScale(object){
            const scale = objectScale(object);
            const largest = Math.max(scale.x, scale.y, scale.z, MIN_OBJECT_SCALE);
            const displayLargest = clamp(largest, MIN_GIZMO_DISPLAY_SCALE, MAX_GIZMO_DISPLAY_SCALE);
            return scale.multiplyScalar(displayLargest / largest);
        }

        function objectBaseSize(object){
            if(object?.geometryRef === 'primitive:cylinder') return new threeApi.THREE.Vector3(0.84, 1.2, 0.84);
            if(object?.geometryRef === 'primitive:sphere') return new threeApi.THREE.Vector3(1.16, 1.16, 1.16);
            if(object?.geometryRef === 'primitive:plane') return new threeApi.THREE.Vector3(2.2, 0.04, 2.2);
            if(object?.geometryRef === 'primitive:wall') return new threeApi.THREE.Vector3(2.2, 1.6, 0.12);
            if(object?.geometryRef === 'primitive:mannequin') return new threeApi.THREE.Vector3(0.84, 1.74, 0.4);
            return new threeApi.THREE.Vector3(1.2, 1.2, 1.2);
        }

        function fallbackLocalBounds(object){
            const size = objectBaseSize(object);
            return new threeApi.THREE.Box3(
                new threeApi.THREE.Vector3(-size.x / 2, -size.y / 2, -size.z / 2),
                new threeApi.THREE.Vector3(size.x / 2, size.y / 2, size.z / 2)
            );
        }

        function objectLocalBounds(node, object){
            if(!node) return fallbackLocalBounds(object);
            node.updateWorldMatrix?.(true, true);
            const rootInverse = new threeApi.THREE.Matrix4().copy(node.matrixWorld).invert();
            const bounds = new threeApi.THREE.Box3();
            const points = [
                new threeApi.THREE.Vector3(), new threeApi.THREE.Vector3(),
                new threeApi.THREE.Vector3(), new threeApi.THREE.Vector3(),
                new threeApi.THREE.Vector3(), new threeApi.THREE.Vector3(),
                new threeApi.THREE.Vector3(), new threeApi.THREE.Vector3()
            ];
            node.traverse?.(child => {
                if(!child.isMesh || !child.geometry) return;
                if(!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
                const box = child.geometry.boundingBox;
                if(!box) return;
                child.updateWorldMatrix?.(true, false);
                const matrix = new threeApi.THREE.Matrix4().multiplyMatrices(rootInverse, child.matrixWorld);
                points[0].set(box.min.x, box.min.y, box.min.z);
                points[1].set(box.min.x, box.min.y, box.max.z);
                points[2].set(box.min.x, box.max.y, box.min.z);
                points[3].set(box.min.x, box.max.y, box.max.z);
                points[4].set(box.max.x, box.min.y, box.min.z);
                points[5].set(box.max.x, box.min.y, box.max.z);
                points[6].set(box.max.x, box.max.y, box.min.z);
                points[7].set(box.max.x, box.max.y, box.max.z);
                points.forEach(point => bounds.expandByPoint(point.applyMatrix4(matrix)));
            });
            return bounds.isEmpty() ? fallbackLocalBounds(object) : bounds;
        }

        function projectedRotationVector(point, center, axis){
            return point.clone().sub(center).projectOnPlane(axis).normalize();
        }

        function patchSelection(objectId){
            actions.selectObject(objectId);
        }

        function pickObjectFromViewport(event){
            if(!threeApi?.sceneObjects?.size) return null;
            rayFromPointer(event);
            const candidates = Array.from(threeApi.sceneObjects.values()).filter(node => node.visible !== false);
            const hits = threeApi.raycaster.intersectObjects(candidates, true);
            const hit = hits.find(item => item.object?.parent || item.object);
            if(!hit) return null;
            let node = hit.object;
            while(node && !node.userData?.objectId) node = node.parent;
            return node?.userData?.objectId || null;
        }

        function clearViewportSelection(){
            patchSelection('');
            gizmoMode = 'move';
        }

        function selectObjectFromViewport(event){
            const objectId = pickObjectFromViewport(event);
            if(!objectId) return false;
            if(objectId !== selectedSceneObject()?.id) gizmoMode = 'move';
            patchSelection(objectId);
            return true;
        }

        function applyGizmoMode(mode){
            if(!['move', 'rotate', 'scale'].includes(mode)) return;
            gizmoMode = mode;
            if(mode !== 'rotate'){
                activeRotateAxis = '';
                activeRotateVisualAxis = '';
            }
            syncTransformGizmo(lastState);
            renderScene(lastState);
        }

        function syncGizmoModeButtons(handles){
            const buttons = handles?.buttons;
            if(!buttons?.children || buttons.children.length < 2) return;
            const modes = ['move', 'rotate', 'scale'].filter(mode => mode !== gizmoMode);
            Gizmo.setModeButtonMode(buttons.children[0], modes[0]);
            Gizmo.setModeButtonMode(buttons.children[1], modes[1]);
        }

        function pickGizmoHandle(event){
            if(!threeApi?.transformGizmo?.visible) return null;
            rayFromPointer(event);
            const hits = threeApi.raycaster.intersectObject(threeApi.transformGizmo, true);
            return hits.find(hit => {
                const role = hit.object?.userData?.gizmoRole;
                return role && role !== 'visualOnly';
            }) || hits.find(hit => hit.object?.userData?.gizmoRole === 'visualOnly') || hits[0] || null;
        }

        function isDraggableGizmoRole(role){
            return (role === 'moveAxis' && gizmoMode === 'move') ||
                (role === 'rotateArrow' && gizmoMode === 'rotate') ||
                (role === 'scaleHandle' && gizmoMode === 'scale');
        }

        function updateHoverCursor(event){
            if(isDragging) return;
            const targetHit = pickShotTarget(event);
            if(targetHit){
                host.style.cursor = targetHit.object?.userData?.locked ? 'not-allowed' : 'move';
                return;
            }
            const hit = pickGizmoHandle(event);
            const role = hit?.object?.userData?.gizmoRole || '';
            activeRotateVisualAxis = role === 'rotateArrow' && gizmoMode === 'rotate'
                ? (hit.object.userData.visualAxis || hit.object.userData.axis || '')
                : '';
            activeRotateAxis = role === 'rotateArrow' && gizmoMode === 'rotate'
                ? (hit.object.userData.axis || '')
                : '';
            syncTransformGizmo(lastState);
            renderScene(lastState);
            if(isDraggableGizmoRole(role)){
                host.style.cursor = 'move';
                return;
            }
            if(role === 'modeButton'){
                host.style.cursor = 'pointer';
                return;
            }
            host.style.cursor = 'grab';
        }

        function pickShotTarget(event){
            if(!threeApi?.shotTargetControls?.size) return null;
            rayFromPointer(event);
            const controls = Array.from(threeApi.shotTargetControls.values()).filter(control => control.visible !== false);
            if(!controls.length) return null;
            return threeApi.raycaster.intersectObjects(controls, true).find(hit => hit.object?.userData?.targetRole === 'shotTarget') || null;
        }

        function beginShotTargetDrag(event){
            const hit = pickShotTarget(event);
            const shotId = String(hit?.object?.userData?.shotId || '');
            const shot = shotStore.get?.(shotId);
            if(!hit || !shot || shot.locked) return false;
            const picked = rayFromPointer(event);
            const target = new threeApi.THREE.Vector3(...CameraTargets.targetForShot(shot));
            const normal = new threeApi.THREE.Vector3(...CameraTargets.dragPlaneNormal(picked.frameId, picked.ray.direction.toArray())).normalize();
            const plane = new threeApi.THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);
            const startHit = picked.ray.intersectPlane(plane, new threeApi.THREE.Vector3());
            if(!startHit) return false;
            shotTargetDrag = {shotId, frameId:picked.frameId, plane, startHit:startHit.clone(), startTarget:target.clone()};
            dragMode = 'shotTarget';
            host.style.cursor = 'grabbing';
            return true;
        }

        function updateShotTargetDrag(event){
            if(!shotTargetDrag) return false;
            const picked = rayFromPointer(event, shotTargetDrag.frameId);
            const hit = picked.ray.intersectPlane(shotTargetDrag.plane, new threeApi.THREE.Vector3());
            if(!hit) return false;
            const target = shotTargetDrag.startTarget.clone().add(hit.sub(shotTargetDrag.startHit));
            shotStore.setShotTarget?.(shotTargetDrag.shotId, target.toArray());
            return true;
        }

        function consumeGizmoPointer(event){
            const hit = pickGizmoHandle(event);
            if(!hit) return false;
            const role = hit.object?.userData?.gizmoRole || '';
            if(role === 'visualOnly' || role === 'modeButton' || isDraggableGizmoRole(role) || hit.object){
                dragMode = 'gizmoVisual';
                return true;
            }
            return false;
        }

        function beginGizmoAxisDrag(event){
            if(!threeApi) return false;
            const hit = pickGizmoHandle(event);
            const role = hit?.object?.userData?.gizmoRole || '';
            if(role === 'modeButton'){
                const mode = hit.object.userData.mode;
                applyGizmoMode(mode);
                dragMode = 'gizmoButton';
                return true;
            }
            if(role === 'visualOnly'){
                dragMode = 'gizmoVisual';
                return true;
            }
            if(role === 'rotateArrow') return beginGizmoRotateDrag(event, hit);
            if(role === 'scaleHandle') return beginGizmoScaleDrag(event, hit);
            if(hit && !role){
                dragMode = 'gizmoVisual';
                return true;
            }
            if(role !== 'moveAxis' || gizmoMode !== 'move') return false;
            const object = selectedSceneObject();
            if(!object || object.locked || object.visible === false) return false;
            const node = threeApi.sceneObjects.get(object.id);
            if(!node) return false;
            const picked = rayFromPointer(event);
            const axisName = hit.object.userData.axis;
            const axis = new threeApi.THREE.Vector3(
                axisName === 'x' ? 1 : 0,
                axisName === 'y' ? 1 : 0,
                axisName === 'z' ? 1 : 0
            );
            const startPosition = new threeApi.THREE.Vector3();
            node.getWorldPosition(startPosition);
            const normal = picked.ray.direction.clone().normalize();
            const plane = new threeApi.THREE.Plane().setFromNormalAndCoplanarPoint(normal, startPosition);
            const startHit = new threeApi.THREE.Vector3();
            if(!picked.ray.intersectPlane(plane, startHit)) return false;
            gizmoAxisDrag = {
                objectId: object.id,
                axis,
                frameId: picked.frameId,
                plane,
                startHit,
                startPosition
            };
            dragMode = 'gizmoAxis';
            host.style.cursor = 'grabbing';
            return true;
        }

        function beginGizmoRotateDrag(event, hit){
            if(!threeApi || gizmoMode !== 'rotate') return false;
            const role = hit?.object?.userData?.gizmoRole || '';
            if(role !== 'rotateArrow') return false;
            const object = selectedSceneObject();
            if(!object || object.locked || object.visible === false) return false;
            const node = threeApi.sceneObjects.get(object.id);
            if(!node) return false;
            activeRotateAxis = hit.object.userData.axis || '';
            activeRotateVisualAxis = hit.object.userData.visualAxis || activeRotateAxis;
            const objectRotation = objectQuaternion(object);
            const axis = axisVector(activeRotateAxis);
            const center = new threeApi.THREE.Vector3();
            node.getWorldPosition(center);
            const plane = new threeApi.THREE.Plane().setFromNormalAndCoplanarPoint(axis, center);
            const picked = rayFromPointer(event);
            const startHit = new threeApi.THREE.Vector3();
            if(!picked.ray.intersectPlane(plane, startHit)) return false;
            const startVector = projectedRotationVector(startHit, center, axis);
            if(startVector.lengthSq() < 0.0001) return false;
            gizmoRotateDrag = {
                objectId: object.id,
                axis,
                center,
                plane,
                frameId: picked.frameId,
                startVector,
                startQuaternion: objectRotation
            };
            dragMode = 'gizmoRotate';
            host.style.cursor = 'grabbing';
            return true;
        }

        function beginGizmoScaleDrag(event, hit){
            if(!threeApi || gizmoMode !== 'scale') return false;
            const role = hit?.object?.userData?.gizmoRole || '';
            if(role !== 'scaleHandle') return false;
            const object = selectedSceneObject();
            if(!object || object.locked || object.visible === false) return false;
            const node = threeApi.sceneObjects.get(object.id);
            if(!node) return false;
            const picked = rayFromPointer(event);
            const scaleMode = hit.object.userData.scaleMode || 'edge';
            const axisName = hit.object.userData.axis || '';
            const signX = Number(hit.object.userData.signX || 0);
            const signZ = Number(hit.object.userData.signZ || 0);
            const axisSign = signX || signZ || 1;
            const objectRotation = objectQuaternion(object);
            const axis = scaleMode === 'corner'
                ? new threeApi.THREE.Vector3(signX, 0, signZ).normalize()
                : axisVector(axisName).multiplyScalar(axisSign);
            const center = new threeApi.THREE.Vector3();
            node.getWorldPosition(center);
            const normal = picked.ray.direction.clone().normalize();
            const plane = new threeApi.THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
            const startHit = new threeApi.THREE.Vector3();
            if(!picked.ray.intersectPlane(plane, startHit)) return false;
            const screenAxis = scaleMode === 'corner' ? null : screenAxisFromWorldAxis(event, picked.frameId, center, axis);
            gizmoScaleDrag = {
                objectId: object.id,
                scaleMode,
                axisName,
                signX,
                signZ,
                axis,
                frameId: picked.frameId,
                plane,
                center,
                startHit,
                startPointer: {x:event.clientX, y:event.clientY},
                screenAxis,
                startScale: objectScale(object),
                startPosition: node.position.clone(),
                startQuaternion: objectRotation,
                localBounds: objectLocalBounds(node, object)
            };
            dragMode = 'gizmoScale';
            host.style.cursor = 'grabbing';
            return true;
        }

        function updateGizmoAxisDrag(event){
            if(!gizmoAxisDrag) return false;
            const pointer = rayFromPointer(event, gizmoAxisDrag.frameId);
            const hit = new threeApi.THREE.Vector3();
            if(!pointer.ray.intersectPlane(gizmoAxisDrag.plane, hit)) return false;
            const delta = hit.sub(gizmoAxisDrag.startHit);
            const amount = delta.dot(gizmoAxisDrag.axis);
            const nextPosition = gizmoAxisDrag.startPosition.clone().add(gizmoAxisDrag.axis.clone().multiplyScalar(amount));
            patchMovedObjectPosition(gizmoAxisDrag.objectId, nextPosition);
            return true;
        }

        function updateGizmoRotateDrag(event){
            if(!gizmoRotateDrag) return false;
            const pointer = rayFromPointer(event, gizmoRotateDrag.frameId);
            const hit = new threeApi.THREE.Vector3();
            if(!pointer.ray.intersectPlane(gizmoRotateDrag.plane, hit)) return false;
            const currentVector = projectedRotationVector(hit, gizmoRotateDrag.center, gizmoRotateDrag.axis);
            if(currentVector.lengthSq() < 0.0001) return false;
            let angle = gizmoRotateDrag.startVector.angleTo(currentVector);
            const cross = gizmoRotateDrag.startVector.clone().cross(currentVector);
            if(cross.dot(gizmoRotateDrag.axis) < 0) angle = -angle;
            const delta = new threeApi.THREE.Quaternion().setFromAxisAngle(gizmoRotateDrag.axis, angle);
            const nextQuaternion = delta.multiply(gizmoRotateDrag.startQuaternion).normalize();
            patchObjectRotation(gizmoRotateDrag.objectId, nextQuaternion);
            return true;
        }

        function scaleCornerUniform(startScale, amount){
            const factor = Math.max(MIN_OBJECT_SCALE, 1 + amount / 1.05);
            return new threeApi.THREE.Vector3(
                Math.max(MIN_OBJECT_SCALE, startScale.x * factor),
                Math.max(MIN_OBJECT_SCALE, startScale.y * factor),
                Math.max(MIN_OBJECT_SCALE, startScale.z * factor)
            );
        }

        function scaleEdgeSingleAxis(startScale, axisName, amount){
            const nextScale = startScale.clone();
            if(axisName) nextScale[axisName] = Math.max(MIN_OBJECT_SCALE, nextScale[axisName] + amount);
            return nextScale;
        }

        function scaleSingleSidePosition(startPosition, startQuaternion, localBounds, axisName, signX, signZ, startScale, nextScale){
            const nextPosition = startPosition.clone();
            const axis = axisVector(axisName);
            const sign = axisName === 'x' ? (signX || 1) : (axisName === 'z' ? (signZ || 1) : 1);
            const fixedLocal = sign >= 0 ? localBounds.min[axisName] : localBounds.max[axisName];
            const amount = startScale[axisName] - nextScale[axisName];
            const offset = axis
                .applyQuaternion(startQuaternion)
                .multiplyScalar(fixedLocal * amount);
            nextPosition.add(offset);
            return nextPosition;
        }

        function updateGizmoScaleDrag(event){
            if(!gizmoScaleDrag) return false;
            const pointer = rayFromPointer(event, gizmoScaleDrag.frameId);
            const hit = new threeApi.THREE.Vector3();
            if(!pointer.ray.intersectPlane(gizmoScaleDrag.plane, hit)) return false;
            const delta = hit.sub(gizmoScaleDrag.startHit);
            let amount = delta.dot(gizmoScaleDrag.axis);
            if(gizmoScaleDrag.scaleMode !== 'corner' && gizmoScaleDrag.screenAxis){
                const screenAxis = gizmoScaleDrag.screenAxis.clone();
                const lengthSq = screenAxis.lengthSq();
                if(lengthSq > 0.0001){
                    const pointerDelta = new threeApi.THREE.Vector2(
                        event.clientX - gizmoScaleDrag.startPointer.x,
                        event.clientY - gizmoScaleDrag.startPointer.y
                    );
                    amount = pointerDelta.dot(screenAxis) / lengthSq;
                }
            }
            const nextScale = gizmoScaleDrag.scaleMode === 'corner'
                ? scaleCornerUniform(gizmoScaleDrag.startScale, amount)
                : scaleEdgeSingleAxis(gizmoScaleDrag.startScale, gizmoScaleDrag.axisName, amount);
            if(gizmoScaleDrag.scaleMode === 'corner'){
                patchObjectScale(gizmoScaleDrag.objectId, nextScale);
            } else {
                const nextPosition = scaleSingleSidePosition(
                    gizmoScaleDrag.startPosition,
                    gizmoScaleDrag.startQuaternion,
                    gizmoScaleDrag.localBounds,
                    gizmoScaleDrag.axisName,
                    gizmoScaleDrag.signX,
                    gizmoScaleDrag.signZ,
                    gizmoScaleDrag.startScale,
                    nextScale
                );
                patchObjectScaleAndPosition(gizmoScaleDrag.objectId, nextScale, nextPosition);
            }
            return true;
        }

        function syncShotCameraIcons(state = lastState){
            if(!threeApi) return;
            const shots = Array.isArray(state.cameraShots) ? state.cameraShots : shotStore.list();
            const seen = new Set();
            shots.forEach(shot => {
                seen.add(shot.id);
                let icon = threeApi.shotCameraIcons.get(shot.id);
                if(!icon){
                    icon = CameraIcons.createCameraIcon(threeApi.THREE);
                    icon.name = `shotCameraIcon:${shot.id}`;
                    icon.userData.shotId = shot.id;
                    threeApi.shotCameraIcons.set(shot.id, icon);
                    threeApi.scene.add(icon);
                }
                icon.visible = ['panorama', 'quad', 'front', 'side', 'top'].includes(lastState.viewMode);
                CameraIcons.updateCameraIcon(icon, shot);
            });
            Array.from(threeApi.shotCameraIcons.entries()).forEach(([id, icon]) => {
                if(seen.has(id)) return;
                threeApi.scene.remove(icon);
                threeApi.shotCameraIcons.delete(id);
            });
        }

        function syncShotTargetControls(state = lastState){
            if(!threeApi?.shotTargetControls) return;
            const shots = Array.isArray(state.cameraShots) ? state.cameraShots : shotStore.list();
            const shot = shots.find(item => item?.id === state.currentShotId) || null;
            const visible = Boolean(shot) && ['panorama', 'quad', 'front', 'side', 'top'].includes(state.viewMode);
            const seen = new Set();
            if(shot){
                seen.add(shot.id);
                let control = threeApi.shotTargetControls.get(shot.id);
                if(!control){
                    control = CameraTargets.createTargetControl(threeApi.THREE);
                    control.name = `shotTargetControl:${shot.id}`;
                    control.userData.shotId = shot.id;
                    threeApi.shotTargetControls.set(shot.id, control);
                    threeApi.gizmoScene.add(control);
                }
                control.visible = visible;
                CameraTargets.updateTargetControl(threeApi.THREE, control, shot, workView.distance * 0.04);
            }
            Array.from(threeApi.shotTargetControls.entries()).forEach(([id, control]) => {
                if(seen.has(id)) return;
                threeApi.gizmoScene.remove(control);
                CameraTargets.disposeTargetControl(control);
                threeApi.shotTargetControls.delete(id);
            });
        }

        function syncSceneObjects(state = lastState){
            if(!threeApi?.objectGroup) return;
            const objects = Array.isArray(state.scene?.objects) ? state.scene.objects : [];
            const selected = new Set(state.selection?.objectIds || []);
            const seen = new Set();
            objects.forEach(object => {
                if(!object?.id) return;
                seen.add(object.id);
                let node = threeApi.sceneObjects.get(object.id);
                const bakedMatrixSignature = Array.isArray(object.transform?.bakedMatrix)
                    ? object.transform.bakedMatrix.join(',')
                    : '';
                if(!node || node.userData.geometryRef !== object.geometryRef || node.userData.bakedMatrixSignature !== bakedMatrixSignature){
                    if(node){
                        threeApi.objectGroup.remove(node);
                        SceneObjects.disposeObjectNode(node);
                    }
                    node = SceneObjects.createPrimitiveObject(threeApi.THREE, object);
                    node.name = object.name || object.id;
                    node.userData.objectId = object.id;
                    node.userData.geometryRef = object.geometryRef || '';
                    node.userData.bakedMatrixSignature = bakedMatrixSignature;
                    threeApi.sceneObjects.set(object.id, node);
                    threeApi.objectGroup.add(node);
                }
                node.name = object.name || object.id;
                SceneObjects.applySceneObjectTransform(threeApi.THREE, node, object);
                SceneObjects.applyObjectColor(node, object);
                SceneObjects.applyObjectSelection(threeApi.THREE, node, selected.has(object.id));
                syncSelectionBox(object.id, node, object, selected.has(object.id) && object.visible !== false);
            });
            Array.from(threeApi.sceneObjects.entries()).forEach(([id, node]) => {
                if(seen.has(id)) return;
                threeApi.objectGroup.remove(node);
                SceneObjects.disposeObjectNode(node);
                threeApi.sceneObjects.delete(id);
                const box = threeApi.selectionBoxes.get(id);
                if(box){
                    threeApi.scene.remove(box);
                    SceneObjects.disposeSelectionBox(box);
                    threeApi.selectionBoxes.delete(id);
                }
            });
        }

        function syncSelectionBox(objectId, node, object, selected){
            let box = threeApi.selectionBoxes.get(objectId);
            if(!selected){
                if(box) box.visible = false;
                return;
            }
            const bounds = objectLocalBounds(node, object);
            if(!box){
                box = Gizmo.createSelectionBoxLine(threeApi.THREE, bounds);
                box.name = `director3dSelectionBox:${objectId}`;
                box.userData.objectId = objectId;
                threeApi.selectionBoxes.set(objectId, box);
                threeApi.scene.add(box);
            } else {
                Gizmo.setSelectionBoxBounds(threeApi.THREE, box, bounds);
            }
            box.position.copy(node.position);
            box.quaternion.identity();
            box.scale.copy(node.scale);
            box.visible = true;
        }

        function updateScaleHandleLayout(item, halfX, halfZ, groundY, topY){
            const mode = item.userData.scaleMode;
            const signX = Number(item.userData.signX || 0);
            const signZ = Number(item.userData.signZ || 0);
            if(mode === 'height') item.position.set(0, topY, 0);
            else item.position.set(signX * halfX, groundY, signZ * halfZ);
        }

        function syncScaleGizmoAxes(object, handles){
            if(!threeApi || !handles?.scaleGroup?.userData?.scaleHandles) return;
            const scale = gizmoDisplayScale(object);
            handles.scaleGroup.quaternion.identity();
            const halfX = 0.78 * Math.max(MIN_OBJECT_SCALE, scale.x);
            const halfZ = 0.78 * Math.max(MIN_OBJECT_SCALE, scale.z);
            const groundY = -0.58 * Math.max(MIN_OBJECT_SCALE, scale.y);
            const topY = 1.05 * Math.max(MIN_OBJECT_SCALE, scale.y);
            const corners = [
                new threeApi.THREE.Vector3(-halfX, groundY, -halfZ),
                new threeApi.THREE.Vector3(halfX, groundY, -halfZ),
                new threeApi.THREE.Vector3(halfX, groundY, halfZ),
                new threeApi.THREE.Vector3(-halfX, groundY, halfZ)
            ];
            const lines = handles.scaleGroup.userData.scaleFrameLines || [];
            if(lines[0]) Gizmo.setLinePoints(threeApi.THREE, lines[0], [corners[0], corners[1]]);
            if(lines[1]) Gizmo.setLinePoints(threeApi.THREE, lines[1], [corners[1], corners[2]]);
            if(lines[2]) Gizmo.setLinePoints(threeApi.THREE, lines[2], [corners[2], corners[3]]);
            if(lines[3]) Gizmo.setLinePoints(threeApi.THREE, lines[3], [corners[3], corners[0]]);
            if(lines[4]) Gizmo.setLinePoints(threeApi.THREE, lines[4], [new threeApi.THREE.Vector3(0, groundY, 0), new threeApi.THREE.Vector3(0, topY, 0)]);
            handles.scaleGroup.userData.scaleHandles.forEach(handle => updateScaleHandleLayout(handle, halfX, halfZ, groundY, topY));
        }

        function syncRotateGizmoOrientation(object, handles){
            if(!handles?.rotateGroup) return;
            const baseQuaternion = handles.rotateGroup.userData.baseQuaternion || new threeApi.THREE.Quaternion();
            const scale = gizmoDisplayScale(object);
            const radius = Math.max(0.72, scale.x, scale.y, scale.z);
            handles.rotateGroup.quaternion.copy(baseQuaternion);
            handles.rotateGroup.scale.setScalar(radius);
        }

        function syncRotateAxisVisibility(handles){
            if(!handles?.rotateGroup) return;
            handles.rotateGroup.traverse(item => {
                const visualAxis = item.userData?.visualAxis || item.userData?.rotateAxis || '';
                if(!visualAxis) return;
                item.visible = !activeRotateVisualAxis || visualAxis === activeRotateVisualAxis;
            });
        }

        function syncTransformGizmo(state = lastState){
            if(!threeApi?.transformGizmo) return;
            const object = selectedSceneObject();
            const node = object ? threeApi.sceneObjects.get(object.id) : null;
            if(!object || !node || object.visible === false){
                threeApi.transformGizmo.visible = false;
                lastGizmoObjectId = '';
                return;
            }
            if(object.id !== lastGizmoObjectId){
                gizmoMode = 'move';
                lastGizmoObjectId = object.id;
            }
            const position = new threeApi.THREE.Vector3();
            node.getWorldPosition(position);
            threeApi.transformGizmo.position.copy(position);
            threeApi.transformGizmo.quaternion.identity();
            threeApi.transformGizmo.visible = true;
            const handles = threeApi.transformGizmo.userData.gizmoHandles || {};
            syncRotateGizmoOrientation(object, handles);
            syncRotateAxisVisibility(handles);
            syncScaleGizmoAxes(object, handles);
            if(handles.moveGroup) handles.moveGroup.visible = gizmoMode === 'move';
            if(handles.rotateGroup) handles.rotateGroup.visible = gizmoMode === 'rotate';
            if(handles.scaleGroup) handles.scaleGroup.visible = gizmoMode === 'scale';
            syncGizmoModeButtons(handles);
            if(handles.buttons) handles.buttons.visible = true;
            const size = workView.distance * 0.12;
            threeApi.transformGizmo.scale.setScalar(size);
        }

        function animateWorkViewToView(end, options = {}){
            if(!end) return;
            const start = {
                target: workView.target.slice(0, 3),
                distance: workView.distance,
                yaw: workView.yaw,
                pitch: workView.pitch
            };
            const startedAt = (global.performance?.now?.() || Date.now());
            const duration = 420;
            if(animationFrame) global.cancelAnimationFrame?.(animationFrame);
            function ease(t){
                return 1 - Math.pow(1 - t, 3);
            }
            function step(now){
                const t = Math.min(1, ((now || Date.now()) - startedAt) / duration);
                const k = ease(t);
                workView = {
                    target: start.target.map((value, index) => value + (end.target[index] - value) * k),
                    distance: start.distance + (end.distance - start.distance) * k,
                    yaw: start.yaw + (end.yaw - start.yaw) * k,
                    pitch: start.pitch + (end.pitch - start.pitch) * k
                };
                renderScene(lastState);
                if(t < 1) animationFrame = global.requestAnimationFrame(step);
                else {
                    animationFrame = 0;
                    options.onComplete?.();
                }
            }
            animationFrame = global.requestAnimationFrame(step);
        }

        function animateViewToShot(shot){
            if(!shot) return;
            animateWorkViewToView(Cameras.viewFromState(lastState, shot));
        }

        function renderMainAndGizmo(camera){
            const previousAutoClear = threeApi.renderer.autoClear;
            threeApi.renderer.autoClear = true;
            threeApi.renderer.render(threeApi.scene, camera);
            threeApi.renderer.autoClear = false;
            threeApi.renderer.clearDepth();
            threeApi.renderer.render(threeApi.gizmoScene, camera);
            threeApi.renderer.autoClear = previousAutoClear;
        }

        function renderScene(state = lastState){
            if(!threeApi) return;
            const size = viewportSize();
            threeApi.renderer.setSize(size.width, size.height, false);
            const layout = renderOverlay(state);
            Cameras.applyWorkView(threeApi.THREE, threeApi.camera, workView, size.width / size.height);
            syncSceneObjects(state);
            syncShotCameraIcons(state);
            syncShotTargetControls(state);
            syncTransformGizmo(state);

            if(viewModeTransition){
                renderMainAndGizmo(threeApi.camera);
            } else if(layout.mode === 'quad'){
                threeApi.renderer.setScissorTest(true);
                layout.frames.forEach(frame => {
                    const y = size.height - frame.y - frame.height;
                    const camera = Cameras.quadCameraForFrame(threeApi.THREE, frame, threeApi.camera, orthoViews);
                    threeApi.renderer.setViewport(frame.x, y, frame.width, frame.height);
                    threeApi.renderer.setScissor(frame.x, y, frame.width, frame.height);
                    renderMainAndGizmo(camera);
                });
                threeApi.renderer.setScissorTest(false);
                threeApi.renderer.setViewport(0, 0, size.width, size.height);
            } else if(['front', 'side', 'top'].includes(layout.mode)){
                const frame = layout.frames[0] || {id: layout.mode, x: 0, y: 0, width: size.width, height: size.height};
                const camera = Cameras.quadCameraForFrame(threeApi.THREE, frame, threeApi.camera, orthoViews);
                renderMainAndGizmo(camera);
            } else {
                renderMainAndGizmo(threeApi.camera);
            }
        }

        function timelineFramePair(keyframes, frame){
            const frames = Array.isArray(keyframes) ? keyframes : [];
            if(!frames.length) return null;
            if(frame <= frames[0].frame) return {from:frames[0], to:frames[0], amount:0};
            const last = frames[frames.length - 1];
            if(frame >= last.frame) return {from:last, to:last, amount:0};
            for(let index = 1; index < frames.length; index++){
                const to = frames[index];
                if(frame <= to.frame){
                    const from = frames[index - 1];
                    return {from, to, amount:(frame - from.frame) / Math.max(1, to.frame - from.frame)};
                }
            }
            return {from:last, to:last, amount:0};
        }

        function shotCutAtFrame(cuts, frame, fallbackShotId){
            const currentFrame = Number(frame || 0);
            const active = (Array.isArray(cuts) ? cuts : []).reduce((result, cut) => {
                if(Number(cut?.frame) > currentFrame || !cut?.shotId) return result;
                return !result || Number(cut.frame) >= Number(result.frame) ? cut : result;
            }, null);
            return String(active?.shotId || fallbackShotId || '');
        }

        function easedTimelineAmount(amount, interpolation){
            const value = Math.max(0, Math.min(1, Number(amount) || 0));
            if(interpolation === 'hold') return 0;
            if(interpolation === 'smooth') return value * value * (3 - (2 * value));
            return value;
        }

        function lerpVector(from, to, amount, fallback){
            return fallback.map((value, index) => {
                const a = Number(from?.[index] ?? value);
                const b = Number(to?.[index] ?? a);
                return a + (b - a) * amount;
            });
        }

        function matrixForTimelineTransform(transform){
            const matrix = new threeApi.THREE.Matrix4();
            if(Array.isArray(transform?.bakedMatrix) && transform.bakedMatrix.length === 16){
                matrix.fromArray(transform.bakedMatrix.map(value => Number(value) || 0));
                return matrix;
            }
            return matrix.compose(new threeApi.THREE.Vector3(), objectQuaternion({transform}), objectScale({transform}));
        }

        function interpolateTimelineTransform(from, to, amount){
            const start = from || {};
            const end = to || start;
            const startMatrix = matrixForTimelineTransform(start);
            const endMatrix = matrixForTimelineTransform(end);
            const startRotation = new threeApi.THREE.Quaternion();
            const endRotation = new threeApi.THREE.Quaternion();
            const startScale = new threeApi.THREE.Vector3();
            const endScale = new threeApi.THREE.Vector3();
            startMatrix.decompose(new threeApi.THREE.Vector3(), startRotation, startScale);
            endMatrix.decompose(new threeApi.THREE.Vector3(), endRotation, endScale);
            startRotation.slerp(endRotation, amount);
            startScale.lerp(endScale, amount);
            const bakedMatrix = new threeApi.THREE.Matrix4().compose(new threeApi.THREE.Vector3(), startRotation, startScale);
            return {
                ...start,
                position: lerpVector(start.position, end.position, amount, [0, 0, 0]),
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
                bakedMatrix: bakedMatrix.toArray()
            };
        }

        function interpolateTimelineCamera(from, to, amount){
            const start = from || {};
            const end = to || start;
            const startFov = Number(start.fov || 45);
            const endFov = Number(end.fov || startFov);
            return {
                ...start,
                ...end,
                position: lerpVector(start.position, end.position, amount, [4, 3, 6]),
                target: lerpVector(start.target, end.target, amount, [0, 0.8, 0]),
                fov: startFov + (endFov - startFov) * amount
            };
        }

        function timelinePreviewState(timeline){
            const frame = Number(timeline?.currentFrame || 0);
            const objectTracks = timeline?.objectTracks || {};
            const cameraTracks = timeline?.cameraTracks || {};
            const objects = (lastState.scene?.objects || []).map(object => {
                const pair = timelineFramePair(objectTracks[object.id], frame);
                if(!pair) return object;
                const amount = easedTimelineAmount(pair.amount, pair.from.interpolation);
                return {...object, transform:interpolateTimelineTransform(pair.from.transform, pair.to.transform, amount)};
            });
            const shots = (lastState.cameraShots || []).map(shot => {
                const pair = timelineFramePair(cameraTracks[shot.id], frame);
                if(!pair) return shot;
                const amount = easedTimelineAmount(pair.amount, pair.from.interpolation);
                const cameraState = interpolateTimelineCamera(pair.from.cameraState, pair.to.cameraState, amount);
                return {...shot, cameraState, target:cameraState.target.slice(0, 3)};
            });
            return {
                ...lastState,
                scene: {...lastState.scene, objects},
                cameraShots: shots,
                currentShotId:shotCutAtFrame(timeline?.shotCuts, frame, lastState.currentShotId),
                viewMode:(timeline?.shotCuts || []).some(cut => Number(cut?.frame) <= frame) ? 'shot' : lastState.viewMode
            };
        }

        function previewTimeline(timeline){
            if(!threeApi) return;
            const preview = timelinePreviewState(timeline);
            const activeShot = preview.cameraShots.find(shot => shot.id === preview.currentShotId);
            if(preview.viewMode === 'shot' && activeShot) workView = Cameras.viewFromState(preview, activeShot);
            renderScene(preview);
        }

        function applyTimelineFrame(timeline){
            if(!threeApi) return;
            const preview = timelinePreviewState(timeline);
            store.patchState({scene:preview.scene, cameraShots:preview.cameraShots});
            previewTimeline(timeline);
        }

        function clearTimelinePreview(){
            renderScene(lastState);
        }

        async function renderAnimationFrames({startFrame, endFrame, width, height, signal, onFrame} = {}){
            if(!threeApi?.renderer || typeof onFrame !== 'function'){
                throw new Error('Director3D viewport is not ready to render animation frames');
            }
            const timeline = lastState.scene?.timeline || {};
            const first = Math.max(0, Math.round(Number(startFrame ?? timeline.startFrame ?? 0)));
            const last = Math.max(first, Math.round(Number(endFrame ?? timeline.endFrame ?? timeline.durationFrames ?? first)));
            const total = last - first + 1;
            const size = viewportSize();
            const renderer = threeApi.renderer;
            const pixelRatio = renderer.getPixelRatio?.() || 1;
            const autoClear = renderer.autoClear;
            const originalWorkView = {
                target:workView.target.slice(0, 3),
                distance:workView.distance,
                yaw:workView.yaw,
                pitch:workView.pitch
            };
            const selectionVisibility = Array.from(threeApi.selectionBoxes.values()).map(box => [box, box.visible]);
            const cameraIconVisibility = Array.from(threeApi.shotCameraIcons.values()).map(icon => [icon, icon.visible]);
            try {
                renderer.setPixelRatio(1);
                renderer.setSize(Math.max(2, Number(width || size.width)), Math.max(2, Number(height || size.height)), false);
                for(let frame = first, index = 0; frame <= last; frame++, index++){
                    if(signal?.aborted) throw new DOMException('Animation export cancelled', 'AbortError');
                    const preview = timelinePreviewState({...timeline, currentFrame:frame});
                    const activeShot = preview.cameraShots.find(shot => shot.id === preview.currentShotId) || preview.cameraShots[0] || null;
                    workView = Cameras.viewFromState(preview, activeShot);
                    Cameras.applyWorkView(threeApi.THREE, threeApi.camera, workView, Number(width || size.width) / Math.max(1, Number(height || size.height)));
                    syncSceneObjects(preview);
                    selectionVisibility.forEach(([box]) => { box.visible = false; });
                    syncShotCameraIcons(preview);
                    threeApi.shotCameraIcons.forEach(icon => { icon.visible = false; });
                    renderer.autoClear = true;
                    renderer.render(threeApi.scene, threeApi.camera);
                    await onFrame(renderer.domElement, frame, index, total);
                }
            } finally {
                workView = originalWorkView;
                renderer.setPixelRatio(pixelRatio);
                renderer.setSize(size.width, size.height, false);
                renderer.autoClear = autoClear;
                selectionVisibility.forEach(([box, visible]) => { box.visible = visible; });
                cameraIconVisibility.forEach(([icon, visible]) => { icon.visible = visible; });
                renderScene(lastState);
            }
        }

        function persistActiveShotView(){
            if(lastState.viewMode !== 'shot' || !lastState.currentShotId) return;
            if(shotStore.get?.(lastState.currentShotId)?.locked) return;
            const cameraState = Cameras.cameraStateFromView(workView);
            shotStore.updateShot(lastState.currentShotId, {
                cameraState,
                target: cameraState.target
            });
        }

        function currentCameraStateFromActiveView(){
            if(['front', 'side', 'top'].includes(lastState.viewMode)){
                return Cameras.cameraStateFromOrthoView(lastState.viewMode, orthoViews);
            }
            return Cameras.cameraStateFromView(workView);
        }

        function exportFrameImage(){
            if(!threeApi?.renderer?.domElement) return '';
            renderScene(lastState);
            const canvas = threeApi.renderer.domElement;
            const size = viewportSize();
            const frame = lastLayout?.mode === 'shot' ? lastLayout.frames[0] : {x:0, y:0, width:size.width, height:size.height};
            const scaleX = canvas.width / size.width;
            const scaleY = canvas.height / size.height;
            const sourceX = Math.max(0, Math.round(frame.x * scaleX));
            const sourceY = Math.max(0, Math.round(frame.y * scaleY));
            const sourceW = Math.max(1, Math.round(frame.width * scaleX));
            const sourceH = Math.max(1, Math.round(frame.height * scaleY));
            const output = document.createElement('canvas');
            output.width = sourceW;
            output.height = sourceH;
            output.getContext('2d').drawImage(canvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
            return output.toDataURL('image/png');
        }

        function bindControls(){
            quadLayer.addEventListener('click', event => {
                if(lastState.viewMode !== 'quad') return;
                const label = event.target.closest?.('[data-director3d-quad-frame]');
                if(label) event.stopPropagation();
                if(expandedQuadView && label){
                    expandedQuadView = '';
                    renderScene(lastState);
                    return;
                }
                const frame = label
                    ? lastLayout?.frames?.find(item => item.id === label.dataset.director3dQuadFrame)
                    : frameFromPoint(event.clientX, event.clientY);
                if(!frame) return;
                expandedQuadView = frame.id;
                renderScene(lastState);
            });

            container.addEventListener('click', event => {
                if(isViewportControlEvent(event)) return;
                if(pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
                if(lastState.viewMode !== 'quad' || expandedQuadView){
                    if(!pickGizmoHandle(event) && !pickObjectFromViewport(event)){
                        clearViewportSelection();
                        renderScene(store.getState());
                    }
                    return;
                }
                const frame = frameFromPoint(event.clientX, event.clientY);
                if(!frame) return;
                expandedQuadView = frame.id;
                renderScene(lastState);
            });

            container.addEventListener('wheel', event => {
                if(isViewportControlEvent(event)) return;
                event.preventDefault();
                if(animationFrame){
                    global.cancelAnimationFrame?.(animationFrame);
                    animationFrame = 0;
                }
                const factor = event.deltaY > 0 ? 1.08 : 0.92;
                const quadViewId = quadViewFromPointer(event);
                if(quadViewId && quadViewId !== 'perspective'){
                    orthoViews[quadViewId].span = Math.max(1, Math.min(80, orthoViews[quadViewId].span * factor));
                    syncOrthoSpans(orthoViews[quadViewId].span);
                } else {
                    workView.distance = Math.max(1.5, Math.min(80, workView.distance * factor));
                }
                renderScene(lastState);
                persistActiveShotView();
            }, {passive:false});

            container.addEventListener('pointerdown', event => {
                if(isViewportControlEvent(event)) return;
                if(event.button === 0 || event.button === 1){
                    event.preventDefault();
                    if(animationFrame){
                        global.cancelAnimationFrame?.(animationFrame);
                        animationFrame = 0;
                    }
                    if(event.button === 0){
                        const handledTarget = beginShotTargetDrag(event);
                        if(handledTarget){
                            isDragging = true;
                            pointerStart = {x:event.clientX, y:event.clientY};
                            lastPointer = {x:event.clientX, y:event.clientY};
                            container.setPointerCapture?.(event.pointerId);
                            return;
                        }
                        const handledGizmo = beginGizmoAxisDrag(event) || consumeGizmoPointer(event);
                        if(handledGizmo){
                            isDragging = true;
                            pointerStart = {x:event.clientX, y:event.clientY};
                            lastPointer = {x:event.clientX, y:event.clientY};
                            container.setPointerCapture?.(event.pointerId);
                            return;
                        }
                    }
                    if(event.button === 0 && selectObjectFromViewport(event)){
                        dragMode = 'selectObject';
                        isDragging = true;
                        pointerStart = {x:event.clientX, y:event.clientY};
                        lastPointer = {x:event.clientX, y:event.clientY};
                        container.setPointerCapture?.(event.pointerId);
                        renderScene(store.getState());
                        return;
                    }
                    activeQuadFrameId = quadViewFromPointer(event);
                    if(event.button === 0) dragMode = activeQuadFrameId && activeQuadFrameId !== 'perspective' ? 'pan' : 'rotate';
                    if(event.button === 1) dragMode = 'pan';
                    if(dragMode === 'pan') host.style.cursor = 'grabbing';
                    isDragging = true;
                    pointerStart = {x:event.clientX, y:event.clientY};
                    lastPointer = {x:event.clientX, y:event.clientY};
                    container.setPointerCapture?.(event.pointerId);
                }
            });

            container.addEventListener('pointermove', event => {
                if(!isDragging || !lastPointer){
                    updateHoverCursor(event);
                    return;
                }
                event.preventDefault();
                const dx = event.clientX - lastPointer.x;
                const dy = event.clientY - lastPointer.y;
                lastPointer = {x:event.clientX, y:event.clientY};
                if(dragMode === 'gizmoAxis'){
                    updateGizmoAxisDrag(event);
                    renderScene(store.getState());
                    return;
                }
                if(dragMode === 'gizmoRotate'){
                    updateGizmoRotateDrag(event);
                    renderScene(store.getState());
                    return;
                }
                if(dragMode === 'gizmoScale'){
                    updateGizmoScaleDrag(event);
                    renderScene(store.getState());
                    return;
                }
                if(dragMode === 'shotTarget'){
                    updateShotTargetDrag(event);
                    renderScene(store.getState());
                    return;
                }
                if(dragMode === 'selectObject' || dragMode === 'gizmoButton' || dragMode === 'gizmoVisual') return;
                if(dragMode === 'rotate'){
                    if(!activeQuadFrameId || activeQuadFrameId === 'perspective'){
                        workView.yaw -= dx * 0.006;
                        workView.pitch += dy * 0.004;
                        workView.pitch = Math.max(Cameras.PITCH_MIN, Math.min(Cameras.PITCH_MAX, workView.pitch));
                    }
                }
                if(dragMode === 'pan'){
                    if(activeQuadFrameId && activeQuadFrameId !== 'perspective'){
                        panOrthoView(activeQuadFrameId, dx, dy);
                    } else {
                        const panScale = workView.distance * 0.0018;
                        const rightX = Math.cos(workView.yaw);
                        const rightZ = -Math.sin(workView.yaw);
                        workView.target[0] -= dx * panScale * rightX;
                        workView.target[2] -= dx * panScale * rightZ;
                        workView.target[1] += dy * panScale;
                        syncOrthoTargetsToWorkView();
                    }
                }
                renderScene(lastState);
                persistActiveShotView();
            });

            container.addEventListener('pointerup', event => {
                if((event.button === 0 && (dragMode === 'rotate' || dragMode === 'pan' || dragMode === 'gizmoAxis' || dragMode === 'gizmoRotate' || dragMode === 'gizmoScale' || dragMode === 'shotTarget' || dragMode === 'selectObject' || dragMode === 'gizmoButton' || dragMode === 'gizmoVisual')) || (event.button === 1 && dragMode === 'pan')){
                    const middleClick = event.button === 1 && pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 5;
                    const bakeObjectId = dragMode === 'gizmoRotate'
                        ? gizmoRotateDrag?.objectId
                        : (dragMode === 'gizmoScale' ? gizmoScaleDrag?.objectId : '');
                    if(bakeObjectId) bakeObjectTransform(bakeObjectId);
                    isDragging = false;
                    gizmoAxisDrag = null;
                    gizmoRotateDrag = null;
                    gizmoScaleDrag = null;
                    shotTargetDrag = null;
                    dragMode = '';
                    activeQuadFrameId = '';
                    lastPointer = null;
                    container.releasePointerCapture?.(event.pointerId);
                    if(middleClick){
                        handleMiddleClickViewToggle(event);
                        return;
                    }
                    updateHoverCursor(event);
                }
            });

            container.addEventListener('pointercancel', () => {
                isDragging = false;
                gizmoAxisDrag = null;
                gizmoRotateDrag = null;
                gizmoScaleDrag = null;
                shotTargetDrag = null;
                dragMode = '';
                activeQuadFrameId = '';
                activeRotateAxis = '';
                activeRotateVisualAxis = '';
                host.style.cursor = 'grab';
                lastPointer = null;
            });
        }

        const ready = import(THREE_URL).then(module => {
            if(disposed) return null;
            const THREE = module;
            fallback.dispose();
            const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
            renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.domElement.className = 'director3d-viewport-canvas';
            host.appendChild(renderer.domElement);
            const sceneApi = buildDemoScene(THREE);
            const gizmoScene = new THREE.Scene();
            const transformGizmo = Gizmo.createTransformGizmo(THREE);
            gizmoScene.add(transformGizmo);
            const size = viewportSize();
            const camera = Cameras.makeWorkCamera(THREE, workView, size.width / size.height);
            threeApi = {
                THREE,
                renderer,
                scene: sceneApi.scene,
                gizmoScene,
                objectGroup: sceneApi.objectGroup,
                transformGizmo,
                camera,
                raycaster: new THREE.Raycaster(),
                sceneObjects: new Map(),
                selectionBoxes: new Map(),
                shotCameraIcons: new Map(),
                shotTargetControls: new Map()
            };
            bindControls();
            renderScene(store.getState());
            return threeApi;
        }).catch(error => {
            fallback.render();
            console.warn('Director3D viewport failed to load Three.js', error);
            return null;
        });

        function sync(state){
            const previousShotViewId = activeShotViewId;
            const previousViewMode = lastState.viewMode;
            lastState = state || store.getState();
            if(['quad', 'front', 'side', 'top'].includes(lastState.viewMode) && !['quad', 'front', 'side', 'top'].includes(previousViewMode)) syncOrthoTargetsToWorkView();
            if(lastState.viewMode !== previousViewMode && ['panorama', 'front', 'side', 'top'].includes(lastState.viewMode) && previousViewMode !== 'shot'){
                if(previousViewMode === 'panorama'){
                    panoramaView = {
                        target: workView.target.slice(0, 3),
                        distance: workView.distance,
                        yaw: workView.yaw,
                        pitch: workView.pitch
                    };
                }
                const targetView = lastState.viewMode === 'panorama'
                    ? panoramaView
                    : Cameras.viewFromOrthoView(lastState.viewMode, orthoViews);
                viewModeTransition = true;
                animateWorkViewToView(targetView, {
                    onComplete(){
                        viewModeTransition = false;
                        renderScene(lastState);
                    }
                });
                return;
            }
            if(lastState.viewMode === 'shot' && previousViewMode !== 'shot'){
                panoramaView = {
                    target: workView.target.slice(0, 3),
                    distance: workView.distance,
                    yaw: workView.yaw,
                    pitch: workView.pitch
                };
            }
            if(previousViewMode === 'shot' && lastState.viewMode !== 'shot'){
                activeShotViewId = '';
                animateWorkViewToView({
                    target: panoramaView.target.slice(0, 3),
                    distance: panoramaView.distance,
                    yaw: panoramaView.yaw,
                    pitch: panoramaView.pitch
                });
                return;
            }
            renderOverlay(lastState);
            if(lastState.viewMode === 'shot' && lastState.currentShotId && previousShotViewId !== lastState.currentShotId){
                activeShotViewId = lastState.currentShotId;
                animateViewToShot(shotStore.current());
                return;
            }
            if(lastState.viewMode !== 'shot') activeShotViewId = '';
            if(threeApi) renderScene(lastState);
        }

        const unsubscribe = store.subscribe(sync);
        const resizeObserver = global.ResizeObserver ? new ResizeObserver(() => renderScene(lastState)) : null;
        resizeObserver?.observe(container);

        function dispose(){
            disposed = true;
            unsubscribe?.();
            resizeObserver?.disconnect?.();
            threeApi?.selectionBoxes?.forEach(box => SceneObjects.disposeSelectionBox(box));
            threeApi?.sceneObjects?.forEach(node => SceneObjects.disposeObjectNode(node));
            threeApi?.shotTargetControls?.forEach(control => CameraTargets.disposeTargetControl(control));
            threeApi?.renderer?.dispose?.();
            host.remove();
            maskApi.mask.remove();
            quadLayer.remove();
        }

        renderOverlay(lastState);

        return Object.freeze({
            ready,
            render: sync,
            resize(){ renderScene(lastState); },
            currentCameraState(){
                return currentCameraStateFromActiveView();
            },
            exportImage: exportFrameImage,
            previewTimeline,
            applyTimelineFrame,
            clearTimelinePreview,
            renderAnimationFrames,
            dispose
        });
    }

    global.Director3DViewportStage = Object.freeze({createStage});
})(window);


