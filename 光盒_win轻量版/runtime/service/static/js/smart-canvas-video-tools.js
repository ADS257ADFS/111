/** Canvas-local video trimming and audio separation tools. */
(function(global){
    'use strict';
    let session=null;
    const separating=new Set();
    const d=()=>global.SmartCanvasCore?.tryDeps?.()??null;

    function formatTime(value){
        const seconds=Math.max(0,Number(value)||0),minutes=Math.floor(seconds/60),rest=seconds-minutes*60;
        return `${String(minutes).padStart(2,'0')}:${rest.toFixed(2).padStart(5,'0')}`;
    }
    async function responseJson(response){
        if(response.ok)return response.json();
        let message='视频处理失败';
        try{const data=await response.json();message=data?.detail||message;}catch(error){message=(await response.text())||message;}
        throw new Error(message);
    }
    function currentItem(s){
        const selector=`.image-node[data-id="${CSS.escape(s.nodeId)}"] [data-image-index="${s.imageIndex}"]`;
        return s.shell.querySelector(selector)||s.item;
    }
    function positionPanel(){
        const s=session;if(!s)return;
        const item=currentItem(s),rect=item?.getBoundingClientRect?.(),shellRect=s.shell.getBoundingClientRect();if(!rect)return;
        s.panel.style.left=`${rect.left-shellRect.left+rect.width/2}px`;
        s.panel.style.top=`${rect.bottom-shellRect.top+12}px`;
    }
    function restore(s){
        const deps=d();if(!deps)return;
        try{s.media.currentTime=Math.min(s.originalTime,s.media.duration||s.originalTime);s.media.muted=s.originalMuted;if(s.originalPaused)s.media.pause();else s.media.play().catch(()=>{});}catch(error){}
        deps.animateViewportTo?.(s.returnViewport,{duration:220,onDone:()=>{if(s.composerWasOpen)deps.updateComposer?.();deps.positionImageQuickToolbar?.();}});
    }
    function close(options={}){
        const s=session;if(!s)return;session=null;s.abort?.abort?.();cancelAnimationFrame(s.frame);s.panel.remove();s.item?.classList?.remove('inline-video-trim-active');s.shell.classList.remove('inline-video-trim-open');s.shell.removeEventListener('pointerdown',s.blankHandler,true);global.removeEventListener('resize',positionPanel);if(options.restoreViewport!==false)restore(s);
    }
    function renderRange(s,previewTime){
        s.startInput.value=String(s.start);s.endInput.value=String(s.end);
        s.startLabel.textContent=formatTime(s.start);s.endLabel.textContent=formatTime(s.end);
        const startPercent=s.start/s.duration*100,endPercent=s.end/s.duration*100;
        Object.assign(s.fill.style,{left:`${startPercent}%`,width:`${endPercent-startPercent}%`});
        Object.assign(s.startShade.style,{left:'0',width:`${startPercent}%`});
        Object.assign(s.endShade.style,{left:`${endPercent}%`,width:`${100-endPercent}%`});
        if(s.durationLabel)s.durationLabel.textContent=`${(s.end-s.start).toFixed(2)} s`;
        if(Number.isFinite(previewTime)){
            try{s.media.pause();s.media.currentTime=Math.min(previewTime,Math.max(0,s.duration-.02));}catch(error){}
        }
    }
    function syncRange(s,changed){
        const minimum=Math.min(.1,Math.max(.01,s.duration/10));
        if(changed==='start')s.start=Math.min(Number(s.startInput.value)||0,s.end-minimum);
        else s.end=Math.max(Number(s.endInput.value)||s.duration,s.start+minimum);
        s.start=Math.max(0,Math.min(s.duration-minimum,s.start));s.end=Math.max(s.start+minimum,Math.min(s.duration,s.end));
        renderRange(s,changed==='start'?s.start:s.end);
    }
    function bindSelectionDrag(s){
        s.fill.addEventListener('pointerdown',event=>{
            if(event.button!==0||s.applying)return;
            event.preventDefault();event.stopPropagation();
            const trackRect=s.range.getBoundingClientRect(),length=s.end-s.start,originStart=s.start,originX=event.clientX;
            if(!trackRect.width)return;
            s.fill.classList.add('is-dragging');
            const move=moveEvent=>{
                const delta=(moveEvent.clientX-originX)*s.duration/trackRect.width;
                const nextStart=Math.max(0,Math.min(s.duration-length,originStart+delta));
                s.start=nextStart;s.end=nextStart+length;
                renderRange(s,s.start);
            };
            const finish=()=>{
                global.removeEventListener('pointermove',move);
                global.removeEventListener('pointerup',finish);
                global.removeEventListener('pointercancel',finish);
                s.fill.classList.remove('is-dragging');
            };
            global.addEventListener('pointermove',move);
            global.addEventListener('pointerup',finish,{once:true});
            global.addEventListener('pointercancel',finish,{once:true});
        });
    }
    function waitForVideoEvent(target,type,signal){
        return new Promise((resolve,reject)=>{
            const done=()=>{cleanup();resolve();};
            const failed=()=>{cleanup();reject(new Error('无法生成视频预览'))};
            const aborted=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};
            const cleanup=()=>{target.removeEventListener(type,done);target.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted);};
            target.addEventListener(type,done,{once:true});target.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true});
        });
    }
    async function generateTimelineFrames(s){
        const slots=[...s.thumbnails.children];if(!slots.length)return;
        const sampler=document.createElement('video');sampler.preload='auto';sampler.muted=true;sampler.playsInline=true;sampler.src=s.media.currentSrc||s.media.src||s.image.url;
        try{
            if(sampler.readyState<2)await waitForVideoEvent(sampler,'loadeddata',s.abort.signal);
            const canvas=document.createElement('canvas');canvas.width=120;canvas.height=68;const context=canvas.getContext('2d');if(!context)return;
            for(let index=0;index<slots.length;index+=1){
                const sampleTime=slots.length===1?0:(s.duration-.02)*index/(slots.length-1);
                if(sampleTime>0){sampler.currentTime=Math.max(0,sampleTime);await waitForVideoEvent(sampler,'seeked',s.abort.signal);}
                context.drawImage(sampler,0,0,canvas.width,canvas.height);
                const image=document.createElement('img');image.alt='';image.draggable=false;image.src=canvas.toDataURL('image/jpeg',.72);slots[index].replaceChildren(image);
            }
        }catch(error){if(error?.name!=='AbortError')console.warn('[SmartCanvasVideoTools] preview frames unavailable',error);}
        finally{sampler.removeAttribute('src');sampler.load?.();}
    }
    function panelHtml(){
        const frames=Array.from({length:12},()=>'<span></span>').join('');
        return `<div class="inline-video-trim-head"><strong>视频剪辑</strong><span>拖动选区移动，拉两端调整</span></div><button type="button" data-video-trim-play title="播放选区"><i data-lucide="play"></i></button><span class="inline-video-trim-time" data-video-trim-start-label>00:00.00</span><div class="inline-video-trim-range" data-video-trim-track><div class="inline-video-trim-thumbnails" data-video-trim-thumbnails>${frames}</div><span class="inline-video-trim-shade" data-video-trim-start-shade></span><span class="inline-video-trim-shade" data-video-trim-end-shade></span><span data-video-trim-fill><em data-video-trim-duration></em></span><input type="range" min="0" step="0.01" value="0" data-video-trim-start><input type="range" min="0" step="0.01" value="0" data-video-trim-end></div><span class="inline-video-trim-time" data-video-trim-end-label>00:00.00</span><button type="button" data-video-trim-cancel title="取消"><i data-lucide="x"></i></button><button type="button" class="inline-video-trim-apply" data-video-trim-apply><i data-lucide="check"></i><span>应用剪辑</span></button>`;
    }
    async function apply(){
        const s=session,deps=d();if(!s||s.applying)return;s.applying=true;s.panel.classList.add('is-applying');
        try{
            const response=await fetch('/api/media/video/trim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:s.image.url,start:s.start,end:s.end})});
            const result=await responseJson(response),video=result?.video;if(!video?.url)throw new Error('剪辑结果为空');
            const createNode=global.SmartCanvasNodeFactory?.createNode||deps.createNode,rect=deps.nodeRect?.(s.node)||{x:s.node.x||0,y:s.node.y||0,width:320,height:240};if(typeof createNode!=='function')throw new Error('节点创建功能不可用');
            deps.pushUndo?.();
            const trimmedNode=createNode(rect.x+rect.width+40,rect.y,[{...s.image,...video,role:s.image.role||'output'}],{select:false,skipUndo:true});
            trimmedNode.title=`${s.node.title||'视频'} 剪辑`;trimmedNode.outputKind='video';trimmedNode.portLinkKind='video';
            deps.selectedId=trimmedNode.id;deps.selectedIds=[];deps.selectedImage={nodeId:trimmedNode.id,index:0};
            close({restoreViewport:false});
            deps.render?.();deps.scheduleSave?.();deps.syncSelectionUi?.();
            requestAnimationFrame(()=>global.SmartCanvasViewport?.revealNodesAfterInlineEdit?.(s.node,trimmedNode,s.returnViewport));
            deps.toast?.('视频剪辑完成');
        }catch(error){console.error('[SmartCanvasVideoTools] trim failed',error);if(session===s){s.applying=false;s.panel.classList.remove('is-applying');}deps.toast?.(`视频剪辑失败：${String(error?.message||error)}`);}
    }
    function bind(s){
        ['pointerdown','mousedown','click'].forEach(type=>s.panel.addEventListener(type,event=>event.stopPropagation()));
        s.startInput.addEventListener('input',()=>syncRange(s,'start'));s.endInput.addEventListener('input',()=>syncRange(s,'end'));bindSelectionDrag(s);
        s.panel.addEventListener('click',event=>{
            if(event.target.closest('[data-video-trim-cancel]')){close();return;}
            if(event.target.closest('[data-video-trim-apply]')){apply();return;}
            if(event.target.closest('[data-video-trim-play]')){
                if(s.media.paused){if(s.media.currentTime<s.start||s.media.currentTime>=s.end)s.media.currentTime=s.start;s.media.play().catch(()=>{});}else s.media.pause();
            }
        });
        s.media.addEventListener('timeupdate',()=>{if(session===s&&s.media.currentTime>=s.end){s.media.pause();s.media.currentTime=s.start;}},{signal:s.abort.signal});
    }
    async function mediaDuration(media){
        if(Number.isFinite(media.duration)&&media.duration>0)return media.duration;
        return new Promise((resolve,reject)=>{
            const done=()=>resolve(Number(media.duration)||0);const fail=()=>reject(new Error('无法读取视频时长'));
            media.addEventListener('loadedmetadata',done,{once:true});media.addEventListener('error',fail,{once:true});media.load?.();
        });
    }
    async function open(options={}){
        const deps=d(),nodeId=options.nodeId||deps?.selectedImage?.nodeId,imageIndex=Number(options.imageIndex??deps?.selectedImage?.index??0);
        const node=deps?.nodes?.find?.(item=>item.id===nodeId),image=deps?.imageForDisplay?.(node?.images?.[imageIndex]);if(!deps||!node||!image?.url||deps.mediaKindForItem?.(image)!=='video')return false;
        if(session)close({restoreViewport:false});global.SmartCanvasInlineImageTools?.close?.();global.SmartCanvasInlineBrush?.close?.();
        deps.selectedId=nodeId;deps.selectedIds=[];deps.selectedImage={nodeId,index:imageIndex};deps.syncSelectionUi?.();
        const item=deps.selectedImageElement?.(),media=item?.querySelector?.('video');if(!item||!media){deps.toast?.('当前视频不能剪辑');return false;}
        let duration;try{duration=await mediaDuration(media);}catch(error){deps.toast?.(error.message);return false;}if(!duration)return false;
        const panel=document.createElement('section');panel.className='inline-video-trim-panel';panel.innerHTML=panelHtml();
        session={node,nodeId,imageIndex,image,item,media,panel,shell:deps.shell,duration,start:0,end:duration,applying:false,frame:0,abort:new AbortController(),originalTime:Number(media.currentTime)||0,originalMuted:Boolean(media.muted),originalPaused:Boolean(media.paused),composerWasOpen:Boolean(deps.composer?.classList.contains('open')),returnViewport:{x:deps.viewport.x,y:deps.viewport.y,scale:deps.viewport.scale},blankHandler:null};
        const s=session;s.range=panel.querySelector('[data-video-trim-track]');s.thumbnails=panel.querySelector('[data-video-trim-thumbnails]');s.startShade=panel.querySelector('[data-video-trim-start-shade]');s.endShade=panel.querySelector('[data-video-trim-end-shade]');s.startInput=panel.querySelector('[data-video-trim-start]');s.endInput=panel.querySelector('[data-video-trim-end]');s.fill=panel.querySelector('[data-video-trim-fill]');s.durationLabel=panel.querySelector('[data-video-trim-duration]');s.startLabel=panel.querySelector('[data-video-trim-start-label]');s.endLabel=panel.querySelector('[data-video-trim-end-label]');s.startInput.max=String(duration);s.endInput.max=String(duration);s.endInput.value=String(duration);
        s.blankHandler=event=>{if(event.button!==0||event.target.closest?.('.inline-video-trim-panel,.image-quick-toolbar'))return;close();};
        item.classList.add('inline-video-trim-active');deps.shell.classList.add('inline-video-trim-open');deps.shell.appendChild(panel);deps.composer?.classList.remove('open');bind(s);syncRange(s,'end');generateTimelineFrames(s);deps.shell.addEventListener('pointerdown',s.blankHandler,true);global.addEventListener('resize',positionPanel);global.SmartCanvasViewport?.fitViewportToImageForInlineBrush?.(node,item);const track=()=>{if(session!==s)return;positionPanel();s.frame=requestAnimationFrame(track);};track();global.lucide?.createIcons?.({attrs:{'stroke-width':2}});return true;
    }
    async function separate(options={}){
        const deps=d(),nodeId=options.nodeId||deps?.selectedImage?.nodeId,imageIndex=Number(options.imageIndex??deps?.selectedImage?.index??0),key=`${nodeId}:${imageIndex}`;
        const node=deps?.nodes?.find?.(item=>item.id===nodeId),image=deps?.imageForDisplay?.(node?.images?.[imageIndex]);if(!deps||!node||!image?.url||deps.mediaKindForItem?.(image)!=='video'||separating.has(key))return false;
        separating.add(key);deps.toast?.('正在分离音视频…');
        try{
            const response=await fetch('/api/media/video/separate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:image.url})});
            const result=await responseJson(response);if(!result?.video?.url||!result?.audio?.url)throw new Error('分离结果为空');
            const createNode=global.SmartCanvasNodeFactory?.createNode||deps.createNode,rect=deps.nodeRect?.(node)||{x:node.x||0,y:node.y||0,width:320,height:240};if(typeof createNode!=='function')throw new Error('节点创建功能不可用');
            deps.pushUndo?.();
            const videoNode=createNode(rect.x+rect.width+40,rect.y,[{...image,...result.video,role:'output'}],{select:false,skipUndo:true});videoNode.title='无声视频';videoNode.outputKind='video';
            const videoRect=deps.nodeRect?.(videoNode)||{height:rect.height};
            const audioNode=createNode(rect.x+rect.width+40,rect.y+videoRect.height+40,[{...result.audio,role:'output'}],{select:false,skipUndo:true});audioNode.title='独立音频';audioNode.outputKind='audio';
            deps.selectedId=videoNode.id;deps.selectedIds=[];deps.selectedImage={nodeId:videoNode.id,index:0};deps.render?.();deps.scheduleSave?.();deps.syncSelectionUi?.();requestAnimationFrame(()=>global.SmartCanvasViewport?.revealNodesAfterInlineEdit?.(node,audioNode,{x:deps.viewport.x,y:deps.viewport.y,scale:deps.viewport.scale}));deps.toast?.('音视频分离完成');return true;
        }catch(error){console.error('[SmartCanvasVideoTools] separate failed',error);deps.toast?.(`音视频分离失败：${String(error?.message||error)}`);return false;}finally{separating.delete(key);}
    }
    const capturing=new Set();
    async function captureFrame(options={}){
        const deps=d(),nodeId=options.nodeId||deps?.selectedImage?.nodeId,imageIndex=Number(options.imageIndex??deps?.selectedImage?.index??0),key=`${nodeId}:${imageIndex}`;
        const node=deps?.nodes?.find?.(item=>item.id===nodeId),image=deps?.imageForDisplay?.(node?.images?.[imageIndex]);
        if(!deps||!node||!image?.url||deps.mediaKindForItem?.(image)!=='video'||capturing.has(key))return false;
        capturing.add(key);
        let cleanup=null;
        try{
            // 优先用画布内正在展示的 video（保留用户当前播放到的画面）；
            // 没加载好就用离屏 video 采首帧。
            const host=deps.shell?.querySelector?.(`.image-node[data-id="${CSS.escape(String(nodeId))}"] [data-image-index="${imageIndex}"]`)
                ||deps.shell?.querySelector?.(`.image-node[data-id="${CSS.escape(String(nodeId))}"]`);
            const inline=host?.querySelector?.('video');
            let source=inline;
            if(!inline||inline.readyState<2||!inline.videoWidth){
                const targetTime=Number(inline?.currentTime)||0;
                const sampler=document.createElement('video');
                sampler.preload='auto';sampler.muted=true;sampler.playsInline=true;
                sampler.src=inline?.currentSrc||inline?.src||image.url;
                cleanup=()=>{sampler.removeAttribute('src');sampler.load?.();};
                if(sampler.readyState<2)await waitForVideoEvent(sampler,'loadeddata');
                if(targetTime>0){sampler.currentTime=targetTime;await waitForVideoEvent(sampler,'seeked');}
                source=sampler;
            }else{
                inline.pause?.();
            }
            if(!source.videoWidth||!source.videoHeight)throw new Error('视频尚未加载完成，请稍后重试');
            const canvas=document.createElement('canvas');canvas.width=source.videoWidth;canvas.height=source.videoHeight;
            canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            if(!blob)throw new Error('截帧失败');
            const base=String(image.name||node.title||'视频').replace(/\.[a-z0-9]{2,8}$/i,'')||'视频';
            const uploadFiles=global.SmartCanvasUpload?.uploadFiles||deps.uploadFiles;
            const uploaded=await uploadFiles?.([new File([blob],`${base}-静帧.png`,{type:'image/png'})]);
            const frame=uploaded?.[0];if(!frame?.url)throw new Error('静帧保存失败');
            frame.kind='image';frame.natural_w=canvas.width;frame.natural_h=canvas.height;
            const createNode=global.SmartCanvasNodeFactory?.createNode||deps.createNode;if(typeof createNode!=='function')throw new Error('节点创建功能不可用');
            const rect=deps.nodeRect?.(node)||{x:node.x||0,y:node.y||0,width:320,height:240};
            deps.pushUndo?.();
            const frameNode=createNode(rect.x+rect.width+40,rect.y,[frame],{select:false,skipUndo:true});
            frameNode.title=`${node.title||'视频'} 静帧`;
            deps.selectedId=frameNode.id;deps.selectedIds=[];deps.selectedImage={nodeId:frameNode.id,index:0};
            deps.render?.();deps.scheduleSave?.();deps.syncSelectionUi?.();
            deps.toast?.('已截取静帧到画布');
            return true;
        }catch(error){console.error('[SmartCanvasVideoTools] capture frame failed',error);deps.toast?.(`截取静帧失败：${String(error?.message||error)}`);return false;}
        finally{cleanup?.();capturing.delete(key);}
    }
    const api=Object.freeze({open,close,separate,captureFrame,formatTime,isOpen:()=>Boolean(session)});global.SmartCanvasCore?.register?.('videoTools',api);global.SmartCanvasVideoTools=api;
})(window);
