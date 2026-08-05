# 360° Mobile Mapping WebGIS

A high-performance WebGIS platform designed as the primary visualization and asset digitization engine for the **TNB LV Network Mapping Project**. It provides immersive 360° street-view imagery synchronized with precise geospatial data layers.

## 🚀 Dashboard Integration

This WebGIS is a core component of the [TNB LV Network Mapping Processing Dashboard](https://360-mobile-mapping-processing-dashb.vercel.app/), where it is embedded via iframe to provide street-level inspection and spatial data extraction capabilities.

### Embedded Communication API (postMessage)
The application supports bi-directional communication with the parent dashboard:

| Event Type | Direction | Description |
| :--- | :--- | :--- |
| `SET_SUBGRID_FILTER` | **Dashboard → WebGIS** | Filters the map and viewer to specific grid IDs (e.g., `N94E70`). |
| `MAP_COORDS` | **WebGIS → Dashboard** | Broadcasts real-time mouse cursor coordinates for cross-panel spatial tracking. |
| `POINT_SELECTED` | **WebGIS → Dashboard** | *Planned:* Notifies the dashboard when a user selects a specific panoramic frame. |

### 🛠️ Project Context Summary (Updated 2026-08-05)

#### 1. Tech Stack & Core Libraries
- **Frontend**: React 19, Vite 5, TailwindCSS.
- **Map Engine**: **Leaflet 1.9** with `preferCanvas: true` for GPU-accelerated 60FPS rendering of 265+ points.
- **360° Viewer**: Custom **Three.js** implementation with optimized 60FPS camera loop and throttled map-sync (32ms).
- **Backend**: **Supabase** (PostGIS for panoramas, Storage for `MMS_PIC` bucket).
- **Spatial Logic**: `@turf/turf` for adjacency, `proj4` for projections, `shpjs` for client-side parsing.

#### 2. Key Features (Implemented & Working)
- **High-Performance Markers**: 265 points rendered via Canvas with dynamic zoom-based scaling (smaller radius for clarity).
- **60FPS Directional Cone**: Hardware-accelerated marker with CSS-interpolated rotation synced to 360° viewer yaw.
- **Basemap Hub**: Dynamic switcher supporting 15+ layers (Google Satellite, Esri, Carto, OSM).
- **Dashboard Integration**: `postMessage` API throttled to 20Hz (`MAP_COORDS`, `SET_SUBGRID_FILTER`).
- **GIS Tools (Basic)**: Coordinate Display (Direct DOM updates), Nominatim Search, Auto-Fit Bounds.

#### 3. Active State & Data Flow
- **Central Hub**: `Layout.jsx` manages global state (`selectedPoint`, `filteredPoints`, `activeLayers`).
- **Data Flow**: Supabase ➔ `Layout` (Memoized Filtering) ➔ `Map`/`Viewer`.
- **Optimization**: Use of `React.memo` for markers and direct DOM manipulation for coordinate overlays to prevent React render lag.

#### 4. Pending Tasks & Roadmap
- **Next Feature**: Migrate GIS Tools (Measurement, Area, Buffer) from old logic to the optimized Leaflet/Canvas event system.
- **Pending Bug**: Persistence of uploaded spatial layers (KML/GeoJSON) across subgrid filter changes.
- **Integration**: Finalize `POINT_SELECTED` postMessage event to notify parent dashboard of specific frame inspection.

### 4. Configuration

#### Environment Variables (`.env`)
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Image & Data Source
VITE_IMAGE_BASE_URL=https://frz995.github.io/mobilemapping/
VITE_QGIS_WMS_URL=https://your-qgis-server/wms
```

#### Directory Structure
- `public/MMS_PIC/`: Source panoramic images.
- `public/tiles/`: Tiled panorama configurations and image fragments.
- `src/hooks/`: Specialized hooks for Supabase, CSV, WFS, and 360° measurements.
- `scripts/`: Data engineering tools for tiling and DB synchronization.

### 5. Deployment
The app is optimized for **GitHub Pages** deployment under the `/mobilemapping/` path.
- **Build**: `npm run build`
- **Deploy**: `npm run deploy` (uses `gh-pages`)

### 6. Current WIP & Dashboard Integration Roadmap
- **WIP**: Refinement of the "filtered subgrid" marker animation (Sonar Pulse) in `Map.jsx` to align with processing dashboard UI styling.
- **Next Feature**: Cross-dashboard persistent layer registry for uploaded spatial files, syncing layer state between the embedded WebGIS and main processing dashboard.
- **Integration**: Enhanced `postMessage` communication to pass selected subgrid filters, active layer lists, and measurement data from the WebGIS to the parent processing dashboard.
- **Optimization**: Runtime correction for absolute asset paths in static JSON configs to ensure seamless compatibility across local development, staging, and production dashboard environments.
