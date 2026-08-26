/**
 * Smart Canvas — music generation module (independent, no other code touched).
 *
 * 职责:
 *  1. renderMusicParams() — 画布底部 audio 模式专属表单(prompt/lyrics/instrumental/format/sample_rate/bitrate)
 *  2. runMusicGeneration() — 调 POST /api/canvas-music,完成后弹一个音频播放器 modal
 *
 * 接入点:在 smart-canvas-composer-params.js 的 renderDynamicParams 里加一个
 *        `if (apiKind === 'audio') return renderMusicParams()` 分支即可。
 *        在 smart-canvas-generation.js 的 runGeneration 里加一个 audio 分支调 runMusicGeneration 即可。
 */
(function(global){
    'use strict';

    const SAMPLE_RATES = [16000, 24000, 32000, 44100];
    const BITRATES = [32000, 64000, 128000, 256000];
    const FORMATS = ['mp3', 'wav', 'pcm'];
    const DEFAULT_LYRICS = '[verse]\n[chorus]\n[verse]\n[chorus]\n[outro]';

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function getMusicSettings(){
        const deps = d();
        const settings = deps?.settings || {};
        settings.musicProvider = settings.audioProvider || settings.musicProvider || '';
        settings.musicModel = settings.audioModel || settings.musicModel || '';
        if(!settings.musicFormat) settings.musicFormat = 'mp3';
        if(!settings.musicSampleRate) settings.musicSampleRate = 44100;
        if(!settings.musicBitrate) settings.musicBitrate = 256000;
        if(settings.musicInstrumental === undefined) settings.musicInstrumental = true;
        if(!settings.musicLyrics && !settings.musicInstrumental) settings.musicLyrics = DEFAULT_LYRICS;
        return settings;
    }

    function listMusicProviders(){
        const deps = d();
        const providers = (deps?.apiProviders || []).filter(p => p && p.enabled !== false);
        const audioModelsByProvider = {};
        providers.forEach(p => {
            const list = Array.isArray(p.audio_models) ? p.audio_models : [];
            if(list.length) audioModelsByProvider[p.id] = list;
        });
        return { providers, audioModelsByProvider };
    }

    function renderMusicParams(){
        const deps = d();
        if(!deps) return '';
        const settings = getMusicSettings();
        const { providers, audioModelsByProvider } = listMusicProviders();
        const esc = deps.escapeHtml || (v => String(v ?? ''));

        const hasAnyAudio = providers.some(p => (audioModelsByProvider[p.id] || []).length);
        if(!hasAnyAudio){
            return `<div class="music-params-wrap">
                <div class="music-params-empty">暂无可用音频模型,请先在 API 设置的"音频模型"中勾选 music-2.6 / music-3.0 等模型。</div>
            </div>`;
        }

        const providerOptions = ['<option value="">— 选择平台 —</option>']
            .concat(providers.map(p => `<option value="${esc(p.id)}" ${settings.musicProvider === p.id ? 'selected' : ''}>${esc(p.name || p.id)}</option>`))
            .join('');

        let modelOptions = '<option value="">— 先选平台 —</option>';
        if(settings.musicProvider && audioModelsByProvider[settings.musicProvider]){
            const models = audioModelsByProvider[settings.musicProvider];
            modelOptions = ['<option value="">— 选择模型 —</option>']
                .concat(models.map(m => `<option value="${esc(m)}" ${settings.musicModel === m ? 'selected' : ''}>${esc(m)}</option>`))
                .join('');
        }

        const sampleRateOptions = SAMPLE_RATES.map(v => `<option value="${v}" ${Number(settings.musicSampleRate) === v ? 'selected' : ''}>${v} Hz</option>`).join('');
        const bitrateOptions = BITRATES.map(v => `<option value="${v}" ${Number(settings.musicBitrate) === v ? 'selected' : ''}>${Math.round(v/1000)} kbps</option>`).join('');
        const formatOptions = FORMATS.map(v => `<option value="${esc(v)}" ${settings.musicFormat === v ? 'selected' : ''}>${esc(v)}</option>`).join('');

        return `<div class="music-params-wrap" style="display:flex;flex-direction:column;gap:10px;padding:4px 2px;">
            <div class="music-params-row" style="display:flex;align-items:center;gap:10px;">
                <label class="music-params-label" style="min-width:48px;font-size:12px;color:#888;">平台</label>
                <select class="music-params-select" data-music-param="musicProvider" style="flex:1;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:13px;">${providerOptions}</select>
            </div>
            <div class="music-params-row" style="display:flex;align-items:center;gap:10px;">
                <label class="music-params-label" style="min-width:48px;font-size:12px;color:#888;">模型</label>
                <select class="music-params-select" data-music-param="musicModel" style="flex:1;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:13px;">${modelOptions}</select>
            </div>
            <div class="music-params-row music-params-toggle-row" style="display:flex;align-items:center;">
                <label class="music-params-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
                    <input type="checkbox" data-music-param="musicInstrumental" ${settings.musicInstrumental ? 'checked' : ''}>
                    <span>纯音乐(无歌词)</span>
                </label>
            </div>
            <div class="music-params-row ${settings.musicInstrumental ? 'is-hidden' : ''}" data-music-lyrics-row style="display:flex;flex-direction:column;gap:6px;">
                <label class="music-params-label" style="font-size:12px;color:#888;">歌词(支持 [verse]/[chorus] 标签)</label>
                <textarea class="music-params-textarea" data-music-param="musicLyrics" rows="4" placeholder="留空将使用默认结构 [verse]/[chorus]…" style="padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:12px;resize:vertical;">${esc(settings.musicLyrics || '')}</textarea>
            </div>
            <div class="music-params-row music-params-inline" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <div class="music-params-inline-item" style="display:flex;flex-direction:column;gap:4px;">
                    <label class="music-params-label" style="font-size:11px;color:#888;">格式</label>
                    <select class="music-params-select" data-music-param="musicFormat" style="padding:4px 6px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:12px;">${formatOptions}</select>
                </div>
                <div class="music-params-inline-item" style="display:flex;flex-direction:column;gap:4px;">
                    <label class="music-params-label" style="font-size:11px;color:#888;">采样率</label>
                    <select class="music-params-select" data-music-param="musicSampleRate" style="padding:4px 6px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:12px;">${sampleRateOptions}</select>
                </div>
                <div class="music-params-inline-item" style="display:flex;flex-direction:column;gap:4px;">
                    <label class="music-params-label" style="font-size:11px;color:#888;">比特率</label>
                    <select class="music-params-select" data-music-param="musicBitrate" style="padding:4px 6px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:inherit;font-size:12px;">${bitrateOptions}</select>
                </div>
            </div>
        </div>`;
    }

    function bindMusicParams(rootEl){
        if(!rootEl) return;
        const deps = d();
        const inputs = rootEl.querySelectorAll('[data-music-param]');
        inputs.forEach(input => {
            const eventName = input.tagName === 'SELECT' ? 'change' : (input.type === 'checkbox' ? 'change' : 'input');
            input.addEventListener(eventName, () => {
                const key = input.dataset.musicParam;
                const settings = getMusicSettings();
                if(input.type === 'checkbox') settings[key] = input.checked;
                else settings[key] = input.value;
                if(typeof deps?.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps?.scheduleSave === 'function') deps.scheduleSave();
                // instrumental 切换时显示/隐藏歌词
                if(key === 'musicInstrumental'){
                    const lyricsRow = rootEl.querySelector('[data-music-lyrics-row]');
                    if(lyricsRow) lyricsRow.classList.toggle('is-hidden', input.checked);
                }
                // 切换 provider 时重渲 model 下拉
                if(key === 'musicProvider' && typeof global.SmartCanvasCore?.tryDeps?.()?.renderDynamicParams === 'function'){
                    global.SmartCanvasCore.tryDeps().renderDynamicParams();
                }
            });
        });
    }

    function showAudioModal(result){
        if(!result || !result.audio_url){
            return;
        }
        const existing = document.getElementById('musicResultModal');
        if(existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'musicResultModal';
        overlay.className = 'music-result-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';
        overlay.innerHTML = `<div class="music-result-modal" style="background:#1a1a22;color:var(--ui-text);border-radius:14px;padding:18px 20px;width:min(420px,90vw);box-shadow:0 18px 60px rgba(0,0,0,0.4);font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
            <div class="music-result-modal-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span class="music-result-modal-title" style="font-size:14px;font-weight:600;">🎵 音乐生成完成</span>
                <button type="button" class="music-result-modal-close" aria-label="关闭" style="background:none;border:0;color:var(--ui-text-secondary);font-size:var(--ui-type-display);cursor:pointer;line-height:1;padding:2px 8px;">×</button>
            </div>
            <div class="music-result-modal-body">
                <audio controls autoplay src="${result.audio_url}" class="music-result-audio" style="width:100%;margin-bottom:14px;border-radius:8px;"></audio>
                <div class="music-result-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;font-size:12px;line-height:1.6;color:var(--ui-text-muted);">
                    <div><strong>模型</strong> ${result.model || '—'}</div>
                    <div><strong>格式</strong> ${result.format || '—'}</div>
                    <div><strong>大小</strong> ${(result.size_bytes ? (result.size_bytes/1024/1024).toFixed(2) + ' MB' : '—')}</div>
                    <div><strong>采样率</strong> ${result.sample_rate || '—'} Hz</div>
                    <div><strong>比特率</strong> ${result.bitrate ? Math.round(result.bitrate/1000) + ' kbps' : '—'}</div>
                    <div><strong>纯音乐</strong> ${result.is_instrumental ? '是' : '否'}</div>
                </div>
                <div class="music-result-actions" style="margin-top:14px;text-align:right;">
                    <a class="music-result-download" href="${result.audio_url}" download="${result.filename || 'music.mp3'}" style="background:var(--ui-accent);color:var(--ui-text-on-accent);text-decoration:none;padding:6px 14px;border-radius:6px;font-size:13px;">下载 ${result.filename || 'music.mp3'}</a>
                </div>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.music-result-modal-close')?.addEventListener('click', close);
        overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
    }

    async function runMusicGeneration(prompt, options = {}){
        const deps = d();
        if(!deps) throw new Error('SmartCanvasCore 未就绪');
        const settings = getMusicSettings();
        if(!settings.musicProvider) throw new Error('请先选择音频模型所在的 API 平台');
        if(!settings.musicModel) throw new Error('请先选择音频模型(music-2.6 / music-3.0 等)');
        const lyricText = (settings.musicLyrics || '').trim();
        const payload = {
            provider_id: settings.musicProvider,
            model: settings.musicModel,
            prompt: String(prompt || '').trim(),
            lyrics: settings.musicInstrumental ? '' : lyricText,
            audio_setting: {
                is_instrumental: !!settings.musicInstrumental,
                format: settings.musicFormat || 'mp3',
                sample_rate: Number(settings.musicSampleRate) || 44100,
                bitrate: Number(settings.musicBitrate) || 256000,
            },
        };
        if(typeof deps.toast === 'function') deps.toast('正在生成音乐,大约 20-60 秒…');
        const response = await fetch('/api/canvas-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch(_e) { data = null; }
        if(!response.ok){
            const detail = (data && (data.detail || data.error)) || text || `HTTP ${response.status}`;
            throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
        if(!data || !data.audio_url) throw new Error('上游未返回音频 URL');
        showAudioModal(data);
        return data;
    }

    global.SmartCanvasMusic = Object.freeze({
        renderMusicParams,
        bindMusicParams,
        runMusicGeneration,
        showAudioModal,
    });
})(window);
