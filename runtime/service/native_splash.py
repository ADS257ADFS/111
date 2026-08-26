"""Transparent native startup animation for Lightbox on Windows."""

from __future__ import annotations

import ctypes
import math
import time
from ctypes import wintypes
from pathlib import Path
from threading import Event

from PIL import Image, ImageDraw, ImageFont


WS_EX_TOPMOST = 0x00000008
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_LAYERED = 0x00080000
WS_EX_NOACTIVATE = 0x08000000
WS_POPUP = 0x80000000
SW_SHOWNOACTIVATE = 4
ULW_ALPHA = 0x00000002
AC_SRC_ALPHA = 0x01
PM_REMOVE = 0x0001
SPI_GETWORKAREA = 0x0030

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32
user32.DefWindowProcW.restype = ctypes.c_ssize_t
user32.CreateWindowExW.restype = wintypes.HWND
user32.GetDC.restype = wintypes.HDC
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateDIBSection.restype = wintypes.HANDLE
gdi32.SelectObject.restype = wintypes.HANDLE
kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.GetDC.argtypes = [wintypes.HWND]
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.DestroyWindow.argtypes = [wintypes.HWND]
user32.UnregisterClassW.argtypes = [wintypes.LPCWSTR, wintypes.HINSTANCE]
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]
gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
gdi32.DeleteDC.argtypes = [wintypes.HDC]


class Point(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class Size(ctypes.Structure):
    _fields_ = [("cx", ctypes.c_long), ("cy", ctypes.c_long)]


class Rect(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class BlendFunction(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


class BitmapInfoHeader(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class BitmapInfo(ctypes.Structure):
    _fields_ = [("bmiHeader", BitmapInfoHeader), ("bmiColors", wintypes.DWORD * 3)]


class Message(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("message", wintypes.UINT),
        ("wParam", wintypes.WPARAM),
        ("lParam", wintypes.LPARAM),
        ("time", wintypes.DWORD),
        ("pt", Point),
    ]


WindowProc = ctypes.WINFUNCTYPE(
    ctypes.c_ssize_t,
    wintypes.HWND,
    wintypes.UINT,
    wintypes.WPARAM,
    wintypes.LPARAM,
)


class WindowClass(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT),
        ("lpfnWndProc", WindowProc),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HANDLE),
        ("hCursor", wintypes.HANDLE),
        ("hbrBackground", wintypes.HANDLE),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
    ]


user32.RegisterClassW.argtypes = [ctypes.POINTER(WindowClass)]
user32.CreateWindowExW.argtypes = [
    wintypes.DWORD,
    wintypes.LPCWSTR,
    wintypes.LPCWSTR,
    wintypes.DWORD,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.HWND,
    wintypes.HANDLE,
    wintypes.HINSTANCE,
    wintypes.LPVOID,
]
gdi32.CreateDIBSection.argtypes = [
    wintypes.HDC,
    ctypes.POINTER(BitmapInfo),
    wintypes.UINT,
    ctypes.POINTER(ctypes.c_void_p),
    wintypes.HANDLE,
    wintypes.DWORD,
]
user32.UpdateLayeredWindow.argtypes = [
    wintypes.HWND,
    wintypes.HDC,
    ctypes.POINTER(Point),
    ctypes.POINTER(Size),
    wintypes.HDC,
    ctypes.POINTER(Point),
    wintypes.DWORD,
    ctypes.POINTER(BlendFunction),
    wintypes.DWORD,
]


def _window_proc(hwnd, message, wparam, lparam):
    return user32.DefWindowProcW(hwnd, message, wparam, lparam)


WINDOW_PROC = WindowProc(_window_proc)


def _font(size: int):
    bundled = Path(__file__).resolve().parent / "static" / "vendor" / "fonts" / "inter-2.ttf"
    if bundled.is_file():
        return ImageFont.truetype(str(bundled), size=size)
    for name in ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"):
        path = Path("C:/Windows/Fonts") / name
        if path.is_file():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _opacity(progress: float) -> float:
    if progress <= 0 or progress >= 1:
        return 0.0
    if progress <= 0.15:
        return progress / 0.15
    if progress <= 0.65:
        return 1.0 - (progress - 0.15) / 0.5
    return 0.0


def _letter_opacity(progress: float) -> float:
    if progress <= 0 or progress >= 1:
        return 0.0
    if progress <= 0.05:
        return progress / 0.05
    if progress <= 0.2:
        return 1.0 - 0.8 * (progress - 0.05) / 0.15
    return 0.2 * (1.0 - (progress - 0.2) / 0.8)


def _frame(width: int, height: int, elapsed: float) -> Image.Image:
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    progress = min(1.0, elapsed / 4.0)
    stripe_alpha = _opacity(progress)

    text = "Generating"
    font = _font(max(18, min(92, round(width * 0.108))))
    advances = [draw.textlength(letter, font=font) for letter in text]
    text_width = sum(advances)
    x = (width - text_width) / 2
    text_box = draw.textbbox((0, 0), text, font=font)
    baseline = (height - (text_box[3] - text_box[1])) / 2 - text_box[1]
    delays = (0.1, 0.205, 0.31, 0.415, 0.521, 0.626, 0.731, 0.837, 0.942, 1.047)

    transform_phase = (elapsed % 4.0) / 2.0
    transform_t = transform_phase if transform_phase <= 1.0 else 2.0 - transform_phase
    transform_t = transform_t * transform_t * (3.0 - 2.0 * transform_t)
    motion = -0.55 + 1.1 * transform_t
    center_x = width / 2 + motion * text_width
    center_y = height / 2
    radius = height * 0.46
    stripe_step = max(8, round(width / 108))
    stripe_width = max(1, round(stripe_step / 4))
    first_stripe = max(0, int((center_x - radius) // stripe_step) * stripe_step)
    last_stripe = min(width, math.ceil((center_x + radius) / stripe_step) * stripe_step)
    gradients = (
        ((255, 255, 0), center_x, center_y, radius),
        ((255, 0, 0), center_x - radius * 0.10, center_y - radius * 0.10, radius * 0.90),
        ((0, 255, 255), center_x + radius * 0.10, center_y + radius * 0.10, radius * 0.90),
        ((0, 255, 0), center_x - radius * 0.10, center_y + radius * 0.10, radius * 0.90),
        ((0, 0, 255), center_x + radius * 0.10, center_y - radius * 0.10, radius * 0.90),
    )
    for stripe_x in range(first_stripe, last_stripe, stripe_step):
        for y in range(max(0, round(center_y - radius)), min(height, round(center_y + radius))):
            weights = []
            for color, gradient_x, gradient_y, gradient_radius in gradients:
                distance = math.hypot(stripe_x - gradient_x, y - gradient_y)
                weight = max(0.0, 1.0 - distance / gradient_radius)
                if weight > 0:
                    weights.append((color, weight))
            if not weights:
                continue
            distance_from_center = math.hypot(stripe_x - center_x, y - center_y)
            radial_mask = max(0.0, min(1.0, (distance_from_center / radius - 0.10) / 0.15))
            total_weight = sum(weight for _, weight in weights)
            red = round(sum(color[0] * weight for color, weight in weights) / total_weight)
            green = round(sum(color[1] * weight for color, weight in weights) / total_weight)
            blue = round(sum(color[2] * weight for color, weight in weights) / total_weight)
            alpha = round(255 * stripe_alpha * radial_mask * min(1.0, total_weight))
            if alpha > 0:
                draw.line(
                    (stripe_x, y, min(width - 1, stripe_x + stripe_width - 1), y),
                    fill=(red, green, blue, alpha),
                    width=1,
                )

    for letter, advance, delay in zip(text, advances, delays):
        local_progress = (elapsed - delay) / 4.0
        alpha = round(255 * _letter_opacity(local_progress))
        if alpha > 0:
            glow = max(0, min(90, alpha // 3))
            for offset_x, offset_y in ((-2, 0), (2, 0), (0, -2), (0, 2)):
                draw.text((x + offset_x, baseline + offset_y), letter, font=font, fill=(255, 255, 255, glow))
            draw.text((x, baseline - (2 if local_progress <= 0.05 else 0)), letter, font=font, fill=(255, 255, 255, alpha))
        x += advance

    return image


def _pump_messages() -> None:
    message = Message()
    while user32.PeekMessageW(ctypes.byref(message), None, 0, 0, PM_REMOVE):
        user32.TranslateMessage(ctypes.byref(message))
        user32.DispatchMessageW(ctypes.byref(message))


def run_native_splash(finished: Event, stop: Event) -> None:
    work = Rect()
    if not user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(work), 0):
        finished.set()
        return

    work_width = work.right - work.left
    work_height = work.bottom - work.top
    width = max(320, round(work_width / 3))
    height = max(80, round(width / 4))
    x = work.left + (work_width - width) // 2
    y = work.top + (work_height - height) // 2
    instance = kernel32.GetModuleHandleW(None)
    class_name = f"LightboxStartup_{kernel32.GetCurrentProcessId()}"
    window_class = WindowClass(
        0,
        WINDOW_PROC,
        0,
        0,
        instance,
        None,
        None,
        None,
        None,
        class_name,
    )
    if not user32.RegisterClassW(ctypes.byref(window_class)):
        finished.set()
        return

    hwnd = user32.CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
        class_name,
        "",
        WS_POPUP,
        x,
        y,
        width,
        height,
        None,
        None,
        instance,
        None,
    )
    if not hwnd:
        finished.set()
        return

    screen_dc = user32.GetDC(None)
    memory_dc = gdi32.CreateCompatibleDC(screen_dc)
    bitmap_info = BitmapInfo()
    bitmap_info.bmiHeader.biSize = ctypes.sizeof(BitmapInfoHeader)
    bitmap_info.bmiHeader.biWidth = width
    bitmap_info.bmiHeader.biHeight = -height
    bitmap_info.bmiHeader.biPlanes = 1
    bitmap_info.bmiHeader.biBitCount = 32
    bits = ctypes.c_void_p()
    bitmap = gdi32.CreateDIBSection(
        screen_dc,
        ctypes.byref(bitmap_info),
        0,
        ctypes.byref(bits),
        None,
        0,
    )
    previous = gdi32.SelectObject(memory_dc, bitmap)
    destination = Point(x, y)
    source = Point(0, 0)
    size = Size(width, height)
    blend = BlendFunction(0, 0, 255, AC_SRC_ALPHA)

    try:
        user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)
        started = time.perf_counter()
        while not stop.is_set():
            elapsed = time.perf_counter() - started
            rendered = _frame(width, height, min(elapsed, 4.0)).convert("RGBa")
            pixels = rendered.tobytes("raw", "BGRa")
            ctypes.memmove(bits.value, pixels, len(pixels))
            user32.UpdateLayeredWindow(
                hwnd,
                screen_dc,
                ctypes.byref(destination),
                ctypes.byref(size),
                memory_dc,
                ctypes.byref(source),
                0,
                ctypes.byref(blend),
                ULW_ALPHA,
            )
            _pump_messages()
            if elapsed >= 4.1:
                finished.set()
                stop.wait(0.03)
            else:
                time.sleep(max(0.0, 1 / 30 - (time.perf_counter() - started - elapsed)))
    finally:
        finished.set()
        user32.DestroyWindow(hwnd)
        gdi32.SelectObject(memory_dc, previous)
        gdi32.DeleteObject(bitmap)
        gdi32.DeleteDC(memory_dc)
        user32.ReleaseDC(None, screen_dc)
        user32.UnregisterClassW(class_name, instance)
