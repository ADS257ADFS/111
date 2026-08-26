"""One-off: screen-capture the area around the Lightbox window (incl. shadow)."""
import ctypes
import ctypes.wintypes
import sys

from PIL import ImageGrab

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()

target_pid = int(sys.argv[1])
out_path = sys.argv[2]
pad = int(sys.argv[3]) if len(sys.argv) > 3 else 40
found = []


@ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
def enum_proc(hwnd, _lparam):
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value != target_pid or not user32.IsWindowVisible(hwnd):
        return True
    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    if rect.right - rect.left > 500 and rect.bottom - rect.top > 400:
        found.append((rect.left, rect.top, rect.right, rect.bottom, hwnd))
    return True


user32.EnumWindows(enum_proc, 0)
if not found:
    print("NO_MAIN_WINDOW")
    sys.exit(1)

# 阴影伴随窗比主窗大，取最小的矩形即主窗。
left, top, right, bottom, hwnd = min(found, key=lambda r: (r[2] - r[0]) * (r[3] - r[1]))
# 截屏前临时置顶主窗（阴影窗会在 Activated 事件里跟随），避免被其他窗口遮挡。
import time

user32.SetForegroundWindow(hwnd)
user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0013)  # HWND_TOPMOST, NOSIZE|NOMOVE|NOACTIVATE
time.sleep(1.5)
print(f"window rect={left},{top},{right},{bottom}")
img = ImageGrab.grab(bbox=(left - pad, top - pad, right + pad, bottom + pad), all_screens=True)
user32.SetWindowPos(hwnd, -2, 0, 0, 0, 0, 0x0013)  # HWND_NOTOPMOST：撤销临时置顶
img.save(out_path)
print("SAVED", out_path)

# 四角放大拼图（原始分辨率，便于检查圆弧与锯齿）
from PIL import Image

crop = 120
w, h = img.size
corners = [
    img.crop((0, 0, crop, crop)),
    img.crop((w - crop, 0, w, crop)),
    img.crop((0, h - crop, crop, h)),
    img.crop((w - crop, h - crop, w, h)),
]
scale = 3
montage = Image.new("RGB", (crop * 2 * scale + 12, crop * 2 * scale + 12), (255, 0, 255))
positions = [(0, 0), (crop * scale + 12, 0), (0, crop * scale + 12), (crop * scale + 12, crop * scale + 12)]
for tile, pos in zip(corners, positions):
    montage.paste(tile.resize((crop * scale, crop * scale), Image.NEAREST), pos)
corners_path = out_path.replace(".png", "-corners.png")
montage.save(corners_path)
print("SAVED", corners_path)
