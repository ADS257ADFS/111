"""One-off: enumerate launcher windows, check shadow window state, sample edge pixels."""
import ctypes
import ctypes.wintypes
import os
import sys
import time

from PIL import ImageGrab

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()

target_pid = int(sys.argv[1])
wins = []

@ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
def enum_proc(hwnd, _l):
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value != target_pid:
        return True
    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    ex = user32.GetWindowLongW(hwnd, -20)
    cls = ctypes.create_unicode_buffer(64)
    user32.GetClassNameW(hwnd, cls, 64)
    wins.append({
        "hwnd": hwnd, "class": cls.value,
        "rect": (rect.left, rect.top, rect.right, rect.bottom),
        "visible": bool(user32.IsWindowVisible(hwnd)),
        "layered": bool(ex & 0x80000), "toolwin": bool(ex & 0x80),
        "transparent": bool(ex & 0x20),
    })
    return True

user32.EnumWindows(enum_proc, 0)
main = None
shadow = None
for w in wins:
    x1, y1, x2, y2 = w["rect"]
    print(w)
    if x2 - x1 > 500 and y2 - y1 > 400 and not w["layered"]:
        main = w
    if w["layered"] and w["toolwin"]:
        shadow = w

print("MAIN:", main and main["hwnd"], "SHADOW:", shadow and shadow["hwnd"])
if main:
    user32.SetForegroundWindow(main["hwnd"])
    time.sleep(0.8)
    left, top, right, bottom = main["rect"]
    # sample a strip crossing the left edge at mid-height
    y = (top + bottom) // 2
    img = ImageGrab.grab(bbox=(left - 25, y, left + 2, y + 1), all_screens=True)
    px = [img.getpixel((i, 0)) for i in range(img.width)]
    print("LEFT-EDGE STRIP (desktop -> window):")
    print(px)
    out = os.path.join(os.environ["TEMP"], "lb_shadow_corner.png")
    img2 = ImageGrab.grab(bbox=(left - 40, bottom - 60, left + 80, bottom + 40), all_screens=True)
    img2.save(out)
    print("SAVED", out)
