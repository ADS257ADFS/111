(function(global){
    'use strict';

    const MIN_OBJECT_SCALE = 0.02;

    function number(value, fallback = 0){
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function vector3(value, fallback = [0, 0, 0]){
        return [0, 1, 2].map(index => number(value?.[index], fallback[index]));
    }

    function quaternion(value){
        return [
            number(value?.[0], 0),
            number(value?.[1], 0),
            number(value?.[2], 0),
            number(value?.[3], 1)
        ];
    }

    function scale3(value){
        return vector3(value, [1, 1, 1]).map(component => Math.max(MIN_OBJECT_SCALE, component));
    }

    function color(value, fallback = '#d8dbe0'){
        const normalized = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
    }

    function cloneSceneValue(value){
        if(Array.isArray(value)) return value.map(cloneSceneValue);
        if(value && typeof value === 'object'){
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSceneValue(item)]));
        }
        return value;
    }

    function selectionFor(objectIds, lastObjectId){
        const ids = Array.isArray(objectIds)
            ? objectIds.map(id => String(id || '')).filter(Boolean)
            : [];
        const last = String(lastObjectId || ids[ids.length - 1] || '');
        return {
            objectIds: ids,
            lastObjectId: ids.includes(last) ? last : (ids[ids.length - 1] || '')
        };
    }

    function createSceneActions({store} = {}){
        if(!store?.getState || !store?.patchState){
            throw new Error('Director3DSceneActions requires a Director3D store');
        }

        function state(){
            return store.getState();
        }

        function commitObjects(nextObjects, selection){
            const current = state();
            const patch = {
                scene: {
                    ...current.scene,
                    objects: Array.isArray(nextObjects) ? nextObjects : current.scene?.objects || []
                }
            };
            if(selection) patch.selection = selection;
            return store.patchState(patch);
        }

        function updateObject(objectId, updater){
            const current = state();
            const id = String(objectId || '');
            const objects = Array.isArray(current.scene?.objects) ? current.scene.objects : [];
            let changed = false;
            const next = objects.map(object => {
                if(!object || object.id !== id || object.locked) return object;
                const result = updater(object, current);
                if(!result || result === object) return object;
                changed = true;
                return result;
            });
            return changed ? commitObjects(next) : current;
        }

        function addObject(object, {select = true} = {}){
            if(!object?.id) throw new Error('Director3DSceneActions.addObject requires a stable object id');
            const current = state();
            const objects = Array.isArray(current.scene?.objects) ? current.scene.objects : [];
            const next = [...objects, object];
            return commitObjects(next, select ? selectionFor([object.id], object.id) : null);
        }

        function duplicateObject(objectId, {id, name} = {}){
            const current = state();
            const sourceId = String(objectId || '');
            const copyId = String(id || '');
            const objects = Array.isArray(current.scene?.objects) ? current.scene.objects : [];
            const source = objects.find(object => object?.id === sourceId);
            if(!source || !copyId || copyId === sourceId || objects.some(object => object?.id === copyId)) return current;
            const copy = {
                ...cloneSceneValue(source),
                id: copyId,
                name: String(name || `${source.name || 'Object'} copy`)
            };
            return commitObjects([...objects, copy], selectionFor([copy.id], copy.id));
        }

        function removeObject(objectId){
            const current = state();
            const id = String(objectId || '');
            const objects = Array.isArray(current.scene?.objects) ? current.scene.objects : [];
            const next = objects.filter(object => object?.id !== id);
            if(next.length === objects.length) return current;
            const previousSelection = current.selection?.objectIds || [];
            const selection = selectionFor(previousSelection.filter(selectedId => selectedId !== id));
            return commitObjects(next, selection);
        }

        function setSelection(objectIds, lastObjectId){
            return store.patchState({selection: selectionFor(objectIds, lastObjectId)});
        }

        function selectObject(objectId){
            const id = String(objectId || '');
            return setSelection(id ? [id] : [], id);
        }

        function setObjectPosition(objectId, position){
            const nextPosition = vector3(position, [0, 0, 0]);
            return updateObject(objectId, object => ({
                ...object,
                transform: {...object.transform, position: nextPosition}
            }));
        }

        function setObjectRotation(objectId, rotation){
            const nextRotation = quaternion(rotation);
            return updateObject(objectId, object => ({
                ...object,
                transform: {...object.transform, rotation: nextRotation}
            }));
        }

        function setObjectScale(objectId, scale){
            const nextScale = scale3(scale);
            return updateObject(objectId, object => ({
                ...object,
                transform: {...object.transform, scale: nextScale}
            }));
        }

        function setObjectScaleAndPosition(objectId, scale, position){
            const nextScale = scale3(scale);
            const nextPosition = vector3(position, [0, 0, 0]);
            return updateObject(objectId, object => ({
                ...object,
                transform: {...object.transform, scale: nextScale, position: nextPosition}
            }));
        }

        function resetObjectTransform(objectId){
            return updateObject(objectId, object => ({
                ...object,
                transform: {
                    ...object.transform,
                    position: [0, 0, 0],
                    rotation: [0, 0, 0, 1],
                    scale: [1, 1, 1]
                }
            }));
        }

        function bakeObjectTransform(objectId, bakedMatrix){
            if(!Array.isArray(bakedMatrix) || bakedMatrix.length !== 16) return state();
            const nextMatrix = bakedMatrix.map(value => number(value, 0));
            return updateObject(objectId, object => ({
                ...object,
                transform: {
                    ...object.transform,
                    bakedMatrix: nextMatrix,
                    rotation: [0, 0, 0, 1],
                    scale: [1, 1, 1]
                }
            }));
        }

        function setObjectVisible(objectId, visible){
            return updateObject(objectId, object => ({...object, visible: Boolean(visible)}));
        }

        function setObjectLocked(objectId, locked){
            const current = state();
            const id = String(objectId || '');
            const objects = Array.isArray(current.scene?.objects) ? current.scene.objects : [];
            let changed = false;
            const next = objects.map(object => {
                if(!object || object.id !== id) return object;
                changed = true;
                return {...object, locked: Boolean(locked)};
            });
            return changed ? commitObjects(next) : current;
        }

        function setObjectColor(objectId, value){
            const nextColor = color(value);
            return updateObject(objectId, object => ({
                ...object,
                metadata: {...(object.metadata || {}), color:nextColor}
            }));
        }

        return Object.freeze({
            addObject,
            duplicateObject,
            removeObject,
            setSelection,
            selectObject,
            setObjectPosition,
            setObjectRotation,
            setObjectScale,
            setObjectScaleAndPosition,
            resetObjectTransform,
            bakeObjectTransform,
            setObjectVisible,
            setObjectLocked,
            setObjectColor
        });
    }

    global.Director3DSceneActions = Object.freeze({
        MIN_OBJECT_SCALE,
        color,
        createSceneActions
    });
})(window);
