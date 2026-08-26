"""One-off: move window on-screen, sample shadow gradient at right edge and corner."""
import ctypes
import ctypes.wintypes
import os
import sys
import time

from PIL import ImageGrab

user32 = ctypes.WinDLL("user32")
user32.SetProcessDPIAware()

main_hwnd = int(sys.argv[1])
shadow_hwnd = int(sys.argv[2])

# place the window fully on-screen
user32.SetWindowPos(main_hwnd, 0, 200, 120, 1400, 900, 0x0044)
time.sleep(1.2)

rect = ctypes.wintypes.RECT()
user32.GetWindowRect(main_hwnd, ctypes.byref(rect))
print("main rect", rect.left, rect.top, rect.right, rect.bottom)
srect = ctypes.wintypes.RECT()
user32.GetWindowRect(shadow_hwnd, ctypes.byref(srect))
print("shadow rect", srect.left, srect.top, srect.right, srect.bottom,
      "visible", bool(user32.IsWindowVisible(shadow_hwnd)))

user32.SetForegroundWindow(main_hwnd)
time.sleep(0.8)

y = (rect.top + rect.bottom) // 2
img = ImageGrab.grab(bbox=(rect.right - 2, y, rect.right + 25, y + 1), all_screens=True)
print("RIGHT-EDGE STRIP (window -> desktop):")
print([img.getpixel((i, 0)) for i in range(img.width)])

out = os.path.join(os.environ["TEMP"], "lb_corner_final.png")
img2 = ImageGrab.grab(bbox=(rect.left - 40, rect.bottom - 80, rect.left + 120, rect.bottom + 40), all_screens=True)
img2 = img2.resize((img2.width * 3, img2.height * 3), 0)
img2.save(out)
print("SAVED", out)
