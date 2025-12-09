@echo off
title Bachelor Party Game Launcher
color 0A

echo.
echo ===================================
echo    Bachelor Party Game Launcher
echo ===================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Stop any existing processes
echo [INFO] Stopping any existing processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 2 >nul

:: Install cloudflared if not exists
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing cloudflared...
    npm install -g cloudflared
)

:: Start the development server
echo [INFO] Starting game server...
start "Game Server" cmd /k "npm run dev"
timeout /t 5 >nul

:: Start Cloudflare tunnel
echo [INFO] Creating public URL...
cloudflared tunnel --url http://localhost:5173

pause