@echo off
setlocal
cd /d "%~dp0"
title MYPRO TENNIS - Preparation Netlify Drop

echo.
echo Preparation du dossier Netlify Drop...
echo.

call npm run build:netlify
if errorlevel 1 goto :build_error

if not exist "apps\mypro-tennis-web\dist\index.html" goto :missing_build

echo.
echo Le dossier de deploiement est pret.
echo Glissez uniquement le dossier DIST ouvert dans Netlify.
echo Ne glissez pas le dossier complet MyPro-Tennis ou api-mypro-tennis.
echo.

start "" explorer.exe "%~dp0apps\mypro-tennis-web\dist"
pause
exit /b 0

:build_error
echo.
echo ERREUR : la construction du jeu a echoue.
echo Le dossier Netlify n'a pas ete prepare.
pause
exit /b 1

:missing_build
echo.
echo ERREUR : le fichier index.html est introuvable dans le dossier DIST.
pause
exit /b 1
