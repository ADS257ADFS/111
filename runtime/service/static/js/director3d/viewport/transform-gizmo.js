(function(global){
    'use strict';

    const RENDER_ORDER = 80;
    const ROTATE_COLORS = Object.freeze({x: 0xef4444, y: 0x22c55e, z: 0x3b82f6});
    const ROTATE_AXIS_BINDINGS = Object.freeze({x: 'x', y: 'z', z: 'y'});

    function modeColor(mode){
        if(mode === 'move') return 0x111827;
        return mode === 'rotate' ? 0xf59e0b : 0x06b6d4;
    }

    function material(THREE, color){
        return new THREE.MeshBasicMaterial({color, depthTest: false, depthWrite: false});
    }

    function hitMaterial(THREE){
        return new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide});
    }

    function prepare(part, role, axis){
        part.renderOrder = RENDER_ORDER;
        part.frustumCulled = false;
        if(part.material){
            part.material.depthTest = false;
            part.material.depthWrite = false;
        }
        if(role) part.userData.gizmoRole = role;
        if(axis) part.userData.axis = axis;
        return part;
    }

    function createLine(THREE, color, points){
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineDashedMaterial({
            color,
            dashSize: 0.08,
            gapSize: 0.055,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.92
        });
        const line = prepare(new THREE.Line(geometry, lineMaterial), '', '');
        line.computeLineDistances();
        return line;
    }

    function setLinePoints(THREE, line, points){
        if(!line?.geometry?.setFromPoints) return;
        line.geometry.dispose?.();
        line.geometry = new THREE.BufferGeometry().setFromPoints(points);
        line.computeLineDistances?.();
    }

    function selectionBoxPoints(THREE, bounds){
        const {min, max} = bounds;
        const corners = [
            new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z),
            new THREE.Vector3(max.x, min.y, max.z), new THREE.Vector3(min.x, min.y, max.z),
            new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(max.x, max.y, min.z),
            new THREE.Vector3(max.x, max.y, max.z), new THREE.Vector3(min.x, max.y, max.z)
        ];
        return [
            corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0],
            corners[4], corners[5], corners[5], corners[6], corners[6], corners[7], corners[7], corners[4],
            corners[0], corners[4], corners[1], corners[5], corners[2], corners[6], corners[3], corners[7]
        ];
    }

    function createSelectionBoxLine(THREE, bounds){
        const geometry = new THREE.BufferGeometry().setFromPoints(selectionBoxPoints(THREE, bounds));
        const boxMaterial = new THREE.LineBasicMaterial({color: 0x2563eb, depthTest: false, depthWrite: false, transparent: true, opacity: 0.92});
        const box = prepare(new THREE.LineSegments(geometry, boxMaterial), '', '');
        box.renderOrder = RENDER_ORDER - 1;
        return box;
    }

    function setSelectionBoxBounds(THREE, box, bounds){
        box.geometry?.dispose?.();
        box.geometry = new THREE.BufferGeometry().setFromPoints(selectionBoxPoints(THREE, bounds));
    }

    function createCircleLine(THREE, color, axis){
        const points = [];
        for(let index = 0; index <= 128; index++){
            const angle = (index / 128) * Math.PI * 2;
            const x = Math.cos(angle) * 1.15;
            const y = Math.sin(angle) * 1.15;
            if(axis === 'x') points.push(new THREE.Vector3(0, y, x));
            else if(axis === 'y') points.push(new THREE.Vector3(x, 0, y));
            else points.push(new THREE.Vector3(x, y, 0));
        }
        const line = createLine(THREE, color, points);
        line.userData.rotateAxis = axis;
        return line;
    }

    function createAxisHandle(THREE, axis, color){
        const group = new THREE.Group();
        group.name = `gizmoMoveAxis:${axis}`;
        group.userData.axis = axis;
        const shaft = createLine(THREE, color, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.82, 0)]);
        const arrow = prepare(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 14), material(THREE, color)), 'moveAxis', axis);
        arrow.position.y = 0.9;
        group.add(shaft, arrow);
        if(axis === 'x') group.rotation.z = -Math.PI / 2;
        if(axis === 'z') group.rotation.x = Math.PI / 2;
        return group;
    }

    function createRotateArrow(THREE, visualAxis, rotateAxis, color, position, rotation){
        const group = new THREE.Group();
        group.name = `gizmoRotateArrow:${visualAxis}`;
        group.position.set(position[0], position[1], position[2]);
        group.rotation.set(rotation[0], rotation[1], rotation[2]);
        group.userData.visualAxis = visualAxis;
        group.userData.axis = rotateAxis;
        const partMaterial = material(THREE, color);
        const center = prepare(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), partMaterial), 'rotateArrow', rotateAxis);
        const front = prepare(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 14), partMaterial), 'rotateArrow', rotateAxis);
        const back = prepare(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 14), partMaterial), 'rotateArrow', rotateAxis);
        [center, front, back].forEach(part => { part.userData.visualAxis = visualAxis; });
        front.position.y = 0.26;
        back.position.y = -0.26;
        back.rotation.x = Math.PI;
        group.add(center, front, back);
        return group;
    }

    function createModeButton(THREE, mode, x){
        const button = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), material(THREE, modeColor(mode)));
        button.position.set(x, 1.18, 0);
        button.name = `gizmoModeButton:${mode}`;
        button.userData.gizmoRole = 'modeButton';
        button.userData.mode = mode;
        button.renderOrder = 31;
        return button;
    }

    function setModeButtonMode(button, mode){
        if(!button) return;
        button.name = `gizmoModeButton:${mode}`;
        button.userData.mode = mode;
        button.material?.color?.setHex?.(modeColor(mode));
    }

    function createTransformGizmo(THREE){
        const root = new THREE.Group();
        root.name = 'director3dTransformGizmo';
        root.visible = false;
        const moveGroup = new THREE.Group();
        moveGroup.name = 'gizmoMoveGroup';
        moveGroup.add(createAxisHandle(THREE, 'x', 0xef4444), createAxisHandle(THREE, 'y', 0x22c55e), createAxisHandle(THREE, 'z', 0x3b82f6));

        const rotateGroup = new THREE.Group();
        rotateGroup.name = 'gizmoRotateGroup';
        Object.entries(ROTATE_COLORS).forEach(([visualAxis, color]) => {
            const rotateAxis = ROTATE_AXIS_BINDINGS[visualAxis] || visualAxis;
            const ring = createCircleLine(THREE, color, rotateAxis);
            ring.userData.rotateAxis = rotateAxis;
            ring.userData.visualAxis = visualAxis;
            const hitRing = prepare(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 96), hitMaterial(THREE)), 'visualOnly', rotateAxis);
            hitRing.userData.rotateAxis = rotateAxis;
            hitRing.userData.visualAxis = visualAxis;
            if(rotateAxis === 'x') hitRing.rotation.y = Math.PI / 2;
            if(rotateAxis === 'y') hitRing.rotation.x = Math.PI / 2;
            rotateGroup.add(ring, hitRing);
        });
        rotateGroup.add(
            createRotateArrow(THREE, 'x', ROTATE_AXIS_BINDINGS.x, ROTATE_COLORS.x, [-1.15, -0.78, 0], [0, 0, Math.PI]),
            createRotateArrow(THREE, 'y', ROTATE_AXIS_BINDINGS.y, ROTATE_COLORS.y, [0, 1.15, 0], [0, 0, 0]),
            createRotateArrow(THREE, 'z', ROTATE_AXIS_BINDINGS.z, ROTATE_COLORS.z, [1.15, -0.1, 0], [0, 0, -Math.PI / 2])
        );
        rotateGroup.userData.baseQuaternion = rotateGroup.quaternion.clone();
        rotateGroup.add(prepare(new THREE.Mesh(new THREE.SphereGeometry(1.22, 16, 10), hitMaterial(THREE)), 'visualOnly', ''));

        const scaleGroup = new THREE.Group();
        scaleGroup.name = 'gizmoScaleGroup';
        const scaleHandles = [];
        const scaleFrameLines = [
            createLine(THREE, 0x06b6d4, [new THREE.Vector3(), new THREE.Vector3()]),
            createLine(THREE, 0xef4444, [new THREE.Vector3(), new THREE.Vector3()]),
            createLine(THREE, 0x06b6d4, [new THREE.Vector3(), new THREE.Vector3()]),
            createLine(THREE, 0xef4444, [new THREE.Vector3(), new THREE.Vector3()]),
            createLine(THREE, 0x22c55e, [new THREE.Vector3(), new THREE.Vector3()])
        ];
        scaleFrameLines.forEach(line => scaleGroup.add(line));
        [
            ['corner:nw', 'corner', -1, -1, 0x06b6d4], ['corner:ne', 'corner', 1, -1, 0x06b6d4],
            ['corner:se', 'corner', 1, 1, 0x06b6d4], ['corner:sw', 'corner', -1, 1, 0x06b6d4],
            ['edge:n', 'edge', 0, -1, 0x22c55e, 'z'], ['edge:e', 'edge', 1, 0, 0xef4444, 'x'],
            ['edge:s', 'edge', 0, 1, 0x22c55e, 'z'], ['edge:w', 'edge', -1, 0, 0xef4444, 'x'],
            ['height:top', 'height', 0, 0, 0x1d4ed8, 'y']
        ].forEach(([id, scaleMode, signX, signZ, color, axis]) => {
            const size = scaleMode === 'height' ? 0.22 : 0.13;
            const handle = prepare(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material(THREE, color)), 'scaleHandle', axis || '');
            handle.name = `gizmoScaleHandle:${id}`;
            handle.userData.scaleMode = scaleMode;
            handle.userData.signX = signX;
            handle.userData.signZ = signZ;
            handle.userData.axis = axis || '';
            scaleHandles.push(handle);
            scaleGroup.add(handle);
        });
        scaleGroup.userData.scaleHandles = scaleHandles;
        scaleGroup.userData.scaleFrameLines = scaleFrameLines;

        const buttons = new THREE.Group();
        buttons.name = 'gizmoModeButtons';
        buttons.add(createModeButton(THREE, 'rotate', -0.16), createModeButton(THREE, 'scale', 0.16));
        root.add(moveGroup, rotateGroup, scaleGroup, buttons);
        root.userData.gizmoHandles = {moveGroup, rotateGroup, scaleGroup, buttons};
        return root;
    }

    global.Director3DTransformGizmo = Object.freeze({
        ROTATE_COLORS,
        ROTATE_AXIS_BINDINGS,
        createTransformGizmo,
        createSelectionBoxLine,
        setSelectionBoxBounds,
        setLinePoints,
        setModeButtonMode
    });
})(window);
