import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, useMap, useMapEvents, Rectangle, WMSTileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Map as MapIcon, Layers, Copy, Check, X } from 'lucide-react';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

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
            {toDMS(lat, 'lat')}<br />{toDMS(lng, 'lng')}
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
            X: {point.x.toFixed(2)}<br />Y: {point.y.toFixed(2)}
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
              E: {utmCoords.x.toFixed(2)}<br />N: {utmCoords.y.toFixed(2)}
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

  // Use refs to hold the latest callbacks to avoid re-binding event listeners on every render
  const callbacksRef = useRef({
    onMeasureClick, onExtractClick, onIdentifyClick, onMeasureFinish,
    onPolygonClick, onPolygonFinish, onBufferClick, onCoordinateClick
  });

  useEffect(() => {
    callbacksRef.current = {
      onMeasureClick, onExtractClick, onIdentifyClick, onMeasureFinish,
      onPolygonClick, onPolygonFinish, onBufferClick, onCoordinateClick
    };
  });

  useEffect(() => {
    if (!map) return;

    const handleClick = (e) => {
      // console.log('Map Clicked:', e.latlng, 'Active Tool:', activeTool);
      const cbs = callbacksRef.current;

      if (activeTool === 'measure') {
        cbs.onMeasureClick && cbs.onMeasureClick(e.latlng);
      } else if (activeTool === 'extract') {
        cbs.onExtractClick && cbs.onExtractClick(e.latlng);
      } else if (activeTool === 'identify') {
        cbs.onIdentifyClick && cbs.onIdentifyClick(e.latlng, map);
      } else if (activeTool === 'polygon-measure') {
        cbs.onPolygonClick && cbs.onPolygonClick(e.latlng);
      } else if (activeTool === 'buffer') {
        cbs.onBufferClick && cbs.onBufferClick(e.latlng);
      } else if (activeTool === 'coordinate') {
        cbs.onCoordinateClick && cbs.onCoordinateClick(e.latlng);
      }
    };

    const handleDblClick = (e) => {
      const cbs = callbacksRef.current;
      if (activeTool === 'measure') {
        cbs.onMeasureFinish && cbs.onMeasureFinish(e.latlng);
      } else if (activeTool === 'polygon-measure') {
        cbs.onPolygonFinish && cbs.onPolygonFinish(e.latlng);
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
  }, [map, activeTool]); // Dependencies reduced to only essential ones

  return null;
};

// --- Helper Components ---
const MapUpdater = ({ selectedPoint }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedPoint) {
      const { lat, lon } = selectedPoint;
      const bounds = map.getBounds();
      // Pad bounds by 5% to check visibility
      const paddedBounds = bounds.pad(-0.05);
      const isVisible = paddedBounds.contains([lat, lon]);

      const currentZoom = map.getZoom();
      // Only force zoom-in if we are too far out
      const shouldZoomIn = currentZoom < 17;

      // Only fly if point is not comfortably visible OR we need to zoom in
      if (!isVisible || shouldZoomIn) {
        const targetZoom = Math.max(currentZoom, 18);
        map.flyTo([lat, lon], targetZoom, {
          duration: 1.0,
          easeLinearity: 0.25
        });
      }
    }
  }, [selectedPoint, map]);
  return null;
};

const MapZoomHandler = ({ trigger, filteredPoints }) => {
  const map = useMap();

  useEffect(() => {
    if (filteredPoints && filteredPoints.length > 0) {
      const validPoints = filteredPoints
        .filter(p => p && !isNaN(p.lat) && !isNaN(p.lon))
        .map(p => [p.lat, p.lon]);

      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        }
      }
    }
  }, [trigger, filteredPoints, map]);

  return null;
};

const MapResizer = ({ resizeTrigger }) => {
  const map = useMap();

  // Robust generic resize observer
  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
};

// --- Search Component ---
const SearchBar = ({ isViewerOpen, isEmbed = false }) => {
  const map = useMap();
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  // Calculate right margin based on viewer/embed state.
  const rightMargin = isEmbed ? '60px' : (!isViewerOpen ? '200px' : '10px');

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '12px', marginRight: rightMargin, marginBottom: '10px', marginLeft: '10px', zIndex: 1000, transition: 'margin-right 0.3s ease' }}>
      <div className="relative flex items-center justify-end">
        <form
          onSubmit={handleSearch}
          className={clsx(
            "flex items-center backdrop-blur-md rounded-xl shadow-md border overflow-hidden transition-all duration-300 origin-right h-10",
            isDark
              ? "bg-slate-900/90 border-slate-700/70 text-slate-100 shadow-slate-950/50"
              : "bg-white/80 border-gray-200/50 text-gray-800 shadow-sm",
            isOpen ? "w-56 sm:w-72 px-1" : "w-10 px-0"
          )}
        >
          {isOpen && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search location or lat,lon..."
              className={clsx(
                "flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none min-w-0 transition-all",
                isDark ? "text-slate-100 placeholder-slate-400" : "text-gray-700 placeholder-gray-400"
              )}
            />
          )}

          {isOpen && query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className={clsx("p-1.5 rounded-lg transition-colors shrink-0", isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          <button
            type={isOpen && query.trim() ? "submit" : "button"}
            onClick={() => {
              if (!isOpen) {
                setIsOpen(true);
              } else if (!query.trim()) {
                setIsOpen(false);
              }
            }}
            className={clsx(
              "h-10 w-10 transition-colors flex items-center justify-center shrink-0 rounded-xl",
              isDark
                ? "text-blue-400 hover:text-blue-300 hover:bg-slate-800/80"
                : "text-blue-600 hover:text-blue-800 hover:bg-slate-100/60"
            )}
            title={isOpen ? "Search" : "Open Search Bar"}
            disabled={loading}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search size={18} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Static Icons for Normal Markers ---
// Removed to use CircleMarker for better performance with large datasets


// --- Points Layer (Unselected Points) ---
// Memoized to prevent re-renders when viewState (yaw) changes
const PointsLayer = React.memo(({ points, activeLayers, filterColorByDate, filterDate, onPointSelect, selectedPointId, readonly = false }) => {
  if (!activeLayers || !activeLayers.includes('panotrack')) return null;

  return points.map((point) => {
    // Skip the selected point (it's rendered by SelectedMarker)
    if (point.id === selectedPointId) return null;

    // Determine color based on date filter
    let fillColor = '#22c55e'; // green-500

    if (filterColorByDate && filterDate) {
      const pointDate = new Date(point.captured_at);
      const thresholdDate = new Date(filterDate);

      // If point date is valid and older than threshold -> Red
      if (!isNaN(pointDate.getTime()) && !isNaN(thresholdDate.getTime())) {
        if (pointDate < thresholdDate) {
          fillColor = '#ef4444'; // red-500
        }
      }
    }

    return (
      <CircleMarker
        key={point.id}
        center={[point.lat, point.lon]}
        radius={6}
        fillColor={fillColor}
        color="white"
        weight={2}
        opacity={1}
        fillOpacity={1}
        // Disable click interaction in readonly/embed mode
        eventHandlers={readonly ? {} : {
          click: (e) => {
            if (e.originalEvent) {
              L.DomEvent.stopPropagation(e.originalEvent);
            }
            onPointSelect(point);
          },
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
    prevProps.activeLayers === nextProps.activeLayers &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.onPointSelect === nextProps.onPointSelect
  );
});

// --- Selected Marker Component ---
// Renders only the selected point with the rotating cone
const SelectedMarker = ({ point, viewState }) => {
  if (!point) return null;

  const yaw = viewState?.yaw || 0;

  // Memoize the icon to prevent unnecessary recreation which causes flashing
  // We use a stable ID in the HTML to update rotation via DOM instead of replacing the icon
  const icon = useMemo(() => {
    return L.divIcon({
      className: 'selected-marker-icon',
      html: `
         <div style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
           <!-- Cone (Rotated via JS) -->
           <div id="cone-rotator-${point.id}" style="
             position: absolute;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             transition: transform 0.1s linear;
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
  }, [point.id]);

  // Update rotation directly via DOM to avoid Leaflet re-render thrashing
  useEffect(() => {
    const el = document.getElementById(`cone-rotator-${point.id}`);
    if (el) {
      el.style.transform = `rotate(${yaw}deg)`;
    }
  }, [yaw, point.id]);

  return (
    <Marker
      position={[point.lat, point.lon]}
      icon={icon}
      zIndexOffset={1000} // Keep on top
      interactive={false} // Allow clicks to pass through to underlying points
    />
  );
};

// --- Map Fly To Event Listener ---
const MapFlyToListener = () => {
  const map = useMap();
  useEffect(() => {
    const handleFly = (e) => {
      if (e.detail && e.detail.lat !== undefined && e.detail.lon !== undefined) {
        map.flyTo([e.detail.lat, e.detail.lon], 16);
      }
    };
    window.addEventListener('map-fly-to', handleFly);
    return () => window.removeEventListener('map-fly-to', handleFly);
  }, [map]);
  return null;
};

// --- Mini Map Component ---
const MiniMapUpdater = ({ parentCenter, parentZoom }) => {
  const miniMap = useMap();
  useEffect(() => {
    miniMap.setView(parentCenter, parentZoom);
  }, [parentCenter, parentZoom, miniMap]);
  return null;
};

const MiniMap = React.memo(() => {
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
    <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto', marginBottom: '24px', marginLeft: '24px', zIndex: 1000 }}>
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
});

// --- Coordinate Display Component ---
const CoordinateDisplay = ({ isEmbed = false }) => {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });

  useMapEvents({
    mousemove(e) {
      const { lat, lng } = e.latlng;
      setCoords({ lat, lng });
      // Broadcast coords to parent dashboard when embedded
      if (isEmbed && window.parent !== window) {
        window.parent.postMessage({ type: 'MAP_COORDS', lat, lng }, '*');
      }
    },
  });

  if (isEmbed) return null;

  return (
    <div className="absolute bottom-1 right-12 z-[5500] bg-white/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] sm:text-xs font-mono text-gray-700 border border-gray-200/80 shadow-sm pointer-events-none">
      EPSG:4326 | Lat: {coords.lat.toFixed(5)}, Lon: {coords.lng.toFixed(5)}
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

const MapComponent = ({ isEmbed = false, points, filteredPoints, selectedPoint, onPointSelect, viewState, qgisWmsUrl, activeLayers, activeBasemap, activeTool, setActiveTool, filterSubgrid, filterDate, filterColorByDate, filterDateStrict, zoomToTrackTrigger, resizeTrigger, isViewerOpen, isDrawingExportBBox, onBoundaryDrawn }) => {
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
    } else if (activeTool === 'clear') {
      setMeasurements([]);
      setCurrentMeasurement([]);
      setPolygonMeasurements([]);
      setCurrentPolygon([]);
      setBuffers([]);
      setExtractedFeatures([]);
      setCoordinateInfo(null);
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

      if (isDrawingExportBBox && onBoundaryDrawn) {
        const pointsInside = filteredPoints.filter(p => turf.booleanPointInPolygon(turf.point([p.lon, p.lat]), polygon));
        onBoundaryDrawn(pointsInside);
      } else {
        setPolygonMeasurements(prev => [...prev, {
          id: Date.now(),
          positions: positions,
          area: area
        }]);
      }
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





  return (
    <MapContainer
      center={[4.2105, 101.9758]}
      zoom={6}
      style={{ height: '100%', width: '100%', background: '#f8fafc' }}
      zoomControl={false}
      preferCanvas={true}
    >
      <MapUpdater selectedPoint={selectedPoint} />
      <MapZoomHandler trigger={zoomToTrackTrigger} filteredPoints={filteredPoints} />
      <MapResizer resizeTrigger={resizeTrigger} />

      {/* Active Tool Guidance Helper Banner */}
      {activeTool && !['download', 'clear'].includes(activeTool) && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[3000] bg-white/95 backdrop-blur-md border border-gray-200/90 text-gray-800 text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="font-semibold text-gray-700">
            {activeTool === 'measure' && <><span className="text-blue-600 font-bold">📐 Distance Tool:</span> Click map to add points. Double-click to finish line.</>}
            {activeTool === 'polygon-measure' && (
              isDrawingExportBBox ? (
                <><span className="text-blue-600 font-bold">✏️ Draw Export Boundary:</span> Click map to draw boundary points. Double-click to complete export area.</>
              ) : (
                <><span className="text-blue-600 font-bold">⬡ Area Tool:</span> Click map to draw polygon points. Double-click to calculate area.</>
              )
            )}
            {activeTool === 'extract' && <><span className="text-blue-600 font-bold">🖋️ Feature Extractor:</span> Click on map to place digitized point features.</>}
            {activeTool === 'identify' && <><span className="text-blue-600 font-bold">📍 Identify Tool:</span> Click any map feature or location to view GIS details.</>}
            {activeTool === 'buffer' && <><span className="text-blue-600 font-bold">⃝ Buffer Analysis:</span> Click on map to enter radius and generate buffer zone.</>}
            {activeTool === 'coordinate' && <><span className="text-blue-600 font-bold">🎯 Coords Converter:</span> Click on map to convert location to DD / DMS / UTM.</>}
          </span>
          <button
            onClick={() => setActiveTool(null)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cancel Tool"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <MapFlyToListener />
      <BaseLayerRenderer activeBasemap={activeBasemap} />
      {!isEmbed && <MiniMap />}
      <CoordinateDisplay isEmbed={isEmbed} />

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
        readonly={isEmbed}
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
              <strong>Area Measurement</strong><br />
              {Math.round(poly.area).toLocaleString()} m²<br />
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
              <strong>Extracted Feature</strong><br />
              ID: {feat.id}<br />
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
