@echo off
setlocal
chcp 65001 >nul
title CorePresupuesto - web

rem Uso:  iniciar-web.bat            inicia el servidor de desarrollo
rem       iniciar-web.bat limpio     borra antes la cache frontend\.next (el primer arranque tarda mas)

set "WEB=%~dp0frontend"
set "PUERTO=3012"

if not exist "%WEB%\package.json" (
  echo [error] No se encontro "%WEB%\package.json".
  goto :fin
)

rem --- El proyecto exige Node 24 ---
call :version_node
if not "%NODEMAYOR%"=="v24" (
  where nvm >nul 2>nul && nvm use 24.21.0 >nul 2>nul
  call :version_node
)
if not "%NODEMAYOR%"=="v24" (
  echo [error] Se necesita Node 24 y esta activo: "%NODEMAYOR%". Ejecuta: nvm use 24.21.0
  goto :fin
)

pushd "%WEB%"

if not exist ".env.local" (
  echo [error] Falta frontend\.env.local. Copia frontend\.env.example a .env.local y completalo.
  goto :salir
)

if /i "%~1"=="limpio" (
  if exist ".next" rmdir /s /q ".next"
  echo Cache .next eliminada.
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto :salir
)

rem --- Puerto ocupado por un servidor anterior ---
set "PIDPUERTO="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PUERTO% .*LISTENING"') do set "PIDPUERTO=%%p"
if defined PIDPUERTO (
  echo [aviso] El puerto %PUERTO% esta en uso por el proceso %PIDPUERTO%:
  tasklist /FI "PID eq %PIDPUERTO%" /FO TABLE /NH
  choice /c SN /m "Cerrar ese proceso y continuar"
  if errorlevel 2 goto :salir
  taskkill /F /T /PID %PIDPUERTO% >nul
)

echo.
echo Iniciando en http://localhost:%PUERTO%  (la primera carga compila y puede tardar)
echo Para detener: Ctrl+C
echo.
call npm run dev

:salir
popd
:fin
echo.
pause
exit /b

:version_node
set "NODEMAYOR="
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODEMAYOR=%%v"
exit /b
