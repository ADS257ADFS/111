(function(global){
    'use strict';

    function clone(value){
        return JSON.parse(JSON.stringify(value));
    }

    function createTimelineStore({store} = {}){
        if(!store?.getState || !store?.patchState){
            throw new Error('Director3DTimelineStore requires a Director3D store');
        }

        function state(){
            return store.getState();
        }

        function timeline(){
            return clone(state().scene?.timeline || {});
        }

        function commit(nextTimeline){
            const current = state();
            return store.patchState({
                scene: {
                    ...current.scene,
                    timeline: global.Director3DSchema.normalizeTimeline(nextTimeline, current.scene?.timeline)
                }
            });
        }

        function update(updater){
            const current = timeline();
            return commit(updater(current) || current);
        }

        function setCurrentFrame(frame){
            return update(current => ({...current, currentFrame: frame}));
        }

        function setDurationFrames(durationFrames){
            return update(current => ({...current, durationFrames}));
        }

        function setFrameRange(startFrame, endFrame){
            return update(current => ({...current, startFrame, endFrame}));
        }

        function setPlaying(isPlaying){
            return update(current => ({...current, isPlaying: Boolean(isPlaying)}));
        }

        function setLoopPlayback(loopPlayback){
            return update(current => ({...current, loopPlayback:Boolean(loopPlayback)}));
        }

        function setAutoKeyframe(autoKeyframe){
            return update(current => ({...current, autoKeyframe:Boolean(autoKeyframe)}));
        }

        function upsert(track, frame, payload, property){
            const next = Array.isArray(track) ? track.filter(item => item.frame !== frame) : [];
            next.push({frame, [property]: clone(payload), interpolation:'smooth'});
            return next.sort((a, b) => a.frame - b.frame);
        }

        function trackProperty(trackType){
            return trackType === 'camera' ? 'cameraTracks' : (trackType === 'object' ? 'objectTracks' : '');
        }

        function validTrack(trackType, trackId){
            const property = trackProperty(trackType);
            const stableId = String(trackId || '');
            return property && stableId ? {property, stableId} : null;
        }

        function recordObjectKeyframe(objectId){
            const current = state();
            const object = (current.scene?.objects || []).find(item => item?.id === objectId);
            if(!object) return false;
            const currentTimeline = current.scene?.timeline || {};
            const frame = Number(currentTimeline.currentFrame || 0);
            update(timelineState => ({
                ...timelineState,
                objectTracks: {
                    ...(timelineState.objectTracks || {}),
                    [objectId]: upsert(timelineState.objectTracks?.[objectId], frame, object.transform || {}, 'transform')
                },
                selection: {trackType:'object', trackId:objectId, frame}
            }));
            return true;
        }

        function recordCameraKeyframe(shotId, cameraState){
            const stableId = String(shotId || '');
            if(!stableId || !cameraState) return false;
            const currentTimeline = state().scene?.timeline || {};
            const frame = Number(currentTimeline.currentFrame || 0);
            update(timelineState => ({
                ...timelineState,
                cameraTracks: {
                    ...(timelineState.cameraTracks || {}),
                    [stableId]: upsert(timelineState.cameraTracks?.[stableId], frame, cameraState, 'cameraState')
                },
                selection: {trackType:'camera', trackId:stableId, frame}
            }));
            return true;
        }

        function recordShotCut(shotId){
            const stableId = String(shotId || '');
            if(!stableId) return false;
            const currentTimeline = state().scene?.timeline || {};
            const frame = Number(currentTimeline.currentFrame || 0);
            update(timelineState => ({
                ...timelineState,
                shotCuts: [
                    ...(timelineState.shotCuts || []).filter(cut => Number(cut.frame) !== frame),
                    {frame, shotId:stableId}
                ].sort((a, b) => a.frame - b.frame),
                selection: {trackType:'cut', trackId:'cuts', frame}
            }));
            return true;
        }

        function selectKeyframe(trackType, trackId, frame){
            const stableType = trackType === 'camera' ? 'camera' : (trackType === 'object' ? 'object' : (trackType === 'cut' ? 'cut' : ''));
            const stableId = String(trackId || '');
            if(!stableType || !stableId || (stableType === 'cut' && stableId !== 'cuts')) return false;
            update(current => ({...current, selection:{trackType:stableType, trackId:stableId, frame}}));
            return true;
        }

        function clearKeyframeSelection(){
            return update(current => ({...current, selection:{trackType:'', trackId:'', frame:-1}}));
        }

        function deleteKeyframe(trackType, trackId, frame){
            const stableType = trackType === 'camera' ? 'camera' : (trackType === 'object' ? 'object' : (trackType === 'cut' ? 'cut' : ''));
            if(stableType === 'cut'){
                if(String(trackId || '') !== 'cuts') return false;
                const cutFrame = Number(frame);
                if(!(timeline().shotCuts || []).some(cut => Number(cut.frame) === cutFrame)) return false;
                update(current => ({
                    ...current,
                    shotCuts:(current.shotCuts || []).filter(cut => Number(cut.frame) !== cutFrame),
                    selection:{trackType:'', trackId:'', frame:-1}
                }));
                return true;
            }
            const track = validTrack(stableType, trackId);
            if(!track) return false;
            const {property, stableId} = track;
            const timelineState = timeline();
            const frames = timelineState[property]?.[stableId] || [];
            if(!frames.some(keyframe => keyframe.frame === Number(frame))) return false;
            update(current => {
                const tracks = {...(current[property] || {})};
                const nextTrack = (tracks[stableId] || []).filter(keyframe => keyframe.frame !== Number(frame));
                if(nextTrack.length) tracks[stableId] = nextTrack;
                else delete tracks[stableId];
                const selected = current.selection || {};
                return {
                    ...current,
                    [property]: tracks,
                    selection: selected.trackType === stableType && selected.trackId === stableId && Number(selected.frame) === Number(frame)
                        ? {trackType:'', trackId:'', frame:-1}
                        : selected
                };
            });
            return true;
        }

        function moveKeyframe(trackType, trackId, frame, targetFrame){
            const stableType = trackType === 'camera' ? 'camera' : (trackType === 'object' ? 'object' : (trackType === 'cut' ? 'cut' : ''));
            if(stableType === 'cut'){
                if(String(trackId || '') !== 'cuts') return false;
                const timelineState = timeline();
                const sourceFrame = Number(frame);
                const nextFrame = Math.max(0, Math.min(Number(timelineState.durationFrames || 1), Math.round(Number(targetFrame) || 0)));
                const source = (timelineState.shotCuts || []).find(cut => Number(cut.frame) === sourceFrame);
                if(!source || sourceFrame === nextFrame) return false;
                update(current => ({
                    ...current,
                    shotCuts:[
                        ...(current.shotCuts || []).filter(cut => Number(cut.frame) !== sourceFrame && Number(cut.frame) !== nextFrame),
                        {...clone(source), frame:nextFrame}
                    ].sort((a, b) => a.frame - b.frame),
                    selection:{trackType:'cut', trackId:'cuts', frame:nextFrame}
                }));
                return true;
            }
            const track = validTrack(stableType, trackId);
            if(!track) return false;
            const {property, stableId} = track;
            const timelineState = timeline();
            const sourceFrame = Number(frame);
            const nextFrame = Math.max(0, Math.min(Number(timelineState.durationFrames || 1), Math.round(Number(targetFrame) || 0)));
            const source = (timelineState[property]?.[stableId] || []).find(keyframe => keyframe.frame === sourceFrame);
            if(!source || sourceFrame === nextFrame) return false;
            update(current => {
                const tracks = {...(current[property] || {})};
                const frames = (tracks[stableId] || []).filter(keyframe => keyframe.frame !== sourceFrame && keyframe.frame !== nextFrame);
                frames.push({...clone(source), frame:nextFrame});
                tracks[stableId] = frames.sort((a, b) => a.frame - b.frame);
                return {...current, [property]:tracks, selection:{trackType:stableType, trackId:stableId, frame:nextFrame}};
            });
            return true;
        }

        function duplicateSelectedKeyframe(targetFrame){
            const selected = timeline().selection || {};
            if(selected.trackType === 'cut' && selected.trackId === 'cuts'){
                const timelineState = timeline();
                const source = (timelineState.shotCuts || []).find(cut => Number(cut.frame) === Number(selected.frame));
                const nextFrame = Math.max(0, Math.min(Number(timelineState.durationFrames || 1), Math.round(Number(targetFrame ?? timelineState.currentFrame) || 0)));
                if(!source || Number(source.frame) === nextFrame) return false;
                update(current => ({
                    ...current,
                    shotCuts:[
                        ...(current.shotCuts || []).filter(cut => Number(cut.frame) !== nextFrame),
                        {...clone(source), frame:nextFrame}
                    ].sort((a, b) => a.frame - b.frame),
                    selection:{trackType:'cut', trackId:'cuts', frame:nextFrame}
                }));
                return true;
            }
            const track = validTrack(selected.trackType, selected.trackId);
            if(!track) return false;
            const {property, stableId} = track;
            const timelineState = timeline();
            const source = (timelineState[property]?.[stableId] || []).find(keyframe => keyframe.frame === Number(selected.frame));
            const nextFrame = Math.max(0, Math.min(Number(timelineState.durationFrames || 1), Math.round(Number(targetFrame ?? timelineState.currentFrame) || 0)));
            if(!source || Number(source.frame) === nextFrame) return false;
            update(current => {
                const tracks = {...(current[property] || {})};
                const frames = (tracks[stableId] || []).filter(keyframe => keyframe.frame !== nextFrame);
                frames.push({...clone(source), frame:nextFrame});
                tracks[stableId] = frames.sort((a, b) => a.frame - b.frame);
                return {...current, [property]:tracks, selection:{trackType:selected.trackType, trackId:stableId, frame:nextFrame}};
            });
            return true;
        }

        function setKeyframeInterpolation(trackType, trackId, frame, interpolation){
            const stableType = trackType === 'camera' ? 'camera' : (trackType === 'object' ? 'object' : '');
            const track = validTrack(stableType, trackId);
            const nextInterpolation = ['linear', 'smooth', 'hold'].includes(interpolation) ? interpolation : '';
            if(!track || !nextInterpolation) return false;
            const {property, stableId} = track;
            const frames = timeline()[property]?.[stableId] || [];
            if(!frames.some(keyframe => keyframe.frame === Number(frame))) return false;
            update(current => ({
                ...current,
                [property]: {
                    ...(current[property] || {}),
                    [stableId]: (current[property]?.[stableId] || []).map(keyframe => keyframe.frame === Number(frame)
                        ? {...keyframe, interpolation:nextInterpolation}
                        : keyframe)
                }
            }));
            return true;
        }

        function deleteSelectedKeyframe(){
            const selected = timeline().selection || {};
            return deleteKeyframe(selected.trackType, selected.trackId, selected.frame);
        }

        return Object.freeze({
            timeline,
            setCurrentFrame,
            setDurationFrames,
            setFrameRange,
            setPlaying,
            setLoopPlayback,
            setAutoKeyframe,
            recordObjectKeyframe,
            recordCameraKeyframe,
            recordShotCut,
            selectKeyframe,
            clearKeyframeSelection,
            deleteKeyframe,
            deleteSelectedKeyframe,
            moveKeyframe,
            duplicateSelectedKeyframe,
            setKeyframeInterpolation
        });
    }

    global.Director3DTimelineStore = Object.freeze({createTimelineStore});
})(window);
