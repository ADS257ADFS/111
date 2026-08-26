/**
 * Studio Coding Agent — stream client (creation page only).
 */
(function(global){
'use strict';

const Core = global.StudioChatCore;

async function readErrorDetail(res, fallback){
    const statusHint = `HTTP ${res.status}`;
    try {
        const text = await res.text();
        const trimmed = String(text || '').trim();
        if(trimmed){
            try {
                const data = JSON.parse(trimmed);
                return data.detail || data.message || trimmed;
            } catch(e) {
                return trimmed;
            }
        }
    } catch(e) {}
    return fallback || statusHint;
}

function toolLabel(name, args){
    const path = args?.path || args?.cwd || args?.pattern || '';
    if(name === 'read_file') return `读取 ${path || '文件'}`;
    if(name === 'write_file') return `写入 ${path || '文件'}`;
    if(name === 'list_directory') return `列出 ${path || '目录'}`;
    if(name === 'search_files') return `搜索 ${args?.pattern || ''}`.trim();
    if(name === 'run_command') return `运行 ${String(args?.command || '').slice(0, 80)}`;
    if(name === 'search_codebase') return `索引搜索 ${args?.query || ''}`.trim();
    if(name === 'find_symbol') return `查找符号 ${args?.name || ''}`.trim();
    if(name === 'project_tree') return '项目结构';
    if(name === 'lsp_definition') return `LSP 定义 ${args?.path || ''}${args?.symbol ? `:${args.symbol}` : ''}`.trim();
    if(name === 'lsp_references') return `LSP 引用 ${args?.path || ''}`.trim();
    if(name === 'lsp_hover') return `LSP 类型 ${args?.path || ''}`.trim();
    if(name === 'analyze_disk') return `分析磁盘 ${args?.drive || 'C:'}`;
    if(name === 'generate_image') return `生成图片 ${String(args?.prompt || '').slice(0, 60)}`;
    return name || 'tool';
}

async function submitApproval(requestHeaders, approvalId, approved){
    await fetch('/api/studio-coding/approve', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ approval_id: approvalId, approved: !!approved }),
    });
}

function appendImageToBubble(assistantBubble, url){
    if(!assistantBubble?.bubble || !url) return;
    let img = assistantBubble.bubble.querySelector('img.generated');
    if(!img){
        img = document.createElement('img');
        img.className = 'generated';
        img.alt = '生成的图片';
        img.onclick = () => global.openImagePreview?.(url);
        assistantBubble.bubble.appendChild(img);
    }
    img.src = url;
}

function setBubbleActivity(assistantBubble, mode, line){
    const bubble = assistantBubble?.bubble;
    if(!bubble) return;
    bubble.classList.toggle('tool-active', mode === 'tool');
    bubble.classList.toggle('awaiting-approval', mode === 'approval');
    bubble.classList.toggle('has-reply', mode === 'reply' || Boolean(assistantBubble?.text?.textContent?.trim()));
    const el = bubble.querySelector('.coding-thinking') || (() => {
        const node = document.createElement('div');
        node.className = 'coding-thinking';
        if(assistantBubble?.text?.parentElement === bubble){
            bubble.insertBefore(node, assistantBubble.text);
        } else {
            bubble.prepend(node);
        }
        return node;
    })();
    el.classList.toggle('is-active', mode === 'tool' || mode === 'thinking' || mode === 'approval');
    if(line) el.textContent = line;
}

function startActivityTimer(assistantBubble, getLastActivity){
    return setInterval(() => {
        if(!assistantBubble?.bubble?.classList.contains('streaming')) return;
        const sec = Math.floor((Date.now() - getLastActivity()) / 1000);
        if(sec < 4) return;
        const bubble = assistantBubble.bubble;
        if(bubble.classList.contains('awaiting-approval')) return;
        const el = bubble.querySelector('.coding-thinking');
        if(!el) return;
        const base = el.dataset.baseLine || el.textContent.replace(/\s*·\s*\d+秒.*$/, '');
        el.dataset.baseLine = base;
        el.textContent = `${base} · ${sec}秒`;
        el.classList.add('is-active');
    }, 1000);
}

async function consumeCodingStream(res, assistantBubble, callbacks){
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let lastActivity = Date.now();
    const requestHeaders = callbacks?.requestHeaders;
    const touch = () => { lastActivity = Date.now(); };
    setBubbleActivity(assistantBubble, 'thinking', '连接中…');
    const activityTimer = startActivityTimer(assistantBubble, () => lastActivity);

    try {
    while(true){
        const { value, done } = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for(const eventText of events){
            const line = eventText.split('\n').find(item => item.startsWith('data:'));
            if(!line) continue;
            let event;
            try {
                event = JSON.parse(line.slice(5).trim());
            } catch(e) {
                continue;
            }
            touch();
            if(event.type === 'meta'){
                callbacks?.onMeta?.(event.conversation, event.permission_level);
                continue;
            }
            if(event.type === 'status'){
                setBubbleActivity(assistantBubble, 'thinking', event.text || event.route || '处理中…');
                continue;
            }
            if(event.type === 'approval_required'){
                setBubbleActivity(assistantBubble, 'approval', `等待批准：${event.summary || '操作'}`);
                const approved = await (callbacks?.onApprovalRequired?.(event) ?? Promise.resolve(false));
                await submitApproval(requestHeaders, event.approval_id, approved);
                setBubbleActivity(assistantBubble, approved ? 'tool' : 'thinking', approved ? '已批准，继续执行…' : '已拒绝');
                continue;
            }
            if(event.type === 'approval_resolved'){
                callbacks?.onApprovalResolved?.(event);
                continue;
            }
            if(event.type === 'tool_start'){
                const note = toolLabel(event.tool, event.args || {});
                setBubbleActivity(assistantBubble, 'tool', `正在执行：${note}`);
                if(assistantBubble?.text && !fullText){
                    assistantBubble.text.textContent = `${note}…`;
                }
                callbacks?.onToolStart?.(event);
                continue;
            }
            if(event.type === 'tool_end'){
                const preview = String(event.result || '').split('\n')[0].slice(0, 80);
                setBubbleActivity(assistantBubble, 'thinking', preview ? `完成 · ${preview}` : '步骤完成，继续…');
                callbacks?.onToolEnd?.(event);
                continue;
            }
            if(event.type === 'image'){
                appendImageToBubble(assistantBubble, event.url);
                setBubbleActivity(assistantBubble, 'reply', '图片已生成');
                callbacks?.onImage?.(event);
                continue;
            }
            if(event.type === 'delta'){
                fullText += event.delta || '';
                if(assistantBubble?.text){
                    assistantBubble.text.textContent = fullText;
                }
                setBubbleActivity(assistantBubble, 'reply', '生成回复中…');
                callbacks?.onDelta?.(event.delta || '');
                continue;
            }
            if(event.type === 'error'){
                throw new Error(event.detail || 'Coding Agent 请求失败');
            }
            if(event.type === 'done'){
                assistantBubble?.bubble?.classList?.remove('streaming', 'tool-active', 'awaiting-approval');
                if(event.message?.image_url){
                    appendImageToBubble(assistantBubble, event.message.image_url);
                }
                const doneEl = assistantBubble?.bubble?.querySelector('.coding-thinking');
                if(doneEl) doneEl.remove();
                callbacks?.onDone?.(event.conversation, event.message);
                return { conversation: event.conversation, message: event.message, text: fullText };
            }
        }
    }
    assistantBubble?.bubble?.classList?.remove('streaming', 'tool-active', 'awaiting-approval');
    return { conversation: null, message: null, text: fullText };
    } finally {
        clearInterval(activityTimer);
    }
}

async function streamCodingAgent(payload, assistantBubble, callbacks){
    const res = await fetch('/api/studio-coding/stream', {
        method: 'POST',
        headers: payload.headers,
        body: JSON.stringify(payload.body),
    });
    if(!res.ok || !res.body){
        const detail = await readErrorDetail(res, 'Coding Agent 请求失败');
        if(res.status === 404){
            throw new Error('Coding Agent 接口未加载。请关闭 run.bat 后重新运行，再 Ctrl+F5 刷新。');
        }
        throw new Error(detail);
    }
    const ct = res.headers.get('content-type') || '';
    if(!ct.includes('text/event-stream')){
        throw new Error('Coding Agent 未返回流式响应');
    }
    return consumeCodingStream(res, assistantBubble, {
        ...callbacks,
        requestHeaders: payload.headers,
    });
}

const api = Object.freeze({ streamCodingAgent, consumeCodingStream, toolLabel, submitApproval });
global.StudioChatCodingAgent = api;
Core?.register?.('codingAgent', api);
})(window);
