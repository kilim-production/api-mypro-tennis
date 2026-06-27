@echo off
setlocal
title MYPRO - TENNIS

cd /d "%~dp0"

set "NODE_HOME=C:\Program Files\nodejs"
if exist "%NODE_HOME%\node.exe" (
  set "PATH=%NODE_HOME%;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js est introuvable.
  echo Installez Node.js puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo npm est introuvable.
  echo Reinstallez Node.js puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creation du fichier .env...
  copy ".env.example" ".env" >nul
)

if not exist "node_modules" (
  echo Installation des dependances, cela peut prendre quelques minutes...
  call npm.cmd install
  if errorlevel 1 goto error
)

netstat -ano | findstr ":4000" | findstr "LISTENING" >nul
set "SERVER_RUNNING=%ERRORLEVEL%"
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
set "WEB_RUNNING=%ERRORLEVEL%"
if "%SERVER_RUNNING%"=="0" if "%WEB_RUNNING%"=="0" (
  echo.
  echo MYPRO - TENNIS est deja lance.
  echo Ouverture du navigateur sur http://localhost:5173
  echo.
  start "" "http://localhost:5173"
  echo Vous pouvez fermer cette fenetre.
  pause
  exit /b 0
)

echo Preparation de la base de donnees...
if not exist "node_modules\.prisma\client\default.js" (
  call npm.cmd run db:generate
  if errorlevel 1 goto error
)

set "NEED_SEED=0"
if not exist "prisma\dev.db" (
  set "NEED_SEED=1"
)

call npm.cmd run db:deploy
if errorlevel 1 goto error

if "%NEED_SEED%"=="1" (
  call npm.cmd run db:seed
  if errorlevel 1 goto error
)

echo.
echo MYPRO - TENNIS demarre.
echo Le navigateur va s'ouvrir sur http://localhost:5173
echo Gardez cette fenetre ouverte pendant que vous jouez.
echo.

start "" "http://localhost:5173"
call npm.cmd run dev
goto end

:error
echo.
echo Une erreur est survenue pendant le lancement.
echo Vous pouvez fermer cette fenetre ou relancer le fichier.
echo.
pause

:end
endlocal
