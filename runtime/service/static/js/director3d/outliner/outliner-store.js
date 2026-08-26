(function(global){
    'use strict';

    function clone(value){
        return JSON.parse(JSON.stringify(value));
    }

    function stableId(value){
        return String(value || '').trim();
    }

    function normalizeGroups(input, objects){
        const source = Array.isArray(input?.groups) ? input.groups : [];
        const objectIds = new Set((Array.isArray(objects) ? objects : []).map(object => stableId(object?.id)).filter(Boolean));
        const assigned = new Set();
        return source.reduce((groups, group, index) => {
            const id = stableId(group?.id);
            if(!id) return groups;
            const ids = (Array.isArray(group.objectIds) ? group.objectIds : []).map(stableId)
                .filter(objectId => objectIds.has(objectId) && !assigned.has(objectId));
            ids.forEach(objectId => assigned.add(objectId));
            groups.push({
                id,
                name:String(group?.name || `分组 ${index + 1}`),
                objectIds:ids,
                collapsed:Boolean(group?.collapsed)
            });
            return groups;
        }, []);
    }

    function createOutlinerStore({store} = {}){
        if(!store?.getState || !store?.patchState){
            throw new Error('Director3DOutlinerStore requires a Director3D store');
        }

        function state(){ return store.getState(); }

        function groups(){
            const current = state();
            return clone(normalizeGroups(current.scene?.extensions?.outliner, current.scene?.objects));
        }

        function commit(nextGroups){
            const current = state();
            const normalized = normalizeGroups({groups:nextGroups}, current.scene?.objects);
            store.patchState({
                scene: {
                    ...current.scene,
                    extensions: {
                        ...(current.scene?.extensions || {}),
                        outliner:{groups:normalized}
                    }
                }
            });
            return normalized;
        }

        function createGroup(name){
            const currentGroups = groups();
            const id = `group_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
            const nextName = String(name || `分组 ${currentGroups.length + 1}`);
            commit([...currentGroups, {id, name:nextName, objectIds:[], collapsed:false}]);
            return id;
        }

        function renameGroup(groupId, name){
            const id = stableId(groupId);
            const nextName = String(name || '').trim();
            const currentGroups = groups();
            if(!id || !nextName || !currentGroups.some(group => group.id === id)) return false;
            commit(currentGroups.map(group => group.id === id ? {...group, name:nextName} : group));
            return true;
        }

        function moveGroup(groupId, targetIndex){
            const id = stableId(groupId);
            const currentGroups = groups();
            const sourceIndex = currentGroups.findIndex(group => group.id === id);
            const requestedIndex = Number(targetIndex);
            if(sourceIndex < 0 || !Number.isInteger(requestedIndex)) return false;
            const nextIndex = Math.max(0, Math.min(currentGroups.length - 1, requestedIndex));
            if(sourceIndex === nextIndex) return false;
            const nextGroups = [...currentGroups];
            const [group] = nextGroups.splice(sourceIndex, 1);
            nextGroups.splice(nextIndex, 0, group);
            commit(nextGroups);
            return true;
        }

        function toggleCollapsed(groupId){
            const id = stableId(groupId);
            if(!id) return false;
            const currentGroups = groups();
            if(!currentGroups.some(group => group.id === id)) return false;
            commit(currentGroups.map(group => group.id === id ? {...group, collapsed:!group.collapsed} : group));
            return true;
        }

        function removeGroup(groupId){
            const id = stableId(groupId);
            const currentGroups = groups();
            if(!currentGroups.some(group => group.id === id)) return false;
            commit(currentGroups.filter(group => group.id !== id));
            return true;
        }

        function moveObjectToGroup(objectId, groupId){
            const object = stableId(objectId);
            const target = stableId(groupId);
            const currentGroups = groups();
            const exists = (state().scene?.objects || []).some(item => item?.id === object);
            if(!object || !exists || (target && !currentGroups.some(group => group.id === target))) return false;
            commit(currentGroups.map(group => {
                const objectIds = group.objectIds.filter(id => id !== object);
                return group.id === target ? {...group, objectIds:[...objectIds, object]} : {...group, objectIds};
            }));
            return true;
        }

        function removeObject(objectId){
            const object = stableId(objectId);
            if(!object) return false;
            const currentGroups = groups();
            if(!currentGroups.some(group => group.objectIds.includes(object))) return false;
            commit(currentGroups.map(group => ({...group, objectIds:group.objectIds.filter(id => id !== object)})));
            return true;
        }

        return Object.freeze({groups, createGroup, renameGroup, moveGroup, toggleCollapsed, removeGroup, moveObjectToGroup, removeObject});
    }

    global.Director3DOutlinerStore = Object.freeze({normalizeGroups, createOutlinerStore});
})(window);
