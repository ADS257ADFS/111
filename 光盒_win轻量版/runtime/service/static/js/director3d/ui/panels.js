(function(global){
    'use strict';

    const OBJECT_COLORS = Object.freeze(['#d8dbe0', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6']);

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        }[char]));
    }

    function transformNumber(value, fallback){
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function transformField(kind, axis, value, object, format = ''){
        const normalized = transformNumber(value, axis === 'w' ? 1 : 0);
        const disabled = object.locked ? ' disabled' : '';
        const formatAttribute = format ? ` data-director3d-transform-format="${format}"` : '';
        return `
            <label class="director3d-transform-field">
                <span>${axis.toUpperCase()}</span>
                <input type="number" step="0.01" inputmode="decimal" value="${normalized}" data-director3d-transform-kind="${kind}" data-director3d-transform-axis="${axis}" data-director3d-transform-object-id="${escapeHtml(object.id)}"${formatAttribute}${disabled}>
            </label>
        `;
    }

    function renderTransformPanel(object){
        const transform = object.transform || {};
        const position = transform.position || [0, 0, 0];
        const rotation = global.Director3DTransformFieldMath?.eulerDegreesFromQuaternion(transform.rotation || [0, 0, 0, 1]) || [0, 0, 0];
        const scale = transform.scale || [1, 1, 1];
        return `
            <section class="director3d-transform-panel" aria-label="对象变换">
                <div class="director3d-transform-heading">
                    <span>变换</span>
                    <span class="director3d-transform-actions">
                        <button type="button" data-director3d-duplicate-object="${escapeHtml(object.id)}" title="复制对象" aria-label="复制对象">${iconSvg('copy')}</button>
                        <button type="button" data-director3d-reset-object-transform="${escapeHtml(object.id)}" title="重置变换" aria-label="重置变换"${object.locked ? ' disabled' : ''}>${iconSvg('reset')}</button>
                    </span>
                </div>
                <div class="director3d-transform-group">
                    <span>位置</span>
                    <div class="director3d-transform-grid">${['x', 'y', 'z'].map((axis, index) => transformField('position', axis, position[index], object)).join('')}</div>
                </div>
                <div class="director3d-transform-group">
                    <span>旋转</span>
                    <div class="director3d-transform-grid">${['x', 'y', 'z'].map((axis, index) => transformField('rotation', axis, rotation[index], object, 'degrees')).join('')}</div>
                </div>
                <div class="director3d-transform-group">
                    <span>缩放</span>
                    <div class="director3d-transform-grid">${['x', 'y', 'z'].map((axis, index) => transformField('scale', axis, scale[index], object)).join('')}</div>
                </div>
            </section>
        `;
    }

    function iconSvg(kind, active){
        if(kind === 'eye') return active
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"></path><path d="M9.8 5.3A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-3.2 4.2"></path><path d="M6.6 6.6A18.8 18.8 0 0 0 2 12s3.5 6 10 6a10.8 10.8 0 0 0 4.1-.8"></path></svg>';
        if(kind === 'lock') return active
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 7.2-2.4"></path></svg>';
        if(kind === 'copy') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1"></rect><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"></path></svg>';
        if(kind === 'reset') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 4v5h5"></path></svg>';
        if(kind === 'rename') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"></path><path d="M13.5 8.5l3 3"></path></svg>';
        if(kind === 'up') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"></path><path d="m6 11 6-6 6 6"></path></svg>';
        if(kind === 'down') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="m18 13-6 6-6-6"></path></svg>';
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
    }

    function renderModelLibrary(panel, catalog){
        if(!panel) return;
        const models = catalog?.list?.() || [];
        panel.innerHTML = models.map(item => `
            <button type="button" data-director3d-model="${item.id}">
                <span>${item.label}</span>
            </button>
        `).join('');
    }

    function renderShotPanel(panel, state, shotStore, aspectRatio){
        if(!panel || !shotStore) return;
        const shots = shotStore.list();
        const currentShot = shotStore.current();
        const projectRatio = shotStore.ratio();
        const ratioButtons = aspectRatio.PRESETS
            .filter(ratio => ['16:9', '3:4', '2:3', '1:1'].includes(ratio.key))
            .map(ratio => `
                <button type="button" class="${(currentShot?.aspectRatio?.key || projectRatio?.key) === ratio.key ? 'active' : ''}" data-director3d-shot-ratio="${ratio.key}">${ratio.label}</button>
            `).join('');
        panel.innerHTML = `
            <div class="director3d-shot-list">
                ${shots.length ? shots.map(shot => `
                    <div class="director3d-shot-item ${shot.id === state.currentShotId && state.viewMode === 'shot' ? 'active' : ''} ${shot.locked ? 'locked' : ''}" data-director3d-shot-id="${shot.id}">
                        <span class="director3d-shot-name">${escapeHtml(shot.name)}</span>
                        <span class="director3d-shot-actions">
                            <i data-director3d-lock-shot="${shot.id}" title="${shot.locked ? '解锁机位' : '锁定机位'}" aria-label="${shot.locked ? '解锁机位' : '锁定机位'}">
                                ${iconSvg('lock', shot.locked)}
                            </i>
                            <i data-director3d-delete-shot="${shot.id}" title="删除机位" aria-label="删除机位">${iconSvg('delete')}</i>
                        </span>
                    </div>
                `).join('') : '<div class="director3d-empty-shots">暂无机位</div>'}
            </div>
            <div class="director3d-ratio-grid" aria-label="机位画幅">${ratioButtons}</div>
            <button type="button" class="director3d-add-shot" data-director3d-add-shot>新增机位</button>
        `;
    }

    function setShotPreview(panel, shotId){
        if(!panel) return;
        const stableId = String(shotId || '');
        panel.dataset.director3dPreviewShotId = stableId;
        panel.querySelectorAll('[data-director3d-shot-id]').forEach(row => {
            row.classList.toggle('preview', Boolean(stableId) && row.dataset.director3dShotId === stableId);
        });
    }

    function renderObjectPanel(panel, state, outlinerStore){
        if(!panel) return;
        const objects = Array.isArray(state.scene?.objects) ? state.scene.objects : [];
        const selected = new Set(state.selection?.objectIds || []);
        const groups = outlinerStore?.groups?.() || [];
        const groupedIds = new Set(groups.flatMap(group => group.objectIds || []));
        const active = objects.find(object => object.id === state.selection?.lastObjectId) || null;
        const activeColor = String(active?.metadata?.color || active?.material?.color || '#d8dbe0').toLowerCase();
        const objectRow = object => `
            <div class="director3d-object-row ${selected.has(object.id) ? 'active' : ''} ${object.visible === false ? 'hidden-object' : ''} ${object.locked ? 'locked' : ''}" data-director3d-object-id="${object.id}" draggable="true">
                <button type="button" class="director3d-object-name" data-director3d-select-object="${object.id}"><span>${escapeHtml(object.name || object.id)}</span></button>
                <span class="director3d-object-actions">
                    <i data-director3d-toggle-object-visible="${object.id}" title="${object.visible === false ? '显示对象' : '隐藏对象'}" aria-label="${object.visible === false ? '显示对象' : '隐藏对象'}">${iconSvg('eye', object.visible !== false)}</i>
                    <i data-director3d-toggle-object-lock="${object.id}" title="${object.locked ? '解锁对象' : '锁定对象'}" aria-label="${object.locked ? '解锁对象' : '锁定对象'}">${iconSvg('lock', object.locked)}</i>
                    <i data-director3d-delete-object="${object.id}" title="删除对象" aria-label="删除对象">${iconSvg('delete')}</i>
                </span>
            </div>
        `;
        const renderGroup = (group, isRoot = false, groupIndex = -1) => {
            const entries = isRoot
                ? objects.filter(object => !groupedIds.has(object.id))
                : (group.objectIds || []).map(id => objects.find(object => object.id === id)).filter(Boolean);
            return `
                <section class="director3d-outliner-group ${group.collapsed ? 'collapsed' : ''}" data-director3d-group-drop-id="${group.id || ''}">
                    <div class="director3d-outliner-group-header">${isRoot ? '' : `<span class="director3d-outliner-group-actions"><i data-director3d-rename-group="${group.id}" title="重命名分组" aria-label="重命名分组">${iconSvg('rename')}</i><i data-director3d-move-group="${group.id}" data-director3d-group-target-index="${groupIndex - 1}" title="上移分组" aria-label="上移分组">${iconSvg('up')}</i><i data-director3d-move-group="${group.id}" data-director3d-group-target-index="${groupIndex + 1}" title="下移分组" aria-label="下移分组">${iconSvg('down')}</i></span>`}
                        ${isRoot ? '<span class="director3d-outliner-group-label">未分组</span>' : `<button type="button" data-director3d-toggle-group="${group.id}" title="${group.collapsed ? '展开分组' : '收起分组'}" aria-label="${group.collapsed ? '展开分组' : '收起分组'}">${group.collapsed ? '+' : '-'}</button><span class="director3d-outliner-group-label">${escapeHtml(group.name)}</span><i data-director3d-delete-group="${group.id}" title="删除分组" aria-label="删除分组">${iconSvg('delete')}</i>`}
                    </div>
                    ${group.collapsed ? '' : `<div class="director3d-outliner-children">${entries.map(objectRow).join('') || '<div class="director3d-outliner-empty">拖入对象</div>'}</div>`}
                </section>
            `;
        };
        panel.innerHTML = `
            <div class="director3d-outliner-toolbar"><span>对象</span><button type="button" data-director3d-add-group title="新建分组" aria-label="新建分组">+</button></div>
            <div class="director3d-object-group">${groups.map((group, index) => renderGroup(group, false, index)).join('')}${renderGroup({id:'', collapsed:false}, true)}</div>
            ${active ? `<div class="director3d-object-color-bar" aria-label="对象颜色">
                ${OBJECT_COLORS.map(color => `<button type="button" class="${color === activeColor ? 'active' : ''}" data-director3d-object-color="${color}" data-director3d-object-id="${active.id}" title="设置对象颜色" aria-label="设置对象颜色" style="--director3d-swatch:${color}" ${active.locked ? 'disabled' : ''}></button>`).join('')}
            </div>${renderTransformPanel(active)}` : ''}
        `;
    }

    global.Director3DUIPanels = Object.freeze({
        OBJECT_COLORS,
        renderModelLibrary,
        renderShotPanel,
        setShotPreview,
        renderObjectPanel
    });
})(window);
