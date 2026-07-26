@echo off
start "Consola Frontend" powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0startFrontend.ps1"
start "Consola Backend"  powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0startBackend.ps1"
exit