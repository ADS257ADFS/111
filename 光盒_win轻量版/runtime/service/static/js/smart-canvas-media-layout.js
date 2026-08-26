/**
 * Smart Canvas — media layout (node sizing) and display helpers (thumbs, kinds, URLs).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasMediaLayout] deps not registered');
        return c;
    }

const VIEWPORT_MIN_SCALE = 0.06;
const VIEWPORT_MAX_SCALE = 4;
const MEDIA_NODE_PREVIOUS_DEFAULT_SCALE = 2;

function safeScale(value){
    const n = Number(value);
    if(!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(VIEWPORT_MAX_SCALE, Math.max(VIEWPORT_MIN_SCALE, n));
}

function nodeScale(node){
    const v = Number(node?.scale);
    if((node?.images || []).length > 1 && v === S().MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE) return S().MEDIA_GROUP_DEFAULT_SCALE;
    if((node?.images || []).length <= 1 && v === MEDIA_NODE_PREVIOUS_DEFAULT_SCALE) return S().MEDIA_NODE_DEFAULT_SCALE;
    return Number.isFinite(v) && v > 0 ? v : 1;
}

function mediaNodeDefaultScale(node){
    if((node?.images || []).length > 1 && !Number.isFinite(Number(node?.scale))) return S().MEDIA_GROUP_DEFAULT_SCALE;
    if((node?.images || []).length <= 1 && Number(node?.scale) === MEDIA_NODE_PREVIOUS_DEFAULT_SCALE) return S().MEDIA_NODE_DEFAULT_SCALE;
    return Number.isFinite(Number(node?.scale)) && Number(node.scale) > 0 ? Number(node.scale) : S().MEDIA_NODE_DEFAULT_SCALE;
}

function singleImageLayout(image, node, scale){
    if(isAudioMediaItem(image)){
        return {cols:1, rows:1, width:460, height:230, thumb:Math.round(96 * scale), single:true};
    }
    if(isPsdMediaItem(image)){
        return {cols:1, rows:1, width:400, height:200, thumb:Math.round(96 * scale), single:true};
    }
    const explicitW = Number(node?.w);
    const explicitH = Number(node?.h);
    if(Number.isFinite(explicitW) && explicitW > 24 && Number.isFinite(explicitH) && explicitH > 24){
        return {cols:1, rows:1, width:Math.round(explicitW), height:Math.round(explicitH), thumb:Math.round(96 * scale), single:true};
    }
    const naturalW = Number(image?.natural_w || image?.width || 0);
    const naturalH = Number(image?.natural_h || image?.height || 0);
    if(naturalW > 0 && naturalH > 0){
        const maxW = 260 * scale;
        const maxH = 220 * scale;
        const fit = Math.min(maxW / naturalW, maxH / naturalH);
        return {
            cols:1,
            rows:1,
            width:Math.max(72, Math.round(naturalW * fit)),
            height:Math.max(72, Math.round(naturalH * fit)),
            thumb:Math.round(96 * scale),
            single:true
        };
    }
    return {cols:1, rows:1, width:Math.round(260*scale), height:Math.round(180*scale), thumb:Math.round(96*scale), single:true};
}

function groupImageGridLayout(count, explicitW, explicitH, maxThumb, pad=32, gap=8){
    let best = null;
    for(let cols = 1; cols <= count; cols++){
        const rows = Math.ceil(count / cols);
        const availableW = explicitW - pad - (cols - 1) * gap;
        const availableH = explicitH - pad - (rows - 1) * gap;
        if(availableW <= 0 || availableH <= 0) continue;
        const rawThumb = Math.floor(Math.min(availableW / cols, availableH / rows));
        const fittedThumb = Math.max(28, Math.min(maxThumb, rawThumb));
        const fits = rawThumb >= 28;
        const usedW = cols * fittedThumb + (cols - 1) * gap + pad;
        const usedH = rows * fittedThumb + (rows - 1) * gap + pad;
        const spareW = Math.max(0, explicitW - usedW);
        const spareH = Math.max(0, explicitH - usedH);
        const atMax = fittedThumb >= maxThumb;
        const score = [
            fits ? 1 : 0,
            fittedThumb,
            atMax ? cols : 0,
            -(spareW + spareH * 0.35),
            -rows
        ];
        let better = !best;
        if(best){
            for(let i = 0; i < score.length; i++){
                if(score[i] === best.score[i]) continue;
                better = score[i] > best.score[i];
                break;
            }
        }
        if(better){
            best = {cols, rows, thumb:fittedThumb, score};
        }
    }
    return best || {cols:Math.min(count, 2), rows:Math.ceil(count / Math.min(count, 2)), thumb:28};
}

function imageLayout(images, scale=1, node=null){
    if(node?.type === 'smart-group'){
        const groupThumbLayout = S().smartGroupThumbLayout(node);
        if(groupThumbLayout) return groupThumbLayout;
        return {cols:1, rows:1, ...S().smartGroupLayoutSize(node), thumb:96, single:true};
    }
    if(node?.type === 'smart-prompt') return {cols:1, rows:1, ...S().promptNodeLayoutSize(node), thumb:96, single:true};
    if(node?.type === 'smart-loop') return {cols:1, rows:1, width:Math.round(Number(node.w) || smartLoopWidth(node)), height:Math.round(Math.max(Number(node.h) || 0, smartLoopHeight(node))), thumb:96, single:true};
    const count = (images || []).length;
    const s = node?.type === 'smart-image' || !node?.type ? mediaNodeDefaultScale(node) : (Number.isFinite(scale) && scale > 0 ? scale : 1);
    const pendingCount = Math.max(0, Number(node?.pending) || 0);
    const explicitW = Number(node?.w);
    const explicitH = Number(node?.h);
    if(
        pendingCount > 0 &&
        Number.isFinite(explicitW) && explicitW > 40 &&
        Number.isFinite(explicitH) && explicitH > 40
    ){
        const totalSlots = Math.max(1, count + pendingCount);
        const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(totalSlots))));
        const rows = Math.ceil(totalSlots / cols);
        const PAD = 16;
        const FOOTER = 32;
        const GAP = 8;
        const rowSpan = (explicitH - PAD * 2 - (rows - 1) * GAP) / rows;
        const colSpan = (explicitW - PAD * 2 - (cols - 1) * GAP) / cols;
        const mediaH = Math.max(28, rowSpan - FOOTER);
        const thumb = Math.max(28, Math.floor(Math.min(colSpan, mediaH)));
        const cellAspect = Number(node?._pendingCellAspect) > 0
            ? Number(node._pendingCellAspect)
            : (Number(node?._pendingCellW) > 0 && Number(node?._pendingCellH) > 0
                ? Number(node._pendingCellW) / Number(node._pendingCellH)
                : thumb / Math.max(1, mediaH));
        const batchLayout = {
            cols,
            rows,
            width:Math.round(explicitW),
            height:Math.round(explicitH),
            thumb,
            batchPending:true,
            aspect:cellAspect,
            single:totalSlots === 1
        };
        const coLayout = window.SmartCanvasCoCreate?.adjustLayout?.(node, batchLayout, images, s);
        return coLayout ? {...coLayout, scale:s} : {...batchLayout, scale:s};
    }
    let layout;
    if(count === 0){
        const explicitW = Number(node?.w);
        const explicitH = Number(node?.h);
        const pending = Number(node?.pending) > 0 || Boolean(node?.queued);
        const fallbackW = pending ? 260 * s : S().EMPTY_UPLOAD_NODE_WIDTH;
        const fallbackH = pending ? 180 * s : S().EMPTY_UPLOAD_NODE_HEIGHT;
        layout = {
            cols:1,
            rows:1,
            width:Math.round(Number.isFinite(explicitW) && explicitW > 24 ? explicitW : fallbackW),
            height:Math.round(Number.isFinite(explicitH) && explicitH > 24 ? explicitH : fallbackH),
            thumb:Math.round(96*s),
            single:true
        };
    } else if(count === 1){
        layout = singleImageLayout(images[0], node, s);
    } else {
        const thumb = Math.round(S().MEDIA_GROUP_THUMB_BASE * s);
        const cell = thumb + 8;
        const PAD = 32; // group-node has 16px padding on each side
        const grid = images.find(img => img?.grid?.type === 'grid-split')?.grid;
        const explicitW = Number(node?.w);
        const explicitH = Number(node?.h);
        if(grid){
            const cols = Math.max(1, Number(grid.cols || 1));
            const rows = Math.max(1, Number(grid.rows || 1));
            if(Number.isFinite(explicitW) && explicitW > 40 && Number.isFinite(explicitH) && explicitH > 40){
                const fittedThumb = Math.max(28, Math.floor(Math.min((explicitW - PAD - (cols - 1) * 8) / cols, (explicitH - PAD - (rows - 1) * 8) / rows)));
                layout = {cols, rows, width:Math.round(explicitW), height:Math.round(explicitH), thumb:fittedThumb};
            } else {
                layout = {cols, rows, width:Math.max(Math.round(226*s), cols * cell + PAD), height:rows * cell + PAD, thumb};
            }
        } else {
            const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
            const rows = Math.ceil(count / cols);
            if(Number.isFinite(explicitW) && explicitW > 40 && Number.isFinite(explicitH) && explicitH > 40){
                const fitted = groupImageGridLayout(count, explicitW, explicitH, thumb, PAD, 8);
                layout = {cols:fitted.cols, rows:fitted.rows, width:Math.round(explicitW), height:Math.round(explicitH), thumb:fitted.thumb};
            } else {
                layout = {cols, rows, width:Math.max(Math.round(226*s), cols * cell + PAD), height:rows * cell + PAD, thumb};
            }
        }
    }
    const coLayout = window.SmartCanvasCoCreate?.adjustLayout?.(node, layout, images, s);
    return coLayout ? { ...coLayout, scale: s } : layout;
}

function smartLoopWidth(node){
    return 340;
}

function smartLoopHeight(node){
    let h = 168;
    if(node?.imageInput) h += 72;
    if(node?.showPrompt) {
        const promptCount = Math.max(1, S().smartLoopPromptFieldValues(node).length);
        h += 94 + promptCount * 58 + S().smartLoopUpstreamPromptPreviewHeight(node);
    }
    h += S().smartNodeInputThumbsHeight(S().smartLoopPreviewImages(node));
    return h;
}

function nodeRect(node){
    const layout = imageLayout(node.images || [], nodeScale(node), node);
    return {x:node.x || 0, y:node.y || 0, width:layout.width, height:layout.height};
}

function isVideoMediaItem(img){
    if(!img) return false;
    if(img.kind === 'video') return true;
    const url = String(img.url || '').toLowerCase();
    return /\.(mp4|webm|mov|m4v)(\?|$)/.test(url);
}

function isAudioMediaItem(img){
    if(!img) return false;
    if(img.kind === 'audio') return true;
    const url = String(img.url || '').toLowerCase();
    return /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/.test(url);
}

function isTextMediaItem(img){
    if(!img) return false;
    if(img.kind === 'text') return true;
    const url = String(img.url || '').toLowerCase();
    return /\.(txt|json|csv|srt|vtt|md)(\?|$)/.test(url);
}

function isFileMediaItem(img){
    if(!img) return false;
    return img.kind === 'file' || img.kind === 'document';
}

function isPsdMediaItem(img){
    if(!img) return false;
    if(img.kind === 'psd') return true;
    const source = `${img.name || ''} ${img.url || ''}`.toLowerCase();
    return /\.psd(?:[?#]|$)/.test(source) || String(img.mime_type || img.mimeType || '').toLowerCase() === 'application/vnd.adobe.photoshop';
}

function mediaKindForFile(file){
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '').toLowerCase();
    if(type === 'application/vnd.adobe.photoshop' || /\.psd(\?|$)/.test(name)) return 'psd';
    if(type.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/.test(name)) return 'video';
    if(type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/.test(name)) return 'audio';
    if(type.startsWith('text/') || /\.(txt|json|csv|srt|vtt|md)(\?|$)/.test(name)) return 'text';
    return 'image';
}

function mediaKindForItem(img){
    if(isPsdMediaItem(img)) return 'psd';
    if(isFileMediaItem(img)) return 'file';
    if(isTextMediaItem(img)) return 'text';
    if(isAudioMediaItem(img)) return 'audio';
    if(isVideoMediaItem(img)) return 'video';
    return 'image';
}

function mediaKindForUrls(urls, fallback='image'){
    const items = (urls || []).map(item => typeof item === 'string' ? {url:item} : (item || {}));
    if(fallback && fallback !== 'image') return fallback;
    if(items.some(isVideoMediaItem)) return 'video';
    if(items.some(isAudioMediaItem)) return 'audio';
    if(items.some(isTextMediaItem)) return 'text';
    return fallback;
}

function localDisplayUrlForMediaItem(img){
    if(!img) return '';
    const candidates = [
        img.originalLocalUrl,
        img.localUrl,
        img.sourceUrl,
        img.local_url,
        img.source_url,
        img.url
    ];
    const local = candidates.find(url => url && !/^https?:\/\//i.test(String(url)));
    return local || img.url || '';
}

function imageForDisplay(img){
    if(!img || typeof img !== 'object') return img;
    const localUrl = localDisplayUrlForMediaItem(img);
    if(!localUrl || localUrl === img.url) return img;
    return {
        ...img,
        url:localUrl,
        originalLocalUrl:img.originalLocalUrl || localUrl
    };
}

function isInlineVideoActive(img){
    return Boolean(img && img._inlineVideoActive);
}

function smartVideoPosterUrl(itemOrUrl){
    if(!itemOrUrl || typeof itemOrUrl !== 'object') return '';
    const frames = Array.isArray(itemOrUrl.frame_urls) ? itemOrUrl.frame_urls : [];
    const poster = [
        itemOrUrl.poster_url,
        itemOrUrl.poster,
        itemOrUrl.thumbnail,
        itemOrUrl.preview_url,
        frames[0]
    ].find(value => typeof value === 'string' && value.trim());
    return poster ? displayMediaUrl({url:poster, name:itemOrUrl.name || ''}) : '';
}

function smartVideoPreviewHtml(itemOrUrl, size=512, attrs=''){
    const original = smartOriginalMediaUrl(itemOrUrl);
    const displayItem = typeof itemOrUrl === 'object' && itemOrUrl ? {...itemOrUrl, url:original} : {url:original};
    const src = displayMediaUrl(displayItem);
    const poster = smartVideoPosterUrl(itemOrUrl);
    const posterAttr = poster ? ` poster="${S().escapeAttr(poster)}"` : '';
    return `<video src="${S().escapeAttr(src)}" data-original-src="${S().escapeAttr(original)}" data-url="${S().escapeAttr(original)}" data-preview-kind="video" data-video-preview="1" muted preload="auto" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"${posterAttr}${attrs ? ` ${attrs}` : ''}></video>`;
}

function smartVideoFallbackHtml(url, attrs=''){
    const original = smartOriginalMediaUrl(url);
    const src = displayMediaUrl({url:original});
    return `<video src="${S().escapeHtml(src)}" data-url="${S().escapeAttr(original)}" muted preload="metadata" playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"${attrs ? ` ${attrs}` : ''}></video>`;
}

function smartVideoPlayerHtml(url, attrs=''){
    const original = smartOriginalMediaUrl(url);
    const safe = S().escapeHtml(displayMediaUrl({url:original}));
    return `<video src="${safe}" data-url="${S().escapeAttr(original)}" data-inline-video-active="1" controls autoplay playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"${attrs ? ` ${attrs}` : ''}></video>`;
}

function smartActivateVideoPreview(target){
    const getNodes = S().getNodes;
    const nodes = typeof getNodes === 'function' ? getNodes() : [];
    const root = target?.closest?.('.media-video-card,.video-thumb,.image-wrap,.thumb-item') || target?.parentElement || null;
    const itemEl = target?.closest?.('[data-image-index]') || root?.closest?.('[data-image-index]') || root;
    const nodeEl = target?.closest?.('.image-node') || root?.closest?.('.image-node');
    const node = nodes.find(n => n.id === nodeEl?.dataset.id);
    const imageIndex = Number(itemEl?.dataset?.imageIndex ?? 0);
    const image = node?.images?.[imageIndex];
    const img = target?.matches?.('img[data-preview-kind="video"]') ? target : root?.querySelector?.('img[data-preview-kind="video"]');
    if(!img){
        const fallback = target?.matches?.('video[data-url]') ? target : root?.querySelector?.('video[data-url]');
        if(fallback){
            if(image) image._inlineVideoActive = true;
            fallback.dataset.inlineVideoActive = '1';
            fallback.removeAttribute('data-video-preview');
            fallback.controls = true;
            fallback.muted = false;
            const playButton = root?.querySelector?.('.smart-video-play');
            if(playButton) playButton.style.display = 'none';
            fallback.play?.().catch(() => {});
            return true;
        }
        return false;
    }
    const original = smartOriginalMediaUrl(img.dataset.originalSrc || img.dataset.url || img.getAttribute('src') || '');
    if(!original) return false;
    if(image) image._inlineVideoActive = true;
    const tpl = document.createElement('template');
    tpl.innerHTML = smartVideoPlayerHtml(original);
    const video = tpl.content.firstElementChild;
    if(!video) return false;
    img.replaceWith(video);
    video.parentElement?.querySelector?.('.smart-video-play')?.style?.setProperty('display', 'none');
    video.addEventListener('ended', () => {
        if(image) image._inlineVideoActive = true;
        video.dataset.inlineVideoActive = '1';
    });
    video.play?.().catch(() => {});
    return true;
}

function thumbMediaHtml(img){
    if(isFileMediaItem(img) || isTextMediaItem(img)) return `<div class="media-thumb file-thumb" data-media-url="${S().escapeAttr(img.url || '')}" data-media-kind="${S().escapeAttr(mediaKindForItem(img))}"><i data-lucide="${isTextMediaItem(img) ? 'file-text' : 'file'}"></i><span>${S().escapeHtml(img.name || (isTextMediaItem(img) ? 'Text' : 'File'))}</span></div>`;
    if(isAudioMediaItem(img)) return `<div class="media-thumb audio-thumb" data-media-url="${S().escapeAttr(img.url || '')}" data-media-kind="audio"><i data-lucide="file-audio"></i><span>${S().escapeHtml(img.name || 'Audio')}</span></div>`;
    if(isVideoMediaItem(img)) return `<div class="media-thumb video-thumb">${isInlineVideoActive(img) ? smartVideoPlayerHtml(img.url || '') : `${smartVideoPreviewHtml(img, 512)}<button class="smart-video-play thumb-video-play" type="button" title="播放"><i data-lucide="play"></i></button>`}</div>`;
    return `<img src="${S().escapeHtml(displayMediaUrl(img))}" data-original-src="${S().escapeAttr(img.url || '')}" draggable="false">`;
}

function imageResolutionLabel(img){
    const w = Number(img?.natural_w || img?.width || img?.w || 0);
    const h = Number(img?.natural_h || img?.height || img?.h || 0);
    return w > 0 && h > 0 ? `${Math.round(w)} x ${Math.round(h)}` : '';
}

function imageResolutionBadgeHtml(img){
    const label = imageResolutionLabel(img);
    return label ? `<span class="image-resolution-badge">${S().escapeHtml(label)}</span>` : '';
}

function thumbDisplaySize(img, maxSize){
    const limit = Math.max(28, Math.round(Number(maxSize) || 96));
    const w = Number(img?.natural_w || img?.width || img?.w || 0);
    const h = Number(img?.natural_h || img?.height || img?.h || 0);
    if(!(w > 0 && h > 0)) return {width:limit, height:limit};
    const fit = Math.min(limit / w, limit / h);
    return {
        width:Math.max(28, Math.round(w * fit)),
        height:Math.max(28, Math.round(h * fit))
    };
}

function thumbItemStyle(img, maxSize){
    const size = thumbDisplaySize(img, maxSize);
    return `--thumb-w:${size.width}px;--thumb-h:${size.height}px`;
}

function applyThumbDisplaySizeToElement(itemEl, img, maxSize=0){
    if(!itemEl?.classList?.contains('thumb-item')) return;
    const limit = Math.max(
        28,
        Math.round(
            Number(maxSize || 0)
            || Number(itemEl.style.getPropertyValue('--thumb-size').replace('px', ''))
            || Math.max(itemEl.clientWidth || 0, itemEl.clientHeight || 0)
            || 96
        )
    );
    const size = thumbDisplaySize(img, limit);
    itemEl.style.setProperty('--thumb-w', `${size.width}px`);
    itemEl.style.setProperty('--thumb-h', `${size.height}px`);
}

function mediaFileSizeLabel(value){
    const bytes = Number(value || 0);
    if(!(bytes > 0)) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const scaled = bytes / Math.pow(1024, unitIndex);
    const digits = unitIndex === 0 || scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(digits)} ${units[unitIndex]}`;
}

function singleMediaHtml(img, w, h){
    if(isPsdMediaItem(img)){
        const original = smartOriginalMediaUrl(img);
        const fileName = String(img.name || fileNameFromUrl(original) || 'PSD');
        const sizeLabel = mediaFileSizeLabel(img.size || img.size_bytes || img.file_size);
        return `<div class="media-psd-title"><i data-lucide="layers-3"></i><span>PSD 图层</span></div><div class="node-img media-card media-psd-card" style="width:${w}px;height:${h}px"><div class="media-psd-preview"><div class="media-psd-head"><span class="media-psd-file-name" title="${S().escapeAttr(fileName)}">${S().escapeHtml(fileName)}</span><span class="media-psd-master">LAYERED MASTER</span></div><div class="media-psd-hero"><i data-lucide="layers-3"></i><span>可编辑图层源文件</span></div></div><div class="media-psd-meta"><div class="media-psd-stat"><span>容量</span><strong>${S().escapeHtml(sizeLabel)}</strong></div><div class="media-psd-stat"><span>格式</span><strong>PSD</strong></div><div class="media-psd-status"><i aria-hidden="true"></i><span>源文件</span></div></div></div>`;
    }
    if(isFileMediaItem(img) || isTextMediaItem(img)) return `<div class="node-img media-card media-file-card" style="width:${w}px;height:${h}px"><div class="media-card-icon"><i data-lucide="${isTextMediaItem(img) ? 'file-text' : 'file'}"></i></div><div class="media-card-title">${S().escapeHtml(img.name || (isTextMediaItem(img) ? 'Text' : 'File'))}</div><div class="media-card-sub">${isTextMediaItem(img) ? 'TEXT' : 'FILE'}</div></div>`;
    if(isAudioMediaItem(img)){
        const original = smartOriginalMediaUrl(img);
        const audioSrc = displayMediaUrl({...img, url:original});
        const fileName = String(img.name || fileNameFromUrl(original) || 'Audio');
        const title = fileName.replace(/\.[^.]+$/, '') || 'Audio';
        const bars = [10,14,12,16,13,18,15,22,17,26,20,31,24,38,29,46,35,54,42,62,48,68,55,72,60,66,52,58,45,50,39,44,34,40,30,36,26,32,22,28,18,24]
            .map(height => `<span style="--audio-bar-height:${height}%"></span>`).join('');
        return `<div class="media-audio-title"><i data-lucide="music-2"></i><span>${S().escapeHtml(title)}</span></div><div class="node-img media-card media-audio-card" style="width:${w}px;height:${h}px"><audio src="${S().escapeAttr(audioSrc)}" data-url="${S().escapeAttr(original)}" preload="metadata"></audio><div class="media-audio-head"><span class="media-audio-file-icon"><i data-lucide="audio-lines"></i></span><span class="media-audio-file-name" title="${S().escapeAttr(fileName)}">${S().escapeHtml(fileName)}</span><span class="media-audio-kind">AUDIO</span></div><div class="media-audio-waveform" data-audio-seek="1" role="slider" aria-label="音频波形进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="media-audio-bars" aria-hidden="true">${bars}</div></div><div class="media-audio-transport" role="group" aria-label="音频播放控制"><button class="media-audio-control media-audio-toggle" type="button" data-audio-action="toggle" title="播放" aria-label="播放"><i class="audio-play-icon" data-lucide="play"></i><i class="audio-pause-icon" data-lucide="pause"></i></button><div class="media-audio-progress-wrap"><div class="media-audio-time-row"><span data-audio-current>00:00</span><span data-audio-duration>00:00</span></div><input class="media-audio-progress" data-audio-progress type="range" min="0" max="1000" step="1" value="0" aria-label="音频播放进度"></div></div></div>`;
    }
    if(isVideoMediaItem(img)) return `<div class="node-img media-card media-video-card" style="width:${w}px;height:${h}px">${isInlineVideoActive(img) ? smartVideoPlayerHtml(img.url || '') : `${smartVideoPreviewHtml(img, 768)}<button class="smart-video-play" type="button" title="播放"><i data-lucide="play"></i></button>`}</div>`;
    return `<img class="node-img" src="${S().escapeHtml(displayMediaUrl(img))}" data-original-src="${S().escapeAttr(img.url || '')}" draggable="false" style="width:${w}px;height:${h}px">`;
}

function fileNameFromUrl(url=''){
    try {
        const parsed = new URL(String(url || ''), window.location.href);
        return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    } catch(e) {
        return decodeURIComponent(String(url || '').split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '');
    }
}

function proxiedMediaUrl(itemOrUrl, name=''){
    const url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.url || '');
    if(!url || String(url).startsWith('/assets/') || String(url).startsWith('/output/') || String(url).startsWith('data:') || String(url).startsWith('blob:')) return url;
    const filename = name || (typeof itemOrUrl === 'object' ? (itemOrUrl.name || '') : '') || fileNameFromUrl(url) || 'preview';
    return `/api/download-output?inline=1&url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`;
}

function displayMediaUrl(itemOrUrl, name=''){
    const url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.url || '');
    if(/^https?:\/\//i.test(String(url || ''))) return proxiedMediaUrl(itemOrUrl, name);
    return url;
}

function bindImageProxyFallback(imgEl, itemOrUrl){
    if(!imgEl || imgEl.dataset.proxyFallbackBound === '1') return;
    imgEl.dataset.proxyFallbackBound = '1';
    imgEl.addEventListener('error', () => {
        if(imgEl.dataset.proxyFallbackTried === '1') return;
        const fallback = proxiedMediaUrl(itemOrUrl);
        if(!fallback || fallback === imgEl.getAttribute('src')) return;
        imgEl.dataset.proxyFallbackTried = '1';
        imgEl.src = fallback;
    });
}

function mediaLayoutSize(img){
 const width = Number(img?.natural_w || img?.width || img?.w || img?.layout_w || img?.preview_w || 0);
 const height = Number(img?.natural_h || img?.height || img?.h || img?.layout_h || img?.preview_h || 0);
 return width > 0 && height > 0 ? {width, height} : {width:0, height:0};
}


function imagesForNode(node){
    return (node?.images || []).map((img, index) => ({...imageForDisplay(img), nodeId:node.id, imageIndex:index}));
}

function resultMediaUrls(result){
    const urls = [];
    const add = value => {
        if(!value) return;
        if(typeof value === 'string'){
            urls.push(value);
            return;
        }
        if(Array.isArray(value)){
            value.forEach(add);
            return;
        }
        if(typeof value === 'object'){
            if(value.url || value.path || value.src || value.uri){
                const url = value.url || value.path || value.src || value.uri;
                if(url) urls.push({url, kind:value.kind || value.type || value.mediaKind || '', name:value.name || value.filename || ''});
            }
            ['outputs','videos','images','urls','data','result'].forEach(key => add(value[key]));
            ['url','path','src','uri','output','output_url','outputUrl','video','video_url','videoUrl','mp4_url','mp4Url','download_url','downloadUrl','preview_url','previewUrl'].forEach(key => add(value[key]));
        }
    };
    add(result);
    ['items','outputs','videos','audios','texts','files','images','urls','data','result','output','url'].forEach(key => add(result?.[key]));
    const seen = new Set();
    return urls.map(item => {
        const url = typeof item === 'string' ? item : item?.url || item?.path || '';
        if(!url) return null;
        return typeof item === 'object' ? {...item, url} : url;
    }).filter(item => {
        const url = typeof item === 'string' ? item : item?.url || '';
        return url && !seen.has(url) && seen.add(url);
    });
}

function outputUrlLooksVideo(url){
    return /\.(mp4|webm|mov|m4v)(\?|$)/.test(String(url || '').toLowerCase());
}

function smartOriginalMediaUrl(itemOrUrl){
 const raw = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.url || '');
 const text = String(raw || '');
 if(!text) return '';
 try {
 const parsed = new URL(text, window.location.origin);
 if(parsed.pathname === '/api/media-preview' || parsed.pathname === '/api/download-output'){
 const original = parsed.searchParams.get('url') || '';
 return original || text;
 }
 } catch(e) {}
 return text;
}

    function copyMediaSizeFields(source, target={}){
 if(!source || typeof source !== 'object') return target;
 ['natural_w','natural_h','width','height','w','h','layout_w','layout_h'].forEach(key => {
 const n = Number(source[key]);
 if(Number.isFinite(n) && n > 0) target[key] = n;
 });
 return target;
}
    function normalizedSizeLabel(value){
 const parsed = S().parseSizeValue(value);
 const w = Number(parsed?.width || 0);
 const h = Number(parsed?.height || 0);
 return w > 0 && h > 0 ? `${Math.round(w)} x ${Math.round(h)}` : '';
}
    function updateImageResolutionBadgeElement(itemEl, img){
 if(!itemEl) return;
 const label = imageResolutionLabel(img);
 let badge = itemEl.querySelector('.image-resolution-badge');
 if(!label){
 badge?.remove();
 return;
 }
 if(!badge){
 badge = document.createElement('span');
 badge.className = 'image-resolution-badge';
 itemEl.appendChild(badge);
 }
 badge.textContent = label;
}
    function smartMediaPreviewUrl(itemOrUrl, size=512){
 const raw = smartOriginalMediaUrl(itemOrUrl);
 const displayItem = typeof itemOrUrl === 'object' && itemOrUrl ? {...itemOrUrl, url:raw} : raw;
 const displayUrl = displayMediaUrl(displayItem);
 if(!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return displayUrl;
 if(!raw.startsWith('/output/') && !raw.startsWith('/assets/')) return displayUrl;
 if(!/\.(png|jpe?g|webp|gif|bmp|avif|tiff?|mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(raw)) return displayUrl;
 const width = Math.max(64, Math.min(2048, Math.round(Number(size) || 512)));
 return `/api/media-preview?w=${width}&url=${encodeURIComponent(raw)}`;
}
    const api = Object.freeze({
        smartMediaPreviewUrl,
        updateImageResolutionBadgeElement,
        normalizedSizeLabel,
        copyMediaSizeFields,
        registerDeps,
        safeScale,
        nodeScale,
        mediaNodeDefaultScale,
        singleImageLayout,
        groupImageGridLayout,
        imageLayout,
        smartLoopWidth,
        smartLoopHeight,
        nodeRect,
        isVideoMediaItem,
        isAudioMediaItem,
        isTextMediaItem,
        isFileMediaItem,
        isPsdMediaItem,
        mediaKindForFile,
        mediaKindForItem,
        mediaKindForUrls,
        localDisplayUrlForMediaItem,
        imageForDisplay,
        thumbMediaHtml,
        imageResolutionLabel,
        imageResolutionBadgeHtml,
        thumbDisplaySize,
        thumbItemStyle,
        applyThumbDisplaySizeToElement,
        singleMediaHtml,
        fileNameFromUrl,
        proxiedMediaUrl,
        displayMediaUrl,
        bindImageProxyFallback,
        mediaLayoutSize,
        imagesForNode,
        resultMediaUrls,
        outputUrlLooksVideo,
        smartOriginalMediaUrl,
        isInlineVideoActive,
        smartVideoPosterUrl,
        smartVideoPreviewHtml,
        smartVideoFallbackHtml,
        smartVideoPlayerHtml,
        smartActivateVideoPreview,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('mediaLayout', api);
    }
    global.SmartCanvasMediaLayout = api;
})(window);
