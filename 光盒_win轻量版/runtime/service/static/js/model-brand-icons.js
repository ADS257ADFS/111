/**
 * 模型名 → 所属公司图标（单色简化标识，随文字颜色 currentColor）。
 * 用于底部输入栏的模型选择上拉菜单。
 */
(function(global){
    'use strict';

    const wrap = inner => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

    const ICONS = {
        // Google / Gemini：四角星
        google: wrap('<path d="M12 2c.62 5.44 4.56 9.38 10 10-5.44.62-9.38 4.56-10 10-.62-5.44-4.56-9.38-10-10 5.44-.62 9.38-4.56 10-10Z" fill="currentColor"/>'),
        // OpenAI：六边形结（简化）
        openai: wrap('<path d="M12 3.2 19.4 7.5v8.6L12 20.4 4.6 16.1V7.5L12 3.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 8.2 15.4 10.1v3.8L12 15.8 8.6 13.9v-3.8L12 8.2Z" fill="currentColor"/>'),
        // 字节跳动（Seedream / Seedance / Seed）：四条声柱
        bytedance: wrap('<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4.6 9.6v5.2"/><path d="M9.5 5.4v13.2"/><path d="M14.5 7.4v9.2"/><path d="M19.4 10.4v3.6"/></g>'),
        // Midjourney：帆船
        midjourney: wrap('<path d="M13 3.4c2.5 2.7 4.9 6.4 7 10.6h-7V3.4Z" fill="currentColor"/><path d="M11 6.6V14H6.4C7.7 11.3 9.2 8.8 11 6.6Z" fill="currentColor"/><path d="M4 16.6h16l-2.1 3.2H6.1L4 16.6Z" fill="currentColor"/>'),
        // MiniMax（海螺）：双波浪
        minimax: wrap('<path d="M3 15.5c1.8-5.4 3.8-5.4 5.6 0 1.8 5.4 3.8 5.4 5.6 0 1.8-5.4 3.8-5.4 5.6 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
        // Vidu：V 标
        vidu: wrap('<path d="M4.6 5h3.6L12 12.9 15.8 5h3.6L13 19.4h-2L4.6 5Z" fill="currentColor"/>'),
        // 可灵 Kling：K 标
        kling: wrap('<g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5v15"/><path d="M17.5 5 8.2 12l9.3 7"/></g>'),
        // DeepSeek：鲸鱼
        deepseek: wrap('<path d="M3.2 12.6c2.6 5.6 8 7.8 12.9 5.9 3-1.2 4.9-3.9 5-6.9 0-1-1.3-1.5-2-.7-1.5 1.8-3.4 2.4-5.4 1.6C11 11.5 8.2 9 7.5 6.5c-.3-1-1.7-1-2 0-.6 2.1-1.6 4-2.3 6.1Z" fill="currentColor"/>'),
        // ElevenLabs：双竖杠
        eleven: wrap('<g stroke="currentColor" stroke-width="2.7" stroke-linecap="round"><path d="M9.2 5v14"/><path d="M14.8 5v14"/></g>'),
        // 阿里（Qwen / Wan）：双括弧
        alibaba: wrap('<g stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 6H6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h2.4"/><path d="M15.6 6H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2.4"/><path d="M9 12h6"/></g>'),
        // Anthropic / Claude：A 标
        anthropic: wrap('<path d="M4.4 19 10.6 5h2.8L19.6 19h-3.1l-1.2-2.9H8.7L7.5 19H4.4Zm5.3-5.5h4.6L12 7.9l-2.3 5.6Z" fill="currentColor"/>'),
        // 音乐类（Mureka / Sonilo）：音符
        note: wrap('<path d="M9.5 18V6.4l9-1.9v11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.2" cy="18" r="2.4" fill="currentColor"/><circle cx="16.2" cy="15.5" r="2.4" fill="currentColor"/>'),
        // 兜底：星芒
        generic: wrap('<path d="M12 4c.45 3.9 3.3 6.75 7.2 7.2-3.9.45-6.75 3.3-7.2 7.2-.45-3.9-3.3-6.75-7.2-7.2C8.7 10.75 11.55 7.9 12 4Z" fill="currentColor"/><circle cx="18.6" cy="5.4" r="1.6" fill="currentColor"/>'),
    };

    const RULES = [
        [/gpt|openai|sora|dall/, 'openai'],
        [/gemini|banana|veo|imagen|google/, 'google'],
        [/seedream|seedance|seed|doubao|jimeng|即梦|豆包|volc/, 'bytedance'],
        [/\bmj\b|mj\s|^mj|midjourney|niji/, 'midjourney'],
        [/hailuo|minimax|海螺|abab/, 'minimax'],
        [/vidu/, 'vidu'],
        [/kling|可灵|kolors|快手/, 'kling'],
        [/deepseek/, 'deepseek'],
        [/eleven/, 'eleven'],
        [/qwen|wan[\s\d.x-]|wanx|通义|tongyi|alibaba|glm|chatglm/, 'alibaba'],
        [/claude|anthropic/, 'anthropic'],
        [/mureka|sonilo|music|audio|speech|song/, 'note'],
    ];

    function iconFor(name){
        const key = String(name || '').toLowerCase();
        for(const [pattern, id] of RULES){
            if(pattern.test(key)) return ICONS[id];
        }
        return ICONS.generic;
    }

    const CHECK_SVG = wrap('<path d="M5 12.5 10 17.5 19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>');

    // 固定别名 → 一句话说明（悬停时在模型名下方展示）
    const DESCS = {
        'gpt image2': 'OpenAI 图像模型，文字渲染出色',
        'nano banana pro': '谷歌专业版图像模型，画质细节拉满',
        'seedream 5.0': '即梦 5.0，综合生图与语义理解',
        'midjourney v7': 'Midjourney V7，艺术风格表现力强',
        'seedance 2.0': '即梦视频模型，运镜与叙事稳定',
        'seedance 2.0 fast': '即梦快速版视频，秒级出片',
        'kling 3.0 omni': '可灵全能版，支持多模态输入',
        'minimax h3': 'MiniMax 视频模型，物理表现真实',
        'hailuo 2.3': '海螺 2.3 视频模型，动作流畅自然',
        'gemini omni flash': '谷歌快速视频模型，响应迅捷',
        'mureka v8': 'Mureka 音乐模型，整曲生成',
        'seed audio 1.0': '字节音频模型，多风格配音',
        'minimax music 2.6': 'MiniMax 音乐生成，编曲完整',
        'elevenlabs v3': '顶级语音合成，情感表达丰富',
        'minimax-speech-2.8-hd': '高保真语音合成，音质细腻',
        'deepseek v4': 'DeepSeek V4，推理与代码能力强',
        'gpt-5.6 sol': 'OpenAI GPT-5.6 Sol，综合能力顶尖',
        'glm-2': '智谱 GLM-2，中文理解与生成出色',
        'gemini 3.1 pro': '谷歌旗舰模型，长上下文多模态',
    };

    function descFor(name){
        return DESCS[String(name || '').trim().toLowerCase()] || '';
    }

    global.ModelBrandIcons = Object.freeze({iconFor, descFor, CHECK_SVG});
})(window);
