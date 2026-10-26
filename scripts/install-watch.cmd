@echo off
REM Daily wrapper for `npm run watch:installs`, driven by Windows Task Scheduler so the watch
REM survives this machine's reboots and does not depend on a Claude session being open.
REM
REM Register / inspect / remove:
REM   schtasks /Query  /TN "Boernelaering install watch" /V /FO LIST
REM   schtasks /Delete /TN "Boernelaering install watch" /F
REM
REM Writes every run to a rolling log, and on a TRIP (script exit 1) also drops a marker file whose
REM presence is the thing to look for — grepping a long log for the day it moved is how this gets
REM missed.
setlocal
set REPO=C:\Source\preschool-learning-app
set LOGDIR=%LOCALAPPDATA%\boernelaering-watch
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

cd /d "%REPO%"
echo ---------------------------------------------- >> "%LOGDIR%\watch.log"
echo RUN %DATE% %TIME% >> "%LOGDIR%\watch.log"
call npm run --silent watch:installs >> "%LOGDIR%\watch.log" 2>&1
set RC=%ERRORLEVEL%
echo exit %RC% >> "%LOGDIR%\watch.log"

if %RC% EQU 1 (
  echo TRIPPED %DATE% %TIME% >> "%LOGDIR%\TRIPPED.txt"
  copy /Y "%LOGDIR%\watch.log" "%LOGDIR%\TRIPPED-detail.log" >nul
)
endlocal
