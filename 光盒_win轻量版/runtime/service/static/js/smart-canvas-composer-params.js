/**
 * Smart Canvas — composer params UI (pills, popovers, renderDynamicParams chain).
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    const sizeChoiceGliderState = new Map();
    const placeholderAspectAnimations = new Map();

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function dynamicParamsEl(){
        return d()?.dynamicParams || null;
    }

    function composerSizePanelEl(){
        return document.getElementById('composerSizePanel');
    }

    function composerCountPanelEl(){
        return document.getElementById('composerCountPanel');
    }

    function composerQualityPanelEl(){
        return document.getElementById('composerQualityPanel');
    }

    function composerVideoReferencePanelEl(){
        return document.getElementById('composerVideoReferencePanel');
    }

    function composerParamRoots(){
        const deps = d();
        return [
            deps?.dynamicParams,
            deps?.composerHeadParams,
            composerSizePanelEl(),
            composerVideoSizeMenuEl(),
            composerQualityPanelEl(),
            composerCountPanelEl(),
            composerVideoReferencePanelEl(),
        ].filter(Boolean);
    }

    function syncSizeChoiceGliders(){
        const root = document.getElementById('composerSizePopover');
        if(!root) return;
        const groups = [
            ...root.querySelectorAll('#composerSizePanel .size-picker-scope, #composerSizePanel .size-picker-list, #composerSizePanel .seg-row, #composerSizePanel .ratio-grid, #composerSizePanel .duration-grid, #composerSizePanel .count-grid'),
            ...root.querySelectorAll('#composerQualityPanel .quality-choice-grid, #composerCountPanel .count-grid')
        ];
        let sizeListIndex = 0;
        groups.forEach((group, index) => {
            const active = group.querySelector('button.active:not(:disabled)');
            if(!active) return;
            let key = '';
            if(group.classList.contains('size-picker-scope')) key = 'scope';
            else if(group.classList.contains('size-picker-list')) key = `size-list-${sizeListIndex++}`;
            else if(group.closest('#composerQualityPanel')) key = 'quality';
            else if(group.closest('#composerCountPanel') || group.closest('#composerSizePanel')) key = 'count';
            else key = `${group.className || 'choice'}-${index}`;
            const groupRect = group.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();
            if(!groupRect.width || !activeRect.width || !activeRect.height) return;
            const next = {
                x:activeRect.left - groupRect.left + group.scrollLeft,
                y:activeRect.top - groupRect.top + group.scrollTop,
                width:activeRect.width,
                height:activeRect.height
            };
            const previous = sizeChoiceGliderState.get(key);
            const glider = document.createElement('span');
            const strong = group.matches('.size-picker-scope, .seg-row, #composerQualityPanel .quality-choice-grid, #composerCountPanel .count-grid, #composerSizePanel .count-grid');
            glider.className = `size-choice-glider ${strong ? 'is-strong' : 'is-soft'}${previous ? ' is-primed' : ''}`;
            glider.setAttribute('aria-hidden', 'true');
            group.classList.add('has-size-choice-glider', strong ? 'has-strong-size-glider' : 'has-soft-size-glider');
            group.prepend(glider);
            const apply = state => {
                glider.style.setProperty('--size-glider-x', `${state.x}px`);
                glider.style.setProperty('--size-glider-y', `${state.y}px`);
                glider.style.setProperty('--size-glider-width', `${state.width}px`);
                glider.style.setProperty('--size-glider-height', `${state.height}px`);
            };
            apply(previous || next);
            sizeChoiceGliderState.set(key, next);
            requestAnimationFrame(() => {
                if(!glider.isConnected) return;
                glider.classList.remove('is-primed');
                apply(next);
            });
        });
    }

    function controlTypeKey(el){
        return el ? Array.from(el.classList).find(c => c !== 'smart-control' && c.endsWith('-control')) || '' : '';
    }

    function queryComposerParams(selector){
        const matches = [];
        composerParamRoots().forEach(root => {
            root.querySelectorAll(selector).forEach(el => matches.push(el));
        });
        return matches;
    }

    function openControlState(){
        let el = null;
        composerParamRoots().some(root => {
            el = root.querySelector('.smart-control.pinned, .smart-control.interacting');
            return Boolean(el);
        });
        const key = controlTypeKey(el);
        if(!key) return null;
        return { key, pinned: el.classList.contains('pinned'), interacting: el.classList.contains('interacting') };
    }

    function restoreOpenControl(state){
        if(!state) return;
        let match = null;
        composerParamRoots().some(root => {
            match = root.querySelector(`.smart-control.${state.key}`);
            return Boolean(match);
        });
        if(!match) return;
        if(state.pinned) match.classList.add('pinned');
        if(state.interacting) match.classList.add('interacting');
    }

    function dynamicParamsScrollSnapshot(){
        const roots = composerParamRoots();
        if(!roots.length) return null;
        const sizePickers = [];
        roots.forEach(root => {
            root.querySelectorAll('.size-picker-control').forEach(ctrl => {
                sizePickers.push({
                    key: controlTypeKey(ctrl),
                    lists: [...ctrl.querySelectorAll('.size-picker-list')].map(list => ({
                        top: list.scrollTop || 0,
                        left: list.scrollLeft || 0
                    }))
                });
            });
        });
        const dynamicParams = dynamicParamsEl();
        return {
            top: dynamicParams?.scrollTop || 0,
            left: dynamicParams?.scrollLeft || 0,
            sizePickers,
        };
    }

    function restoreDynamicParamsScroll(snapshot){
        if(!snapshot) return;
        const dynamicParams = dynamicParamsEl();
        const apply = () => {
            if(dynamicParams){
                dynamicParams.scrollTop = snapshot.top || 0;
                dynamicParams.scrollLeft = snapshot.left || 0;
            }
            const used = new Set();
            (snapshot.sizePickers || []).forEach(item => {
                const pickers = queryComposerParams('.size-picker-control');
                const index = pickers.findIndex((ctrl, i) => !used.has(i) && (!item.key || controlTypeKey(ctrl) === item.key));
                if(index < 0) return;
                used.add(index);
                const lists = pickers[index].querySelectorAll('.size-picker-list');
                (item.lists || []).forEach((pos, listIndex) => {
                    const list = lists[listIndex];
                    if(!list) return;
                    list.scrollTop = pos.top || 0;
                    list.scrollLeft = pos.left || 0;
                });
            });
        };
        apply();
        requestAnimationFrame(apply);
    }


let _jimengModelRefreshing = false;
let _jimengLastEditMode = null;
let _jimengLastVideoCommand = null;

    function ensureApiImageQualityDefault(){
        const settings = d()?.settings;
        if(!settings || settings.apiKind === 'video') return;
        if(settings.engine === 'api' || settings.engine === 'volcengine') settings.quality = 'low';
    }

    const COMPOSER_TOOL_WRAPS = [
        ['composerKindWrap', 'composerKindBtn'],
        ['composerSizeWrap', 'composerSizeBtn'],
        ['composerApiSettingsWrap', 'composerApiSettingsBtn'],
        ['composerVideoReferenceWrap', 'composerVideoReferenceBtn'],
    ];

    function closeComposerToolPopovers(exceptWrapId = ''){
        COMPOSER_TOOL_WRAPS.forEach(([wrapId, btnId]) => {
            if(exceptWrapId && wrapId === exceptWrapId) return;
            const wrap = document.getElementById(wrapId);
            const btn = document.getElementById(btnId);
            if(!wrap) return;
            wrap.classList.remove('open');
            if(btn){
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function closeComposerApiSettings(){
        closeComposerToolPopovers();
    }

    function toggleComposerToolPopover(wrapId, btnId, event){
        const wrap = document.getElementById(wrapId);
        const btn = document.getElementById(btnId);
        if(!wrap || !btn || wrap.hidden) return false;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const open = !wrap.classList.contains('open');
        closeComposerToolPopovers(open ? wrapId : '');
        if(open){
            wrap.classList.add('open');
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
        }
        return false;
    }

    function bindComposerToolPopovers(){
        const bindingVersion = '6';
        if(document.documentElement.dataset.boundComposerToolPopovers === bindingVersion) return;
        document.documentElement.dataset.boundComposerToolPopovers = bindingVersion;
        document.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target : null;
            if(!target) return;
            const pair = COMPOSER_TOOL_WRAPS.find(([, btnId]) => target.closest(`#${btnId}`));
            if(!pair) return;
            const [wrapId, btnId] = pair;
            const wrap = document.getElementById(wrapId);
            if(!wrap || wrap.hidden) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            toggleComposerToolPopover(wrapId, btnId, event);
        }, true);
        document.addEventListener('pointerdown', event => {
            const target = event.target instanceof Element ? event.target : null;
            if(target && COMPOSER_TOOL_WRAPS.some(([wrapId]) => target.closest(`#${wrapId}`))) return;
            closeComposerToolPopovers();
        }, true);
    }

    function bindComposerApiSettings(){
        bindComposerToolPopovers();
    }

    function composerImageSizeMenuEl(){
        return document.getElementById('composerImageSizeMenu');
    }

    function composerVideoSizeMenuEl(){
        return document.getElementById('composerVideoSizeMenu');
    }

    function setComposerSizeSectionVisibility(section, visible){
        document.querySelectorAll(`[data-composer-size-section="${section}"]`).forEach(el => {
            el.hidden = !visible;
        });
    }

    function showComposerImageSizeMenu(){
        const imageMenu = composerImageSizeMenuEl();
        const videoMenu = composerVideoSizeMenuEl();
        if(imageMenu){
            imageMenu.hidden = false;
            imageMenu.removeAttribute('hidden');
        }
        if(videoMenu){
            videoMenu.hidden = true;
            videoMenu.setAttribute('hidden', '');
            videoMenu.classList.remove('video-settings-flat');
            videoMenu.innerHTML = '';
        }
    }

    function showComposerVideoSizeMenu(html = ''){
        const imageMenu = composerImageSizeMenuEl();
        const videoMenu = composerVideoSizeMenuEl();
        if(imageMenu){
            imageMenu.hidden = true;
            imageMenu.setAttribute('hidden', '');
        }
        if(videoMenu){
            videoMenu.hidden = false;
            videoMenu.removeAttribute('hidden');
            videoMenu.classList.add('video-settings-flat');
            videoMenu.innerHTML = html || '';
        }
    }

    function hideComposerSizeMenus(){
        const imageMenu = composerImageSizeMenuEl();
        const videoMenu = composerVideoSizeMenuEl();
        if(imageMenu){
            imageMenu.hidden = true;
            imageMenu.setAttribute('hidden', '');
        }
        if(videoMenu){
            videoMenu.hidden = true;
            videoMenu.setAttribute('hidden', '');
            videoMenu.classList.remove('video-settings-flat');
            videoMenu.innerHTML = '';
        }
    }

    function renderComposerSubmenuSection(title, content){
        const escapeHtml = d()?.escapeHtml || (v => String(v));
        return `<div class="composer-submenu-section">
            <div class="composer-submenu-label">${escapeHtml(title)}</div>
            ${content}
        </div>`;
    }

    function renderComposerCountGridContent(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const countFn = deps.smartVideoGenerationCount;
        const value = settings.apiKind === 'video'
            ? (typeof countFn === 'function' ? countFn(settings) : 1)
            : Math.max(1, Number(settings.count || 1) || 1);
        return `<div class="count-grid">
            ${[2,4,6,8].map(n => `<button type="button" class="count-cell ${n === value ? 'active' : ''}" data-smart-param="count" data-smart-value="${n}">${n}张</button>`).join('')}
        </div>`;
    }

    function renderComposerSizeRatioBody(prefix='', includeSource=false){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const sourceImageRatioLabel = deps.sourceImageRatioLabel;
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const currentRatio = settings[ratioKey] && settings[ratioKey] !== 'custom'
            ? settings[ratioKey]
            : (includeSource ? 'source' : 'square');
        const sourceLabel = typeof sourceImageRatioLabel === 'function' ? sourceImageRatioLabel(prefix) : '';
        const ratios = [
            ['square','1:1'], ['portrait','2:3'], ['landscape','3:2'], ['portrait43','3:4'], ['landscape43','4:3'],
            ['story','9:16'], ['wide','16:9'], ['ultrawide','21:9'], ['ultratall','9:21'],
            ...(includeSource ? [['source', sourceLabel || 'Auto']] : [])
        ];
        return `<div class="size-picker-list size-picker-ratio-list">
            ${ratios.map(([value, label]) => `<button type="button" class="size-picker-option ${value === currentRatio ? 'active' : ''}" data-smart-param="${ratioKey}" data-smart-value="${escapeHtml(value)}" aria-label="${escapeHtml(label)}"><span class="ratio-icon size-picker-ratio-icon ${ratioIconClass(value)}" aria-hidden="true"></span><span class="size-picker-ratio-value">${escapeHtml(label)}</span></button>`).join('')}
        </div>`;
    }

    function renderComposerSizeQualityBody(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const options = ['1k','2k','4k'];
        const currentRes = ['1k','2k','4k'].includes(settings[resKey]) ? settings[resKey] : '1k';
        return `<div class="size-picker-list size-picker-resolution-list">
            ${options.map(value => `<button type="button" class="size-picker-option ${value === currentRes ? 'active' : ''}" data-smart-param="${resKey}" data-smart-value="${value}"><span>${value.toUpperCase()}</span></button>`).join('')}
        </div>`;
    }

    function applyComposerImageSizeMenu(prefix='', includeSource=false){
        showComposerImageSizeMenu();
        setComposerSizeSectionVisibility('ratio', true);
        setComposerSizeSectionVisibility('quality', true);
        setComposerSizeSectionVisibility('count', true);
        const countSectionLabel = document.querySelector('[data-composer-size-section="count"] .composer-submenu-label');
        if(countSectionLabel) countSectionLabel.textContent = '张数选择';
        setComposerSizePanel(renderComposerSizeRatioBody(prefix, includeSource));
        setComposerQualityPanel(renderComposerSizeQualityBody(prefix));
        setComposerCountPanel(renderComposerCountGridContent());
    }

    function renderComposerSizePopoverBody(prefix='', includeSource=false){
        applyComposerImageSizeMenu(prefix, includeSource);
        return composerImageSizeMenuEl()?.outerHTML || '';
    }

    function renderQualityControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const value = settings.quality || 'low';
        const labels = {auto:tr('smart.qualityAuto'), low:tr('smart.qualityLow'), medium:tr('smart.qualityMid'), high:tr('smart.qualityHigh')};
        return `<div class="quality-choice-grid">
            ${Object.entries(labels).map(([k, l]) => `<button type="button" class="${k === value ? 'active' : ''}" data-smart-param="quality" data-smart-value="${escapeHtml(k)}">${escapeHtml(l)}</button>`).join('')}
        </div>`;
    }

    function renderCountPanelContent(){
        return renderComposerCountGridContent();
    }

    function setComposerSizePanel(html = ''){
        const panel = composerSizePanelEl();
        if(panel) panel.innerHTML = html || '';
    }

    function setComposerCountPanel(html = ''){
        const panel = composerCountPanelEl();
        if(panel) panel.innerHTML = html || '';
    }

    function setComposerQualityPanel(html = ''){
        const panel = composerQualityPanelEl();
        if(panel) panel.innerHTML = html || '';
    }

    function setComposerVideoReferencePanel(html = ''){
        const panel = composerVideoReferencePanelEl();
        if(panel) panel.innerHTML = html || '';
    }

    function clearComposerOverflowParams(){
        const dynamicParams = dynamicParamsEl();
        if(dynamicParams) dynamicParams.innerHTML = '';
    }

    function currentSizePrefix(){
        const settings = d()?.settings;
        if(!settings) return '';
        if(settings.engine === 'modelscope') return 'ms';
        return '';
    }

    function updateComposerToolBtnLabels(){
        const deps = d();
        const settings = deps?.settings;
        const apiLabel = document.getElementById('composerApiSettingsBtnLabel');
        const apiIcon = document.getElementById('composerApiSettingsBtnIcon');
        const apiButton = document.getElementById('composerApiSettingsBtn');
        const sizeLabel = document.getElementById('composerSizeBtnLabel');
        const kindLabel = document.getElementById('composerKindBtnLabel');
        const qualityLabel = document.getElementById('composerQualityBtnLabel');
        const countLabel = document.getElementById('composerCountBtnLabel');
        const countDivider = document.querySelector('#composerSizeBtn .composer-size-summary-divider');
        const audioSummary = document.getElementById('composerVideoAudioSummary');
        const referenceWrap = document.getElementById('composerVideoReferenceWrap');
        const referenceLabel = document.getElementById('composerVideoReferenceBtnLabel');
        const tr = deps?.tr || (k => k);
        if(settings?.apiKind === 'video' && typeof deps?.normalizeSmartVideoModeSettings === 'function'){
            deps.normalizeSmartVideoModeSettings(settings);
        }
        const activeKind = global.SmartCanvasComposerText?.modeFor?.(deps?.selectedNode?.()) || settings?.apiKind || 'image';
        const MB = global.SmartCanvasModeBindings;
        const modelLabel = settings?.apiKind === 'video'
            ? (MB?.customNameForModel?.('video', settings?.videoModel, settings?.videoProvider, settings?.videoModelAlias)
                || global.SmartCanvasProviderSelection?.videoModelDisplayName(settings?.videoModel, settings?.videoProvider) || settings?.videoModel)
            : settings?.apiKind === 'audio'
                ? (MB?.customNameForModel?.('audio', settings?.audioModel, settings?.audioProvider, settings?.audioModelAlias) || settings?.audioModel)
            : settings?.engine === 'modelscope'
                ? (settings?.msCustomModel || settings?.msgenModel)
                : settings?.engine === 'comfy'
                    ? (settings?.comfyWorkflow || 'ComfyUI')
                    : settings?.engine === 'runninghub'
                        ? (settings?.rhConfigKey || 'RunningHub')
                        : (MB?.customNameForModel?.('image', settings?.model, settings?.provider_id, settings?.modelAlias) || settings?.model);
        const apiText = modelLabel || 'API设置';
        if(apiLabel) apiLabel.textContent = apiText;
        if(apiIcon && global.ModelBrandIcons) apiIcon.innerHTML = global.ModelBrandIcons.iconFor(apiText);
        if(apiButton){
            apiButton.title = apiText;
            apiButton.setAttribute('aria-label', `当前模型：${apiText}`);
        }
        if(kindLabel) kindLabel.textContent = ({text:'文本', image:'图片', video:'视频', audio:'音频'})[activeKind] || '图片';
        if(sizeLabel){
            const prefix = currentSizePrefix();
            if(settings?.apiKind === 'video'){
                const modeLabels = {text:'文生视频', omni:'全能参考', image:'图生视频', frames:'首尾帧', reference:'参考生视频'};
                const options = videoModelOptions(settings);
                const aspect = settings.videoAspect || '';
                const resolution = settings.videoResolution || '';
                const duration = settings.videoDuration || '';
                const parts = [
                    modeLabels[currentVideoReferenceMode(settings)] || '视频',
                    options.aspects.length ? (isStandardAspectDisplay(aspect) ? aspect : 'Auto') : '',
                    options.resolutions.length ? resolution : '',
                    options.durations.length ? `${duration}s` : ''
                ].filter(Boolean);
                sizeLabel.textContent = parts.join(' · ');
            } else {
                const label = sizePickerLabel(prefix);
                sizeLabel.textContent = label || '尺寸';
            }
        }
        if(qualityLabel){
            const labels = {auto:tr('smart.qualityAuto'), low:tr('smart.qualityLow'), medium:tr('smart.qualityMid'), high:tr('smart.qualityHigh')};
            qualityLabel.textContent = labels[settings?.quality || 'low'] || tr('smart.quality');
        }
        const videoMode = settings?.apiKind === 'video';
        if(countLabel){
            const countFn = deps?.smartVideoGenerationCount;
            const value = settings?.apiKind === 'video'
                ? (typeof countFn === 'function' ? countFn(settings) : 1)
                : Math.max(1, Number(settings?.count || 1) || 1);
            const unit = tr('smart.countUnit');
            countLabel.textContent = unit ? `${value} ${unit}` : String(value);
            countLabel.hidden = videoMode;
        }
        if(countDivider) countDivider.hidden = videoMode;
        if(audioSummary){
            const audioMode = videoMode ? videoModelOptions(settings).audio : 'none';
            audioSummary.hidden = audioMode === 'none';
            audioSummary.title = audioMode === 'always' ? '模型原生音频（始终开启）' : (settings?.videoGenerateAudio ? '生成音频已开启' : '生成音频已关闭');
        }
        if(referenceWrap) referenceWrap.hidden = true;
        if(referenceLabel && videoMode){
            const labels = {text:'文生视频', omni:'全能参考', image:'图生视频', frames:'首尾帧', reference:'图片参考'};
            referenceLabel.textContent = labels[currentVideoReferenceMode(settings)] || '参考';
        }
    }

    function syncComposerToolVisibility(){
        const settings = d()?.settings;
        const sizeWrap = document.getElementById('composerSizeWrap');
        const sizePanel = composerSizePanelEl();
        const qualityPanel = composerQualityPanelEl();
        const countPanel = composerCountPanelEl();
        const videoMenu = composerVideoSizeMenuEl();
        const hasVideo = Boolean(videoMenu && !videoMenu.hidden && videoMenu.innerHTML.trim());
        const hasImage = [sizePanel, qualityPanel, countPanel].some(panel => panel?.innerHTML.trim());
        if(sizeWrap){
            sizeWrap.hidden = settings?.apiKind === 'video' ? !hasVideo : !(hasImage || hasVideo);
            if(sizeWrap.hidden){
                sizeWrap.classList.remove('open');
                document.getElementById('composerSizeBtn')?.classList.remove('active');
            }
        }
    }

    function renderCountVisualControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const countFn = deps.smartVideoGenerationCount;
        const value = settings.apiKind === 'video'
            ? (typeof countFn === 'function' ? countFn(settings) : 1)
            : Math.max(1, Number(settings.count || 1) || 1);
        return `<div class="smart-control count-control">
        <button class="smart-pill" type="button"><i data-lucide="copy"></i><span>${value}${tr('smart.countUnit') ? ' ' + escapeHtml(tr('smart.countUnit')) : ''}</span></button>
        <div class="smart-popover compact-popover" style="min-width:170px">
            <div class="smart-popover-title">${escapeHtml(tr('smart.count'))}</div>
            <div class="count-grid">
                ${[1,2,3,4,5,6,7,8].map(n => `<button type="button" class="count-cell ${n === value ? 'active' : ''}" data-smart-param="count" data-smart-value="${n}">${n}</button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function optionHtml(value, label, selected, escapeHtml){
        const esc = escapeHtml || (v => String(v));
        return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label ?? value)}</option>`;
    }

    function normalizeApiSizeSettings(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        if(!['1k','2k','4k'].includes(settings[resKey])) settings[resKey] = '1k';
        if(!prefix && settings.apiKind !== 'video'){
            if(settings.ratioExplicit !== true){
                settings[ratioKey] = 'source';
                settings.ratioExplicit = false;
            } else if(!settings[ratioKey]){
                settings[ratioKey] = 'source';
            }
        } else if(!settings[ratioKey] || settings[ratioKey] === 'custom') {
            settings[ratioKey] = prefix ? 'square' : 'source';
        }
        if(!prefix && settings.apiKind !== 'video') settings.quality = 'low';
    }

    function renderSizeControls(prefix='', includeSource=false){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const defaultSmartApiResolution = deps.defaultSmartApiResolution;
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const ratios = [
            ['square','1:1'], ['portrait','2:3'], ['landscape','3:2'], ['portrait43','3:4'], ['landscape43','4:3'], ['story','9:16'], ['wide','16:9'], ['ultrawide','21:9'], ['ultratall','9:21'],
            ...(includeSource ? [['source', tr('canvas.adaptiveRatio') || '适配比例']] : []),
            ['custom', tr('canvas.custom') || '自定义']
        ];
        const resolutionOptions = (!prefix && settings.engine === 'api') ? ['auto','1k','2k','4k','custom'] : ['1k','2k','4k','custom'];
        const defaultRes = typeof defaultSmartApiResolution === 'function' ? defaultSmartApiResolution(settings.model) : '1k';
        return `<select data-param="${resKey}">
            ${resolutionOptions.map(v => optionHtml(v, v === 'auto' ? '自动' : (v === 'custom' ? (tr('canvas.custom') || '自定义') : v.toUpperCase()), settings[resKey] || (prefix ? '1k' : defaultRes), escapeHtml)).join('')}
        </select>
        <select data-param="${ratioKey}" ${settings[resKey] === 'custom' || settings[resKey] === 'auto' ? 'disabled' : ''}>
            ${ratios.map(([v,l]) => `<option value="${escapeHtml(v)}" ${v === (settings[ratioKey] || 'square') ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}
        </select>`;
    }

    function renderCountControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        return `<select data-param="count">${[1,2,3,4,5,6,7,8].map(n => optionHtml(n, `${n} 张`, Number(settings.count || 1), escapeHtml)).join('')}</select>`;
    }

    function resolutionLabel(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const sizeKey = prefix ? `${prefix}CustomSize` : 'customSize';
        const value = settings[resKey] || defaultResolution(prefix, settings, deps);
        if(value === 'auto') return '自动';
        return value === 'custom' ? (settings[sizeKey] || tr('smart.custom')) : value.toUpperCase();
    }

    function ratioIconClass(value){
        if(value === 'portrait') return 'r-portrait';
        if(value === 'portrait43') return 'r-portrait43';
        if(value === 'landscape') return 'r-landscape';
        if(value === 'landscape43') return 'r-landscape43';
        if(value === 'wide' || value === 'ultrawide') return 'r-wide';
        if(value === 'story' || value === 'ultratall') return 'r-story';
        if(value === 'source') return 'r-source';
        if(value === 'custom') return 'r-custom';
        return '';
    }

    function renderRatioControl(prefix='', includeSource=false){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const ratioLabelFn = deps.ratioLabel;
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const ratios = [
            ['square','1:1'], ['portrait','2:3'], ['landscape','3:2'], ['portrait43','3:4'], ['landscape43','4:3'],
            ['story','9:16'], ['wide','16:9'], ['ultrawide','21:9'], ['ultratall','9:21'],
            ...(includeSource ? [['source', tr('smart.imageRatio')]] : []),
            ['custom', tr('smart.custom')]
        ];
        const label = typeof ratioLabelFn === 'function' ? ratioLabelFn(prefix) : '';
        return `<div class="smart-control ratio-control">
        <button class="smart-pill" type="button"><i data-lucide="scan"></i><span>${escapeHtml(label)}</span></button>
        <div class="smart-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.ratio'))}</div>
            <div class="ratio-grid">
                ${ratios.map(([value, lbl]) => `<button type="button" class="ratio-option ${value === (settings[ratioKey] || 'square') ? 'active' : ''}" data-smart-param="${ratioKey}" data-smart-value="${escapeHtml(value)}"><span class="ratio-icon ${ratioIconClass(value)}"></span><span>${escapeHtml(lbl)}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderResolutionControl(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const isGptImageAutoSizeModel = deps.isGptImageAutoSizeModel;
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const options = (!prefix && settings.engine === 'api') ? ['auto','1k','2k','4k','custom'] : ['1k','2k','4k','custom'];
        const current = settings[resKey] || defaultResolution(prefix, settings, deps);
        const allowAuto = !prefix && settings.engine === 'api' && settings.apiKind !== 'video'
            && typeof isGptImageAutoSizeModel === 'function' && isGptImageAutoSizeModel(settings.model);
        return `<div class="smart-control resolution-control">
        <button class="smart-pill" type="button"><i data-lucide="monitor"></i><span>${escapeHtml(resolutionLabel(prefix))}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.resolution'))}</div>
            <div class="seg-row">
                ${options.map(value => `<button type="button" class="${value === current ? 'active' : ''}" data-smart-param="${resKey}" data-smart-value="${value}" ${value === 'auto' && !allowAuto ? 'disabled' : ''}>${value === 'auto' ? '自动' : (value === 'custom' ? escapeHtml(tr('smart.custom')) : value.toUpperCase())}</button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    // 菜单行内容：公司图标 + 模型名（悬停时下方上滑一句话说明）+ 选中对号
    function modeModelChoiceInner(label, escapeHtml){
        const BI = global.ModelBrandIcons;
        const icon = BI ? `<span class="mode-model-ico">${BI.iconFor(label)}</span>` : '';
        const check = BI ? `<span class="mode-model-check">${BI.CHECK_SVG}</span>` : '';
        const desc = BI?.descFor ? BI.descFor(label) : '';
        const descHtml = desc ? `<span class="mode-model-desc">${escapeHtml(desc)}</span>` : '';
        return `${icon}<span class="mode-model-copy"><span class="mode-model-title-row"><span class="mode-model-name">${escapeHtml(label)}</span></span>${descHtml}</span>${check}`;
    }

    function renderModeModelList(mode){
        const deps = d();
        const settings = deps?.settings;
        const MB = global.SmartCanvasModeBindings;
        if(!settings || !MB) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const node = deps.selectedNode?.();
        const current = MB.currentModel(settings, node, mode);
        const customs = MB.customRows?.(mode) || [];
        if(customs.length){
            // 自定义名字菜单：全部固定名字都显示；未绑定的置灰，
            // 点击已绑定名字时再解析成真实 provider+model。
            const keys = MB.MODE_SETTINGS?.[mode] || {};
            const currentProvider = keys.onNode ? node?.[keys.provider] : settings?.[keys.provider];
            const bound = entry => entry.provider_id && entry.model;
            // 高亮优先跟随用户实际点选的别名（多个别名可能绑同一个真实模型）
            const aliasName = keys.onNode ? node?.[keys.model + 'Alias'] : settings?.[keys.model + 'Alias'];
            let activeIdx = customs.findIndex(entry => bound(entry) && entry.name === aliasName && entry.model === current);
            if(activeIdx < 0) activeIdx = customs.findIndex(entry => bound(entry) && entry.model === current && entry.provider_id === currentProvider);
            if(activeIdx < 0) activeIdx = customs.findIndex(entry => bound(entry) && entry.model === current);
            return `<div class="composer-submenu-stack composer-model-menu" data-mode-model-menu="${escapeHtml(mode)}">
                <div class="composer-submenu-section">
                    <div class="composer-submenu-label">模型选择</div>
                    <div class="composer-mode-model-list" data-mode-model-list="${escapeHtml(mode)}">${customs.map((entry, idx) => bound(entry)
                        ? `<button type="button" class="mode-model-choice ${idx === activeIdx ? 'active' : ''}" data-mode-model-select="${escapeHtml(mode)}" data-mode-model-value="${escapeHtml(entry.name)}">${modeModelChoiceInner(entry.name, escapeHtml)}</button>`
                        : `<button type="button" class="mode-model-choice is-unbound" disabled title="未绑定，请在 API 设置 · 画布显示名中绑定平台">${modeModelChoiceInner(entry.name, escapeHtml)}</button>`
                    ).join('')}</div>
                </div>
            </div>`;
        }
        const models = MB.enabledModels(mode);
        if(!models.length){
            return `<div class="muted-note">请先在 API 设置中为${({text:'文本',image:'图像',video:'视频',audio:'音频'})[mode] || ''}模式配置模型</div>`;
        }
        return `<div class="composer-submenu-stack composer-model-menu" data-mode-model-menu="${escapeHtml(mode)}">
            <div class="composer-submenu-section">
                <div class="composer-submenu-label">模型选择</div>
                <div class="composer-mode-model-list" data-mode-model-list="${escapeHtml(mode)}">${models.map(model => {
                    const label = mode === 'video' ? (global.SmartCanvasProviderSelection?.videoModelDisplayName(model) || model) : model;
                    return `<button type="button" class="mode-model-choice ${model === current ? 'active' : ''}" data-mode-model-select="${escapeHtml(mode)}" data-mode-model-value="${escapeHtml(model)}">${modeModelChoiceInner(label, escapeHtml)}</button>`;
                }).join('')}</div>
            </div>
        </div>`;
    }

    function applyModeModelSelection(mode, model){
        const deps = d();
        const settings = deps?.settings;
        const MB = global.SmartCanvasModeBindings;
        if(!settings || !MB || !mode || !model) return;
        MB.applyBindingToSettings(settings, mode);
        const keys = MB.MODE_SETTINGS?.[mode];
        if(!keys) return;
        // 自定义名字：菜单值是别名，落到 settings 的是绑定的真实 provider+model。
        const custom = MB.customEntryByName?.(mode, model);
        // 用户显式点选 → 记为该模态的全局默认（全画布跟随）
        if(custom) MB.setGlobalAlias?.(mode, custom.name);
        const targetModel = custom ? custom.model : model;
        const targetProvider = custom
            ? custom.provider_id
            : (MB.providerForModel(mode, model) || MB.bindingProviderId(mode, model));
        const aliasKey = keys.model + 'Alias';
        if(keys.onNode){
            const node = deps.selectedNode?.();
            if(node){
                node[keys.provider] = targetProvider;
                node[keys.model] = targetModel;
                node[aliasKey] = custom ? custom.name : '';
                deps.scheduleSave?.();
            }
        } else {
            settings[keys.provider] = targetProvider;
            settings[keys.model] = targetModel;
            settings[aliasKey] = custom ? custom.name : '';
            if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
            if(typeof deps.rememberRecentSmartSettings === 'function') deps.rememberRecentSmartSettings(settings, deps.activeSettingsSubject?.());
            renderDynamicParams();
            if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
        }
        updateComposerToolBtnLabels();
    }

    function renderProviderControl(providers){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const apiProviderById = deps.apiProviderById;
        const list = providers || [];
        const current = list.find(p => p.id === settings.provider_id)
            || (typeof apiProviderById === 'function' ? apiProviderById(settings.provider_id) : null);
        const providerImageModels = deps.providerImageModels;
        return `<div class="composer-api-tree" data-api-tree="image">
            ${list.map(p => {
                const models = typeof providerImageModels === 'function' ? providerImageModels(p.id) : [];
                const active = p.id === settings.provider_id;
                return `<details class="composer-api-branch ${active ? 'active' : ''}" open>
                    <summary data-api-provider-param="provider_id" data-api-provider-id="${escapeHtml(p.id)}"><span class="composer-api-row-label">模型</span><span class="composer-api-provider-name">${escapeHtml(p.name || p.id)}</span><i data-lucide="chevron-right"></i></summary>
                    <div class="composer-api-models">${models.map(model => `<button type="button" class="${active && model === settings.model ? 'active' : ''}" data-api-tree-model="${escapeHtml(model)}" data-api-provider-param="provider_id" data-api-provider-id="${escapeHtml(p.id)}" data-api-model-param="model">${escapeHtml(model)}</button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noImageModel'))}</div>`}</div>
                </details>`;
            }).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noApiPlatform'))}</div>`}
        </div>`;
    }

    function renderModelControl(models){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const list = models || [];
        return `<div class="smart-control model-control">
        <button class="smart-pill" type="button"><i data-lucide="sparkles"></i><span class="sub">${escapeHtml(settings.model || tr('smart.model'))}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.imageModel'))}</div>
            <div class="model-list">
                ${list.map(m => `<button type="button" class="direct-option ${m === settings.model ? 'active' : ''}" data-smart-param="model" data-smart-value="${escapeHtml(m)}"><span>${escapeHtml(m)}</span></button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noImageModel'))}</div>`}
            </div>
        </div>
    </div>`;
    }

    function defaultResolution(prefix, settings, deps){
        const fn = deps?.defaultSmartApiResolution;
        if(!prefix && settings.engine === 'api' && typeof fn === 'function') return fn(settings.model);
        return '1k';
    }

    function sizePickerScope(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return 'preset';
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const value = settings[resKey] || defaultResolution(prefix, settings, deps);
        if(value === 'auto') return 'auto';
        if(value === 'custom' || settings[ratioKey] === 'custom') return 'custom';
        return 'preset';
    }

    function sizePickerDefaultResolution(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '1k';
        const value = defaultResolution(prefix, settings, deps);
        return value === 'auto' ? '1k' : value;
    }

    function sizePickerLabel(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const ratioLabel = deps.ratioLabel;
        const scope = sizePickerScope(prefix);
        if(scope === 'auto') return `Auto · ${resolutionLabel(prefix)}`;
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const ratioText = typeof ratioLabel === 'function' ? ratioLabel(prefix) : '';
        if(['source', 'custom'].includes(settings[ratioKey]) || !isStandardAspectDisplay(ratioText)) return `Auto · ${resolutionLabel(prefix)}`;
        if(scope === 'custom'){
            const resKey = prefix ? `${prefix}Resolution` : 'resolution';
            const resText = resolutionLabel(prefix);
            if(settings[resKey] === 'custom' && settings[ratioKey] === 'custom') return `自定义 · ${resText} · ${ratioText}`;
            if(settings[resKey] === 'custom') return `自定义 · ${resText}`;
            if(settings[ratioKey] === 'custom') return `自定义 · ${ratioText} · ${resText}`;
            return `自定义 · ${resText}`;
        }
        return `${ratioText} · ${resolutionLabel(prefix)}`;
    }

    function isStandardAspectDisplay(value=''){
        return new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', '9:21']).has(String(value || '').trim());
    }

    function renderSizePickerControl(prefix='', includeSource=false){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const sourceImageRatioLabel = deps.sourceImageRatioLabel;
    const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        const options = ['1k','2k','4k'];
        const currentRes = ['1k','2k','4k'].includes(settings[resKey]) ? settings[resKey] : '1k';
        const currentRatio = settings[ratioKey] && settings[ratioKey] !== 'custom'
            ? settings[ratioKey]
            : (includeSource ? 'source' : 'square');
        const sourceLabel = typeof sourceImageRatioLabel === 'function' ? sourceImageRatioLabel(prefix) : '';
        const ratios = [
            ['square','1:1'], ['portrait','2:3'], ['landscape','3:2'], ['portrait43','3:4'], ['landscape43','4:3'],
            ['story','9:16'], ['wide','16:9'], ['ultrawide','21:9'], ['ultratall','9:21'],
            ...(includeSource ? [['source', sourceLabel || 'Auto']] : [])
        ];
        return `<div class="smart-control size-picker-control">
        <button class="smart-pill size-picker-pill" type="button"><i data-lucide="scan-line"></i><span class="size-picker-label"><span class="size-picker-type">尺寸</span><span class="size-picker-dot"></span><span class="size-picker-value">${escapeHtml(sizePickerLabel(prefix))}</span></span></button>
        <div class="smart-popover size-picker-popover composer-submenu-stack">
            ${renderComposerSubmenuSection('尺寸选择', `<div class="size-picker-list size-picker-ratio-list">
                ${ratios.map(([value, label]) => `<button type="button" class="size-picker-option ${value === currentRatio ? 'active' : ''}" data-smart-param="${ratioKey}" data-smart-value="${escapeHtml(value)}" aria-label="${escapeHtml(label)}"><span class="ratio-icon size-picker-ratio-icon ${ratioIconClass(value)}" aria-hidden="true"></span><span class="size-picker-ratio-value">${escapeHtml(label)}</span></button>`).join('')}
            </div>`)}
            ${renderComposerSubmenuSection('质量选择', `<div class="size-picker-list size-picker-resolution-list">
                ${options.map(value => `<button type="button" class="size-picker-option ${value === currentRes ? 'active' : ''}" data-smart-param="${resKey}" data-smart-value="${value}"><span>${value.toUpperCase()}</span></button>`).join('')}
            </div>`)}
        </div>
    </div>`;
    }

    function msModelLabel(key){
        const deps = d();
        const tr = deps?.tr || (k => k);
        const MS_GEN_MODELS = deps?.MS_GEN_MODELS || {};
        if(key === 'custom') return tr('smart.custom');
        return MS_GEN_MODELS[key]?.label || key;
    }

    function renderMsFunctionControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const MS_GEN_MODELS = deps?.MS_GEN_MODELS || {};
        return `<div class="smart-control provider-control">
        <button class="smart-pill" type="button"><i data-lucide="sparkles"></i><span class="sub">${escapeHtml(msModelLabel(settings.msgenModel) || 'Modelscope')}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.msFunction'))}</div>
            <div class="model-list">
                ${Object.entries(MS_GEN_MODELS).map(([key]) => `<button type="button" class="direct-option ${key === settings.msgenModel ? 'active' : ''}" data-smart-param="msgenModel" data-smart-value="${escapeHtml(key)}"><span>${escapeHtml(msModelLabel(key))}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderMsCustomModelPill(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings || settings.msgenModel !== 'custom') return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const modelscopeImageModels = deps?.modelscopeImageModels;
        const models = typeof modelscopeImageModels === 'function' ? modelscopeImageModels() : [];
        const label = settings.msCustomModel || tr('smart.customModel');
        return `<div class="smart-control model-control">
        <button class="smart-pill" type="button"><i data-lucide="boxes"></i><span class="sub">${escapeHtml(label)}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.msCustomModel'))}</div>
            <div class="model-list">
                ${models.map(m => `<button type="button" class="direct-option ${m === settings.msCustomModel ? 'active' : ''}" data-smart-param="msCustomModel" data-smart-value="${escapeHtml(m)}"><span>${escapeHtml(m)}</span></button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noMsModel'))}</div>`}
            </div>
        </div>
    </div>`;
    }

    function renderInlineCustomRatioFields(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        if(settings[ratioKey] === 'source') return '';
        if(settings[ratioKey] !== 'custom') return '';
        const wKey = prefix ? `${prefix}CustomRatioWidth` : 'customRatioWidth';
        const hKey = prefix ? `${prefix}CustomRatioHeight` : 'customRatioHeight';
        return `<div class="inline-fields">
        <span class="inline-label">${escapeHtml(tr('smart.ratio'))}</span>
        <input type="number" data-param="${wKey}" value="${escapeHtml(settings[wKey] || '')}" placeholder="W">
        <span class="inline-divider">:</span>
        <input type="number" data-param="${hKey}" value="${escapeHtml(settings[hKey] || '')}" placeholder="H">
    </div>`;
    }

    function renderInlineCustomSizeFields(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        if(settings[resKey] !== 'custom') return '';
        const wKey = prefix ? `${prefix}CustomWidth` : 'customWidth';
        const hKey = prefix ? `${prefix}CustomHeight` : 'customHeight';
        return `<div class="inline-fields">
        <span class="inline-label">${escapeHtml(tr('smart.size'))}</span>
        <input type="number" data-param="${wKey}" value="${escapeHtml(settings[wKey] || '')}" placeholder="${escapeHtml(tr('smart.width'))}">
        <span class="inline-divider">×</span>
        <input type="number" data-param="${hKey}" value="${escapeHtml(settings[hKey] || '')}" placeholder="${escapeHtml(tr('smart.height'))}">
    </div>`;
    }

    function renderCustomRatioControls(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
        if(settings[ratioKey] !== 'custom' && settings[ratioKey] !== 'source') return '';
        const wKey = prefix ? `${prefix}CustomRatioWidth` : 'customRatioWidth';
        const hKey = prefix ? `${prefix}CustomRatioHeight` : 'customRatioHeight';
        const disabled = settings[ratioKey] === 'source' ? 'disabled' : '';
        return `<input type="number" data-param="${wKey}" value="${escapeHtml(settings[wKey] || '')}" placeholder="比例宽" ${disabled}>
            <input type="number" data-param="${hKey}" value="${escapeHtml(settings[hKey] || '')}" placeholder="比例高" ${disabled}>`;
    }

    function renderCustomSizeControls(prefix=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const resKey = prefix ? `${prefix}Resolution` : 'resolution';
        if(settings[resKey] !== 'custom') return '';
        const wKey = prefix ? `${prefix}CustomWidth` : 'customWidth';
        const hKey = prefix ? `${prefix}CustomHeight` : 'customHeight';
        return `<input type="number" data-param="${wKey}" value="${escapeHtml(settings[wKey] || '')}" placeholder="宽度">
            <input type="number" data-param="${hKey}" value="${escapeHtml(settings[hKey] || '')}" placeholder="高度">`;
    }

    function videoAspectIconClass(value){
        if(value === '16:9' || value === '21:9') return 'r-wide';
        if(value === '9:16' || value === '9:21') return 'r-story';
        if(value === '4:3') return 'r-landscape43';
        if(value === '3:4') return 'r-portrait43';
        if(value === 'keep_ratio' || value === 'adaptive') return 'r-source';
        return '';
    }

    function currentVideoReferenceMode(settings = d()?.settings){
        const resolver = d()?.currentVideoReferenceMode;
        if(typeof resolver === 'function') return resolver(settings);
        const explicit = String(settings?.videoReferenceMode || '');
        if(['text','omni','image','frames','reference'].includes(explicit)) return explicit;
        if(settings?.videoUseFrameRoles) return 'frames';
        if(settings?.videoMultimodal) return 'omni';
        return 'image';
    }

    function videoModelCapabilities(settings = d()?.settings){
        const resolver = d()?.videoModelCapabilities;
        return typeof resolver === 'function'
            ? resolver(settings?.videoModel || '')
            : {recognized:false, modes:{text:false, omni:false, image:false, frames:false, reference:false}};
    }

    function videoModelOptions(settings = d()?.settings){
        const resolver = d()?.videoModelOptions || global.SmartCanvasProviderSelection?.videoModelOptions;
        return typeof resolver === 'function'
            ? resolver(settings)
            : {aspects:[], resolutions:[], durations:[], audio:'none'};
    }

    function videoModeUsesSize(settings = d()?.settings){
        const resolver = d()?.videoModeUsesSize;
        return typeof resolver === 'function' ? resolver(settings) : ['text', 'omni', 'reference'].includes(currentVideoReferenceMode(settings));
    }

    function currentVideoInputImages(){
        const deps = d();
        const node = global.SmartCanvasMultiSelectCompose?.composerSubject?.() || deps?.selectedNode?.();
        if(!node) return [];
        const multiRefs = global.SmartCanvasMultiSelectCompose?.referenceImagesForSubject?.(node);
        const textRefs = global.SmartCanvasComposerText?.referencesFor?.(node);
        const refs = Array.isArray(multiRefs)
            ? multiRefs
            : Array.isArray(textRefs)
                ? textRefs
                : (global.SmartCanvasReferenceImages?.referenceImagesFor?.(node) || []);
        return refs.filter(item => item?.url && !(deps?.isVideoMediaItem?.(item)));
    }

    function videoModeHasRequiredInputs(mode){
        return mode === 'text' || currentVideoInputImages().length > 0;
    }

    function normalizeVideoModeForInputs(settings = d()?.settings){
        if(!settings || settings.apiKind !== 'video') return false;
        const mode = currentVideoReferenceMode(settings);
        if(videoModeHasRequiredInputs(mode)) return false;
        settings.videoReferenceMode = 'text';
        settings.videoUseFrameRoles = false;
        settings.videoMultimodal = false;
        settings._videoMultimodalUserSet = true;
        return true;
    }

    function renderVideoSizeMenuForMode(settings = d()?.settings){
        showComposerVideoSizeMenu(renderFlatVideoSettingsPanel());
    }

    function refreshVideoSettingsPanel(settings = d()?.settings){
        renderVideoSizeMenuForMode(settings);
        updateComposerToolBtnLabels();
        syncComposerToolVisibility();
        bindDynamicParams();
        syncSizeChoiceGliders();
    }

    function persistVideoPanelSettings(settings = d()?.settings){
        const deps = d();
        if(!settings || !deps) return;
        if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
        const selected = deps.selectedNode?.();
        const subject = selected && deps.isSmartImageNode?.(selected)
            ? selected
            : deps.activeSettingsSubject?.();
        if(subject && deps.isSmartImageNode?.(subject)){
            subject.runSettings = deps.settingsForStorage?.(settings) || {...settings};
        }
        if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
    }

    function renderVideoReferencePanel(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (value => String(value));
        const mode = currentVideoReferenceMode(settings);
        const capabilities = videoModelCapabilities(settings);
        const options = [
            ['text','file-text','文生视频','仅使用文字提示词'],
            ['omni','sparkles','全能参考','综合图片与提示词参考'],
            ['image','image','图生视频','以输入图片生成视频'],
            ['frames','panels-top-left','首尾帧','指定首帧与尾帧'],
            ['reference','images','图片参考','多张图片作为视觉参考']
        ];
        return `<div class="video-reference-menu">
            <div class="video-flat-heading">视频生成模式</div>
            ${options.map(([value, icon, label, note]) => {
                const modelSupported = capabilities.modes[value] === true;
                const inputSupported = videoModeHasRequiredInputs(value);
                const supported = modelSupported && inputSupported;
                const unsupportedNote = capabilities.recognized === false ? '请改成官网模型名' : '当前模型不支持';
                const disabledTitle = supported ? '' : capabilities.recognized === false
                    ? `未识别模型 ${settings.videoModel || ''}，请先在 API 设置中改成官网正式模型名`
                    : `当前模型 ${settings.videoModel || ''} 不支持${label}`;
                return `<button type="button" class="video-reference-option ${mode === value ? 'active' : ''} ${supported ? '' : 'is-disabled'}" data-video-reference-mode="${value}" ${supported ? '' : 'disabled aria-disabled="true"'} title="${escapeHtml(disabledTitle)}"><i data-lucide="${icon}"></i><span><strong>${label}</strong><small>${supported ? note : unsupportedNote}</small></span>${mode === value ? '<i data-lucide="check" class="video-option-check"></i>' : ''}</button>`;
            }).join('')}
        </div>`;
    }

    function renderFlatVideoSettingsPanel(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        if(typeof deps?.normalizeSmartVideoModeSettings === 'function') deps.normalizeSmartVideoModeSettings(settings);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const capabilities = videoModelCapabilities(settings);
        const options = videoModelOptions(settings);
        const mode = currentVideoReferenceMode(settings);
        const aspect = settings.videoAspect || options.aspects[0] || '';
        const resolution = settings.videoResolution || options.resolutions[0] || '';
        const duration = Number(settings.videoDuration) || options.durations[0] || 5;
        const modeOptions = [
            ['text','文生视频'],
            ['omni','全能参考'],
            ['image','图生视频'],
            ['frames','首尾帧'],
            ['reference','参考生视频']
        ].filter(([value]) => capabilities.modes[value] === true);
        const generationSection = renderComposerSubmenuSection('生成方式', `<div class="video-flat-segments video-flat-generation">
            ${modeOptions.map(([value,label]) => {
                const inputSupported = videoModeHasRequiredInputs(value);
                const title = inputSupported ? '' : `${label}需要先添加参考图片`;
                return `<button type="button" class="${mode === value ? 'active' : ''}" data-video-reference-mode="${value}" ${inputSupported ? '' : 'disabled aria-disabled="true"'} title="${escapeHtml(title)}">${label}</button>`;
            }).join('')}
        </div>`);
        const aspectSection = options.aspects.length ? renderComposerSubmenuSection('比例', `<div class="size-picker-list size-picker-ratio-list video-flat-grid video-flat-aspects">
            ${options.aspects.map(value => `<button type="button" class="size-picker-option video-flat-choice ${aspect === value ? 'active' : ''}" data-smart-param="videoAspect" data-smart-value="${escapeHtml(value)}"><span class="ratio-icon ${videoAspectIconClass(value)}"></span><span>${value === 'adaptive' ? 'Auto' : escapeHtml(value)}</span></button>`).join('')}
        </div>`) : '';
        const resolutionSection = options.resolutions.length ? renderComposerSubmenuSection('清晰度', `<div class="size-picker-list size-picker-resolution-list video-flat-grid video-flat-resolution">
            ${options.resolutions.map(value => `<button type="button" class="size-picker-option video-flat-choice ${resolution === value ? 'active' : ''}" data-smart-param="videoResolution" data-smart-value="${escapeHtml(value)}"><span>${escapeHtml(value.toUpperCase())}</span></button>`).join('')}
        </div>`) : '';
        const durationSection = options.durations.length ? renderComposerSubmenuSection('生成时长', `<div class="video-flat-segments video-flat-duration">
            ${options.durations.map(value => `<button type="button" class="${duration === value ? 'active' : ''}" data-smart-param="videoDuration" data-smart-value="${value}">${value}s</button>`).join('')}
        </div>`) : '';
        const audioSection = options.audio === 'toggle'
            ? renderComposerSubmenuSection('生成音频', `<div class="video-flat-segments">
                <button type="button" class="${settings.videoGenerateAudio ? 'active' : ''}" data-video-bool-param="videoGenerateAudio" data-video-bool-value="true">开启</button>
                <button type="button" class="${!settings.videoGenerateAudio ? 'active' : ''}" data-video-bool-param="videoGenerateAudio" data-video-bool-value="false">关闭</button>
            </div>`)
            : options.audio === 'always'
                ? renderComposerSubmenuSection('生成音频', `<div class="video-flat-segments video-audio-fixed"><button type="button" class="active" disabled>始终开启</button></div>`)
                : '';
        const unavailable = capabilities.recognized ? '' : `<div class="muted-note video-capability-unavailable">当前模型没有可验证的能力资料，请在 API 设置中使用官方模型名。</div>`;
        return `${generationSection}${aspectSection}${resolutionSection}${durationSection}${audioSection}${unavailable}`;
    }

    function renderVideoProviderControl(providers){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const videoProviderById = deps?.videoProviderById;
        const list = providers || [];
        const current = list.find(p => p.id === settings.videoProvider)
            || (typeof videoProviderById === 'function' ? videoProviderById(settings.videoProvider) : null);
        const providerVideoModels = deps.providerVideoModels;
        return `<div class="composer-api-tree" data-api-tree="video">
            ${list.map(p => {
                const models = typeof providerVideoModels === 'function' ? providerVideoModels(p.id) : [];
                const active = p.id === settings.videoProvider;
                return `<details class="composer-api-branch ${active ? 'active' : ''}" open>
                    <summary data-api-provider-param="videoProvider" data-api-provider-id="${escapeHtml(p.id)}"><span class="composer-api-row-label">模型</span><span class="composer-api-provider-name">${escapeHtml(p.name || p.id)}</span><i data-lucide="chevron-right"></i></summary>
                    <div class="composer-api-models">${models.map(model => `<button type="button" class="${active && model === settings.videoModel ? 'active' : ''}" data-api-tree-model="${escapeHtml(model)}" data-api-provider-param="videoProvider" data-api-provider-id="${escapeHtml(p.id)}" data-api-model-param="videoModel">${escapeHtml(global.SmartCanvasProviderSelection?.videoModelDisplayName(model, p.id) || model)}</button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noVideoModel'))}</div>`}</div>
                </details>`;
            }).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noVideoPlatform'))}</div>`}
        </div>`;
    }

    function renderVideoModelControl(models){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const list = models || [];
        return `<div class="smart-control model-control">
        <button class="smart-pill" type="button"><i data-lucide="film"></i><span class="sub">${escapeHtml(global.SmartCanvasProviderSelection?.videoModelDisplayName(settings.videoModel, settings.videoProvider) || settings.videoModel || tr('smart.model'))}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.videoModel'))}</div>
            <div class="model-list">
                ${list.map(m => `<button type="button" class="direct-option ${m === settings.videoModel ? 'active' : ''}" data-smart-param="videoModel" data-smart-value="${escapeHtml(m)}"><span>${escapeHtml(global.SmartCanvasProviderSelection?.videoModelDisplayName(m, settings.videoProvider) || m)}</span></button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noVideoModel'))}</div>`}
            </div>
        </div>
    </div>`;
    }

    function renderVideoDurationControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const v = Math.max(1, Math.min(60, Number(settings.videoDuration) || 5));
        const quick = [3, 4, 5, 6, 8, 10, 12, 15];
        return `<div class="smart-control duration-control" title="${escapeHtml(tr('smart.videoDurationTip'))}">
        <button class="smart-pill" type="button"><i data-lucide="timer"></i><span>${v}s</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.videoDuration'))}</div>
            <div class="duration-grid">
                ${quick.map(n => `<button type="button" class="duration-option ${n === v ? 'active' : ''}" data-smart-param="videoDuration" data-smart-value="${n}">${n}s</button>`).join('')}
            </div>
            <label class="duration-custom">
                <span>${escapeHtml(tr('smart.custom'))}</span>
                <input type="number" min="1" max="60" step="1" data-param="videoDuration" value="${v}">
            </label>
        </div>
    </div>`;
    }

    function renderVideoAspectControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const options = [
            ['16:9','16:9'], ['9:16','9:16'], ['1:1','1:1'], ['4:3','4:3'], ['3:4','3:4'],
            ['21:9','21:9'], ['9:21','9:21'], ['keep_ratio', tr('smart.videoAspectKeep')], ['adaptive', tr('smart.videoAspectAdaptive')]
        ];
        const value = settings.videoAspect || '16:9';
        const labelMap = Object.fromEntries(options);
        return `<div class="smart-control aspect-control">
        <button class="smart-pill" type="button"><i data-lucide="scan"></i><span>${escapeHtml(labelMap[value] || value)}</span></button>
        <div class="smart-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.videoAspect'))}</div>
            <div class="ratio-grid">
                ${options.map(([v,l]) => `<button type="button" class="ratio-option ${v === value ? 'active' : ''}" data-smart-param="videoAspect" data-smart-value="${escapeHtml(v)}"><span class="ratio-icon ${videoAspectIconClass(v)}"></span><span>${escapeHtml(l)}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderVideoResolutionControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const options = [['', tr('smart.videoResAuto')], ['480p','480P'], ['720p','720P'], ['1080p','1080P']];
        const value = settings.videoResolution || '';
        const labelMap = Object.fromEntries(options);
        return `<div class="smart-control resolution-control">
        <button class="smart-pill" type="button"><i data-lucide="monitor"></i><span>${escapeHtml(labelMap[value] || value || tr('smart.videoResAuto'))}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.videoResolution'))}</div>
            <div class="model-list">
                ${options.map(([v,l]) => `<button type="button" class="direct-option ${v === value ? 'active' : ''}" data-smart-param="videoResolution" data-smart-value="${escapeHtml(v)}"><span>${escapeHtml(l)}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderVideoToggleControl(key, label){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const on = !!settings[key];
        return `<button type="button" class="setting-check ${on ? 'active' : ''}" data-toggle-param="${escapeHtml(key)}"><span class="check-box"></span><span>${escapeHtml(label)}</span></button>`;
    }

    function renderTempShUploadControl(){
        return `<button type="button" class="smart-pill cloud-upload-pill" data-temp-sh-upload-video title="上传当前输入图片或视频到云端直链"><i data-lucide="upload-cloud"></i><span>上传云端</span></button>`;
    }

    function renderManualVideoUrlControl(){
        return `<button type="button" class="smart-pill manual-video-url-pill" data-manual-video-url title="手动输入媒体 URL"><i data-lucide="link"></i><span>输入网址</span></button>`;
    }

    function renderVideoTrustedAssetControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const on = !!settings.videoTrustedAsset;
        let html = renderVideoToggleControl('videoTrustedAsset', tr('smart.videoTrustedAsset'));
        if(!on) return html;
        const src = ['library','cloud','manual'].includes(settings.videoTrustedSource) ? settings.videoTrustedSource : 'library';
        html += `<div class="trusted-source-row">
        <button type="button" class="smart-pill trusted-src-pill ${src === 'library' ? 'active' : ''}" data-trusted-source="library" title="使用素材库中已注册的认证素材链接（asset://）"><i data-lucide="library"></i><span>素材库链接</span></button>
        <button type="button" class="smart-pill trusted-src-pill ${src === 'cloud' ? 'active' : ''}" data-trusted-source="cloud" title="把当前输入图片/视频上传到云端直链"><i data-lucide="upload-cloud"></i><span>上传云端</span></button>
        <button type="button" class="smart-pill trusted-src-pill ${src === 'manual' ? 'active' : ''}" data-trusted-source="manual" title="手动输入媒体 URL 或 asset:// 地址"><i data-lucide="link"></i><span>输入网址</span></button>
    </div>`;
        return html;
    }

    function renderRhConfigControl(ref){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const runningHubEntries = deps?.runningHubEntries;
        const runningHubEntryKey = deps?.runningHubEntryKey;
        const runningHubEntryId = deps?.runningHubEntryId;
        const runningHubEntryLabel = deps?.runningHubEntryLabel;
        if(typeof runningHubEntries !== 'function') return '';
        const apps = runningHubEntries('app');
        const workflows = runningHubEntries('workflow');
        const selected = ref && typeof runningHubEntryKey === 'function' ? runningHubEntryKey(ref.kind, ref.id) : '';
        const groupHtml = (kind, entries, label) => entries.length ? `
        <div class="model-list-label rh-list-label">${escapeHtml(label)}<span class="count">${entries.length}</span></div>
        ${entries.map(entry => {
            const id = typeof runningHubEntryId === 'function' ? runningHubEntryId(entry, kind) : '';
            const key = typeof runningHubEntryKey === 'function' ? runningHubEntryKey(kind, id) : '';
            return `<button type="button" class="direct-option rh-entry-option ${key === selected ? 'active' : ''}" data-smart-param="rhConfigKey" data-smart-value="${escapeHtml(key)}"><i data-lucide="${kind === 'workflow' ? 'workflow' : 'sparkles'}"></i><span>${escapeHtml(typeof runningHubEntryLabel === 'function' ? runningHubEntryLabel(entry, kind) : key)}</span></button>`;
        }).join('')}
    ` : '';
        return `<div class="smart-control rh-config-control">
        <button class="smart-pill" type="button"><i data-lucide="workflow"></i><span class="sub">${escapeHtml(ref && typeof runningHubEntryLabel === 'function' ? runningHubEntryLabel(ref.entry, ref.kind) : tr('smart.rhConfig'))}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
        <div class="smart-popover compact-popover rh-picker-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.rhConfig'))}</div>
            <div class="model-list rh-config-list">
                ${groupHtml('app', apps, 'AI 应用')}${groupHtml('workflow', workflows, '工作流') || ''}
            </div>
        </div>
    </div>`;
    }

    function renderRhPaymentControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const value = settings.rhPayment === 'wallet' ? 'wallet' : 'free';
        const labels = {free:tr('smart.rhFreeKey'), wallet:tr('smart.rhWalletKey')};
        return `<div class="smart-control rh-payment-control">
        <button class="smart-pill" type="button"><i data-lucide="key-round"></i><span>${escapeHtml(labels[value])}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
        <div class="smart-popover compact-popover rh-picker-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.rhKey'))}</div>
            <div class="model-list">
                ${Object.entries(labels).map(([key, label]) => `<button type="button" class="direct-option ${key === value ? 'active' : ''}" data-smart-param="rhPayment" data-smart-value="${escapeHtml(key)}"><span>${escapeHtml(label)}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderRhMachineControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const value = settings.rhInstanceType === 'plus' ? 'plus' : '';
        const labels = {'':'24G', plus:'48G'};
        return `<div class="smart-control rh-machine-control">
        <button class="smart-pill" type="button"><i data-lucide="cpu"></i><span>${escapeHtml(labels[value])}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
        <div class="smart-popover compact-popover rh-picker-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.rhMachine'))}</div>
            <div class="model-list">
                ${Object.entries(labels).map(([key, label]) => `<button type="button" class="direct-option ${key === value ? 'active' : ''}" data-smart-param="rhInstanceType" data-smart-value="${escapeHtml(key)}"><span>${escapeHtml(label)}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderUpscalePill(paramKey, current){
        const deps = d();
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const opts = [2048, 4096];
        const labels = {2048:'2X / 2048', 4096:'4X / 4096'};
        return `<div class="smart-control upscale-control">
        <button class="smart-pill" type="button"><i data-lucide="maximize-2"></i><span>${escapeHtml(labels[current] || `${current}px`)}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.upscaleTarget'))}</div>
            <div class="model-list">
                ${opts.map(v => `<button type="button" class="direct-option ${v === current ? 'active' : ''}" data-smart-param="${escapeHtml(paramKey)}" data-smart-value="${v}"><span>${escapeHtml(labels[v])}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderComfyWorkflowControl(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return '';
        const tr = deps?.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const comfyWorkflows = deps?.comfyWorkflows || [];
        if(!comfyWorkflows.length) return `<div class="muted-note">${escapeHtml(tr('smart.noWorkflow'))}</div>`;
        const current = comfyWorkflows.find(w => w.name === settings.comfyWorkflow) || comfyWorkflows[0];
        const label = current?.title || (current?.name || '').replace('.json','') || tr('smart.workflow');
        return `<div class="smart-control workflow-control">
        <button class="smart-pill" type="button"><i data-lucide="layers"></i><span class="sub">${escapeHtml(label)}</span></button>
        <div class="smart-popover compact-popover">
            <div class="smart-popover-title">${escapeHtml(tr('smart.workflow'))}</div>
            <div class="model-list">
                ${comfyWorkflows.map(w => `<button type="button" class="direct-option ${w.name === settings.comfyWorkflow ? 'active' : ''}" data-smart-param="comfyWorkflow" data-smart-value="${escapeHtml(w.name)}"><span>${escapeHtml(w.title || w.name.replace('.json',''))}</span></button>`).join('')}
            </div>
        </div>
    </div>`;
    }

    function renderComfySettingField(field){
        const deps = d();
        if(!deps) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const comfyParamValue = deps.comfyParamValue;
        const comfyRandomEnabledField = deps.comfyRandomEnabledField;
        const smartComfyRandomActive = deps.smartComfyRandomActive;
        if(typeof comfyParamValue !== 'function') return '';
        const value = comfyParamValue(field);
        const label = field.name || field.input || field.id;
        if(field.type === 'boolean') return `<button type="button" class="setting-check ${value ? 'active' : ''}" data-comfy-bool="${escapeHtml(field.id)}"><span class="check-box"></span><span>${escapeHtml(label)}</span></button>`;
        if(field.type === 'dropdown'){
            const opts = field.options || [];
            const curLabel = String(value || opts[0] || label);
            return `<div class="smart-control comfy-dropdown-control" title="${escapeHtml(label)}">
            <button class="smart-pill" type="button"><span class="sub">${escapeHtml(curLabel)}</span></button>
            <div class="smart-popover compact-popover">
                <div class="smart-popover-title">${escapeHtml(label)}</div>
                <div class="model-list">
                    ${opts.map(o => `<button type="button" class="direct-option ${String(o) === String(value) ? 'active' : ''}" data-comfy-pick="${escapeHtml(field.id)}" data-comfy-value="${escapeHtml(o)}"><span>${escapeHtml(o)}</span></button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noOption'))}</div>`}
                </div>
            </div>
        </div>`;
        }
        if(field.type === 'textarea') return `<textarea class="wide" data-comfy-param="${escapeHtml(field.id)}" placeholder="${escapeHtml(label)}" style="width:160px">${escapeHtml(value)}</textarea>`;
        const type = (field.type === 'number' || field.type === 'slider') ? 'number' : 'text';
        const min = field.min !== undefined ? ` min="${escapeHtml(field.min)}"` : '';
        const max = field.max !== undefined ? ` max="${escapeHtml(field.max)}"` : '';
        const step = field.step !== undefined ? ` step="${escapeHtml(field.step)}"` : '';
        const isNumeric = type === 'number';
        const inputHtml = `<input type="${type}" data-comfy-param="${escapeHtml(field.id)}" value="${escapeHtml(value)}"${min}${max}${step}>`;
        if(isNumeric && typeof comfyRandomEnabledField === 'function' && comfyRandomEnabledField(field)){
            const active = typeof smartComfyRandomActive === 'function' ? smartComfyRandomActive(field.id) : false;
            return `<div class="num-with-dice" title="${escapeHtml(label)}">
            <span class="num-label">${escapeHtml(label)}</span>
            ${inputHtml}
            <button type="button" class="dice-btn ${active ? 'active' : ''}" data-comfy-random="${escapeHtml(field.id)}" title="${escapeHtml(active ? tr('smart.diceOn') : tr('smart.diceOff'))}"><i data-lucide="dice-5"></i></button>
        </div>`;
        }
        if(isNumeric){
            return `<div class="num-compact" title="${escapeHtml(label)}"><span class="num-label">${escapeHtml(label)}</span>${inputHtml}</div>`;
        }
        return `<div class="num-compact" title="${escapeHtml(label)}"><span class="num-label">${escapeHtml(label)}</span>${inputHtml}</div>`;
    }

    function renderRhSettingField(field){
        const deps = d();
        if(!deps) return '';
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const rhParamKey = deps.rhParamKey;
        const rhFieldRole = deps.rhFieldRole;
        const rhParamValue = deps.rhParamValue;
        const rhExtractFieldOptions = deps.rhExtractFieldOptions;
        const rhRandomEnabled = deps.rhRandomEnabled;
        const smartRhRandomActive = deps.smartRhRandomActive;
        if(typeof rhParamKey !== 'function' || typeof rhFieldRole !== 'function' || typeof rhParamValue !== 'function') return '';
        const key = rhParamKey(field.nodeId, field.fieldName);
        const kind = rhFieldRole(field);
        const label = field.label || field.fieldName || 'Field';
        const value = rhParamValue(field, null);
        const options = typeof rhExtractFieldOptions === 'function' ? rhExtractFieldOptions(field) : null;
        if(kind === 'boolean'){
            const active = String(value).toLowerCase() === 'true';
            return `<button type="button" class="setting-check ${active ? 'active' : ''}" data-rh-bool="${escapeHtml(key)}"><span class="check-box"></span><span>${escapeHtml(label)}</span></button>`;
        }
        if(kind === 'slider'){
            const min = Number.isFinite(Number(field.min)) ? Number(field.min) : 0;
            const max = Number.isFinite(Number(field.max)) && Number(field.max) > min ? Number(field.max) : 1;
            const step = Number.isFinite(Number(field.step)) && Number(field.step) > 0 ? Number(field.step) : 0.01;
            const numericValue = Number.isFinite(Number(value)) ? Number(value) : min;
            return `<div class="smart-control rh-slider-control" title="${escapeHtml(label)}">
            <button class="smart-pill" type="button"><span class="sub">${escapeHtml(label)}</span><span class="rh-slider-pill-value">${escapeHtml(numericValue)}</span></button>
            <div class="smart-popover compact-popover rh-picker-popover rh-param-popover rh-slider-popover">
                <div class="smart-popover-title"><span>${escapeHtml(label)}</span><span class="rh-slider-value">${escapeHtml(numericValue)}</span></div>
                <input type="range" class="smart-range rh-slider-input" data-rh-param="${escapeHtml(key)}" data-rh-type="slider" min="${escapeHtml(min)}" max="${escapeHtml(max)}" step="${escapeHtml(step)}" value="${escapeHtml(numericValue)}">
            </div>
        </div>`;
        }
        if(options?.length){
            const curLabel = String(value || options[0] || label);
            return `<div class="smart-control rh-dropdown-control" title="${escapeHtml(label)}">
            <button class="smart-pill" type="button"><span class="sub">${escapeHtml(curLabel)}</span><i data-lucide="chevron-down" class="pill-caret"></i></button>
            <div class="smart-popover compact-popover rh-picker-popover rh-param-popover">
                <div class="smart-popover-title">${escapeHtml(label)}</div>
                <div class="model-list rh-param-list">
                    ${options.map(o => `<button type="button" class="direct-option ${String(o) === String(value) ? 'active' : ''}" data-rh-pick="${escapeHtml(key)}" data-rh-value="${escapeHtml(o)}"><span>${escapeHtml(o)}</span></button>`).join('') || `<div class="muted-note">${escapeHtml(tr('smart.noOption'))}</div>`}
                </div>
            </div>
        </div>`;
        }
        const type = kind === 'number' ? 'number' : 'text';
        const inputHtml = `<input type="${type}" data-rh-param="${escapeHtml(key)}" value="${escapeHtml(value)}">`;
        if(kind === 'number' && typeof rhRandomEnabled === 'function' && rhRandomEnabled(field)){
            const active = typeof smartRhRandomActive === 'function' ? smartRhRandomActive(key) : false;
            return `<div class="num-with-dice" title="${escapeHtml(label)}">
            <span class="num-label">${escapeHtml(label)}</span>
            ${inputHtml}
            <button type="button" class="dice-btn ${active ? 'active' : ''}" data-rh-random="${escapeHtml(key)}" title="${escapeHtml(active ? tr('smart.diceOn') : tr('smart.diceOff'))}"><i data-lucide="dice-5"></i></button>
        </div>`;
        }
        return `<div class="num-compact ${type === 'text' ? 'rh-text-param' : ''}" title="${escapeHtml(label)}"><span class="num-label">${escapeHtml(label)}</span>${inputHtml}</div>`;
    }

    function renderRunningHubParams(){
        const deps = d();
        const settings = deps?.settings;
        const dynamicParams = deps?.dynamicParams;
        const composerHeadParams = deps?.composerHeadParams;
        if(!settings || !dynamicParams) return;
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const selectedRunningHubRef = deps.selectedRunningHubRef;
        const rhActiveFields = deps.rhActiveFields;
        const rhFieldRole = deps.rhFieldRole;
        if(typeof selectedRunningHubRef !== 'function' || typeof rhActiveFields !== 'function' || typeof rhFieldRole !== 'function') return;
        const ref = selectedRunningHubRef();
        const fields = rhActiveFields();
        settings.rhPayment = settings.rhPayment === 'wallet' ? 'wallet' : 'free';
        settings.rhParams = settings.rhParams || {};
        settings.rhRandomActive = settings.rhRandomActive || {};
        if(composerHeadParams) composerHeadParams.innerHTML = '';
        setComposerSizePanel('');
        setComposerCountPanel('');
        if(!ref){
            dynamicParams.innerHTML = `<div class="muted-note">${escapeHtml(tr('smart.rhNeedConfig'))}</div>`;
            return;
        }
        const mediaFields = fields.filter(f => ['image','video','audio'].includes(rhFieldRole(f))).length;
        const promptFields = fields.filter(f => rhFieldRole(f) === 'prompt').length;
        dynamicParams.innerHTML = `
        ${renderRhConfigControl(ref)}
        ${renderRhPaymentControl()}
        ${renderRhMachineControl()}
        <div class="rh-mini-summary">${escapeHtml(mediaFields)} 素材 · ${escapeHtml(promptFields)} 提示词</div>
        ${fields.length ? fields.filter(f => !['image','video','audio','prompt'].includes(rhFieldRole(f))).map(renderRhSettingField).join('') : `<div class="muted-note">${escapeHtml(tr('smart.rhNeedFields'))}</div>`}
    `;
    }

    let _composerProviderEnsureToken = 0;

    function renderComposerHeadParams(){
        const deps = d();
        const settings = deps?.settings;
        const composerHeadParams = deps?.composerHeadParams;
        if(!settings || !composerHeadParams) return;
        const imageProviders = deps.imageProviders;
        const videoApiProviders = deps.videoApiProviders;
        const providerImageModels = deps.providerImageModels;
        const providerVideoModels = deps.providerVideoModels;
        const normalizeVideoProviderDefaults = deps.normalizeVideoProviderDefaults;
        const ownerImageProviderForModel = deps.ownerImageProviderForModel;
        const bindSmartControlPills = deps.bindSmartControlPills;
        if(typeof imageProviders !== 'function' || typeof videoApiProviders !== 'function') return;
        const needProviders = !(deps.apiProviders?.length) && !imageProviders().length;
        if(needProviders && global.SmartCanvasProviders){
            const token = ++_composerProviderEnsureToken;
            SmartCanvasProviders.ensureLoaded().then(list => {
                if(token !== _composerProviderEnsureToken) return;
                if(typeof deps.setApiProviders === 'function') deps.setApiProviders(list);
                else if(deps.apiProviders && Array.isArray(deps.apiProviders)) deps.apiProviders.splice(0, deps.apiProviders.length, ...list);
                renderComposerHeadParams();
            });
            return;
        }
        if(settings.apiKind === 'video'){
            const providers = videoApiProviders();
            if(typeof normalizeVideoProviderDefaults === 'function') normalizeVideoProviderDefaults(providers);
            composerHeadParams.innerHTML = renderModeModelList('video');
        } else if(settings.apiKind === 'audio'){
            composerHeadParams.innerHTML = renderModeModelList('audio');
        } else if(settings.engine === 'volcengine'){
            const volcengineProvider = deps.volcengineProvider;
            const provider = typeof volcengineProvider === 'function' ? volcengineProvider() : null;
            if(!provider){
                composerHeadParams.innerHTML = '';
            } else if(settings.apiKind === 'video'){
                const providers = [provider];
                const volcengineVideoModels = deps.volcengineVideoModels;
                const models = typeof volcengineVideoModels === 'function' ? volcengineVideoModels() : [];
                settings.videoProvider = 'volcengine';
                if(!settings.videoModel || !models.includes(settings.videoModel)) settings.videoModel = models[0] || 'seedance-1.0-pro';
                composerHeadParams.innerHTML = renderVideoProviderControl(providers);
            } else {
                const providers = [provider];
                const models = typeof providerImageModels === 'function' ? providerImageModels('volcengine') : [];
                settings.provider_id = 'volcengine';
                if(!settings.model || !models.includes(settings.model)) settings.model = models[0] || '';
                composerHeadParams.innerHTML = renderProviderControl(providers);
            }
        } else if(settings.engine === 'modelscope'){
            composerHeadParams.innerHTML = `${renderMsFunctionControl()}${renderMsCustomModelPill()}`;
        } else {
            const providers = imageProviders();
            if(!settings.provider_id || !providers.some(p => p.id === settings.provider_id)){
                const owner = typeof ownerImageProviderForModel === 'function' ? ownerImageProviderForModel(settings.model) : '';
                settings.provider_id = owner || providers[0]?.id || '';
            }
            const models = typeof providerImageModels === 'function' ? providerImageModels(settings.provider_id) : [];
            if(!settings.model || !models.includes(settings.model)) settings.model = models[0] || '';
            composerHeadParams.innerHTML = renderModeModelList('image');
        }
        if(typeof bindSmartControlPills === 'function') bindSmartControlPills(composerHeadParams);
        if(global.lucide) lucide.createIcons();
    }

    function renderApiParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const applySourceRatioToSettings = deps.applySourceRatioToSettings;
        const activeComposerNode = deps.activeComposerNode;
        const selectedNode = deps.selectedNode;
        renderComposerHeadParams();
        normalizeApiSizeSettings('');
        ensureApiImageQualityDefault();
        if(typeof applySourceRatioToSettings === 'function'){
            applySourceRatioToSettings('', (typeof activeComposerNode === 'function' ? activeComposerNode() : null) || (typeof selectedNode === 'function' ? selectedNode() : null));
        }
        applyComposerImageSizeMenu('', true);
        clearComposerOverflowParams();
    }

    function renderApiVideoParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const syncVideoCountFromSettings = deps.syncVideoCountFromSettings;
        if(typeof syncVideoCountFromSettings === 'function') syncVideoCountFromSettings(settings);
        if(typeof deps.normalizeSmartVideoModeSettings === 'function') deps.normalizeSmartVideoModeSettings(settings);
        renderComposerHeadParams();
        renderVideoSizeMenuForMode(settings);
        clearComposerOverflowParams();
    }

    function renderApiAudioParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        renderComposerHeadParams();
        hideComposerSizeMenus();
        setComposerSizePanel('');
        setComposerQualityPanel('');
        setComposerCountPanel('');
        clearComposerOverflowParams();
        const dynamicParams = dynamicParamsEl();
        const musicRenderer = global.SmartCanvasMusic?.renderMusicParams;
        if(dynamicParams && typeof musicRenderer === 'function'){
            dynamicParams.innerHTML = musicRenderer();
            global.SmartCanvasMusic.bindMusicParams?.(dynamicParams);
        }
    }

    function renderVolcengineParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const volcengineProvider = deps.volcengineProvider;
        const provider = typeof volcengineProvider === 'function' ? volcengineProvider() : null;
        if(!provider) return;
        normalizeApiSizeSettings('');
        ensureApiImageQualityDefault();
        renderComposerHeadParams();
        applyComposerImageSizeMenu('', true);
        clearComposerOverflowParams();
    }

    function renderVolcengineVideoParams(){
        const deps = d();
        const settings = deps?.settings;
        const dynamicParams = deps?.dynamicParams;
        const tr = deps?.tr || (k => k);
        if(!settings || !dynamicParams) return;
        const volcengineProvider = deps.volcengineProvider;
        const provider = typeof volcengineProvider === 'function' ? volcengineProvider() : null;
        if(!provider) return;
        settings.apiKind = 'video';
        if(typeof deps.normalizeSmartVideoModeSettings === 'function') deps.normalizeSmartVideoModeSettings(settings);
        renderComposerHeadParams();
        renderVideoSizeMenuForMode(settings);
        dynamicParams.innerHTML = `
        ${renderVideoToggleControl('videoEnhancePrompt', tr('smart.videoEnhancePrompt'))}
        ${renderVideoToggleControl('videoEnableUpsample', tr('smart.videoUpsample'))}
        ${renderVideoToggleControl('videoGenerateAudio', tr('smart.videoGenerateAudio'))}
        ${renderVideoToggleControl('videoCameraFixed', tr('smart.videoCameraFixed'))}
        ${renderVideoToggleControl('videoWatermark', tr('smart.videoWatermark'))}
        ${renderVideoToggleControl('videoMultimodal', tr('smart.videoMultimodal'))}
        ${renderVideoToggleControl('videoUseFrameRoles', tr('smart.videoUseFrameRoles'))}
        ${renderVideoTrustedAssetControl()}
    `;
    }

    function renderMsParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const MS_GEN_MODELS = deps.MS_GEN_MODELS || {};
        const modelscopeImageModels = deps.modelscopeImageModels;
        settings.msgenModel = MS_GEN_MODELS[settings.msgenModel] ? settings.msgenModel : 'zimage';
        if(!settings.msCustomModel) settings.msCustomModel = (typeof modelscopeImageModels === 'function' ? modelscopeImageModels()[0] : null) || 'Tongyi-MAI/Z-Image-Turbo';
        normalizeApiSizeSettings('ms');
        renderComposerHeadParams();
        applyComposerImageSizeMenu('ms', false);
        clearComposerOverflowParams();
    }

    function placeholderAspectRatioForSetting(key, settings){
        const presetRatios = {
            square:1,
            portrait:2 / 3,
            landscape:3 / 2,
            portrait43:3 / 4,
            landscape43:4 / 3,
            story:9 / 16,
            wide:16 / 9,
            ultrawide:21 / 9,
            ultratall:9 / 21,
        };
        let value = '';
        if(key === 'videoAspect') value = settings.videoAspect;
        else if(key === 'msRatio' || key === 'msCustomRatioWidth' || key === 'msCustomRatioHeight'){
            value = settings.msRatio === 'custom' ? settings.msCustomRatio : settings.msRatio;
        } else if(key === 'ratio' || key === 'customRatioWidth' || key === 'customRatioHeight'){
            value = settings.ratio === 'custom' ? settings.customRatio : settings.ratio;
        } else return 0;
        if(Number.isFinite(presetRatios[value])) return presetRatios[value];
        const pair = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*[:xX/]\s*(\d+(?:\.\d+)?)$/);
        if(!pair) return 0;
        const width = Number(pair[1]);
        const height = Number(pair[2]);
        return width > 0 && height > 0 ? width / height : 0;
    }

    function resizeActiveTypedPlaceholderForSetting(key){
        const deps = d();
        const settings = deps?.settings;
        const node = deps?.activeSettingsSubject?.();
        if(!settings || !node || node.type !== 'smart-image') return false;
        if(node.typePlaceholder !== true || (node.images || []).length || node.pending || node.running || node.queued) return false;
        const kind = node.portLinkKind || node.outputKind || settings.apiKind || 'image';
        const isVideoSetting = key === 'videoAspect';
        const isImageSetting = ['ratio','msRatio','customRatioWidth','customRatioHeight','msCustomRatioWidth','msCustomRatioHeight'].includes(key);
        if((kind === 'video' && !isVideoSetting) || (kind === 'image' && !isImageSetting) || !['image','video'].includes(kind)) return false;
        const aspect = placeholderAspectRatioForSetting(key, settings);
        if(!Number.isFinite(aspect) || aspect <= 0) return false;

        const fallbackWidth = Number(deps.EMPTY_UPLOAD_NODE_WIDTH) || 260;
        const fallbackHeight = Number(deps.EMPTY_UPLOAD_NODE_HEIGHT) || 180;
        const startWidth = Number(node.w) > 24 ? Number(node.w) : fallbackWidth;
        const startHeight = Number(node.h) > 24 ? Number(node.h) : fallbackHeight;
        const area = Math.max(96 * 96, startWidth * startHeight);
        const targetWidth = Math.max(96, Math.round(Math.sqrt(area * aspect)));
        const targetHeight = Math.max(96, Math.round(Math.sqrt(area / aspect)));
        if(Math.abs(targetWidth - startWidth) < 1 && Math.abs(targetHeight - startHeight) < 1) return false;

        const startX = Number(node.x) || 0;
        const startY = Number(node.y) || 0;
        const targetX = Math.round((startX + (startWidth - targetWidth) / 2) * 100) / 100;
        const targetY = Math.round((startY + (startHeight - targetHeight) / 2) * 100) / 100;
        const previous = placeholderAspectAnimations.get(node.id);
        if(previous?.frame) cancelAnimationFrame(previous.frame);
        if(previous) previous.cancelled = true;

        const escapedId = global.CSS?.escape ? global.CSS.escape(node.id) : String(node.id).replace(/["\\]/g, '\\$&');
        const element = deps.world?.querySelector?.(`.image-node[data-id="${escapedId}"]`);
        const animation = {frame:0, cancelled:false};
        placeholderAspectAnimations.set(node.id, animation);
        element?.classList.add('placeholder-aspect-resizing');
        node.placeholderAspectRatio = aspect;
        const duration = 320;
        let startedAt = 0;
        const applyFrame = progress => {
            const eased = 1 - Math.pow(1 - progress, 3);
            node.x = startX + (targetX - startX) * eased;
            node.y = startY + (targetY - startY) * eased;
            node.w = startWidth + (targetWidth - startWidth) * eased;
            node.h = startHeight + (targetHeight - startHeight) * eased;
            if(element?.isConnected){
                element.style.left = `${node.x}px`;
                element.style.top = `${node.y}px`;
                element.style.width = `${node.w}px`;
                element.style.height = `${node.h}px`;
            }
            global.SmartCanvasNodesRender?.refreshConnectionLayer?.();
        };
        const tick = now => {
            if(animation.cancelled) return;
            if(!startedAt) startedAt = now;
            const progress = Math.min(1, (now - startedAt) / duration);
            applyFrame(progress);
            if(progress < 1){
                animation.frame = requestAnimationFrame(tick);
                return;
            }
            node.x = targetX;
            node.y = targetY;
            node.w = targetWidth;
            node.h = targetHeight;
            element?.classList.remove('placeholder-aspect-resizing');
            placeholderAspectAnimations.delete(node.id);
            global.SmartCanvasNodesRender?.refreshConnectionLayer?.();
            deps.scheduleSave?.();
        };
        animation.frame = requestAnimationFrame(tick);
        return true;
    }

    function setDynamicSetting(key, value){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        const numericKeys = new Set(['count','width','height','videoDuration','enhanceStrength','enhanceUpscaleRes','editUpscaleRes','customRatioWidth','customRatioHeight','customWidth','customHeight','msCustomRatioWidth','msCustomRatioHeight','msCustomWidth','msCustomHeight']);
        const layoutKeys = new Set(['provider_id','model','resolution','ratio','msgenModel','msCustomModel','msResolution','msRatio','videoProvider','videoModel','videoAspect','videoResolution','videoDuration','comfyMode','comfyWorkflow','quality','count','enhanceUpscaleRes','editUpscaleRes','rhConfigKey','rhPayment','rhInstanceType']);
        settings[key] = numericKeys.has(key) && value !== '' ? Number(value) : value;
        if(key === 'count'){
            const next = Math.max(1, Math.min(settings.apiKind === 'video' ? 4 : 8, Number(value) || 1));
            settings.count = next;
            if(settings.apiKind === 'video' || settings.engine === 'volcengine') settings.videoCount = next;
        }
        if(key === 'apiKind' && value === 'video' && typeof deps.syncVideoCountFromSettings === 'function'){
            deps.syncVideoCountFromSettings(settings);
        }
        if(key === 'provider_id') settings.model = '';
        if(key === 'videoProvider') settings.videoModel = '';
        if(key === 'model'){
            const ownerImageProviderForModel = deps.ownerImageProviderForModel;
            const owner = typeof ownerImageProviderForModel === 'function' ? ownerImageProviderForModel(value) : '';
            if(owner) settings.provider_id = owner;
        }
        if(key === 'videoModel'){
            const ownerVideoProviderForModel = deps.ownerVideoProviderForModel;
            const owner = typeof ownerVideoProviderForModel === 'function' ? ownerVideoProviderForModel(value) : '';
            if(owner) settings.videoProvider = owner;
        }
        if(key === 'videoMultimodal') settings._videoMultimodalUserSet = true;
        if(key === 'videoMultimodal' && settings.videoMultimodal) settings.videoUseFrameRoles = false;
        if(typeof deps.normalizeSmartVideoModeSettings === 'function'){
            deps.normalizeSmartVideoModeSettings(settings, key === 'videoUseFrameRoles');
        }
        if(key === 'comfyMode' && typeof deps.applyRecentSmartSettingsForCurrentMode === 'function'){
            deps.applyRecentSmartSettingsForCurrentMode();
        }
        if(key === 'resolution'){
            if(settings.resolution === 'custom') settings.ratio = '';
            else if(!settings.ratio) settings.ratio = 'square';
        }
        if(key === 'ratio'){
            settings.ratioExplicit = true;
            if(settings.resolution === 'auto') settings.resolution = '1k';
            if(typeof deps.applySourceRatioToSettings === 'function') deps.applySourceRatioToSettings('');
        }
        if(key === 'msResolution'){
            if(settings.msResolution === 'custom') settings.msRatio = '';
            else if(!settings.msRatio) settings.msRatio = 'square';
        }
        if(key === 'msRatio'){
            if(settings.msResolution === 'auto') settings.msResolution = '1k';
            if(typeof deps.applySourceRatioToSettings === 'function') deps.applySourceRatioToSettings('ms');
        }
        if(key === 'customRatioWidth' || key === 'customRatioHeight'){
            settings.customRatio = settings.customRatioWidth && settings.customRatioHeight ? `${settings.customRatioWidth}:${settings.customRatioHeight}` : '';
            settings.ratio = 'custom';
        }
        if(key === 'msCustomRatioWidth' || key === 'msCustomRatioHeight'){
            settings.msCustomRatio = settings.msCustomRatioWidth && settings.msCustomRatioHeight ? `${settings.msCustomRatioWidth}:${settings.msCustomRatioHeight}` : '';
            settings.msRatio = 'custom';
        }
        if(key === 'customWidth' || key === 'customHeight'){
            settings.customSize = settings.customWidth && settings.customHeight ? `${settings.customWidth}x${settings.customHeight}` : '';
            settings.resolution = 'custom';
        }
        if(key === 'msCustomWidth' || key === 'msCustomHeight'){
            settings.msCustomSize = settings.msCustomWidth && settings.msCustomHeight ? `${settings.msCustomWidth}x${settings.msCustomHeight}` : '';
            settings.msResolution = 'custom';
        }
        const sizeKeys = new Set(['resolution','ratio','customRatio','customRatioWidth','customRatioHeight','customWidth','customHeight','customSize']);
        const unlockOutpaintSize = settings.outpaintResolutionLocked && sizeKeys.has(key);
        if(unlockOutpaintSize){
            delete settings.outpaintResolutionLocked;
            const activeSettingsSubject = deps.activeSettingsSubject;
            const subject = typeof activeSettingsSubject === 'function' ? activeSettingsSubject() : null;
            if(subject) delete subject.outpaintSize;
        }
        if(key === 'comfyWorkflow'){
            settings.comfyParams = {};
            const ensureComfyWorkflow = deps.ensureComfyWorkflow;
            if(typeof ensureComfyWorkflow === 'function') ensureComfyWorkflow(settings.comfyWorkflow).then(renderDynamicParams);
        }
        if(key === 'rhConfigKey'){
            settings.rhParams = {};
            settings.rhRandomActive = {};
        }
        resizeActiveTypedPlaceholderForSetting(key);
        if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
        if(typeof deps.rememberRecentSmartSettings === 'function'){
            deps.rememberRecentSmartSettings(settings, deps.activeSettingsSubject?.());
        }
        const videoPanelKeys = new Set(['videoAspect','videoResolution','videoDuration']);
        if(layoutKeys.has(key)){
            if(settings.apiKind === 'video' && videoPanelKeys.has(key)) refreshVideoSettingsPanel(settings);
            else renderDynamicParams();
        }
        if(settings.apiKind === 'video' && videoPanelKeys.has(key)){
            persistVideoPanelSettings(settings);
        }
        if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
    }

    function setApiTreeSelection(providerKey, providerId, modelKey='', model=''){
        const deps = d();
        const settings = deps?.settings;
        if(!settings || !providerKey || !providerId) return;
        settings[providerKey] = providerId;
        if(modelKey) settings[modelKey] = model;
        else settings[providerKey === 'videoProvider' ? 'videoModel' : 'model'] = '';
        if(modelKey === 'videoModel' && typeof deps.normalizeSmartVideoModeSettings === 'function'){
            deps.normalizeSmartVideoModeSettings(settings);
        }
        if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
        if(typeof deps.rememberRecentSmartSettings === 'function') deps.rememberRecentSmartSettings(settings, deps.activeSettingsSubject?.());
        renderDynamicParams();
        if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
    }

    function markControlInteracting(el){
        const ctrl = el?.closest?.('.smart-control');
        if(ctrl && !ctrl.classList.contains('pinned')) ctrl.classList.add('interacting');
    }

    function closeAllSmartPopovers(){
        document.querySelectorAll('.smart-control.pinned, .smart-control.interacting').forEach(c => c.classList.remove('pinned', 'interacting'));
    }

    function bindSmartControlPills(root){
        const deps = d();
        const settings = deps?.settings;
        const setDynamicSettingFn = deps?.setDynamicSetting || setDynamicSetting;
        if(!root || !settings || typeof setDynamicSettingFn !== 'function') return;
        root.querySelectorAll('.smart-control').forEach(ctrl => {
            ctrl.onmouseleave = () => ctrl.classList.remove('interacting');
        });
        root.querySelectorAll('.smart-control > .smart-pill').forEach(pill => {
            pill.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const ctrl = pill.parentElement;
                const wasPinned = ctrl.classList.contains('pinned');
                closeAllSmartPopovers();
                if(!wasPinned) ctrl.classList.add('pinned');
            };
        });
        root.querySelectorAll('[data-smart-param]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                markControlInteracting(btn);
                const key = btn.dataset.smartParam;
                const value = key === 'count' && Number(settings?.count || 1) === Number(btn.dataset.smartValue)
                    ? '1'
                    : btn.dataset.smartValue;
                setDynamicSettingFn(key, value);
            };
        });
    }

    function syncApiKindToggleVisibility(){
        const deps = d();
        const settings = deps?.settings;
        const apiKindToggle = deps?.apiKindToggle;
        const isApiLikeEngine = deps?.isApiLikeEngine;
        if(!settings || !apiKindToggle) return;
        // 顶部窄条不再展示 Audio/Text/Image/Video；类型切换留在底部 footer 下拉。
        const popoverHost = document.getElementById('composerKindPopover');
        if(popoverHost && apiKindToggle.parentElement !== popoverHost) popoverHost.appendChild(apiKindToggle);
        apiKindToggle.setAttribute('aria-label', '生成类型');
        const kindLabels = {audio:'音频', text:'文本', image:'图片', video:'视频'};
        apiKindToggle.querySelectorAll('[data-kind]').forEach(button => {
            const label = kindLabels[button.dataset.kind];
            if(!label) return;
            const text = button.querySelector('span');
            if(text) text.textContent = label;
            button.title = label;
            button.setAttribute('aria-label', label);
        });
        const node = deps.selectedNode?.();
        const textMode = global.SmartCanvasComposerText?.isTextSubject?.(node) === true;
        const activeKind = global.SmartCanvasComposerText?.modeFor?.(node) || settings.apiKind || 'image';
        const imageBlocked = global.SmartCanvasModeBindings?.hasVideoMaterial?.(node) === true;
        const visible = textMode || activeKind === 'audio' || (typeof isApiLikeEngine === 'function' && isApiLikeEngine(settings.engine));
        apiKindToggle.style.display = visible ? 'inline-flex' : 'none';
        const kindWrap = document.getElementById('composerKindWrap');
        if(kindWrap) kindWrap.hidden = !visible;
        apiKindToggle.querySelectorAll('[data-kind]').forEach(btn => {
            const disabled = imageBlocked && btn.dataset.kind === 'image';
            btn.disabled = disabled;
            btn.classList.toggle('is-disabled', disabled);
            if(disabled) btn.setAttribute('aria-disabled', 'true');
            else btn.removeAttribute('aria-disabled');
            btn.classList.toggle('active', btn.dataset.kind === activeKind);
        });
        apiKindToggle.dispatchEvent(new CustomEvent('composer-kind-sync'));
    }

    function bindApiKindToggle(){
        const deps = d();
        const apiKindToggle = deps?.apiKindToggle;
        if(!deps?.settings || !apiKindToggle || apiKindToggle.dataset.boundApiKind) return;
        apiKindToggle.dataset.boundApiKind = '1';
        apiKindToggle.querySelectorAll('[data-kind]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                if(btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
                const live = d();
                const settings = live?.settings;
                if(!settings) return;
                const kind = btn.dataset.kind;
                closeComposerToolPopovers();
                const selected = live.selectedNode?.();
                const textMode = global.SmartCanvasComposerText?.isTextSubject?.(selected) === true;
                const smartImage = live.isSmartImageNode?.(selected) === true;
                const activeKind = global.SmartCanvasComposerText?.modeFor?.(selected) || settings.apiKind || 'image';
                const useSwitchMode = kind === 'text' || textMode
                    || (smartImage && ['image', 'video', 'audio'].includes(kind) && kind !== activeKind);
                if(useSwitchMode){
                    global.SmartCanvasComposerText?.switchMode?.(kind);
                    try {
                        const liveNow = live || d();
                        const node = liveNow?.selectedNode?.();
                        const nextSettings = node?.runSettings
                            ? (liveNow.smartSettingsForNode?.(node) || liveNow.settings)
                            : (liveNow.settings || {});
                        if(nextSettings !== liveNow.settings){
                            Object.keys(liveNow.settings || {}).forEach(key => delete liveNow.settings[key]);
                            Object.assign(liveNow.settings, nextSettings);
                        }
                        global.SmartCanvasComposerText?.syncMediaSettingsFromNode?.(liveNow.settings, node);
                        global.SmartCanvasComposerParams?.renderDynamicParams?.();
                    } catch(_e) {}
                    return;
                }
                if(kind === settings.apiKind) return;
                settings.apiKind = kind;
                if(kind === 'video' && typeof live.syncVideoCountFromSettings === 'function') live.syncVideoCountFromSettings(settings);
                if(typeof live.applyRecentSmartSettingsForCurrentMode === 'function') live.applyRecentSmartSettingsForCurrentMode();
                syncApiKindToggleVisibility();
                renderDynamicParams();
                if(typeof live.persistActiveSmartSettings === 'function') live.persistActiveSmartSettings();
                if(typeof live.scheduleSave === 'function') live.scheduleSave();
            });
        });
    }

    function bindDynamicParams(){
        const deps = d();
        const settings = deps?.settings;
        if(!settings) return;
        composerParamRoots().forEach(root => {
            if(typeof bindSmartControlPills === 'function') bindSmartControlPills(root);
        });
        queryComposerParams('[data-mode-model-select]').forEach(btn => {
            // 选择在 pointerdown 就应用：菜单可能在按下与抬起之间被异步
            // 重渲染（配置广播 / scheduleSave 等会重建菜单 DOM），click
            // 会派发到已脱离文档的旧节点上而丢失，表现为"点了名字却没
            // 切换"。click 仅保留给键盘（Enter）触发。
            const apply = () => applyModeModelSelection(btn.dataset.modeModelSelect, btn.dataset.modeModelValue);
            btn.onpointerdown = event => {
                if(event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                btn.dataset.modelPicked = '1';
                apply();
            };
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(btn.dataset.modelPicked === '1'){
                    delete btn.dataset.modelPicked;
                    return;
                }
                apply();
            };
        });
        queryComposerParams('[data-api-provider-id]:not([data-api-tree-model])').forEach(summary => {
            summary.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(summary.dataset.apiProviderId === settings[summary.dataset.apiProviderParam]) return;
                setApiTreeSelection(summary.dataset.apiProviderParam, summary.dataset.apiProviderId);
            };
        });
        queryComposerParams('[data-api-tree-model]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                setApiTreeSelection(btn.dataset.apiProviderParam, btn.dataset.apiProviderId, btn.dataset.apiModelParam, btn.dataset.apiTreeModel);
            };
        });
        queryComposerParams('[data-video-reference-mode]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const mode = btn.dataset.videoReferenceMode;
                if(!['text','omni','image','frames','reference'].includes(mode)) return;
                if(videoModelCapabilities(settings).modes[mode] !== true) return;
                if(!videoModeHasRequiredInputs(mode)) return;
                settings.videoReferenceMode = mode;
                settings.videoUseFrameRoles = mode === 'frames';
                settings.videoMultimodal = mode === 'omni' || mode === 'reference';
                settings._videoMultimodalUserSet = true;
                if(typeof deps.normalizeSmartVideoModeSettings === 'function'){
                    deps.normalizeSmartVideoModeSettings(settings, mode === 'frames');
                }
                persistVideoPanelSettings(settings);
                refreshVideoSettingsPanel(settings);
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-video-bool-param]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                settings[btn.dataset.videoBoolParam] = btn.dataset.videoBoolValue === 'true';
                persistVideoPanelSettings(settings);
                refreshVideoSettingsPanel(settings);
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-video-duration-range]').forEach(input => {
            const output = input.parentElement?.querySelector('output');
            input.onclick = event => event.stopPropagation();
            input.oninput = event => {
                event.stopPropagation();
                const value = Math.max(1, Math.min(15, Number(input.value) || 5));
                settings.videoDuration = value;
                if(output) output.textContent = String(value);
                updateComposerToolBtnLabels();
            };
            input.onchange = event => {
                event.stopPropagation();
                const value = Math.max(1, Math.min(15, Number(input.value) || 5));
                settings.videoDuration = value;
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.rememberRecentSmartSettings === 'function') deps.rememberRecentSmartSettings(settings, deps.activeSettingsSubject?.());
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-size-scope]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                markControlInteracting(btn);
                const prefix = btn.dataset.sizePrefix || '';
                const scope = btn.dataset.sizeScope;
                const resKey = prefix ? `${prefix}Resolution` : 'resolution';
                const ratioKey = prefix ? `${prefix}Ratio` : 'ratio';
                const isGptImageAutoSizeModel = deps.isGptImageAutoSizeModel;
                const allowAuto = !prefix && settings.engine === 'api' && settings.apiKind !== 'video'
                    && typeof isGptImageAutoSizeModel === 'function' && isGptImageAutoSizeModel(settings.model);
                if(scope === 'auto'){
                    if(!allowAuto) return;
                    settings[resKey] = 'auto';
                    if(!settings[ratioKey]) settings[ratioKey] = 'square';
                } else if(scope === 'custom'){
                    settings[resKey] = 'custom';
                } else {
                    settings[resKey] = ['1k','2k','4k'].includes(settings[resKey]) ? settings[resKey] : sizePickerDefaultResolution(prefix);
                    if(!settings[ratioKey] || settings[ratioKey] === 'custom') settings[ratioKey] = 'square';
                }
                if(settings.outpaintResolutionLocked){
                    delete settings.outpaintResolutionLocked;
                    const activeSettingsSubject = deps.activeSettingsSubject;
                    const subject = typeof activeSettingsSubject === 'function' ? activeSettingsSubject() : null;
                    if(subject) delete subject.outpaintSize;
                }
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.rememberRecentSmartSettings === 'function') deps.rememberRecentSmartSettings(settings, deps.activeSettingsSubject?.());
                renderDynamicParams();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-param]').forEach(input => {
            input.onclick = event => event.stopPropagation();
            input.oninput = input.onchange = event => {
                event?.stopPropagation?.();
                if(typeof setDynamicSetting === 'function') setDynamicSetting(input.dataset.param, input.value);
                if(input.dataset.param === 'videoDuration' && event?.type === 'change') renderDynamicParams();
            };
        });
        queryComposerParams('[data-toggle-param]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                settings[btn.dataset.toggleParam] = !settings[btn.dataset.toggleParam];
                if(btn.dataset.toggleParam === 'videoMultimodal') settings._videoMultimodalUserSet = true;
                if(btn.dataset.toggleParam === 'videoMultimodal' && settings.videoMultimodal) settings.videoUseFrameRoles = false;
                if(typeof deps.normalizeSmartVideoModeSettings === 'function'){
                    deps.normalizeSmartVideoModeSettings(settings, btn.dataset.toggleParam === 'videoUseFrameRoles');
                }
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                renderDynamicParams();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-trusted-source]').forEach(btn => {
            btn.onclick = async event => {
                event.preventDefault();
                event.stopPropagation();
                const src = btn.dataset.trustedSource;
                settings.videoTrustedSource = ['library','cloud','manual'].includes(src) ? src : 'library';
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                renderDynamicParams();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
                try {
                    if(src === 'cloud' && typeof deps.uploadCurrentSmartVideosToCloud === 'function') await deps.uploadCurrentSmartVideosToCloud();
                    else if(src === 'manual' && typeof deps.setCurrentSmartManualVideoUrl === 'function') await deps.setCurrentSmartManualVideoUrl();
                } catch(e) {
                    const toast = deps.toast || (msg => console.warn(msg));
                    toast((e.message || '操作失败').slice(0, 180));
                }
            };
        });
        queryComposerParams('[data-comfy-bool]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                settings.comfyParams = settings.comfyParams || {};
                const id = btn.dataset.comfyBool;
                const currentComfyFields = deps.currentComfyFields;
                const field = (typeof currentComfyFields === 'function' ? currentComfyFields() : []).find(f => f.id === id);
                settings.comfyParams[id] = !Boolean(settings.comfyParams[id] ?? field?.default ?? false);
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                renderDynamicParams();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-comfy-param]').forEach(input => {
            input.onclick = event => event.stopPropagation();
            input.oninput = input.onchange = event => {
                event?.stopPropagation?.();
                settings.comfyParams = settings.comfyParams || {};
                const currentComfyFields = deps.currentComfyFields;
                const field = (typeof currentComfyFields === 'function' ? currentComfyFields() : []).find(f => f.id === input.dataset.comfyParam);
                if(field?.type === 'number' || field?.type === 'slider') settings.comfyParams[input.dataset.comfyParam] = Number(input.value) || 0;
                else settings.comfyParams[input.dataset.comfyParam] = input.value;
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-comfy-pick]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                settings.comfyParams = settings.comfyParams || {};
                const fieldId = btn.dataset.comfyPick;
                const value = btn.dataset.comfyValue;
                settings.comfyParams[fieldId] = value;
                const popover = btn.closest('.smart-popover');
                const control = btn.closest('.smart-control');
                const pillSub = control?.querySelector('.smart-pill .sub');
                if(pillSub) pillSub.textContent = value;
                if(popover){
                    popover.querySelectorAll(`[data-comfy-pick="${fieldId}"]`).forEach(b => b.classList.toggle('active', b.dataset.comfyValue === value));
                }
                closeAllSmartPopovers();
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-comfy-random]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(typeof deps.toggleSmartComfyRandom === 'function') deps.toggleSmartComfyRandom(btn.dataset.comfyRandom);
            };
        });
        queryComposerParams('[data-rh-bool]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                settings.rhParams = settings.rhParams || {};
                const key = btn.dataset.rhBool;
                const rhActiveFields = deps.rhActiveFields;
                const rhParamKey = deps.rhParamKey;
                const rhParamValue = deps.rhParamValue;
                const fields = typeof rhActiveFields === 'function' ? rhActiveFields() : [];
                const field = fields.find(f => typeof rhParamKey === 'function' && rhParamKey(f.nodeId, f.fieldName) === key);
                const cur = settings.rhParams[key] || {};
                const on = typeof rhParamValue === 'function' ? String(rhParamValue(field, null)).toLowerCase() === 'true' : false;
                settings.rhParams[key] = {...cur, value:String(!on)};
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                renderDynamicParams();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-rh-param]').forEach(input => {
            input.onclick = event => event.stopPropagation();
            input.oninput = input.onchange = event => {
                event?.stopPropagation?.();
                const key = input.dataset.rhParam;
                settings.rhParams = settings.rhParams || {};
                const cur = settings.rhParams[key] || {};
                settings.rhParams[key] = {...cur, value:input.value};
                const control = input.closest('.smart-control');
                const valueText = control?.querySelector('.rh-slider-value');
                const pillValue = control?.querySelector('.rh-slider-pill-value');
                if(valueText) valueText.textContent = input.value;
                if(pillValue) pillValue.textContent = input.value;
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
            if(input.dataset.rhType === 'slider'){
                input.onpointerup = () => input.blur();
                input.onmouseleave = () => {
                    if(!input.closest('.smart-control')?.matches(':hover')) input.blur();
                };
            }
        });
        queryComposerParams('[data-rh-pick]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const key = btn.dataset.rhPick;
                const value = btn.dataset.rhValue;
                settings.rhParams = settings.rhParams || {};
                const cur = settings.rhParams[key] || {};
                settings.rhParams[key] = {...cur, value};
                const popover = btn.closest('.smart-popover');
                const control = btn.closest('.smart-control');
                const pillSub = control?.querySelector('.smart-pill .sub');
                if(pillSub) pillSub.textContent = value;
                if(popover){
                    popover.querySelectorAll('[data-rh-pick]').forEach(b => {
                        if(b.dataset.rhPick === key) b.classList.toggle('active', b.dataset.rhValue === value);
                    });
                }
                closeAllSmartPopovers();
                if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
                if(typeof deps.scheduleSave === 'function') deps.scheduleSave();
            };
        });
        queryComposerParams('[data-rh-random]').forEach(btn => {
            btn.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(typeof deps.toggleSmartRhRandom === 'function') deps.toggleSmartRhRandom(btn.dataset.rhRandom);
            };
        });
    }


    function updatePromptPlaceholder(){
        const deps = d();
        const promptInput = deps?.promptInput;
        if(!promptInput) return;
        const suggestion = typeof deps.rhDefaultPromptSuggestion === 'function' ? deps.rhDefaultPromptSuggestion() : '';
        const tr = typeof deps.tr === 'function' ? deps.tr : (k) => k;
        const promptKey = deps.settings?.apiKind === 'audio'
            ? 'smart.audioPromptPlaceholder'
            : deps.settings?.apiKind === 'video'
                ? 'smart.videoPromptPlaceholder'
                : 'smart.promptPlaceholder';
        promptInput.dataset.placeholder = suggestion || tr(promptKey);
    }

    function renderDynamicParams(){
        const deps = d();
        const settings = deps?.settings;
        const dynamicParams = deps?.dynamicParams;
        const composer = deps?.composer;
        if(!settings || !dynamicParams) return;
        if(settings.apiKind !== 'video') setComposerQualityPanel('');
        const keepOpen = openControlState();
        const scrollState = dynamicParamsScrollSnapshot();
        if(typeof bindApiKindToggle === 'function') bindApiKindToggle();
        const selected = deps.selectedNode?.();
        if(global.SmartCanvasComposerText?.isTextSubject?.(selected)){
            syncApiKindToggleVisibility();
            global.SmartCanvasComposerText.syncComposer(selected);
            bindComposerApiSettings();
            if(global.lucide) lucide.createIcons();
            const scheduleComposerReposition = deps.scheduleComposerReposition;
            if(composer?.classList.contains('open') && typeof scheduleComposerReposition === 'function') scheduleComposerReposition(selected);
            return;
        }
        global.SmartCanvasComposerText?.syncMediaSettingsFromNode?.(settings, selected);
        settings.engine = ['api','volcengine','modelscope','comfy','runninghub'].includes(settings.engine) ? settings.engine : 'api';
        if(global.SmartCanvasComposerText?.modeFor?.(selected) === 'audio'){
            settings.engine = 'api';
            settings.apiKind = 'audio';
        } else if(global.SmartCanvasComposerText?.modeFor?.(selected) === 'video'){
            settings.engine = 'api';
            settings.apiKind = 'video';
        } else {
            settings.apiKind = ['video', 'audio'].includes(settings.apiKind) ? settings.apiKind : 'image';
        }
        if(global.SmartCanvasModeBindings) SmartCanvasModeBindings.applyAllBindings(settings, selected);
        normalizeVideoModeForInputs(settings);
        setComposerVideoReferencePanel(settings.apiKind === 'video' ? renderVideoReferencePanel() : '');
        clearVolcengineSelectionOutsideVolcengine(settings);
        syncApiKindToggleVisibility();
        if(settings.engine === 'api'){
            if(settings.apiKind === 'video') renderApiVideoParams();
            else if(settings.apiKind === 'audio') renderApiAudioParams();
            else renderApiParams();
        }
        else if(settings.engine === 'volcengine'){
            if(settings.apiKind === 'video') renderVolcengineVideoParams();
            else renderVolcengineParams();
        }
        else if(settings.engine === 'modelscope') renderMsParams();
        else if(settings.engine === 'runninghub') renderRunningHubParams();
        else renderComfyParams();
        bindDynamicParams();
        bindComposerApiSettings();
        restoreOpenControl(keepOpen);
        restoreDynamicParamsScroll(scrollState);
        updatePromptPlaceholder();
        updateComposerToolBtnLabels();
        syncComposerToolVisibility();
        syncSizeChoiceGliders();
        if(typeof deps.persistActiveSmartSettings === 'function') deps.persistActiveSmartSettings();
        if(global.lucide) lucide.createIcons();
        const selectedNode = deps.selectedNode;
        const scheduleComposerReposition = deps.scheduleComposerReposition;
        const openNode = typeof selectedNode === 'function' ? selectedNode() : null;
        if(openNode && composer?.classList.contains('open') && typeof scheduleComposerReposition === 'function'){
            scheduleComposerReposition(openNode);
        }
    }

    function renderComfyParams(){
        const deps = d();
        const settings = deps?.settings;
        const dynamicParams = deps?.dynamicParams;
        const composerHeadParams = deps?.composerHeadParams;
        if(!settings || !dynamicParams) return;
        const tr = deps.tr || (k => k);
        const escapeHtml = deps.escapeHtml || (v => String(v));
        const comfyWorkflows = deps.getComfyWorkflows?.() || deps.comfyWorkflows || [];
        const comfyWorkflowCache = deps.comfyWorkflowCache || {};
        const ensureComfyWorkflow = deps.ensureComfyWorkflow;
        const comfyFieldKind = deps.comfyFieldKind;
        const renderDynamicParams = deps.renderDynamicParams;
        settings.comfyMode = ['text','enhance','edit','custom'].includes(settings.comfyMode) ? settings.comfyMode : 'text';
        const modeOptions = [
            ['text', tr('canvas.comfyModeText') || '文生图'],
            ['enhance', tr('canvas.comfyModeEnhance') || '图片增强'],
            ['edit', tr('canvas.comfyModeEdit') || '图片编辑'],
            ['custom', tr('canvas.comfyModeCustom') || '自定义']
        ];
        if(settings.comfyMode === 'custom'){
            if(!settings.comfyWorkflow || !comfyWorkflows.some(w => w.name === settings.comfyWorkflow)) settings.comfyWorkflow = comfyWorkflows[0]?.name || '';
            if(settings.comfyWorkflow && !comfyWorkflowCache[settings.comfyWorkflow] && typeof ensureComfyWorkflow === 'function' && typeof renderDynamicParams === 'function'){
                ensureComfyWorkflow(settings.comfyWorkflow).then(renderDynamicParams);
            }
        }
        let html = '';
        if(settings.comfyMode === 'text'){
            html += `<div class="num-compact"><span class="num-label">${escapeHtml(tr('smart.width'))}</span><input type="number" data-param="width" value="${Number(settings.width || 1024)}"></div>
            <div class="num-compact"><span class="num-label">${escapeHtml(tr('smart.height'))}</span><input type="number" data-param="height" value="${Number(settings.height || 1024)}"></div>`;
        } else if(settings.comfyMode === 'enhance'){
            html += `<div class="num-compact"><span class="num-label">${escapeHtml(tr('smart.strength'))}</span><input type="number" min="0.1" max="1" step="0.05" data-param="enhanceStrength" value="${Number(settings.enhanceStrength ?? 0.5)}"></div>
            <button type="button" class="setting-check ${settings.enhanceUpscale ? 'active' : ''}" data-toggle-param="enhanceUpscale"><span class="check-box"></span><span>${escapeHtml(tr('smart.superResolution'))}</span></button>
            ${settings.enhanceUpscale ? renderUpscalePill('enhanceUpscaleRes', Number(settings.enhanceUpscaleRes || 2048)) : ''}`;
        } else if(settings.comfyMode === 'edit'){
            html += `<button type="button" class="setting-check ${settings.editUpscale ? 'active' : ''}" data-toggle-param="editUpscale"><span class="check-box"></span><span>${escapeHtml(tr('smart.superResolution'))}</span></button>
            ${settings.editUpscale ? renderUpscalePill('editUpscaleRes', Number(settings.editUpscaleRes || 2048)) : ''}`;
        } else if(typeof comfyFieldKind === 'function'){
            const wf = comfyWorkflowCache[settings.comfyWorkflow];
            const fields = (wf?.config?.fields || []).filter(f => comfyFieldKind(f) === 'setting');
            html += renderComfyWorkflowControl();
            html += fields.length ? fields.map(renderComfySettingField).join('') : (settings.comfyWorkflow ? '' : `<div class="muted-note">${escapeHtml(tr('smart.noWorkflow'))}</div>`);
        }
        if(composerHeadParams) composerHeadParams.innerHTML = '';
        setComposerSizePanel('');
        setComposerCountPanel('');
        dynamicParams.innerHTML = `
        <div class="smart-control comfy-mode-control">
            <button class="smart-pill" type="button"><i data-lucide="workflow"></i><span>${escapeHtml(modeOptions.find(([v]) => v === settings.comfyMode)?.[1] || 'ComfyUI')}</span></button>
            <div class="smart-popover compact-popover">
                <div class="smart-popover-title">${escapeHtml(tr('smart.comfyMode'))}</div>
                <div class="model-list">
                    ${modeOptions.map(([value, label]) => `<button type="button" class="direct-option ${value === settings.comfyMode ? 'active' : ''}" data-smart-param="comfyMode" data-smart-value="${escapeHtml(value)}"><span>${escapeHtml(label)}</span></button>`).join('')}
                </div>
            </div>
        </div>
        ${html}
    `;
    }

    function syncJimengModelPillForRefs(){
 if(_jimengModelRefreshing) return;
 if(d()?.settings.provider_id !== 'jimeng' || d()?.settings.engine !== 'api' || d()?.settings.apiKind === 'video'){
 _jimengLastEditMode = null;
 return;
 }
 const mode = global.SmartCanvasGeneration?.jimengImageEditMode();
 if(mode === _jimengLastEditMode) return;
 _jimengLastEditMode = mode;
 _jimengModelRefreshing = true;
 try { renderDynamicParams(); } finally { _jimengModelRefreshing = false; }
}
    function syncJimengVideoModelPillForRefs(){
 if(_jimengModelRefreshing) return;
 if(d()?.settings.videoProvider !== 'jimeng' || d()?.settings.engine !== 'api' || d()?.settings.apiKind !== 'video'){
 _jimengLastVideoCommand = null;
 return;
 }
 const command = global.SmartCanvasGeneration?.jimengVideoCommand();
 if(command === _jimengLastVideoCommand) return;
 _jimengLastVideoCommand = command;
 _jimengModelRefreshing = true;
 try { renderDynamicParams(); } finally { _jimengModelRefreshing = false; }
}
    function defaultSmartApiResolution(model){
 return global.SmartCanvasComposerSettings?.isGptImageAutoSizeModel(model) ? 'auto' : '1k';
}
    function clearVolcengineSelectionOutsideVolcengine(target=settings){
 if(!target || typeof target !== 'object' || target.engine === 'volcengine') return target;
 if(target.provider_id === 'volcengine') target.provider_id = '';
 if(target.videoProvider === 'volcengine') target.videoProvider = '';
 return target;
}
    const api = Object.freeze({
        clearVolcengineSelectionOutsideVolcengine,
        defaultSmartApiResolution,
        syncJimengVideoModelPillForRefs,
        syncJimengModelPillForRefs,
        controlTypeKey,
        openControlState,
        restoreOpenControl,
        dynamicParamsScrollSnapshot,
        restoreDynamicParamsScroll,
        renderQualityControl,
        renderCountVisualControl,
        normalizeApiSizeSettings,
        renderSizeControls,
        renderCountControl,
        resolutionLabel,
        ratioIconClass,
        renderRatioControl,
        renderResolutionControl,
        renderProviderControl,
        renderModelControl,
        msModelLabel,
        renderMsFunctionControl,
        renderMsCustomModelPill,
        renderInlineCustomRatioFields,
        renderInlineCustomSizeFields,
        renderCustomRatioControls,
        renderCustomSizeControls,
        videoAspectIconClass,
        currentVideoReferenceMode,
        videoModelCapabilities,
        videoModeUsesSize,
        renderVideoReferencePanel,
        renderFlatVideoSettingsPanel,
        renderVideoProviderControl,
        renderVideoModelControl,
        renderVideoDurationControl,
        renderVideoAspectControl,
        renderVideoResolutionControl,
        renderVideoToggleControl,
        renderTempShUploadControl,
        renderManualVideoUrlControl,
        renderVideoTrustedAssetControl,
        renderRhConfigControl,
        renderRhPaymentControl,
        renderRhMachineControl,
        renderUpscalePill,
        renderComfyWorkflowControl,
        renderComfySettingField,
        renderRhSettingField,
        renderRunningHubParams,
        renderComfyParams,
        renderDynamicParams,
        renderComposerHeadParams,
        renderApiParams,
        renderApiVideoParams,
        renderApiAudioParams,
        renderVolcengineParams,
        renderVolcengineVideoParams,
        renderMsParams,
        markControlInteracting,
        closeAllSmartPopovers,
        bindSmartControlPills,
        syncApiKindToggleVisibility,
        bindApiKindToggle,
        bindComposerApiSettings,
        closeComposerApiSettings,
        toggleComposerToolPopover,
        ensureApiImageQualityDefault,
        bindDynamicParams,
        updatePromptPlaceholder,
        setDynamicSetting,
        sizePickerScope,
        sizePickerDefaultResolution,
        sizePickerLabel,
        renderSizePickerControl,
        renderComposerSubmenuSection,
        renderComposerSizePopoverBody,
        placeholderAspectRatioForSetting,
        resizeActiveTypedPlaceholderForSetting,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('composerParams', api);
    }

    global.SmartCanvasComposerParams = api;
})(window);
