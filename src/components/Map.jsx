import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Map as MapIcon, Layers, Copy, Check, X } from 'lucide-react';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { useTheme } from '../context/ThemeContext';
import { BASEMAPS } from '../config/basemaps';
import clsx from 'clsx';

// --- Constants & Config ---
const INITIAL_CENTER = [2.54866, 102.815835]; // Center of the 265 points found in previous session
const INITIAL_ZOOM = 16;

// --- Helper: Coordinate Conversion ---
const toDMS = (deg, type) => {
  const d = Math.floor(Math.abs(deg));
  const minfloat = (Math.abs(deg) - d) * 60;
  const m = Math.floor(minfloat);
  const s = ((minfloat - m) * 60).toFixed(2);
  const dir = deg > 0 ? (type === 'lat' ? 'N' : 'E') : (type === 'lat' ? 'S' : 'W');
  return `${d}° ${m}' ${s}" ${dir}`;
};

// --- Coordinate Popup Component ---
const CoordinatePopupContent = ({ latlng, onClose }) => {
  const [elevation, setElevation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);

  const { lat, lng } = latlng;

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
      setElevation(data?.results?.[0]?.elevation ?? "N/A");
    } catch (e) {
      setElevation("Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-sans text-sm min-w-[220px] p-1">
      <h3 className="font-bold border-b border-gray-200 mb-2 pb-1 text-gray-800">Coordinates & Height</h3>
      <div className="mb-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-gray-500 text-[10px] uppercase font-semibold">Decimal</span>
          <button onClick={() => handleCopy(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'dd')} className="text-blue-600 flex items-center gap-1 text-[10px]">
            {copyStatus === 'dd' ? <Check size={10} /> : <Copy size={10} />}
            {copyStatus === 'dd' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-gray-500 text-[10px] uppercase font-semibold">DMS</span>
          <button onClick={() => handleCopy(`${toDMS(lat, 'lat')} ${toDMS(lng, 'lng')}`, 'dms')} className="text-blue-600 flex items-center gap-1 text-[10px]">
            {copyStatus === 'dms' ? <Check size={10} /> : <Copy size={10} />}
            {copyStatus === 'dms' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="font-mono text-xs bg-gray-50 p-1.5 rounded border border-gray-100 text-gray-700 leading-tight">
          {toDMS(lat, 'lat')}<br />{toDMS(lng, 'lng')}
        </div>
      </div>
      <div className="border-t border-gray-200 pt-2 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-[10px] uppercase font-semibold">Elevation</span>
          {elevation === null ? (
            <button onClick={fetchElevation} disabled={loading} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded">
              {loading ? 'Loading...' : 'Get Height'}
            </button>
          ) : (
            <span className="font-mono font-bold text-green-600 text-sm">{typeof elevation === 'number' ? `${Math.round(elevation)} m` : elevation}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Map Logic Controller ---
const MapController = ({
  filteredPoints,
  selectedPoint,
  activeBasemap,
  activeTool,
  setActiveTool,
  zoomToTrackTrigger,
  resizeTrigger,
  isViewerOpen,
  viewState,
  isEmbed,
  setMapInstance,
  setCurrentZoom
}) => {
  const map = useMap();

  // Auto-invalidate map size on container resize, splitter drag, or viewer toggle
  useEffect(() => {
    if (!map) return;

    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);

    const container = map.getContainer();
    if (!container) return () => { clearTimeout(t1); clearTimeout(t2); };

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, resizeTrigger, isViewerOpen]);

  useEffect(() => {
    if (map) {
      setMapInstance(map);
      window.MAP = map; // For debugging

      const onZoom = () => setCurrentZoom(map.getZoom());
      map.on('zoomend', onZoom);
      return () => map.off('zoomend', onZoom);
    }
  }, [map, setMapInstance, setCurrentZoom]);

  // Auto-fit Bounds (only when NO selectedPoint is present)
  useEffect(() => {
    if (!selectedPoint && filteredPoints.length > 0) {
      const latlngs = filteredPoints
        .map(p => {
          const ln = parseFloat(p.lon ?? p.longitude ?? p.lng);
          const lt = parseFloat(p.lat ?? p.latitude);
          return isNaN(ln) || isNaN(lt) ? null : [lt, ln];
        })
        .filter(Boolean);

      if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [filteredPoints, selectedPoint, map]);

  // Fly to selected point track at max zoom level (level 19)
  useEffect(() => {
    if (selectedPoint) {
      const lat = parseFloat(selectedPoint.lat ?? selectedPoint.latitude);
      const lon = parseFloat(selectedPoint.lon ?? selectedPoint.longitude ?? selectedPoint.lng);
      if (!isNaN(lat) && !isNaN(lon)) {
        map.flyTo([lat, lon], 19, { animate: true, duration: 0.8 });
      }
    }
  }, [selectedPoint, zoomToTrackTrigger, map]);

  // Listen for map-fly-to events from search
  useEffect(() => {
    const handleFlyTo = (e) => {
      if (map && e.detail && typeof e.detail.lat === 'number' && typeof e.detail.lon === 'number') {
        map.flyTo([e.detail.lat, e.detail.lon], 16);
      }
    };
    window.addEventListener('map-fly-to', handleFlyTo);
    return () => window.removeEventListener('map-fly-to', handleFlyTo);
  }, [map]);

  // Throttled postMessage for Dashboard
  const lastPostTimeRef = useRef(0);

  useMapEvents({
    mousemove: (e) => {
      const now = performance.now();
      if (isEmbed && now - lastPostTimeRef.current > 50) { // 20Hz limit
        window.parent.postMessage({
          type: 'MAP_COORDS',
          lat: e.latlng.lat,
          lon: e.latlng.lng,
          lng: e.latlng.lng
        }, '*');
        lastPostTimeRef.current = now;
      }
    },
    click: (e) => {
      if (activeTool === 'coordinate') {
        L.popup({ maxWidth: 300 })
          .setLatLng(e.latlng)
          .setContent(L.DomUtil.create('div')) // Placeholder for React portal if needed, but we use native for now
          .openOn(map);
      }
    }
  });

  return null;
};

// --- Memoized Point Marker for Performance ---
const PointMarker = React.memo(({ point, radius, weight, color, onClick }) => {
  const lat = parseFloat(point.lat ?? point.latitude);
  const lon = parseFloat(point.lon ?? point.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  return (
    <CircleMarker
      center={[lat, lon]}
      radius={radius}
      pathOptions={{
        fillColor: color,
        fillOpacity: 1,
        color: '#ffffff',
        weight: weight,
        className: 'panotrack-point'
      }}
      eventHandlers={{
        click: () => onClick(point)
      }}
    >
      <Popup>
        <div className="text-xs">
          <p className="font-bold">{point.subgrid}</p>
          <p className="text-gray-500">{new Date(point.captured_at).toLocaleDateString()}</p>
        </div>
      </Popup>
    </CircleMarker>
  );
});

// --- Sonar Marker Component for 60FPS Rotation ---
const SonarMarker = ({ position, yaw }) => {
  const markerRef = useRef(null);

  // Use a stable icon - we'll rotate the internal element via CSS
  const sonarIcon = useMemo(() => L.divIcon({
    className: 'custom-sonar-icon',
    html: `
      <div class="panotrack-sonar-container">
        <div class="cone-rotator-wrapper" style="position: absolute; width: 100%; height: 100%; z-index: 5;">
          <svg viewBox="0 0 100 100" width="44" height="44" style="overflow: visible;">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:rgb(0,242,255);stop-opacity:0" />
                <stop offset="100%" style="stop-color:rgb(0,242,255);stop-opacity:0.5" />
              </linearGradient>
            </defs>
            <path d="M 50 50 L 15 10 A 50 50 0 0 1 85 10 Z" fill="url(#grad1)" stroke="none" />
          </svg>
        </div>
        <div class="panotrack-sonar-core" style="z-index: 10; animation: none; box-shadow: 0 0 8px rgba(0, 242, 255, 0.5);"></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  }), []);

  // Smooth direct DOM rotation
  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      const rotator = el?.querySelector('.cone-rotator-wrapper');
      if (rotator) {
        rotator.style.transform = `rotate(${yaw}deg)`;
      }
    }
  }, [yaw]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={sonarIcon}
      zIndexOffset={1000}
    />
  );
};

const MapComponent = ({
  isEmbed = false,
  points = [],
  filteredPoints = [],
  selectedPoint,
  onPointSelect,
  viewState,
  qgisWmsUrl,
  activeLayers = ['panotrack'],
  activeBasemap,
  activeTool,
  setActiveTool,
  filterSubgrid,
  filterDate,
  filterColorByDate,
  zoomToTrackTrigger,
  resizeTrigger,
  isViewerOpen,
  isDrawingExportBBox,
  onBoundaryDrawn
}) => {
  const { isDark } = useTheme();
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);

  const basemap = useMemo(() => {
    return BASEMAPS.find(b => b.id === activeBasemap) || BASEMAPS[0];
  }, [activeBasemap]);

  const isPanotrackVisible = activeLayers.includes('panotrack');

  // Dynamic radius calculation: smaller for better map clarity
  const markerRadius = useMemo(() => {
    if (currentZoom >= 18) return 6;
    if (currentZoom >= 16) return 5;
    if (currentZoom >= 14) return 4;
    if (currentZoom >= 12) return 3;
    return 2;
  }, [currentZoom]);

  const markerWeight = useMemo(() => {
    if (currentZoom >= 16) return 1.5;
    return 1.0;
  }, [currentZoom]);

  // Tool Clear logic
  useEffect(() => {
    if (activeTool === 'clear') {
      setActiveTool(null);
    }
  }, [activeTool, setActiveTool]);

  const rightMargin = isEmbed ? '60px' : (!isViewerOpen ? '200px' : '10px');

  return (
    <div className="relative w-full h-full bg-[#f8fafc]">
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        preferCanvas={true}
        whenCreated={setMapInstance}
      >
        <TileLayer
          key={basemap.id}
          url={basemap.url}
          attribution={basemap.attribution}
          subdomains={basemap.subdomains || ['a', 'b', 'c']}
          maxZoom={basemap.maxZoom || 19}
        />

        <MapController
          filteredPoints={filteredPoints}
          selectedPoint={selectedPoint}
          activeBasemap={activeBasemap}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          zoomToTrackTrigger={zoomToTrackTrigger}
          resizeTrigger={resizeTrigger}
          isViewerOpen={isViewerOpen}
          viewState={viewState}
          isEmbed={isEmbed}
          setMapInstance={setMapInstance}
          setCurrentZoom={setCurrentZoom}
        />

        {/* Points Layer */}
        {isPanotrackVisible && filteredPoints.map((p) => {
          const isSelected = selectedPoint?.id === p.id;
          if (isSelected) return null;

          const isDefect = Boolean(p.is_defect) || (typeof p.qa_status === 'string' && p.qa_status.toLowerCase().includes('flagged')) || (p.defect_flags && typeof p.defect_flags === 'object' && Object.values(p.defect_flags).some(Boolean));
          const color = isDefect ? '#f97316' : (filterColorByDate && new Date(p.captured_at) < new Date(filterDate)) ? '#ef4444' : '#22c55e';

          return (
            <PointMarker
              key={p.id}
              point={p}
              radius={markerRadius}
              weight={markerWeight}
              color={color}
              onClick={onPointSelect}
            />
          );
        })}

        {/* Selected Point Sonar */}
        {selectedPoint && (
          <SonarMarker
            position={[parseFloat(selectedPoint.lat ?? selectedPoint.latitude), parseFloat(selectedPoint.lon ?? selectedPoint.longitude)]}
            yaw={viewState?.yaw || 0}
          />
        )}
      </MapContainer>

      {/* Tool Guidance */}
      {activeTool && !['download', 'clear'].includes(activeTool) && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[3000] bg-white/95 backdrop-blur-md border border-gray-200/90 text-gray-800 text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="font-semibold text-gray-700">
            {activeTool === 'measure' && <><span className="text-blue-600 font-bold">📐 Distance Tool:</span> Click map to add points.</>}
            {activeTool === 'coordinate' && <><span className="text-blue-600 font-bold">🎯 Coords Converter:</span> Click map to view details.</>}
          </span>
          <button onClick={() => setActiveTool(null)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg"><X size={14} /></button>
        </div>
      )}

      {/* Coordinate Display */}
      {!isEmbed && <CoordinateDisplay map={mapInstance} />}
    </div>
  );
};

// --- Sub-components ---

const SearchBar = ({ map, isDark }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query || !map) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data?.[0]) {
        map.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="relative flex items-center justify-end">
      <form onSubmit={handleSearch} className={clsx(
        "flex items-center backdrop-blur-md rounded-xl shadow-md border overflow-hidden transition-all duration-300 h-10",
        isDark ? "bg-slate-900/90 border-slate-700/70 text-slate-100" : "bg-white/80 border-gray-200/50 text-gray-800",
        isOpen ? "w-64 px-1" : "w-10 px-0"
      )}>
        {isOpen && (
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search location..."
            className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
          />
        )}
        <button type="button" onClick={() => setIsOpen(!isOpen)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-black/5">
          <Search size={18} className="text-blue-600" />
        </button>
      </form>
    </div>
  );
};

const CoordinateDisplay = ({ map }) => {
  const displayRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const update = (e) => {
      if (displayRef.current) {
        displayRef.current.innerText = `EPSG:4326 | Lat: ${e.latlng.lat.toFixed(5)}, Lon: ${e.latlng.lng.toFixed(5)}`;
      }
    };

    map.on('mousemove', update);
    return () => {
      map.off('mousemove', update);
    };
  }, [map]);

  if (!map) return null;

  return (
    <div
      ref={displayRef}
      className="absolute bottom-1 right-12 z-[1000] bg-white/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-mono text-gray-700 border border-gray-200 shadow-sm pointer-events-none"
    >
      EPSG:4326 | Lat: 0.00000, Lon: 0.00000
    </div>
  );
};

export default MapComponent;
