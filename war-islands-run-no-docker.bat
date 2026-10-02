@echo off
setlocal EnableExtensions EnableDelayedExpansion
title WAR ISLANDS - PostgreSQL + Next.js 3000

cd /d "%~dp0"

echo ========================================
echo      WAR ISLANDS - DEV LAUNCHER
echo ========================================
echo.

REM ============================================================
REM 0) Request Administrator privileges.
REM ============================================================
net session >nul 2>&1
if errorlevel 1 (
    echo [INFO] Administrator privileges are required to install/start PostgreSQL.
    echo [INFO] Requesting Administrator access...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -Verb RunAs"
    if errorlevel 1 (
        echo [ERROR] Could not request Administrator privileges.
        goto :FAIL
    )
    exit /b 0
)

echo [OK] Administrator privileges available.
echo.

REM ============================================================
REM 1) Node / npm
REM ============================================================
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo Install Node.js 22+ and run this file again.
    goto :FAIL
)

for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
echo [OK] Node.js: !NODE_VERSION!

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found.
    goto :FAIL
)
echo [OK] npm detected.
echo.

REM ============================================================
REM 2) Port 3000
REM ============================================================
powershell -NoProfile -Command ^
  "$x=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if($x){exit 1}else{exit 0}" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Port 3000 is already in use.
    echo Close the application using port 3000 and run this file again.
    goto :FAIL
)
echo [OK] Port 3000 is available.
echo.

REM ============================================================
REM 3) Find PostgreSQL / psql
REM ============================================================
set "PSQL="

for /f "delims=" %%P in ('where psql 2^>nul') do (
    if not defined PSQL set "PSQL=%%P"
)

if not defined PSQL (
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$x=Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName; if($x){$x}"`) do (
        set "PSQL=%%P"
    )
)

REM ============================================================
REM 4) Install PostgreSQL if missing
REM ============================================================
if not defined PSQL (
    echo [INFO] PostgreSQL is not installed.
    echo [INFO] Docker is NOT required.
    echo.
    echo [INFO] Installing PostgreSQL 18 using Windows Package Manager...
    echo.

    where winget >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] winget is not available on this Windows installation.
        echo.
        echo Install Microsoft App Installer / Windows Package Manager,
        echo then run this file again.
        goto :FAIL
    )

    winget install --id PostgreSQL.PostgreSQL.18 -e ^
      --source winget ^
      --accept-source-agreements ^
      --accept-package-agreements

    if errorlevel 1 (
        echo.
        echo [ERROR] PostgreSQL installation failed.
        goto :FAIL
    )

    echo.
    echo [OK] PostgreSQL installer finished.
    echo [INFO] Searching for psql...
    echo.

    timeout /t 3 /nobreak >nul

    for /f "delims=" %%P in ('where psql 2^>nul') do (
        if not defined PSQL set "PSQL=%%P"
    )

    if not defined PSQL (
        for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$x=Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName; if($x){$x}"`) do (
            set "PSQL=%%P"
        )
    )
)

if not defined PSQL (
    echo [ERROR] PostgreSQL was not found after installation.
    goto :FAIL
)

echo [OK] PostgreSQL client:
echo      !PSQL!
echo.

REM ============================================================
REM 5) Find/start PostgreSQL Windows service
REM ============================================================
set "PG_SERVICE="

for /f "delims=" %%S in ('powershell -NoProfile -Command "$s=Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object {$_.Status -ne 'Disabled'} | Select-Object -First 1 -ExpandProperty Name; if($s){$s}"') do (
    set "PG_SERVICE=%%S"
)

if not defined PG_SERVICE (
    echo [ERROR] PostgreSQL Windows service was not found.
    echo You may need to finish the PostgreSQL installer first.
    goto :FAIL
)

echo [OK] PostgreSQL service: !PG_SERVICE!

powershell -NoProfile -Command ^
  "$s=Get-Service -Name '!PG_SERVICE!' -ErrorAction Stop; if($s.Status -ne 'Running'){Start-Service -Name '!PG_SERVICE!'; $s.WaitForStatus('Running','00:00:30')}" >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Could not start PostgreSQL service.
    echo.
    sc query "!PG_SERVICE!"
    goto :FAIL
)

echo [OK] PostgreSQL service is running.
echo.

REM ============================================================
REM 6) Wait for PostgreSQL
REM ============================================================
echo [INFO] Waiting for PostgreSQL on 127.0.0.1:5432...

set "PG_READY=0"

for /l %%I in (1,1,30) do (
    powershell -NoProfile -Command ^
      "$c=Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue; if($c){exit 0}else{exit 1}" >nul 2>&1

    if not errorlevel 1 (
        set "PG_READY=1"
        goto :PG_PORT_OK
    )

    timeout /t 1 /nobreak >nul
)

:PG_PORT_OK

if "!PG_READY!"=="0" (
    echo [ERROR] PostgreSQL did not open port 5432.
    goto :FAIL
)

echo [OK] PostgreSQL is listening on 127.0.0.1:5432.
echo.

REM ============================================================
REM 7) Get PostgreSQL password
REM ============================================================
REM Try the project's expected local-dev password first.
set "PGPASS=postgres"
set "PGPASSWORD=postgres"

"!PSQL!" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT 1;" >nul 2>&1

if errorlevel 1 (
    echo [INFO] The PostgreSQL password is not "postgres".
    echo [INFO] Enter the password you selected during PostgreSQL installation.
    echo.
    set /p "PGPASS=PostgreSQL password: "
    if not defined PGPASS (
        echo [ERROR] No PostgreSQL password supplied.
        goto :FAIL
    )
    set "PGPASSWORD=!PGPASS!"

    "!PSQL!" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT 1;" >nul 2>&1

    if errorlevel 1 (
        echo [ERROR] PostgreSQL authentication failed.
        echo Check the postgres password and run this file again.
        goto :FAIL
    )
)

echo [OK] PostgreSQL authentication succeeded.
echo.

REM ============================================================
REM 8) Create app_db if missing
REM ============================================================
"!PSQL!" -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='app_db';" > "%TEMP%\war_islands_db_check.txt" 2>nul

findstr /r /c:"1" "%TEMP%\war_islands_db_check.txt" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Creating database app_db...
    "!PSQL!" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE app_db;" >nul

    if errorlevel 1 (
        echo [ERROR] Could not create app_db.
        del "%TEMP%\war_islands_db_check.txt" >nul 2>&1
        goto :FAIL
    )

    echo [OK] Database app_db created.
) else (
    echo [OK] Database app_db already exists.
)

del "%TEMP%\war_islands_db_check.txt" >nul 2>&1
echo.

REM ============================================================
REM 9) Write .env.local
REM ============================================================
> ".env.local" echo DATABASE_URL=postgresql://postgres:!PGPASS!@127.0.0.1:5432/app_db
echo [OK] .env.local configured.
echo.

REM ============================================================
REM 10) npm install
REM ============================================================
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        goto :FAIL
    )
) else (
    echo [OK] node_modules already exists.
)

echo.

REM ============================================================
REM 11) Drizzle schema
REM ============================================================
echo [INFO] Synchronizing Drizzle schema...
call npx drizzle-kit push

if errorlevel 1 (
    echo.
    echo [ERROR] Drizzle database setup failed.
    goto :FAIL
)

echo [OK] Database schema is ready.
echo.

REM ============================================================
REM 12) Start Next.js
REM ============================================================
echo ========================================
echo       WAR ISLANDS IS STARTING
echo ========================================
echo.
echo [OK] PostgreSQL: 127.0.0.1:5432
echo [OK] Database:   app_db
echo [OK] Web server: http://localhost:3000
echo.
echo Opening browser...
echo.
start "" "http://localhost:3000"

call npx next dev -p 3000

echo.
echo ========================================
echo       NEXT.JS HAS STOPPED
echo ========================================
goto :END

:FAIL
echo.
echo ========================================
echo           LAUNCHER FAILED
echo ========================================
echo.
echo Read the error above.
echo This window will stay open.
echo.
pause
exit /b 1

:END
echo.
echo Press any key to close this window.
pause
endlocal
