/** Canvas-local brush editor; other image edit modes keep their existing modal. */
(function(global){
    'use strict';
    let session = null;
    const d = () => global.SmartCanvasCore?.tryDeps?.() ?? null;

    function eventPoint(event){
        const r = session.canvas.getBoundingClientRect();
        return {x:(event.clientX-r.left)*session.canvas.width/Math.max(1,r.width), y:(event.clientY-r.top)*session.canvas.height/Math.max(1,r.height)};
    }
    function syncButtons(){
        if(!session) return;
        session.tools.querySelector('[data-inline-brush-undo]').disabled = !session.strokes.length;
        session.tools.querySelector('[data-inline-brush-redo]').disabled = !session.redo.length;
        session.tools.querySelectorAll('[data-inline-brush-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.inlineBrushTool === session.tool));
    }
    function renderStrokes(){
        if(!session) return;
        const c = session.canvas.getContext('2d');
        c.clearRect(0,0,session.canvas.width,session.canvas.height);
        c.lineCap='round'; c.lineJoin='round';
        session.strokes.forEach(stroke => {
            if(!stroke.points.length) return;
            c.save();
            c.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
            c.strokeStyle=stroke.color; c.fillStyle=stroke.color; c.lineWidth=stroke.width;
            if((stroke.tool === 'rect' || stroke.tool === 'ellipse') && stroke.points.length > 1){
                const start=stroke.points[0],end=stroke.points[stroke.points.length-1];
                const x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),w=Math.abs(end.x-start.x),h=Math.abs(end.y-start.y);
                c.beginPath();
                if(stroke.tool === 'rect')c.rect(x,y,w,h);
                else c.ellipse(x+w/2,y+h/2,Math.max(.5,w/2),Math.max(.5,h/2),0,0,Math.PI*2);
                c.stroke();
            }else if(stroke.points.length === 1){
                c.beginPath(); c.arc(stroke.points[0].x,stroke.points[0].y,stroke.width/2,0,Math.PI*2); c.fill();
            }else{
                c.beginPath(); c.moveTo(stroke.points[0].x,stroke.points[0].y);
                for(let i=1;i<stroke.points.length;i++) c.lineTo(stroke.points[i].x,stroke.points[i].y);
                c.stroke();
            }
            c.restore();
        });
        syncButtons();
    }
    function liveItem(){
        if(!session) return null;
        const selector=`.image-node[data-id="${CSS.escape(session.nodeId)}"] [data-image-index="${session.imageIndex}"]`;
        return session.shell.querySelector(selector)||session.item;
    }
    function positionTools(){
        if(!session) return;
        const item=liveItem();
        if(!item?.isConnected) return;
        session.item=item;
        const shell=session.shell.getBoundingClientRect(), image=item.getBoundingClientRect();
        session.canvas.style.left=`${image.left-shell.left}px`;
        session.canvas.style.top=`${image.top-shell.top}px`;
        session.canvas.style.width=`${image.width}px`;
        session.canvas.style.height=`${image.height}px`;
        session.tools.style.left=`${image.left-shell.left+image.width/2}px`;
        session.tools.style.top=`${image.bottom-shell.top+12}px`;
    }
    function trackPosition(){
        if(!session) return;
        positionTools();
        session.positionFrame=requestAnimationFrame(trackPosition);
    }
    function makeTools(){
        const el=document.createElement('div');
        el.className='inline-brush-tools';
        el.innerHTML=`<button type="button" class="active" data-inline-brush-tool="brush" title="画笔"><i data-lucide="paintbrush"></i></button><button type="button" data-inline-brush-tool="eraser" title="橡皮擦"><i data-lucide="eraser"></i></button><button type="button" data-inline-brush-tool="rect" title="矩形框选"><i data-lucide="square"></i></button><button type="button" data-inline-brush-tool="ellipse" title="圆形框选"><i data-lucide="circle"></i></button><input data-inline-brush-color type="color" value="#ff2d55" title="颜色"><label class="inline-brush-size-control" title="笔刷大小"><input data-inline-brush-size type="range" min="3" max="72" value="14"><span data-inline-brush-size-label>14</span></label><span class="inline-brush-divider"></span><button type="button" data-inline-brush-undo title="撤销"><i data-lucide="undo-2"></i></button><button type="button" data-inline-brush-redo title="重做"><i data-lucide="redo-2"></i></button><button type="button" data-inline-brush-clear title="清除"><i data-lucide="trash-2"></i></button><button type="button" data-inline-brush-cancel title="取消"><i data-lucide="x"></i></button><button type="button" class="inline-brush-apply" data-inline-brush-apply><i data-lucide="check"></i><span>应用</span></button>`;
        return el;
    }
    function bindCanvas(){
        const canvas=session.canvas;
        canvas.addEventListener('pointerdown',event=>{
            if(event.button!==0) return;
            event.preventDefault(); event.stopPropagation(); canvas.setPointerCapture?.(event.pointerId);
            const r=canvas.getBoundingClientRect();
            const stroke={tool:session.tool,color:session.color,width:Math.max(1,session.size*canvas.width/Math.max(1,r.width)),points:[eventPoint(event)]};
            session.strokes.push(stroke); session.redo=[]; session.activeStroke=stroke; renderStrokes();
        });
        canvas.addEventListener('pointermove',event=>{
            if(!session?.activeStroke) return;
            event.preventDefault(); event.stopPropagation();
            const point=eventPoint(event);
            if(session.activeStroke.tool === 'rect' || session.activeStroke.tool === 'ellipse')session.activeStroke.points[1]=point;
            else session.activeStroke.points.push(point);
            renderStrokes();
        });
        const end=event=>{if(!session?.activeStroke)return;event.preventDefault();event.stopPropagation();session.activeStroke=null;};
        canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);
    }
    function bindTools(){
        const tools=session.tools;
        tools.addEventListener('pointerdown',event=>event.stopPropagation());
        tools.addEventListener('mousedown',event=>event.stopPropagation());
        tools.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
        tools.addEventListener('click',event=>{
            event.stopPropagation();
            if(event.target.closest('input'))return;
            event.preventDefault();
            const tool=event.target.closest('[data-inline-brush-tool]');
            if(tool){session.tool=tool.dataset.inlineBrushTool;syncButtons();return;}
            if(event.target.closest('[data-inline-brush-undo]')){const v=session.strokes.pop();if(v)session.redo.push(v);renderStrokes();return;}
            if(event.target.closest('[data-inline-brush-redo]')){const v=session.redo.pop();if(v)session.strokes.push(v);renderStrokes();return;}
            if(event.target.closest('[data-inline-brush-clear]')){session.redo.push(...session.strokes.splice(0));renderStrokes();return;}
            if(event.target.closest('[data-inline-brush-cancel]')){close({restoreComposer:true});return;}
            if(event.target.closest('[data-inline-brush-apply]')) apply();
        });
        tools.querySelector('[data-inline-brush-color]').addEventListener('input',event=>{session.color=event.target.value;});
        const sizeInput=tools.querySelector('[data-inline-brush-size]');
        const setSize=value=>{
            if(!session)return;
            const min=Number(sizeInput.min)||3,max=Number(sizeInput.max)||72;
            session.size=Math.max(min,Math.min(max,Math.round(Number(value)||14)));
            sizeInput.value=String(session.size);
            tools.querySelector('[data-inline-brush-size-label]').textContent=String(session.size);
        };
        sizeInput.addEventListener('input',event=>setSize(event.target.value));
        const sizeFromPointer=event=>{
            const rect=sizeInput.getBoundingClientRect();
            const ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
            setSize(Number(sizeInput.min)+ratio*(Number(sizeInput.max)-Number(sizeInput.min)));
        };
        sizeInput.addEventListener('pointerdown',event=>{
            event.preventDefault();event.stopPropagation();sizeInput.setPointerCapture?.(event.pointerId);sizeInput.dataset.dragging='1';sizeFromPointer(event);
        });
        sizeInput.addEventListener('pointermove',event=>{if(sizeInput.dataset.dragging==='1')sizeFromPointer(event);});
        const stopSizeDrag=event=>{if(sizeInput.dataset.dragging!=='1')return;sizeFromPointer(event);delete sizeInput.dataset.dragging;};
        sizeInput.addEventListener('pointerup',stopSizeDrag);sizeInput.addEventListener('pointercancel',()=>{delete sizeInput.dataset.dragging;});
    }
    function restoreViewport(s){
        const deps=d();if(!deps)return;
        const target={...s.returnViewport};
        const current=deps.viewport||{};
        const dx=Math.abs(Number(current.x||0)-Number(target.x||0));
        const dy=Math.abs(Number(current.y||0)-Number(target.y||0));
        const ds=Math.abs(Number(current.scale||1)-Number(target.scale||1));
        const finish=()=>{if(s.composerWasOpen)deps.updateComposer?.();deps.positionImageQuickToolbar?.();};
        if(dx<2&&dy<2&&ds<0.002){
            deps.viewport.x=target.x;deps.viewport.y=target.y;deps.viewport.scale=target.scale;
            deps.applyViewport?.();
            finish();
            return;
        }
        deps.animateViewportTo?.(target,{duration:220,onDone:finish});
    }
    function close(options={}){
        const s=session;
        if(!s) return;
        session=null; s.item?.classList?.remove('inline-brush-active'); s.canvas.remove(); s.tools.remove();
        cancelAnimationFrame(s.positionFrame);s.shell.removeEventListener('pointerdown',s.onBlankPointerDown,true);global.removeEventListener('resize',s.onResize);
        if(options.restoreViewport !== false) restoreViewport(s);
    }
    function sourceImage(s){
        return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=s.sourceUrl;});
    }
    async function apply(){
        const s=session, deps=d();
        if(!s||!deps||s.applying) return;
        if(!s.strokes.length){deps.toast?.('请先在图片上绘制');return;}
        s.applying=true;s.tools.classList.add('is-applying');
        try{
            const src=await sourceImage(s), out=document.createElement('canvas');
            out.width=s.canvas.width;out.height=s.canvas.height;
            const c=out.getContext('2d');c.drawImage(src,0,0,out.width,out.height);c.drawImage(s.canvas,0,0);
            const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));
            if(!blob)throw new Error('empty output');
            const base=String(s.image.name||'image').replace(/\.[^.]+$/,'');
            const file=await global.SmartCanvasImageEdit?.uploadCroppedBlob?.(blob,`${base}_paint.png`);
            if(!file?.url)throw new Error('upload failed');
            const rect=deps.nodeRect?.(s.node)||{x:s.node.x||0,y:s.node.y||0,width:320};
            close({restoreViewport:false});
            const createNode=global.SmartCanvasNodeFactory?.createNode || deps.createNode;
            if(typeof createNode !== 'function')throw new Error('node factory unavailable');
            const output=createNode(rect.x+rect.width+40,rect.y,[{...file,role:'output',natural_w:s.canvas.width,natural_h:s.canvas.height}],{select:true});
            if(!output)throw new Error('create node failed');
            deps.selectedIds=[];deps.selectedImage={nodeId:output.id,index:0};deps.syncSelectionUi?.();
            if(s.composerWasOpen)deps.updateComposer?.();
            requestAnimationFrame(()=>{
                const revealed=global.SmartCanvasViewport?.revealNodesAfterInlineEdit?.(s.node,output,s.returnViewport);
                if(!revealed)deps.animateViewportTo?.({...s.returnViewport},{duration:280});
            });
            deps.toast?.('绘制结果已放到原图旁边');
        }catch(error){
            console.error('[InlineBrush] apply failed',error);
            if(session===s){s.applying=false;s.tools.classList.remove('is-applying');}
            else {
                if(s.composerWasOpen)deps.updateComposer?.();
                deps.animateViewportTo?.({...s.returnViewport},{duration:280});
            }
            deps.toast?.(`应用画笔失败：${String(error?.message||error)}`);
        }
    }
    function open(options={}){
        const deps=d(), nodeId=options.nodeId||deps?.selectedImage?.nodeId, imageIndex=Number(options.imageIndex??deps?.selectedImage?.index??0);
        const node=deps?.nodes?.find?.(item=>item.id===nodeId), image=deps?.imageForDisplay?.(node?.images?.[imageIndex]);
        if(!deps||!node||!image?.url)return false;
        if(session)close();
        deps.selectedId=nodeId;deps.selectedIds=[];deps.selectedImage={nodeId,index:imageIndex};deps.syncSelectionUi?.();
        const item=deps.selectedImageElement?.(),media=item?.querySelector?.('img');
        if(!item||!media){deps.toast?.('当前内容不能使用画笔');return false;}
        const w=Number(media.naturalWidth||image.natural_w||0),h=Number(media.naturalHeight||image.natural_h||0);
        if(!w||!h){media.addEventListener('load',()=>open(options),{once:true});return true;}
        const canvas=document.createElement('canvas'),tools=makeTools();canvas.className='inline-brush-canvas';canvas.width=w;canvas.height=h;
        session={node,image,nodeId,imageIndex,item,media,canvas,tools,shell:deps.shell,sourceUrl:deps.displayMediaUrl?.(image)||image.url,strokes:[],redo:[],activeStroke:null,tool:'brush',color:'#ff2d55',size:14,composerWasOpen:Boolean(deps.composer?.classList.contains('open')),returnViewport:{x:deps.viewport.x,y:deps.viewport.y,scale:deps.viewport.scale},onResize:positionTools,onBlankPointerDown:null,positionFrame:0,applying:false};
        session.onBlankPointerDown=event=>{
            if(event.button!==0||event.target.closest?.('.inline-brush-canvas,.inline-brush-tools'))return;
            close({restoreComposer:true});
        };
        item.classList.add('inline-brush-active');deps.shell.appendChild(canvas);deps.shell.appendChild(tools);positionTools();deps.composer?.classList.remove('open');deps.hideImageQuickToolbar?.();
        bindCanvas();bindTools();deps.shell.addEventListener('pointerdown',session.onBlankPointerDown,true);global.addEventListener('resize',session.onResize);global.SmartCanvasViewport?.fitViewportToImageForInlineBrush?.(node,item);trackPosition();
        global.lucide?.createIcons?.({attrs:{'stroke-width':2}});syncButtons();return true;
    }
    const api=Object.freeze({open,close,apply,isOpen:()=>Boolean(session)});
    global.SmartCanvasCore?.register?.('inlineBrush',api);global.SmartCanvasInlineBrush=api;
})(window);
