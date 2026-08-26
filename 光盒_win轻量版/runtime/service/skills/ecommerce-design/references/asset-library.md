# 大规模参考图库

参考图库用于检索视觉案例，不是训练集。把排版与调性分开管理，避免普通海报错误控制主图或详情页的信息结构。

## 推荐目录

```text
assets/
├── 排版参考/
│   ├── 商品主图/
│   │   ├── 白底商品图/
│   │   ├── 营销主图/
│   │   ├── 场景主图/
│   │   └── 直通车广告图/
│   └── 详情页/
│       ├── 首屏主视觉/
│       ├── 单卖点大图/
│       ├── 三卡片卖点/
│       ├── 图文交错/
│       └── 其他核心模块/
└── 调性参考/
    ├── 简约/
    ├── 高端奢华/
    ├── 国潮/
    ├── 科技感/
    ├── 清新自然/
    └── 促销/
```

- `排版参考`：只放可借鉴信息结构和槽位关系的同类型案例。一屏一个文件，保持统一宽度；总览拼图只供人工查看，不参与正式检索。
- `调性参考`：可以放主图、详情页、海报、KV、摄影或杂志图，只提取配色、光线、材质、字体气质和装饰语言。
- 目录层级可以不完整。索引脚本会扫描所有子目录，并从目录名和文件名提取角色、设计类型、模块、风格、平台和品类标签。
- 旧的 `商品主图/` 与 `详情页/` 目录继续兼容，并暂时标记为同时可用于排版与调性；完成迁移后再删除旧目录。

自定义调性直接作为 `调性参考` 下的目录，例如 `调性参考/莫兰迪/`。详情页的16个核心模块及容量规则见 `layout-system.md`。

Skill 已内置16张中性线框。需要恢复或重新生成时运行：

```bash
python scripts/generate_layout_wireframes.py
```

生成器同时更新 `assets/manifest.jsonl`，只重建内置线框记录，并保留其他图库记录。

## 批量入库

1. 在文件管理器中一次性复制图片到对应目录。
2. 运行：

```bash
python scripts/reference_library.py index
```

3. 查看统计：

```bash
python scripts/reference_library.py stats
```

4. 检查重复、损坏文件和授权状态：

```bash
python scripts/reference_library.py validate
```

索引写入 `assets/manifest.jsonl`。再次运行会保留人工补充的标签、来源和授权字段，并更新路径、尺寸、文件大小与校验值。

## 清单字段

每行是一条 JSON：

```json
{
  "id": "稳定ID",
  "path": "排版参考/详情页/三卡片卖点/example.jpg",
  "reference_role": ["layout"],
  "design_type": "detail-page",
  "layout_module": ["three-benefit-cards"],
  "style": ["minimal"],
  "platform": ["taobao"],
  "category": ["beauty"],
  "keywords": ["留白", "居中构图"],
  "colors": ["white", "beige"],
  "composition": ["centered", "large-whitespace"],
  "width": 800,
  "height": 800,
  "source": "",
  "rights": "unknown",
  "approved": false,
  "checksum": "sha256..."
}
```

人工可编辑字段：

- `reference_role`
- `layout_module`
- `style`
- `platform`
- `category`
- `keywords`
- `colors`
- `composition`
- `source`
- `rights`
- `approved`

`rights` 建议值：

- `owned`：自有版权
- `licensed`：已获得授权
- `reference-only`：仅限内部风格研究
- `unknown`：来源或权限未确认
- `restricted`：不得用于生成参考

只有 `owned`、`licensed` 或经团队批准的 `reference-only` 图片可进入正式工作流。不要使用 `restricted`。

## 检索

先检索排版，再独立检索调性，不把两类结果混成一次搜索。

排版参考：

```bash
python scripts/reference_library.py search \
  --role layout \
  --design-type 详情页 \
  --layout-module 三卡片卖点 \
  --limit 3
```

调性参考：

```bash
python scripts/reference_library.py search \
  --role mood \
  --style 清新自然 \
  --category 食品 \
  --limit 5
```

调性检索允许跨设计类型返回 `universal` 参考。脚本返回得分最高的少量路径；依次查看候选图片，提取共同特征，不机械复制单张图。

默认检索会跳过 `restricted`，但不会强制排除 `unknown`。正式商业交付前使用 `--approved-only`。

## 用户本轮上传的参考图

- 1–5 张代表性图片通常足够。
- 用户参考图可以是主图、详情页、海报、摄影、杂志或其他视觉；它无需存进系统图库。
- 可以一次上传多张独立文件，不要把多个排版模块拼成一张长图；总览图仅供人工查看。
- 上传时尽量说明每张图的角色，例如“图1参考排版，图2参考配色与光线”。
- 用户只说“照这个风格”时默认按调性参考处理，不照搬海报排版。
- 用户只说“按这个排版”时才允许参考模块结构和槽位。
- 用户参考图始终高于系统图库，但不得覆盖商品真实性、平台规则和已确认文案。
- 用户一次提供大量图片时，先把图片放入本地图库并建立索引。
- 不声称图片已让系统永久学习；除非确有外部训练或持久偏好系统。

## 可选视觉自动标注

当前脚本只做确定性的目录标签、文件元数据和文本检索。若另有视觉模型，可批量生成 `keywords`、`colors` 和 `composition`，再写回清单。自动标签应抽样复核，不能自动判定版权。
