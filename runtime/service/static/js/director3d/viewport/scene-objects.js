(function(global){
    'use strict';

    function materialColorForObject(object){
        const color = object?.metadata?.color || object?.material?.color || '#d8dbe0';
        if(typeof color === 'number') return color;
        if(typeof color === 'string' && color.trim()) return color;
        return '#d8dbe0';
    }

    function createReadableMaterial(THREE, object){
        return new THREE.MeshLambertMaterial({
            color: materialColorForObject(object),
            emissive: 0x000000
        });
    }

    function setMeshFlags(node){
        node.traverse?.(child => {
            if(!child.isMesh) return;
            child.castShadow = true;
            child.receiveShadow = true;
        });
    }

    function bakedMatrixForObject(THREE, object){
        const matrix = new THREE.Matrix4();
        const values = object?.transform?.bakedMatrix;
        if(Array.isArray(values) && values.length === 16){
            matrix.fromArray(values.map(value => Number(value) || 0));
        }
        return matrix;
    }

    function applyBakedMatrix(THREE, node, object){
        const bakedMatrix = bakedMatrixForObject(THREE, object);
        if(bakedMatrix.equals(new THREE.Matrix4())) return;
        node.updateWorldMatrix?.(true, true);
        const rootInverse = new THREE.Matrix4().copy(node.matrixWorld).invert();
        node.traverse?.(child => {
            if(!child.isMesh || !child.geometry) return;
            child.updateWorldMatrix?.(true, false);
            const localMatrix = new THREE.Matrix4().multiplyMatrices(rootInverse, child.matrixWorld);
            const geometryMatrix = bakedMatrix.clone().multiply(localMatrix);
            child.geometry.applyMatrix4(geometryMatrix);
            child.geometry.computeBoundingBox?.();
            child.geometry.computeBoundingSphere?.();
            child.geometry.computeVertexNormals?.();
            child.position.set(0, 0, 0);
            child.quaternion.identity();
            child.scale.set(1, 1, 1);
        });
    }

    function createLowPolyMannequin(THREE, object){
        const group = new THREE.Group();
        const material = createReadableMaterial(THREE, object);
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.78, 4, 8), material);
        torso.position.y = 0.82;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), material.clone());
        head.position.y = 1.52;
        const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.28), material.clone());
        hips.position.y = 0.34;
        const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.62, 8), material.clone());
        leftLeg.position.set(-0.13, 0, 0);
        const rightLeg = leftLeg.clone();
        rightLeg.material = material.clone();
        rightLeg.position.x = 0.13;
        const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.62, 8), material.clone());
        leftArm.position.set(-0.42, 0.86, 0);
        leftArm.rotation.z = -0.16;
        const rightArm = leftArm.clone();
        rightArm.material = material.clone();
        rightArm.position.x = 0.42;
        rightArm.rotation.z = 0.16;
        group.add(torso, head, hips, leftLeg, rightLeg, leftArm, rightArm);
        setMeshFlags(group);
        return group;
    }

    function createPrimitiveObject(THREE, object){
        const material = createReadableMaterial(THREE, object);
        let mesh = null;
        if(object.geometryRef === 'primitive:mannequin'){
            mesh = createLowPolyMannequin(THREE, object);
            applyBakedMatrix(THREE, mesh, object);
            return mesh;
        }
        if(object.geometryRef === 'primitive:cylinder') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12), material);
        else if(object.geometryRef === 'primitive:sphere') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), material);
        else if(object.geometryRef === 'primitive:plane') mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 2.2), material);
        else if(object.geometryRef === 'primitive:wall') mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.12), material);
        else mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), material);
        applyBakedMatrix(THREE, mesh, object);
        setMeshFlags(mesh);
        return mesh;
    }

    function applySceneObjectTransform(THREE, node, object){
        const transform = object.transform || {};
        const position = Array.isArray(transform.position) ? transform.position : [0, 0, 0];
        const rotation = Array.isArray(transform.rotation) ? transform.rotation : [0, 0, 0, 1];
        const scale = Array.isArray(transform.scale) ? transform.scale : [1, 1, 1];
        node.position.set(Number(position[0] || 0), Number(position[1] || 0), Number(position[2] || 0));
        node.scale.set(
            Math.max(0.001, Number(scale[0] || 1)),
            Math.max(0.001, Number(scale[1] || 1)),
            Math.max(0.001, Number(scale[2] || 1))
        );
        if(rotation.length === 4) node.quaternion.set(
            Number(rotation[0] || 0),
            Number(rotation[1] || 0),
            Number(rotation[2] || 0),
            Number(rotation[3] || 1)
        );
        else node.rotation.set(Number(rotation[0] || 0), Number(rotation[1] || 0), Number(rotation[2] || 0));
        node.visible = object.visible !== false;
    }

    function applyObjectColor(node, object){
        const color = materialColorForObject(object);
        node.traverse?.(child => {
            if(!child.isMesh || !child.material) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => material?.color?.set?.(color));
        });
    }

    function applyObjectSelection(THREE, node, selected){
        node.traverse?.(child => {
            if(!child.isMesh || !child.material) return;
            if(child.material.emissive) child.material.emissive.setHex(selected ? 0x2f6bff : 0x000000);
            child.material.opacity = selected ? 0.96 : 1;
            child.material.transparent = selected;
        });
    }

    function disposeObjectNode(node){
        node.traverse?.(child => {
            child.geometry?.dispose?.();
            if(Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
            else child.material?.dispose?.();
        });
    }

    function disposeSelectionBox(box){
        box?.geometry?.dispose?.();
        if(Array.isArray(box?.material)) box.material.forEach(material => material.dispose?.());
        else box?.material?.dispose?.();
    }

    global.Director3DSceneObjects = Object.freeze({
        materialColorForObject,
        createReadableMaterial,
        setMeshFlags,
        createLowPolyMannequin,
        createPrimitiveObject,
        applySceneObjectTransform,
        applyObjectColor,
        applyObjectSelection,
        disposeObjectNode,
        disposeSelectionBox
    });
})(window);
