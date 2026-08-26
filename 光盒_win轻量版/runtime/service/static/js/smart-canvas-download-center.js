(function(global){
    'use strict';

    let state = {records:[], current_path:'', recommended_path:''};
    let initialized = false;
    let hasUnreadDownload = false;
    const unreadStorageKey = 'lightbox.downloadCenterUnread';

    const byId = id => document.getElementById(id);

    function readUnreadDownload(){
        try { return global.localStorage?.getItem(unreadStorageKey) === '1'; }
        catch(_error) { return false; }
    }

    function setUnreadDownload(nextUnread){
        hasUnreadDownload = !!nextUnread;
        try { global.localStorage?.setItem(unreadStorageKey, hasUnreadDownload ? '1' : '0'); }
        catch(_error) {}
        const badge = byId('canvasDownloadCenterBadge');
        if(badge){
            badge.hidden = !hasUnreadDownload;
            badge.textContent = '';
        }
    }

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[character]));
    }

    async function responseJson(response){
        let body = {};
        try { body = await response.json(); } catch(_error) {}
        if(!response.ok) throw new Error(body.detail || `请求失败（${response.status}）`);
        return body;
    }

    function formatBytes(bytes){
        const value = Math.max(0, Number(bytes) || 0);
        if(value < 1024) return `${value} B`;
        if(value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        if(value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
        return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }

    function formatTime(value){
        const date = new Date(value || 0);
        if(Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('zh-CN', {
            month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'
        }).format(date);
    }

    function iconFor(record){
        const type = String(record?.mime_type || '').toLowerCase();
        const name = String(record?.name || '').toLowerCase();
        if(type.startsWith('image/')) return 'image';
        if(type.startsWith('video/')) return 'file-video';
        if(type.startsWith('audio/')) return 'file-audio';
        if(type.includes('zip') || /\.(zip|rar|7z)$/i.test(name)) return 'file-archive';
        if(/\.pdf$/i.test(name)) return 'file-text';
        return 'file';
    }

    function render(){
        const records = Array.isArray(state.records) ? state.records : [];
        const list = byId('canvasDownloadCenterList');
        const count = byId('canvasDownloadCenterCount');
        const badge = byId('canvasDownloadCenterBadge');
        if(count) count.textContent = String(records.length);
        if(badge){
            badge.hidden = !hasUnreadDownload;
            badge.textContent = '';
        }
        if(!list) return;
        if(!records.length){
            list.innerHTML = '<div class="canvas-download-center-empty"><i data-lucide="download"></i><span>还没有下载记录</span></div>';
        }else{
            list.innerHTML = records.map(record => `
                <article class="canvas-download-item${record.exists === false ? ' is-missing' : ''}" data-download-record="${escapeHtml(record.id)}">
                    <span class="canvas-download-item-icon"><i data-lucide="${iconFor(record)}"></i></span>
                    <span class="canvas-download-item-copy">
                        <strong title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</strong>
                        <span>${formatBytes(record.size)} · ${record.exists === false ? '文件已移动' : formatTime(record.created_at)}</span>
                    </span>
                    <span class="canvas-download-item-actions">
                        <button type="button" data-download-reveal="${escapeHtml(record.id)}" title="在文件夹中显示" aria-label="在文件夹中显示" ${record.exists === false ? 'disabled' : ''}><i data-lucide="folder-open"></i></button>
                        <button class="is-delete" type="button" data-download-delete="${escapeHtml(record.id)}" title="删除记录" aria-label="删除记录"><i data-lucide="trash-2"></i></button>
                    </span>
                </article>`).join('');
        }
        global.lucide?.createIcons?.();
    }

    async function load(){
        state = await fetch('/api/download-center').then(responseJson);
        render();
        return state;
    }

    function open(){
        const panel = byId('canvasDownloadCenterPanel');
        const button = byId('canvasDownloadCenterBtn');
        if(!panel) return;
        panel.hidden = false;
        panel.setAttribute('aria-hidden','false');
        button?.setAttribute('aria-expanded','true');
        setUnreadDownload(false);
        load().catch(error => global.toast?.(error.message || '无法读取下载记录'));
    }

    function close(){
        const panel = byId('canvasDownloadCenterPanel');
        panel?.setAttribute('aria-hidden','true');
        if(panel) panel.hidden = true;
        byId('canvasDownloadCenterBtn')?.setAttribute('aria-expanded','false');
    }

    function toggle(){
        const panel = byId('canvasDownloadCenterPanel');
        if(panel?.hidden) open(); else close();
    }

    function sourceElementForNode(nodeId){
        if(!nodeId) return document.querySelector('.image-node.selected');
        const escaped = global.CSS?.escape ? global.CSS.escape(String(nodeId)) : String(nodeId).replace(/["\\]/g,'\\$&');
        return document.querySelector(`.image-node[data-id="${escaped}"]`);
    }

    function animateToButton(sourceElement){
        const button = byId('canvasDownloadCenterBtn');
        const source = sourceElement?.querySelector?.('img,video,canvas') || sourceElement;
        if(!button || !source || global.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const from = source.getBoundingClientRect();
        const to = button.getBoundingClientRect();
        if(from.width < 2 || from.height < 2 || to.width < 2) return;
        const clone = source.cloneNode(true);
        clone.removeAttribute?.('id');
        clone.className = 'canvas-download-flight';
        Object.assign(clone.style, {
            left:`${from.left}px`, top:`${from.top}px`, width:`${from.width}px`, height:`${from.height}px`,
            transformOrigin:'center center'
        });
        document.body.appendChild(clone);
        const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
        const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
        const scale = Math.max(.025, Math.min(to.width / from.width, to.height / from.height) * .58);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
            clone.style.opacity = '0';
            clone.style.borderRadius = '999px';
            clone.style.filter = 'blur(1px)';
        }));
        setTimeout(() => {
            clone.remove();
            button.classList.remove('canvas-download-center-hit');
            void button.offsetWidth;
            button.classList.add('canvas-download-center-hit');
        }, 480);
    }

    async function saveBlob(blob, filename, options={}){
        const sourceElement = options.sourceElement || document.querySelector('.image-node.selected');
        if(options.animate !== false) animateToButton(sourceElement);
        const form = new FormData();
        form.append('file', blob, filename || 'download');
        const result = await fetch('/api/download-center/save', {method:'POST', body:form}).then(responseJson);
        const record = result.files?.[0];
        if(record){
            state.records = [record, ...(state.records || []).filter(item => item.id !== record.id)];
            setUnreadDownload(byId('canvasDownloadCenterPanel')?.hidden !== false);
            render();
            global.toast?.(`已下载到 ${result.current_path}`);
        }
        return record;
    }

    async function saveItem(item, options={}){
        if(!item?.url) throw new Error('没有可下载的内容');
        const sourceElement = options.sourceElement || sourceElementForNode(options.nodeId);
        animateToButton(sourceElement);
        const response = await fetch(item.url);
        if(!response.ok) throw new Error('无法读取下载内容');
        const blob = await response.blob();
        return saveBlob(blob, options.filename || item.name || 'download', {sourceElement, animate:false});
    }

    function desktopApi(){
        try { return global.top?.pywebview?.api || global.pywebview?.api || null; }
        catch(_error) { return global.pywebview?.api || null; }
    }

    async function saveBlobAs(blob, filename){
        const nativeApi = desktopApi();
        if(!nativeApi?.choose_save_file) throw new Error('当前环境无法打开另存为窗口');
        const target = await nativeApi.choose_save_file(filename || 'media');
        if(!target?.token) return null;
        const form = new FormData();
        form.append('token', target.token);
        form.append('file', blob, target.filename || filename || 'media');
        const result = await fetch('/api/download-center/save-as', {method:'POST', body:form}).then(responseJson);
        global.toast?.(`已另存为 ${result.name || target.filename || filename}`);
        return result;
    }

    async function saveItemAs(item, options={}){
        if(!item?.url) throw new Error('没有可另存为的内容');
        const response = await fetch(item.url);
        if(!response.ok) throw new Error('无法读取另存为内容');
        return saveBlobAs(await response.blob(), options.filename || item.name || 'media');
    }

    async function reveal(recordId){
        await fetch('/api/download-center/reveal', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:recordId})
        }).then(responseJson);
    }

    async function remove(recordId){
        await fetch(`/api/download-center/${encodeURIComponent(recordId)}`, {method:'DELETE'}).then(responseJson);
        state.records = (state.records || []).filter(item => item.id !== recordId);
        render();
    }

    function init(){
        if(initialized || !byId('canvasDownloadCenterBtn')) return;
        initialized = true;
        hasUnreadDownload = readUnreadDownload();
        setUnreadDownload(hasUnreadDownload);
        byId('canvasDownloadCenterBtn').addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation(); toggle();
        });
        byId('canvasDownloadCenterClose')?.addEventListener('click', close);
        byId('canvasDownloadCenterList')?.addEventListener('click', event => {
            const revealButton = event.target.closest('[data-download-reveal]');
            const deleteButton = event.target.closest('[data-download-delete]');
            if(revealButton){
                reveal(revealButton.dataset.downloadReveal).catch(error => global.toast?.(error.message || '无法打开文件位置'));
            }else if(deleteButton){
                remove(deleteButton.dataset.downloadDelete).catch(error => global.toast?.(error.message || '无法删除下载记录'));
            }
        });
        document.addEventListener('mousedown', event => {
            const panel = byId('canvasDownloadCenterPanel');
            if(panel?.hidden || event.target.closest('#canvasDownloadCenterPanel,#canvasDownloadCenterBtn')) return;
            close();
        });
        load().catch(() => {});
    }

    const api = Object.freeze({init, load, open, close, toggle, saveBlob, saveItem, saveBlobAs, saveItemAs, animateToButton, sourceElementForNode});
    global.SmartCanvasDownloadCenter = api;
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})(window);
