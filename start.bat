@echo off
cd /d "%~dp0"
if not exist .env (
  echo Copy .env.example to .env and fill tokens
  pause
  exit /b 1
)
if not exist node_modules npm install
node src\index.js
pause
