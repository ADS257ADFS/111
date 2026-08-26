/**
 * Smart Canvas - bottom-left capsule theme toggle.
 */
(function(global){
    'use strict';

    const THEME_META = {
        light: { labelKey: 'theme.lightMode', label: '日间模式', icon: 'sun', nextKey: 'theme.darkShort', next: '夜间' },
        dark: { labelKey: 'theme.darkMode', label: '夜间模式', icon: 'moon', nextKey: 'theme.lightShort', next: '日间' }
    };

    function tr(key, fallback){
        try {
            const value = global.StudioI18n?.t?.(key);
            if(value && value !== key) return value;
        } catch(e) {}
        return fallback;
    }

    function normalizeTheme(theme){
        return theme === 'dark' ? 'dark' : 'light';
    }

    function currentTheme(){
        return normalizeTheme(global.StudioTheme?.get?.() || 'light');
    }

    function themeTip(meta){
        const label = tr(meta.labelKey, meta.label);
        const next = tr(meta.nextKey, meta.next);
        return label + ' · 点击切换到' + next;
    }

    function updateButton(theme){
        const btn = global.document.getElementById('canvasThemeToggle');
        const icon = global.document.getElementById('canvasThemeIcon');
        if(!btn && !icon) return;
        const meta = THEME_META[normalizeTheme(theme)] || THEME_META.light;
        const tip = themeTip(meta);
        if(btn){
            btn.title = tip;
            btn.setAttribute('aria-label', tip);
        }
        if(icon){
            icon.setAttribute('data-lucide', meta.icon);
            try { global.lucide?.createIcons?.(); } catch(e) {}
        }
    }

    function toggleTheme(){
        try {
            if(global.parent && global.parent !== global && typeof global.parent.toggleTheme === 'function'){
                global.parent.toggleTheme();
                return;
            }
            if(global.StudioTheme?.toggle){
                const next = global.StudioTheme.toggle(global);
                updateButton(next);
            }
        } catch(e) {}
    }

    function bind(){
        const btn = global.document.getElementById('canvasThemeToggle');
        if(!btn || btn.dataset.boundThemeCapsule === '1') return;
        btn.dataset.boundThemeCapsule = '1';
        btn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            toggleTheme();
        });
        btn.addEventListener('mousedown', event => event.stopPropagation(), true);
        updateButton(currentTheme());
        global.addEventListener('studio-theme-change', event => {
            updateButton(event?.detail?.theme || currentTheme());
        });
        global.addEventListener('message', event => {
            if(event.data?.type === 'studio-theme') updateButton(event.data.theme);
        });
        global.addEventListener('studio-lang-change', () => updateButton(currentTheme()));
    }

    if(global.document.readyState === 'loading'){
        global.document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }

    global.SmartCanvasThemeCapsule = Object.freeze({ bind, updateButton, toggleTheme });
})(window);
