"""One-off: reproduce WindowShadow._render outside the app and surface errors."""
import ctypes
import ctypes.wintypes
import sys
import time
import traceback

sys.path.insert(0, r".")
import clr  # noqa: F401  (pythonnet, ships with pywebview runtime)

clr.AddReference("System.Drawing")
clr.AddReference("System.Windows.Forms")

from System.Drawing import Bitmap, Color, Graphics, SolidBrush  # noqa: E402
from System.Drawing.Drawing2D import GraphicsPath, SmoothingMode  # noqa: E402
from System.Drawing.Imaging import PixelFormat  # noqa: E402
from System.Windows.Forms import Form, FormBorderStyle, FormStartPosition  # noqa: E402

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32


class _BlendFunction(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


MARGIN = 22
RING_ALPHA = 10

form = Form()
form.FormBorderStyle = getattr(FormBorderStyle, "None")
form.StartPosition = FormStartPosition.Manual
form.ShowInTaskbar = False
hwnd = int(form.Handle.ToInt64())
ex = user32.GetWindowLongW(hwnd, -20)
user32.SetWindowLongW(hwnd, -20, ex | 0x00080000 | 0x00000020 | 0x00000080 | 0x08000000)
print("shadow test hwnd", hwnd)

shadow_w, shadow_h = 400, 300
try:
    bmp = Bitmap(shadow_w, shadow_h, PixelFormat.Format32bppArgb)
    g = Graphics.FromImage(bmp)
    g.SmoothingMode = SmoothingMode.AntiAlias
    for ring in range(MARGIN):
        k = ring + 1
        alpha = max(1, int(round(RING_ALPHA * (k / MARGIN) ** 2)))
        radius = 8 + max(0, (MARGIN - k) // 2)
        inset = ring
        w = shadow_w - inset * 2
        h = shadow_h - inset * 2
        if w <= radius * 2 or h <= radius * 2:
            continue
        d = radius * 2
        path = GraphicsPath()
        path.AddArc(inset, inset, d, d, 180, 90)
        path.AddArc(inset + w - d, inset, d, d, 270, 90)
        path.AddArc(inset + w - d, inset + h - d, d, d, 0, 90)
        path.AddArc(inset, inset + h - d, d, d, 90, 90)
        path.CloseFigure()
        brush = SolidBrush(Color.FromArgb(alpha, 0, 0, 0))
        g.FillPath(brush, path)
        brush.Dispose()
        path.Dispose()
    g.Dispose()
    print("bitmap painted")

    hbmp = int(bmp.GetHbitmap(Color.FromArgb(0)).ToInt64())
    bmp.Dispose()
    print("hbitmap", hbmp)
    screen_dc = user32.GetDC(0)
    mem_dc = gdi32.CreateCompatibleDC(screen_dc)
    old_bmp = gdi32.SelectObject(mem_dc, hbmp)
    size = ctypes.wintypes.SIZE(shadow_w, shadow_h)
    src_pos = ctypes.wintypes.POINT(0, 0)
    blend = _BlendFunction(0, 0, 255, 1)
    ok = user32.UpdateLayeredWindow(
        hwnd, screen_dc, None, ctypes.byref(size),
        mem_dc, ctypes.byref(src_pos), 0, ctypes.byref(blend), 2,
    )
    err = ctypes.get_last_error() or ctypes.windll.kernel32.GetLastError()
    print("ULW ok=", ok, "lasterror=", err)
    gdi32.SelectObject(mem_dc, old_bmp)
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(mem_dc)
    user32.ReleaseDC(0, screen_dc)

    user32.SetWindowPos(hwnd, 0, 200, 200, shadow_w, shadow_h, 0x0010 | 0x0040)
    time.sleep(1.0)
    from PIL import ImageGrab
    user32.SetProcessDPIAware()
    img = ImageGrab.grab(bbox=(200, 200, 200 + shadow_w, 200 + shadow_h), all_screens=True)
    px_edge = img.getpixel((1, shadow_h // 2))
    px_mid = img.getpixel((MARGIN + 2, shadow_h // 2))
    print("pixel at outer edge:", px_edge, "inside shadow:", px_mid)
except Exception:
    traceback.print_exc()
