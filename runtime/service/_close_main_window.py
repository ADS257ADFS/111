"""One-off: gracefully close the Lightbox main window (WM_CLOSE) by pid."""
import ctypes
import ctypes.wintypes
import sys

user32 = ctypes.windll.user32
target_pid = int(sys.argv[1])
closed = []


@ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
def enum_proc(hwnd, _lparam):
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value == target_pid and user32.IsWindowVisible(hwnd):
        rect = ctypes.wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        if rect.right - rect.left > 500 and rect.bottom - rect.top > 400:
            user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
            closed.append(hwnd)
    return True


user32.EnumWindows(enum_proc, 0)
print("CLOSED" if closed else "NO_WINDOW", closed)
