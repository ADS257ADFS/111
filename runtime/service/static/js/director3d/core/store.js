(function(global){
    'use strict';

    function clone(value){
        return JSON.parse(JSON.stringify(value));
    }

    function createStore(initialState){
        let state = global.Director3DSchema.migrateDirector3DState(initialState);
        const listeners = new Set();

        function notify(){
            const snapshot = getState();
            listeners.forEach(listener => listener(snapshot));
        }

        function getState(){
            return clone(state);
        }

        function replaceState(nextState){
            state = global.Director3DSchema.migrateDirector3DState(nextState);
            state.metadata.updatedAt = Date.now();
            notify();
            return getState();
        }

        function patchState(patch){
            state = global.Director3DSchema.migrateDirector3DState({
                ...state,
                ...(patch || {}),
                metadata: {
                    ...(state.metadata || {}),
                    ...((patch || {}).metadata || {}),
                    updatedAt: Date.now()
                }
            });
            notify();
            return getState();
        }

        function subscribe(listener){
            if(typeof listener !== 'function') return () => {};
            listeners.add(listener);
            listener(getState());
            return () => listeners.delete(listener);
        }

        return Object.freeze({
            getState,
            replaceState,
            patchState,
            subscribe
        });
    }

    global.Director3DStore = Object.freeze({createStore});
})(window);

