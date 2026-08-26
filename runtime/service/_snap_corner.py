"""One-off: zoomed screenshot of the main window's bottom-right corner."""
import ctypes
import ctypes.wintypes
import os
import sys
import time

from PIL import ImageGrab

user32 = ctypes.WinDLL("user32")
user32.SetProcessDPIAware()

main_hwnd = int(sys.argv[1])
user32.SetForegroundWindow(main_hwnd)
time.sleep(0.8)
rect = ctypes.wintypes.RECT()
user32.GetWindowRect(main_hwnd, ctypes.byref(rect))
out = os.path.join(os.environ["TEMP"], "lb_corner_br.png")
img = ImageGrab.grab(
    bbox=(rect.right - 120, rect.bottom - 90, rect.right + 40, rect.bottom + 40),
    all_screens=True,
)
img.resize((img.width * 3, img.height * 3), 0).save(out)
print("SAVED", out)
