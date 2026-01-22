@echo off
echo Cleaning project...
call flutter clean

echo Deleting corrupted icon files...
cd android\app\src\main\res

REM Delete all mipmap folders
if exist mipmap-hdpi rmdir /s /q mipmap-hdpi
if exist mipmap-mdpi rmdir /s /q mipmap-mdpi
if exist mipmap-xhdpi rmdir /s /q mipmap-xhdpi
if exist mipmap-xxhdpi rmdir /s /q mipmap-xxhdpi
if exist mipmap-xxxhdpi rmdir /s /q mipmap-xxxhdpi
if exist mipmap-anydpi-v26 rmdir /s /q mipmap-anydpi-v26

REM Delete potentially corrupted drawable files mentioned in logs
if exist drawable\app_icon_foreground.png del /f /q drawable\app_icon_foreground.png
if exist drawable\ic_launcher_foreground.png del /f /q drawable\ic_launcher_foreground.png
if exist drawable-xxhdpi\ic_launcher_foreground.png del /f /q drawable-xxhdpi\ic_launcher_foreground.png

cd ..\..\..\..\..

echo Regenerating icons...
call dart run flutter_launcher_icons

echo Building Release APK...
call flutter build apk --release
