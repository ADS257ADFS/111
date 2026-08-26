/**
 * Smart Canvas — input media refs, temp cloud links, ref kind filters.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasSmartMediaRefs] deps not registered');
        return c;
    }

function tempShUploadedUrlFor(url, sourceSettings=settings){
    const source = String(url || '');
    const manualLinks = ((sourceSettings || S().settings).videoTempShLinks || []).filter(item => item?.manual === true);
    const links = [...(S().transientSmartCloudLinks || []), ...manualLinks];
    const match = links.find(item =>
        item?.url && (item?.source === source || item?.originalLocalUrl === source || item?.url === source)
    );
    return match?.url || url;
}


function mediaRefSourceUrl(ref){
    return S().localDisplayUrlForMediaItem(ref) || ref?.sourceUrl || ref?.originalLocalUrl || ref?.url || '';
}


function applyUploadedUrlsToSmartRefs(refs, sourceSettings=settings){
    return (refs || []).map(ref => {
        if(!ref?.url) return ref;
        const sourceUrl = mediaRefSourceUrl(ref);
        const url = tempShUploadedUrlFor(sourceUrl, sourceSettings);
        return url && url !== ref.url ? {...ref, url, originalLocalUrl:ref.originalLocalUrl || ref.url} : ref;
    });
}


function normalizeSmartApiRefs(refs, sourceSettings=settings){
    return applyUploadedUrlsToSmartRefs((refs || []).map(ref => {
        if(!ref?.url) return ref;
        let url = S().smartOriginalMediaUrl(ref);
        try {
            const parsed = new URL(url, window.location.origin);
            if(parsed.pathname === '/api/download-output' || parsed.pathname === '/api/media-preview'){
                const inner = parsed.searchParams.get('url') || '';
                if(inner) url = decodeURIComponent(inner);
            }
        } catch(e) {}
        if(url && url !== ref.url) return {...ref, url, originalLocalUrl: ref.originalLocalUrl || ref.url};
        return ref;
    }), sourceSettings);
}


function manualSmartVideoLink(sourceSettings=settings){
    return ((sourceSettings || S().settings).videoTempShLinks || []).find(item => item?.manual === true && item?.url) || null;
}


function manualSmartMediaLinks(sourceSettings=settings){
    return ((sourceSettings || S().settings).videoTempShLinks || []).filter(item => item?.manual === true && item?.url);
}


function renderedInputMediaRefs(){
    if(!S().inputThumbsRow) return [];
    return [...S().inputThumbsRow.querySelectorAll('.input-thumb')].map((el, index) => ({
        url:el.dataset.url || '',
        sourceUrl:el.dataset.sourceUrl || el.dataset.url || '',
        nodeId:el.dataset.nodeId || '',
        imageIndex:Number.isFinite(Number(el.dataset.imageIndex)) ? Number(el.dataset.imageIndex) : index,
        name:S().tr('smart.inputNum').replace('{n}', String(index + 1)),
        role:`image_${index + 1}`
    })).filter(ref => ref.url);
}


function currentSmartMediaRefs(node){
    if(!node) return [];
    const request = S().buildPromptRequest(node, null, true, S().smartLoopContext);
    return (request.refs || []).filter(ref => ref?.url && ['image','video'].includes(S().mediaKindForItem(ref)));
}


function currentUploadMediaRefs(node){
    const rendered = renderedInputMediaRefs();
    if(rendered.length) return rendered;
    return currentSmartMediaRefs(node);
}


function currentSmartMediaLinks(node=null){
    return currentUploadMediaRefs(node || S().activeSettingsSubject()).map(ref => {
        const sourceUrl = mediaRefSourceUrl(ref);
        const uploaded = tempShUploadedUrlFor(sourceUrl);
        return uploaded && uploaded !== sourceUrl ? uploaded : '';
    }).filter(Boolean);
}


function clearManualSmartVideoUrl(){
    S().settings.videoTempShLinks = (S().settings.videoTempShLinks || []).filter(item => item?.manual !== true);
}


function splitManualMediaUrls(text){
    return String(text || '')
        .split(/[\s,，]+/)
        .map(url => url.trim())
        .filter(Boolean);
}


async function uploadMediaRefToCloud(ref){
    const kind = S().mediaKindForItem(ref);
    const sourceUrl = mediaRefSourceUrl(ref);
    if(!sourceUrl) throw new Error('没有可上传的媒体');
    const existing = tempShUploadedUrlFor(sourceUrl);
    if(existing && existing !== sourceUrl) return existing;
    if(/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
    const response = await fetch('/api/cloud-video/upload', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url:sourceUrl, service:'auto'})
    });
    if(!response.ok) throw new Error(await S().smartResponseErrorMessage(response, '云端上传失败'));
    const data = await response.json();
    const uploadedUrl = data.url || '';
    if(!uploadedUrl) throw new Error('云端没有返回链接');
    S().transientSmartCloudLinks = [
        ...(S().transientSmartCloudLinks || []).filter(item => item?.source !== sourceUrl),
        {source:sourceUrl, url:uploadedUrl, expires:data.expires || '3 days', kind}
    ];
    return uploadedUrl;
}


function applyManualVideoUrlToSmartRef(ref, manualUrl){
    if(!manualUrl) return;
    const sourceUrl = mediaRefSourceUrl(ref) || manualUrl;
    S().settings.videoTempShLinks = [
        ...(S().settings.videoTempShLinks || []).filter(item => item?.source !== sourceUrl),
        {source:sourceUrl, url:manualUrl, manual:true}
    ];
}


async function setCurrentSmartManualVideoUrl(){
    const node = S().activeSettingsSubject();
    if(!node) return '';
    S().savePromptDraftForCurrent();
    const refs = currentUploadMediaRefs(node);
    const firstLocal = refs.find(ref => ref?.url && !isRemoteVideoReferenceUrl(ref.url));
    const firstAny = firstLocal || refs[0] || null;
    const linkedUrls = currentSmartMediaLinks(node);
    const currentLinks = linkedUrls.length ? linkedUrls : (firstAny ? [tempShUploadedUrlFor(mediaRefSourceUrl(firstAny))] : []);
    const value = await S().openAssetNameDialog({
        title:refs.length > 1 ? `输入 ${refs.length} 个媒体网址 / 火山素材 URI` : '输入媒体网址 / 火山素材 URI',
        value:currentLinks.filter(isRemoteVideoReferenceUrl).join('\n'),
        placeholder:refs.length > 1 ? '每行一个链接，按图1/图2顺序对应' : 'https://example.com/media 或 asset://asset-xxx',
        cancelValue:null,
        multiline:refs.length > 1
    });
    if(value === null) return '';
    const urls = splitManualMediaUrls(value);
    if(!urls.length){
        clearManualSmartVideoUrl();
        S().persistActiveSmartSettings();
        S().scheduleSave();
        S().render();
        S().toast('已清除手动网址');
        return '';
    }
    const invalid = urls.find(url => !isRemoteVideoReferenceUrl(url));
    if(invalid){
        S().toast('请输入 http/https 媒体网址或 asset:// 火山素材 URI');
        return '';
    }
    clearManualSmartVideoUrl();
    const targets = refs.length ? refs : [firstAny].filter(Boolean);
    urls.forEach((url, index) => {
        const target = targets[index] || targets[targets.length - 1] || {url};
        applyManualVideoUrlToSmartRef(target, url);
    });
    S().persistActiveSmartSettings();
    S().scheduleSave();
    S().render();
    S().toast(`已设置 ${urls.length} 个媒体网址`);
    return urls[0] || '';
}


async function uploadCurrentSmartVideosToCloud(){
    const node = S().activeSettingsSubject();
    if(!node) return [];
    S().savePromptDraftForCurrent();
    const refs = currentUploadMediaRefs(node);
    const localRefs = refs.filter(ref => {
        const sourceUrl = ref?.sourceUrl || ref?.originalLocalUrl || ref?.url || '';
        if(!sourceUrl) return false;
        const uploaded = tempShUploadedUrlFor(sourceUrl);
        return uploaded !== sourceUrl || !isRemoteVideoReferenceUrl(sourceUrl);
    });
    if(!localRefs.length){
        S().toast('当前输入图片或视频已是云端链接');
        return [];
    }
    const btn = S().dynamicParams?.querySelector('[data-trusted-source="cloud"]') || S().inputThumbsRow?.querySelector('[data-temp-sh-upload-video]');
    if(btn) btn.disabled = true;
    S().toast(`正在上传 ${localRefs.length} 个媒体文件到云端...`);
    try {
        const urls = [];
        for(const ref of localRefs){
            urls.push(await uploadMediaRefToCloud(ref));
        }
        S().toast(`云端上传完成：${urls.length} 个媒体文件`);
        return urls;
    } finally {
        if(btn) btn.disabled = false;
    }
}


function imageRefsOnly(refs){
    return (refs || []).filter(ref => ref?.url && S().mediaKindForItem(ref) === 'image');
}


function looksLikeImageMediaUrl(url){
    const text = String(url || '').trim().toLowerCase();
    if(!text) return false;
    if(text.startsWith('data:image/')) return true;
    if(text.startsWith('asset://')) return false;
    const path = text.split('?', 1)[0].split('#', 1)[0];
    return /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(path);
}


function videoRefsOnly(refs){
    return (refs || []).filter(ref => ref?.url && S().mediaKindForItem(ref) === 'video' && !looksLikeImageMediaUrl(ref.url));
}


function isRemoteVideoReferenceUrl(url){
    return /^https?:\/\//i.test(String(url || '')) || /^asset:\/\//i.test(String(url || ''));
}


function audioRefsOnly(refs){
    return (refs || []).filter(ref => ref?.url && S().mediaKindForItem(ref) === 'audio');
}


    const api = Object.freeze({
        registerDeps,
        tempShUploadedUrlFor,
        mediaRefSourceUrl,
        applyUploadedUrlsToSmartRefs,
        normalizeSmartApiRefs,
        manualSmartVideoLink,
        manualSmartMediaLinks,
        renderedInputMediaRefs,
        currentSmartMediaRefs,
        currentUploadMediaRefs,
        currentSmartMediaLinks,
        clearManualSmartVideoUrl,
        splitManualMediaUrls,
        uploadMediaRefToCloud,
        applyManualVideoUrlToSmartRef,
        setCurrentSmartManualVideoUrl,
        uploadCurrentSmartVideosToCloud,
        imageRefsOnly,
        looksLikeImageMediaUrl,
        videoRefsOnly,
        isRemoteVideoReferenceUrl,
        audioRefsOnly
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('smartMediaRefs', api);
    global.SmartCanvasSmartMediaRefs = api;
})(window);
