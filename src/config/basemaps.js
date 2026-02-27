export const BASEMAPS = [
  { 
    id: 'osm', 
    name: 'OpenStreetMap', 
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
    id: 'satellite', 
    name: 'Esri Satellite', 
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
    attribution: 'Tiles &copy; Esri',
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/2012/3205'
  },
  { 
    id: 'topo', 
    name: 'Topographic', 
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    preview: 'https://a.tile.opentopomap.org/12/3205/2012.png'
  },
  { 
    id: 'dark', 
    name: 'Dark Canvas', 
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', 
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/dark_all/12/3205/2012.png'
  },
  {
    id: 'voyager',
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/3205/2012.png'
  },
  {
    id: 'positron',
    name: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    preview: 'https://a.basemaps.cartocdn.com/light_all/12/3205/2012.png'
  }
];
