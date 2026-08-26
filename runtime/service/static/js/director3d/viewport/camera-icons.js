(function(global){
    'use strict';

    function createCameraIcon(THREE){
        const group = new THREE.Group();
        group.name = 'shotCameraIcon';
        group.userData.directorRole = 'shotCameraIcon';
        const points = [
            -0.8, -0.45, -1.2, 0.8, -0.45, -1.2,
            0.8, -0.45, -1.2, 0.8, 0.45, -1.2,
            0.8, 0.45, -1.2, -0.8, 0.45, -1.2,
            -0.8, 0.45, -1.2, -0.8, -0.45, -1.2,
            0, 0, 0, -0.8, -0.45, -1.2,
            0, 0, 0, 0.8, -0.45, -1.2,
            0, 0, 0, 0.8, 0.45, -1.2,
            0, 0, 0, -0.8, 0.45, -1.2,
            0, 0, 0, 0, 0, -1.9
        ];
        const frustumGeometry = new THREE.BufferGeometry();
        frustumGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const material = new THREE.LineBasicMaterial({color: 0x8ec5ff, transparent: true, opacity: 0.95});
        const frustum = new THREE.LineSegments(frustumGeometry, material);
        frustum.name = 'shotCameraFrustum';
        const bodyPoints = [
            -0.28, -0.18, 0.06, 0.28, -0.18, 0.06,
            0.28, -0.18, 0.06, 0.28, 0.18, 0.06,
            0.28, 0.18, 0.06, -0.28, 0.18, 0.06,
            -0.28, 0.18, 0.06, -0.28, -0.18, 0.06,
            -0.28, -0.18, 0.36, 0.28, -0.18, 0.36,
            0.28, -0.18, 0.36, 0.28, 0.18, 0.36,
            0.28, 0.18, 0.36, -0.28, 0.18, 0.36,
            -0.28, 0.18, 0.36, -0.28, -0.18, 0.36,
            -0.28, -0.18, 0.06, -0.28, -0.18, 0.36,
            0.28, -0.18, 0.06, 0.28, -0.18, 0.36,
            0.28, 0.18, 0.06, 0.28, 0.18, 0.36,
            -0.28, 0.18, 0.06, -0.28, 0.18, 0.36,
            -0.18, 0.18, 0.16, -0.08, 0.32, 0.22,
            -0.08, 0.32, 0.22, 0.12, 0.32, 0.22,
            0.12, 0.32, 0.22, 0.22, 0.18, 0.16
        ];
        const cameraBodyGeometry = new THREE.BufferGeometry();
        cameraBodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bodyPoints, 3));
        const body = new THREE.LineSegments(cameraBodyGeometry, material);
        body.name = 'shotCameraBody';
        group.add(frustum, body);
        group.scale.setScalar(1.2);
        return group;
    }

    function updateCameraIcon(icon, shot){
        if(!icon || !shot) return;
        const cameraState = shot.cameraState || {};
        const position = Array.isArray(cameraState.position) ? cameraState.position : [4, 3, 6];
        const target = Array.isArray(shot.target) ? shot.target : (Array.isArray(cameraState.target) ? cameraState.target : [0, 0.8, 0]);
        icon.position.set(Number(position[0] || 0), Number(position[1] || 0), Number(position[2] || 0));
        icon.lookAt(Number(target[0] || 0), Number(target[1] || 0), Number(target[2] || 0));
    }

    global.Director3DViewportCameraIcons = Object.freeze({createCameraIcon, updateCameraIcon});
})(window);
