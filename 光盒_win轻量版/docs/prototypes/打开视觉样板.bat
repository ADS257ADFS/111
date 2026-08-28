@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  正在用浏览器打开「光盒视觉样板」...
echo  文件夹：%cd%
echo.
start "" "%~dp0index.html"
timeout /t 3 >nul
