"""Windows launcher for the recovered Lightbox lightweight build."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import uuid
import ctypes
import ctypes.wintypes
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import quote, urlparse

from fastapi import HTTPException, Request
from fastapi.staticfiles import StaticFiles
from PIL import Image


SERVICE_DIR = Path(__file__).resolve().parent
APP_TITLE = "光盒"
APP_MUTEX_NAME = "Local\\LightboxWindowsLightweight"
UI_ZOOM_FACTOR = 1.21
DEFAULT_WINDOW_RATIO = 0.68
WINDOW_MIN_WIDTH = 1440
WINDOW_MIN_HEIGHT = 850
LOCAL_ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".svg",
    ".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv",
    ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac",
}
MAX_LOCAL_ASSET_BYTES = 250 * 1024 * 1024
SAVE_AS_TARGETS: dict[str, tuple[Path, float]] = {}


class AccentPolicy(ctypes.Structure):
    _fields_ = [
        ("AccentState", ctypes.c_int),
        ("AccentFlags", ctypes.c_int),
        ("GradientColor", ctypes.c_uint),
        ("AnimationId", ctypes.c_int),
    ]


class WindowCompositionAttributeData(ctypes.Structure):
    _fields_ = [
        ("Attribute", ctypes.c_int),
        ("Data", ctypes.c_void_p),
        ("SizeOfData", ctypes.c_size_t),
    ]


class DwmMargins(ctypes.Structure):
    _fields_ = [
        ("LeftWidth", ctypes.c_int),
        ("RightWidth", ctypes.c_int),
        ("TopHeight", ctypes.c_int),
        ("BottomHeight", ctypes.c_int),
    ]


def apply_window_accent(hwnd: int, state: int, gradient_color: int = 0x80FFFFFF) -> None:
    if not hwnd:
        return
    accent = AccentPolicy(
        AccentState=state,
        AccentFlags=2,
        GradientColor=gradient_color & 0xFFFFFFFF,
        AnimationId=0,
    )
    data = WindowCompositionAttributeData(
        Attribute=19,
        Data=ctypes.cast(ctypes.pointer(accent), ctypes.c_void_p),
        SizeOfData=ctypes.sizeof(accent),
    )
    try:
        ctypes.windll.user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))
    except Exception:
        pass


DWMWA_WINDOW_CORNER_PREFERENCE = 33
DWMWCP_DONOTROUND = 1

# 窗口化圆角半径（物理像素）。Win10 无 DWM 圆角，用 SetWindowRgn 裁剪，
# 锯齿由伴随阴影窗的抗锯齿圆弧补边（WindowShadow._render）平滑。
WINDOW_CORNER_RADIUS = 18
RGN_OR = 2


def _create_symmetric_round_rect_rgn(width: int, height: int, radius: int) -> int:
    """Four matching quarter-circles. Avoid CreateRoundRectRgn(w+1,h+1): that
    exclusive-coord trick only shifts the right/bottom ellipses, so the lower
    corners read as a tighter radius than the top."""
    gdi32 = ctypes.windll.gdi32
    radius = max(1, min(int(radius), width // 2, height // 2))
    diameter = radius * 2
    body = gdi32.CreateRectRgn(radius, 0, width - radius, height)
    left = gdi32.CreateRectRgn(0, radius, radius, height - radius)
    right = gdi32.CreateRectRgn(width - radius, radius, width, height - radius)
    tl = gdi32.CreateEllipticRgn(0, 0, diameter, diameter)
    tr = gdi32.CreateEllipticRgn(width - diameter, 0, width, diameter)
    bl = gdi32.CreateEllipticRgn(0, height - diameter, diameter, height)
    br = gdi32.CreateEllipticRgn(width - diameter, height - diameter, width, height)
    parts = (left, right, tl, tr, bl, br)
    if not body or not all(parts):
        for handle in (body, *parts):
            if handle:
                gdi32.DeleteObject(handle)
        return 0
    for handle in parts:
        gdi32.CombineRgn(body, body, handle, RGN_OR)
        gdi32.DeleteObject(handle)
    return body


def apply_rounded_window_region(hwnd: int, rounded: bool) -> None:
    """Windowed → rounded-rect region; maximized → clear the region."""
    if not hwnd:
        return
    user32 = ctypes.windll.user32
    try:
        if not rounded:
            user32.SetWindowRgn(hwnd, None, True)
            return
        if user32.IsIconic(hwnd):
            return
        rect = ctypes.wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return
        width = int(rect.right - rect.left)
        height = int(rect.bottom - rect.top)
        if width <= 0 or height <= 0:
            return
        region = _create_symmetric_round_rect_rgn(width, height, WINDOW_CORNER_RADIUS)
        if region:
            # SetWindowRgn takes ownership of the region handle.
            user32.SetWindowRgn(hwnd, region, True)
    except Exception:
        pass


def install_window_frame_refresh(window, bridge: "DesktopBridge") -> None:
    """Keep the rectangular drop shadow matched to the live window."""
    form = getattr(window, "native", None)
    if form is None:
        return

    def on_resize(_sender=None, _args=None):
        try:
            hwnd = bridge._hwnd()
            if not hwnd:
                return
            if bridge._is_work_area_maximized():
                apply_solid_window_frame(hwnd, show_shadow=False)
            else:
                apply_solid_window_frame(hwnd, show_shadow=True)
        except Exception:
            pass

    def on_move(_sender=None, _args=None):
        try:
            hwnd = bridge._hwnd()
            if hwnd and not bridge._is_work_area_maximized():
                window_shadow.follow(hwnd)
        except Exception:
            pass

    try:
        form.Resize += on_resize
        form.Move += on_move
        # Re-snap the shadow right below the window whenever it is raised.
        form.Activated += on_move
    except Exception:
        pass


def disable_system_window_rounding(hwnd: int) -> None:
    """禁用 Win11 系统自动圆角——圆角统一由 SetWindowRgn 提供，避免双重裁剪。"""
    if not hwnd:
        return
    preference = ctypes.c_int(DWMWCP_DONOTROUND)
    try:
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            ctypes.byref(preference),
            ctypes.sizeof(preference),
        )
    except Exception:
        pass


# 宿主底色必须与 CSS 窗框色（--ui-surface-shell）一致：WebView2 缩放取整
# 会在窗口左右/底部留下 1px 缝隙，露出宿主色——写死白色会浅色露白、深色漏黑。
# 浅色用 MiniMax 浅灰窗框 #fafafb；深色用 MiniMax 深灰窗框 #1b1b1b。
CHROME_BG = {"light": (0xFA, 0xFA, 0xFB), "dark": (0x18, 0x18, 0x18)}
_host_theme = "light"


def configure_opaque_form(window, theme: str | None = None) -> None:
    """Zero pywebview padding and force an opaque host + WebView surface.

    Layered color-key transparency broke WebView2 composition on Win10
    (severe lag, missing paint, click-through), so the host stays opaque.
    """
    global _host_theme
    if theme in CHROME_BG:
        _host_theme = theme
    chrome_r, chrome_g, chrome_b = CHROME_BG[_host_theme]
    form = getattr(window, "native", None)
    if form is None:
        return

    def apply() -> None:
        try:
            from System.Drawing import Color
            from System.Windows.Forms import Padding

            form.Padding = Padding(0)
            form.TransparencyKey = Color.Empty
            form.BackColor = Color.FromArgb(chrome_r, chrome_g, chrome_b)
        except Exception:
            pass
        try:
            from System.Drawing import Color

            browser = getattr(form, "browser", None) or getattr(form, "webview", None)
            # EdgeChrome exposes DefaultBackgroundColor on the wrapper and on .webview
            for target in (browser, getattr(browser, "webview", None)):
                if target is not None and hasattr(target, "DefaultBackgroundColor"):
                    target.DefaultBackgroundColor = Color.FromArgb(chrome_r, chrome_g, chrome_b)
        except Exception:
            pass

    try:
        from System import Action

        if hasattr(form, "InvokeRequired") and form.InvokeRequired and hasattr(form, "Invoke"):
            form.Invoke(Action(apply))
        else:
            apply()
    except Exception:
        apply()


def clear_layered_style(hwnd: int) -> None:
    """Strip WS_EX_LAYERED — layered color-key breaks WebView2 composition."""
    if not hwnd:
        return
    GWL_EXSTYLE = -20
    WS_EX_LAYERED = 0x00080000
    user32 = ctypes.windll.user32
    get_long = getattr(user32, "GetWindowLongPtrW", None) or user32.GetWindowLongW
    set_long = getattr(user32, "SetWindowLongPtrW", None) or user32.SetWindowLongW
    try:
        style = int(get_long(hwnd, GWL_EXSTYLE))
        if style & WS_EX_LAYERED:
            set_long(hwnd, GWL_EXSTYLE, style & ~WS_EX_LAYERED)
    except Exception:
        pass


class _BlendFunction(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


# Whole-window shadow with a denser near-edge falloff. Reach and peak
# alpha are tuned for a clearly visible (but not heavy) windowed shadow.
SHADOW_MARGIN = 16
SHADOW_OFFSET_Y = 1
SHADOW_RING_ALPHA = 48
SHADOW_COLOR = (28, 30, 34)


def _shadow_log(message: str) -> None:
    """Shadow failures are invisible otherwise — keep a breadcrumb log."""
    try:
        local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        log_path = local_app_data / "Lightbox-Windows-Clean" / "shadow.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as fh:
            fh.write(f"{datetime.now():%H:%M:%S} {message}\n")
    except Exception:
        pass


class WindowShadow:
    """Rectangular soft shadow on a click-through companion window."""

    def __init__(self) -> None:
        self.form = None
        self._hwnd = 0
        self._size = (0, 0)
        self._last_bounds = None
        self._lock = threading.Lock()

    def attach(self, window) -> None:
        owner = getattr(window, "native", None)
        if owner is None or self.form is not None:
            return

        def create() -> None:
            try:
                from System.Windows.Forms import Form, FormBorderStyle, FormStartPosition

                shadow = Form()
                shadow.FormBorderStyle = getattr(FormBorderStyle, "None")
                shadow.StartPosition = FormStartPosition.Manual
                shadow.ShowInTaskbar = False
                hwnd = int(shadow.Handle.ToInt64())  # forces handle creation
                user32 = ctypes.windll.user32
                get_long = getattr(user32, "GetWindowLongPtrW", None) or user32.GetWindowLongW
                set_long = getattr(user32, "SetWindowLongPtrW", None) or user32.SetWindowLongW
                ex = int(get_long(hwnd, -20))
                # LAYERED | TRANSPARENT (click-through) | TOOLWINDOW | NOACTIVATE
                set_long(hwnd, -20, ex | 0x00080000 | 0x00000020 | 0x00000080 | 0x08000000)
                self.form = shadow
                self._hwnd = hwnd
                _shadow_log(f"attach ok hwnd={hwnd}")
            except Exception:
                self.form = None
                self._hwnd = 0
                _shadow_log("attach failed: " + traceback.format_exc())

        try:
            from System import Action

            if hasattr(owner, "InvokeRequired") and owner.InvokeRequired:
                owner.Invoke(Action(create))
            else:
                create()
        except Exception:
            pass

    def sync(self, main_hwnd: int, visible: bool) -> None:
        """Show/update the shadow for the current window bounds, or hide it."""
        if not self._hwnd or not main_hwnd:
            return
        user32 = ctypes.windll.user32
        if (
            not visible
            or not user32.IsWindowVisible(main_hwnd)
            or user32.IsIconic(main_hwnd)
        ):
            user32.ShowWindow(self._hwnd, 0)  # SW_HIDE
            self._last_bounds = None
            return
        rect = ctypes.wintypes.RECT()
        if not user32.GetWindowRect(main_hwnd, ctypes.byref(rect)):
            return
        width = int(rect.right - rect.left)
        height = int(rect.bottom - rect.top)
        if width <= 0 or height <= 0:
            return
        bounds = (rect.left, rect.top, width, height)
        if (
            bounds == self._last_bounds
            and user32.IsWindowVisible(self._hwnd)
            and getattr(self, "_edge_theme", None) == _host_theme
        ):
            return
        margin = SHADOW_MARGIN
        shadow_w = width + margin * 2
        shadow_h = height + margin * 2
        with self._lock:
            # 主题切换会改变描边颜色，必须强制重绘（尺寸未变也要重画）。
            if (shadow_w, shadow_h) != self._size or getattr(self, "_edge_theme", None) != _host_theme:
                if not self._render(shadow_w, shadow_h):
                    _shadow_log(f"render failed for {shadow_w}x{shadow_h}")
                    return
                self._size = (shadow_w, shadow_h)
        # Keep the shadow immediately below the main window.
        # SWP_NOACTIVATE | SWP_SHOWWINDOW
        user32.SetWindowPos(
            self._hwnd, main_hwnd,
            rect.left - margin, rect.top - margin + SHADOW_OFFSET_Y, shadow_w, shadow_h,
            0x0010 | 0x0040,
        )
        self._last_bounds = bounds

    def follow(self, main_hwnd: int) -> None:
        """Cheap reposition during drags — no bitmap rebuild."""
        if not self._hwnd or not main_hwnd:
            return
        user32 = ctypes.windll.user32
        if not user32.IsWindowVisible(self._hwnd):
            return
        rect = ctypes.wintypes.RECT()
        if not user32.GetWindowRect(main_hwnd, ctypes.byref(rect)):
            return
        # SWP_NOSIZE | SWP_NOACTIVATE
        user32.SetWindowPos(
            self._hwnd, main_hwnd,
            rect.left - SHADOW_MARGIN, rect.top - SHADOW_MARGIN + SHADOW_OFFSET_Y, 0, 0,
            0x0001 | 0x0010,
        )

    def _render(self, shadow_w: int, shadow_h: int) -> bool:
        """Paint a rounded concentric shadow around the window via ULW."""
        try:
            from System.Drawing import Bitmap, Color, Graphics, Pen, SolidBrush
            from System.Drawing.Drawing2D import GraphicsPath, SmoothingMode
            from System.Drawing.Imaging import PixelFormat

            def round_rect_path(x: float, y: float, w: float, h: float, r: float) -> "GraphicsPath":
                r = max(1.0, min(r, w / 2, h / 2))
                d = r * 2
                path = GraphicsPath()
                path.AddArc(x, y, d, d, 180.0, 90.0)
                path.AddArc(x + w - d, y, d, d, 270.0, 90.0)
                path.AddArc(x + w - d, y + h - d, d, d, 0.0, 90.0)
                path.AddArc(x, y + h - d, d, d, 90.0, 90.0)
                path.CloseFigure()
                return path

            margin = SHADOW_MARGIN
            bmp = Bitmap(shadow_w, shadow_h, PixelFormat.Format32bppArgb)
            g = Graphics.FromImage(bmp)
            g.SmoothingMode = SmoothingMode.AntiAlias
            win_x = margin
            win_y = margin - SHADOW_OFFSET_Y
            win_w = shadow_w - margin * 2
            win_h = shadow_h - margin * 2
            for distance in range(margin, 0, -1):
                alpha = max(1, int(round(
                    SHADOW_RING_ALPHA * ((margin - distance + 1) / margin) ** 2
                )))
                pen = Pen(Color.FromArgb(alpha, *SHADOW_COLOR), 1.5)
                ring = round_rect_path(
                    float(win_x - distance), float(win_y - distance),
                    float(win_w + distance * 2), float(win_h + distance * 2),
                    float(WINDOW_CORNER_RADIUS + distance),
                )
                g.DrawPath(pen, ring)
                ring.Dispose()
                pen.Dispose()
            # 抗锯齿补边：主窗被 SetWindowRgn 圆角裁剪后边缘是硬锯齿；在阴影
            # 窗上以窗框色实心填充同半径圆角矩形，四角透出的平滑圆弧盖住锯齿。
            edge_r, edge_g, edge_b = CHROME_BG[_host_theme]
            edge_brush = SolidBrush(Color.FromArgb(255, edge_r, edge_g, edge_b))
            edge_path = round_rect_path(
                float(win_x), float(win_y), float(win_w), float(win_h),
                float(WINDOW_CORNER_RADIUS),
            )
            g.FillPath(edge_brush, edge_path)
            edge_path.Dispose()
            edge_brush.Dispose()
            self._edge_theme = _host_theme
            g.Dispose()

            # Fresh DLL instances: pywebview assigns its own argtypes to the
            # process-wide ctypes.windll.user32.UpdateLayeredWindow, which
            # rejects our wintypes structs.
            user32 = ctypes.WinDLL("user32")
            gdi32 = ctypes.WinDLL("gdi32")
            hbmp = int(bmp.GetHbitmap(Color.FromArgb(0)).ToInt64())
            bmp.Dispose()
            screen_dc = user32.GetDC(0)
            mem_dc = gdi32.CreateCompatibleDC(screen_dc)
            old_bmp = gdi32.SelectObject(mem_dc, hbmp)
            size = ctypes.wintypes.SIZE(shadow_w, shadow_h)
            src_pos = ctypes.wintypes.POINT(0, 0)
            blend = _BlendFunction(0, 0, 255, 1)  # AC_SRC_OVER / AC_SRC_ALPHA
            ok = user32.UpdateLayeredWindow(
                self._hwnd, screen_dc, None, ctypes.byref(size),
                mem_dc, ctypes.byref(src_pos), 0, ctypes.byref(blend), 2,  # ULW_ALPHA
            )
            gdi32.SelectObject(mem_dc, old_bmp)
            gdi32.DeleteObject(hbmp)
            gdi32.DeleteDC(mem_dc)
            user32.ReleaseDC(0, screen_dc)
            if not ok:
                _shadow_log("ULW returned 0")
            return bool(ok)
        except Exception:
            _shadow_log("render exception: " + traceback.format_exc())
            return False


window_shadow = WindowShadow()

# The shell JS re-syncs the backdrop on every html class change; repeating
# DWM frame/accent calls forces recomposition (visible flicker), so apply
# them once per hwnd and skip afterwards.
_applied_window_frame: dict[int, bool] = {}


def apply_solid_window_frame(hwnd: int, show_shadow: bool = True) -> None:
    # show_shadow 同时代表“窗口化”状态：窗口化 → 圆角 + 投影，最大化 → 直角无投影。
    if not hwnd:
        return
    if not _applied_window_frame.get(hwnd):
        clear_layered_style(hwnd)
        margins = DwmMargins(0, 0, 0, 0)
        ctypes.windll.dwmapi.DwmExtendFrameIntoClientArea(hwnd, ctypes.byref(margins))
        apply_window_accent(hwnd, 0)
        _applied_window_frame[hwnd] = True
    disable_system_window_rounding(hwnd)
    apply_rounded_window_region(hwnd, show_shadow)
    window_shadow.sync(hwnd, show_shadow)


def app_url(port: int) -> str:
    return f"http://127.0.0.1:{port}/"


def configure_user_data(port: int) -> None:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    support_root = local_app_data / "Lightbox-Windows-Clean"
    config_path = Path(
        os.environ.get(
            "INFINITE_CANVAS_LOCATION_CONFIG",
            str(support_root / "storage-location.json"),
        )
    ).expanduser()
    user_data_path = config_path.parent / "UserData"

    os.environ["INFINITE_CANVAS_LOCATION_CONFIG"] = str(config_path)
    os.environ["INFINITE_CANVAS_PORT"] = str(port)
    os.environ["LIGHTBOX_UI_ZOOM_FACTOR"] = str(UI_ZOOM_FACTOR)
    os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

    if not config_path.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(
            json.dumps(
                {"schema_version": 2, "user_data_dir": str(user_data_path)},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def reserve_private_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def server_is_ready(port: int) -> bool:
    try:
        with urllib.request.urlopen(app_url(port), timeout=0.5) as response:
            html = response.read().decode("utf-8", errors="ignore")
            return response.status == 200 and "<title>AI Studio</title>" in html and 'id="frame-canvas"' in html
    except Exception:
        return False


def wait_until_ready(port: int) -> None:
    for _ in range(600):
        if server_is_ready(port):
            return
        time.sleep(0.025)
    raise RuntimeError("光盒后台服务启动超时")


def acquire_single_instance():
    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW.restype = ctypes.c_void_p
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel32.CreateMutexW(None, False, APP_MUTEX_NAME)
    if not handle:
        raise ctypes.WinError()
    if kernel32.GetLastError() == 183:
        kernel32.CloseHandle(handle)
        return None
    return handle


class DesktopBridge:
    def __init__(self) -> None:
        self._window = None
        self._maximized = False
        self._restore_bounds = None
        self._move_thread = None

    def _hwnd(self) -> int:
        if self._window is None or self._window.native is None:
            return 0
        handle = self._window.native.Handle
        try:
            return int(handle.ToInt64())
        except Exception:
            return int(handle.ToInt32())

    def _window_rect(self):
        class Rect(ctypes.Structure):
            _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                        ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

        rect = Rect()
        if not ctypes.windll.user32.GetWindowRect(self._hwnd(), ctypes.byref(rect)):
            return None
        return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top

    def enable_standard_taskbar_behavior(self) -> None:
        hwnd = self._hwnd()
        if not hwnd:
            return
        user32 = ctypes.windll.user32
        get_window_long = user32.GetWindowLongPtrW
        set_window_long = user32.SetWindowLongPtrW
        get_window_long.argtypes = [ctypes.c_void_p, ctypes.c_int]
        set_window_long.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
        get_window_long.restype = ctypes.c_void_p
        set_window_long.restype = ctypes.c_void_p
        style = int(get_window_long(hwnd, -16) or 0)
        style |= 0x00080000 | 0x00020000 | 0x00010000
        set_window_long(hwnd, -16, ctypes.c_void_p(style))
        user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0027)
        self._set_resize_style(not self._maximized)

    def _set_resize_style(self, enabled: bool) -> None:
        hwnd = self._hwnd()
        if not hwnd:
            return
        user32 = ctypes.windll.user32
        get_window_long = user32.GetWindowLongPtrW
        set_window_long = user32.SetWindowLongPtrW
        get_window_long.argtypes = [ctypes.c_void_p, ctypes.c_int]
        set_window_long.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
        get_window_long.restype = ctypes.c_void_p
        set_window_long.restype = ctypes.c_void_p
        style = int(get_window_long(hwnd, -16) or 0)
        # Keep the native thick frame disabled in both window states. It adds a
        # visible 7 px opaque non-client ring around an otherwise custom glass
        # frame. Resizing is handled through SC_SIZE in
        # start_native_window_interaction instead.
        style &= ~0x00040000
        set_window_long(hwnd, -16, ctypes.c_void_p(style))
        user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0027)

    def _work_area(self):
        class Rect(ctypes.Structure):
            _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                        ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

        class MonitorInfo(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_ulong), ("rcMonitor", Rect),
                        ("rcWork", Rect), ("dwFlags", ctypes.c_ulong)]

        monitor = ctypes.windll.user32.MonitorFromWindow(self._hwnd(), 2)
        info = MonitorInfo(cbSize=ctypes.sizeof(MonitorInfo))
        if not ctypes.windll.user32.GetMonitorInfoW(monitor, ctypes.byref(info)):
            raise ctypes.WinError()
        work = info.rcWork
        return work.left, work.top, work.right - work.left, work.bottom - work.top

    def _primary_work_area(self):
        class Rect(ctypes.Structure):
            _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                        ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

        work = Rect()
        if not ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(work), 0):
            raise ctypes.WinError()
        return work.left, work.top, work.right - work.left, work.bottom - work.top

    def _default_window_bounds(self):
        work_x, work_y, work_width, work_height = self._work_area()
        width = max(WINDOW_MIN_WIDTH, int(work_width * DEFAULT_WINDOW_RATIO))
        height = max(WINDOW_MIN_HEIGHT, int(work_height * DEFAULT_WINDOW_RATIO))
        x = work_x + (work_width - width) // 2
        y = work_y + (work_height - height) // 2
        return x, y, width, height

    def show_default_window(self) -> None:
        self._restore_bounds = self._default_window_bounds()
        x, y, width, height = self._restore_bounds
        hwnd = self._hwnd()
        if ctypes.windll.user32.IsZoomed(hwnd) or ctypes.windll.user32.IsIconic(hwnd):
            ctypes.windll.user32.ShowWindow(hwnd, 9)
        ctypes.windll.user32.SetWindowPos(hwnd, 0, x, y, width, height, 0x0044)
        self._maximized = False
        self._set_resize_style(True)
        if self._window is not None:
            configure_opaque_form(self._window)
        apply_solid_window_frame(hwnd, show_shadow=True)

    def restore_window(self) -> None:
        # Restore to the most recent windowed bounds (updated after every
        # user move/resize), falling back to the centered default layout.
        if self._restore_bounds is None:
            self._restore_bounds = self._default_window_bounds()
        x, y, width, height = self._restore_bounds
        hwnd = self._hwnd()
        if ctypes.windll.user32.IsZoomed(hwnd) or ctypes.windll.user32.IsIconic(hwnd):
            ctypes.windll.user32.ShowWindow(hwnd, 9)
        ctypes.windll.user32.SetWindowPos(hwnd, 0, x, y, width, height, 0x0044)
        self._maximized = False
        self._set_resize_style(True)
        if self._window is not None:
            configure_opaque_form(self._window)
        apply_solid_window_frame(hwnd, show_shadow=True)

    def maximize_to_work_area(self, remember: bool = True) -> None:
        if remember and not self._maximized and not self._is_work_area_maximized():
            current = self._window_rect()
            if current:
                self._restore_bounds = current
        hwnd = self._hwnd()
        self._set_resize_style(False)
        if ctypes.windll.user32.IsZoomed(hwnd):
            ctypes.windll.user32.ShowWindow(hwnd, 9)
        x, y, width, height = self._work_area()
        ctypes.windll.user32.SetWindowPos(hwnd, 0, x, y, width, height, 0x0004)
        self._maximized = True
        if self._window is not None:
            configure_opaque_form(self._window)
        apply_solid_window_frame(hwnd, show_shadow=False)

    def minimize_window(self) -> bool:
        if self._window is not None:
            self._window.minimize()
        return True

    def _set_form_min_size(self, width: int, height: int) -> None:
        form = getattr(self._window, "native", None)
        if form is None:
            return

        def apply() -> None:
            try:
                from System.Drawing import Size

                form.MinimumSize = Size(width, height)
            except Exception:
                pass

        try:
            from System import Action

            if hasattr(form, "InvokeRequired") and form.InvokeRequired and hasattr(form, "Invoke"):
                form.Invoke(Action(apply))
            else:
                apply()
        except Exception:
            apply()

    def toggle_compact_window(self) -> str:
        """精简模式：窗口缩成屏幕中央的对话小窗；再次调用恢复原布局。"""
        if getattr(self, "_compact_bounds", None) is not None:
            return self.exit_compact_window()
        hwnd = self._hwnd()
        if not hwnd:
            return "normal"
        self._compact_was_maximized = self._is_work_area_maximized()
        self._compact_bounds = self._window_rect() or self._default_window_bounds()
        # 精简小窗允许自由缩放，但保留可用的最小对话尺寸。
        self._set_form_min_size(320, 420)
        work_x, work_y, work_width, work_height = self._work_area()
        width = 454
        height = min(756, work_height - 32)
        x = work_x + (work_width - width) // 2
        y = work_y + (work_height - height) // 2
        if ctypes.windll.user32.IsZoomed(hwnd) or ctypes.windll.user32.IsIconic(hwnd):
            ctypes.windll.user32.ShowWindow(hwnd, 9)
        ctypes.windll.user32.SetWindowPos(hwnd, 0, x, y, width, height, 0x0044)
        self._maximized = False
        self._set_resize_style(True)
        if self._window is not None:
            configure_opaque_form(self._window)
        apply_solid_window_frame(hwnd, show_shadow=True)
        return "compact"

    def exit_compact_window(self) -> str:
        bounds = getattr(self, "_compact_bounds", None)
        self._compact_bounds = None
        self._set_form_min_size(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)
        self.set_window_topmost(False)
        if getattr(self, "_compact_was_maximized", False):
            self._compact_was_maximized = False
            self.maximize_to_work_area(remember=False)
            return "normal"
        if bounds:
            self._restore_bounds = bounds
        self.restore_window()
        return "normal"

    def set_window_topmost(self, enabled: bool = True) -> bool:
        hwnd = self._hwnd()
        if not hwnd:
            return False
        # HWND_TOPMOST(-1) / HWND_NOTOPMOST(-2)，SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE
        ctypes.windll.user32.SetWindowPos(hwnd, -1 if enabled else -2, 0, 0, 0, 0, 0x0013)
        return bool(enabled)

    def toggle_maximize_window(self) -> str:
        if self._window is not None and self._is_work_area_maximized():
            self.restore_window()
            return "windowed"
        elif self._window is not None:
            self.maximize_to_work_area()
            return "maximized"
        return "windowed"

    def get_window_state(self) -> str:
        return "maximized" if self._is_work_area_maximized() else "windowed"

    def _is_work_area_maximized(self) -> bool:
        bounds = self._window_rect()
        if not bounds:
            return self._maximized
        left, top, width, height = bounds
        work_left, work_top, work_width, work_height = self._work_area()
        exact_work_area = (
            abs(left - work_left) <= 2
            and abs(top - work_top) <= 2
            and abs(width - work_width) <= 2
            and abs(height - work_height) <= 2
        )
        covers_work_area = width >= work_width - 2 and height >= work_height - 2
        hwnd = self._hwnd()
        return exact_work_area or covers_work_area or bool(
            hwnd and ctypes.windll.user32.IsZoomed(hwnd)
        )

    def _begin_system_interaction(self, message: int, wparam: int) -> bool:
        hwnd = self._hwnd()
        native = self._window.native
        from System import Action

        def interact():
            user32 = ctypes.windll.user32
            user32.ReleaseCapture()
            user32.SendMessageW(hwnd, message, wparam, 0)
            self._restore_bounds = self._window_rect()
            if not self._is_work_area_maximized():
                if self._window is not None:
                    configure_opaque_form(self._window)
                apply_solid_window_frame(hwnd, show_shadow=True)

        native.BeginInvoke(Action(interact))
        return True

    def _begin_pointer_move(self) -> bool:
        hwnd = self._hwnd()
        bounds = self._window_rect()
        if not hwnd or not bounds:
            return False
        if self._move_thread is not None and self._move_thread.is_alive():
            return True

        class Point(ctypes.Structure):
            _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

        user32 = ctypes.windll.user32
        start_cursor = Point()
        if not user32.GetCursorPos(ctypes.byref(start_cursor)):
            return False
        start_left, start_top, _, _ = bounds

        def move_until_release() -> None:
            cursor = Point()
            while user32.IsWindow(hwnd) and (user32.GetAsyncKeyState(0x01) & 0x8000):
                if user32.GetCursorPos(ctypes.byref(cursor)):
                    left = start_left + cursor.x - start_cursor.x
                    top = start_top + cursor.y - start_cursor.y
                    user32.SetWindowPos(hwnd, 0, left, top, 0, 0, 0x0005)
                time.sleep(1 / 120)
            # 拖动结束时若窗口已被切到最大化（如双击标题栏），一律不覆盖
            # 拖动结束时仅记录窗口化尺寸，避免“还原”回到最大化矩形。
            if not self._is_work_area_maximized():
                self._restore_bounds = self._window_rect()
                if self._window is not None:
                    configure_opaque_form(self._window)
                apply_solid_window_frame(hwnd, show_shadow=True)

        self._move_thread = threading.Thread(target=move_until_release, daemon=True)
        self._move_thread.start()
        return True

    def start_native_window_interaction(self, direction: str = "move") -> bool:
        system_commands = {
            "left": 0xF000 | 1,
            "right": 0xF000 | 2,
            "top": 0xF000 | 3,
            "top-left": 0xF000 | 4,
            "top-right": 0xF000 | 5,
            "bottom": 0xF000 | 6,
            "bottom-left": 0xF000 | 7,
            "bottom-right": 0xF000 | 8,
        }
        command = system_commands.get(direction)
        bounds = self._window_rect()
        if direction != "move" and command is None:
            return False
        if not bounds:
            return False
        if self._is_work_area_maximized():
            return False

        self._maximized = False
        if direction == "move":
            return self._begin_pointer_move()
        return self._begin_system_interaction(0x0112, command)

    def close_window(self) -> bool:
        if self._window is not None:
            self._window.destroy()
        return True

    def set_window_backdrop(self, theme: str = "dark") -> bool:
        windowed = not self._is_work_area_maximized()
        if self._window is not None:
            configure_opaque_form(self._window, theme)
        apply_solid_window_frame(self._hwnd(), show_shadow=windowed)
        return True

    def choose_download_folder(self, initial_path: str = "") -> str:
        if self._window is None:
            return ""
        result = self._window.create_file_dialog(20, directory=str(initial_path or ""))
        return str(result[0]) if result else ""

    def choose_save_file(self, suggested_name: str = "") -> dict:
        if self._window is None:
            return {}
        safe_name = Path(str(suggested_name or "media")).name.strip() or "media"
        safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", safe_name)
        suffix = Path(safe_name).suffix.lower()
        labels = {
            ".png": "PNG 图片", ".jpg": "JPEG 图片", ".jpeg": "JPEG 图片",
            ".webp": "WebP 图片", ".gif": "GIF 图片", ".svg": "SVG 图片",
            ".mp4": "MP4 视频", ".webm": "WebM 视频", ".mov": "MOV 视频",
            ".mp3": "MP3 音频", ".wav": "WAV 音频", ".m4a": "M4A 音频",
            ".zip": "ZIP 压缩包",
        }
        file_types = ((f"{labels.get(suffix, '媒体文件')} (*{suffix})",) if suffix else tuple())
        downloads = Path.home() / "Downloads"
        result = self._window.create_file_dialog(
            30,
            directory=str(downloads if downloads.exists() else Path.home()),
            save_filename=safe_name,
            file_types=file_types,
        )
        if not result:
            return {}
        now = time.monotonic()
        for token, (_path, created_at) in list(SAVE_AS_TARGETS.items()):
            if now - created_at > 300:
                SAVE_AS_TARGETS.pop(token, None)
        token = uuid.uuid4().hex
        SAVE_AS_TARGETS[token] = (Path(result[0]), now)
        return {"token": token, "filename": Path(result[0]).name}


def install_local_asset_compat(app) -> None:
    if any(getattr(route, "path", "") == "/api/local-assets/upload" for route in app.routes):
        return

    config_path = Path(os.environ["INFINITE_CANVAS_LOCATION_CONFIG"])
    config = json.loads(config_path.read_text(encoding="utf-8"))
    user_data_dir = Path(config["user_data_dir"])
    local_root = user_data_dir / "assets" / "local"
    thumb_root = local_root / ".thumbs"
    local_root.mkdir(parents=True, exist_ok=True)
    thumb_root.mkdir(parents=True, exist_ok=True)

    def safe_folder(raw: str) -> Path:
        pure = PurePosixPath(str(raw or "").replace("\\", "/").strip("/"))
        parts = [part for part in pure.parts if part not in ("", ".")]
        if (
            pure.is_absolute()
            or ".." in parts
            or any(re.search(r'[<>:"|?*\x00-\x1f]', part) or part.endswith((" ", ".")) for part in parts)
        ):
            raise HTTPException(status_code=400, detail="素材文件夹路径不合法")
        return Path(*parts)

    def safe_name(raw: str) -> str:
        name = Path(str(raw or "media")).name.strip()
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
        return name or "media"

    def media_kind(mime_type: str, suffix: str) -> str:
        if mime_type.startswith("video/") or suffix in {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}:
            return "video"
        if mime_type.startswith("audio/") or suffix in {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}:
            return "audio"
        return "image"

    def thumbnail_for(path: Path, relative: Path) -> tuple[str | None, int | None, int | None]:
        if media_kind(mimetypes.guess_type(path.name)[0] or "", path.suffix.lower()) != "image":
            return None, None, None
        try:
            with Image.open(path) as image:
                width, height = image.size
                if image.format == "SVG":
                    return None, width, height
                thumb_path = (thumb_root / relative).with_suffix(".jpg")
                thumb_path.parent.mkdir(parents=True, exist_ok=True)
                if not thumb_path.exists() or thumb_path.stat().st_mtime < path.stat().st_mtime:
                    preview = image.convert("RGB")
                    preview.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    preview.save(thumb_path, "JPEG", quality=82, optimize=True)
                thumb_relative = thumb_path.relative_to(local_root).as_posix()
                return f"/local-assets-files/{quote(thumb_relative, safe='/')}", width, height
        except Exception:
            return None, None, None

    def item_for(path: Path) -> dict:
        relative = path.relative_to(local_root)
        relative_posix = relative.as_posix()
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        thumbnail, width, height = thumbnail_for(path, relative)
        item = {
            "id": relative_posix,
            "file": relative_posix,
            "name": re.sub(r"^[0-9a-f]{12}_", "", path.name),
            "url": f"/local-assets-files/{quote(relative_posix, safe='/')}",
            "mime_type": mime_type,
            "kind": media_kind(mime_type, path.suffix.lower()),
            "size": path.stat().st_size,
        }
        if thumbnail:
            item["thumbnail"] = thumbnail
        if width and height:
            item["width"] = width
            item["height"] = height
        return item

    def all_items() -> list[dict]:
        return [
            item_for(path)
            for path in sorted(local_root.rglob("*"))
            if path.is_file() and ".thumbs" not in path.parts and path.suffix.lower() in LOCAL_ASSET_EXTENSIONS
        ]

    def library_response() -> dict:
        items = all_items()
        by_parent: dict[str, list[dict]] = {}
        folder_paths = {""}
        for item in items:
            parent = str(PurePosixPath(item["file"]).parent)
            parent = "" if parent == "." else parent
            by_parent.setdefault(parent, []).append(item)
            current = PurePosixPath(parent)
            while str(current) not in ("", "."):
                folder_paths.add(current.as_posix())
                current = current.parent

        def node_for(folder: str) -> dict:
            children = sorted(
                candidate for candidate in folder_paths
                if candidate and str(PurePosixPath(candidate).parent) in (folder, "." if not folder else folder)
            )
            return {
                "id": folder or "__root__",
                "path": folder,
                "name": PurePosixPath(folder).name if folder else "全部上传",
                "items": items if not folder else by_parent.get(folder, []),
                "children": [node_for(child) for child in children],
            }

        return {"items": items, "tree": node_for("")}

    async def save_upload(upload, folder: Path) -> dict:
        original_name = safe_name(getattr(upload, "filename", "media"))
        suffix = Path(original_name).suffix.lower()
        if suffix not in LOCAL_ASSET_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型：{suffix or original_name}")
        destination_dir = local_root / folder
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / f"{uuid.uuid4().hex[:12]}_{original_name}"
        temporary = destination.with_suffix(destination.suffix + ".part")
        total = 0
        try:
            with temporary.open("xb") as output:
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_LOCAL_ASSET_BYTES:
                        raise HTTPException(status_code=413, detail="单个素材不能超过 250 MB")
                    output.write(chunk)
            temporary.replace(destination)
        finally:
            if temporary.exists():
                temporary.unlink()
            await upload.close()
        return item_for(destination)

    @app.get("/api/local-assets")
    async def list_local_assets():
        return library_response()

    @app.post("/api/local-assets/upload")
    async def upload_local_assets(request: Request):
        form = await request.form()
        folder = safe_folder(str(form.get("folder") or ""))
        uploads = [value for key, value in form.multi_items() if key == "files" and hasattr(value, "read")]
        if not uploads:
            raise HTTPException(status_code=400, detail="没有收到可上传的文件")
        files = [await save_upload(upload, folder) for upload in uploads]
        return {"files": files, "count": len(files)}

    @app.post("/api/local-assets/delete")
    async def delete_local_assets(request: Request):
        payload = await request.json()
        deleted = []
        for raw in payload.get("names", []):
            relative = safe_folder(str(raw))
            path = local_root / relative
            if path.is_file() and ".thumbs" not in path.parts:
                path.unlink()
                thumb = (thumb_root / relative).with_suffix(".jpg")
                if thumb.is_file():
                    thumb.unlink()
                deleted.append(relative.as_posix())
        return {"deleted": deleted}

    @app.post("/api/local-assets/import-urls")
    async def import_local_asset_urls(request: Request):
        import httpx

        payload = await request.json()
        folder = safe_folder(str(payload.get("folder") or ""))
        imported = []
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            for source in payload.get("items", []):
                url = str(source.get("url") or "")
                parsed = urlparse(url)
                if parsed.scheme not in {"http", "https"}:
                    raise HTTPException(status_code=400, detail="只支持 HTTP/HTTPS 素材地址")
                name = safe_name(source.get("name") or PurePosixPath(parsed.path).name or "download")
                suffix = Path(name).suffix.lower()
                if suffix not in LOCAL_ASSET_EXTENSIONS:
                    raise HTTPException(status_code=400, detail=f"不支持的文件类型：{suffix or name}")
                destination_dir = local_root / folder
                destination_dir.mkdir(parents=True, exist_ok=True)
                destination = destination_dir / f"{uuid.uuid4().hex[:12]}_{name}"
                temporary = destination.with_suffix(destination.suffix + ".part")
                total = 0
                try:
                    async with client.stream("GET", url) as response:
                        response.raise_for_status()
                        with temporary.open("xb") as output:
                            async for chunk in response.aiter_bytes(1024 * 1024):
                                total += len(chunk)
                                if total > MAX_LOCAL_ASSET_BYTES:
                                    raise HTTPException(status_code=413, detail="单个素材不能超过 250 MB")
                                output.write(chunk)
                    temporary.replace(destination)
                    imported.append(item_for(destination))
                finally:
                    if temporary.exists():
                        temporary.unlink()
        result = library_response()
        result.update({"files": imported, "count": len(imported)})
        return result

    app.mount("/local-assets-files", StaticFiles(directory=local_root), name="local-assets-files")


# 固定的自定义模型名字（按模态）。名字不可改，用户只在 API 设置里为每个
# 名字绑定「中转站 + 该站的真实模型名」；底部输入栏永远显示这些名字。
CUSTOM_MODEL_PRESETS: dict[str, list[str]] = {
    "image": [
        "Nano Banana 2 Lite", "Seedream 5.0 Lite", "Seedream 5.0 Pro",
        "Seedream 4.0", "Seedream 4.5", "GPT Image2",
        "Banana 2", "Banana Pro", "Banana", "MJ V7", "MJ V8.2", "MJ V8.1",
    ],
    "video": [
        "Hailuo-02", "Vidu Q2", "Seedance 2.0", "Seedance 2.0 Fast",
        "Seedance 2.5", "MiniMax H3", "Kling 3.0 Omni", "Gemini Omni Flash",
        "Kling 3.0", "HappyHorse 1.0", "HappyHorse 1.1",
    ],
    "audio": [
        "Mureka V8", "Mureka O2", "Seed Audio 1.0", "MiniMax Music 2.6",
        "ElevenLabs V3", "Sonilo Music", "Minimax-speech-2.8-hd",
        "Minimax-speech-2.8-turbo", "Eleven V3", "Eleven Music V3",
    ],
    "text": [
        "Gemini 3.1 Flash Lite", "DeepSeek V4 Pro", "Gemini 3.1 Pro",
        "Gemini 3 Flash", "GPT-5.6",
    ],
}


def install_custom_model_api(app) -> None:
    """GET/PUT /api/custom-models — fixed alias names bound to relay models.

    The business backend is a compiled main.pyc, so this small persistence
    endpoint lives in the launcher. Data sits next to api_providers.json.
    """
    if any(getattr(route, "path", "") == "/api/custom-models" for route in app.routes):
        return

    config_path = Path(os.environ["INFINITE_CANVAS_LOCATION_CONFIG"])
    store_lock = threading.Lock()

    def store_path() -> Path:
        user_data_dir = ""
        try:
            user_data_dir = str(json.loads(config_path.read_text(encoding="utf-8")).get("user_data_dir") or "")
        except Exception:
            pass
        root = Path(user_data_dir).expanduser() if user_data_dir else config_path.parent / "UserData"
        return root / "data" / "custom_models.json"

    def load_store() -> dict:
        path = store_path()
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
        return {}

    def merged() -> dict:
        """Preset order + names are authoritative; stored bindings merge by name."""
        stored = load_store()
        result: dict[str, list[dict]] = {}
        for mode, names in CUSTOM_MODEL_PRESETS.items():
            rows = stored.get(mode) if isinstance(stored.get(mode), list) else []
            by_name = {str(row.get("name")): row for row in rows if isinstance(row, dict)}
            result[mode] = [
                {
                    "name": name,
                    "provider_id": str(by_name.get(name, {}).get("provider_id") or ""),
                    "model": str(by_name.get(name, {}).get("model") or ""),
                }
                for name in names
            ]
        return result

    @app.get("/api/custom-models")
    async def get_custom_models():
        with store_lock:
            return {"models": merged()}

    @app.put("/api/custom-models")
    async def put_custom_models(request: Request):
        payload = await request.json()
        models = payload.get("models") if isinstance(payload, dict) else None
        if not isinstance(models, dict):
            raise HTTPException(status_code=400, detail="models 字段缺失")
        with store_lock:
            current = merged()
            for mode, rows in models.items():
                if mode not in CUSTOM_MODEL_PRESETS or not isinstance(rows, list):
                    continue
                by_name = {str(row.get("name")): row for row in rows if isinstance(row, dict)}
                for entry in current[mode]:
                    incoming = by_name.get(entry["name"])
                    if incoming is not None:
                        entry["provider_id"] = str(incoming.get("provider_id") or "")
                        entry["model"] = str(incoming.get("model") or "")
            path = store_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"models": current}


def install_download_center_api(app) -> None:
    if any(getattr(route, "path", "") == "/api/download-center" for route in app.routes):
        return

    support_root = Path(os.environ["INFINITE_CANVAS_LOCATION_CONFIG"]).parent
    settings_path = support_root / "download-settings.json"
    history_path = support_root / "download-history.json"
    recommended_path = Path.home() / "Downloads" / "光盒"
    history_lock = threading.Lock()

    def clean_name(raw: str) -> str:
        name = Path(str(raw or "download")).name.strip()
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
        return name or "download"

    def download_root() -> Path:
        selected = ""
        if settings_path.is_file():
            try:
                selected = str(json.loads(settings_path.read_text(encoding="utf-8")).get("path") or "")
            except Exception:
                selected = ""
        root = Path(selected).expanduser() if selected else recommended_path
        root.mkdir(parents=True, exist_ok=True)
        return root.resolve()

    def load_history() -> list[dict]:
        if not history_path.is_file():
            return []
        try:
            records = json.loads(history_path.read_text(encoding="utf-8"))
            return records if isinstance(records, list) else []
        except Exception:
            return []

    def save_history(records: list[dict]) -> None:
        history_path.parent.mkdir(parents=True, exist_ok=True)
        history_path.write_text(json.dumps(records[:300], ensure_ascii=False, indent=2), encoding="utf-8")

    def public_record(record: dict) -> dict:
        path = Path(str(record.get("path") or ""))
        result = dict(record)
        result["exists"] = path.is_file()
        return result

    def unique_destination(root: Path, name: str) -> Path:
        candidate = root / clean_name(name)
        if not candidate.exists():
            return candidate
        stem, suffix = candidate.stem, candidate.suffix
        index = 1
        while True:
            candidate = root / f"{stem} ({index}){suffix}"
            if not candidate.exists():
                return candidate
            index += 1

    def center_payload() -> dict:
        root = download_root()
        with history_lock:
            records = [public_record(record) for record in load_history()]
        return {
            "current_path": str(root),
            "recommended_path": str(recommended_path),
            "records": records,
            "count": len(records),
        }

    @app.get("/api/download-center")
    async def get_download_center():
        return center_payload()

    @app.put("/api/download-center/settings")
    async def set_download_center_settings(request: Request):
        payload = await request.json()
        raw_path = str(payload.get("path") or "").strip()
        if not raw_path:
            raise HTTPException(status_code=400, detail="请选择下载文件夹")
        root = Path(raw_path).expanduser().resolve()
        try:
            root.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise HTTPException(status_code=400, detail=f"无法使用该下载路径：{error}") from error
        settings_path.write_text(json.dumps({"path": str(root)}, ensure_ascii=False, indent=2), encoding="utf-8")
        return center_payload()

    @app.post("/api/download-center/save")
    async def save_download_center_file(request: Request):
        form = await request.form()
        uploads = [value for key, value in form.multi_items() if key == "file" and hasattr(value, "read")]
        if not uploads:
            raise HTTPException(status_code=400, detail="没有收到下载文件")
        root = download_root()
        saved = []
        for upload in uploads:
            destination = unique_destination(root, getattr(upload, "filename", "download"))
            temporary = destination.with_suffix(destination.suffix + ".part")
            total = 0
            try:
                with temporary.open("xb") as output:
                    while chunk := await upload.read(1024 * 1024):
                        total += len(chunk)
                        output.write(chunk)
                temporary.replace(destination)
            finally:
                if temporary.exists():
                    temporary.unlink()
                await upload.close()
            record = {
                "id": uuid.uuid4().hex,
                "name": destination.name,
                "path": str(destination),
                "size": total,
                "mime_type": mimetypes.guess_type(destination.name)[0] or "application/octet-stream",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            with history_lock:
                records = load_history()
                records.insert(0, record)
                save_history(records)
            saved.append(public_record(record))
        return {"files": saved, "count": len(saved), "current_path": str(root)}

    @app.post("/api/download-center/reveal")
    async def reveal_download_center_file(request: Request):
        payload = await request.json()
        record_id = str(payload.get("id") or "")
        record = next((item for item in load_history() if str(item.get("id")) == record_id), None)
        if not record:
            raise HTTPException(status_code=404, detail="下载记录不存在")
        path = Path(str(record.get("path") or ""))
        if not path.is_file():
            raise HTTPException(status_code=404, detail="文件已被移动或删除")
        subprocess.Popen(["explorer.exe", "/select,", str(path)])
        return {"ok": True}

    @app.post("/api/download-center/save-as")
    async def save_file_as(request: Request):
        form = await request.form()
        token = str(form.get("token") or "")
        target_entry = SAVE_AS_TARGETS.pop(token, None)
        upload = form.get("file")
        if target_entry is None or upload is None or not hasattr(upload, "read"):
            raise HTTPException(status_code=400, detail="另存为请求已失效，请重新选择保存位置")
        destination = target_entry[0]
        if not destination.is_absolute() or not destination.parent.is_dir():
            raise HTTPException(status_code=400, detail="保存位置无效")
        temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.part")
        try:
            with temporary.open("wb") as stream:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    stream.write(chunk)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
            await upload.close()
        return {"saved": True, "name": destination.name}

    @app.delete("/api/download-center/{record_id}")
    async def delete_download_center_record(record_id: str):
        with history_lock:
            records = load_history()
            filtered = [item for item in records if str(item.get("id")) != record_id]
            save_history(filtered)
        return {"deleted": len(records) != len(filtered)}


def install_no_cache_headers(app) -> None:
    import re as _re
    import time as _time
    from starlette.responses import Response as _Response

    # 每次启动一个唯一版本戳：HTML/JS 里写死的 ?v=… 全部在响应时动态改写。
    # 这样即使磁盘上的 HTML 被外部同步/编辑器回滚成旧版本号，WebView2 的
    # 启发式磁盘缓存也永远不会命中旧条目（URL 每次启动都不同）。
    _boot_stamp = str(int(_time.time()))
    _version_re = _re.compile(rb"v=20\d{2}\.\d{2}\.\d{2}\.\d+")

    @app.middleware("http")
    async def disable_desktop_static_cache(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path == "/" or path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            ctype = (response.headers.get("content-type") or "").lower()
            if response.status_code == 200 and ("text/html" in ctype or "javascript" in ctype):
                try:
                    chunks = [chunk async for chunk in response.body_iterator]
                    body = _version_re.sub(b"v=" + _boot_stamp.encode(), b"".join(chunks))
                    headers = dict(response.headers)
                    headers.pop("content-length", None)
                    headers.pop("etag", None)
                    headers.pop("last-modified", None)
                    return _Response(
                        content=body,
                        status_code=response.status_code,
                        headers=headers,
                        media_type=response.media_type,
                    )
                except Exception:
                    pass
        return response


def _log_video_diag(line: str) -> None:
    try:
        log_path = (
            Path(os.environ.get("LOCALAPPDATA", str(Path.home())))
            / "Lightbox-Windows-Clean"
            / "video-upstream.log"
        )
        with log_path.open("a", encoding="utf-8") as fh:
            fh.write(f"[{datetime.now().isoformat(timespec='seconds')}] {line}\n")
    except Exception:
        pass


def install_relay_video_adapter() -> None:
    """海螺（MiniMax）视频在 yuli.host 中转站上的接口适配。

    官方文档（https://yuliapi.apifox.cn/api-479751949）明确：海螺提交任务
    走 {根地址}/minimax/v1/video_generation，这正是内置实现的首选路径。
    此前误把 /v1/{action} 插到最前面，结果命中了中转站另一条分组路由，
    稳定返回"当前分组上游负载已饱和"。现在恢复内置候选（/minimax/v1/
    优先）并只把 /v1/ 追加到队尾作兜底。

    normalized_root 继续容错用户把 base_url 误填成完整接口路径的情况
    （例如 https://yuli.host/v1/video_generation）。
    """
    try:
        from modules.video_generation import minimax_helpers
    except Exception:
        return

    def normalized_root(base_url) -> str:
        root = str(base_url or "").rstrip("/")
        for suffix in ("/query/video_generation", "/video_generation"):
            if root.endswith(suffix):
                root = root[: -len(suffix)]
        if root.endswith(("/v1", "/v2")):
            root = root.rsplit("/", 1)[0]
        return root

    original = minimax_helpers.minimax_video_url_candidates

    def patched(base_url, action):
        root = normalized_root(base_url)
        urls = []
        for url in original(root, action):
            if url not in urls:
                urls.append(url)
        fallback = f"{root}/v1/{action}"
        if fallback not in urls:
            urls.append(fallback)
        _log_video_diag(f"url candidates action={action!r} base={base_url!r} -> {urls!r}")
        return urls

    minimax_helpers.minimax_video_url_candidates = patched
    # 其他模块（如 legacy.wiring）可能在 import 时就把这个函数名绑进了
    # 自己的命名空间，模块属性替换对它们无效，必须逐个覆盖同名引用。
    for module in list(sys.modules.values()):
        if module is None or module is minimax_helpers:
            continue
        if getattr(module, "minimax_video_url_candidates", None) is original:
            module.minimax_video_url_candidates = patched

    # 诊断日志：中转站返回的原始报错会被包装成友好提示（如"负载饱和"），
    # 排查分组/额度问题需要原文。这里旁路记录，不改变行为。
    original_message = minimax_helpers.minimax_hailuo_upstream_message

    def logged_message(*args, **kwargs):
        _log_video_diag(f"upstream args={str(args)[:700]!r} kwargs={str(kwargs)[:700]!r}")
        return original_message(*args, **kwargs)

    minimax_helpers.minimax_hailuo_upstream_message = logged_message
    for module in list(sys.modules.values()):
        if module is not None and getattr(module, "minimax_hailuo_upstream_message", None) is original_message:
            module.minimax_hailuo_upstream_message = logged_message


def install_relay_video_query_translator() -> None:
    """newapi 系中转站（yuli.host 等）查询海螺任务返回的是任务包装格式：
    {code, message, data:{task_id, status:'SUCCESS'/..., fail_reason, data:{videos:[{videoURL}]}}}
    内置实现只认 MiniMax 官方格式 {task_id, status:'Success'/'Fail'..., file_id}，
    于是提交成功（已扣费）后第一次轮询就被当作失败终止——这正是"扣了费
    却生成失败"的根因。这里在 HTTP 客户端层（运行时只有 httpx / requests）
    把包装格式翻译回官方格式：
      - SUBMITTED / QUEUED / IN_PROGRESS 等 -> Processing，让轮询继续；
      - SUCCESS -> Success，直接带上 videoURL，并合成 file_id；
      - 随后的 /files/retrieve 调用凭合成的 file_id 本地短路返回
        download_url（中转站没有官方的文件取件接口）。
    官方格式的响应原样放行，不影响直连 MiniMax 的用户。
    """
    import json
    import uuid
    from urllib.parse import parse_qs, urlsplit

    file_url_map: dict = {}
    OFFICIAL_STATUSES = {"Queueing", "Preparing", "Processing", "Success", "Fail"}
    FINAL_MAP = {"SUCCESS": "Success", "FAILURE": "Fail", "FAILED": "Fail", "FAIL": "Fail"}

    def find_video_url(obj):
        # 先找视频专属字段，找不到再退回通用字段，避免误拿封面图地址
        for keys in (("videoURL", "video_url"), ("downloadURL", "download_url", "url")):
            stack = [obj]
            while stack:
                cur = stack.pop()
                if isinstance(cur, dict):
                    for key in keys:
                        val = cur.get(key)
                        if isinstance(val, str) and val.startswith("http"):
                            return val
                    stack.extend(cur.values())
                elif isinstance(cur, list):
                    stack.extend(cur)
        return None

    def summarize_submit_body(body):
        # 提交体里的参考图多为超长 base64，只记录形态和开头，避免日志爆炸
        try:
            payload = json.loads(bytes(body).decode("utf-8"))
        except Exception:
            return f"non-json len={len(body)}"
        if not isinstance(payload, dict):
            return f"non-dict {str(payload)[:120]!r}"
        parts = []
        for key, val in payload.items():
            if isinstance(val, str) and len(val) > 120:
                parts.append(f"{key}=<len={len(val)} head={val[:80]!r}>")
            else:
                parts.append(f"{key}={str(val)[:120]!r}")
        return " ".join(parts)

    def translate_query_body(body):
        try:
            payload = json.loads(bytes(body).decode("utf-8"))
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        top_status = payload.get("status")
        if isinstance(top_status, str):
            if top_status in OFFICIAL_STATUSES:
                return None
            # 中转站直出的非官方拼写（如 "Failed"）：翻成官方失败格式并
            # 带上原因原文，界面能显示真实报错而不是猜一个
            if FINAL_MAP.get(top_status.strip().upper()) == "Fail":
                reason = (
                    payload.get("error")
                    or payload.get("fail_reason")
                    or payload.get("message")
                    or "上游任务失败"
                )
                return json.dumps({
                    "task_id": str(payload.get("task_id") or ""),
                    "status": "Fail",
                    "base_resp": {"status_code": 1, "status_msg": str(reason)},
                }).encode("utf-8")
        data = payload.get("data")
        if not isinstance(data, dict):
            return None
        raw_status = str(data.get("status") or "").strip().upper()
        if not raw_status:
            return None
        status = FINAL_MAP.get(raw_status, "Processing")
        out = {
            "task_id": str(data.get("task_id") or ""),
            "status": status,
            "base_resp": {"status_code": 0, "status_msg": "success"},
        }
        if status == "Fail":
            reason = data.get("fail_reason") or payload.get("message") or "上游任务失败"
            out["base_resp"] = {"status_code": 1, "status_msg": str(reason)}
        elif status == "Success":
            url = find_video_url(data)
            if url:
                token = uuid.uuid4().hex
                file_url_map[token] = url
                out["file_id"] = token
                out["video_url"] = url
                out["download_url"] = url
            else:
                # 状态已 SUCCESS 但产物地址还没同步出来，继续轮询
                out["status"] = "Processing"
        return json.dumps(out).encode("utf-8")

    def fake_retrieve_body(url_str):
        try:
            qs = parse_qs(urlsplit(url_str).query)
            token = (qs.get("file_id") or [""])[0]
        except Exception:
            return None
        video_url = file_url_map.get(token)
        if not video_url:
            return None
        body = {
            "file": {"file_id": token, "download_url": video_url},
            "base_resp": {"status_code": 0, "status_msg": "success"},
        }
        return json.dumps(body).encode("utf-8")

    try:
        import httpx
    except Exception:
        httpx = None
    if httpx is not None:
        def build_httpx_response(request, content):
            return httpx.Response(
                200,
                request=request,
                content=content,
                headers={"content-type": "application/json"},
            )

        orig_sync_send = httpx.Client.send

        def sync_send(self, request, *args, **kwargs):
            url_str = str(request.url)
            if "files/retrieve" in url_str:
                fake = fake_retrieve_body(url_str)
                if fake is not None:
                    _log_video_diag(f"httpx retrieve short-circuit {url_str[:200]!r}")
                    return build_httpx_response(request, fake)
            if "video_generation" in url_str and "query/video_generation" not in url_str:
                try:
                    _log_video_diag(f"httpx submit {url_str[:120]} {summarize_submit_body(request.content)}")
                except Exception:
                    pass
            response = orig_sync_send(self, request, *args, **kwargs)
            if "query/video_generation" in url_str:
                try:
                    response.read()
                    _log_video_diag(f"httpx query {response.status_code} {response.content[:600]!r}")
                    translated = translate_query_body(response.content)
                    if translated is not None:
                        return build_httpx_response(request, translated)
                except Exception as exc:
                    _log_video_diag(f"httpx translate error {exc!r}")
            return response

        httpx.Client.send = sync_send

        orig_async_send = httpx.AsyncClient.send

        async def async_send(self, request, *args, **kwargs):
            url_str = str(request.url)
            if "files/retrieve" in url_str:
                fake = fake_retrieve_body(url_str)
                if fake is not None:
                    _log_video_diag(f"httpx-async retrieve short-circuit {url_str[:200]!r}")
                    return build_httpx_response(request, fake)
            if "video_generation" in url_str and "query/video_generation" not in url_str:
                try:
                    _log_video_diag(f"httpx-async submit {url_str[:120]} {summarize_submit_body(request.content)}")
                except Exception:
                    pass
            response = await orig_async_send(self, request, *args, **kwargs)
            if "query/video_generation" in url_str:
                try:
                    await response.aread()
                    _log_video_diag(f"httpx-async query {response.status_code} {response.content[:600]!r}")
                    translated = translate_query_body(response.content)
                    if translated is not None:
                        return build_httpx_response(request, translated)
                except Exception as exc:
                    _log_video_diag(f"httpx-async translate error {exc!r}")
            return response

        httpx.AsyncClient.send = async_send

    try:
        import requests
    except Exception:
        requests = None
    if requests is not None:
        orig_requests_send = requests.sessions.Session.send

        def requests_send(self, request, *args, **kwargs):
            url_str = str(getattr(request, "url", "") or "")
            if "files/retrieve" in url_str:
                fake = fake_retrieve_body(url_str)
                if fake is not None:
                    _log_video_diag(f"requests retrieve short-circuit {url_str[:200]!r}")
                    resp = requests.models.Response()
                    resp.status_code = 200
                    resp._content = fake
                    resp.headers["content-type"] = "application/json"
                    resp.url = url_str
                    resp.request = request
                    return resp
            response = orig_requests_send(self, request, *args, **kwargs)
            if "query/video_generation" in url_str:
                try:
                    _log_video_diag(f"requests query {response.status_code} {response.content[:600]!r}")
                    translated = translate_query_body(response.content)
                    if translated is not None:
                        response._content = translated
                        response.status_code = 200
                        response.headers["content-type"] = "application/json"
                except Exception as exc:
                    _log_video_diag(f"requests translate error {exc!r}")
            return response

        requests.sessions.Session.send = requests_send

    # 标准库 urllib 兜底（编译模块也可能直接用 urlopen）。补丁打在
    # OpenerDirector.open 上：即使模块 from urllib.request import urlopen
    # 提前绑定了函数名，内部仍会走到 opener.open。
    import io
    import urllib.error as _urlerr
    import urllib.request as _urlreq
    import urllib.response as _urlresp
    from email.message import Message

    orig_opener_open = _urlreq.OpenerDirector.open

    def _json_urllib_response(url_str, body, code=200):
        headers = Message()
        headers["content-type"] = "application/json"
        return _urlresp.addinfourl(io.BytesIO(body), headers, url_str, code)

    def opener_open(self, fullurl, data=None, *args, **kwargs):
        url_str = fullurl.full_url if hasattr(fullurl, "full_url") else str(fullurl)
        if "files/retrieve" in url_str:
            fake = fake_retrieve_body(url_str)
            if fake is not None:
                _log_video_diag(f"urllib retrieve short-circuit {url_str[:200]!r}")
                return _json_urllib_response(url_str, fake)
        if "query/video_generation" not in url_str:
            return orig_opener_open(self, fullurl, data, *args, **kwargs)
        try:
            response = orig_opener_open(self, fullurl, data, *args, **kwargs)
            raw = response.read()
            status = getattr(response, "status", 200)
        except _urlerr.HTTPError as exc:
            try:
                raw = exc.read()
            except Exception:
                raise exc
            status = exc.code
            response = None
        _log_video_diag(f"urllib query {status} {raw[:600]!r}")
        translated = translate_query_body(raw)
        if translated is not None:
            return _json_urllib_response(url_str, translated)
        if response is None:
            # 非包装格式的 HTTP 错误照原样抛出
            raise _urlerr.HTTPError(url_str, status, "upstream error", Message(), io.BytesIO(raw))
        # 原响应体已被读取，重新包一层返回
        return _urlresp.addinfourl(io.BytesIO(raw), response.headers, url_str, status)

    _urlreq.OpenerDirector.open = opener_open


def main() -> None:
    os.chdir(SERVICE_DIR)
    sys.path.insert(0, str(SERVICE_DIR))
    sys.argv[0] = str(Path(__file__).resolve())
    sys.dont_write_bytecode = True

    instance_mutex = acquire_single_instance()
    if instance_mutex is None:
        return

    port = reserve_private_port()
    configure_user_data(port)

    import uvicorn
    import webview
    from main import app

    # Diagnostics only: LIGHTBOX_REMOTE_DEBUG_PORT=9223 exposes the WebView2
    # devtools protocol on localhost. Off unless the env var is set.
    _debug_port = os.environ.get("LIGHTBOX_REMOTE_DEBUG_PORT", "").strip()
    if _debug_port.isdigit():
        webview.settings["REMOTE_DEBUGGING_PORT"] = int(_debug_port)

    install_local_asset_compat(app)
    install_download_center_api(app)
    install_custom_model_api(app)
    install_no_cache_headers(app)
    install_relay_video_adapter()
    install_relay_video_query_translator()
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="critical",
        access_log=False,
        loop="asyncio",
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, name="LightboxLocalService", daemon=True)
    server_thread.start()

    try:
        wait_until_ready(port)
        from native_splash import run_native_splash

        startup_finished = threading.Event()
        stop_startup = threading.Event()
        main_window_ready = threading.Event()
        startup_thread = threading.Thread(
            target=run_native_splash,
            args=(startup_finished, stop_startup),
            name="LightboxNativeStartup",
            daemon=True,
        )
        startup_thread.start()

        bridge = DesktopBridge()
        initial_theme = "light" if 6 <= datetime.now().hour < 18 else "dark"
        # Opaque host — transparency/layered modes break WebView2 composition
        # on Win10; windowed corners are rounded via SetWindowRgn (see
        # apply_rounded_window_region), maximized stays square.
        initial_window_color = "#fafafb" if initial_theme == "light" else "#1b1b1b"
        window = webview.create_window(
            APP_TITLE,
            url=f"{app_url(port)}?desktop=1&startup={uuid.uuid4().hex}",
            js_api=bridge,
            width=1600,
            height=1000,
            min_size=(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT),
            resizable=True,
            hidden=True,
            frameless=True,
            transparent=False,
            easy_drag=False,
            background_color=initial_window_color,
            text_select=False,
        )
        bridge._window = window
        # 启动即按初始主题设置宿主底色，JS 就绪后 set_window_backdrop 会继续跟随主题
        configure_opaque_form(window, initial_theme)

        def request_shutdown() -> None:
            server.should_exit = True

        def mark_main_window_ready(window) -> None:
            main_window_ready.set()

        def finish_startup() -> None:
            startup_finished.wait(timeout=6.0)
            main_window_ready.wait(timeout=15.0)
            try:
                configure_opaque_form(window)
                bridge.show_default_window()
                bridge.set_window_backdrop(initial_theme)
                window.show()
                time.sleep(0.12)
                bridge.enable_standard_taskbar_behavior()
                configure_opaque_form(window)
                install_window_frame_refresh(window, bridge)
                hwnd = bridge._hwnd()
                # Transparent EdgeChromium sometimes leaves the form parked at
                # (-32000,-32000) after the library's hide/show hack — force it
                # back onto a real windowed placement.
                if hwnd:
                    rect = bridge._window_rect()
                    if (
                        not rect
                        or rect[0] < -10000
                        or rect[1] < -10000
                        or rect[2] < 400
                        or rect[3] < 300
                    ):
                        bridge.show_default_window()
                    ctypes.windll.user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                    ctypes.windll.user32.SetForegroundWindow(hwnd)
                    configure_opaque_form(window)
                    apply_solid_window_frame(hwnd, show_shadow=True)
                    window_shadow.attach(window)
                    apply_solid_window_frame(hwnd, show_shadow=True)
                    # pywebview may re-apply Padding after Navigating — punch again.
                    time.sleep(0.35)
                    configure_opaque_form(window)
                    apply_solid_window_frame(hwnd, show_shadow=True)
                    time.sleep(0.5)
                    apply_solid_window_frame(hwnd, show_shadow=True)
            finally:
                stop_startup.set()

        window.events.loaded += mark_main_window_ready
        window.events.closing += request_shutdown
        threading.Thread(target=finish_startup, name="LightboxStartupTransition", daemon=True).start()

        support_root = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Lightbox-Windows-Clean"
        webview.start(
            gui="edgechromium",
            debug=False,
            private_mode=False,
            storage_path=str(support_root / "WebView2"),
        )
    finally:
        if "stop_startup" in locals():
            stop_startup.set()
        server.should_exit = True
        server_thread.join(timeout=8)
        if server_thread.is_alive():
            server.force_exit = True
            server_thread.join(timeout=2)
        ctypes.windll.kernel32.CloseHandle(instance_mutex)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception:
        local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        log_path = local_app_data / "Lightbox-Windows-Clean" / "launcher-error.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(traceback.format_exc(), encoding="utf-8")
