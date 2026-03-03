@echo off
setlocal enabledelayedexpansion

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in your PATH.
    pause
    exit /b
)

:: Install Pillow if needed
echo Installing Pillow (Image processing library)...
pip install Pillow >nul 2>&1

:: Create output directory
if not exist "public\tiles" mkdir "public\tiles"

:: Process all JPG images in MMS PIC folder
echo Starting batch processing of images in "MMS PIC"...

for %%f in ("MMS PIC\*.jpg") do (
    set "filename=%%~nf"
    set "output_dir=public\tiles\!filename!"
    
    if exist "!output_dir!\config.json" (
        echo Skipping !filename! (Already processed)
    ) else (
        echo Processing !filename!...
        python scripts\generate_tiles.py "%%f" "!output_dir!"
    )
)

echo.
echo ==========================================
echo Updating CSV files to use new tiles...
python scripts\update_csv.py

echo.
echo ==========================================
echo All images processed!
echo.
echo NEXT STEPS:
echo 1. The tiles are now in the 'public/tiles' folder.
echo 2. Update your CSV file (e.g., public/N93E70.csv) to use 'config_url'.
echo    Example: Set 'config_url' column to 'tiles/N93E70-0002/config.json'
echo 3. Update .env file to use local images: VITE_IMAGE_BASE_URL=/
echo ==========================================
pause
