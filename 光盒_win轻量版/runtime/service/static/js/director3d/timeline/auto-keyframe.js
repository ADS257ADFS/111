(function(global){
    'use strict';

    function signature(value){
        return JSON.stringify(value || null);
    }

    function changedExistingIds(previousItems, nextItems, property){
        const previousById = new Map((Array.isArray(previousItems) ? previousItems : []).map(item => [String(item?.id || ''), item]));
        return (Array.isArray(nextItems) ? nextItems : []).reduce((ids, item) => {
            const id = String(item?.id || '');
            const previous = previousById.get(id);
            if(id && previous && signature(previous[property]) !== signature(item?.[property])) ids.push(id);
            return ids;
        }, []);
    }

    function createAutoKeyframe({store, timelineStore} = {}){
        if(!store?.getState || !store?.subscribe || !timelineStore?.recordObjectKeyframe || !timelineStore?.recordCameraKeyframe){
            throw new Error('Director3DAutoKeyframe requires a store and timeline store');
        }

        let previousState = store.getState();
        let writing = false;

        function sync(nextState){
            const previous = previousState;
            previousState = nextState;
            if(writing || !nextState.scene?.timeline?.autoKeyframe) return;
            const objectIds = changedExistingIds(previous.scene?.objects, nextState.scene?.objects, 'transform');
            const shotIds = changedExistingIds(previous.cameraShots, nextState.cameraShots, 'cameraState');
            if(!objectIds.length && !shotIds.length) return;
            writing = true;
            try {
                objectIds.forEach(objectId => timelineStore.recordObjectKeyframe(objectId));
                shotIds.forEach(shotId => {
                    const shot = store.getState().cameraShots?.find(item => item?.id === shotId);
                    if(shot?.cameraState) timelineStore.recordCameraKeyframe(shotId, shot.cameraState);
                });
            } finally {
                writing = false;
                previousState = store.getState();
            }
        }

        const unsubscribe = store.subscribe(sync);
        return Object.freeze({dispose(){ unsubscribe?.(); }});
    }

    global.Director3DAutoKeyframe = Object.freeze({changedExistingIds, createAutoKeyframe});
})(window);
