# 360 Web Mapping Application

A web-based 360° street view mapping application built with React, Vite, and Leaflet.

## Features

- **Interactive Map**: View 360° panoramic locations on a map.
- **360° Viewer**: Immersive panorama viewer using Pannellum.
- **Attribute Table**: View and filter data in a tabular format.
- **Measurement Tools**: Measure distances and areas.
- **Cloud Storage Support**: Load panoramic images from cloud storage (AWS S3, Google Cloud, Azure).

## Configuration

### 1. Environment Variables

Create a `.env` file in the root directory (copy from `.env.example` if available).

```env
# Base URL for panoramic images
# Option A: Cloud Storage / GitHub Pages (Predictable URLs)
# VITE_IMAGE_BASE_URL=https://username.github.io/my-360-images/
# VITE_IMAGE_BASE_URL=https://storage.googleapis.com/my-bucket/

# Option B: Random URLs (ImgBB, Google Drive) -> Leave EMPTY
VITE_IMAGE_BASE_URL=

# Metadata Source: CSV (default)
VITE_METADATA_CSV_URL=/metadata.csv

# Optional: GeoServer Configuration (for WFS layers)
# VITE_GEOSERVER_URL=http://localhost:8080/geoserver/workspace
# VITE_GEOSERVER_LAYER=workspace:layername
```

### 2. Data Structure (CSV)

Your `metadata.csv` should have the following columns:

| Column | Description |
|---|---|
| `id` | Unique identifier for the point |
| `lat` | Latitude (decimal degrees) |
| `lon` | Longitude (decimal degrees) |
| `filename` | Name of the image file (e.g., `pano_001.jpg`) |
| `bearing` | Heading of the image (0-360) |
| `date` | Capture date (YYYY-MM-DD) |

**Note on Image Loading:**
- **Option A (Predictable URLs):** Set `VITE_IMAGE_BASE_URL`. The app loads `${VITE_IMAGE_BASE_URL}/${filename}`.
- **Option B (Direct/Random URLs):** Leave `VITE_IMAGE_BASE_URL` empty. Add an `image_url` column to your CSV with the full link.

### 3. Free Cloud Storage Options (For Option A)

If you need free hosting that supports predictable URLs (Base URL + Filename) and CORS:

#### **1. GitHub Pages (Recommended for < 1GB)**
Completely free and easiest to set up.
1. Create a new public repository on GitHub (e.g., `my-360-images`).
2. Upload your images to the root or a folder.
3. Go to **Settings > Pages** and enable GitHub Pages from the `main` branch.
4. Your Base URL will be: `https://<username>.github.io/<repo-name>/`
5. **CORS is enabled by default**, so it works perfectly.

#### **2. Supabase Storage (Free Tier)**
Provides 1GB of storage with an easy dashboard.
1. Create a "Public" bucket named `panoramas`.
2. Upload images.
3. Your Base URL will be: `https://<project-ref>.supabase.co/storage/v1/object/public/panoramas/`
4. **CORS:** Go to Bucket Settings and add your app's URL (or `*`) to CORS Origins.

#### **3. Firebase Storage (Google Cloud)**
Generous free tier (5GB). Requires slightly more setup for "predictable" URLs.
1. Create a Firebase project and enable Storage.
2. Change Rules to allow read access: `allow read: if true;`
3. Upload images.
4. **Important:** By default, Firebase uses "token" URLs. To use predictable paths, you must access them via the Google Cloud Storage XML API format:
   `https://storage.googleapis.com/<project-id>.appspot.com/`
5. You must configure CORS using `gsutil` or the Google Cloud Console.

### 4. Cloud Storage CORS Configuration

If using AWS S3, Azure, or GCS, you **must enable CORS** to allow the application to load images.

**AWS S3 CORS Configuration:**
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## Deployment

### Deploying to GitHub Pages

1.  **Initialize Git** (if not already done):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```

2.  **Create a Repository on GitHub** and link it:
    ```bash
    git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
    git push -u origin main
    ```

3.  **Deploy the App**:
    This project includes the `gh-pages` package for easy deployment.
    ```bash
    npm run deploy
    ```
    This command will build the project and push the `dist` folder to a `gh-pages` branch.

4.  **Configure GitHub Pages**:
    - Go to your repository **Settings > Pages**.
    - Ensure the source is set to `gh-pages` branch.
    - Your site will be live at: `https://<YOUR_USERNAME>.github.io/<YOUR_REPO_NAME>/`

5.  **Update Configuration**:
    - Update `homepage` in `package.json` to your actual GitHub Pages URL.
    - If you are hosting images in the same repo (Option A), update `VITE_IMAGE_BASE_URL` in `.env` to match your Pages URL.
