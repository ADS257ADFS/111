/**
 * Shell (index.html) — unified account and settings center.
 */
(function(global){
    'use strict';

    const DEFAULT_PANE = 'account';
    let activePane = DEFAULT_PANE;

    function modalEl(){ return document.getElementById('shellSettingsModal'); }
    function isOpen(){ return Boolean(modalEl()?.classList.contains('open')); }

    function notifyFrameVisible(frame){
        if(!frame) return;
        const notify = () => {
            try { frame.contentWindow?.postMessage?.({ type:'shell-settings-pane-visible' }, '*'); } catch(e) {}
        };
        if(frame.dataset.settingsVisibleBound !== '1'){
            frame.dataset.settingsVisibleBound = '1';
            frame.addEventListener('load', notify);
        }
        requestAnimationFrame(notify);
    }

    function formatNumber(value){
        return Number(value || 0).toLocaleString('zh-CN');
    }

    function syncAccount(){
        const modal = modalEl();
        if(!modal) return;
        const name = localStorage.getItem('studio_user_display_name') || '用户';
        const avatar = localStorage.getItem('studio_user_avatar') || '';
        const points = Number(localStorage.getItem('studio_user_points') || 0);
        modal.querySelector('#shellSettingsAccountName').textContent = name;
        modal.querySelector('#shellSettingsAccountPoints').textContent = formatNumber(points);
        modal.querySelector('#shellSettingsUsagePoints').textContent = formatNumber(points);
        modal.querySelector('#shellRechargeBalance').textContent = formatNumber(points);
        const range = modal.querySelector('#shellRechargeRange');
        const amount = Math.max(1000, Math.min(10000, Number(range?.value) || 3000));
        const after = modal.querySelector('#shellRechargeAfter');
        if(after) after.textContent = formatNumber(points + amount);
        const image = modal.querySelector('#shellSettingsAccountAvatar');
        const fallback = image?.nextElementSibling;
        if(image){
            image.src = avatar || '';
            image.hidden = !avatar;
        }
        if(fallback) fallback.hidden = Boolean(avatar);
    }

    function setRechargeValue(value){
        const modal = modalEl();
        if(!modal) return;
        const amount = Math.max(1000, Math.min(10000, Number(value) || 3000));
        const range = modal.querySelector('#shellRechargeRange');
        if(range){
            range.value = String(amount);
            range.setAttribute('aria-valuenow', String(amount));
        }
        const formatted = formatNumber(amount);
        const amountEl = modal.querySelector('#shellRechargeAmount');
        const summaryEl = modal.querySelector('#shellRechargeSummary');
        if(amountEl) amountEl.textContent = formatted;
        if(summaryEl) summaryEl.textContent = formatted;
        const points = Number(localStorage.getItem('studio_user_points') || 0);
        const after = modal.querySelector('#shellRechargeAfter');
        if(after) after.textContent = formatNumber(points + amount);
        modal.querySelectorAll('[data-recharge-value]').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.rechargeValue) === amount);
        });
    }

    /* 历史记录已移出设置中心；顶栏历史按钮仍由 history.js 的 open() 负责。 */

    function setPane(id){
        activePane = id || DEFAULT_PANE;
        if(activePane === 'history') activePane = DEFAULT_PANE;
        const modal = modalEl();
        if(!modal) return;
        modal.querySelectorAll('[data-shell-settings-pane]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.shellSettingsPane === activePane);
        });
        modal.querySelectorAll('.shell-settings-pane').forEach(pane => {
            const selected = pane.dataset.shellSettingsPane === activePane;
            pane.classList.toggle('active', selected);
            pane.setAttribute('aria-hidden', selected ? 'false' : 'true');
            if(pane.dataset.shellSettingsPane !== activePane) return;
            const frame = pane.querySelector('[data-shell-settings-frame]');
            if(frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src || 'about:blank');
            if(frame && isOpen()) notifyFrameVisible(frame);
        });
        if(activePane === 'storage') global.ShellStorageLocation?.load?.();
        if(activePane === 'account' || activePane === 'usage') syncAccount();
    }

    function refreshIcons(){
        try { global.lucide?.createIcons?.(); } catch(e) {}
        try { global.applyI18n?.(); } catch(e) {}
    }

    function open(pane){
        const modal = modalEl();
        if(!modal) return;
        global.closeShellAssetLibrary?.();
        global.SmartCanvasShellUserMenu?.close?.({ immediate: true });
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('open');
        setPane(pane || activePane || DEFAULT_PANE);
        document.getElementById('toolbarSettingsBtn')?.classList.add('active');
        document.getElementById('topUserBtn')?.setAttribute('aria-expanded', 'true');
        refreshIcons();
    }

    function close(){
        const modal = modalEl();
        if(!modal) return;
        modal.classList.remove('open');
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.getElementById('toolbarSettingsBtn')?.classList.remove('active');
        document.getElementById('topUserBtn')?.setAttribute('aria-expanded', 'false');
    }

    function toggle(force){
        const next = force === undefined ? !isOpen() : Boolean(force);
        next ? open() : close();
    }

    function init(){
        const modal = modalEl();
        if(!modal || modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';

        const settingsBtn = document.getElementById('toolbarSettingsBtn');
        if(settingsBtn && !settingsBtn.hasAttribute('data-shell-user-menu-trigger') && !settingsBtn.dataset.bound){
            settingsBtn.dataset.bound = '1';
            settingsBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const pane = settingsBtn.dataset.shellSettingsPane || 'storage';
                if(isOpen() && activePane === pane) close();
                else open(pane);
            });
        }

        modal.querySelectorAll('.shell-settings-nav-btn[data-shell-settings-pane]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const pane = btn.dataset.shellSettingsPane || DEFAULT_PANE;
                setPane(pane);
            });
        });

        modal.querySelectorAll('[data-shell-settings-close]').forEach(el => {
            el.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                close();
            });
        });

        modal.querySelectorAll('[data-recharge-value]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                setRechargeValue(btn.dataset.rechargeValue);
            });
        });
        modal.querySelector('#shellRechargeRange')?.addEventListener('input', event => {
            setRechargeValue(event.target.value);
        });
        modal.querySelector('[data-shell-recharge-action]')?.addEventListener('click', () => {
            const status = modal.querySelector('#shellRechargeStatus');
            if(status) status.textContent = '充值服务尚未接入，暂无法完成支付';
        });
        modal.querySelectorAll('[data-shell-settings-pane-jump]').forEach(el => {
            el.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const pane = el.dataset.shellSettingsPaneJump;
                if(pane) setPane(pane);
            });
        });
        modal.querySelector('[data-shell-settings-logout]')?.addEventListener('click', () => {
            close();
            const existing = document.querySelector('[data-shell-user-action="logout"]');
            if(existing) existing.click();
        });

        if(!document.documentElement.dataset.shellSettingsKeyBound){
            document.documentElement.dataset.shellSettingsKeyBound = '1';
            document.addEventListener('keydown', event => {
                if(event.key === 'Escape' && isOpen()){
                    event.preventDefault();
                    close();
                }
            });
        }
    }

    global.SmartCanvasShellSettings = Object.freeze({ init, open, close, toggle, isOpen, setPane });
    global.openShellSettings = open;
    global.closeShellSettings = close;
    global.toggleShellSettings = toggle;
    global.isShellSettingsOpen = isOpen;
})(window);
