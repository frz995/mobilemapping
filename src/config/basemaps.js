export const BASEMAPS = [
  // --- OPENFREEMAP VECTOR STYLES (DEFAULT) ---
  {
    id: 'ofm-positron',
    name: 'Positron (OpenFreeMap Vector)',
    category: 'Aesthetic Minimal',
    url: 'https://tiles.openfreemap.org/styles/positron',
    isVector: true,
    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://tiles.openfreemap.org/styles/positron/preview.png'
  },
  {
    id: 'ofm-dark',
    name: 'Dark (OpenFreeMap Vector)',
    category: 'Aesthetic Minimal',
    url: 'https://tiles.openfreemap.org/styles/dark',
    isVector: true,
    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://tiles.openfreemap.org/styles/dark/preview.png'
  },
  {
    id: 'ofm-fiord',
    name: 'Fiord Nordic Dark (OpenFreeMap Vector)',
    category: 'Aesthetic Modern',
    url: 'https://tiles.openfreemap.org/styles/fiord',
    isVector: true,
    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://tiles.openfreemap.org/styles/fiord/preview.png'
  },
  {
    id: 'ofm-liberty',
    name: 'Liberty (OpenFreeMap Vector)',
    category: 'Street',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    isVector: true,
    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://tiles.openfreemap.org/styles/liberty/preview.png'
  },
  {
    id: 'ofm-bright',
    name: 'Bright (OpenFreeMap Vector)',
    category: 'Street',
    url: 'https://tiles.openfreemap.org/styles/bright',
    isVector: true,
    attribution: '&copy; <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://tiles.openfreemap.org/styles/bright/preview.png'
  },

  // --- STANDARD RASTER BASEMAPS ---
  {
    id: 'osm',
    name: 'OpenStreetMap Standard',
    category: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://a.tile.openstreetmap.org/12/3205/2012.png'
  },
  {
    id: 'osm-hot',
    name: 'OSM Humanitarian (HOT)',
    category: 'Street',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    maxZoom: 19,
    subdomains: ['a', 'b'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
    preview: 'https://a.tile.openstreetmap.fr/hot/12/3205/2012.png'
  },
  {
    id: 'osm-france',
    name: 'OSM France (High Detail)',
    category: 'Street',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    preview: 'https://a.tile.openstreetmap.fr/osmfr/12/3205/2012.png'
  },
  {
    id: 'google-streets',
    name: 'Google Streets',
    category: 'Street',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    preview: 'https://mt1.google.com/vt/lyrs=m&x=3205&y=2012&z=12'
  },
  {
    id: 'esri-streets',
    name: 'Esri World Street Map',
    category: 'Street',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, TomTom',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/12/2012/3205'
  },

  // --- SATELLITE & HYBRID IMAGERY ---
  {
    id: 'satellite',
    name: 'Esri World Imagery (Satellite)',
    category: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/2012/3205'
  },
  {
    id: 'google-satellite',
    name: 'Google Satellite',
    category: 'Satellite',
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    preview: 'https://mt1.google.com/vt/lyrs=s&x=3205&y=2012&z=12'
  },
  {
    id: 'google-hybrid',
    name: 'Google Satellite Hybrid',
    category: 'Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    preview: 'https://mt1.google.com/vt/lyrs=y&x=3205&y=2012&z=12'
  },
  {
    id: 'usgs-imagery',
    name: 'USGS National Map Imagery',
    category: 'Satellite',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; USGS The National Map',
    preview: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/12/2012/3205'
  },

  // --- MINIMAL CANVAS & DARK THEMES (IDEAL FOR GIS OVERLAYS) ---
  {
    id: 'esri-gray',
    name: 'Esri Light Gray Canvas',
    category: 'Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/12/2012/3205'
  },
  {
    id: 'dark',
    name: 'Esri Dark Gray Canvas',
    category: 'Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/12/2012/3205'
  },

  // --- TOPOGRAPHIC & ELEVATION BASEMAPS ---
  {
    id: 'esri-topo',
    name: 'Esri World Topographic',
    category: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; USGS, Intermap, NASA, CGIAR, NGA, GEBCO',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/12/2012/3205'
  },
  {
    id: 'topo',
    name: 'OpenTopoMap (Contours & Shading)',
    category: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; OpenTopoMap',
    preview: 'https://a.tile.opentopomap.org/12/3205/2012.png'
  },
  {
    id: 'google-terrain',
    name: 'Google Terrain & Relief',
    category: 'Topographic',
    url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    preview: 'https://mt1.google.com/vt/lyrs=p&x=3205&y=2012&z=12'
  },
  {
    id: 'usgs-topo',
    name: 'USGS Topo Map (Official)',
    category: 'Topographic',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; USGS The National Map: National Boundaries Dataset, 3DEP Elevation Program',
    preview: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/12/2012/3205'
  },
  {
    id: 'esri-physical',
    name: 'Esri World Physical (Landcover)',
    category: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 8,
    attribution: 'Tiles &copy; Esri &mdash; US National Park Service',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/6/32/49'
  },
  {
    id: 'esri-shaded-relief',
    name: 'Esri World Shaded Relief',
    category: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    attribution: 'Tiles &copy; Esri &mdash; USGS, NASA, CGIAR',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/12/2012/3205'
  },
  {
    id: 'esri-terrain-base',
    name: 'Esri Clean Terrain & Hillshade',
    category: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    attribution: 'Tiles &copy; Esri, USGS, NOAA',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/12/2012/3205'
  },

  // --- SPECIALIZED & THEMATIC GIS LAYERS ---
  {
    id: 'esri-natgeo',
    name: 'National Geographic World Map',
    category: 'Thematic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; National Geographic, USGS, NASA, ESA, METI, NRCAN, GEBCO',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/12/2012/3205'
  },
  {
    id: 'esri-ocean',
    name: 'Esri Ocean Bathymetry',
    category: 'Thematic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    attribution: 'Tiles &copy; Esri &mdash; GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/12/2012/3205'
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM Cycling & Infrastructure',
    category: 'Thematic',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c'],
    attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> | &copy; OpenStreetMap contributors',
    preview: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/12/3205/2012.png'
  }
];