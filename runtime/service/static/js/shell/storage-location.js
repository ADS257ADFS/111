(function(global){
    'use strict';

    let state = null;
    let initialized = false;
    let loading = null;
    let documentState = null;
    let downloadState = null;

    const byId = id => document.getElementById(id);

    async function responseJson(response){
        let body = {};
        try { body = await response.json(); } catch(_error) {}
        if(!response.ok) throw new Error(body.detail || `请求失败（${response.status}）`);
        return body;
    }

    function setStatus(message, kind){
        const el = byId('storageLocationStatus');
        if(!el) return;
        el.textContent = message || '';
        el.dataset.kind = kind || '';
    }

    function setDocumentStatus(message, kind){
        const el = byId('documentStorageLocationStatus');
        if(!el) return;
        el.textContent = message || '';
        el.dataset.kind = kind || '';
    }

    function setDownloadStatus(message, kind){
        const el = byId('downloadStorageLocationStatus');
        if(!el) return;
        el.textContent = message || '';
        el.dataset.kind = kind || '';
    }

    function sourceText(source){
        return ({
            legacy: '这是旧版软件目录内的数据，切换后软件目录将保持稳定。',
            default: '当前使用系统推荐的独立数据目录。',
            saved: '当前使用你选择的独立数据目录。',
            environment: '当前路径由启动环境指定，设置面板不能覆盖。'
        })[source] || '当前数据路径已载入。';
    }

    function render(data){
        state = data;
        byId('storageLocationCurrent').textContent = data.current_path || '未知';
        byId('storageLocationCurrentHint').textContent = sourceText(data.source);
        byId('storageLocationSize').textContent = `${data.size || '0 B'} · ${data.files || 0} 个文件`;
        const input = byId('storageLocationPath');
        if(input && !input.dataset.edited){
            input.value = data.saved_path || data.recommended_path || '';
        }
        const locked = Boolean(data.environment_override);
        byId('storageLocationBrowse').disabled = locked;
        byId('storageLocationRecommended').disabled = locked;
        byId('storageLocationSave').disabled = locked;
        if(locked) setStatus('该路径由启动环境固定，需修改启动配置后再设置。', 'error');
        else if(data.restart_required) setStatus('新位置已保存，请关闭并重新运行光盒。', 'success');
    }

    function renderDocument(data){
        documentState = data;
        byId('documentStorageLocationCurrent').textContent = data.current_path || '未知';
        byId('documentStorageLocationSize').textContent = `${data.size || '0 B'} · ${data.files || 0} 个文件`;
        const input = byId('documentStorageLocationPath');
        if(input && !input.dataset.edited) input.value = data.saved_path || data.recommended_path || '';
        const locked = Boolean(data.environment_override);
        byId('documentStorageLocationBrowse').disabled = locked;
        byId('documentStorageLocationRecommended').disabled = locked;
        byId('documentStorageLocationSave').disabled = locked;
        if(locked) setDocumentStatus('该路径由启动环境固定，设置面板不能覆盖。', 'error');
    }

    function renderDownload(data){
        downloadState = data;
        byId('downloadStorageLocationCurrent').textContent = data.current_path || '未知';
        byId('downloadStorageLocationCount').textContent = `${data.count || 0} 条记录`;
        const input = byId('downloadStorageLocationPath');
        if(input && !input.dataset.edited) input.value = data.current_path || data.recommended_path || '';
    }

    async function load(){
        if(loading) return loading;
        loading = Promise.all([
            fetch('/api/storage-location').then(responseJson),
            fetch('/api/document-storage-location').then(responseJson),
            fetch('/api/download-center').then(responseJson)
        ])
            .then(([data, documentData, downloadData]) => {
                render(data); renderDocument(documentData); renderDownload(downloadData); return data;
            })
            .catch(error => { setStatus(error.message || '无法读取存储位置', 'error'); throw error; })
            .finally(() => { loading = null; });
        return loading;
    }

    async function browseDocument(){
        const button = byId('documentStorageLocationBrowse');
        const input = byId('documentStorageLocationPath');
        button.disabled = true;
        setDocumentStatus('正在打开文件夹选择窗口…');
        try {
            const data = await fetch('/api/document-storage-location/browse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({initial_path: input.value || documentState?.recommended_path || ''})
            }).then(responseJson);
            if(data.path){
                input.value = data.path;
                input.dataset.edited = '1';
                setDocumentStatus('已选择文件夹，保存后立即用于新上传的文档和任务成果。');
            }else setDocumentStatus('已取消选择。');
        }catch(error){
            setDocumentStatus(error.message || '无法选择文件夹', 'error');
        }finally{
            button.disabled = Boolean(documentState?.environment_override);
        }
    }

    async function saveDocument(){
        const input = byId('documentStorageLocationPath');
        const path = input.value.trim();
        if(!path){
            setDocumentStatus('请先选择文档保存文件夹。', 'error');
            input.focus();
            return;
        }
        const button = byId('documentStorageLocationSave');
        button.disabled = true;
        setDocumentStatus('正在检查并保存路径…');
        try {
            await fetch('/api/document-storage-location', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({path, copy_existing: false})
            }).then(responseJson);
            input.dataset.edited = '';
            setDocumentStatus('已保存，下一次上传文档时立即生效，无需重启。', 'success');
            const data = await fetch('/api/document-storage-location').then(responseJson);
            renderDocument(data);
        }catch(error){
            setDocumentStatus(error.message || '保存失败，原路径没有改变。', 'error');
        }finally{
            button.disabled = Boolean(documentState?.environment_override);
        }
    }

    async function browseDownload(){
        const button = byId('downloadStorageLocationBrowse');
        const input = byId('downloadStorageLocationPath');
        button.disabled = true;
        setDownloadStatus('正在打开文件夹选择窗口…');
        try {
            const nativeApi = global.pywebview?.api;
            if(!nativeApi?.choose_download_folder) throw new Error('当前环境无法打开文件夹选择窗口');
            const path = await nativeApi.choose_download_folder(input.value || downloadState?.recommended_path || '');
            if(path){
                input.value = path;
                input.dataset.edited = '1';
                setDownloadStatus('已选择文件夹，点击“保存下载路径”后生效。');
            }else setDownloadStatus('已取消选择。');
        } catch(error) {
            setDownloadStatus(error.message || '无法选择文件夹', 'error');
        } finally {
            button.disabled = false;
        }
    }

    async function saveDownload(){
        const input = byId('downloadStorageLocationPath');
        const path = input.value.trim();
        if(!path){
            setDownloadStatus('请先选择下载文件夹。', 'error');
            input.focus();
            return;
        }
        const button = byId('downloadStorageLocationSave');
        button.disabled = true;
        setDownloadStatus('正在检查并保存下载路径…');
        try {
            const data = await fetch('/api/download-center/settings', {
                method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path})
            }).then(responseJson);
            input.dataset.edited = '';
            renderDownload(data);
            setDownloadStatus('已保存，新的下载会立即使用该位置。', 'success');
        } catch(error) {
            setDownloadStatus(error.message || '保存失败，原下载路径没有改变。', 'error');
        } finally {
            button.disabled = false;
        }
    }

    async function browse(){
        const button = byId('storageLocationBrowse');
        const input = byId('storageLocationPath');
        button.disabled = true;
        setStatus('正在打开文件夹选择窗口…');
        try {
            const data = await fetch('/api/storage-location/browse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({initial_path: input.value || state?.recommended_path || ''})
            }).then(responseJson);
            if(data.path){
                input.value = data.path;
                input.dataset.edited = '1';
                setStatus('已选择文件夹，点击“保存并准备切换”后生效。');
            }else{
                setStatus('已取消选择。');
            }
        }catch(error){
            setStatus(error.message || '无法选择文件夹', 'error');
        }finally{
            button.disabled = Boolean(state?.environment_override);
        }
    }

    async function save(){
        const input = byId('storageLocationPath');
        const path = input.value.trim();
        if(!path){
            setStatus('请先选择新的保存文件夹。', 'error');
            input.focus();
            return;
        }
        const button = byId('storageLocationSave');
        button.disabled = true;
        setStatus('正在安全复制并检查数据，请不要关闭软件…');
        try {
            const data = await fetch('/api/storage-location', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    path,
                    copy_existing: byId('storageLocationCopyExisting').checked
                })
            }).then(responseJson);
            input.dataset.edited = '';
            const copied = data.copied_files
                ? `已复制 ${data.copied_files} 个文件（${data.copied_size}）并保留原数据；重启时会补同步最新变化。`
                : '新位置已保存，原数据未删除。';
            setStatus(`${copied} 请关闭并重新运行光盒。`, 'success');
            await load();
        }catch(error){
            setStatus(error.message || '保存失败，当前数据位置没有改变。', 'error');
        }finally{
            button.disabled = Boolean(state?.environment_override);
        }
    }

    function init(){
        if(initialized || !byId('storageLocationPath')) return;
        initialized = true;
        const input = byId('storageLocationPath');
        input.addEventListener('input', () => { input.dataset.edited = '1'; });
        byId('storageLocationBrowse').addEventListener('click', browse);
        byId('storageLocationRecommended').addEventListener('click', () => {
            input.value = state?.recommended_path || '';
            input.dataset.edited = '1';
            setStatus('已填入推荐位置，保存后生效。');
        });
        byId('storageLocationSave').addEventListener('click', save);
        const documentInput = byId('documentStorageLocationPath');
        documentInput?.addEventListener('input', () => { documentInput.dataset.edited = '1'; });
        byId('documentStorageLocationBrowse')?.addEventListener('click', browseDocument);
        byId('documentStorageLocationRecommended')?.addEventListener('click', () => {
            documentInput.value = documentState?.recommended_path || '';
            documentInput.dataset.edited = '1';
            setDocumentStatus('已填入推荐位置，保存后立即生效。');
        });
        byId('documentStorageLocationSave')?.addEventListener('click', saveDocument);
        const downloadInput = byId('downloadStorageLocationPath');
        downloadInput?.addEventListener('input', () => { downloadInput.dataset.edited = '1'; });
        byId('downloadStorageLocationBrowse')?.addEventListener('click', browseDownload);
        byId('downloadStorageLocationRecommended')?.addEventListener('click', () => {
            downloadInput.value = downloadState?.recommended_path || '';
            downloadInput.dataset.edited = '1';
            setDownloadStatus('已填入推荐位置，保存后立即生效。');
        });
        byId('downloadStorageLocationSave')?.addEventListener('click', saveDownload);
    }

    global.ShellStorageLocation = Object.freeze({ init, load });
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})(window);
