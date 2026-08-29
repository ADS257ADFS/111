(function(){
    'use strict';

    const ACTION_MAP = {
        hd:{key:'hd',label:'高清',iconType:'hd-badge'},
        crop:{key:'crop',label:'裁切',icon:'crop'},
        outpaint:{key:'outpaint',label:'扩图',icon:'expand'},
        grid:{key:'grid',label:'宫格切分',icon:'grid-3x3'},
        brush:{key:'brush',label:'框选',icon:'scan'},
        compare:{key:'compare',label:'多角度',icon:'panels-top-left'},
        'video-hd':{key:'video-hd',label:'高清',iconType:'hd-badge'},
        'video-trim':{key:'video-trim',label:'剪辑',icon:'scissors'},
        'video-frame':{key:'video-frame',label:'截取静帧',icon:'camera'},
        'video-separate':{key:'video-separate',label:'音视频分离',icon:'audio-lines'},
        asset:{key:'asset',label:'资产库',icon:'folder-open'},
        vector:{key:'vector',label:'矢量文件',icon:'pen-tool'},
        psd:{key:'psd',label:'PSD图层文件',icon:'layers'},
        download:{key:'download',label:'下载',icon:'download'}
    };

    let openMenu = '';

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[character]));
    }

    function getAction(key){ return ACTION_MAP[key] || null; }

    function renderIcon(action){
        if(action.iconType === 'hd-badge'){
            return '<svg class="image-action-hd-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.25"></rect><path d="M6.5 9v6M10.25 9v6M6.5 12h3.75"></path><path d="M13.75 9v6h1.4a3 3 0 0 0 0-6h-1.4Z"></path></svg>';
        }
        return action.icon ? `<i data-lucide="${escapeHtml(action.icon)}"></i>` : '';
    }

    function renderActionButton(action, extraClass=''){
        const className = extraClass ? ` class="${escapeHtml(extraClass)}"` : '';
        const label = escapeHtml(action.label);
        return `<button type="button"${className} data-image-action="${escapeHtml(action.key)}" title="${label}" aria-label="${label}">${renderIcon(action)}<span>${label}</span></button>`;
    }

    function renderIconOnlyActionButton(action){
        const label = escapeHtml(action.label);
        return `<button type="button" class="iqt-icon-only" data-image-action="${escapeHtml(action.key)}" title="${label}" aria-label="${label}">${renderIcon(action)}</button>`;
    }

    function renderDirectHdButton(){
        const action = getAction('hd');
        return `<button type="button" class="iqt-icon-only" data-hd-resolution="2k" title="高清" aria-label="高清">${renderIcon(action)}</button>`;
    }

    function renderDivider(){
        return '<span class="iqt-divider" aria-hidden="true"></span>';
    }

    function renderAddToChatButton(){
        return '<button type="button" data-add-to-chat title="添加到对话" aria-label="添加到对话"><i data-lucide="message-square-plus"></i><span>添加到对话</span></button>';
    }

    function attachmentForToolbar(toolbar){
        const ctx = window.SmartCanvasCore?.tryDeps?.();
        const nodeId = String(toolbar?.dataset?.nodeId || '');
        const imageIndex = Number(toolbar?.dataset?.imageIndex || 0);
        const nodes = ctx?.getNodes?.() || ctx?.nodes || [];
        const node = nodes.find(item => item.id === nodeId);
        const raw = node?.images?.[imageIndex];
        const media = ctx?.imageForDisplay?.(raw) || raw;
        const url = String(media?.url || '').trim();
        if(!url) return null;
        const detectedKind = ctx?.mediaKindForItem?.(media) || media?.kind || 'image';
        const toolbarKind = toolbar?.dataset?.mediaKind;
        const kind = toolbarKind === 'psd' || detectedKind === 'psd'
            ? 'document'
            : (['image','video','audio'].includes(toolbarKind)
                ? toolbarKind
                : (['image','video','audio','document'].includes(detectedKind) ? detectedKind : 'image'));
        const attachment = {
            kind,
            url,
            name:String(media?.name || node?.title || `${kind}-${imageIndex + 1}`)
        };
        const mimeType = media?.mime_type || media?.mimeType || '';
        if(mimeType) attachment.mime_type = mimeType;
        return attachment;
    }

    function addToolbarMediaToChat(toolbar){
        const attachment = attachmentForToolbar(toolbar);
        if(!attachment){
            window.toast?.('当前素材无法添加到对话');
            return false;
        }
        const target = window.parent !== window ? window.parent : window;
        target.postMessage({type:'canvas-add-to-chat', attachments:[attachment]}, location.origin);
        window.toast?.('已添加到右侧对话附件');
        return true;
    }

    function renderGlassGlider(){
        return '<span class="iqt-glass-glider" aria-hidden="true"></span>';
    }

    function renderDropdown(kind, label, icon, actions){
        return `<div class="iqt-dropdown-wrap" data-dropdown-wrap="${escapeHtml(kind)}"><button type="button" class="iqt-dropdown-toggle" data-dropdown-toggle="${escapeHtml(kind)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" aria-expanded="false"><i data-lucide="${escapeHtml(icon)}"></i><span>${escapeHtml(label)}</span><i class="iqt-dropdown-chevron" data-lucide="chevron-down"></i></button><div class="iqt-dropdown-menu" data-dropdown-menu="${escapeHtml(kind)}" hidden><span class="iqt-menu-glass-glider" aria-hidden="true"></span>${actions.map(key => renderActionButton(getAction(key),'iqt-menu-action')).join('')}</div></div>`;
    }

    function renderOverflowDropdown(){
        return `<div class="iqt-dropdown-wrap iqt-overflow-wrap" data-dropdown-wrap="more"><button type="button" class="iqt-dropdown-toggle iqt-icon-only iqt-overflow-toggle" data-dropdown-toggle="more" title="更多" aria-label="更多图片工具" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis"></i></button><div class="iqt-dropdown-menu" data-dropdown-menu="more" role="menu" hidden><span class="iqt-menu-glass-glider" aria-hidden="true"></span>${['grid','outpaint'].map(key => renderActionButton(getAction(key),'iqt-menu-action')).join('')}</div></div>`;
    }

    function render(toolbar){
        if(!toolbar) return;
        toolbar.innerHTML = (['audio','psd'].includes(toolbar.dataset.mediaKind) ? [
            renderGlassGlider(),
            renderAddToChatButton(),
            renderActionButton(getAction('download'))
        ] : toolbar.dataset.mediaKind === 'video' ? [
            renderGlassGlider(),
            renderAddToChatButton(),
            renderActionButton(getAction('video-hd')),
            renderActionButton(getAction('video-trim')),
            renderActionButton(getAction('video-frame')),
            renderActionButton(getAction('video-separate')),
            renderActionButton(getAction('download'))
        ] : [
            renderGlassGlider(),
            renderActionButton(getAction('crop')),
            renderActionButton(getAction('compare')),
            renderActionButton(getAction('brush')),
            renderActionButton(getAction('asset')),
            renderDivider(),
            renderOverflowDropdown(),
            renderDirectHdButton(),
            renderIconOnlyActionButton(getAction('psd')),
            renderIconOnlyActionButton(getAction('download'))
        ]).join('');
        syncMenuState(toolbar);
        window.lucide?.createIcons?.();
    }

    function topLevelButton(target){
        const button = target?.closest?.('button');
        if(!button) return null;
        if(button.parentElement === target?.closest?.('.iqt-dropdown-menu')) return null;
        return button.parentElement === toolbarFor(button)
            || button.matches('.iqt-dropdown-toggle') ? button : null;
    }

    function toolbarFor(element){
        return element?.closest?.('.image-quick-toolbar') || null;
    }

    function moveGlider(toolbar,button){
        const glider = toolbar?.querySelector('.iqt-glass-glider');
        if(!glider || !button) return;
        const toolbarRect = toolbar.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        if(!toolbarRect.width || !buttonRect.width) return;
        glider.style.setProperty('--iqt-glider-x',`${buttonRect.left - toolbarRect.left}px`);
        glider.style.setProperty('--iqt-glider-width',`${buttonRect.width}px`);
        glider.classList.add('is-visible');
    }

    function hideGlider(toolbar){
        toolbar?.querySelector('.iqt-glass-glider')?.classList.remove('is-visible');
    }

    function moveMenuGlider(menu,button){
        const glider = menu?.querySelector('.iqt-menu-glass-glider');
        if(!glider || !button) return;
        const menuRect = menu.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        if(!menuRect.height || !buttonRect.height) return;
        glider.style.setProperty('--iqt-menu-glider-y',`${buttonRect.top - menuRect.top}px`);
        glider.style.setProperty('--iqt-menu-glider-height',`${buttonRect.height}px`);
        glider.classList.add('is-visible');
    }

    function hideMenuGlider(menu){
        menu?.querySelector('.iqt-menu-glass-glider')?.classList.remove('is-visible');
    }

    function syncGliderToMenu(toolbar){
        if(!openMenu){
            hideGlider(toolbar);
            return;
        }
        const active = toolbar.querySelector(`[data-dropdown-toggle="${openMenu}"]`);
        if(active) moveGlider(toolbar,active);
    }

    function syncMenuState(toolbar){
        toolbar.querySelectorAll('[data-dropdown-toggle]').forEach(toggle => {
            const active = toggle.dataset.dropdownToggle === openMenu;
            toggle.setAttribute('aria-expanded', active ? 'true' : 'false');
        });
        toolbar.querySelectorAll('[data-dropdown-menu]').forEach(menu => {
            const active = menu.dataset.dropdownMenu === openMenu;
            if(menu._iqtHideTimer){
                clearTimeout(menu._iqtHideTimer);
                menu._iqtHideTimer = null;
            }
            if(active){
                menu.hidden = false;
                requestAnimationFrame(() => {
                    if(menu.dataset.dropdownMenu === openMenu) menu.classList.add('is-visible');
                });
            }else{
                hideMenuGlider(menu);
                menu.classList.remove('is-visible');
                if(!menu.hidden){
                    menu._iqtHideTimer = setTimeout(() => {
                        if(menu.dataset.dropdownMenu !== openMenu) menu.hidden = true;
                        menu._iqtHideTimer = null;
                    }, 260);
                }
            }
        });
        toolbar.querySelectorAll('[data-dropdown-wrap]').forEach(wrap => {
            wrap.classList.toggle('is-open', wrap.dataset.dropdownWrap === openMenu);
        });
    }

    function closeMenus(toolbar){
        openMenu = '';
        syncMenuState(toolbar);
    }

    function resetInteractionState(toolbar){
        const target = toolbar || document.querySelector('[data-image-quick-toolbar]');
        if(!target) return;
        openMenu = '';
        syncMenuState(target);
        hideGlider(target);
        target.querySelectorAll('.iqt-dropdown-menu').forEach(hideMenuGlider);
    }

    function runAction(action,onAction,button){
        if(action === 'video-hd'){
            window.SmartCanvasVideoHd?.open?.({nodeId:toolbarFor(button)?.dataset.nodeId || '',imageIndex:Number(toolbarFor(button)?.dataset.imageIndex || 0)})
                || window.toast?.('视频高清接口已预留');
            return;
        }
        if(action === 'video-trim'){
            Promise.resolve(window.SmartCanvasVideoTools?.open?.({nodeId:toolbarFor(button)?.dataset.nodeId || '',imageIndex:Number(toolbarFor(button)?.dataset.imageIndex || 0)})).catch(error=>window.toast?.(error?.message||'无法打开视频剪辑'));
            return;
        }
        if(action === 'video-frame'){
            Promise.resolve(window.SmartCanvasVideoTools?.captureFrame?.({nodeId:toolbarFor(button)?.dataset.nodeId || '',imageIndex:Number(toolbarFor(button)?.dataset.imageIndex || 0)})).catch(error=>window.toast?.(error?.message||'截取静帧失败'));
            return;
        }
        if(action === 'video-separate'){
            Promise.resolve(window.SmartCanvasVideoTools?.separate?.({nodeId:toolbarFor(button)?.dataset.nodeId || '',imageIndex:Number(toolbarFor(button)?.dataset.imageIndex || 0)})).catch(error=>window.toast?.(error?.message||'音视频分离失败'));
            return;
        }
        if(action === 'asset'){
            const toolbar = toolbarFor(button);
            const attachment = attachmentForToolbar(toolbar);
            const ctx = window.SmartCanvasCore?.tryDeps?.();
            const saver = ctx?.addUrlToAssetLibrary;
            if(!attachment?.url || typeof saver !== 'function'){
                window.toast?.('当前图片无法保存到资产库');
                return;
            }
            const categoryId = ctx.activeAssetCategoryId || window.SmartCanvasAssetLibraryUi?.getOpenGalleryCategoryId?.() || '';
            button.disabled = true;
            Promise.resolve(saver(attachment.url, attachment.name, categoryId))
                .catch(error => window.toast?.(error?.message || '保存资产失败'))
                .finally(() => { button.disabled = false; });
            return;
        }
        if(action === 'psd'){
            window.toast?.('PSD图层文件功能即将推出');
            return;
        }
        if(typeof onAction === 'function'){
            onAction(action,button);
            return;
        }
        window.openImageQuickAction?.(action || '');
    }

    function bind(toolbar,onAction){
        if(!toolbar || toolbar.dataset.quickToolbarBound === '1') return;
        toolbar.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();
        });
        toolbar.addEventListener('pointerover', event => {
            const menuAction = event.target.closest('.iqt-menu-action');
            if(menuAction){
                moveMenuGlider(menuAction.closest('.iqt-dropdown-menu'),menuAction);
                return;
            }
            const button = topLevelButton(event.target);
            if(button) moveGlider(toolbar,button);
        });
        toolbar.addEventListener('pointerout', event => {
            const menu = event.target.closest('.iqt-dropdown-menu');
            if(menu){
                const nextAction = event.relatedTarget?.closest?.('.iqt-menu-action');
                if(nextAction && nextAction.closest('.iqt-dropdown-menu') === menu){
                    moveMenuGlider(menu,nextAction);
                } else if(!event.relatedTarget?.closest?.('.iqt-dropdown-menu')) {
                    hideMenuGlider(menu);
                }
                return;
            }
            const nextButton = topLevelButton(event.relatedTarget);
            if(nextButton){
                moveGlider(toolbar,nextButton);
                return;
            }
            if(openMenu) syncGliderToMenu(toolbar);
            else hideGlider(toolbar);
        });
        toolbar.addEventListener('focusin', event => {
            const menuAction = event.target.closest('.iqt-menu-action');
            if(menuAction){
                moveMenuGlider(menuAction.closest('.iqt-dropdown-menu'),menuAction);
                return;
            }
            const button = topLevelButton(event.target);
            if(button) moveGlider(toolbar,button);
        });
        toolbar.addEventListener('focusout', event => {
            const menu = event.target.closest('.iqt-dropdown-menu');
            if(menu) hideMenuGlider(menu);
            if(openMenu) syncGliderToMenu(toolbar);
            else hideGlider(toolbar);
        });
        toolbar.addEventListener('click', event => {
            const addToChat = event.target.closest('[data-add-to-chat]');
            if(addToChat){
                event.preventDefault();
                event.stopPropagation();
                moveGlider(toolbar,addToChat);
                closeMenus(toolbar);
                addToolbarMediaToChat(toolbar);
                return;
            }

            const dropdownToggle = event.target.closest('[data-dropdown-toggle]');
            if(dropdownToggle){
                event.preventDefault();
                event.stopPropagation();
                const kind = dropdownToggle.dataset.dropdownToggle || '';
                openMenu = openMenu === kind ? '' : kind;
                syncMenuState(toolbar);
                if(openMenu) moveGlider(toolbar,dropdownToggle);
                else hideGlider(toolbar);
                return;
            }

            const hdChoice = event.target.closest('[data-hd-resolution]');
            if(hdChoice){
                event.preventDefault();
                event.stopPropagation();
                const resolution = hdChoice.dataset.hdResolution || '';
                closeMenus(toolbar);
                hideGlider(toolbar);
                const runner = window.SmartCanvasGeneration?.runQuickHdGeneration || window.runQuickHdGeneration;
                if(typeof runner !== 'function'){
                    window.toast?.('高清功能尚未就绪，请刷新页面后重试');
                    return;
                }
                Promise.resolve(runner(resolution, {
                    nodeId:toolbar.dataset.nodeId || '',
                    imageIndex:Number(toolbar.dataset.imageIndex || 0)
                })).catch(error => window.toast?.(error?.message || '高清生成失败'));
                return;
            }

            const actionButton = event.target.closest('[data-image-action]');
            if(!actionButton) return;
            event.preventDefault();
            event.stopPropagation();
            closeMenus(toolbar);
            hideGlider(toolbar);
            runAction(actionButton.dataset.imageAction || '',onAction,actionButton);
        });
        document.addEventListener('mousedown', event => {
            if(!toolbar.classList.contains('open') || !openMenu) return;
            if(event.target.closest('.image-quick-toolbar')) return;
            closeMenus(toolbar);
            hideGlider(toolbar);
        });
        toolbar.dataset.quickToolbarBound = '1';
    }

    function init(toolbar,options={}){
        if(!toolbar) return api;
        render(toolbar);
        bind(toolbar,options.onAction);
        return api;
    }

    function autoInit(){ init(document.querySelector('[data-image-quick-toolbar]')); }

    const api = {
        actions:Object.values(ACTION_MAP),
        movableKeys:[],
        loadLayout:()=>({bar:['crop','compare','brush','asset','divider','more','hd','psd','download'],overflow:['grid','outpaint']}),
        saveLayout:()=>{},
        render,
        bind,
        init,
        attachmentForToolbar,
        addToolbarMediaToChat,
        resetInteractionState,
        getLayout:()=>({bar:['crop','compare','brush','asset','divider','more','hd','psd','download'],overflow:['grid','outpaint']})
    };

    window.ImageQuickToolbar = api;
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',autoInit);
    else autoInit();
})();
