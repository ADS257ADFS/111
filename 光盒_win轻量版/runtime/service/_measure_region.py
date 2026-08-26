"""One-off: probe the live window's SetWindowRgn shape at all four corners.

用 PtInRegion 精确测每个角的圆弧轮廓（窗口坐标系），不受壁纸/抗锯齿干扰。
"""
import ctypes
import ctypes.wintypes
import sys

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
user32.SetProcessDPIAware()

target_pid = int(sys.argv[1])
probe = int(sys.argv[2]) if len(sys.argv) > 2 else 24
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
        found.append((hwnd, rect.right - rect.left, rect.bottom - rect.top))
    return True


user32.EnumWindows(enum_proc, 0)
targets = [t for t in found if user32.GetWindowRgn(t[0], gdi32.CreateRectRgn(0, 0, 0, 0)) != 0]
if not targets:
    print("NO_REGIONED_WINDOW", found)
    sys.exit(1)

hwnd, w, h = min(targets, key=lambda t: t[1] * t[2])
region = gdi32.CreateRectRgn(0, 0, 0, 0)
kind = user32.GetWindowRgn(hwnd, region)
print(f"hwnd={hwnd} size={w}x{h} region_kind={kind}")  # 2=COMPLEXREGION


def profile(y_of, x_of):
    result = []
    for i in range(probe):
        inset = probe
        for j in range(probe):
            if gdi32.PtInRegion(region, x_of(j), y_of(i)):
                inset = j
                break
        result.append(inset)
    return result


profiles = {
    "top-left": profile(lambda i: i, lambda j: j),
    "top-right": profile(lambda i: i, lambda j: w - 1 - j),
    "bottom-left": profile(lambda i: h - 1 - i, lambda j: j),
    "bottom-right": profile(lambda i: h - 1 - i, lambda j: w - 1 - j),
}

base = profiles["top-left"]
max_dev = 0
for name, prof in profiles.items():
    dev = max(abs(a - b) for a, b in zip(base, prof))
    max_dev = max(max_dev, dev)
    print(f"{name:13s} {prof}  maxdev={dev}")
print(f"RESULT max_corner_deviation={max_dev}px")
