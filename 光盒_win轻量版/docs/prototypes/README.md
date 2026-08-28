# 光盒视觉样板说明

> **这些文件在软件外面，不属于光盒安装包。**  
> 参考：Adobe Spectrum 2 桌面端 + Express 圆润浮层  
> **不修改正式产品代码。**

## 怎么打开（3 选 1）

### 方式 1：双击打开（最简单）

1. 打开文件夹：`光盒_win轻量版/docs/prototypes/`
2. 双击 **`index.html`**
3. 会自动用默认浏览器打开，再点进样板 A 或 B

### 方式 2：直接打开某个样板

在同一文件夹里双击：

- `spectrum-workspace-shell.html` — 样板 A
- `spectrum-floating-ui.html` — 样板 B

### 方式 3：本地小服务器（可选）

如果双击后样式异常，在该文件夹打开终端执行：

```bash
python -m http.server 8765
```

浏览器访问：`http://localhost:8765/`

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `index.html` | 入口页 |
| `spectrum-workspace-shell.html` | 样板 A · 工作区壳层 |
| `spectrum-floating-ui.html` | 样板 B · 浮层组件 |
| `spectrum-tokens-prototype.css` | 样板专用样式（与软件无关） |

页面内可切换 **亮色 / 深色** 主题。

---

## 请你这样反馈

看完样板后，直接说感受即可，例如：

- 太圆了 / 不够圆
- 按钮太大 / 太小
- 太挤 / 太空
- 太亮 / 太暗

不需要说具体数字，我会自动调整。
