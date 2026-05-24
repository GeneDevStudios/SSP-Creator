@echo off
setlocal enabledelayedexpansion

echo.
echo  Anvil FORGE — Release Publisher
echo  ─────────────────────────────────────
echo.

cd /d "%~dp0"

:: Read current version from package.json
for /f "tokens=2 delims=:, " %%V in ('findstr /i "\"version\"" package.json') do (
  set CURRENT=%%~V
  goto :gotversion
)
:gotversion

echo  Current version : %CURRENT%
echo.
set /p NEWVER="New version (e.g. 1.0.2) or Enter to cancel: "

if "%NEWVER%"=="" (
  echo Cancelled.
  pause
  exit /b 0
)

:: Basic format check — must contain two dots
echo %NEWVER% | findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo  Invalid version format. Use MAJOR.MINOR.PATCH ^(e.g. 1.0.2^)
  pause
  exit /b 1
)

:: Confirm
echo.
echo  You are about to release:
echo    %CURRENT%  →  v%NEWVER%
echo.
echo  This will:
echo    1. Update package.json
echo    2. Commit and push to main
echo    3. Tag v%NEWVER% and push the tag
echo    4. Trigger GitHub Actions to build all platforms
echo.
set /p CONFIRM="Type YES to continue: "

if /i not "%CONFIRM%"=="YES" (
  echo Cancelled.
  pause
  exit /b 0
)

:: Update version in package.json using PowerShell
powershell -Command "(Get-Content package.json -Raw) -replace '\"version\": \"%CURRENT%\"', '\"version\": \"%NEWVER%\"' | Set-Content package.json -NoNewline"

echo.
echo  [1/4] package.json updated to %NEWVER%

:: Stage and commit
git add package.json
git commit -m "chore: release v%NEWVER%"
echo  [2/4] Committed

:: Push main
git push origin main
echo  [3/4] Pushed to main

:: Tag and push tag
git tag v%NEWVER%
git push origin v%NEWVER%
echo  [4/4] Tagged v%NEWVER% — GitHub Actions build triggered

echo.
echo  ─────────────────────────────────────
echo  Release v%NEWVER% is on its way.
echo  Monitor progress at:
echo  https://github.com/GeneDevStudios/SSP-Creator/actions
echo  ─────────────────────────────────────
echo.
pause