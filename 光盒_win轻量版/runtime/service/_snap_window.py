"""One-off: capture the Lightbox main window via PrintWindow (occlusion-proof)."""
import ctypes
import ctypes.wintypes
import os
import sys

from PIL import Image

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
user32.SetProcessDPIAware()

target_pid = int(sys.argv[1])
out_path = os.path.join(os.environ["TEMP"], sys.argv[2] if len(sys.argv) > 2 else "lightbox_snap.png")

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
        found.append((hwnd, rect.left, rect.top, rect.right, rect.bottom))
    return True

user32.EnumWindows(enum_proc, 0)
if not found:
    print("NO_MAIN_WINDOW")
    sys.exit(1)

hwnd, left, top, right, bottom = found[0]
w, h = right - left, bottom - top
print(f"hwnd={hwnd} rect={left},{top},{right},{bottom}")

hdc_win = user32.GetWindowDC(hwnd)
hdc_mem = gdi32.CreateCompatibleDC(hdc_win)
hbmp = gdi32.CreateCompatibleBitmap(hdc_win, w, h)
gdi32.SelectObject(hdc_mem, hbmp)
PW_RENDERFULLCONTENT = 0x00000002
ok = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)
print("printwindow", ok)


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.c_uint32), ("biWidth", ctypes.c_int32),
        ("biHeight", ctypes.c_int32), ("biPlanes", ctypes.c_uint16),
        ("biBitCount", ctypes.c_uint16), ("biCompression", ctypes.c_uint32),
        ("biSizeImage", ctypes.c_uint32), ("biXPelsPerMeter", ctypes.c_int32),
        ("biYPelsPerMeter", ctypes.c_int32), ("biClrUsed", ctypes.c_uint32),
        ("biClrImportant", ctypes.c_uint32),
    ]


bmi = BITMAPINFOHEADER(ctypes.sizeof(BITMAPINFOHEADER), w, -h, 1, 32, 0, 0, 0, 0, 0, 0)
buf = ctypes.create_string_buffer(w * h * 4)
gdi32.GetDIBits(hdc_mem, hbmp, 0, h, buf, ctypes.byref(bmi), 0)
img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1)
img.convert("RGB").save(out_path)

gdi32.DeleteObject(hbmp)
gdi32.DeleteDC(hdc_mem)
user32.ReleaseDC(hwnd, hdc_win)
print("SAVED", out_path)
