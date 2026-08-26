(function(global){
    'use strict';

    const COLOR = 0xf59e0b;

    function vector(input, fallback = [0, 0.8, 0]){
        return [0, 1, 2].map(index => Number(input?.[index] ?? fallback[index] ?? 0));
    }

    function targetForShot(shot){
        return vector(shot?.target, vector(shot?.cameraState?.target));
    }

    function dragPlaneNormal(viewId, rayDirection){
        if(viewId === 'front') return [0, 0, 1];
        if(viewId === 'side') return [1, 0, 0];
        if(viewId === 'top') return [0, 1, 0];
        return vector(rayDirection, [0, 0, -1]);
    }

    function lineGeometry(THREE, from, to){
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([...from, ...to], 3));
        return geometry;
    }

    function createTargetControl(THREE){
        const group = new THREE.Group();
        group.name = 'shotTargetControl';
        const material = new THREE.LineBasicMaterial({color:COLOR, transparent:true, opacity:0.9, depthTest:false, depthWrite:false});
        const line = new THREE.LineSegments(lineGeometry(THREE, [0, 0, 0], [0, 0, 0]), material);
        line.name = 'shotTargetLine';
        line.renderOrder = 8400;

        const marker = new THREE.Group();
        marker.name = 'shotTargetMarker';
        const markerGeometry = new THREE.OctahedronGeometry(0.16, 0);
        const markerEdges = new THREE.EdgesGeometry(markerGeometry);
        markerGeometry.dispose?.();
        const edges = new THREE.LineSegments(markerEdges, material);
        edges.renderOrder = 8401;
        const cross = new THREE.LineSegments(lineGeometry(THREE, [-0.27, 0, 0], [0.27, 0, 0]), material);
        const crossY = new THREE.LineSegments(lineGeometry(THREE, [0, -0.27, 0], [0, 0.27, 0]), material);
        const crossZ = new THREE.LineSegments(lineGeometry(THREE, [0, 0, -0.27], [0, 0, 0.27]), material);
        cross.renderOrder = crossY.renderOrder = crossZ.renderOrder = 8401;
        const hit = new THREE.Mesh(
            new THREE.SphereGeometry(0.52, 12, 8),
            new THREE.MeshBasicMaterial({transparent:true, opacity:0.001, depthTest:false, depthWrite:false})
        );
        hit.name = 'shotTargetHit';
        hit.userData.targetRole = 'shotTarget';
        marker.add(edges, cross, crossY, crossZ, hit);
        group.add(line, marker);
        group.userData.line = line;
        group.userData.marker = marker;
        group.userData.hit = hit;
        return group;
    }

    function updateLine(THREE, line, from, to){
        const position = line.geometry.getAttribute?.('position');
        if(!position?.setXYZ) return;
        position.setXYZ(0, from[0], from[1], from[2]);
        position.setXYZ(1, to[0], to[1], to[2]);
        position.needsUpdate = true;
    }

    function updateTargetControl(THREE, control, shot, displayScale = 1){
        if(!control || !shot) return;
        const position = vector(shot.cameraState?.position, [4, 3, 6]);
        const target = targetForShot(shot);
        updateLine(THREE, control.userData.line, position, target);
        control.userData.marker.position.set(target[0], target[1], target[2]);
        control.userData.marker.scale.setScalar(Math.max(0.8, Number(displayScale) || 1));
        control.userData.hit.userData.shotId = String(shot.id || '');
        control.userData.hit.userData.locked = Boolean(shot.locked);
    }

    function disposeTargetControl(control){
        const geometries = new Set();
        const materials = new Set();
        control?.traverse?.(item => {
            if(item.geometry) geometries.add(item.geometry);
            const values = Array.isArray(item.material) ? item.material : [item.material];
            values.filter(Boolean).forEach(material => materials.add(material));
        });
        geometries.forEach(geometry => geometry.dispose?.());
        materials.forEach(material => material.dispose?.());
    }

    global.Director3DViewportCameraTargets = Object.freeze({
        targetForShot,
        dragPlaneNormal,
        createTargetControl,
        updateTargetControl,
        disposeTargetControl
    });
})(window);
