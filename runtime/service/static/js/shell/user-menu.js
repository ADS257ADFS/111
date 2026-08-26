/**
 * Shell user menu — isolated profile/theme surface for the floating left rail.
 */
(function(global){
    'use strict';

    const NAME_KEY = 'studio_user_display_name';
    const AVATAR_KEY = 'studio_user_avatar';
    const SMART_GUIDES_KEY = 'smart_canvas_smart_guides';
    let closeTimer = 0;
    let statusTimer = 0;

    function byId(id){ return document.getElementById(id); }
    function menuEl(){ return byId('shellUserMenu'); }
    function triggerEl(){ return byId('shellSidebarUserBtn') || byId('topUserBtn'); }
    function isOpen(){ return Boolean(menuEl()?.classList.contains('open')); }

    function stored(key, fallback=''){
        try { return localStorage.getItem(key) || fallback; } catch(e) { return fallback; }
    }

    function save(key, value){
        try { localStorage.setItem(key, value); } catch(e) {}
    }

    function refreshIcons(){
        try { global.lucide?.createIcons?.(); } catch(e) {}
    }

    function ensureItemGlider(menu){
        if(!menu) return null;
        const host = menu.querySelector('.shell-user-menu-card') || menu;
        let glider = menu.querySelector('.shell-user-menu-glider');
        if(!glider){
            glider = document.createElement('span');
            glider.className = 'shell-user-menu-glider';
            glider.setAttribute('aria-hidden', 'true');
        }
        if(glider.parentElement !== host) host.prepend(glider);
        return glider;
    }

    function menuItem(target){
        return target?.closest?.('.shell-user-menu-item') || null;
    }

    function moveItemGlider(menu, item){
        const glider = ensureItemGlider(menu);
        if(!glider || !item) return;
        const host = glider.parentElement || menu;
        const hostRect = host.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if(!hostRect.width || !itemRect.width) return;
        glider.style.setProperty('--shell-user-glider-x', `${itemRect.left - hostRect.left}px`);
        glider.style.setProperty('--shell-user-glider-y', `${itemRect.top - hostRect.top}px`);
        glider.style.setProperty('--shell-user-glider-width', `${itemRect.width}px`);
        glider.style.setProperty('--shell-user-glider-height', `${itemRect.height}px`);
        glider.classList.add('is-visible');
        menu.classList.add('has-item-glider');
    }

    function hideItemGlider(menu){
        menu?.querySelector('.shell-user-menu-glider')?.classList.remove('is-visible');
        menu?.classList.remove('has-item-glider');
    }

    function syncProfile(){
        const nameInput = byId('shellUserNameInput');
        if(nameInput) nameInput.value = stored(NAME_KEY, '用户');
        const avatar = stored(AVATAR_KEY);
        const image = byId('shellUserAvatarImage');
        const fallback = byId('shellUserAvatarFallback');
        if(image){
            image.hidden = !avatar;
            if(avatar) image.src = avatar;
            else image.removeAttribute('src');
        }
        if(fallback) fallback.hidden = Boolean(avatar);
        const points = 2365;
        const pointsText = String(points);
        const menuPoints = byId('shellUserPointsValue');
        const topPoints = byId('topUserPoints');
        if(menuPoints) menuPoints.textContent = pointsText;
        if(topPoints) topPoints.textContent = pointsText;
    }

    function syncTheme(){
        const dark = global.StudioTheme?.get?.() === 'dark';
        const button = menuEl()?.querySelector('[data-shell-user-action="theme"]');
        button?.setAttribute('aria-pressed', String(dark));
        const label = byId('shellUserThemeLabel');
        if(label) label.textContent = dark ? '深色' : '浅色';
    }

    function smartGuidesEnabled(){
        return stored(SMART_GUIDES_KEY, '1') === '1';
    }

    function syncSmartGuides(next=smartGuidesEnabled()){
        const enabled = Boolean(next);
        const button = menuEl()?.querySelector('[data-shell-user-action="smart-guides"]');
        button?.setAttribute('aria-pressed', String(enabled));
        button?.setAttribute('aria-checked', String(enabled));
        const label = byId('shellUserSmartGuidesLabel');
        if(label) label.textContent = enabled ? '开启' : '关闭';
    }

    function setSmartGuides(next){
        const enabled = Boolean(next);
        save(SMART_GUIDES_KEY, enabled ? '1' : '0');
        syncSmartGuides(enabled);
        const frame = global.getActiveCanvasFrame?.() || byId('frame-canvas');
        let appliedDirectly = false;
        try {
            const api = frame?.contentWindow?.SmartCanvasSmartGuides;
            if(api?.setEnabled){
                api.setEnabled(enabled);
                appliedDirectly = true;
            }
        } catch(e) {}
        if(!appliedDirectly){
            try {
                frame?.contentWindow?.postMessage({ type:'canvas-smart-guides-set', enabled }, location.origin);
            } catch(e) {}
        }
    }

    function measureMenuHeight(menu, options = {}){
        const collapsed = Boolean(options.collapsed);
        const status = byId('shellUserMenuStatus');
        const statusVisible = status?.classList.contains('visible');
        if(collapsed && statusVisible) status.classList.remove('visible');
        const height = menu.offsetHeight;
        if(collapsed && statusVisible) status.classList.add('visible');
        return height;
    }

    function resolveMenuTop(triggerRect, menu, options = {}){
        const edge = 12;
        if(options.keepTop && menu.dataset.anchorTop){
            return Number(menu.dataset.anchorTop);
        }
        const collapsedHeight = measureMenuHeight(menu, { collapsed: true });
        const gap = Number.parseFloat(getComputedStyle(menu).getPropertyValue('--ui-space-4'));
        let top = triggerRect.top - collapsedHeight - gap;
        if(top < edge) top = edge;
        menu.dataset.anchorTop = String(Math.round(top));
        return top;
    }

    function positionMenu(options = {}){
        const menu = menuEl();
        const trigger = triggerEl();
        if(!menu || !trigger || menu.hidden) return;
        const triggerRect = trigger.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        if(!menuWidth) return;

        const gap = 14;
        const edge = 12;
        const left = Math.max(edge, triggerRect.left - menuWidth - gap);

        const verticalGap = Number.parseFloat(getComputedStyle(menu).getPropertyValue('--ui-space-4'));
        menu.style.maxHeight = `${Math.max(0, Math.floor(triggerRect.top - edge - verticalGap))}px`;

        const top = resolveMenuTop(triggerRect, menu, options);

        menu.style.top = `${Math.round(top)}px`;
        menu.style.bottom = 'auto';
        menu.style.left = `${Math.round(left)}px`;
    }

    function schedulePositionMenu(options = {}){
        positionMenu(options);
        global.requestAnimationFrame(() => {
            positionMenu(options);
            global.requestAnimationFrame(() => positionMenu(options));
        });
    }

    function setStageIframeBlock(open){
        document.querySelectorAll('.stage > iframe').forEach(frame => {
            if(open){
                if(frame.dataset.shellMenuPeSaved === undefined){
                    frame.dataset.shellMenuPeSaved = frame.style.pointerEvents || '';
                }
                frame.style.pointerEvents = 'none';
                return;
            }
            if(frame.dataset.shellMenuPeSaved !== undefined){
                frame.style.pointerEvents = frame.dataset.shellMenuPeSaved;
                delete frame.dataset.shellMenuPeSaved;
            } else {
                frame.style.removeProperty('pointer-events');
            }
        });
    }

    function setShellMenuOpenState(open){
        const on = Boolean(open);
        document.documentElement.classList.toggle('shell-user-menu-open', on);
        setStageIframeBlock(on);
    }

    function ensureMenuTopLayer(){
        const menu = menuEl();
        if(!menu || menu.dataset.topLayer === '1') return;
        document.body.appendChild(menu);
        menu.dataset.topLayer = '1';
    }

    function open(){
        const menu = menuEl();
        const trigger = triggerEl();
        if(!menu || !trigger) return;
        global.clearTimeout(closeTimer);
        global.closeShellCanvasHistory?.();
        global.closeShellAssetLibrary?.();
        global.SmartCanvasShellSettings?.close?.();
        syncProfile();
        syncTheme();
        syncSmartGuides();
        delete menu.dataset.anchorTop;
        menu.hidden = false;
        menu.setAttribute('aria-hidden', 'false');
        trigger.setAttribute('aria-expanded', 'true');
        menu.classList.add('open');
        setShellMenuOpenState(true);
        schedulePositionMenu();
    }

    function close(options={}){
        const menu = menuEl();
        const trigger = triggerEl();
        if(!menu) return;
        hideItemGlider(menu);
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        trigger?.setAttribute('aria-expanded', 'false');
        setShellMenuOpenState(false);
        delete menu.dataset.anchorTop;
        menu.style.top = '';
        menu.style.bottom = '';
        menu.style.left = '';
        menu.style.maxHeight = '';
        global.clearTimeout(closeTimer);
        closeTimer = global.setTimeout(() => {
            if(!menu.classList.contains('open')) menu.hidden = true;
        }, options.immediate ? 0 : 190);
    }

    function toggle(force){
        const next = force === undefined ? !isOpen() : Boolean(force);
        next ? open() : close();
    }

    function showStatus(message){
        const status = byId('shellUserMenuStatus');
        if(!status) return;
        status.textContent = message;
        status.classList.add('visible');
        global.clearTimeout(statusTimer);
        statusTimer = global.setTimeout(() => status.classList.remove('visible'), 1800);
    }

    function normalizeAvatar(file){
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const image = new Image();
                image.onerror = reject;
                image.onload = () => {
                    const size = 256;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const context = canvas.getContext('2d');
                    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
                    const width = image.naturalWidth * scale;
                    const height = image.naturalHeight * scale;
                    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
                    resolve(canvas.toDataURL('image/jpeg', .88));
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function updateAvatar(file){
        if(!file?.type?.startsWith('image/')) return;
        try {
            const avatar = await normalizeAvatar(file);
            save(AVATAR_KEY, avatar);
            syncProfile();
        } catch(e) {
            showStatus('头像读取失败');
        }
    }

    function handleAction(action){
        if(action === 'profile' || action === 'recharge'){
            const settings = global.SmartCanvasShellSettings;
            if(settings?.open){
                settings.open('account');
            } else {
                close({ immediate: true });
            }
            return;
        }
        if(action === 'theme'){
            global.toggleTheme?.();
            syncTheme();
            return;
        }
        if(action === 'smart-guides'){
            setSmartGuides(!smartGuidesEnabled());
            return;
        }
        if(action === 'settings'){
            global.SmartCanvasShellSettings?.open?.('storage');
            return;
        }
        if(action === 'tutorial'){
            global.SmartCanvasShellSettings?.open?.('help');
            return;
        }
        if(action === 'cooperation'){
            global.SmartCanvasShellSettings?.open?.('cooperation');
            return;
        }
        const labels = {
            memory: '记忆管理功能待接入',
            updates: '当前已是最新版本',
            logout: '账号系统待接入'
        };
        showStatus(labels[action] || '功能待接入');
    }

    function init(){
        const menu = menuEl();
        const trigger = triggerEl();
        if(!menu || !trigger || menu.dataset.bound === '1') return;
        menu.dataset.bound = '1';
        ensureMenuTopLayer();
        ensureItemGlider(menu);
        syncProfile();
        syncTheme();
        syncSmartGuides();
        refreshIcons();

        if(trigger.dataset.shellUserMenuBound !== '1'){
            trigger.dataset.shellUserMenuBound = '1';
            trigger.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                toggle();
            });
        }

        menu.addEventListener('click', event => {
            event.stopPropagation();
            const action = event.target.closest('[data-shell-user-action]')?.dataset.shellUserAction;
            if(action) handleAction(action);
        });
        menu.addEventListener('pointerdown', event => event.stopPropagation());
        menu.addEventListener('pointerover', event => {
            const item = menuItem(event.target);
            if(item) moveItemGlider(menu, item);
        });
        menu.addEventListener('pointerout', event => {
            const nextItem = menuItem(event.relatedTarget);
            if(nextItem && nextItem.closest('.shell-user-menu') === menu) {
                moveItemGlider(menu, nextItem);
            } else {
                hideItemGlider(menu);
            }
        });
        menu.addEventListener('focusin', event => {
            const item = menuItem(event.target);
            if(item) moveItemGlider(menu, item);
        });
        menu.addEventListener('focusout', () => {
            global.requestAnimationFrame(() => {
                if(!menu.contains(document.activeElement)) hideItemGlider(menu);
            });
        });

        const nameInput = byId('shellUserNameInput');
        nameInput?.addEventListener('change', () => {
            const value = nameInput.value.trim().slice(0, 32) || '用户';
            nameInput.value = value;
            save(NAME_KEY, value);
        });
        nameInput?.addEventListener('keydown', event => {
            if(event.key !== 'Enter') return;
            event.preventDefault();
            nameInput.blur();
        });

        const avatarInput = byId('shellUserAvatarInput');
        byId('shellUserAvatarBtn')?.addEventListener('click', () => avatarInput?.click());
        avatarInput?.addEventListener('change', () => {
            updateAvatar(avatarInput.files?.[0]);
            avatarInput.value = '';
        });

        document.addEventListener('click', event => {
            if(!isOpen() || event.target.closest('#shellUserMenu,#shellSidebarUserBtn,#topUserBtn')) return;
            close();
        });
        document.addEventListener('keydown', event => {
            if(event.key !== 'Escape' || !isOpen()) return;
            event.preventDefault();
            close();
            trigger.focus();
        });
        global.addEventListener('resize', () => {
            if(!isOpen()) return;
            delete menuEl()?.dataset.anchorTop;
            schedulePositionMenu();
        });
        global.addEventListener('studio-theme-change', syncTheme);
        global.addEventListener('message', event => {
            if(event.origin && event.origin !== location.origin) return;
            if(event.data?.type === 'canvas-smart-guides-state') syncSmartGuides(event.data.enabled);
        });
    }

    global.SmartCanvasShellUserMenu = Object.freeze({
        init,
        open,
        close,
        toggle,
        isOpen,
        reposition: () => {
            if(isOpen()) schedulePositionMenu({ keepTop: true });
        }
    });
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
    else init();
})(window);
