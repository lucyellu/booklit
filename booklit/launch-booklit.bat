@echo off
setlocal

set PORT=5199
set APIPORT=8765
set DIR=%~dp0
rem Call the Windows tools by full path. If this is launched from a shell whose
rem PATH puts a Unix toolchain first (Git Bash, WSL interop, MSYS), a bare
rem "timeout" or "findstr" resolves to the GNU one, which takes different flags
rem and makes every wait loop spin instantly.
set SYS=%SystemRoot%\System32

rem --- Goodreads backend (port 8765, proxied by Vite at /api and /files) ---
call :isup %APIPORT%
if "%UP%"=="1" (
    echo Goodreads backend already running on port %APIPORT%
) else (
    echo Starting Goodreads backend on port %APIPORT%...
    start /min "" cmd /c "cd /d %DIR% && node server\goodreads-server.mjs"
    call :waitup %APIPORT% "backend"
)

rem --- Booklit app (port 5199) - production build + preview (stable, no HMR) ---
call :isup %PORT%
if "%UP%"=="1" (
    echo Server already running on port %PORT%
) else (
    echo Building Booklit...
    call npm run build --prefix "%DIR%"
    if errorlevel 1 (
        echo.
        echo BUILD FAILED - not launching. Fix the errors above and try again.
        pause
        exit /b 1
    )
    echo Starting Booklit on port %PORT%...
    start /min "" cmd /c "cd /d %DIR% && npx vite preview --port %PORT% --host"
    call :waitup %PORT% "app"
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
exit /b 0


rem ==========================================================================
rem  Helpers. These live in subroutines rather than inline because a label
rem  inside a parenthesised if-block is not reliably reachable in batch.
rem ==========================================================================

:isup
set UP=0
%SYS%\netstat.exe -ano | %SYS%\findstr.exe ":%~1 " | %SYS%\findstr.exe "LISTENING" >nul 2>&1
if not errorlevel 1 set UP=1
exit /b 0

:waitup
rem Wait for a port to accept connections. Worth doing for the backend in
rem particular: the app fetches /api/local-books once on startup and swallows
rem the error if it fails, so winning the race means the local library just
rem silently isn't there.
for /l %%i in (1,1,25) do (
    %SYS%\netstat.exe -ano | %SYS%\findstr.exe ":%~1 " | %SYS%\findstr.exe "LISTENING" >nul 2>&1
    if not errorlevel 1 exit /b 0
    rem ping, not timeout: timeout.exe aborts with "input redirection is not
    rem supported" whenever stdin isn't a real console.
    %SYS%\ping.exe -n 2 127.0.0.1 >nul 2>&1
)
echo WARNING: nothing listening on port %~1 yet ^(%~2^) - continuing anyway.
exit /b 1
