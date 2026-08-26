"""One-off: zoomed screen captures of all four window corners (with desktop behind)."""
import ctypes
import ctypes.wintypes
import os
import sys
import time

from PIL import Image, ImageGrab

user32 = ctypes.WinDLL("user32")
user32.SetProcessDPIAware()

target_pid = int(sys.argv[1])
found = []

@ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
def enum_proc(hwnd, _l):
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value != target_pid or not user32.IsWindowVisible(hwnd):
        return True
    ex = user32.GetWindowLongW(hwnd, -20)
    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    if not (ex & 0x80000) and rect.right - rect.left > 500:
        found.append(hwnd)
    return True

user32.EnumWindows(enum_proc, 0)
hwnd = found[0]
user32.SetWindowPos(hwnd, 0, 300, 150, 1200, 800, 0x0044)
time.sleep(0.6)
user32.SetForegroundWindow(hwnd)
time.sleep(0.8)
rect = ctypes.wintypes.RECT()
user32.GetWindowRect(hwnd, ctypes.byref(rect))
l, t, r, b = rect.left, rect.top, rect.right, rect.bottom
S = 30  # crop half-size around each corner
corners = {"tl": (l, t), "tr": (r, t), "bl": (l, b), "br": (r, b)}
tiles = []
for name, (cx, cy) in corners.items():
    img = ImageGrab.grab(bbox=(cx - S, cy - S, cx + S, cy + S), all_screens=True)
    tiles.append(img.resize((img.width * 5, img.height * 5), 0))
w, h = tiles[0].size
sheet = Image.new("RGB", (w * 2 + 10, h * 2 + 10), (255, 0, 255))
sheet.paste(tiles[0], (0, 0)); sheet.paste(tiles[1], (w + 10, 0))
sheet.paste(tiles[2], (0, h + 10)); sheet.paste(tiles[3], (w + 10, h + 10))
out = os.path.join(os.environ["TEMP"], "lb_corners_4.png")
sheet.save(out)
print("SAVED", out)
