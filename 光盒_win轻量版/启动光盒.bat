@echo off
cd /d "%~dp0"
set "PYTHONDONTWRITEBYTECODE=1"
if exist "%~dp0启动光盒.exe" (
    start "" "%~dp0启动光盒.exe"
) else (
    start "" "%~dp0runtime\python\pythonw.exe" -B "%~dp0runtime\service\win_launcher.py"
)
exit /b 0
