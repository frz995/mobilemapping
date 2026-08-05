export const BASEMAPS = [
  {
    id: 'positron',
    name: 'Positron (Carto Light)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/light_all/12/3205/2012.png'
  },
  {
    id: 'bright',
    name: 'MapLibre Bright (OpenFreeMap)',
    url: 'https://tiles.openfreemap.org/styles/bright',
    attribution: '&copy; OpenStreetMap contributors',
    preview: 'https://tiles.openfreemap.org/styles/bright/preview.png'
  },
  {
    id: 'liberty',
    name: 'MapLibre Liberty (OpenFreeMap)',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '&copy; OpenStreetMap contributors',
    preview: 'https://tiles.openfreemap.org/styles/liberty/preview.png'
  },
  { 
    id: 'osm', 
    name: 'OpenStreetMap Standard', 
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
    attribution: '&copy; OpenStreetMap contributors',
    preview: 'https://a.tile.openstreetmap.org/12/3205/2012.png'
  },
  {
    id: 'google-streets',
    name: 'Google Streets',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    preview: 'https://mt1.google.com/vt/lyrs=m&x=3205&y=2012&z=12'
  },
  {
    id: 'google-satellite',
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    preview: 'https://mt1.google.com/vt/lyrs=s&x=3205&y=2012&z=12'
  },
  {
    id: 'google-hybrid',
    name: 'Google Hybrid',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    preview: 'https://mt1.google.com/vt/lyrs=y&x=3205&y=2012&z=12'
  },
  {
    id: 'google-terrain',
    name: 'Google Terrain',
    url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google',
    preview: 'https://mt1.google.com/vt/lyrs=p&x=3205&y=2012&z=12'
  },
  { 
    id: 'satellite', 
    name: 'Esri World Imagery', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri World Imagery',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'esri-streets', 
    name: 'Esri World Streets', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri World Street Map',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'esri-topo', 
    name: 'Esri World Topo', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri World Topo',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'esri-natgeo', 
    name: 'Esri National Geographic', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri NatGeo',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'esri-ocean', 
    name: 'Esri Ocean Basemap', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri Ocean',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'dark', 
    name: 'Dark Matter (Carto Dark)', 
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', 
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/dark_all/12/3205/2012.png'
  },
  {
    id: 'voyager',
    name: 'Voyager (Carto)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/3205/2012.png'
  },
  { 
    id: 'topo', 
    name: 'OpenTopoMap', 
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
    preview: 'https://a.tile.opentopomap.org/12/3205/2012.png'
  },
  { 
    id: 'osm-france', 
    name: 'OSM France', 
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', 
    attribution: '&copy; OpenStreetMap France',
    preview: 'https://a.tile.openstreetmap.fr/osmfr/12/3205/2012.png'
  },
  { 
    id: 'osm-hot', 
    name: 'OSM Humanitarian (HOT)', 
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', 
    attribution: '&copy; OpenStreetMap HOT',
    preview: 'https://a.tile.openstreetmap.fr/hot/12/3205/2012.png'
  },
  { 
    id: 'cyclosm', 
    name: 'CyclOSM (Cycling GIS)', 
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', 
    attribution: '&copy; CyclOSM & OpenStreetMap',
    preview: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/12/3205/2012.png'
  },
  { 
    id: 'usgs-topo', 
    name: 'USGS Topo Map', 
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; USGS National Map',
    preview: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'usgs-imagery', 
    name: 'USGS Imagery', 
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; USGS National Map',
    preview: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/12/2012/3205'
  }
];
