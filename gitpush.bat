@echo off
setlocal

echo.
echo  Anvil FORGE — Git Push
echo  ─────────────────────────────
echo.

cd /d "%~dp0"

git fetch origin >nul 2>&1

echo  Changed files:
echo  ─────────────────────────────
git status --short
echo  ─────────────────────────────
echo.

for /f %%i in ('git status --porcelain') do set HASCHANGES=1

if not defined HASCHANGES (
  echo  Nothing to push. Already up to date.
  echo.
  pause
  exit /b 0
)

set /p MSG="Commit message (or Enter to cancel): "

if "%MSG%"=="" (
  echo Cancelled.
  pause
  exit /b 0
)

git add -A
git commit -m "%MSG%"
git push origin main

echo.
echo  Done.
pause