/** Canvas-local crop, outpaint, grid, panorama, and compare tools. */
(function(global){
    'use strict';
    let session=null;
    const d=()=>global.SmartCanvasCore?.tryDeps?.()??null;
    const ratios=[['original','原比例'],['1:1','1:1'],['2:3','2:3'],['3:2','3:2'],['3:4','3:4'],['9:16','9:16'],['16:9','16:9']];
    const ratioValue=(key,s)=>key==='original'?s.naturalW/s.naturalH:Number(key.split(':')[0])/Number(key.split(':')[1]);
    function outpaintReferencePlan(options={}){
        const sourceWidth=Math.max(1,Math.round(Number(options.sourceWidth)||1));
        const sourceHeight=Math.max(1,Math.round(Number(options.sourceHeight)||1));
        const targetWidth=Math.max(sourceWidth,Math.round(Number(options.width)||sourceWidth));
        const targetHeight=Math.max(sourceHeight,Math.round(Number(options.height)||sourceHeight));
        const maxEdge=Math.max(64,Math.round(Number(options.maxEdge)||1536));
        const scale=Math.min(1,maxEdge/Math.max(targetWidth,targetHeight));
        const width=Math.max(1,Math.round(targetWidth*scale));
        const height=Math.max(1,Math.round(targetHeight*scale));
        const drawWidth=Math.max(1,Math.round(sourceWidth*scale));
        const drawHeight=Math.max(1,Math.round(sourceHeight*scale));
        return {width,height,sourceX:Math.round((width-drawWidth)/2),sourceY:Math.round((height-drawHeight)/2),sourceWidth:drawWidth,sourceHeight:drawHeight};
    }

    function liveItem(s){
        const selector=`.image-node[data-id="${CSS.escape(s.nodeId)}"] [data-image-index="${s.imageIndex}"]`;
        return s.shell.querySelector(selector)||s.item;
    }
    function currentImageRect(s){return liveItem(s)?.getBoundingClientRect?.()||null;}
    function imageToolQuickToolbarPosition(left,top,width,toolbarHeight){
        return {left:left+width/2,top:top-toolbarHeight-12};
    }
    function positionQuickToolbar(s,left,top,width){
        const toolbar=document.getElementById('imageQuickToolbar');if(!toolbar)return;
        const position=imageToolQuickToolbarPosition(left,top,width,toolbar.offsetHeight||40);
        toolbar.hidden=false;toolbar.style.display='flex';toolbar.style.left=`${position.left}px`;toolbar.style.top=`${position.top}px`;toolbar.classList.add('open');
    }
    function panelHtml(mode){
        const ratioButtons=ratios.map(([value,label])=>`<button type="button" data-inline-ratio="${value}" class="${value==='original'?'active':''}">${label}</button>`).join('');
        const applyLabel={crop:'应用裁切',outpaint:'应用扩图',grid:'应用切分',panorama:'应用全景',compare:'应用多视角'}[mode]||'应用';
        const modeControls=mode==='grid'
            ? `<div class="inline-image-presets">${['1x2','2x1','2x2','2x3','3x2','3x3'].map(value=>`<button type="button" data-grid-preset="${value}" class="${value==='2x2'?'active':''}">${value}</button>`).join('')}</div>`
            : mode==='compare'
            ? `<label class="inline-image-compare-control"><span>对比位置</span><input type="range" min="5" max="95" value="50" data-compare-position></label>`
            : `<div class="inline-image-ratios">${ratioButtons}</div>`;
        return `<div class="inline-image-tool-head"><strong>${{crop:'裁切',outpaint:'扩图',grid:'宫格切分',panorama:'全景',compare:'多视角'}[mode]}</strong><span>${mode==='panorama'?'拖动图片调整视角':mode==='compare'?'对比当前图和上游参考图':'拖动框体或控制点调整'}</span></div>${modeControls}<span class="inline-image-tool-divider"></span><button type="button" data-inline-tool-reset title="重置"><i data-lucide="rotate-ccw"></i></button><button type="button" data-inline-tool-cancel title="取消"><i data-lucide="x"></i></button><button type="button" class="inline-image-tool-apply" data-inline-tool-apply><i data-lucide="check"></i><span>${applyLabel}</span></button>`;
    }
    function makeUi(mode){
        const overlay=document.createElement('div');overlay.className=`inline-image-tool-overlay mode-${mode}`;
        const panel=document.createElement('div');panel.className='inline-image-tool-panel';panel.innerHTML=panelHtml(mode);
        if(mode==='crop')overlay.innerHTML='<div class="inline-crop-box" data-inline-crop-move><i data-crop-handle="nw"></i><i data-crop-handle="ne"></i><i data-crop-handle="sw"></i><i data-crop-handle="se"></i></div>';
        else if(mode==='outpaint')overlay.innerHTML='<div class="inline-outpaint-source"><img class="inline-outpaint-image" alt=""></div><i data-outpaint-handle="nw"></i><i data-outpaint-handle="ne"></i><i data-outpaint-handle="sw"></i><i data-outpaint-handle="se"></i>';
        else if(mode==='grid')overlay.innerHTML='<div class="inline-grid-lines"></div>';
        else if(mode==='compare')overlay.innerHTML='<img class="inline-compare-image" alt=""><span class="inline-compare-divider"></span>';
        else if(mode==='panorama')overlay.innerHTML='<div class="inline-panorama-window"><img alt=""></div><span class="inline-panorama-hint">左右拖动查看</span>';
        return {overlay,panel};
    }
    function setBoxForRatio(s,key){
        s.ratioKey=key;const ratio=ratioValue(key,s);
        if(s.mode==='outpaint'){
            let w=Math.max(s.naturalW,s.naturalH*ratio),h=w/ratio;
            if(h<s.naturalH){h=s.naturalH;w=h*ratio;}
            s.outpaint={w:w*1.12,h:h*1.12};
        }else if(s.mode==='crop'){
            const maxW=s.naturalW*.9,maxH=s.naturalH*.9;
            let w=maxW,h=w/ratio;if(h>maxH){h=maxH;w=h*ratio;}
            s.crop={x:(s.naturalW-w)/2,y:(s.naturalH-h)/2,w,h};
        }else if(s.mode==='panorama')s.panoramaRatio=ratio;
        s.panel.querySelectorAll('[data-inline-ratio]').forEach(btn=>btn.classList.toggle('active',btn.dataset.inlineRatio===key));
        positionUi();
        if(s.mode==='outpaint')fitViewportToTool(s);
    }
    function fitViewportToTool(s){
        const deps=d(),image=currentImageRect(s);if(!deps?.shell||!image)return;
        const margin={top:18,bottom:18,x:24},panelReserve=68;
        const availW=Math.max(160,deps.shell.clientWidth-margin.x*2);
        const availH=Math.max(160,deps.shell.clientHeight-margin.top-margin.bottom-panelReserve);
        const previewW=image.width*(s.outpaint.w/s.naturalW),previewH=image.height*(s.outpaint.h/s.naturalH);
        const currentScale=Math.max(.0001,Number(deps.viewport.scale)||1);
        const targetScale=Math.max(.06,Math.min(3,currentScale*Math.min(availW/Math.max(1,previewW),availH/Math.max(1,previewH))*.9));
        const factor=targetScale/currentScale,shellRect=deps.shell.getBoundingClientRect();
        const imageCenterX=image.left-shellRect.left+image.width/2,imageCenterY=image.top-shellRect.top+image.height/2;
        const worldScreenX=imageCenterX-deps.viewport.x,worldScreenY=imageCenterY-deps.viewport.y;
        const worldCenterX=worldScreenX/currentScale;
        const alignedX=scale=>global.SmartCanvasViewport?.composerAlignedViewportX?.(worldCenterX,scale)
            ?? deps.shell.clientWidth/2-worldCenterX*scale;
        deps.animateViewportTo?.({
            x:alignedX(targetScale),
            y:margin.top+availH/2-worldScreenY*factor,
            scale:targetScale
        },{
            duration:240,
            resolveX:({scale})=>alignedX(scale),
            onDone(){
                positionUi();
                global.SmartCanvasViewport?.settleImageAtComposerCenter?.(worldCenterX,targetScale,520,{requireOpen:false});
            }
        });
    }
    function positionUi(){
        const s=session;if(!s)return;s.shell.scrollLeft=0;s.shell.scrollTop=0;const image=currentImageRect(s);if(!image)return;
        const shell=s.shell.getBoundingClientRect();let left=image.left-shell.left,top=image.top-shell.top,width=image.width,height=image.height;
        if(s.mode==='outpaint'){
            width=image.width*(s.outpaint.w/s.naturalW);height=image.height*(s.outpaint.h/s.naturalH);
            left=image.left-shell.left-(width-image.width)/2;top=image.top-shell.top-(height-image.height)/2;
        }
        Object.assign(s.overlay.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
        s.panel.style.left=`${left+width/2}px`;s.panel.style.top=`${top+height+12}px`;
        positionQuickToolbar(s,left,top,width);
        if(s.mode==='crop'){
            const box=s.overlay.querySelector('.inline-crop-box');
            Object.assign(box.style,{left:`${s.crop.x/s.naturalW*100}%`,top:`${s.crop.y/s.naturalH*100}%`,width:`${s.crop.w/s.naturalW*100}%`,height:`${s.crop.h/s.naturalH*100}%`});
        }else if(s.mode==='outpaint'){
            const source=s.overlay.querySelector('.inline-outpaint-source');
            Object.assign(source.style,{left:`${(s.outpaint.w-s.naturalW)/2/s.outpaint.w*100}%`,top:`${(s.outpaint.h-s.naturalH)/2/s.outpaint.h*100}%`,width:`${s.naturalW/s.outpaint.w*100}%`,height:`${s.naturalH/s.outpaint.h*100}%`});
        }else if(s.mode==='grid')renderGrid(s);
        else if(s.mode==='compare'){
            const before=s.overlay.querySelector('.inline-compare-image');before.style.clipPath=`inset(0 ${100-s.comparePosition}% 0 0)`;
            s.overlay.querySelector('.inline-compare-divider').style.left=`${s.comparePosition}%`;
        }else if(s.mode==='panorama'){
            const img=s.overlay.querySelector('img');img.style.transform=`translateX(${s.panX}px) scale(1.18)`;
        }
    }
    function track(){if(!session)return;positionUi();session.frame=requestAnimationFrame(track);}
    function renderGrid(s){
        const lines=s.overlay.querySelector('.inline-grid-lines');lines.innerHTML='';
        for(let row=1;row<s.gridRows;row++){const line=document.createElement('i');line.className='horizontal';line.style.top=`${row/s.gridRows*100}%`;lines.appendChild(line);}
        for(let col=1;col<s.gridCols;col++){const line=document.createElement('i');line.className='vertical';line.style.left=`${col/s.gridCols*100}%`;lines.appendChild(line);}
    }
    function pointerToNatural(s,event){
        const image=currentImageRect(s),x=(event.clientX-image.left)/Math.max(1,image.width)*s.naturalW,y=(event.clientY-image.top)/Math.max(1,image.height)*s.naturalH;
        return {x,y};
    }
    function beginDrag(event){
        const s=session;if(!s||event.button!==0)return;
        const cropHandle=event.target.closest('[data-crop-handle]'),outpaintHandle=event.target.closest('[data-outpaint-handle]');
        if(s.mode==='panorama')s.drag={type:'panorama',startX:event.clientX,startPan:s.panX};
        else if(cropHandle)s.drag={type:'crop-resize',handle:cropHandle.dataset.cropHandle,start:{...s.crop}};
        else if(event.target.closest('[data-inline-crop-move]'))s.drag={type:'crop-move',point:pointerToNatural(s,event),start:{...s.crop}};
        else if(outpaintHandle)s.drag={type:'outpaint',handle:outpaintHandle.dataset.outpaintHandle,startX:event.clientX,startY:event.clientY,start:{...s.outpaint}};
        else return;
        event.preventDefault();event.stopPropagation();s.overlay.setPointerCapture?.(event.pointerId);
    }
    function moveDrag(event){
        const s=session;if(!s?.drag)return;
        if(s.drag.type==='panorama')s.panX=s.drag.startPan+(event.clientX-s.drag.startX);
        else if(s.drag.type==='crop-move'){
            const p=pointerToNatural(s,event),dx=p.x-s.drag.point.x,dy=p.y-s.drag.point.y;
            s.crop.x=Math.max(0,Math.min(s.naturalW-s.crop.w,s.drag.start.x+dx));s.crop.y=Math.max(0,Math.min(s.naturalH-s.crop.h,s.drag.start.y+dy));
        }else if(s.drag.type==='crop-resize'){
            const p=pointerToNatural(s,event),start=s.drag.start,handle=s.drag.handle,ratio=ratioValue(s.ratioKey,s);
            const anchorX=handle.includes('w')?start.x+start.w:start.x,anchorY=handle.includes('n')?start.y+start.h:start.y;
            let w=Math.max(24,Math.abs(p.x-anchorX)),h=w/ratio;
            if(h>Math.abs(p.y-anchorY)){h=Math.max(24,Math.abs(p.y-anchorY));w=h*ratio;}
            w=Math.min(w,s.naturalW);h=Math.min(h,s.naturalH);if(w/h>ratio)w=h*ratio;else h=w/ratio;
            s.crop.w=w;s.crop.h=h;s.crop.x=handle.includes('w')?anchorX-w:anchorX;s.crop.y=handle.includes('n')?anchorY-h:anchorY;
            s.crop.x=Math.max(0,Math.min(s.naturalW-w,s.crop.x));s.crop.y=Math.max(0,Math.min(s.naturalH-h,s.crop.y));
        }else if(s.drag.type==='outpaint'){
            const image=currentImageRect(s),handle=s.drag.handle||'se',xDirection=handle.includes('e')?1:-1,yDirection=handle.includes('s')?1:-1;
            const growW=(event.clientX-s.drag.startX)*xDirection*2/Math.max(1,image.width)*s.naturalW;
            const growH=(event.clientY-s.drag.startY)*yDirection*2/Math.max(1,image.height)*s.naturalH;
            const ratio=ratioValue(s.ratioKey,s),widthCandidate=s.drag.start.w+growW,heightCandidate=s.drag.start.h+growH;
            let w=Math.abs(growW/s.drag.start.w)>=Math.abs(growH/s.drag.start.h)?widthCandidate:heightCandidate*ratio,h=w/ratio;
            if(w<s.naturalW){w=s.naturalW;h=w/ratio;}if(h<s.naturalH){h=s.naturalH;w=h*ratio;}s.outpaint={w,h};
        }
        event.preventDefault();event.stopPropagation();positionUi();
    }
    function endDrag(){if(!session)return;const shouldRefit=session.drag?.type==='outpaint';session.drag=null;if(shouldRefit)fitViewportToTool(session);}
    function bindUi(s){
        s.overlay.addEventListener('pointerdown',beginDrag);s.overlay.addEventListener('pointermove',moveDrag);s.overlay.addEventListener('pointerup',endDrag);s.overlay.addEventListener('pointercancel',endDrag);
        ['pointerdown','mousedown','click'].forEach(type=>s.panel.addEventListener(type,event=>event.stopPropagation()));
        s.panel.addEventListener('click',event=>{
            const ratio=event.target.closest('[data-inline-ratio]');if(ratio){setBoxForRatio(s,ratio.dataset.inlineRatio);return;}
            const preset=event.target.closest('[data-grid-preset]');if(preset){[s.gridRows,s.gridCols]=preset.dataset.gridPreset.split('x').map(Number);s.panel.querySelectorAll('[data-grid-preset]').forEach(btn=>btn.classList.toggle('active',btn===preset));renderGrid(s);return;}
            if(event.target.closest('[data-inline-tool-reset]')){reset(s);return;}
            if(event.target.closest('[data-inline-tool-cancel]')){close();return;}
            if(event.target.closest('[data-inline-tool-apply]'))apply();
        });
        const compare=s.panel.querySelector('[data-compare-position]');if(compare)compare.addEventListener('input',event=>{s.comparePosition=Number(event.target.value)||50;positionUi();});
    }
    function reset(s){s.gridRows=2;s.gridCols=2;s.comparePosition=50;s.panX=0;setBoxForRatio(s,'original');}
    function restore(s){
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
        const s=session;if(!s)return;session=null;cancelAnimationFrame(s.frame);s.overlay.remove();s.panel.remove();s.item?.classList?.remove('inline-image-tool-active');s.shell.classList.remove('inline-image-tool-open');s.shell.removeEventListener('pointerdown',s.blankHandler,true);global.removeEventListener('resize',positionUi);if(options.restoreViewport!==false)restore(s);
    }
    function imageFromUrl(url){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}
    async function outpaintLayoutReference(s,width,height){
        const source=await imageFromUrl(s.sourceUrl),plan=outpaintReferencePlan({sourceWidth:s.naturalW,sourceHeight:s.naturalH,width,height,maxEdge:1536});
        const canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;
        const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(source,plan.sourceX,plan.sourceY,plan.sourceWidth,plan.sourceHeight);
        return {url:canvas.toDataURL('image/png'),name:'outpaint-layout-guide.png',kind:'image',outpaintLayoutGuide:true};
    }
    async function uploadCanvas(canvas,name){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('empty output');return global.SmartCanvasImageEdit?.uploadCroppedBlob?.(blob,name);}
    function outpaintPrompt(options={}){
        const sourceWidth=Math.max(1,Math.round(Number(options.sourceWidth)||1));
        const sourceHeight=Math.max(1,Math.round(Number(options.sourceHeight)||1));
        const width=Math.max(sourceWidth,Math.round(Number(options.width)||sourceWidth));
        const height=Math.max(sourceHeight,Math.round(Number(options.height)||sourceHeight));
        return [
            `Outpaint the supplied reference image into a ${width} x ${height} canvas while keeping the original ${sourceWidth} x ${sourceHeight} image centered and unchanged.`,
            'The first reference image is a transparent target-canvas layout guide: preserve its centered opaque source region exactly and fill every transparent region with newly generated scene content.',
            'The second reference image is the original source at full fidelity and is authoritative for the subject, text, logos, colors, lighting, and existing composition.',
            'Preserve the subject identity, existing composition, camera perspective, colors, lighting, texture, typography, logos, and every visible detail inside the original image.',
            'Extend the scene naturally beyond the original edges so the new background and environment continue seamlessly in every expanded direction.',
            'Match depth, scale, geometry, shadows, focus, grain, and edge continuity; generate plausible newly revealed content without duplicating the main subject.',
            'Use the entire target canvas with no blank border, no white frame, no transparent or checkerboard area, and no visible seam around the original image.'
        ].join(' ');
    }
    async function finishWithFiles(s,files,title){
        if(!files?.length)throw new Error('upload failed');const deps=d(),rect=deps.nodeRect?.(s.node)||{x:s.node.x||0,y:s.node.y||0,width:320};close({restoreViewport:false});
        const createNode=global.SmartCanvasNodeFactory?.createNode||deps.createNode;if(typeof createNode!=='function')throw new Error('node factory unavailable');
        const output=createNode(rect.x+rect.width+40,rect.y,files,{select:true});if(!output)throw new Error('create node failed');output.title=title;deps.selectedIds=[];deps.selectedImage={nodeId:output.id,index:0};deps.syncSelectionUi?.();if(s.composerWasOpen)deps.updateComposer?.();requestAnimationFrame(()=>global.SmartCanvasViewport?.revealNodesAfterInlineEdit?.(s.node,output,s.returnViewport));deps.scheduleSave?.();return output;
    }
    async function apply(){
        const s=session,deps=d();if(!s||s.applying)return;s.applying=true;s.panel.classList.add('is-applying');
        try{
            if(s.mode==='outpaint'){
                const width=Math.max(s.naturalW,Math.round(s.outpaint.w)),height=Math.max(s.naturalH,Math.round(s.outpaint.h));
                const options={nodeId:s.nodeId,imageIndex:s.imageIndex,width,height,sourceWidth:s.naturalW,sourceHeight:s.naturalH};
                const layoutReference=await outpaintLayoutReference(s,width,height);options.layoutReference=layoutReference;
                options.prompt=outpaintPrompt(options);
                const runner=global.SmartCanvasGeneration?.runQuickOutpaintGeneration;
                if(typeof runner!=='function')throw new Error('outpaint generation unavailable');
                close();
                await runner(options);
                return;
            }
            const src=await imageFromUrl(s.sourceUrl),base=String(s.image.name||'image').replace(/\.[^.]+$/,'');
            if(s.mode==='grid'){
                const blobs=[];for(let row=0;row<s.gridRows;row++)for(let col=0;col<s.gridCols;col++){const x=Math.round(col*s.naturalW/s.gridCols),y=Math.round(row*s.naturalH/s.gridRows),x2=Math.round((col+1)*s.naturalW/s.gridCols),y2=Math.round((row+1)*s.naturalH/s.gridRows),canvas=document.createElement('canvas');canvas.width=x2-x;canvas.height=y2-y;canvas.getContext('2d').drawImage(src,x,y,canvas.width,canvas.height,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)blobs.push({blob,name:`${base}_${row+1}_${col+1}.png`});}
                const files=await global.SmartCanvasImageEdit?.uploadImageBlobs?.(blobs);await finishWithFiles(s,files.map(file=>({...file,role:'output'})),'Grid');
            }else{
                const canvas=document.createElement('canvas');
                if(s.mode==='crop'){canvas.width=Math.round(s.crop.w);canvas.height=Math.round(s.crop.h);canvas.getContext('2d').drawImage(src,Math.round(s.crop.x),Math.round(s.crop.y),canvas.width,canvas.height,0,0,canvas.width,canvas.height);}
                else if(s.mode==='compare'){const before=await imageFromUrl(s.compareUrl||s.sourceUrl);canvas.width=s.naturalW*2;canvas.height=s.naturalH;const c=canvas.getContext('2d');c.drawImage(before,0,0,s.naturalW,s.naturalH);c.drawImage(src,s.naturalW,0,s.naturalW,s.naturalH);}
                else {const ratio=s.panoramaRatio||16/9;canvas.width=s.naturalW;canvas.height=Math.max(1,Math.round(canvas.width/ratio));const c=canvas.getContext('2d');const sourceRatio=s.naturalW/s.naturalH;let sx=0,sy=0,sw=s.naturalW,sh=s.naturalH;if(sourceRatio>ratio){sw=s.naturalH*ratio;sx=(s.naturalW-sw)/2-s.panX/Math.max(1,currentImageRect(s)?.width||1)*s.naturalW;}else{sh=s.naturalW/ratio;sy=(s.naturalH-sh)/2;}sx=Math.max(0,Math.min(s.naturalW-sw,sx));c.drawImage(src,sx,sy,sw,sh,0,0,canvas.width,canvas.height);}
                const suffix={crop:'crop',outpaint:'outpaint',compare:'compare',panorama:'panorama'}[s.mode],file=await uploadCanvas(canvas,`${base}_${suffix}.png`);await finishWithFiles(s,[{...file,role:'output',natural_w:canvas.width,natural_h:canvas.height}],{crop:'Crop',outpaint:'Outpaint',compare:'Compare',panorama:'Panorama'}[s.mode]);
            }
            deps.toast?.('处理结果已放到原图旁边');
        }catch(error){console.error('[InlineImageTools] apply failed',error);if(session===s){s.applying=false;s.panel.classList.remove('is-applying');}else restore(s);deps.toast?.(`应用失败：${String(error?.message||error)}`);}
    }
    function open(options={}){
        const deps=d(),mode=options.mode,nodeId=options.nodeId||deps?.selectedImage?.nodeId,imageIndex=Number(options.imageIndex??deps?.selectedImage?.index??0);if(!['crop','outpaint','grid','panorama','compare'].includes(mode))return false;
        const node=deps?.nodes?.find?.(item=>item.id===nodeId),image=deps?.imageForDisplay?.(node?.images?.[imageIndex]);if(!deps||!node||!image?.url)return false;if(session)close();global.SmartCanvasInlineBrush?.close?.();
        deps.selectedId=nodeId;deps.selectedIds=[];deps.selectedImage={nodeId,index:imageIndex};deps.syncSelectionUi?.();const item=deps.selectedImageElement?.(),media=item?.querySelector?.('img');if(!item||!media){deps.toast?.('当前内容不能编辑');return false;}
        const naturalW=Number(media.naturalWidth||image.natural_w||0),naturalH=Number(media.naturalHeight||image.natural_h||0);if(!naturalW||!naturalH){media.addEventListener('load',()=>open(options),{once:true});return true;}
        const {overlay,panel}=makeUi(mode),refs=deps.defaultReferenceImagesFor?.(node)||[],compareImage=refs.map(ref=>deps.imageForDisplay?.(ref)||ref).find(ref=>ref?.url&&ref.url!==image.url);
        const sourceUrl=deps.displayMediaUrl?.(image)||image.url;
        session={mode,node,image,nodeId,imageIndex,item,media,overlay,panel,shell:deps.shell,naturalW,naturalH,sourceUrl,compareUrl:compareImage?(deps.displayMediaUrl?.(compareImage)||compareImage.url):'',crop:{x:0,y:0,w:naturalW,h:naturalH},outpaint:{w:naturalW*1.12,h:naturalH*1.12},ratioKey:'original',gridRows:2,gridCols:2,comparePosition:50,panoramaRatio:naturalW/naturalH,panX:0,drag:null,frame:0,applying:false,composerWasOpen:Boolean(deps.composer?.classList.contains('open')),returnViewport:{x:deps.viewport.x,y:deps.viewport.y,scale:deps.viewport.scale},blankHandler:null};
        if(mode==='outpaint'){
            const source=overlay.querySelector('.inline-outpaint-source'),outpaintImage=overlay.querySelector('.inline-outpaint-image');
            overlay.style.overflow='hidden';source.style.overflow='hidden';Object.assign(outpaintImage.style,{display:'block',width:'100%',height:'100%',objectFit:'fill'});outpaintImage.src=sourceUrl;
        }
        if(mode==='compare'){const img=overlay.querySelector('.inline-compare-image');img.src=session.compareUrl||session.sourceUrl;}
        if(mode==='panorama')overlay.querySelector('img').src=session.sourceUrl;
        session.blankHandler=event=>{if(event.button!==0||event.target.closest?.('.inline-image-tool-overlay,.inline-image-tool-panel,.image-quick-toolbar'))return;close();};
        item.classList.add('inline-image-tool-active');deps.shell.classList.add('inline-image-tool-open');deps.shell.appendChild(overlay);deps.shell.appendChild(panel);deps.composer?.classList.remove('open');bindUi(session);setBoxForRatio(session,'original');deps.shell.addEventListener('pointerdown',session.blankHandler,true);global.addEventListener('resize',positionUi);if(mode!=='outpaint')global.SmartCanvasViewport?.fitViewportToImageForInlineBrush?.(node,item,{alignToComposer:['crop','grid'].includes(mode)});track();global.lucide?.createIcons?.({attrs:{'stroke-width':2}});return true;
    }
    const api=Object.freeze({open,close,apply,outpaintPrompt,outpaintReferencePlan,imageToolQuickToolbarPosition,isOpen:()=>Boolean(session)});global.SmartCanvasCore?.register?.('inlineImageTools',api);global.SmartCanvasInlineImageTools=api;
})(window);
