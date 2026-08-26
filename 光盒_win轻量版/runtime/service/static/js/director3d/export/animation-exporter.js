(function(global){
    'use strict';

    function even(value){
        const rounded = Math.max(2, Math.round(Number(value) || 2));
        return rounded % 2 === 0 ? rounded : rounded + 1;
    }

    function animationRange(timeline = {}){
        const startFrame = Math.max(0, Math.round(Number(timeline.startFrame || 0)));
        const endFrame = Math.max(startFrame, Math.round(Number(timeline.endFrame ?? timeline.durationFrames ?? startFrame)));
        return {startFrame, endFrame, totalFrames:endFrame - startFrame + 1};
    }

    function outputSize(aspectRatio, height = 720){
        const ratio = Math.max(0.1, Number(aspectRatio?.value || aspectRatio || 16 / 9));
        const outputHeight = even(height);
        return {width:even(outputHeight * ratio), height:outputHeight};
    }

    function supportedMimeType(MediaRecorderApi){
        const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        return options.find(type => !MediaRecorderApi.isTypeSupported || MediaRecorderApi.isTypeSupported(type)) || '';
    }

    function nextFrame(delay = 0){
        return new Promise(resolve => global.setTimeout(resolve, Math.max(0, delay)));
    }

    function currentShot(state){
        const shots = Array.isArray(state.cameraShots) ? state.cameraShots : [];
        return shots.find(shot => shot?.id === state.currentShotId) || shots[0] || null;
    }

    function createAnimationExporter({store, viewport, aspectRatio = global.Director3DAspectRatio} = {}){
        if(!store?.getState || !viewport?.renderAnimationFrames){
            throw new Error('Director3DAnimationExporter requires a Director3D store and viewport renderer');
        }

        async function exportWebM({height = 720, frameRate, signal, onProgress} = {}){
            const MediaRecorderApi = global.MediaRecorder;
            if(!MediaRecorderApi || !global.document?.createElement){
                throw new Error('This browser cannot encode WebM animation');
            }
            const state = store.getState();
            const timeline = state.scene?.timeline || {};
            const range = animationRange(timeline);
            const outputFrameRate = Math.max(1, Math.min(60, Math.round(Number(frameRate) || Number(timeline.frameRate) || 24)));
            const shot = currentShot(state);
            const ratio = aspectRatio?.parse?.(shot?.aspectRatio || state.projectAspectRatio || '16:9') || {value:16 / 9, key:'16:9'};
            const size = outputSize(ratio, height);
            const canvas = global.document.createElement('canvas');
            canvas.width = size.width;
            canvas.height = size.height;
            const context = canvas.getContext('2d', {alpha:false});
            if(!context || !canvas.captureStream){
                throw new Error('This browser cannot capture animation frames');
            }
            const stream = canvas.captureStream(outputFrameRate);
            const track = stream.getVideoTracks?.()[0];
            const mimeType = supportedMimeType(MediaRecorderApi);
            const recorder = new MediaRecorderApi(stream, mimeType ? {mimeType} : undefined);
            const chunks = [];
            const completed = new Promise((resolve, reject) => {
                recorder.addEventListener('dataavailable', event => {
                    if(event.data?.size) chunks.push(event.data);
                });
                recorder.addEventListener('stop', () => resolve());
                recorder.addEventListener('error', event => reject(event.error || new Error('Animation encoding failed')));
            });
            try {
                recorder.start();
            } catch(error) {
                stream.getTracks?.().forEach(trackItem => trackItem.stop?.());
                throw error;
            }
            try {
                let nextCaptureAt = Date.now();
                await viewport.renderAnimationFrames({
                    ...range,
                    width:size.width,
                    height:size.height,
                    signal,
                    onFrame: async (sourceCanvas, frame, index, total) => {
                        if(signal?.aborted) throw new DOMException('Animation export cancelled', 'AbortError');
                        context.clearRect(0, 0, size.width, size.height);
                        context.drawImage(sourceCanvas, 0, 0, size.width, size.height);
                        track?.requestFrame?.();
                        onProgress?.({frame, index, total, progress:(index + 1) / total});
                        nextCaptureAt += 1000 / outputFrameRate;
                        await nextFrame(nextCaptureAt - Date.now());
                    }
                });
            } catch(error) {
                if(recorder.state !== 'inactive') recorder.stop();
                await completed.catch(() => {});
                stream.getTracks?.().forEach(trackItem => trackItem.stop?.());
                throw error;
            }
            if(recorder.state !== 'inactive') recorder.stop();
            await completed;
            stream.getTracks?.().forEach(trackItem => trackItem.stop?.());
            const resultMimeType = mimeType || 'video/webm';
            return {
                blob:new Blob(chunks, {type:resultMimeType}),
                mimeType:resultMimeType,
                filename:`${shot?.name || 'director-animation'}-${range.startFrame}-${range.endFrame}.webm`,
                frameRate:outputFrameRate,
                ...range,
                ...size
            };
        }

        return Object.freeze({exportWebM});
    }

    global.Director3DAnimationExporter = Object.freeze({
        animationRange,
        outputSize,
        supportedMimeType,
        createAnimationExporter
    });
})(window);
