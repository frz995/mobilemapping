# How to Create High-Quality Tiled Images (Zero Blur)

To completely eliminate blur and improve performance for large 360° images, you need to convert your single JPEG files into a folder of multi-resolution tiles.

This guide explains how to do this using the provided Python script.

## Prerequisites

1.  **Install Python:** Make sure you have Python installed.
2.  **Install Dependencies:**
    ```bash
    pip install Pillow
    ```

## Step 1: Prepare Your Images

Create a folder for your original high-resolution images (e.g., `raw_images/`).

## Step 2: Run the Tiling Script

Use the script located at `scripts/generate_tiles.py` to process each image.

**Example Command:**
```bash
python scripts/generate_tiles.py "path/to/image.jpg" "public/tiles/image_name"
```

This will create a folder `public/tiles/image_name` containing:
- `config.json`: The configuration file.
- `1/`, `2/`, `3/`: Folders with image tiles.
- `fallback/`: A low-res preview image.

## Step 3: Update Your Data (CSV)

In your `data.csv` file:
1.  Add a new column named `config_url`.
2.  For each point, enter the path to the generated `config.json` file.
    *   Example: `tiles/image_name/config.json`
3.  You can keep the `image_url` column as a fallback (point it to the `fallback/f.jpg` or keep the original low-res image).

## Step 4: Configure the Viewer

Ensure your `.env` file points to the correct base URL for local testing:

```env
VITE_IMAGE_BASE_URL=/
```
(This assumes your `tiles` folder is inside the `public` folder).

## Batch Processing (Optional)

If you have many images, you can create a simple batch script:

**Windows (batch_process.bat):**
```bat
@echo off
for %%f in (raw_images/*.jpg) do (
    echo Processing %%f...
    python scripts/generate_tiles.py "raw_images/%%f" "public/tiles/%%~nf"
)
pause
```

**Mac/Linux (batch_process.sh):**
```bash
#!/bin/bash
mkdir -p public/tiles
for f in raw_images/*.jpg; do
    filename=$(basename -- "$f")
    name="${filename%.*}"
    echo "Processing $f..."
    python3 scripts/generate_tiles.py "$f" "public/tiles/$name"
done
```
