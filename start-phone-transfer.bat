@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js 18 或更高版本。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
node start-phone-transfer.js
pause
