@echo off
setlocal
chcp 65001 >nul
title CorePresupuesto - API

rem Uso:  iniciar-api.bat           inicia la API en el puerto 3013 (recarga sola al guardar cambios)
rem       iniciar-api.bat demo      crea antes presupuestos de demostracion y muestra sus codigos

set "API=%~dp0backend"

if not exist "%API%\package.json" (
  echo [error] No se encontro "%API%\package.json".
  goto :fin
)
if not exist "%API%\.env" (
  echo [error] Falta backend\.env. Copia backend\.env.example y completalo.
  goto :fin
)

where nvm >nul 2>nul && nvm use 24.21.0 >nul 2>nul

pushd "%API%"
if /i "%~1"=="demo" call npm run seed:demo
call npm run dev
popd

:fin
echo.
pause
