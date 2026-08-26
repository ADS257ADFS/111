(function(global){
    'use strict';

    const PITCH_MIN = -Math.PI / 3;
    const PITCH_MAX = Math.PI / 2;

    function viewFromState(state, shot){
        const cameraState = shot?.cameraState || state.camera || {};
        const position = Array.isArray(cameraState.position) ? cameraState.position : [4, 3, 8];
        const target = Array.isArray(shot?.target) ? shot.target : (Array.isArray(cameraState.target) ? cameraState.target : [0, 0.75, 0]);
        const dx = Number(position[0] || 0) - Number(target[0] || 0);
        const dy = Number(position[1] || 0) - Number(target[1] || 0);
        const dz = Number(position[2] || 0) - Number(target[2] || 0);
        const distance = Math.max(2, Math.sqrt(dx * dx + dy * dy + dz * dz));
        return {
            target: [Number(target[0] || 0), Number(target[1] || 0), Number(target[2] || 0)],
            distance,
            yaw: Math.atan2(dx, dz),
            pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.asin(dy / distance)))
        };
    }

    function cameraStateFromView(view){
        const cp = Math.cos(view.pitch);
        const x = view.target[0] + Math.sin(view.yaw) * cp * view.distance;
        const y = view.target[1] + Math.sin(view.pitch) * view.distance;
        const z = view.target[2] + Math.cos(view.yaw) * cp * view.distance;
        return {
            position: [x, y, z],
            target: view.target.slice(0, 3),
            fov: 45,
            near: 0.1,
            far: 1000
        };
    }

    function cameraStateFromOrthoView(viewId, orthoViews){
        const view = orthoViews[viewId];
        const target = Array.isArray(view?.target) ? view.target.slice(0, 3) : [0, 0.7, 0];
        const distance = Math.max(4, Number(view?.span || 8) * 1.4);
        let position = [target[0], target[1], target[2] + distance];
        if(viewId === 'side') position = [target[0] + distance, target[1], target[2]];
        if(viewId === 'top') position = [target[0], target[1] + distance, target[2] + 0.001];
        return {
            position,
            target,
            fov: 45,
            near: 0.1,
            far: 1000
        };
    }

    function viewFromOrthoView(viewId, orthoViews){
        const view = orthoViews[viewId];
        const target = Array.isArray(view?.target) ? view.target.slice(0, 3) : [0, 0.7, 0];
        const distance = Math.max(4, Number(view?.span || 8) * 1.4);
        if(viewId === 'side') return {target, distance, yaw: Math.PI / 2, pitch: 0};
        if(viewId === 'top') return {target, distance, yaw: 0, pitch: PITCH_MAX};
        return {target, distance, yaw: 0, pitch: 0};
    }

    function applyWorkView(THREE, camera, view, aspect){
        camera.aspect = aspect || 16 / 9;
        camera.near = 0.1;
        camera.far = 1000;
        const cp = Math.cos(view.pitch);
        const x = view.target[0] + Math.sin(view.yaw) * cp * view.distance;
        const y = view.target[1] + Math.sin(view.pitch) * view.distance;
        const z = view.target[2] + Math.cos(view.yaw) * cp * view.distance;
        camera.position.set(x, y, z);
        camera.lookAt(new THREE.Vector3(view.target[0], view.target[1], view.target[2]));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
    }

    function makeWorkCamera(THREE, view, aspect){
        const camera = new THREE.PerspectiveCamera(45, aspect || 16 / 9, 0.1, 1000);
        applyWorkView(THREE, camera, view, aspect);
        return camera;
    }

    function makeOrthoCamera(THREE, frame, kind, view = {}){
        const aspect = frame.width / Math.max(1, frame.height);
        const span = Number(view.span || 8);
        const target = Array.isArray(view.target) ? view.target : [0, 0.7, 0];
        const camera = new THREE.OrthographicCamera(
            -span * aspect / 2,
            span * aspect / 2,
            span / 2,
            -span / 2,
            0.1,
            1000
        );
        if(kind === 'top') camera.position.set(target[0], target[1] + 8, target[2] + 0.001);
        else if(kind === 'front') camera.position.set(target[0], target[1], target[2] + 8);
        else camera.position.set(target[0] + 8, target[1], target[2]);
        camera.lookAt(target[0], target[1], target[2]);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        return camera;
    }

    function quadCameraForFrame(THREE, frame, perspectiveCamera, orthoViews){
        if(frame.id === 'perspective') return perspectiveCamera;
        return makeOrthoCamera(THREE, frame, frame.id, orthoViews[frame.id]);
    }

    global.Director3DViewportCameras = Object.freeze({
        PITCH_MIN,
        PITCH_MAX,
        viewFromState,
        cameraStateFromView,
        cameraStateFromOrthoView,
        viewFromOrthoView,
        applyWorkView,
        makeWorkCamera,
        makeOrthoCamera,
        quadCameraForFrame
    });
})(window);
