@echo off
setlocal
title Arreter MYPRO - TENNIS

echo Arret de MYPRO - TENNIS...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo.
echo Les serveurs du jeu sont arretes.
echo Vous pouvez relancer avec "Lancer MyPro Tennis.cmd".
echo.
pause
endlocal
