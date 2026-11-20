@echo off
title WIFI SENTINEL // Aegis Defense System
color 0b
echo ========================================================
echo       WIFI SENTINEL - DEFENSOR TACTICO DE RED
echo ========================================================
echo.
echo Iniciando servidor en http://localhost:8000...
echo Acceso desde tu movil en la misma red WiFi:
echo http://192.168.101.84:8000
echo.
python -m uvicorn server:app --host 0.0.0.0 --port 8000
pause
