@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gig Giveaway-Bot

if not exist ".venv\Scripts\python.exe" (
  echo Erster Start: richte Python-Umgebung ein ...
  py -3 -m venv .venv 2>nul || python -m venv .venv
  if not exist ".venv\Scripts\python.exe" (
    echo Python 3.11+ fehlt. Installiere es von https://www.python.org/downloads/ ^(Haken bei "Add python.exe to PATH" setzen^).
    pause
    exit /b 1
  )
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || (pause & exit /b 1)
  ".venv\Scripts\python.exe" -m playwright install chromium || (pause & exit /b 1)
)

".venv\Scripts\python.exe" gig_bot.py %*
pause
