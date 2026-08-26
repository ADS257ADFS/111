(function(global){
    'use strict';

    function even(value){
        const rounded = Math.max(360, Math.min(2160, Math.round(Number(value) || 720)));
        return rounded % 2 === 0 ? rounded : rounded + 1;
    }

    function normalizeSettings(input = {}, timeline = {}){
        const source = input && typeof input === 'object' ? input : {};
        const timelineRate = Math.max(1, Math.min(60, Math.round(Number(timeline.frameRate) || 24)));
        const frameRate = Math.max(1, Math.min(60, Math.round(Number(source.frameRate) || timelineRate)));
        return {height:even(source.height), frameRate};
    }

    function createAnimationExportSettings({store} = {}){
        if(!store?.getState || !store?.patchState){
            throw new Error('Director3DAnimationExportSettings requires a Director3D store');
        }

        function read(){
            const state = store.getState();
            return normalizeSettings(state.scene?.extensions?.animationExport, state.scene?.timeline);
        }

        function update(patch){
            const state = store.getState();
            const settings = normalizeSettings({...read(), ...(patch || {})}, state.scene?.timeline);
            store.patchState({
                scene: {
                    ...state.scene,
                    extensions: {
                        ...(state.scene?.extensions || {}),
                        animationExport:settings
                    }
                }
            });
            return settings;
        }

        return Object.freeze({read, update});
    }

    global.Director3DAnimationExportSettings = Object.freeze({normalizeSettings, createAnimationExportSettings});
})(window);
