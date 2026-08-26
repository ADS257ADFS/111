from pathlib import Path

p = Path(__file__).resolve().parent / "static" / "index.html"
text = p.read_text(encoding="utf-8")

replacements = [
    ('title="固定导航?', 'title="固定导航"'),
    ("title=\"褰撳墠鐗堟湰\"", 'title="当前版本"'),
    ("未命名画?</span>", "未命名画布</span>"),
    ("用户?</span>", "用户名</span>"),
    ("<strong>充?</strong>", "<strong>充值</strong>"),
    ("待接?</span>", "待接入</span>"),
    ("工作流设?</span>", "工作流设置</span>"),
    ("按需完成充值?</p>", "按需完成充值。</p>"),
    ("充值积?</h3>", "充值积分</h3>"),
    ("再确认明细后支付?</p>", "再确认明细后支付。</p>"),
    ("支付服务待接?</span>", "支付服务待接入</span>"),
    ("选择充值数?</label>", "选择充值数量</label>"),
    ("自定义调?</label>", "自定义调整</label>"),
    ("确认并支?</h4>", "确认并支付</h4>"),
    ("立即充?</button>", "立即充值</button>"),
    ("登录方式与安全校?</span>", "登录方式与安全校验</span>"),
    ("即将开?</em>", "即将开放</em>"),
    ("使用情况?</p>", "使用情况。</p>"),
    ("统计服务待接?</small>", "统计服务待接入</small>"),
    ("显示在这里?</p>", "显示在这里。</p>"),
    ("0 条记?</span>", "0 条记录</span>"),
    ("最近修?</option>", "最近修改</option>"),
    ("最新创?</option>", "最新创建</option>"),
    ("最早创?</option>", "最早创建</option>"),
    ("快捷键?</p>", "快捷键。</p>"),
    ("按住并拖拽框选节?</span>", "按住并拖拽框选节点</span>"),
    ("合并选中的图片为?</span>", "合并选中的图片为组</span>"),
    ("撤销上一步操?</span>", "撤销上一步操作</span>"),
    ("复制选中的节?</span>", "复制选中的节点</span>"),
    ("打开/关闭资产?</span>", "打开/关闭资产库</span>"),
    ("空白?</kbd>", "空白处</kbd>"),
    ("缩放画布或预览图?</span>", "缩放画布或预览图片</span>"),
    ("工作流设?</h2>", "工作流设置</h2>"),
    ("自动化执行方式?</p>", "自动化执行方式。</p>"),
    ("在这里显示?</p>", "在这里显示。</p>"),
    ("成员权限?</p>", "成员权限。</p>"),
    ("合作功能待接?</h3>", "合作功能待接入</h3>"),
    ("协作服务?</p>", "协作服务。</p>"),
    ("不断变大?</p>", "不断变大。</p>"),
    ('id="storageLocationSize">读取?</span>', 'id="storageLocationSize">读取中</span>'),
    ('id="storageLocationCurrent">读取?</strong>', 'id="storageLocationCurrent">读取中</strong>'),
    ("新的保存文件?</span>", "新的保存文件夹</span>"),
    ("选择文件?</button>", "选择文件夹</button>"),
    ("不会自动删除?</small>", "不会自动删除。</small>"),
    ("然后才切换?</span>", "然后才切换。</span>"),
    ("保存并准备切?</button>", "保存并准备切换</button>"),
    ("上传文档与智能任务保存位?</h3>", "上传文档与智能任务保存位置</h3>"),
    ("读取中?</strong>", "读取中</strong>"),
    ("已有文件?</small>", "已有文件。</small>"),
    ("文档保存文件?</span>", "文档保存文件夹</span>"),
    ("互不混放?</span>", "互不混放。</span>"),
    ("会保存在这里?</p>", "会保存在这里。</p>"),
    ('id="downloadStorageLocationCount">读取?</span>', 'id="downloadStorageLocationCount">读取中</span>'),
    ("下载保存文件?</span>", "下载保存文件夹</span>"),
    ('placeholder="请选择下载文件?', 'placeholder="请选择下载文件夹'),
    ("持续保留记录?</span>", "持续保留记录。</span>"),
    ("未命名对?</div>", "未命名对话</div>"),
    ("canvas-project-chrome.css?v=2026.08.11.82", "canvas-project-chrome.css?v=2026.08.12.08"),
    ("index-shell.js?v=2026.08.11.82", "index-shell.js?v=2026.08.12.08"),
    ("desktop-window-frame.css?v=2026.08.11.82", "desktop-window-frame.css?v=2026.08.12.08"),
]

missing = []
for old, new in replacements:
    if old not in text:
        missing.append(old)
    else:
        text = text.replace(old, new)

p.write_text(text, encoding="utf-8", newline="\n")
print("missing", len(missing))
for item in missing:
    print("MISSING:", item[:80])
left = [line.strip() for line in text.splitlines() if "?" in line and any("\u4e00" <= ch <= "\u9fff" for ch in line)]
print("remaining zh+? lines", len(left))
for line in left:
    if "v=" in line or "?desktop" in line or "hour >=" in line:
        continue
    print(" ", line[:160])
