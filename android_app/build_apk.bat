@echo off
setlocal enabledelayedexpansion
title Compilando APK Nativo - WiFi Sentinel
color 0b

echo ========================================================
echo    COMPILADOR NATIVO ANDROID SDK - WIFI SENTINEL
echo ========================================================
echo.

set ANDROID_JAR=C:\Android\platforms\android-34\android.jar
set BUILD_TOOLS=C:\Android\build-tools\34.0.0
set JDK_BIN=C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot\bin

set AAPT2="%BUILD_TOOLS%\aapt2.exe"
set D8="%BUILD_TOOLS%\d8.bat"
set ZIPALIGN="%BUILD_TOOLS%\zipalign.exe"
set APKSIGNER="%BUILD_TOOLS%\apksigner.bat"
set JAVAC="%JDK_BIN%\javac.exe"

echo [1/7] Limpiando carpetas temporales de compilacion...
if exist build rmdir /s /q build
if exist gen rmdir /s /q gen
if exist obj rmdir /s /q obj
if exist dex_out rmdir /s /q dex_out

mkdir build
mkdir gen
mkdir obj
mkdir dex_out

echo [2/7] Compilando recursos XML (aapt2 compile)...
%AAPT2% compile --dir res -o build\compiled_res.zip
if %ERRORLEVEL% neq 0 (
    echo Error compilando recursos XML.
    exit /b %ERRORLEVEL%
)

echo [3/7] Enlazando APK base y generando R.java (aapt2 link)...
%AAPT2% link -I "%ANDROID_JAR%" --manifest AndroidManifest.xml -o build\base.apk -A assets build\compiled_res.zip --java gen --auto-add-overlay
if %ERRORLEVEL% neq 0 (
    echo Error en aapt2 link.
    exit /b %ERRORLEVEL%
)

echo [4/7] Compilando codigo Java (javac)...
%JAVAC% --release 8 -cp "%ANDROID_JAR%" -d obj gen\com\aegis\wifisentinel\*.java src\com\aegis\wifisentinel\*.java
if %ERRORLEVEL% neq 0 (
    echo Error en javac.
    exit /b %ERRORLEVEL%
)

echo [5/7] Convirtiendo bytecode Java a Dalvik DEX (d8)...
call %D8% --lib "%ANDROID_JAR%" --output dex_out obj\com\aegis\wifisentinel\*.class
if %ERRORLEVEL% neq 0 (
    echo Error en d8.
    exit /b %ERRORLEVEL%
)

echo [6/7] Empaquetando classes.dex y alineando APK (zipalign)...
cd dex_out
jar -uf ..\build\base.apk classes.dex
cd ..

%ZIPALIGN% -p -f 4 build\base.apk wifi-sentinel-aligned.apk
if %ERRORLEVEL% neq 0 (
    echo Error en zipalign.
    exit /b %ERRORLEVEL%
)

echo [7/7] Firmando paquete APK con apksigner (V1, V2, V3)...
call %APKSIGNER% sign --ks sentinel.keystore --ks-pass pass:sentinel123 --out ..\wifi-sentinel.apk wifi-sentinel-aligned.apk
if %ERRORLEVEL% neq 0 (
    echo Error en apksigner.
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   APK GENERADO CON EXITO: wifi-sentinel.apk
echo ========================================================
call %APKSIGNER% verify -v ..\wifi-sentinel.apk
