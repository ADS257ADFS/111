(function(global){
    'use strict';

    function icon(kind){
        if(kind === 'pause') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14"></path><path d="M16 5v14"></path></svg>';
        if(kind === 'previous') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14"></path><path d="m18 6-8 6 8 6z"></path></svg>';
        if(kind === 'next') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14"></path><path d="m6 6 8 6-8 6z"></path></svg>';
        if(kind === 'loop') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"></path><path d="M3 11V9a3 3 0 0 1 3-3h15"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v2a3 3 0 0 1-3 3H3"></path></svg>';
        if(kind === 'autoKey') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path></svg>';
        if(kind === 'key') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 6 6-6 6-6-6z"></path><path d="m12 9 6 6-6 6-6-6z"></path></svg>';
        if(kind === 'delete') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m6 6 1 15h10l1-15"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
        if(kind === 'duplicate') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>';
        if(kind === 'cut') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h5l7 12h4"></path><path d="m16 6-3 5"></path><path d="m4 18h5l2-3"></path><circle cx="5" cy="6" r="1"></circle><circle cx="5" cy="18" r="1"></circle></svg>';
        if(kind === 'render') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="12" height="14" rx="2"></rect><path d="m15 10 6-3v10l-6-3z"></path></svg>';
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"></path></svg>';
    }

    function clampFrame(value, timeline){
        const min = Number(timeline.startFrame || 0);
        const max = Number(timeline.endFrame ?? timeline.durationFrames ?? 1);
        return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
    }

    function isSelected(timeline, trackType, trackId, frame){
        const selected = timeline.selection || {};
        return selected.trackType === trackType && selected.trackId === trackId && Number(selected.frame) === Number(frame);
    }

    function selectedKeyframe(timeline){
        const selection = timeline.selection || {};
        const property = selection.trackType === 'camera' ? 'cameraTracks' : (selection.trackType === 'object' ? 'objectTracks' : (selection.trackType === 'cut' ? 'shotCuts' : ''));
        if(!property || !selection.trackId || Number(selection.frame) < 0) return null;
        if(selection.trackType === 'cut') return (timeline.shotCuts || []).find(cut => Number(cut.frame) === Number(selection.frame)) || null;
        return (timeline[property]?.[selection.trackId] || []).find(keyframe => Number(keyframe.frame) === Number(selection.frame)) || null;
    }

    function markers(frames, timeline, trackType, trackId){
        const duration = Math.max(1, Number(timeline.durationFrames || 1));
        return (Array.isArray(frames) ? frames : []).map(keyframe => {
            const left = Math.max(0, Math.min(100, (Number(keyframe.frame || 0) / duration) * 100));
            const selected = isSelected(timeline, trackType, trackId, keyframe.frame) ? ' selected' : '';
            return `<button class="director3d-timeline-marker${selected}" type="button" data-director3d-timeline-marker="${keyframe.frame}" data-director3d-timeline-track-type="${trackType}" data-director3d-timeline-track-id="${trackId}" style="left:${left}%" title="第 ${keyframe.frame} 帧" aria-label="第 ${keyframe.frame} 帧"></button>`;
        }).join('');
    }

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        }[character]));
    }

    function objectTracksForScene(timeline, objects){
        const tracks = timeline?.objectTracks || {};
        return (Array.isArray(objects) ? objects : []).reduce((result, object) => {
            const id = String(object?.id || '');
            if(!id) return result;
            result.push({
                id,
                name:String(object.name || id),
                frames:Array.isArray(tracks[id]) ? tracks[id] : []
            });
            return result;
        }, []);
    }

    function cameraTracksForShots(timeline, shots){
        const tracks = timeline?.cameraTracks || {};
        return (Array.isArray(shots) ? shots : []).reduce((result, shot) => {
            const id = String(shot?.id || '');
            if(!id) return result;
            result.push({
                id,
                name:String(shot.name || id),
                frames:Array.isArray(tracks[id]) ? tracks[id] : []
            });
            return result;
        }, []);
    }

    function shotSegments(cuts, shots, durationFrames){
        const duration = Math.max(1, Math.round(Number(durationFrames) || 1));
        const shotNames = new Map((Array.isArray(shots) ? shots : []).map(shot => [
            String(shot?.id || ''),
            String(shot?.name || shot?.id || '')
        ]));
        const cutsByFrame = new Map();
        (Array.isArray(cuts) ? cuts : []).forEach(cut => {
            const shotId = String(cut?.shotId || '');
            if(!shotId) return;
            const frame = Math.max(0, Math.min(duration, Math.round(Number(cut?.frame) || 0)));
            cutsByFrame.set(frame, {frame, shotId});
        });
        const orderedCuts = Array.from(cutsByFrame.values()).sort((a, b) => a.frame - b.frame);
        return orderedCuts.map((cut, index) => {
            const nextFrame = orderedCuts[index + 1]?.frame;
            const visualEndFrame = nextFrame === undefined ? duration : nextFrame;
            const name = shotNames.get(cut.shotId) || '已删除机位';
            return {
                shotId:cut.shotId,
                name,
                missing:!shotNames.has(cut.shotId),
                startFrame:cut.frame,
                endFrame:nextFrame === undefined ? duration : Math.max(cut.frame, nextFrame - 1),
                leftPercent:(cut.frame / duration) * 100,
                widthPercent:(Math.max(0, visualEndFrame - cut.frame) / duration) * 100
            };
        });
    }

    function previewShotIdAtFrame(cuts, frame, fallbackShotId, fallbackViewMode){
        const currentFrame = Number(frame || 0);
        const activeCut = (Array.isArray(cuts) ? cuts : []).reduce((active, cut) => {
            if(!cut?.shotId || Number(cut.frame) > currentFrame) return active;
            return !active || Number(cut.frame) >= Number(active.frame) ? cut : active;
        }, null);
        if(activeCut?.shotId) return String(activeCut.shotId);
        return fallbackViewMode === 'shot' ? String(fallbackShotId || '') : '';
    }

    function frameAtTimelinePosition(clientX, left, width, durationFrames){
        const safeWidth = Math.max(1, Number(width) || 1);
        const ratio = Math.max(0, Math.min(1, (Number(clientX) - Number(left || 0)) / safeWidth));
        return Math.round(ratio * Math.max(1, Number(durationFrames) || 1));
    }

    function shotSegmentMarkup(segments){
        return segments.map(segment => {
            const missing = segment.missing ? ' missing' : '';
            const label = `${segment.name} · ${segment.startFrame}-${segment.endFrame}`;
            return `<button type="button" class="director3d-timeline-shot-segment${missing}" data-director3d-timeline-shot-segment="${escapeHtml(segment.shotId)}" data-director3d-timeline-segment-start="${segment.startFrame}" data-director3d-timeline-segment-end="${segment.endFrame}" style="left:${segment.leftPercent}%;width:${segment.widthPercent}%" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span>${escapeHtml(segment.name)}</span></button>`;
        }).join('');
    }

    function createTimelineUI({container, store, timelineStore, shotStore, viewport, selectObject, selectShot, previewShot} = {}){
        if(!container || !store || !timelineStore || !shotStore || !viewport){
            throw new Error('Director3DTimelineUI requires a container, store, timeline store, shot store, and viewport');
        }

        let animationFrame = 0;
        let lastTimestamp = 0;
        let frameRemainder = 0;
        let renderedStructureSignature = '';
        let markerDrag = null;
        let suppressMarkerClick = false;
        let previewActive = false;

        function currentTimeline(){
            return timelineStore.timeline();
        }

        function selectedObjectId(state){
            return String(state.selection?.lastObjectId || state.selection?.objectIds?.[0] || '');
        }

        function seek(frame){
            previewActive = true;
            const timeline = currentTimeline();
            timelineStore.setCurrentFrame(clampFrame(frame, timeline));
            const next = currentTimeline();
            viewport.previewTimeline?.(next);
        }

        function clearPreview(){
            previewActive = false;
            previewShot?.('');
            viewport.clearTimelinePreview?.();
        }

        function pause(){
            if(animationFrame) global.cancelAnimationFrame?.(animationFrame);
            animationFrame = 0;
            lastTimestamp = 0;
            frameRemainder = 0;
            if(currentTimeline().isPlaying) timelineStore.setPlaying(false);
        }

        function play(){
            const initial = currentTimeline();
            if(initial.isPlaying) return;
            previewActive = true;
            if(Number(initial.currentFrame) < Number(initial.startFrame) || Number(initial.currentFrame) >= Number(initial.endFrame)) seek(initial.startFrame);
            timelineStore.setPlaying(true);
            viewport.previewTimeline?.(currentTimeline());
            function tick(timestamp){
                const timeline = currentTimeline();
                if(!timeline.isPlaying){
                    pause();
                    return;
                }
                if(!lastTimestamp) lastTimestamp = timestamp;
                frameRemainder += ((timestamp - lastTimestamp) / 1000) * Number(timeline.frameRate || 24);
                lastTimestamp = timestamp;
                const advance = Math.floor(frameRemainder);
                if(advance > 0){
                    frameRemainder -= advance;
                    const nextFrame = Number(timeline.currentFrame || 0) + advance;
                    if(nextFrame > Number(timeline.endFrame)){
                        if(timeline.loopPlayback !== false) seek(timeline.startFrame);
                        else {
                            seek(timeline.endFrame);
                            pause();
                            return;
                        }
                    } else seek(nextFrame);
                }
                animationFrame = global.requestAnimationFrame?.(tick) || 0;
            }
            animationFrame = global.requestAnimationFrame?.(tick) || 0;
        }

        function playbackPercent(timeline){
            const duration = Math.max(1, Number(timeline.durationFrames || 1));
            return Math.max(0, Math.min(100, (Number(timeline.currentFrame || 0) / duration) * 100));
        }

        function syncPlaybackUI(timeline){
            const frameInput = container.querySelector('[data-director3d-timeline-frame]');
            if(frameInput) frameInput.value = String(timeline.currentFrame);
            container.querySelectorAll('.director3d-timeline-playhead').forEach(playhead => {
                playhead.style.left = `${playbackPercent(timeline)}%`;
            });
            const currentFrame = Number(timeline.currentFrame || 0);
            container.querySelectorAll('[data-director3d-timeline-shot-segment]').forEach(segment => {
                const startFrame = Number(segment.dataset.director3dTimelineSegmentStart || 0);
                const endFrame = Number(segment.dataset.director3dTimelineSegmentEnd || 0);
                segment.classList.toggle('active', currentFrame >= startFrame && currentFrame <= endFrame);
            });
            if(previewActive){
                const state = store.getState();
                previewShot?.(previewShotIdAtFrame(timeline.shotCuts, currentFrame, state.currentShotId, state.viewMode));
            }
            const loopButton = container.querySelector('[data-director3d-timeline-action="toggle-loop"]');
            if(loopButton){
                const enabled = timeline.loopPlayback !== false;
                loopButton.classList.toggle('active', enabled);
                loopButton.title = enabled ? '关闭循环播放' : '开启循环播放';
                loopButton.setAttribute('aria-label', loopButton.title);
                loopButton.setAttribute('aria-pressed', String(enabled));
            }
            const autoKeyButton = container.querySelector('[data-director3d-timeline-action="toggle-auto-key"]');
            if(autoKeyButton){
                const enabled = Boolean(timeline.autoKeyframe);
                autoKeyButton.classList.toggle('active', enabled);
                autoKeyButton.title = enabled ? '关闭自动关键帧' : '开启自动关键帧';
                autoKeyButton.setAttribute('aria-label', autoKeyButton.title);
                autoKeyButton.setAttribute('aria-pressed', String(enabled));
            }
            const playButton = container.querySelector('[data-director3d-timeline-action="play"], [data-director3d-timeline-action="pause"]');
            if(!playButton) return;
            const isPlaying = Boolean(timeline.isPlaying);
            const label = isPlaying ? '暂停' : '播放';
            playButton.dataset.director3dTimelineAction = isPlaying ? 'pause' : 'play';
            playButton.title = label;
            playButton.setAttribute('aria-label', label);
            playButton.innerHTML = icon(isPlaying ? 'pause' : 'play');
        }

        function structureSignature(timeline, objectTracks, selectedObjectId, shotId, cameraTracks){
            return JSON.stringify({
                objectTracks,
                selectedObjectId,
                shotId,
                durationFrames:timeline.durationFrames,
                startFrame:timeline.startFrame,
                endFrame:timeline.endFrame,
                cameraTracks,
                shotCuts:timeline.shotCuts,
                selection:timeline.selection
            });
        }

        function render(state){
            const timeline = state.scene?.timeline || currentTimeline();
            const objectId = selectedObjectId(state);
            const currentShot = shotStore.current();
            const objectTracks = objectTracksForScene(timeline, state.scene?.objects);
            const cameraTracks = cameraTracksForShots(timeline, state.cameraShots);
            const cutSegments = shotSegments(timeline.shotCuts, state.cameraShots, timeline.durationFrames);
            const duration = Math.max(1, Number(timeline.durationFrames || 1));
            const playhead = Math.max(0, Math.min(100, (Number(timeline.currentFrame || 0) / duration) * 100));
            const hasSelection = Boolean(timeline.selection?.trackType && timeline.selection?.trackId && Number(timeline.selection?.frame) >= 0);
            const selectedFrame = selectedKeyframe(timeline);
            const canSetInterpolation = Boolean(selectedFrame && timeline.selection?.trackType !== 'cut');
            const interpolation = selectedFrame?.interpolation || 'linear';
            const signature = structureSignature(timeline, objectTracks, objectId, currentShot?.id || '', cameraTracks);
            if(signature === renderedStructureSignature && container.childElementCount){
                syncPlaybackUI(timeline);
                return;
            }
            renderedStructureSignature = signature;
            container.innerHTML = `
                <div class="director3d-timeline-controls">
                    <button type="button" data-director3d-timeline-action="previous" title="上一帧" aria-label="上一帧">${icon('previous')}</button>
                    <button type="button" data-director3d-timeline-action="${timeline.isPlaying ? 'pause' : 'play'}" title="${timeline.isPlaying ? '暂停' : '播放'}" aria-label="${timeline.isPlaying ? '暂停' : '播放'}">${icon(timeline.isPlaying ? 'pause' : 'play')}</button>
                    <button type="button" data-director3d-timeline-action="next" title="下一帧" aria-label="下一帧">${icon('next')}</button>
                    <span class="director3d-timeline-frame"><input type="number" min="${timeline.startFrame}" max="${timeline.endFrame}" value="${timeline.currentFrame}" data-director3d-timeline-frame> / ${timeline.durationFrames}</span>
                    <span class="director3d-timeline-fps">${timeline.frameRate} FPS</span>
                    <button type="button" data-director3d-timeline-action="export-animation" title="渲染动画" aria-label="渲染动画">${icon('render')}</button>
                    <button type="button" class="director3d-timeline-key" data-director3d-timeline-action="record-object" title="记录对象关键帧" aria-label="记录对象关键帧" ${objectId ? '' : 'disabled'}>${icon('key')}</button>
                    <button type="button" class="director3d-timeline-key" data-director3d-timeline-action="record-camera" title="记录机位关键帧" aria-label="记录机位关键帧" ${currentShot ? '' : 'disabled'}>${icon('key')}</button>
                    <button type="button" data-director3d-timeline-action="delete-keyframe" title="删除选中关键帧" aria-label="删除选中关键帧" ${hasSelection ? '' : 'disabled'}>${icon('delete')}</button>
                    <button type="button" data-director3d-timeline-action="duplicate-keyframe" title="复制到当前帧" aria-label="复制到当前帧" ${hasSelection ? '' : 'disabled'}>${icon('duplicate')}</button>
                    <span class="director3d-timeline-interpolation" aria-label="关键帧插值">
                        <button type="button" class="${interpolation === 'hold' ? 'active' : ''}" data-director3d-timeline-action="set-interpolation" data-director3d-timeline-interpolation="hold" title="保持" aria-label="保持" ${hasSelection ? '' : 'disabled'}>H</button>
                        <button type="button" class="${interpolation === 'linear' ? 'active' : ''}" data-director3d-timeline-action="set-interpolation" data-director3d-timeline-interpolation="linear" title="线性" aria-label="线性" ${hasSelection ? '' : 'disabled'}>L</button>
                        <button type="button" class="${interpolation === 'smooth' ? 'active' : ''}" data-director3d-timeline-action="set-interpolation" data-director3d-timeline-interpolation="smooth" title="平滑" aria-label="平滑" ${hasSelection ? '' : 'disabled'}>S</button>
                    </span>
                    <label class="director3d-timeline-range">起 <input type="number" min="0" max="${timeline.endFrame}" value="${timeline.startFrame}" data-director3d-timeline-start></label>
                    <label class="director3d-timeline-range">止 <input type="number" min="${timeline.startFrame}" max="${timeline.durationFrames}" value="${timeline.endFrame}" data-director3d-timeline-end></label>
                    <label class="director3d-timeline-duration">总帧 <input type="number" min="1" max="2400" value="${timeline.durationFrames}" data-director3d-timeline-duration></label>
                </div>
                <div class="director3d-timeline-tracks">
                    ${objectTracks.map(track => `<div class="director3d-timeline-track ${track.id === objectId ? 'active' : ''}"><button type="button" class="director3d-timeline-track-name" data-director3d-timeline-object-track="${track.id}" title="选择对象轨道" aria-label="选择对象轨道">${escapeHtml(track.name)}</button><div class="director3d-timeline-ruler">${markers(track.frames, timeline, 'object', track.id)}<i class="director3d-timeline-range-band" style="left:${(timeline.startFrame / duration) * 100}%;right:${100 - (timeline.endFrame / duration) * 100}%"></i><i class="director3d-timeline-playhead" style="left:${playhead}%"></i></div></div>`).join('') || '<div class="director3d-timeline-empty">暂无对象</div>'}
                    ${cameraTracks.map(track => `<div class="director3d-timeline-track ${track.id === currentShot?.id ? 'active' : ''}"><button type="button" class="director3d-timeline-track-name" data-director3d-timeline-camera-track="${track.id}" title="选择机位轨道" aria-label="选择机位轨道">${escapeHtml(track.name)}</button><div class="director3d-timeline-ruler">${markers(track.frames, timeline, 'camera', track.id)}<i class="director3d-timeline-range-band" style="left:${(timeline.startFrame / duration) * 100}%;right:${100 - (timeline.endFrame / duration) * 100}%"></i><i class="director3d-timeline-playhead" style="left:${playhead}%"></i></div></div>`).join('') || '<div class="director3d-timeline-empty">暂无机位</div>'}
                </div>
            `;
            const controls = container.querySelector('.director3d-timeline-controls');
            if(controls){
                controls.querySelectorAll('[data-director3d-timeline-action="set-interpolation"]').forEach(button => {
                    button.disabled = !canSetInterpolation;
                });
                const cutButton = global.document.createElement('button');
                cutButton.type = 'button';
                cutButton.className = 'director3d-timeline-key';
                cutButton.dataset.director3dTimelineAction = 'record-shot-cut';
                cutButton.title = '记录机位切换';
                cutButton.setAttribute('aria-label', '记录机位切换');
                cutButton.disabled = !currentShot;
                cutButton.innerHTML = icon('cut');
                controls.appendChild(cutButton);
                const loopButton = global.document.createElement('button');
                loopButton.type = 'button';
                loopButton.className = 'director3d-timeline-loop';
                loopButton.dataset.director3dTimelineAction = 'toggle-loop';
                loopButton.innerHTML = icon('loop');
                controls.querySelector('[data-director3d-timeline-action="export-animation"]')?.before(loopButton);
                const autoKeyButton = global.document.createElement('button');
                autoKeyButton.type = 'button';
                autoKeyButton.className = 'director3d-timeline-auto-key';
                autoKeyButton.dataset.director3dTimelineAction = 'toggle-auto-key';
                autoKeyButton.innerHTML = icon('autoKey');
                controls.querySelector('[data-director3d-timeline-action="record-object"]')?.before(autoKeyButton);
            }
            const tracks = container.querySelector('.director3d-timeline-tracks');
            if(tracks){
                const cutTrack = global.document.createElement('div');
                cutTrack.className = 'director3d-timeline-track';
                cutTrack.innerHTML = `<span>剪辑</span><div class="director3d-timeline-ruler director3d-timeline-cut-ruler">${shotSegmentMarkup(cutSegments)}${markers(timeline.shotCuts, timeline, 'cut', 'cuts')}<i class="director3d-timeline-range-band" style="left:${(timeline.startFrame / duration) * 100}%;right:${100 - (timeline.endFrame / duration) * 100}%"></i><i class="director3d-timeline-playhead" style="left:${playhead}%"></i></div>`;
                tracks.appendChild(cutTrack);
            }
            syncPlaybackUI(timeline);
        }

        function commitRangeInput(input){
            const timeline = currentTimeline();
            if(input.matches?.('[data-director3d-timeline-duration]')){
                pause();
                timelineStore.setDurationFrames(input.value);
                seek(currentTimeline().currentFrame);
                return;
            }
            if(input.matches?.('[data-director3d-timeline-start]')){
                pause();
                timelineStore.setFrameRange(input.value, timeline.endFrame);
                seek(currentTimeline().currentFrame);
                return;
            }
            if(input.matches?.('[data-director3d-timeline-end]')){
                pause();
                timelineStore.setFrameRange(timeline.startFrame, input.value);
                seek(currentTimeline().currentFrame);
            }
        }

        container.addEventListener('click', event => {
            const objectTrack = event.target.closest?.('[data-director3d-timeline-object-track]');
            if(objectTrack){
                pause();
                selectObject?.(objectTrack.dataset.director3dTimelineObjectTrack);
                return;
            }
            const cameraTrack = event.target.closest?.('[data-director3d-timeline-camera-track]');
            if(cameraTrack){
                pause();
                selectShot?.(cameraTrack.dataset.director3dTimelineCameraTrack);
                return;
            }
            const shotSegment = event.target.closest?.('[data-director3d-timeline-shot-segment]');
            if(shotSegment){
                pause();
                timelineStore.clearKeyframeSelection();
                seek(shotSegment.dataset.director3dTimelineSegmentStart);
                return;
            }
            const marker = event.target.closest?.('[data-director3d-timeline-marker]');
            if(marker){
                if(suppressMarkerClick){
                    suppressMarkerClick = false;
                    return;
                }
                pause();
                if(marker.dataset.director3dTimelineTrackType === 'object') selectObject?.(marker.dataset.director3dTimelineTrackId);
                if(marker.dataset.director3dTimelineTrackType === 'camera') selectShot?.(marker.dataset.director3dTimelineTrackId);
                timelineStore.selectKeyframe(marker.dataset.director3dTimelineTrackType, marker.dataset.director3dTimelineTrackId, marker.dataset.director3dTimelineMarker);
                seek(marker.dataset.director3dTimelineMarker);
                return;
            }
            const ruler = event.target.closest?.('.director3d-timeline-ruler');
            if(ruler){
                pause();
                const bounds = ruler.getBoundingClientRect();
                timelineStore.clearKeyframeSelection();
                seek(frameAtTimelinePosition(event.clientX, bounds.left, bounds.width, currentTimeline().durationFrames));
                return;
            }
            const button = event.target.closest?.('[data-director3d-timeline-action]');
            if(!button || button.disabled) return;
            const action = button.dataset.director3dTimelineAction;
            if(action === 'play') play();
            if(action === 'pause') pause();
            if(action === 'toggle-loop') timelineStore.setLoopPlayback(currentTimeline().loopPlayback === false);
            if(action === 'toggle-auto-key') timelineStore.setAutoKeyframe(!currentTimeline().autoKeyframe);
            if(action === 'previous'){
                pause();
                seek(Number(currentTimeline().currentFrame || 0) - 1);
            }
            if(action === 'next'){
                pause();
                seek(Number(currentTimeline().currentFrame || 0) + 1);
            }
            if(action === 'record-object'){
                pause();
                const objectId = selectedObjectId(store.getState());
                if(objectId) timelineStore.recordObjectKeyframe(objectId);
            }
            if(action === 'record-camera'){
                pause();
                const shot = shotStore.current();
                if(shot) timelineStore.recordCameraKeyframe(shot.id, viewport.currentCameraState?.());
            }
            if(action === 'record-shot-cut'){
                pause();
                const shot = shotStore.current();
                if(shot) timelineStore.recordShotCut(shot.id);
            }
            if(action === 'delete-keyframe'){
                pause();
                timelineStore.deleteSelectedKeyframe();
            }
            if(action === 'duplicate-keyframe'){
                pause();
                timelineStore.duplicateSelectedKeyframe(currentTimeline().currentFrame);
            }
            if(action === 'set-interpolation'){
                pause();
                const selected = currentTimeline().selection || {};
                timelineStore.setKeyframeInterpolation(selected.trackType, selected.trackId, selected.frame, button.dataset.director3dTimelineInterpolation);
            }
            if(action === 'export-animation'){
                pause();
                container.dispatchEvent(new CustomEvent('director3d:export-animation', {bubbles:true}));
            }
        });

        container.addEventListener('pointerdown', event => {
            const marker = event.target.closest?.('[data-director3d-timeline-marker]');
            if(!marker || event.button !== 0) return;
            const ruler = marker.parentElement;
            if(!ruler) return;
            pause();
            markerDrag = {
                marker,
                ruler,
                trackType:marker.dataset.director3dTimelineTrackType,
                trackId:marker.dataset.director3dTimelineTrackId,
                sourceFrame:Number(marker.dataset.director3dTimelineMarker),
                targetFrame:Number(marker.dataset.director3dTimelineMarker),
                didMove:false
            };
            marker.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        container.addEventListener('pointermove', event => {
            if(!markerDrag) return;
            const bounds = markerDrag.ruler.getBoundingClientRect();
            const timeline = currentTimeline();
            const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
            const targetFrame = Math.round(ratio * Number(timeline.durationFrames || 1));
            markerDrag.targetFrame = targetFrame;
            markerDrag.didMove = markerDrag.didMove || targetFrame !== markerDrag.sourceFrame;
            markerDrag.marker.style.left = `${ratio * 100}%`;
        });

        function finishMarkerDrag(){
            if(!markerDrag) return;
            const drag = markerDrag;
            markerDrag = null;
            if(!drag.didMove) return;
            suppressMarkerClick = true;
            if(timelineStore.moveKeyframe(drag.trackType, drag.trackId, drag.sourceFrame, drag.targetFrame)){
                seek(drag.targetFrame);
            }
        }

        container.addEventListener('pointerup', finishMarkerDrag);
        container.addEventListener('pointercancel', finishMarkerDrag);

        container.addEventListener('input', event => {
            if(event.target.matches?.('[data-director3d-timeline-frame]')){
                pause();
                seek(event.target.value);
            }
        });

        container.addEventListener('change', event => {
            commitRangeInput(event.target);
        });

        container.addEventListener('keydown', event => {
            if(event.key !== 'Enter') return;
            if(!event.target.matches?.('[data-director3d-timeline-duration], [data-director3d-timeline-start], [data-director3d-timeline-end]')) return;
            event.preventDefault();
            commitRangeInput(event.target);
        });

        return Object.freeze({render, play, pause, seek, clearPreview, dispose:pause});
    }

    global.Director3DTimelineUI = Object.freeze({createTimelineUI, shotSegments, previewShotIdAtFrame, frameAtTimelinePosition});
})(window);
