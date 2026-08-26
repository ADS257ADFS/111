/**
 * Smart Canvas — smart-group membership core (group/ungroup, drag-in, layout, queries).
 * Smart-group membership core + render/layout HTML.
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
        if(!c) throw new Error('[SmartCanvasSmartGroup] deps not registered');
        return c;
    }

    function nodes(){
        return S().getNodes();
    }

    function setNodes(v){
        S().setNodes(v);
    }

    function canvas(){
        return S().getCanvas();
    }

function groupSelectedNodes(){
    const ids = S().selectedIds.length ? S().selectedIds.slice() : (S().selectedId ? [S().selectedId] : []);
    const selected = ids.map(id => nodes().find(n => n.id === id)).filter(Boolean);
    if(selected.some(isSmartGroupNode)){
        S().toast('\u5df2\u6709\u5206\u7ec4\u4e0d\u80fd\u518d\u6b21\u6253\u7ec4');
        return false;
    }
    if(selected.length < 2){ S().toast(S().tr('smart.toastNeedGroup') || '请至少选择两个节点再打组'); return; }
    S().pushUndo();
    const rects = selected.map(n => S().nodeRect(n));
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    const group = {
        id:S().uid('group'),
        type:'smart-group',
        x:Math.round(minX - 18),
        y:Math.round(minY - 44),
        w:Math.max(340, Math.round(maxX - minX + 36)),
        h:Math.max(220, Math.round(maxY - minY + 72)),
        title:'智能分组',
        items:[],
        images:[],
        created_at:Date.now()
    };
    nodes().push(group);
    selected.forEach(node => addNodeToSmartGroup(group, node));
    S().selectedIds = [];
    S().selectedId = group.id;
    S().selectedImage = {nodeId:'', index:-1};
    S().showSmartGroupCapsule(group.id);
    S().render();
    S().scheduleSave();
    return group;
}

function ungroupNode(groupId){
    const group = nodes().find(n => n.id === groupId);
    if(!group) return false;
    if(isSmartGroupNode(group)){
        S().pushUndo();
        const memberIds = smartGroupMembers(group).map(m => m.id);
        const groupImages = (group.images || []).filter(img => img?.url);
        let created = [];
        if(groupImages.length){
            const layout = S().imageLayout(group.images || [], S().nodeScale(group), group);
            const pad = 16, gap = 8;
            const cell = Math.max(28, Math.round(layout.thumb || 96));
            const cols = Math.max(1, layout.cols || 1);
            created = groupImages.map((img, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const size = S().thumbDisplaySize(img, cell);
                const x = Math.round(Number(group.x || 0) + pad + col * (cell + gap) + Math.max(0, (cell - size.width) / 2));
                const y = Math.round(Number(group.y || 0) + pad + row * (cell + gap) + Math.max(0, (cell - size.height) / 2));
                const node = {id:S().uid('smart'), type:'smart-image', x, y, w:size.width, h:size.height, title:'Image', images:[S().stripImageGenerationMeta({...img})], scale:S().MEDIA_NODE_DEFAULT_SCALE, created_at:Date.now()};
                S().inheritNodeMetaFromImage(node);
                S().clearDetachedRunInputRefs(node);
                return node;
            });
        }
        setNodes(nodes().filter(n => n.id !== groupId));
        nodes().push(...created);
        if(canvas()) canvas().connections = (canvas().connections || []).filter(c => c.from !== groupId && c.to !== groupId);
        nodes().forEach(node => {
            if(Array.isArray(node.inputNodeIds)) node.inputNodeIds = node.inputNodeIds.filter(id => id !== groupId);
            if(isSmartGroupNode(node) && Array.isArray(node.items)) node.items = node.items.filter(id => id !== groupId);
        });
        S().selectedIds = [...created.map(n => n.id), ...memberIds].filter(id => nodes().some(n => n.id === id));
        S().selectedId = S().selectedIds.length === 1 ? S().selectedIds[0] : '';
        S().selectedImage = {nodeId:'', index:-1};
        S().render();
        S().scheduleSave();
        if(S().selectionMarqueeActive) S().positionSelectionGroupBox();
        return true;
    }
    if(!Array.isArray(group.images) || group.images.length < 2) return false;
    S().pushUndo();
    const layout = S().imageLayout(group.images || [], S().nodeScale(group), group);
    const pad = 16;
    const gap = 8;
    const cell = Math.max(28, Math.round(layout.thumb || 96));
    const created = (group.images || []).map((img, index) => {
        const col = index % Math.max(1, layout.cols || 1);
        const row = Math.floor(index / Math.max(1, layout.cols || 1));
        const size = S().thumbDisplaySize(img, cell);
        const x = Math.round(Number(group.x || 0) + pad + col * (cell + gap) + Math.max(0, (cell - size.width) / 2));
        const y = Math.round(Number(group.y || 0) + pad + row * (cell + gap) + Math.max(0, (cell - size.height) / 2));
        const node = {
            id:S().uid('smart'),
            type:'smart-image',
            x,
            y,
            w:size.width,
            h:size.height,
            title:'Image',
            images:[S().stripImageGenerationMeta({...img})],
            scale:S().MEDIA_NODE_DEFAULT_SCALE,
            created_at:Date.now()
        };
        S().inheritNodeMetaFromImage(node);
        return node;
    });
    setNodes(nodes().filter(n => n.id !== groupId));
    nodes().push(...created);
    if(canvas()) canvas().connections = (canvas().connections || []).filter(c => c.from !== groupId && c.to !== groupId);
    nodes().forEach(node => {
        if(Array.isArray(node.inputNodeIds)){
            node.inputNodeIds = node.inputNodeIds.filter(inputId => inputId !== groupId);
        }
    });
    S().selectedIds = created.map(node => node.id);
    S().selectedId = S().selectedIds.length === 1 ? S().selectedIds[0] : '';
    S().selectedImage = {nodeId:'', index:-1};
    S().render();
    S().scheduleSave();
    if(S().selectionMarqueeActive) S().positionSelectionGroupBox();
    return true;
}

function absorbImageNodeIntoSmartGroup(group, child){
 const add = (child.images || []).map(img => S().stripImageGenerationMeta({...img}));
 if(!add.length) return false;
 group.images = [...(group.images || []), ...add];
 // 清掉显式尺寸，让缩略图网格按图片数自动整理排列（“放入图片自动整理”）。
 delete group.w; delete group.h;
 rerouteSmartConnections(child.id, group.id);
 setNodes(nodes().filter(n => n.id !== child.id));
 nodes().forEach(g => { if(isSmartGroupNode(g) && Array.isArray(g.items)) g.items = g.items.filter(id => id !== child.id); });
 return true;
}


function addCreatedNodeToMenuGroup(node){
 const group = S().createMenuGroupId ? nodes().find(n => n.id === S().createMenuGroupId) : null;
 if(addNodeToSmartGroup(group, node)){
 // 通过分组小菜单新建的节点入组后自动整理（节点创建已压过 undo，这里不再重复）。
 arrangeSmartGroupMembers(group, {skipUndo:true});
 S().render();
 S().scheduleSave();
 }
}


function addDraggedNodeToSmartGroup(draggedNode, group){
 return addDraggedNodesToSmartGroup(draggedNode ? [draggedNode] : [], group);
}


function addDraggedNodesToSmartGroup(draggedNodes, group){
 if(!group || !isSmartGroupNode(group)) return false;
 const list = (draggedNodes || []).filter(n => n && n.id !== group.id);
 if(!list.length) return false;
 let added = false;
 list.forEach(n => {
 if(addNodeToSmartGroup(group, n)) added = true;
 });
 if(!added) return false;
 // 提示词/循环成员入组后自动整理成网格（图片已收进卡片网格，自动平铺）。
 arrangeSmartGroupMembers(group, {skipUndo:true});
 S().selectedIds = [];
 // 图片被吸收进分组（原节点已删除），统一选中目标分组；仅当单个提示词/循环节点拖入时保持选中它。
 const survivingSingle = list.length === 1 && nodes().some(n => n.id === list[0].id) ? list[0].id : '';
 S().selectedId = survivingSingle || group.id;
 S().selectedImage = {nodeId:'', index:-1};
 return true;
}


function addNodeToSmartGroup(group, child){
 if(!isSmartGroupNode(group) || !child || child.id === group.id) return false;
 const items = Array.isArray(group.items) ? group.items.slice() : [];
 const zoom = smartGroupZoom(group);
 if(isSmartGroupNode(child)){
 // 把一个分组拖进另一个分组：吸收它的图片到本组网格，把它的非图片成员并入本组，然后删除被拖分组本体。
 const mergedImages = (child.images || []).map(img => S().stripImageGenerationMeta({...img}));
 group.images = [...(group.images || []), ...mergedImages];
 if(mergedImages.length){ delete group.w; delete group.h; }
 const childMemberIds = smartGroupMembers(child)
 .map(m => m.id)
 .filter(id => id !== group.id && !items.includes(id));
 group.items = [...items, ...childMemberIds];
 childMemberIds.forEach(id => {
 const m = nodes().find(n => n.id === id);
 if(m) scaleSmartGroupMemberToZoom(group, m, zoom);
 });
 rerouteSmartConnections(child.id, group.id);
 setNodes(nodes().filter(n => n.id !== child.id));
 nodes().forEach(g => { if(isSmartGroupNode(g) && Array.isArray(g.items)) g.items = g.items.filter(id => id !== child.id); });
 return true;
 }
 // 图片节点：作为成员保留独立节点与连线，仅归组便于整体移动管理。
 if(S().isSmartImageNode(child)){
 if(items.includes(child.id)) return false;
 group.items = [...items, child.id];
 scaleSmartGroupMemberToZoom(group, child, zoom);
 return true;
 }
 // 提示词 / 循环：仍作为画布上的成员节点。
 if(items.includes(child.id)) return false;
 group.items = [...items, child.id];
 scaleSmartGroupMemberToZoom(group, child, zoom);
 return true;
}


function arrangeSmartGroupMembers(group, options={}){
 if(!isSmartGroupNode(group)) return false;
 const hasAbsorbedThumbs = (group.images || []).some(img => S().imageForDisplay(img)?.url);
 if(hasAbsorbedThumbs){
 const compactMembers = smartGroupCompactMembers(group);
 if(!options.skipUndo) S().pushUndo();
 const layout = smartGroupThumbLayout(group);
 if(!layout) return true;
 const refs = layout.refs || [];
 const thumb = Math.max(28, Math.round(Number(layout.thumb) || 96));
 const gap = S().SMART_GROUP_THUMB_GAP;
 const cols = Math.max(1, Number(layout.cols) || 1);
 const gridW = cols * thumb + Math.max(0, cols - 1) * gap;
 const contentW = Math.max(0, Math.round(Number(layout.width) || S().SMART_GROUP_DEFAULT_WIDTH) - S().SMART_GROUP_CARD_PADDING * 2);
 const originX = (Number(group.x) || 0) + S().SMART_GROUP_CARD_PADDING + Math.max(0, Math.round((contentW - gridW) / 2));
 const originY = (Number(group.y) || 0) + S().SMART_GROUP_CARD_PADDING;
 group.w = Math.max(S().SMART_GROUP_MIN_WIDTH, Math.round(Number(layout.width) || S().SMART_GROUP_DEFAULT_WIDTH));
 group.h = Math.max(S().SMART_GROUP_MIN_HEIGHT, Math.round(Number(layout.height) || S().SMART_GROUP_DEFAULT_HEIGHT));
 const ordered = compactMembers.slice().sort((a, b) => {
 const ra = S().nodeRect(a), rb = S().nodeRect(b);
 const dy = (Number(ra.y) || 0) - (Number(rb.y) || 0);
 if(Math.abs(dy) > 24) return dy;
 return (Number(ra.x) || 0) - (Number(rb.x) || 0);
 });
 ordered.forEach((member, memberIndex) => {
 const index = refs.length + memberIndex;
 const col = index % cols;
 const row = Math.floor(index / cols);
 member.x = Math.round(originX + col * (thumb + gap));
 member.y = Math.round(originY + row * (thumb + gap));
 member.w = thumb;
 member.h = thumb;
 member.scale = 1;
 });
 if(group._memberZoom !== undefined) group._memberZoom = 1;
 if(options.syncDom) syncSmartGroupMemberElements(group);
 return true;
 }
 const members = smartGroupMembers(group);
 if(!members.length) return false;
 if(!options.skipUndo) S().pushUndo();
 const ordered = members.slice().sort((a, b) => {
 const ra = S().nodeRect(a), rb = S().nodeRect(b);
 const dy = (Number(ra.y) || 0) - (Number(rb.y) || 0);
 if(Math.abs(dy) > 24) return dy;
 return (Number(ra.x) || 0) - (Number(rb.x) || 0);
 });
 // 归一化图片成员尺寸：清掉入组缩放写入的 w/h，回到自然尺寸。否则反复拖出/拖入会越缩越小，
 // 且“整理”无法恢复——这是用户反馈的“拖出再拖入图片变小、整理也救不回来”的根因。
 ordered.forEach(node => {
 if(S().isSmartImageNode(node)){
 delete node.w;
 delete node.h;
 }
 });
 const sizes = ordered.map(node => {
 const r = S().nodeRect(node);
 return {node, w:Math.max(40, Number(r.width) || 120), h:Math.max(40, Number(r.height) || 120)};
 });
 const count = sizes.length;
 const pad = S().SMART_GROUP_ARRANGE_PADDING;
 const gap = S().SMART_GROUP_ARRANGE_GAP;
 const headerH = S().SMART_GROUP_ARRANGE_HEADER;
 const cols = Math.max(1, Math.min(count, Math.round(Math.sqrt(count)) || 1));
 const rows = Math.ceil(count / cols);
 const colW = new Array(cols).fill(0);
 const rowH = new Array(rows).fill(0);
 sizes.forEach((s, i) => {
 const c = i % cols, r = Math.floor(i / cols);
 colW[c] = Math.max(colW[c], s.w);
 rowH[r] = Math.max(rowH[r], s.h);
 });
 const colX = [];
 let accX = 0;
 for(let c = 0; c < cols; c++){ colX[c] = accX; accX += colW[c] + gap; }
 const rowY = [];
 let accY = 0;
 for(let r = 0; r < rows; r++){ rowY[r] = accY; accY += rowH[r] + gap; }
 const originX = (Number(group.x) || 0) + pad;
 const originY = (Number(group.y) || 0) + headerH + pad;
 sizes.forEach((s, i) => {
 const c = i % cols, r = Math.floor(i / cols);
 s.node.x = Math.round(originX + colX[c] + (colW[c] - s.w) / 2);
 s.node.y = Math.round(originY + rowY[r] + (rowH[r] - s.h) / 2);
 });
 const totalW = colW.reduce((a, b) => a + b, 0) + gap * (cols - 1) + pad * 2;
 const totalH = rowH.reduce((a, b) => a + b, 0) + gap * (rows - 1) + pad * 2 + headerH;
 group.w = Math.max(S().SMART_GROUP_MIN_WIDTH, Math.round(totalW));
 group.h = Math.max(S().SMART_GROUP_MIN_HEIGHT, Math.round(totalH));
 // 成员已回到自然尺寸，分组缩放基准随之归零，避免后续再缩放时跳变。
 if(group._memberZoom !== undefined) group._memberZoom = 1;
 return true;
}


function isSmartGroupCompactMember(node){
 return Boolean(node && (node.type === 'smart-prompt' || node.type === 'smart-loop') && smartGroupContainingNode(node.id));
}


function isSmartGroupNode(node){
 return Boolean(node && node.type === 'smart-group');
}


function migrateSmartGroupImageMembers(){
 let changed = false;
 nodes().filter(isSmartGroupNode).forEach(group => {
 const imageMemberIds = (Array.isArray(group.items) ? group.items : [])
 .map(id => nodes().find(n => n.id === id))
 .filter(m => m && S().isSmartImageNode(m) && (m.images || []).some(img => img?.url))
 .map(m => m.id);
 imageMemberIds.forEach(id => {
 const member = nodes().find(n => n.id === id);
 if(member && absorbImageNodeIntoSmartGroup(group, member)) changed = true;
 });
 });
 return changed;
}


function rerouteSmartConnections(fromId, toId){
 if(canvas()){
 canvas().connections = (canvas().connections || []).map(c => {
 let conn = c;
 if(c.from === fromId) conn = {...conn, from:toId};
 if(c.to === fromId) conn = {...conn, to:toId};
 return conn;
 }).filter((c, i, arr) => c.from !== c.to && arr.findIndex(x => x.from === c.from && x.to === c.to && (x.kind || 'flow') === (c.kind || 'flow')) === i);
 }
 nodes().forEach(n => {
 if(Array.isArray(n.inputNodeIds)) n.inputNodeIds = Array.from(new Set(n.inputNodeIds.map(id => id === fromId ? toId : id).filter(id => id !== n.id)));
 });
}



function fitSmartGroupFrameToMembers(group){
    if(!isSmartGroupNode(group)) return false;
    const members = smartGroupMembers(group);
    if(!members.length) return false;
    const rects = members.map(n => S().nodeRect(n));
    const pad = S().SMART_GROUP_ARRANGE_PADDING;
    const headerH = S().SMART_GROUP_ARRANGE_HEADER;
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    group.x = Math.round(minX - pad);
    group.y = Math.round(minY - headerH - pad);
    group.w = Math.max(S().SMART_GROUP_MIN_WIDTH, Math.round(maxX - minX + pad * 2));
    group.h = Math.max(S().SMART_GROUP_MIN_HEIGHT, Math.round(maxY - minY + pad * 2 + headerH));
    return true;
}


function cleanupEmptySmartGroups(){
    const removeIds = nodes().filter(group => {
        if(!isSmartGroupNode(group)) return false;
        if(smartGroupMembers(group).length) return false;
        return !(group.images || []).some(img => img?.url);
    }).map(group => group.id);
    if(!removeIds.length) return false;
    removeIds.forEach(groupId => {
        setNodes(nodes().filter(n => n.id !== groupId));
        if(canvas()) canvas().connections = (canvas().connections || []).filter(c => c.from !== groupId && c.to !== groupId);
        nodes().forEach(node => {
            if(Array.isArray(node.inputNodeIds)) node.inputNodeIds = node.inputNodeIds.filter(id => id !== groupId);
            if(isSmartGroupNode(node) && Array.isArray(node.items)) node.items = node.items.filter(id => id !== groupId);
        });
        if(S().selectedId === groupId) S().selectedId = '';
        S().selectedIds = S().selectedIds.filter(id => id !== groupId);
    });
    if(S().selectionMarqueeActive){
        if(!S().selectedNodeIds().length) S().hideSelectionGroupBox();
        else S().positionSelectionGroupBox();
    }
    return true;
}


function pruneSmartGroupMembershipsForNode(node){
 if(!node || !node.id) return false;
 // 节点拖出分组：从所有分组移除自己（保持当前尺寸，不自动放大）。
 // 分组合并已改为“释放被拖分组、只并入其成员”，所以这里只需处理单个节点的退组。
 let changed = false;
 nodes().forEach(group => {
 if(!isSmartGroupNode(group) || !Array.isArray(group.items) || !group.items.includes(node.id)) return;
 group.items = group.items.filter(id => id !== node.id);
 changed = true;
 });
 if(changed) cleanupEmptySmartGroups();
 return changed;
}


function scaleSmartGroupMemberToZoom(group, member, zoom){
 if(!member || !(zoom > 0) || zoom === 1) return;
 const r = S().nodeRect(member);
 member.w = Math.max(40, Math.round((Number(r.width) || 0) * zoom));
 member.h = Math.max(40, Math.round((Number(r.height) || 0) * zoom));
 if(S().isSmartImageNode(member)) member.scale = 1;
}


function smartGroupCompactMembers(node){
 return smartGroupMembers(node).filter(member => member?.type === 'smart-prompt' || member?.type === 'smart-loop');
}


function smartGroupContainingNode(nodeId){
 if(!nodeId) return null;
 return nodes().find(n => isSmartGroupNode(n) && Array.isArray(n.items) && n.items.includes(nodeId)) || null;
}


function smartGroupHitBounds(group){
    if(!isSmartGroupNode(group)) return null;
    const rects = [S().nodeRect(group)];
    smartGroupMembers(group).forEach(member => {
        const rect = S().nodeRect(member);
        if(rect) rects.push(rect);
    });
    if(!rects.length) return null;
    const pad = 10 / Math.max(S().viewport.scale, 0.06);
    return {
        minX: Math.min(...rects.map(r => r.x)) - pad,
        minY: Math.min(...rects.map(r => r.y)) - pad,
        maxX: Math.max(...rects.map(r => r.x + r.width)) + pad,
        maxY: Math.max(...rects.map(r => r.y + r.height)) + pad
    };
}


function smartGroupAtWorldPoint(wx, wy){
    const px = Number(wx);
    const py = Number(wy);
    if(!Number.isFinite(px) || !Number.isFinite(py)) return null;
    const groups = nodes().filter(isSmartGroupNode).slice().sort((a, b) => nodes().indexOf(b) - nodes().indexOf(a));
    for(const group of groups){
        const bounds = smartGroupHitBounds(group);
        if(!bounds) continue;
        if(px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY) return group;
    }
    return null;
}


function smartGroupMembers(node){
 if(!isSmartGroupNode(node)) return [];
 const ids = Array.isArray(node.items) ? node.items : [];
 const seen = new Set([node.id]);
 return ids.map(id => nodes().find(n => n.id === id)).filter(member => {
 if(!member || seen.has(member.id) || isSmartGroupNode(member)) return false;
 seen.add(member.id);
 return true;
 });
}


function smartGroupScopeId(nodeId){
 const group = smartGroupContainingNode(nodeId);
 if(group) return group.id;
 const node = nodes().find(n => n.id === nodeId);
 return isSmartGroupNode(node) ? node.id : '';
}


function smartGroupTargetForDraggedNode(draggedNode){
 // 允许把一个分组拖进另一个分组（拖来的分组的成员会作为输入并入目标分组）。自身/被拖分组及其成员已在 excluded 中排除。
 if(!draggedNode) return null;
 const parentGroup = smartGroupContainingNode(draggedNode.id);
 const r = S().nodeRect(draggedNode);
 const excluded = new Set([draggedNode.id, ...(S().dragState?.groupIds || [])]);
 if(parentGroup) excluded.add(parentGroup.id);
 if(S().dragState?.originSmartGroupId) excluded.add(S().dragState.originSmartGroupId);
 const cx = r.x + r.width / 2;
 const cy = r.y + r.height / 2;
 const groups = nodes()
 .filter(node => isSmartGroupNode(node) && !excluded.has(node.id))
 .map(group => ({group, rect:S().nodeRect(group)}))
 .filter(item => cx >= item.rect.x && cx <= item.rect.x + item.rect.width && cy >= item.rect.y && cy <= item.rect.y + item.rect.height);
 if(!groups.length) return null;
 groups.sort((a, b) => (nodes().indexOf(b.group) - nodes().indexOf(a.group)));
 return groups[0].group;
}


function smartGroupZoom(group){
 const z = Number(group?._memberZoom);
 return Number.isFinite(z) && z > 0 ? z : 1;
}


function syncSmartGroupMemberElements(group){
 if(!isSmartGroupNode(group)) return;
 smartGroupCompactMembers(group).forEach(member => {
 const el = S().world.querySelector(`.image-node[data-id="${CSS.escape(member.id)}"]`);
 if(el){
 el.style.left = `${member.x || 0}px`;
 el.style.top = `${member.y || 0}px`;
 }
 S().updateNodeElementDuringResize(member);
 });
}


function smartGroupBodyHtml(node){
    const groupThumbLayout = smartGroupThumbLayout(node);
    const allMediaRefs = groupThumbLayout?.refs || smartGroupImageRefs(node);
    const refThumbs = allMediaRefs.filter(ref => ref.nodeId === node.id);
    const members = smartGroupMembers(node);
    if(refThumbs.length){
        const totalThumbs = Math.max(1, Number(groupThumbLayout?.rows || 1) * Number(groupThumbLayout?.cols || 1));
        if(totalThumbs === 1 && refThumbs.length === 1){
            const ref = refThumbs[0];
            const innerW = Math.max(24, Number(groupThumbLayout.innerW || groupThumbLayout.width || S().SMART_GROUP_DEFAULT_WIDTH));
            const innerH = Math.max(24, Number(groupThumbLayout.innerH || groupThumbLayout.height || S().SMART_GROUP_DEFAULT_HEIGHT));
            const canDelete = ref.nodeId === node.id;
            return `<div class="smart-group-card has-thumbs">
                <div class="image-wrap smart-group-single-thumb ${S().selectedImage.nodeId === ref.nodeId && Number(S().selectedImage.index) === Number(ref.index) ? 'image-selected' : ''}" data-ref-node-id="${S().escapeAttr(ref.nodeId)}" data-ref-image-index="${ref.index}" data-image-index="${ref.index}" data-media-signature="${S().escapeAttr(`${S().mediaKindForItem(ref.item)}:${ref.item?.url || ''}`)}" style="--node-img-w:${innerW}px;--node-img-h:${innerH}px">${S().singleMediaHtml(ref.item, innerW, innerH)}${S().imageResolutionBadgeHtml(ref.item)}${canDelete ? `<button class="mini-x image-delete" type="button" data-image-index="${ref.index}" title="${S().escapeHtml(S().tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button>` : ''}</div>
            </div>`;
        }
        const groupMaxVisibleRows = (groupThumbLayout.compactMembers || []).length ? Number(groupThumbLayout.rows || 1) : S().SMART_GROUP_MAX_VISIBLE_ROWS;
        const visibleRows = Math.max(1, Math.min(groupMaxVisibleRows, Number(groupThumbLayout.visibleRows || groupThumbLayout.rows || 1)));
        const maxHeight = Math.max(44, visibleRows * Number(groupThumbLayout.thumb || 96) + Math.max(0, visibleRows - 1) * S().SMART_GROUP_THUMB_GAP);
        return `<div class="smart-group-card has-thumbs">
            <div class="thumb-grid smart-group-thumb-grid" data-thumb-scroll="1" style="--thumb-cols:${groupThumbLayout.cols}; --thumb-size:${groupThumbLayout.thumb}px; --thumb-max-height:${maxHeight}px">${refThumbs.map(ref => {
                const canDelete = ref.nodeId === node.id;
                return `<div class="thumb-item ${S().selectedImage.nodeId === ref.nodeId && Number(S().selectedImage.index) === Number(ref.index) ? 'image-selected' : ''}" data-ref-node-id="${S().escapeAttr(ref.nodeId)}" data-ref-image-index="${ref.index}" data-image-index="${ref.index}" data-media-signature="${S().escapeAttr(`${S().mediaKindForItem(ref.item)}:${ref.item?.url || ''}`)}">${S().thumbMediaHtml(ref.item)}${S().imageResolutionBadgeHtml(ref.item)}${canDelete ? `<button class="mini-x image-delete" type="button" data-image-index="${ref.index}" title="${S().escapeHtml(S().tr('smart.deleteImage'))}"><i data-lucide="trash-2"></i></button>` : ''}</div>`;
            }).join('')}</div>
        </div>`;
    }
    return `<div class="smart-group-card">
        ${members.length ? '' : `<div class="smart-group-empty"><i data-lucide="plus"></i><span>拖入图片自动收进分组</span></div>`}
    </div>`;
}

function smartGroupImageGridLayout(node){
 const images = (node?.images || []).filter(img => img?.url);
 const count = images.length;
 const s = S().mediaNodeDefaultScale(node);
 const outerPad = S().SMART_GROUP_CARD_PADDING * 2;
 if(count === 1){
 const single = S().singleImageLayout(images[0], node, s);
 const explicitW = Number(node?.w), explicitH = Number(node?.h);
 const hasExplicit = Number.isFinite(explicitW) && explicitW > 24 && Number.isFinite(explicitH) && explicitH > 24;
 return hasExplicit ? single : {...single, width:single.width + outerPad, height:single.height + outerPad};
 }
 const baseThumb = Math.round(S().MEDIA_GROUP_THUMB_BASE * s);
 const cell = baseThumb + 8;
 const PAD = outerPad;
 const explicitW = Number(node?.w);
 const explicitH = Number(node?.h);
 const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
 const rows = Math.ceil(count / cols);
 const visibleRows = Math.min(S().SMART_GROUP_MAX_VISIBLE_ROWS, rows);
 if(Number.isFinite(explicitW) && explicitW > 40 && Number.isFinite(explicitH) && explicitH > 40){
 const fitted = S().groupImageGridLayout(count, explicitW, explicitH, 100000, PAD, 8, S().SMART_GROUP_MAX_VISIBLE_ROWS);
 return {cols:fitted.cols, rows:fitted.rows, visibleRows:fitted.visibleRows, width:Math.round(explicitW), height:fitted.visibleRows * (fitted.thumb + 8) - 8 + PAD, thumb:fitted.thumb};
 }
 const width = Math.max(Math.round(226 * s), cols * cell + PAD);
 const height = visibleRows * cell - 8 + PAD;
 return {cols, rows, visibleRows, width, height, thumb:baseThumb};
}

function smartGroupImageRefs(group){
 if(!isSmartGroupNode(group)) return [];
 const refs = [];
 (group.images || []).forEach((img, index) => {
 const item = S().imageForDisplay(img);
 if(item?.url) refs.push({nodeId:group.id, index, source:img, item});
 });
 const members = smartGroupMembers(group)
 .filter(m => S().isSmartImageNode(m))
 .slice()
 .sort((a, b) => {
 const ra = S().nodeRect(a), rb = S().nodeRect(b);
 const dy = (Number(ra.y) || 0) - (Number(rb.y) || 0);
 if(Math.abs(dy) > 24) return dy;
 return (Number(ra.x) || 0) - (Number(rb.x) || 0);
 });
 members.forEach(node => {
 (node.images || []).forEach((img, index) => {
 const item = S().imageForDisplay(img);
 if(item?.url) refs.push({nodeId:node.id, index, source:img, item});
 });
 });
 return refs;
}

function smartGroupLayoutSize(node){
 const explicitW = Number(node?.w);
 const explicitH = Number(node?.h);
 const width = Number.isFinite(explicitW) && explicitW >= S().SMART_GROUP_MIN_WIDTH ? explicitW : S().SMART_GROUP_DEFAULT_WIDTH;
 const height = !Number.isFinite(explicitH) || explicitH === S().SMART_GROUP_LEGACY_HEIGHT
 ? S().SMART_GROUP_DEFAULT_HEIGHT
 : Math.max(explicitH, S().SMART_GROUP_MIN_HEIGHT);
 return {
 width:Math.round(width),
 height:Math.round(height)
 };
}

function smartGroupThumbLayout(node){
 const refs = smartGroupImageRefs(node).filter(ref => ref.item?.url);
 if(!refs.length) return null;
 const compactMembers = smartGroupCompactMembers(node);
 const count = refs.length + compactMembers.length;
 const items = refs.map(ref => ref.item);
 const explicitW = Number(node?.w);
 const explicitH = Number(node?.h);
 const hasExplicit = Number.isFinite(explicitW) && explicitW >= S().SMART_GROUP_MIN_WIDTH
 && Number.isFinite(explicitH) && explicitH >= S().SMART_GROUP_MIN_HEIGHT;
 const scale = S().mediaNodeDefaultScale({type:'smart-image', images:items, scale:node?.scale});
 const outerPad = S().SMART_GROUP_CARD_PADDING * 2;
 if(count === 1){
 if(hasExplicit){
 return {
 refs,
 compactMembers,
 cols:1,
 rows:1,
 visibleRows:1,
 width:Math.round(explicitW),
 height:Math.round(explicitH),
 thumb:Math.round(96 * scale),
 single:true,
 innerW:Math.max(24, Math.round(explicitW - outerPad)),
 innerH:Math.max(24, Math.round(explicitH - outerPad))
 };
 }
 const single = S().singleImageLayout(refs[0].item, {}, scale);
 return {
 refs,
 compactMembers,
 ...single,
 width:Math.max(S().SMART_GROUP_MIN_WIDTH, Math.round(single.width + outerPad)),
 height:Math.max(S().SMART_GROUP_MIN_HEIGHT, Math.round(single.height + outerPad)),
 innerW:single.width,
 innerH:single.height
 };
 }
 const gap = S().SMART_GROUP_THUMB_GAP;
 const maxVisibleRows = compactMembers.length ? count : S().SMART_GROUP_MAX_VISIBLE_ROWS;
 if(hasExplicit){
 const fitted = S().groupImageGridLayout(count, Math.max(72, explicitW - outerPad), Math.max(56, explicitH - outerPad), 100000, 0, gap, maxVisibleRows);
 return {...fitted, refs, compactMembers, width:Math.round(explicitW), height:Math.round(explicitH)};
 }
 const thumb = Math.round(S().MEDIA_GROUP_THUMB_BASE * scale);
 const cell = thumb + gap;
 const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(count))));
 const rows = Math.ceil(count / cols);
 const visibleRows = Math.min(maxVisibleRows, rows);
 const gridW = cols * thumb + (cols - 1) * gap;
 const gridH = visibleRows * cell - gap;
 return {
 refs,
 compactMembers,
 cols,
 rows,
 visibleRows,
 thumb,
 width:Math.max(S().SMART_GROUP_MIN_WIDTH, Math.round(gridW + outerPad)),
 height:Math.max(S().SMART_GROUP_MIN_HEIGHT, Math.round(gridH + outerPad))
 };
}

function smartGroupToolbarHtml(node){
    return '';
}

function mergeImageNodesIntoGroup(sourceId, targetId){
    const source = nodes().find(n => n.id === sourceId);
    const target = nodes().find(n => n.id === targetId);
    if(!source || !target || source.id === target.id) return false;
    if(!(source.images || []).length || !(target.images || []).length) return false;
    const sourceImages = (source.images || []).map(img => S().stripImageGenerationMeta({...img}));
    target.images = [...(target.images || []).map(img => S().stripImageGenerationMeta(img)), ...sourceImages];
    target.title = 'Group';
    if(!Number.isFinite(Number(target.scale)) || Number(target.scale) === S().MEDIA_NODE_DEFAULT_SCALE) target.scale = S().MEDIA_GROUP_DEFAULT_SCALE;
    delete target.w;
    delete target.h;
    canvas().connections = (canvas().connections || []).map(c => {
        if(c.from === source.id) return {...c, from:target.id};
        if(c.to === source.id) return {...c, to:target.id};
        return c;
    }).filter((c, index, arr) => c.from !== c.to && arr.findIndex(x => x.from === c.from && x.to === c.to && (x.kind || 'flow') === (c.kind || 'flow')) === index);
    nodes().forEach(node => {
        if(Array.isArray(node.inputNodeIds)){
            node.inputNodeIds = Array.from(new Set(node.inputNodeIds.map(id => id === source.id ? target.id : id).filter(id => id !== node.id)));
        }
    });
    setNodes(nodes().filter(n => n.id !== source.id));
    S().selectedIds = [];
    S().selectedId = target.id;
    S().selectedImage = {nodeId:'', index:-1};
    return true;
}

    function createSmartGroupNode(x, y, options={}){
 if(!options.skipUndo) S().pushUndo();
 const node = {id:S().uid('group'), type:'smart-group', x, y, w:S().SMART_GROUP_DEFAULT_WIDTH, h:S().SMART_GROUP_DEFAULT_HEIGHT, title:'智能分组', items:[], created_at:Date.now()};
 nodes().push(node);
 if(options.select !== false) S().selectedId = node.id;
 S().render();
 S().scheduleSave();
 return node;
}
    const api = Object.freeze({
        createSmartGroupNode,
        registerDeps,
        groupSelectedNodes,
        ungroupNode,
        absorbImageNodeIntoSmartGroup,
        addCreatedNodeToMenuGroup,
        addDraggedNodeToSmartGroup,
        addDraggedNodesToSmartGroup,
        addNodeToSmartGroup,
        arrangeSmartGroupMembers,
        isSmartGroupCompactMember,
        isSmartGroupNode,
        migrateSmartGroupImageMembers,
        rerouteSmartConnections,
        fitSmartGroupFrameToMembers,
        cleanupEmptySmartGroups,
        pruneSmartGroupMembershipsForNode,
        scaleSmartGroupMemberToZoom,
        smartGroupCompactMembers,
        smartGroupContainingNode,
        smartGroupHitBounds,
        smartGroupAtWorldPoint,
        smartGroupMembers,
        smartGroupScopeId,
        smartGroupTargetForDraggedNode,
        smartGroupZoom,
        syncSmartGroupMemberElements,
        smartGroupBodyHtml,
        smartGroupImageGridLayout,
        smartGroupImageRefs,
        smartGroupLayoutSize,
        smartGroupThumbLayout,
        smartGroupToolbarHtml,
        mergeImageNodesIntoGroup,
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('smartGroup', api);
    }
    global.SmartCanvasSmartGroup = api;
})(window);
