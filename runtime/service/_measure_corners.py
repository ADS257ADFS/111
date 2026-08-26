"""One-off: measure the four window-corner arc profiles from a screenshot.

截图由 _snap_screen_region.py 生成：窗口边界在图内 [pad, pad, W-pad, H-pad]。
深色主题窗体为暗色，桌面壁纸为亮色——按亮度阈值区分窗内/窗外，
对每个角输出每行第一个“窗内”像素的横向缩进，即圆弧轮廓。
"""
import sys

from PIL import Image

path = sys.argv[1]
pad = int(sys.argv[2]) if len(sys.argv) > 2 else 40
probe = int(sys.argv[3]) if len(sys.argv) > 3 else 24

img = Image.open(path).convert("RGB")
W, H = img.size
px = img.load()

lo_x, lo_y = pad, pad
hi_x, hi_y = W - pad - 1, H - pad - 1


def is_window(p):
    r, g, b = p
    return (r + g + b) / 3 < 90  # 深色窗体 vs 亮色桌面


def profile(y_of, x_of):
    """每行（从角边缘向内 0..probe-1）第一个窗内像素的缩进。"""
    result = []
    for i in range(probe):
        inset = probe  # 未命中时的上限
        for j in range(probe):
            if is_window(px[x_of(j), y_of(i)]):
                inset = j
                break
        result.append(inset)
    return result


profiles = {
    "top-left": profile(lambda i: lo_y + i, lambda j: lo_x + j),
    "top-right": profile(lambda i: lo_y + i, lambda j: hi_x - j),
    "bottom-left": profile(lambda i: hi_y - i, lambda j: lo_x + j),
    "bottom-right": profile(lambda i: hi_y - i, lambda j: hi_x - j),
}

for name, prof in profiles.items():
    print(f"{name:13s} {prof}")

base = profiles["top-left"]
max_dev = 0
for name, prof in profiles.items():
    dev = max(abs(a - b) for a, b in zip(base, prof))
    max_dev = max(max_dev, dev)
    print(f"{name:13s} 与 top-left 最大偏差: {dev}px")
print(f"结论: 四角轮廓最大互差 {max_dev}px" + ("（一致，差异在抗锯齿 1px 内）" if max_dev <= 1 else "（存在不一致！）"))
