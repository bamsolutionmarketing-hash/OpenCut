@echo off
REM One-command launcher for OpenCut Desktop (dev mode) on Windows.
REM Usage:  apps\electron\run.bat

cd /d "%~dp0"

where bun >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: bun is not installed or not on PATH.
    echo.
    echo This repo requires bun (it is the locked package manager).
    echo Install it in PowerShell with:
    echo     powershell -c "irm bun.sh/install.ps1 ^| iex"
    echo Then close and reopen your terminal so PATH picks it up.
    echo.
    exit /b 1
)

if not exist node_modules (
    echo --^> installing apps\electron deps ...
    call bun install || exit /b 1
)

if not exist node_modules\electron\dist\electron.exe (
    echo --^> downloading Electron binary ...
    call node node_modules\electron\install.js || exit /b 1
)

if not exist "..\web\node_modules" (
    echo --^> installing apps\web deps ...
    pushd ..\..
    call bun install || (popd & exit /b 1)
    popd
)

if not exist "..\web\.env.local" (
    if exist "..\web\.env.example" (
        echo --^> creating apps\web\.env.local from .env.example
        copy /Y "..\web\.env.example" "..\web\.env.local" >nul
    )
)

call bun run dev
