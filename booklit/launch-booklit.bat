@echo off
setlocal

set PORT=5199
set APIPORT=8765
set DIR=%~dp0

rem --- Goodreads backend (port 8765, proxied by Vite at /api) ---
netstat -ano | findstr ":%APIPORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo Goodreads backend already running on port %APIPORT%
) else (
    echo Starting Goodreads backend on port %APIPORT%...
    start /min "" cmd /c "cd /d %DIR% && node server\goodreads-server.mjs"
)

rem --- Vite dev server (port 5199) ---
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo Server already running on port %PORT%
) else (
    echo Starting Booklit dev server on port %PORT%...
    start /min "" cmd /c "cd /d %DIR% && npx vite --port %PORT% --host"
    timeout /t 3 /nobreak >nul
)

set CHROME=
for %%P in (
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
    if exist %%P set CHROME=%%P
)

if defined CHROME (
    start "" %CHROME% --app="http://localhost:%PORT%"
) else (
    start "" "http://localhost:%PORT%"
)

endlocal
