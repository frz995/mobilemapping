import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, useMap, useMapEvents, Rectangle, WMSTileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Map as MapIcon, Layers, Copy, Check } from 'lucide-react';
import * as turf from '@turf/turf';
import proj4 from 'proj4';

// Fix for default marker icon issues in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { BASEMAPS } from '../config/basemaps';

// --- Coordinate Popup Component ---
const CoordinatePopup = ({ latlng, onClose }) => {
  const [elevation, setElevation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null); // 'dd', 'dms', 'merc'

  const { lat, lng } = latlng;

  const toDMS = (deg, type) => {
    const d = Math.floor(Math.abs(deg));
    const minfloat = (Math.abs(deg) - d) * 60;
    const m = Math.floor(minfloat);
    const s = ((minfloat - m) * 60).toFixed(2);
    const dir = deg > 0 ? (type === 'lat' ? 'N' : 'E') : (type === 'lat' ? 'S' : 'W');
    return `${d}° ${m}' ${s}" ${dir}`;
  };

  const point = L.CRS.EPSG3857.project(latlng);
  
  // Calculate UTM
  const zone = Math.floor((lng + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'north' : 'south';
  let utmCoords = null;
  try {
      const utmDef = `+proj=utm +zone=${zone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
      const result = proj4('EPSG:4326', utmDef, [lng, lat]);
      utmCoords = { x: result[0], y: result[1], zone: zone, hemi: lat >= 0 ? 'N' : 'S' };
  } catch (e) {
      console.warn("UTM calc error", e);
  }

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(type);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const fetchElevation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
      const data = await response.json();
      if (data && data.results && data.results[0]) {
        setElevation(data.results[0].elevation);
      } else {
         setElevation("N/A");
      }
    } catch (e) {
      console.error("Elevation fetch failed", e);
      setElevation("Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popup position={latlng} onClose={onClose}>
       <div className="font-sans text-sm min-w-[220px] p-1">
         <h3 className="font-bold border-b border-gray-200 mb-2 pb-1 text-gray-800">Coordinates & Height</h3>
         
         {/* Decimal Degrees */}
         <div className="mb-2">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-gray-500 text-[10px] uppercase font-semibold">Decimal</span>
                <button 
                  onClick={() => handleCopy(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'dd')} 
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px]"
                >
                   {copyStatus === 'dd' ? <Check size={10} /> : <Copy size={10} />}
                   {copyStatus === 'dd' ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700">
                {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
         </div>

         {/* DMS */}
         <div className="mb-2">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-gray-500 text-[10px] uppercase font-semibold">DMS</span>
                 <button 
                   onClick={() => handleCopy(`${toDMS(lat, 'lat')} ${toDMS(lng, 'lng')}`, 'dms')} 
                   className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px]"
                 >
                   {copyStatus === 'dms' ? <Check size={10} /> : <Copy size={10} />}
                   {copyStatus === 'dms' ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700 leading-tight">
                {toDMS(lat, 'lat')}<br/>{toDMS(lng, 'lng')}
            </div>
         </div>

         {/* Mercator */}
         <div className="mb-2">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-gray-500 text-[10px] uppercase font-semibold">Mercator (EPSG:3857)</span>
                 <button 
                   onClick={() => handleCopy(`${point.x.toFixed(2)}, ${point.y.toFixed(2)}`, 'merc')} 
                   className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px]"
                 >
                   {copyStatus === 'merc' ? <Check size={10} /> : <Copy size={10} />}
                   {copyStatus === 'merc' ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700 leading-tight">
                X: {point.x.toFixed(2)}<br/>Y: {point.y.toFixed(2)}
            </div>
         </div>

         {/* UTM */}
         {utmCoords && (
             <div className="mb-2">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-gray-500 text-[10px] uppercase font-semibold">UTM Zone {utmCoords.zone}{utmCoords.hemi}</span>
                     <button 
                       onClick={() => handleCopy(`${utmCoords.x.toFixed(2)}, ${utmCoords.y.toFixed(2)}`, 'utm')} 
                       className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[10px]"
                     >
                       {copyStatus === 'utm' ? <Check size={10} /> : <Copy size={10} />}
                       {copyStatus === 'utm' ? 'Copied' : 'Copy'}
                    </button>
                </div>
                <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700 leading-tight">
                    E: {utmCoords.x.toFixed(2)}<br/>N: {utmCoords.y.toFixed(2)}
                </div>
             </div>
         )}

         {/* Elevation */}
         <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
               <span className="text-gray-500 text-[10px] uppercase font-semibold">Elevation</span>
               {elevation === null ? (
                 <button 
                   onClick={fetchElevation} 
                   disabled={loading} 
                   className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50 font-medium transition-colors"
                 >
                    {loading ? 'Loading...' : 'Get Height'}
                 </button>
               ) : (
                 <span className="font-mono font-bold text-green-600 text-sm">{typeof elevation === 'number' ? `${Math.round(elevation)} m` : elevation}</span>
               )}
            </div>
         </div>
       </div>
    </Popup>
  );
};

// --- Map Interaction Tools ---
const MapTools = ({ activeTool, onMeasureClick, onExtractClick, onIdentifyClick, onMeasureFinish, onPolygonClick, onPolygonFinish, onBufferClick, onCoordinateClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleClick = (e) => {
      console.log('Map Clicked:', e.latlng, 'Active Tool:', activeTool);
      if (activeTool === 'measure') {
        onMeasureClick(e.latlng);
      } else if (activeTool === 'extract') {
        onExtractClick(e.latlng);
      } else if (activeTool === 'identify') {
        onIdentifyClick(e.latlng, map);
      } else if (activeTool === 'polygon-measure') {
        onPolygonClick(e.latlng);
      } else if (activeTool === 'buffer') {
        onBufferClick(e.latlng);
      } else if (activeTool === 'coordinate') {
        onCoordinateClick(e.latlng);
      }
    };

    const handleDblClick = (e) => {
      if (activeTool === 'measure') {
        onMeasureFinish(e.latlng);
      } else if (activeTool === 'polygon-measure') {
        onPolygonFinish(e.latlng);
      }
    };

    // Disable default map click behavior if a tool is active to prevent conflicts
    if (activeTool) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
      map.getContainer().style.cursor = '';
    };
  }, [map, activeTool, onMeasureClick, onExtractClick, onIdentifyClick, onMeasureFinish, onPolygonClick, onPolygonFinish, onBufferClick, onCoordinateClick]);

  return null;
};

// --- Helper Components ---
const MapUpdater = ({ selectedPoint }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lon], 18, {
        duration: 1.5
      });
    }
  }, [selectedPoint, map]);
  return null;
};

const MapZoomHandler = ({ trigger, filteredPoints }) => {
  const map = useMap();

  useEffect(() => {
    if (trigger > 0 && filteredPoints && filteredPoints.length > 0) {
      const points = filteredPoints.map(p => [p.lat, p.lon]);
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        }
      }
    }
  }, [trigger, filteredPoints, map]);

  return null;
};

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  });
  return null;
};

// --- Search Component ---
const SearchBar = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    
    // Check if query is coordinates (lat,lon)
    const coords = query.split(',').map(n => parseFloat(n.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      map.flyTo([coords[0], coords[1]], 16);
      setLoading(false);
      return;
    }

    // Otherwise search nominatim
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        map.flyTo([parseFloat(lat), parseFloat(lon)], 16);
      } else {
        alert('Location not found');
      }
    } catch (err) {
      console.error('Search error:', err);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', margin: '10px', zIndex: 5500 }}>
      <form onSubmit={handleSearch} className="flex items-center bg-white/70 backdrop-blur-md rounded-lg shadow-md overflow-hidden border border-gray-200/50 w-64">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or lat,lon..."
          className="flex-1 px-3 py-2 text-sm text-gray-700 bg-transparent focus:outline-none placeholder-gray-500"
        />
        <button 
          type="submit" 
          className="p-2 bg-transparent text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center"
          disabled={loading}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Search size={16} />
          )}
        </button>
      </form>
    </div>
  );
};

// --- Static Icons for Normal Markers ---
const greenDotIcon = L.divIcon({
  className: 'custom-marker-icon', 
  html: `
    <div style="
      width: 12px; 
      height: 12px; 
      background-color: #22c55e;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    ">
    </div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const redDotIcon = L.divIcon({
  className: 'custom-marker-icon', 
  html: `
    <div style="
      width: 12px; 
      height: 12px; 
      background-color: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    ">
    </div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

// --- Points Layer (Unselected Points) ---
// Memoized to prevent re-renders when viewState (yaw) changes
const PointsLayer = React.memo(({ points, activeLayers, filterColorByDate, filterDate, onPointSelect, selectedPointId }) => {
  if (!activeLayers || !activeLayers.includes('panotrack')) return null;

  return points.map((point) => {
    // Skip the selected point (it's rendered by SelectedMarker)
    if (point.id === selectedPointId) return null;

    // Determine icon based on date filter
    let icon = greenDotIcon;
    
    if (filterColorByDate && filterDate) {
       const pointDate = new Date(point.captured_at);
       const thresholdDate = new Date(filterDate);
       
       // If point date is valid and older than threshold -> Red
       if (!isNaN(pointDate.getTime()) && !isNaN(thresholdDate.getTime())) {
         if (pointDate < thresholdDate) {
           icon = redDotIcon;
         }
       }
    }
    
    return (
      <Marker 
        key={point.id} 
        position={[point.lat, point.lon]}
        icon={icon}
        eventHandlers={{
          click: () => onPointSelect(point),
        }}
      />
    );
  });
}, (prevProps, nextProps) => {
  // Custom comparison to ensure strict equality on key props
  return (
    prevProps.points === nextProps.points &&
    prevProps.selectedPointId === nextProps.selectedPointId &&
    prevProps.filterColorByDate === nextProps.filterColorByDate &&
    prevProps.filterDate === nextProps.filterDate &&
    prevProps.activeLayers === nextProps.activeLayers
  );
});

// --- Selected Marker Component ---
// Renders only the selected point with the rotating cone
const SelectedMarker = ({ point, viewState }) => {
  if (!point) return null;

  const yaw = viewState?.yaw || 0;
  
  // Memoize the icon to prevent unnecessary recreation
  const icon = useMemo(() => {
     return L.divIcon({
       className: 'selected-marker-icon',
       html: `
         <div style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
           <!-- Cone (Rotated) -->
           <div style="
             position: absolute;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             transform: rotate(${yaw}deg);
             pointer-events: none;
           ">
             <svg viewBox="0 0 100 100" width="60" height="60" style="overflow: visible;">
               <defs>
                 <linearGradient id="grad1" x1="0%" y1="100%" x2="0%" y2="0%">
                   <stop offset="0%" style="stop-color:rgb(34,197,94);stop-opacity:0" />
                   <stop offset="100%" style="stop-color:rgb(34,197,94);stop-opacity:0.5" />
                 </linearGradient>
               </defs>
               <path d="M 50 50 L 15 10 A 50 50 0 0 1 85 10 Z" fill="url(#grad1)" stroke="none" />
             </svg>
           </div>

           <!-- Professional Location Puck (Center) -->
           <div style="
             position: relative;
             z-index: 10;
             width: 24px;
             height: 24px;
             background-color: #16a34a;
             border: 3px solid white;
             border-radius: 50%;
             box-shadow: 0 4px 6px rgba(0,0,0,0.3);
           ">
           </div>
         </div>
       `,
       iconSize: [60, 60],
       iconAnchor: [30, 30]
     });
  }, [yaw]);

  return (
    <Marker 
      position={[point.lat, point.lon]}
      icon={icon}
      zIndexOffset={1000} // Keep on top
    />
  );
};

const MapComponent = ({ points, filteredPoints, selectedPoint, onPointSelect, viewState, qgisWmsUrl, activeLayers, activeBasemap, activeTool, setActiveTool, filterSubgrid, filterDate, filterColorByDate, filterDateStrict, zoomToTrackTrigger }) => {
  const [measurements, setMeasurements] = useState([]); // Array of polylines
  const [currentMeasurement, setCurrentMeasurement] = useState([]); // Points of current measurement
  const [extractedFeatures, setExtractedFeatures] = useState([]); // Array of markers {id, lat, lng, type}
  
  // New GIS Tool States
  const [polygonMeasurements, setPolygonMeasurements] = useState([]); // Array of { id, positions, area }
  const [currentPolygon, setCurrentPolygon] = useState([]);
  const [buffers, setBuffers] = useState([]); // Array of GeoJSON objects
  const [coordinateInfo, setCoordinateInfo] = useState(null); // { lat, lng } for popup

  // --- Tool Effect Handler ---
  useEffect(() => {
    if (activeTool === 'clear') {
      setMeasurements([]);
      setCurrentMeasurement([]);
      setExtractedFeatures([]);
      setPolygonMeasurements([]);
      setCurrentPolygon([]);
      setBuffers([]);
      setCoordinateInfo(null);
      setActiveTool(null);
    } else if (activeTool === 'download') {
      const data = {
        type: "FeatureCollection",
        features: [
          ...extractedFeatures.map(f => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [f.lng, f.lat] },
            properties: { type: "extracted_point", id: f.id }
          })),
          ...measurements.map((m, i) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: m.map(p => [p.lng, p.lat]) },
            properties: { type: "measurement", id: i }
          })),
          ...polygonMeasurements.map((p, i) => ({
            type: "Feature",
            geometry: { 
              type: "Polygon", 
              coordinates: [[...p.positions.map(pos => [pos.lng, pos.lat]), [p.positions[0].lng, p.positions[0].lat]]] 
            },
            properties: { type: "polygon_measurement", id: i, area: p.area }
          })),
          ...buffers.map((b, i) => ({
             ...b,
             properties: { ...b.properties, id: `buffer_${i}` }
          }))
        ]
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `map_data_${new Date().toISOString().slice(0,10)}.geojson`;
      a.click();
      setActiveTool(null);
    }
  }, [activeTool, setActiveTool, extractedFeatures, measurements, polygonMeasurements, buffers]);

  // --- Tool Handlers ---
  const handleMeasureClick = (latlng) => {
    setCurrentMeasurement(prev => [...prev, latlng]);
  };

  const handleMeasureFinish = (latlng) => {
    if (currentMeasurement.length > 0) {
      setMeasurements(prev => [...prev, [...currentMeasurement, latlng]]);
      setCurrentMeasurement([]);
    }
  };

  const handlePolygonClick = (latlng) => {
    setCurrentPolygon(prev => [...prev, latlng]);
  };

  const handlePolygonFinish = (latlng) => {
    if (currentPolygon.length >= 2) {
      const positions = [...currentPolygon, latlng];
      
      // Calculate Area using Turf
      const coordinates = [...positions.map(p => [p.lng, p.lat]), [positions[0].lng, positions[0].lat]];
      const polygon = turf.polygon([coordinates]);
      const area = turf.area(polygon); // sq meters

      setPolygonMeasurements(prev => [...prev, {
        id: Date.now(),
        positions: positions,
        area: area
      }]);
      setCurrentPolygon([]);
    }
  };

  const handleBufferClick = (latlng) => {
    const radius = prompt("Enter buffer radius in meters:", "50");
    if (radius && !isNaN(radius)) {
      const point = turf.point([latlng.lng, latlng.lat]);
      const buffered = turf.buffer(point, parseFloat(radius), { units: 'meters' });
      setBuffers(prev => [...prev, buffered]);
    }
  };

  const handleCoordinateClick = (latlng) => {
    setCoordinateInfo(latlng);
  };

  const handleExtractClick = (latlng) => {
    setExtractedFeatures(prev => [...prev, {
      id: Date.now(),
      lat: latlng.lat,
      lng: latlng.lng,
      type: 'point'
    }]);
  };

  const handleIdentifyClick = (latlng, map) => {
    L.popup()
      .setLatLng(latlng)
      .setContent(`<div class="font-sans text-sm">
        <strong>Location Info</strong><br/>
        Lat: ${latlng.lat.toFixed(5)}<br/>
        Lon: ${latlng.lng.toFixed(5)}
      </div>`)
      .openOn(map);
  };



  // --- Mini Map Component ---
  const MiniMapUpdater = ({ parentCenter, parentZoom }) => {
    const miniMap = useMap();
    useEffect(() => {
      miniMap.setView(parentCenter, parentZoom);
    }, [parentCenter, parentZoom, miniMap]);
    return null;
  };

  const MiniMap = () => {
    const parentMap = useMap();
    const [bounds, setBounds] = useState(parentMap.getBounds());
    const [center, setCenter] = useState(parentMap.getCenter());
    const [zoom, setZoom] = useState(parentMap.getZoom());

    // Listen to parent map events
    useMapEvents({
      move: () => {
        setCenter(parentMap.getCenter());
        setBounds(parentMap.getBounds());
      },
      zoom: () => {
        setZoom(parentMap.getZoom());
        setBounds(parentMap.getBounds());
      }
    });

    // Calculate mini map zoom (clamped)
    const miniMapZoom = Math.max(0, zoom - 5);
    
    return (
      <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto', marginBottom: '24px', marginLeft: '24px', zIndex: 5500 }}>
         <div className="w-48 h-36 rounded-2xl shadow-2xl border-4 border-white overflow-hidden relative group hover:scale-105 transition-transform duration-300 ring-1 ring-gray-900/10">
           <MapContainer
              center={center}
              zoom={miniMapZoom}
              zoomControl={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              dragging={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%', background: '#f8fafc' }}
           >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />
              <MiniMapUpdater parentCenter={center} parentZoom={miniMapZoom} />
              <Rectangle bounds={bounds} pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.1, dashArray: '4' }} />
           </MapContainer>
           
           {/* Label Overlay */}
           <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-gray-700 shadow-sm z-[5501] border border-gray-200/50">
              OVERVIEW
           </div>
         </div>
      </div>
    );
  };

  // --- Coordinate Display Component ---
  const CoordinateDisplay = () => {
    const [coords, setCoords] = useState({ lat: 0, lng: 0 });

    useMapEvents({
      mousemove(e) {
        setCoords(e.latlng);
      },
    });

    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[5500] bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-mono text-gray-700 border border-gray-200 shadow-sm pointer-events-none">
        EPSG:4326 | Lat: {coords.lat.toFixed(6)}, Lon: {coords.lng.toFixed(6)}
      </div>
    );
  };

  // --- Basemap Renderer Component ---
  const BaseLayerRenderer = ({ activeBasemap }) => {
    const currentMap = BASEMAPS.find(b => b.id === activeBasemap) || BASEMAPS[0];

    return (
      <TileLayer
        key={currentMap.id}
        {...currentMap}
      />
    );
  };

  return (
    <MapContainer 
      center={[4.2105, 101.9758]} 
      zoom={6} 
      style={{ height: '100%', width: '100%', background: '#f8fafc' }}
      zoomControl={false}
    >
      <MapUpdater selectedPoint={selectedPoint} />
      <MapZoomHandler trigger={zoomToTrackTrigger} filteredPoints={filteredPoints} />
      <MapResizer />
      
      <SearchBar />
      <BaseLayerRenderer activeBasemap={activeBasemap} />
      <MiniMap />
      <CoordinateDisplay />

      {qgisWmsUrl && activeLayers && activeLayers.map((name) => (
        name !== 'panotrack' && (
          <WMSTileLayer
            key={name}
            url={qgisWmsUrl}
            layers={name}
            format="image/png"
            transparent
            version="1.3.0"
          />
        )
      ))}

      <PointsLayer 
        points={filteredPoints}
        activeLayers={activeLayers}
        filterColorByDate={filterColorByDate}
        filterDate={filterDate}
        onPointSelect={onPointSelect}
        selectedPointId={selectedPoint?.id}
      />

      {activeLayers && activeLayers.includes('panotrack') && selectedPoint && (
        <SelectedMarker 
          point={selectedPoint}
          viewState={viewState}
        />
      )}

      <MapTools 
        activeTool={activeTool}
        onMeasureClick={handleMeasureClick}
        onExtractClick={handleExtractClick}
        onIdentifyClick={handleIdentifyClick}
        onMeasureFinish={handleMeasureFinish}
        onPolygonClick={handlePolygonClick}
        onPolygonFinish={handlePolygonFinish}
        onBufferClick={handleBufferClick}
        onCoordinateClick={handleCoordinateClick}
      />

      {measurements.map((positions, i) => (
        <React.Fragment key={`measure-${i}`}>
          <Polyline positions={positions} color="#ef4444" dashArray="5, 10" weight={3} />
          {positions.map((pos, j) => (
            <CircleMarker key={j} center={pos} radius={4} color="#ef4444" fillColor="white" fillOpacity={1} weight={2} />
          ))}
        </React.Fragment>
      ))}
      
      {currentMeasurement.length > 0 && (
        <>
          <Polyline positions={currentMeasurement} color="#ef4444" dashArray="5, 10" weight={3} />
          {currentMeasurement.map((pos, j) => (
             <CircleMarker key={j} center={pos} radius={4} color="#ef4444" fillColor="white" fillOpacity={1} weight={2} />
          ))}
        </>
      )}

      {/* Polygon Measurements Rendering */}
      {polygonMeasurements.map((poly) => (
        <Polygon key={poly.id} positions={poly.positions} color="#3b82f6" fillOpacity={0.2} weight={2}>
            <Popup>
                <div className="text-sm">
                    <strong>Area Measurement</strong><br/>
                    {Math.round(poly.area).toLocaleString()} m²<br/>
                    {(poly.area / 10000).toFixed(2)} hectares
                </div>
            </Popup>
        </Polygon>
      ))}

      {currentPolygon.length > 0 && (
        <>
            <Polyline positions={currentPolygon} color="#3b82f6" dashArray="5, 5" weight={2} />
            {currentPolygon.map((pos, i) => (
                <CircleMarker key={i} center={pos} radius={3} color="#3b82f6" fillColor="white" fillOpacity={1} />
            ))}
        </>
      )}

      {/* Buffers Rendering */}
      {buffers.map((buf, i) => (
        <GeoJSON key={`buffer-${i}`} data={buf} style={{ color: '#8b5cf6', weight: 2, fillOpacity: 0.2 }} />
      ))}

      {/* Extracted Features */}
      {extractedFeatures.map((feat) => (
        <Marker 
          key={feat.id} 
          position={[feat.lat, feat.lng]}
          icon={L.divIcon({
             className: 'custom-div-icon',
             html: `<div style="background-color: #f59e0b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
             iconSize: [14, 14],
             iconAnchor: [7, 7]
          })}
        >
          <Popup>
            <div className="text-sm">
              <strong>Extracted Feature</strong><br/>
              ID: {feat.id}<br/>
              Type: Point
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Coordinate Popup */}
      {coordinateInfo && (
          <CoordinatePopup latlng={coordinateInfo} onClose={() => setCoordinateInfo(null)} />
      )}

    </MapContainer>
  );
};

export default MapComponent;
