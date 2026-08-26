(function(global){
    'use strict';

    function clone(value){
        return JSON.parse(JSON.stringify(value));
    }

    function uid(prefix){
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    }

    function defaultCameraState(){
        return {
            position: [4, 3, 6],
            target: [0, 0.8, 0],
            fov: 45,
            near: 0.1,
            far: 1000
        };
    }

    function normalizeShot(input = {}, index = 1, projectRatio){
        const ratio = global.Director3DAspectRatio.parse(projectRatio || input.aspectRatio || input.ratio || '16:9', input.customRatio);
        const camera = {...defaultCameraState(), ...(input.cameraState || {})};
        const target = Array.isArray(input.target) ? input.target.slice(0, 3).map(Number) : camera.target;
        return {
            id: String(input.id || uid('shot')),
            name: String(input.name || `机位 ${index}`).slice(0, 80),
            locked: Boolean(input.locked),
            aspectRatio: ratio,
            cameraState: {
                ...camera,
                target: Array.isArray(camera.target) ? camera.target.slice(0, 3).map(Number) : target
            },
            target,
            fov: Number(input.fov || camera.fov || 45),
            durationFrames: Math.max(1, Math.round(Number(input.durationFrames || 120))),
            keyframes: Array.isArray(input.keyframes) ? clone(input.keyframes) : [],
            metadata: {...(input.metadata || {})}
        };
    }

    function projectRatioFromState(state, rawShots){
        return global.Director3DAspectRatio.parse(
            state?.projectAspectRatio || rawShots?.[0]?.aspectRatio || '16:9'
        );
    }

    function ensureShotState(state){
        const next = clone(state || {});
        const rawShots = Array.isArray(next.cameraShots) ? next.cameraShots : [];
        const projectRatio = projectRatioFromState(next, rawShots);
        next.projectAspectRatio = projectRatio;
        next.cameraShots = rawShots.map((shot, index) => normalizeShot(shot, index + 1, projectRatio));
        if(!next.currentShotId || !next.cameraShots.some(shot => shot.id === next.currentShotId)){
            next.currentShotId = next.cameraShots[0]?.id || '';
        }
        if(!['panorama', 'shot', 'quad', 'front', 'side', 'top'].includes(next.viewMode)) next.viewMode = 'panorama';
        return next;
    }

    function createShotStore({store} = {}){
        if(!store?.getState || !store?.replaceState){
            throw new Error('Director3DShotStore requires a Director3D store');
        }

        function commit(next){
            const normalized = ensureShotState(next);
            store.replaceState(normalized);
            return normalized;
        }

        function state(){
            return ensureShotState(store.getState());
        }

        function list(){
            return state().cameraShots.map(clone);
        }

        function get(id){
            const shot = state().cameraShots.find(item => item.id === id);
            return shot ? clone(shot) : null;
        }

        function current(){
            const s = state();
            const shot = s.cameraShots.find(shot => shot.id === s.currentShotId) || s.cameraShots[0] || null;
            return shot ? clone(shot) : null;
        }

        function ratio(){
            return clone(state().projectAspectRatio);
        }

        function applyProjectRatio(nextState, ratioInput){
            const nextRatio = global.Director3DAspectRatio.parse(ratioInput || nextState.projectAspectRatio || '16:9');
            return {
                ...nextState,
                projectAspectRatio: nextRatio,
                cameraShots: nextState.cameraShots.map((shot, index) => normalizeShot({...shot, aspectRatio: nextRatio}, index + 1, nextRatio))
            };
        }

        function setAspectRatio(ratioInput){
            const s = state();
            const next = commit(applyProjectRatio(s, ratioInput));
            return clone(next.projectAspectRatio);
        }

        function addShot(input = {}){
            const s = state();
            const shot = normalizeShot(input, s.cameraShots.length + 1, s.projectAspectRatio);
            commit({...s, cameraShots: [...s.cameraShots, shot]});
            return clone(shot);
        }

        function updateShot(id, patch = {}){
            const s = state();
            const index = s.cameraShots.findIndex(shot => shot.id === id);
            if(index < 0) return null;
            const ratioPatch = patch.aspectRatio || patch.ratio || null;
            const activeRatio = ratioPatch ? global.Director3DAspectRatio.parse(ratioPatch) : s.projectAspectRatio;
            const nextShot = normalizeShot({...s.cameraShots[index], ...patch, id}, index + 1, activeRatio);
            const shots = s.cameraShots.slice();
            shots[index] = nextShot;
            const nextState = ratioPatch
                ? applyProjectRatio({...s, cameraShots: shots}, activeRatio)
                : {...s, cameraShots: shots};
            commit(nextState);
            return clone(nextShot);
        }

        function renameShot(id, name){
            const nextName = String(name || '').trim().slice(0, 80);
            if(!nextName) return null;
            return updateShot(id, {name: nextName});
        }

        function setShotLocked(id, locked){
            return updateShot(id, {locked: Boolean(locked)});
        }

        function toggleShotLocked(id){
            const shot = get(id);
            if(!shot) return null;
            return setShotLocked(id, !shot.locked);
        }

        function setShotTarget(id, target){
            const shot = get(id);
            if(!shot || shot.locked || !Array.isArray(target)) return null;
            const nextTarget = [0, 1, 2].map(index => Number(target[index] ?? shot.target?.[index] ?? shot.cameraState?.target?.[index] ?? 0));
            return updateShot(id, {
                target:nextTarget,
                cameraState:{...(shot.cameraState || {}), target:nextTarget}
            });
        }

        function removeShot(id){
            const s = state();
            if(!s.cameraShots.length) return false;
            const shots = s.cameraShots.filter(shot => shot.id !== id);
            if(shots.length === s.cameraShots.length) return false;
            const removingCurrent = s.currentShotId === id;
            commit({
                ...s,
                cameraShots: shots,
                currentShotId: removingCurrent ? (shots[0]?.id || '') : s.currentShotId,
                viewMode: removingCurrent ? 'panorama' : s.viewMode
            });
            return true;
        }

        function setCurrentShot(id){
            const s = state();
            if(!s.cameraShots.some(shot => shot.id === id)) return false;
            if(s.currentShotId === id && s.viewMode === 'shot'){
                commit({...s, viewMode: 'panorama'});
                return true;
            }
            commit({...s, currentShotId: id, viewMode: 'shot'});
            return true;
        }

        function selectShot(id){
            const s = state();
            if(!s.cameraShots.some(shot => shot.id === id)) return false;
            commit({...s, currentShotId: id});
            return true;
        }

        function returnToPanorama(){
            const s = state();
            commit({...s, viewMode: 'panorama'});
            return true;
        }

        function setViewMode(viewMode){
            if(viewMode === 'perspective') viewMode = 'panorama';
            if(!['panorama', 'shot', 'quad', 'front', 'side', 'top'].includes(viewMode)) return false;
            const s = state();
            commit({...s, viewMode});
            return true;
        }

        return Object.freeze({
            list,
            get,
            current,
            ratio,
            addShot,
            updateShot,
            renameShot,
            setShotLocked,
            toggleShotLocked,
            setShotTarget,
            removeShot,
            setCurrentShot,
            selectShot,
            returnToPanorama,
            setViewMode,
            setAspectRatio
        });
    }

    global.Director3DShotStore = Object.freeze({
        normalizeShot,
        ensureShotState,
        createShotStore
    });
})(window);
