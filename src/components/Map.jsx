import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Search, Map as MapIcon, Layers, Copy, Check, X, Box } from 'lucide-react';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { useTheme } from '../context/ThemeContext';
import { BASEMAPS } from '../config/basemaps';
import clsx from 'clsx';

// Set worker before initializing map
if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl(workerUrl);
}

// --- Constants & Config ---
const INITIAL_CENTER = [2.54866, 102.815835];
const INITIAL_ZOOM = 16;

// Collect [lng, lat] outer rings from a GeoJSON geometry. Handles both
// Polygon and MultiPolygon shapes (states / whole country are MultiPolygon).
const collectOuterRings = (geom) => {
  const rings = [];
  if (!geom) return rings;
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    if (Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 4) {
      rings.push(geom.coordinates[0]);
    }
  } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    geom.coordinates.forEach((poly) => {
      if (Array.isArray(poly) && Array.isArray(poly[0]) && poly[0].length >= 4) {
        rings.push(poly[0]);
      }
    });
  }
  return rings;
};

// Normalize any accepted boundary payload (FeatureCollection / Feature / raw
// Polygon or MultiPolygon geometry) into a FeatureCollection of usable
// Polygon/MultiPolygon features, or null if nothing usable. All features are
// preserved so multi-feature / whole-country boundaries render fully.
const normalizeBoundaryGeojson = (input) => {
  if (!input) return null;
  let features = [];
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    features = input.features;
  } else if (input.type === 'Feature') {
    features = [input];
  } else if (input.type === 'Polygon' || input.type === 'MultiPolygon') {
    features = [{ type: 'Feature', properties: {}, geometry: input }];
  } else if (input.type === 'GeometryCollection' && Array.isArray(input.geometries)) {
    features = input.geometries
      .filter((g) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon'))
      .map((g) => ({ type: 'Feature', properties: {}, geometry: g }));
  }
  const usable = features.filter(
    (f) =>
      f &&
      f.type === 'Feature' &&
      f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
      collectOuterRings(f.geometry).length > 0
  );
  if (usable.length === 0) return null;
  return { type: 'FeatureCollection', features: usable };
};

const toDMS = (deg, type) => {
  const d = Math.floor(Math.abs(deg));
  const minfloat = (Math.abs(deg) - d) * 60;
  const m = Math.floor(minfloat);
  const s = ((minfloat - m) * 60).toFixed(2);
  const dir = deg > 0 ? (type === 'lat' ? 'N' : 'E') : (type === 'lat' ? 'S' : 'W');
  return `${d}° ${m}' ${s}" ${dir}`;
};

const extractCoordinates = (p) => {
  if (!p) return null;
  const lat = parseFloat(p.lat ?? p.latitude ?? p.y ?? p.northing);
  const lon = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x ?? p.easting);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
};

const formatTileUrl = (url) => {
  let u = url || '';
  if (u.includes('{s}')) u = u.replace('{s}', 'a');
  if (u.includes('{r}')) u = u.replace('{r}', '');
  return u;
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

// --- Map Logic Controller for 2D Leaflet ---
const MapController = ({
  filteredPoints,
  stagedOverlayPoints = [],
  isStagingPreviewMap = false,
  selectedPoint,
  activeBasemap,
  boundaryGeojson = null,
  boundaryDimActive = false,
  boundaryFocus = false,
  activeTool,
  setActiveTool,
  zoomToTrackTrigger,
  resizeTrigger,
  isViewerOpen,
  viewState,
  isEmbed,
  setMapInstance,
  setCurrentZoom,
  onMapMoved
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const container = map.getContainer();
    if (!container) return () => { clearTimeout(t1); clearTimeout(t2); };
    const observer = new ResizeObserver(() => { map.invalidateSize(); });
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
      window.MAP = map;

      const onZoom = () => {
        setCurrentZoom(map.getZoom());
        if (onMapMoved) onMapMoved(map.getCenter(), map.getZoom());
      };
      const onMove = () => {
        if (onMapMoved) onMapMoved(map.getCenter(), map.getZoom());
      };

      map.on('zoomend', onZoom);
      map.on('moveend', onMove);
      return () => {
        map.off('zoomend', onZoom);
        map.off('moveend', onMove);
      };
    }
  }, [map, setMapInstance, setCurrentZoom, onMapMoved]);


  const lastBoundsKeyRef = useRef('');

  useEffect(() => {
    if (filteredPoints && filteredPoints.length > 0) {
      const latlngs = filteredPoints
        .map(p => {
          const ln = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x);
          const lt = parseFloat(p.lat ?? p.latitude ?? p.y);
          return isNaN(ln) || isNaN(lt) || (ln === 0 && lt === 0) ? null : [lt, ln];
        })
        .filter(Boolean);

      if (latlngs.length > 0) {
        let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
        latlngs.forEach(([lt, ln]) => {
          if (lt < minLat) minLat = lt;
          if (lt > maxLat) maxLat = lt;
          if (ln < minLng) minLng = ln;
          if (ln > maxLng) maxLng = ln;
        });
        const boundsKey = `${latlngs.length}_${minLng.toFixed(4)}_${minLat.toFixed(4)}_${maxLng.toFixed(4)}_${maxLat.toFixed(4)}`;

        if (boundsKey !== lastBoundsKeyRef.current) {
          lastBoundsKeyRef.current = boundsKey;
          const bounds = L.latLngBounds(latlngs);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
          }
        }
      }
    }
  }, [filteredPoints, map]);

  // Explicit user trigger for "Zoom to Track"
  useEffect(() => {
    if (zoomToTrackTrigger > 0 && filteredPoints && filteredPoints.length > 0) {
      const latlngs = filteredPoints
        .map(p => {
          const ln = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x);
          const lt = parseFloat(p.lat ?? p.latitude ?? p.y);
          return isNaN(ln) || isNaN(lt) || (ln === 0 && lt === 0) ? null : [lt, ln];
        })
        .filter(Boolean);

      if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
        }
      }
    }
  }, [zoomToTrackTrigger]);

  // Project Geographic Boundary overlay (adaptive stroke + outside-dim mask)
  const boundaryLayersRef = useRef(null);
  useEffect(() => {
    if (!map) return;

    if (boundaryLayersRef.current) {
      boundaryLayersRef.current.forEach((l) => l.remove());
      boundaryLayersRef.current = null;
    }

    const features = Array.isArray(boundaryGeojson?.features) ? boundaryGeojson.features : [];
    const rings = [];
    features.forEach((f) => {
      collectOuterRings(f.geometry).forEach((r) => {
        const leafletRing = r
          .filter((c) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
          .map(([lng, lat]) => [lat, lng]);
        if (leafletRing.length >= 3) rings.push(leafletRing);
      });
    });
    if (rings.length === 0) return;

    const dark = [
      'dark', 'carto_dark', 'ofm-dark', 'ofm-fiord', 'fiord',
      'satellite', 'esri_satellite', 'google-satellite', 'google-hybrid', 'usgs-imagery'
    ].includes(activeBasemap);
    const strokeColor = dark ? '#7dd3fc' : '#334155';
    const hoverColor = dark ? '#38bdf8' : '#1e40af';

    const layers = [];

    rings.forEach((ring) => {
      const border = L.polygon(ring, { color: strokeColor, weight: 2.5, fill: false, opacity: 1 });
      border.on('mouseover', () => border.setStyle({ color: hoverColor, weight: 6 }));
      border.on('mouseout', () => border.setStyle({ color: strokeColor, weight: 2.5 }));
      border.addTo(map);
      layers.push(border);
    });

    if (boundaryDimActive) {
      const worldRing = [
        [-85, -179.9], [85, -179.9], [85, 179.9], [-85, 179.9], [-85, -179.9]
      ];
      const dimPoly = L.polygon([worldRing, ...rings], {
        color: dark ? '#38bdf8' : '#334155',
        weight: 1,
        fillColor: dark ? '#020617' : '#0f172a',
        fillOpacity: 0.4,
        interactive: false
      });
      dimPoly.addTo(map);
      layers.push(dimPoly);
    }

    boundaryLayersRef.current = layers;

    if (boundaryFocus) {
      const bounds = rings.reduce((acc, ring) => {
        acc.extend(ring[0]);
        return ring.reduce((a, pt) => a.extend(pt), acc);
      }, L.latLngBounds([]));
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 10, duration: 1.0 });
      }
    }

    return () => {
      if (boundaryLayersRef.current) {
        boundaryLayersRef.current.forEach((l) => l.remove());
        boundaryLayersRef.current = null;
      }
    };
  }, [map, boundaryGeojson, boundaryDimActive, boundaryFocus, activeBasemap]);

  const lastSelectedCoordsRef = useRef('');
  useEffect(() => {
    if (selectedPoint && map) {
      const lat = parseFloat(selectedPoint.lat ?? selectedPoint.latitude ?? selectedPoint.y);
      const lon = parseFloat(selectedPoint.lon ?? selectedPoint.longitude ?? selectedPoint.lng ?? selectedPoint.x);
      if (!isNaN(lat) && !isNaN(lon)) {
        const coordsKey = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
        if (coordsKey !== lastSelectedCoordsRef.current) {
          lastSelectedCoordsRef.current = coordsKey;
          map.panTo([lat, lon], { animate: true, duration: 0.3 });
        }
      }
    }
  }, [selectedPoint, map]);

  useEffect(() => {
    const handleFlyTo = (e) => {
      if (map && e.detail && typeof e.detail.lat === 'number' && typeof e.detail.lon === 'number') {
        map.flyTo([e.detail.lat, e.detail.lon], 16);
      }
    };
    window.addEventListener('map-fly-to', handleFlyTo);
    return () => window.removeEventListener('map-fly-to', handleFlyTo);
  }, [map]);

  const lastPostTimeRef = useRef(0);

  useMapEvents({
    mousemove: (e) => {
      const now = performance.now();
      if (isEmbed && now - lastPostTimeRef.current > 50) {
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
          .setContent(L.DomUtil.create('div'))
          .openOn(map);
      }
    }
  });

  return null;
};

// --- Point Marker Component ---
const PointMarker = React.memo(({ point, radius, weight, color, opacity, fillOpacity, showPopup = false, onClick }) => {
  const { isDark } = useTheme();
  const lat = parseFloat(point.lat ?? point.latitude ?? point.y);
  const lon = parseFloat(point.lon ?? point.longitude ?? point.lng ?? point.x);
  if (isNaN(lat) || isNaN(lon)) return null;

  const isDefect = Boolean(point.is_defect) || (typeof point.qa_status === 'string' && point.qa_status.toLowerCase().includes('flagged')) || (point.defect_flags && typeof point.defect_flags === 'object' && Object.values(point.defect_flags).some(Boolean));
  const isStaging = point.isStaged || point.isStagingPreview || point.isStagingSubgrid || point.status === 'in process' || point.publishToWebGIS === 'in process' || (point.publishToWebGIS && point.publishToWebGIS !== 'yes');

  const finalColor = color || (isDefect ? '#ef4444' : (isStaging ? '#f59e0b' : (point.color || '#22c55e')));
  const fOp = typeof fillOpacity === 'number' ? fillOpacity : (typeof point.fillOpacity === 'number' ? point.fillOpacity : (typeof opacity === 'number' ? opacity : (typeof point.opacity === 'number' ? point.opacity : (isStaging ? 0.5 : 1))));
  const sOp = typeof opacity === 'number' ? opacity : (typeof point.opacity === 'number' ? point.opacity : (isStaging ? 0.5 : 1));

  return (
    <CircleMarker
      center={[lat, lon]}
      radius={radius}
      pathOptions={{
        fillColor: finalColor,
        fillOpacity: fOp,
        color: '#ffffff',
        opacity: sOp,
        weight: weight,
        className: 'panotrack-point'
      }}
      eventHandlers={{
        click: () => onClick && onClick(point)
      }}
    >
      {showPopup && (
        <Popup className="custom-panotrack-popup">
          <div className={`p-3 rounded-xl border shadow-2xl min-w-[160px] select-none ${isDark
            ? 'bg-slate-900/95 backdrop-blur-md text-slate-100 border-slate-700/80'
            : 'bg-white backdrop-blur-md text-slate-800 border-slate-200'
            }`}>
            <div className={`flex items-center justify-between gap-2 border-b pb-2 mb-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${isDark
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'bg-sky-100 text-sky-700 border border-sky-300'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                {point.subgrid || 'SUBGRID'}
              </span>
              {isDefect && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${isDark
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-amber-100 text-amber-700 border border-amber-300'
                  }`}>
                  DEFECT
                </span>
              )}
            </div>

            <div className="space-y-1 text-[11px]">
              {point.filename && (
                <div className={`flex items-center justify-between font-mono text-[10px] gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Image:</span>
                  <span className={`font-semibold truncate max-w-[100px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={point.filename}>
                    {point.filename.replace(/^.*[\\\/]/, '')}
                  </span>
                </div>
              )}
              <div className={`flex items-center justify-between text-[10px] gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>Date Captured:</span>
                <span className={`font-medium whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {point.captured_at ? new Date(point.captured_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '09/04/2022'}
                </span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </CircleMarker>
  );
});

// --- Sonar Marker Component (2D Leaflet) ---
const SonarMarker = ({ position, yaw }) => {
  const markerRef = useRef(null);

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

// --- BBox Rectangle Selection Layer ---
const BBoxDrawLayer = ({ isActive, onBoundsChange }) => {
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);

  useMapEvents({
    click(e) {
      if (!isActive) return;
      if (!startPoint) {
        setStartPoint(e.latlng);
        setCurrentPoint(e.latlng);
      } else {
        const finalBounds = L.latLngBounds(startPoint, e.latlng);
        onBoundsChange(finalBounds);
        setStartPoint(null);
        setCurrentPoint(null);
      }
    },
    mousemove(e) {
      if (isActive && startPoint) {
        setCurrentPoint(e.latlng);
      }
    }
  });

  useEffect(() => {
    if (!isActive) {
      setStartPoint(null);
      setCurrentPoint(null);
    }
  }, [isActive]);

  if (!isActive) return null;

  const activeBounds = startPoint && currentPoint ? L.latLngBounds(startPoint, currentPoint) : null;

  return (
    <>
      {startPoint && (
        <CircleMarker center={startPoint} radius={6} pathOptions={{ color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.9 }} />
      )}
      {activeBounds && (
        <Rectangle
          bounds={activeBounds}
          pathOptions={{
            color: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.3,
            weight: 2,
            dashArray: '5, 5'
          }}
        />
      )}
    </>
  );
};

// --- WebGL 3D Terrain Viewport (MapLibre Engine) ---
const WebGL3DView = ({ center, zoom, basemap, overrideOpacity, points = [], selectedPoint, viewState, onPointSelect, onMapMoved, pitch3D = 0, boundaryGeojson = null, boundaryDimActive = false, boundaryFocus = false, noSonar = false }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sonarMarkerRef = useRef(null);
  const sonarConeRef = useRef(null);
  const pointsRef = useRef(points);
  const isIntroAnimatingRef = useRef(true);
  const lastDataFitKeyRef = useRef('');
  const applyBoundaryRef = useRef(null);
  pointsRef.current = points;

  // Effective basemap id for adaptive boundary stroke color
  const effectiveBasemapId = basemap?.id || 'ofm-positron';

  const isDarkBasemap = [
    'dark', 'carto_dark', 'ofm-dark', 'ofm-fiord', 'fiord',
    'satellite', 'esri_satellite', 'google-satellite', 'google-hybrid', 'usgs-imagery'
  ].includes(effectiveBasemapId);

  // Robust Coordinate Extractor (Handles lat/lng, latitude/longitude, y/x, arrays)
  const getCoords = useCallback((pt) => {
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = parseFloat(pt[0]);
      const lon = parseFloat(pt[1]);
      return (!isNaN(lat) && !isNaN(lon)) ? { lat, lon } : null;
    }
    const lat = parseFloat(pt.lat ?? pt.latitude ?? pt.y);
    const lon = parseFloat(pt.lon ?? pt.lng ?? pt.longitude ?? pt.x);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  }, []);

  // Compute the [lng,lat] bounding extent of a point list (>= 2 valid points),
  // plus a stable key so we only auto-fit once per data extent change.
  const computeDataExtent = useCallback((ptsList) => {
    const coords = [];
    (ptsList || []).forEach((p) => {
      const c = getCoords(p);
      if (c && !isNaN(c.lat) && !isNaN(c.lon) && !(c.lat === 0 && c.lon === 0)) {
        coords.push([c.lon, c.lat]);
      }
    });
    if (coords.length < 2) return null;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    if (minLng === Infinity) return null;
    return {
      bounds: [[minLng, minLat], [maxLng, maxLat]],
      key: `${coords.length}_${minLng.toFixed(5)}_${minLat.toFixed(5)}_${maxLng.toFixed(5)}_${maxLat.toFixed(5)}`
    };
  }, [getCoords]);

  const getGeoJSON = useCallback((ptsList) => {
    const features = (ptsList || []).map((p, idx) => {
      const coords = getCoords(p);
      if (!coords) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lon, coords.lat] },
        properties: {
          id: p.id || idx,
          rawPoint: JSON.stringify(p),
          color: p.color || '#22c55e'
        }
      };
    }).filter(Boolean);

    return { type: 'FeatureCollection', features };
  }, [getCoords]);

  // Format MapLibre Tile URLs (expands {s} to standard a,b,c subdomains)
  const getFormattedTileUrls = useCallback((url) => {
    if (!url) return ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'];
    if (url.includes('{s}')) {
      return ['a', 'b', 'c'].map(s => url.replace('{s}', s));
    }
    return [url];
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialTileUrls = getFormattedTileUrls(basemap?.url);

    // 1. Initialize matching 2D top-down flat perspective
    const isVectorBasemap = basemap?.isVector || basemap?.url?.includes('styles/');

    const mapStyle = isVectorBasemap ? basemap.url : {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: initialTileUrls,
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'raster-layer',
          type: 'raster',
          source: 'raster-tiles'
        }
      ]
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [center[1], center[0]],
      zoom: zoom,
      pitch: pitch3D ? 55 : 0,
      bearing: pitch3D ? 0 : 0,
      maxPitch: 75,
      fadeDuration: 0,
      crossSourceCollisions: false
    });

    mapRef.current = map;

    map.on('load', () => {
      map.resize();

      const isVector = basemap?.isVector || basemap?.url?.includes('styles/');

      // 1. Add terrain when 3D mode is active (raster and vector basemaps alike).
      if (pitch3D) {
        if (!map.getSource('terrain-dem')) {
          map.addSource('terrain-dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14
          });
        }
        try {
          map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        } catch (err) {
          console.warn('Terrain initialization warning:', err);
        }
      }

      // 2. Only inject custom 3D buildings if they don't already exist in the vector style
      if (!isVector && !map.getLayer('3d-buildings')) {
        if (!map.getSource('openmaptiles')) {
          map.addSource('openmaptiles', {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet'
          });
        }
        map.addLayer({
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.5, ['coalesce', ['get', 'render_height'], ['get', 'height'], 10]
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.5, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
            ],
            'fill-extrusion-color': '#cbd5e1',
            'fill-extrusion-opacity': 0.85
          }
        });
      }

      // 3. GeoJSON Point Layer (Always safe for both 2D and 3D)
      if (!map.getSource('pts-3d')) {
        map.addSource('pts-3d', {
          type: 'geojson',
          data: getGeoJSON(pointsRef.current)
        });
      }

      // 4. Interactive Point Nodes on the Path
      if (!map.getLayer('pts-3d-layer')) {
        map.addLayer({
          id: 'pts-3d-layer',
          type: 'circle',
          source: 'pts-3d',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 5.5, 19, 8],
            'circle-color': ['coalesce', ['get', 'color'], '#22c55e'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-pitch-alignment': 'viewport'
          }
        });
      }

      map.on('click', 'pts-3d-layer', (e) => {
        if (e.features && e.features[0]) {
          try {
            onPointSelect(JSON.parse(e.features[0].properties.rawPoint));
          } catch (err) {
            onPointSelect(e.features[0].properties);
          }
        }
      });

      map.on('mouseenter', 'pts-3d-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'pts-3d-layer', () => { map.getCanvas().style.cursor = ''; });

      update3DSonar();

      // Reset intro animation lock
      isIntroAnimatingRef.current = true;

      // Extract target coordinates from selected point or center
      const selCoords = getCoords(selectedPoint);
      const targetCenter = selCoords ? [selCoords.lon, selCoords.lat] : [center[1], center[0]];

      map.once('idle', () => {
        const is3DMode = Boolean(pitch3D);
        const extent = computeDataExtent(pointsRef.current);

        // Prefer fitting the full data extent so the whole mapped area is
        // visible on load; fall back to focusing the selected point / center.
        if (extent && extent.key !== lastDataFitKeyRef.current) {
          lastDataFitKeyRef.current = extent.key;
          map.fitBounds(
            extent.bounds,
            {
              padding: 80,
              maxZoom: 16,
              duration: 1200,
              easing: (t) => t * (2 - t),
              essential: true
            }
          );
        } else if (!extent) {
          map.easeTo({
            center: targetCenter,
            pitch: is3DMode ? 55 : 0,
            bearing: is3DMode ? -20 : 0,
            zoom: Math.max(zoom, 15),
            duration: 1200,
            easing: (t) => t * (2 - t),
            essential: true
          });
        } else {
          map.setPitch(is3DMode ? 55 : 0);
          map.setBearing(is3DMode ? -20 : 0);
        }

        // Release the lock after animation finishes
        setTimeout(() => {
          isIntroAnimatingRef.current = false;
        }, 1300);
      });
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      if (onMapMoved) onMapMoved([c.lat, c.lng], map.getZoom());
    });

    // Keep the canvas sized correctly when the container resizes (e.g. the
    // 360 viewer split panel in the full app), so the dim/line overlay stays.
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        try { map.resize(); } catch (err) { /* ignore */ }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
    };
  }, []);

  // Update GeoJSON source when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('pts-3d');
    if (source) {
      source.setData(getGeoJSON(points));
    }
  }, [points, getGeoJSON]);

  // Dynamically fit the camera to the full extent of loaded data so the whole
  // dashboard map area is visible whenever the dataset extent changes
  // (initial load, subgrid / run navigation, streaming updates).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const extent = computeDataExtent(points);
    if (!extent) return;
    if (extent.key === lastDataFitKeyRef.current) return;
    // Let the intro animation own the camera on first load; don't fight a
    // deliberate boundary focus either.
    if (isIntroAnimatingRef.current || boundaryFocus) return;

    lastDataFitKeyRef.current = extent.key;

    const doFit = () => {
      try {
        map.fitBounds(extent.bounds, {
          padding: 80,
          maxZoom: 16,
          duration: 1000,
          easing: (t) => t * (2 - t),
          essential: false
        });
      } catch (err) { /* ignore */ }
    };
    if (map.isStyleLoaded()) doFit();
    else map.once('load', doFit);
  }, [points, computeDataExtent, boundaryFocus]);

  // Project Geographic Boundary overlay (adaptive stroke + outside-dim mask)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyBoundary = () => {
      try {
        const lineColor = isDarkBasemap ? '#7dd3fc' : '#334155';
        const hoverColor = isDarkBasemap ? '#38bdf8' : '#1e40af';

        const hasBoundary = Boolean(boundaryGeojson && Array.isArray(boundaryGeojson.features) && boundaryGeojson.features.length > 0);

        // Remove layers first each pass (cheap, idempotent)
        ['project-boundary-dim', 'project-boundary-line-hover', 'project-boundary-line'].forEach((lid) => {
          if (map.getLayer(lid)) map.removeLayer(lid);
        });
        if (map.getSource('project-boundary')) map.removeSource('project-boundary');
        if (map.getSource('project-boundary-dim-src')) map.removeSource('project-boundary-dim-src');

        if (!hasBoundary) return;

        // Add GeoJSON source
        map.addSource('project-boundary', {
          type: 'geojson',
          data: boundaryGeojson
        });

        // Border layer (stroke only, no fill)
        map.addLayer({
          id: 'project-boundary-line',
          type: 'line',
          source: 'project-boundary',
          paint: {
            'line-color': lineColor,
            'line-width': 2.5,
            'line-opacity': 1,
            'line-blur': 0.2
          }
        });

        // Hover effect line (invisible until hover; brightens & thickens border)
        map.addLayer({
          id: 'project-boundary-line-hover',
          type: 'line',
          source: 'project-boundary',
          paint: {
            'line-color': hoverColor,
            'line-width': 6,
            'line-opacity': 0.9,
            'line-blur': 0.5
          },
          layout: { visibility: 'none' }
        });

        map.on('mouseenter', 'project-boundary-line', () => {
          map.setLayoutProperty('project-boundary-line-hover', 'visibility', 'visible');
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'project-boundary-line', () => {
          map.setLayoutProperty('project-boundary-line-hover', 'visibility', 'none');
          map.getCanvas().style.cursor = '';
        });

        // Outside-dim mask: world polygon with the project region (all outer
        // rings, incl. MultiPolygon / multi-feature) as holes (~40% => outside 60%).
        if (boundaryDimActive) {
          const holeRings = [];
          boundaryGeojson.features.forEach((f) => {
            collectOuterRings(f.geometry).forEach((r) => holeRings.push(r));
          });

          if (holeRings.length > 0) {
            const worldRing = [
              [-179.9, -85], [179.9, -85], [179.9, 85], [-179.9, 85], [-179.9, -85]
            ];
            map.addSource('project-boundary-dim-src', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [worldRing, ...holeRings]
                }
              }
            });
            const beforeId = map.getLayer('pts-3d-layer') ? 'pts-3d-layer'
              : (map.getLayer('3d-buildings') ? '3d-buildings' : undefined);
            map.addLayer(
              {
                id: 'project-boundary-dim',
                type: 'fill',
                source: 'project-boundary-dim-src',
                paint: {
                  'fill-color': isDarkBasemap ? '#020617' : '#0f172a',
                  'fill-opacity': 0.4
                }
              },
              beforeId
            );
          }
        }
      } catch (err) {
        // Non-fatal boundary render error
      }
    };

    if (map.isStyleLoaded()) {
      applyBoundary();
    } else {
      map.once('load', applyBoundary);
    }

    // Self-heal: if the boundary line / dim layers are missing after a camera
    // move or resize (e.g. panotrack selection easing), re-apply them. This
    // keeps the outside-dim effect visible even after MapLibre drops layers.
    const ensureBoundary = () => {
      try {
        const hasBoundary = Boolean(boundaryGeojson && Array.isArray(boundaryGeojson.features) && boundaryGeojson.features.length > 0);
        if (!hasBoundary) return;
        const lineMissing = !map.getLayer('project-boundary-line');
        const dimMissing = boundaryDimActive && !map.getLayer('project-boundary-dim');
        if (lineMissing || dimMissing) applyBoundary();
      } catch (err) { /* ignore */ }
    };
    applyBoundaryRef.current = ensureBoundary;
    map.on('moveend', ensureBoundary);
    map.on('idle', ensureBoundary);

    return () => {
      map.off('moveend', ensureBoundary);
      map.off('idle', ensureBoundary);
      try {
        ['project-boundary-dim', 'project-boundary-line-hover', 'project-boundary-line'].forEach((lid) => {
          if (map.getLayer(lid)) map.removeLayer(lid);
        });
        if (map.getSource('project-boundary')) map.removeSource('project-boundary');
        if (map.getSource('project-boundary-dim-src')) map.removeSource('project-boundary-dim-src');
      } catch (err) { /* ignore */ }
    };
  }, [boundaryGeojson, boundaryDimActive, basemap, isDarkBasemap]);

  // Focus: fit bounds to the project boundary region (only on focus/geom change)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundaryFocus) return;

    const doFit = () => {
      try {
        const allRings = [];
        (boundaryGeojson?.features || []).forEach((f) => {
          collectOuterRings(f.geometry).forEach((r) => allRings.push(r));
        });
        const flat = allRings.flat().filter((c) => Array.isArray(c) && c.length >= 2);
        if (flat.length > 0) {
          const lngs = flat.map((c) => c[0]);
          const lats = flat.map((c) => c[1]);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, maxZoom: 10, animate: true }
          );
        }
      } catch (err) { /* ignore */ }
    };

    if (map.isStyleLoaded()) {
      doFit();
    } else {
      map.once('load', doFit);
    }
  }, [boundaryGeojson, boundaryFocus]);

  //Reactive Basemap Tile Update
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateBasemapSource = () => {
      // Vector styles carry their own background layers; there is nothing to
      // swap in-place (a style change remounts WebGL3DView entirely). Only
      // raster-tile basemaps need the source switched below.
      const isVectorStyle = basemap?.isVector || basemap?.url?.includes('styles/');
      const existingRasterSource = map.getSource('raster-tiles');
      if (isVectorStyle && !existingRasterSource) return;

      const newTiles = getFormattedTileUrls(basemap?.url);
      const opacity = typeof overrideOpacity === 'number' ? overrideOpacity : 1.0;

      // If source exists, safely swap tiles or recreate if schema differs
      const source = map.getSource('raster-tiles');
      if (source && typeof source.setTiles === 'function') {
        source.setTiles(newTiles);
      } else {
        // Fallback: Re-mount raster layer cleanly below 3D buildings
        if (map.getLayer('raster-layer')) map.removeLayer('raster-layer');
        if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

        map.addSource('raster-tiles', {
          type: 'raster',
          tiles: newTiles,
          tileSize: 256,
          attribution: basemap?.attribution || ''
        });

        // Insert at the bottom beneath 3D buildings and trajectory lines
        const beforeLayerId = map.getLayer('3d-buildings') ? '3d-buildings' : undefined;
        map.addLayer(
          {
            id: 'raster-layer',
            type: 'raster',
            source: 'raster-tiles',
            paint: {
              'raster-opacity': opacity,
              'raster-resampling': 'linear'
            }
          },
          beforeLayerId
        );
      }

      if (map.getLayer('raster-layer')) {
        map.setPaintProperty('raster-layer', 'raster-opacity', opacity);
      }

      map.triggerRepaint();
    };

    if (map.isStyleLoaded()) {
      updateBasemapSource();
    } else {
      map.once('load', updateBasemapSource);
      map.once('idle', updateBasemapSource);
    }
  }, [basemap, overrideOpacity, getFormattedTileUrls]);

  // Apply / remove 3D perspective+terrain reactively when the 2D/3D mode toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply3D = () => {
      if (pitch3D) {
        if (!map.getSource('terrain-dem')) {
          map.addSource('terrain-dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14
          });
        }
        try {
          map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        } catch (err) {
          console.warn('Terrain apply warning:', err);
        }
        try {
          // Google Maps / Tesla style cinematic fly: pitch up + subtle rotate,
          // smoothstep easing so the camera accelerates in then settles.
          map.easeTo({
            pitch: 62,
            bearing: -15,
            duration: 1800,
            easing: (t) => t * t * (3 - 2 * t),
            essential: true
          });
        } catch (err) {
          map.setPitch(62);
          map.setBearing(-15);
        }
      } else {
        try {
          map.setTerrain(null);
        } catch (err) {
          console.warn('Terrain remove warning:', err);
        }
        try {
          map.easeTo({
            pitch: 0,
            bearing: 0,
            duration: 1800,
            easing: (t) => t * t * (3 - 2 * t),
            essential: true
          });
        } catch (err) {
          map.setPitch(0);
          map.setBearing(0);
        }
      }
      map.triggerRepaint();
    };

    if (map.isStyleLoaded()) {
      apply3D();
    } else {
      map.once('load', apply3D);
    }
  }, [pitch3D, basemap]);

  // Synchronize 3D Sonar directly to Selected Point Coordinates
  const lastCenterCoordRef = useRef('');

  const update3DSonar = useCallback(() => {
    const map = mapRef.current;
    if (noSonar) {
      if (sonarMarkerRef.current) {
        sonarMarkerRef.current.remove();
        sonarMarkerRef.current = null;
      }
      return;
    }
    if (!map || !selectedPoint) {
      if (sonarMarkerRef.current) {
        sonarMarkerRef.current.remove();
        sonarMarkerRef.current = null;
      }
      return;
    }

    const coords = getCoords(selectedPoint);
    if (!coords) return;

    const targetLngLat = [coords.lon, coords.lat];
    const coordKey = `${coords.lat.toFixed(5)}_${coords.lon.toFixed(5)}`;

    if (!sonarMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'panotrack-sonar-container';
      el.style.width = '48px';
      el.style.height = '48px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.willChange = 'transform';
      el.innerHTML = `
        <div class="cone-rotator-wrapper" style="position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none; will-change: transform;">
          <svg viewBox="0 0 100 100" width="48" height="48" style="overflow: visible;">
            <defs>
              <linearGradient id="gradSonar3D" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#00f2ff;stop-opacity:0" />
                <stop offset="100%" style="stop-color:#00f2ff;stop-opacity:0.65" />
              </linearGradient>
            </defs>
            <path d="M 50 50 L 15 10 A 50 50 0 0 1 85 10 Z" fill="url(#gradSonar3D)" stroke="none" />
          </svg>
        </div>
        <div class="panotrack-sonar-core" style="width: 8px; height: 8px; border-radius: 50%; background: #00f2ff; box-shadow: 0 0 6px #00f2ff; z-index: 10;"></div>
      `;

      sonarMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        pitchAlignment: 'map',
        rotationAlignment: 'map'
      })
        .setLngLat(targetLngLat)
        .addTo(map);

      sonarConeRef.current = el.querySelector('.cone-rotator-wrapper');
    } else {
      sonarMarkerRef.current.setLngLat(targetLngLat);
    }

    if (sonarConeRef.current && viewState?.yaw !== undefined) {
      sonarConeRef.current.style.transform = `rotate(${viewState.yaw}deg)`;
    }

    // Only pan camera if the initial dive has finished and point changed.
    // Center on the selected point, but only pitch/bear in 3D mode — in 2D
    // the map must stay flat.
    if (!isIntroAnimatingRef.current && lastCenterCoordRef.current !== coordKey) {
      lastCenterCoordRef.current = coordKey;
      map.easeTo({
        center: targetLngLat,
        pitch: pitch3D ? 60 : 0,
        bearing: pitch3D ? -20 : 0,
        duration: 350,
        essential: false
      });
    }
  }, [selectedPoint, viewState?.yaw, pitch3D, getCoords, noSonar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const runSync = () => {
      map.resize();
      update3DSonar();
      // Re-apply boundary overlay if it got dropped by the resize/selection
      try {
        if (applyBoundaryRef.current) applyBoundaryRef.current();
      } catch (err) { /* ignore */ }
      map.triggerRepaint();
    };

    if (map.isStyleLoaded()) {
      runSync();
    } else {
      map.once('load', runSync);
      map.once('idle', runSync);
    }
  }, [update3DSonar]);

  return <div ref={containerRef} className="w-full h-full" />;
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
  isSingleRun = false,
  runId = null,
  zoomToTrackTrigger,
  resizeTrigger,
  isViewerOpen,
  isDrawingExportBBox,
  onBoundaryDrawn
}) => {
  const { isDark } = useTheme();
  const [mapInstance, setMapInstance] = useState(null);
  const [is3D, setIs3D] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  const [mapCenter, setMapCenter] = useState(INITIAL_CENTER);
  const isDashboard = isEmbed || new URLSearchParams(window.location.search).has('dashboard') || (window.self !== window.top);
  const isDeletionMode = new URLSearchParams(window.location.search).has('deletionMode') || new URLSearchParams(window.location.search).has('previewMode');
  const isNoSonar = new URLSearchParams(window.location.search).has('noSonar') || isDeletionMode;

  const [showPanotrackData, setShowPanotrackData] = useState(true);
  const [statusFilters, setStatusFilters] = useState({ published: true, defect: true, stitching: true });
  const isQaqcWorkbenchMode = new URLSearchParams(window.location.search).has('qaqcWorkbench');
  const [dynamicDefectMap, setDynamicDefectMap] = useState({});
  const [isBboxActive, setIsBboxActive] = useState(false);
  const [spatialBounds, setSpatialBounds] = useState(null);

  const [stagedItemsMap, setStagedItemsMap] = useState({});
  const [stagedOverlayPoints, setStagedOverlayPoints] = useState([]);
  const [isStagingPreviewMap, setIsStagingPreviewMap] = useState(false);
  const [overrideBasemap, setOverrideBasemap] = useState(null);
  const [overrideOpacity, setOverrideOpacity] = useState(1.0);
  const [customTileUrl, setCustomTileUrl] = useState(null);
  const [customLayerColors, setCustomLayerColors] = useState(null);
  const [boundaryGeojson, setBoundaryGeojson] = useState(null);
  const [boundaryFocus, setBoundaryFocus] = useState(false);
  const [boundaryDimActive, setBoundaryDimActive] = useState(false);
  const [mapViewState, setMapViewState] = useState({
    viewMode: 'ALL',
    subgrid: '',
    runId: null,
    date: '',
    points: null
  });
  const [activeRunId, setActiveRunId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('runId') || null;
    }
    return null;
  });
  const [isSingleDailyRun, setIsSingleDailyRun] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('isSingleRun') === 'true' || Boolean(params.get('runId'));
    }
    return false;
  });

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'SET_MAP_VIEW_STATE') {
        const { viewMode, subgrid, runId: msgRunId, date: msgDate, points: directPoints } = e.data;
        console.log('[Map.jsx SET_MAP_VIEW_STATE]', { viewMode, subgrid, runId: msgRunId, pointsCount: directPoints?.length });
        setMapViewState({
          viewMode: viewMode || 'ALL',
          subgrid: subgrid || '',
          runId: msgRunId || null,
          date: msgDate || '',
          points: Array.isArray(directPoints) ? directPoints : null
        });
        if (viewMode === 'SINGLE_RUN' || msgRunId) {
          setIsSingleDailyRun(true);
          setActiveRunId(msgRunId || null);
        } else {
          setIsSingleDailyRun(false);
          setActiveRunId(null);
        }
      } else if (e.data?.type === 'SET_THEME') {
        const theme = e.data.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        try {
          localStorage.setItem('theme', theme);
        } catch (err) { }
      } else if (e.data?.type === 'SET_BASEMAP' || e.data?.type === 'SET_ACTIVE_BASEMAP') {
        const bm = e.data.basemap;
        if (bm) {
          const mapId = bm === 'esri_satellite' ? 'satellite' :
            bm === 'osm_standard' ? 'osm' :
              bm === 'carto_dark' ? 'dark' :
                bm === 'carto_light' ? 'positron' :
                  bm === 'google_hybrid' ? 'google-hybrid' : bm;
          setOverrideBasemap(mapId);
        }
        if (typeof e.data.opacity === 'number') {
          setOverrideOpacity(e.data.opacity);
        }
        if (e.data.customUrl) {
          setCustomTileUrl(e.data.customUrl);
        }
      } else if (e.data?.type === 'SET_MAP_THEME') {
        if (e.data.settings) {
          setCustomLayerColors(e.data.settings);
        }
      } else if (e.data?.type === 'FILTER_STATUS_TYPES') {
        if (e.data.statusFilters) setStatusFilters(e.data.statusFilters);
        if (typeof e.data.showPanotrackData === 'boolean') setShowPanotrackData(e.data.showPanotrackData);
      } else if (e.data?.type === 'FILTER_SUBGRID' || e.data?.type === 'SET_SUBGRID_FILTER') {
        if (e.data.isSingleRun !== undefined) {
          setIsSingleDailyRun(Boolean(e.data.isSingleRun));
        } else if (e.data.runId) {
          setIsSingleDailyRun(true);
        } else if (e.data.isSingleRun === false || (!e.data.subgrid && !e.data.runId)) {
          setIsSingleDailyRun(false);
        }
        if (e.data.runId !== undefined) {
          setActiveRunId(e.data.runId || null);
        }
      } else if (e.data?.type === 'UPDATE_POINT_DEFECT' || e.data?.type === 'MAP_POINT_DEFECT') {
        const fn = (e.data.filename || e.data.pointId || e.data.point_id || '').replace(/^.*[\\\/]/, '').toUpperCase();
        const isDefect = e.data.is_defect !== undefined ? Boolean(e.data.is_defect) : true;
        if (fn) {
          setDynamicDefectMap(prev => ({
            ...prev,
            [fn]: isDefect
          }));
        }
      } else if (e.data?.type === 'QAQC_DEFECTS_RESET') {
        setDynamicDefectMap({});
      } else if (e.data?.type === 'QAQC_DEFECTS_SYNC' || e.data?.type === 'SET_DEFECTS_LIST') {
        if (Array.isArray(e.data.defects)) {
          const newMap = {};
          e.data.defects.forEach(d => {
            const key = (d.filename || d.point_id || d.pointId || '').replace(/^.*[\\\/]/, '').toUpperCase();
            if (key) newMap[key] = true;
          });
          setDynamicDefectMap(newMap);
        }
      } else if (e.data?.type === 'TOGGLE_BBOX_DRAW') {
        setIsBboxActive(Boolean(e.data.isDrawing));
        if (!e.data.isDrawing) setSpatialBounds(null);
      } else if (e.data?.type === 'QUERY_RENDERED_FEATURES') {
        if (!mapInstance) return;
        try {
          const bbox = e.data.bbox;
          // bbox should be [[x1, y1], [x2, y2]] in pixel coordinates
          const features = mapInstance.queryRenderedFeatures(bbox, { layers: ['panotrack-points'] });
          const points = features.map(f => f.properties);
          window.parent.postMessage({ type: 'BBOX_POINTS_SELECTED', points }, '*');
        } catch (err) {
          console.error("queryRenderedFeatures error:", err);
        }
      } else if (e.data?.type === 'QUERY_CLICK_FEATURE') {
        if (!mapInstance) return;
        try {
          const point = e.data.point;
          // point should be [x, y] in pixel coordinates
          const features = mapInstance.queryRenderedFeatures(point, { layers: ['panotrack-points'] });
          if (features && features.length > 0) {
            window.parent.postMessage({ type: 'MAP_POINT_SELECTED', point: features[0].properties }, '*');
          }
        } catch (err) {
          console.error("queryRenderedFeatures error:", err);
        }
      } else if (e.data?.type === 'SET_STAGED_DATA' || e.data?.type === 'STAGED_DATA_PREVIEW') {
        const isPreview = Boolean(e.data.isStagingPreview === true);
        setIsStagingPreviewMap(isPreview);
        const isSingle = e.data.isSingleRun !== undefined ? Boolean(e.data.isSingleRun) : Boolean(e.data.runId);
        setIsSingleDailyRun(isSingle);
        if (e.data.runId !== undefined) {
          setActiveRunId(e.data.runId || null);
        }

        if (e.data.stagedItems && Array.isArray(e.data.stagedItems)) {
          const sMap = {};
          const extraPoints = [];
          const targetRunId = e.data.runId;

          let itemsToProcess = e.data.stagedItems;
          console.log('[SET_STAGED_DATA msg]', {
            isSingle,
            targetRunId,
            itemsCount: itemsToProcess.length,
            items: itemsToProcess.map(it => ({ id: it.id, runId: it.runId, subgrid: it.subgrid, pans: (it.panoramas || it.points || []).length }))
          });
          if (isSingle && targetRunId && itemsToProcess.length > 1) {
            const filtered = itemsToProcess.filter(item => {
              const itemRunId = item.runId || item.id || item.key;
              return Boolean(itemRunId && itemRunId === targetRunId);
            });
            if (filtered.length > 0) itemsToProcess = filtered;
          }

          itemsToProcess.forEach((item, itemIdx) => {
            const sg = (item.subgrid || '').toUpperCase().trim();
            const itemRunId = item.runId || item.id || (isSingle && itemsToProcess.length === 1 ? targetRunId : `batch-${itemIdx}`);
            const isItemPub = Boolean(item.isPublished || item.publishToWebGIS === 'yes' || item.publishToUSVPRO === 'yes' || item.isSyncedWithSupabase || item.status === 'yes');
            if (sg && !sMap[sg]) {
              sMap[sg] = {
                status: isItemPub ? 'yes' : (item.status || 'in process'),
                isPublished: isItemPub,
                opacity: typeof item.opacity === 'number' ? item.opacity : (isItemPub ? 1.0 : 0.5),
                statusColor: item.statusColor || (isItemPub ? '#10b981' : '#f59e0b')
              };
            }
            const pans = item.panoramas || item.points || [];
            if (Array.isArray(pans)) {
              pans.forEach((p, idx) => {
                const fn = (p.filename || p.image_url || '').replace(/^.*[\\\/]/, '').toUpperCase();
                const isPanPub = Boolean(p.isPublished || p.publishToWebGIS === 'yes' || p.publishToUSVPRO === 'yes' || p.isSyncedWithSupabase || p.status === 'yes' || isItemPub);
                const isPanDefect = Boolean(
                  p.isDefect ||
                  p.is_defect ||
                  p.status === 'defect' ||
                  p.qa_status === 'defect' ||
                  p.color === '#ef4444' ||
                  p.color === '#EF4444' ||
                  (p.defect_flags && typeof p.defect_flags === 'object' && Object.values(p.defect_flags).some(Boolean))
                );

                if (fn) {
                  sMap[fn] = {
                    status: p.status === 'selected' ? 'selected' : (isPanDefect ? 'defect' : isPanPub ? 'yes' : 'in process'),
                    isPublished: isPanPub,
                    color: p.color || (isPanDefect ? '#ef4444' : isPanPub ? '#10b981' : '#f59e0b')
                  };
                  if (isPanDefect) {
                    setDynamicDefectMap(prev => ({ ...prev, [fn]: true }));
                  }
                }
                const lat = parseFloat(p.lat ?? p.latitude ?? p.y);
                const lon = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x);
                const pointRunId = p.runId || itemRunId;
                if (!isNaN(lat) && !isNaN(lon)) {
                  extraPoints.push({
                    id: p.id || `staged-${sg}-${idx}-${fn || idx}`,
                    runId: pointRunId,
                    subgrid: sg,
                    filename: p.filename || p.image_url || `${sg}-${idx}`,
                    image_url: p.image_url || p.filename,
                    lat,
                    lon,
                    status: isPanDefect ? 'defect' : (isPanPub ? 'yes' : 'in process'),
                    isStaged: !isPanPub,
                    isPublished: isPanPub,
                    published: isPanPub,
                    isDefect: isPanDefect,
                    is_defect: isPanDefect,
                    opacity: p.opacity ?? (isPanDefect ? 1.0 : (isPanPub ? 1.0 : 0.7)),
                    color: p.color || (isPanDefect ? '#ef4444' : (isPanPub ? '#10b981' : '#f59e0b'))
                  });
                }
              });
            }
          });
          setStagedItemsMap(sMap);
          setStagedOverlayPoints(extraPoints);
        }
      } else if (e.data?.type === 'SET_PROJECT_BOUNDARY') {
        const g = normalizeBoundaryGeojson(e.data.geojson);
        setBoundaryGeojson(g);
        if (!g) {
          setBoundaryFocus(false);
          setBoundaryDimActive(false);
        }
      } else if (e.data?.type === 'FOCUS_BOUNDARY') {
        setBoundaryFocus(true);
        if (Array.isArray(e.data.bbox) && e.data.bbox.length === 4 && mapInstance) {
          try {
            mapInstance.flyToBounds(
              [
                [e.data.bbox[1], e.data.bbox[0]],
                [e.data.bbox[3], e.data.bbox[2]]
              ],
              { padding: [60, 60], maxZoom: 10 }
            );
          } catch (err) { /* ignore */ }
        }
      } else if (e.data?.type === 'CLEAR_BOUNDARY_FOCUS') {
        setBoundaryFocus(false);
        setBoundaryDimActive(false);
      } else if (e.data?.type === 'DIM_OUTSIDE_BOUNDARY') {
        setBoundaryDimActive(Boolean(e.data.enabled));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mapInstance]);

  useEffect(() => {
    const map = mapInstance;
    if (!map || typeof map.getBounds !== 'function') return;
    const postBounds = () => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        const b = map.getBounds();
        if (!b) return;
        window.parent.postMessage({
          type: 'MAP_VIEW_STATE',
          bounds: {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest()
          }
        }, '*');
      } catch (err) { /* ignore */ }
    };
    map.on('load', postBounds);
    map.on('moveend', postBounds);
    map.on('zoomend', postBounds);
    map.on('resize', postBounds);
    postBounds();
    return () => {
      map.off('load', postBounds);
      map.off('moveend', postBounds);
      map.off('zoomend', postBounds);
      map.off('resize', postBounds);
    };
  }, [mapInstance]);

  const basemap = useMemo(() => {
    const targetId = overrideBasemap || activeBasemap || 'ofm-positron';
    return BASEMAPS.find(b => b.id === targetId) || BASEMAPS[0];
  }, [overrideBasemap, activeBasemap]);

  // A basemap picked from the sidebar is explicit user intent and wins over
  // the dashboard-injected override (SET_BASEMAP) until the dashboard sends a
  // new override. Otherwise, in the embedded Dashboard the pinned override
  // would make sidebar selections appear to do nothing.
  const prevActiveBasemap = useRef(activeBasemap);
  useEffect(() => {
    if (prevActiveBasemap.current !== activeBasemap) {
      setOverrideBasemap(null);
    }
    prevActiveBasemap.current = activeBasemap;
  }, [activeBasemap]);

  // OpenFreeMap vector styles (e.g. ofm-positron) are MapLibre style JSONs that
  // cannot be rendered by the Leaflet raster TileLayer. Route them through the
  // MapLibre renderer so the 2D "flat" view still shows the basemap correctly.
  const isVectorBasemap = !!(basemap?.isVector || (basemap?.url || '').includes('styles/'));

  const isPanotrackVisible = activeLayers.includes('panotrack');

  const markerRadius = useMemo(() => {
    if (currentZoom >= 18) return 6;
    if (currentZoom >= 16) return 5;
    if (currentZoom >= 14) return 4;
    if (currentZoom >= 12) return 3;
    return 2;
  }, [currentZoom]);

  const markerWeight = useMemo(() => {
    if (currentZoom >= 16) return 1.5;
    if (currentZoom >= 14) return 1;
    return 0.75;
  }, [currentZoom]);

  const handleManualSelectTool = useCallback((toolId) => {
    if (setActiveTool) {
      setActiveTool(prev => (prev === toolId ? null : toolId));
    }
  }, [setActiveTool]);

  const handleCloseCoordinatePopup = useCallback(() => {
    setSelectedPoint(null);
  }, []);

  useEffect(() => {
    if (activeTool && activeTool !== 'distance' && activeTool !== 'area') {
      if (setActiveTool) setActiveTool(null);
    }
  }, [activeTool, setActiveTool]);

  const effectivePointsList = useMemo(() => {
    // 1. Direct Single-Payload View State (Gold Standard - Zero point bleed)
    if (mapViewState.points && Array.isArray(mapViewState.points) && mapViewState.points.length > 0) {
      console.log('[effectivePointsList:DirectPayload]', {
        viewMode: mapViewState.viewMode,
        pointsCount: mapViewState.points.length,
        subgrid: mapViewState.subgrid,
        runId: mapViewState.runId
      });
      return [...mapViewState.points].sort((a, b) => {
        const fnA = (a.filename || a.image_url || '');
        const fnB = (b.filename || b.image_url || '');
        const mA = fnA.match(/-(\d+)\./);
        const mB = fnB.match(/-(\d+)\./);
        if (mA && mB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
        return (a.id || 0) - (b.id || 0);
      });
    }

    // 2. Legacy fallback
    const isSingle = Boolean(isSingleDailyRun || isSingleRun || runId || activeRunId);

    console.log('[effectivePointsList:Fallback]', {
      isSingle,
      isSingleDailyRun,
      isSingleRun,
      runId,
      activeRunId,
      stagedOverlayCount: stagedOverlayPoints?.length || 0,
      filteredPointsCount: filteredPoints?.length || 0,
      pointsCount: points?.length || 0
    });

    // If viewing an individual daily survey run, strictly display only the points of that specific run
    if (isSingle) {
      if (stagedOverlayPoints && stagedOverlayPoints.length > 0) {
        let pts = stagedOverlayPoints;
        const targetRunId = activeRunId || runId || null;
        if (targetRunId) {
          const runIdCounts = {};
          pts.forEach(p => {
            const r = String(p.runId || 'undefined');
            runIdCounts[r] = (runIdCounts[r] || 0) + 1;
          });
          const matchingPts = pts.filter(p => p.runId === targetRunId);
          console.log('[effectivePointsList] single-run filter breakdown:', {
            targetRunId,
            totalStaged: pts.length,
            matchedCount: matchingPts.length,
            allDistinctRunIds: runIdCounts
          });
          pts = matchingPts;
        }
        return [...pts].sort((a, b) => {
          const fnA = (a.filename || a.image_url || '');
          const fnB = (b.filename || b.image_url || '');
          const mA = fnA.match(/-(\d+)\./);
          const mB = fnB.match(/-(\d+)\./);
          if (mA && mB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
          return (a.id || 0) - (b.id || 0);
        });
      }
      // In strict single-run mode, do NOT fall back to filteredPoints (which contains all subgrid points)
      console.log('[effectivePointsList] single-run but no stagedOverlayPoints, returning empty');
      return [];
    }

    // Masterlist mode: match subgrid strictly without fallback bleed
    const baseList = filterSubgrid ? (filteredPoints || []) : (filteredPoints && filteredPoints.length > 0 ? filteredPoints : (points || []));
    let combined = baseList;
    if (stagedOverlayPoints && stagedOverlayPoints.length > 0) {
      const activeSub = (filterSubgrid || '').toUpperCase().trim();
      const relevantStaged = activeSub
        ? stagedOverlayPoints.filter(sp => {
          const spSub = (sp.subgrid || '').toUpperCase().trim();
          return spSub === activeSub || spSub.includes(activeSub) || activeSub.includes(spSub);
        })
        : stagedOverlayPoints;

      const existingFilenames = new Set(
        baseList
          .map(p => (p.filename || p.image_url || '').replace(/^.*[\\\/]/, '').toUpperCase())
          .filter(Boolean)
      );

      const extra = relevantStaged.filter(sp => {
        const spKey = (sp.filename || sp.image_url || '').replace(/^.*[\\\/]/, '').toUpperCase();
        return spKey ? !existingFilenames.has(spKey) : true;
      });

      combined = [...baseList, ...extra];
    }

    return [...combined].sort((a, b) => {
      const fnA = (a.filename || a.image_url || '');
      const fnB = (b.filename || b.image_url || '');
      const mA = fnA.match(/-(\d+)\./);
      const mB = fnB.match(/-(\d+)\./);
      if (mA && mB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
      return (a.id || 0) - (b.id || 0);
    });
  }, [mapViewState, filteredPoints, points, stagedOverlayPoints, filterSubgrid, isSingleDailyRun, isSingleRun, runId, activeRunId]);

  const compiled3DPoints = useMemo(() => {
    return effectivePointsList.map(p => {
      const fnKey = (p.filename || p.image_url || '').replace(/^.*[\\\/]/, '').toUpperCase();
      const dynamicDefect = dynamicDefectMap[fnKey];
      // In QAQC Workbench mode, only trust dynamicDefectMap (dashboard-controlled); ignore Supabase is_defect
      const isDefect = isQaqcWorkbenchMode
        ? (dynamicDefect !== undefined ? Boolean(dynamicDefect) : false)
        : (dynamicDefect !== undefined ? Boolean(dynamicDefect) : Boolean(p.is_defect));
      return {
        ...p,
        color: isDefect ? '#ef4444' : (p.status === 'in process' ? '#f59e0b' : '#22c55e')
      };
    });
  }, [effectivePointsList, dynamicDefectMap, isQaqcWorkbenchMode]);

  return (
    <div className="relative w-full h-full bg-[#f8fafc]">
      {/* Floating 2D / 3D Mode Switch */}
      {!isDeletionMode && (
        <div className={`absolute top-4 ${isDashboard ? 'right-[108px]' : 'right-4'
          } z-[1000] flex items-center h-10 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-lg backdrop-blur-md transition-all`}>
          <button
            onClick={() => setIs3D(false)}
            className={`flex items-center gap-1.5 px-3 h-full rounded-lg text-xs font-semibold transition-all cursor-pointer ${!is3D
              ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <Layers size={13} />
            <span>2D</span>
          </button>
          <button
            onClick={() => setIs3D(true)}
            className={`flex items-center gap-1.5 px-3 h-full rounded-lg text-xs font-semibold transition-all cursor-pointer ${is3D
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <Box size={13} />
            <span>3D</span>
          </button>
        </div>
      )}

      {isBboxActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-slate-900/90 backdrop-blur-md rounded-xl px-4 py-2 text-xs font-semibold text-sky-400 shadow-lg border border-slate-700/50">
          {spatialBounds ? 'Spatial BBOX Filter Active' : 'Click 1st corner, then click 2nd corner on map to set BBOX'}
        </div>
      )}

      {/* 2D Leaflet View */}
      {!is3D && !isVectorBasemap && (
        <MapContainer
          center={mapCenter}
          zoom={currentZoom}
          className="h-full w-full"
          zoomControl={false}
          preferCanvas={true}
          whenCreated={setMapInstance}
        >
          <TileLayer
            key={`${basemap.id}-${overrideBasemap || ''}-${customTileUrl || ''}-${overrideOpacity ?? 1}`}
            url={customTileUrl && (overrideBasemap === 'custom_tile' || overrideBasemap === 'custom') ? customTileUrl : basemap.url}
            attribution={basemap.attribution}
            subdomains={basemap.subdomains || ['a', 'b', 'c']}
            maxZoom={basemap.maxZoom || 19}
            opacity={typeof overrideOpacity === 'number' ? overrideOpacity : 1.0}
          />

          <MapController
            filteredPoints={effectivePointsList}
            stagedOverlayPoints={stagedOverlayPoints}
            isStagingPreviewMap={isStagingPreviewMap}
            selectedPoint={selectedPoint}
            activeBasemap={activeBasemap}
            boundaryGeojson={boundaryGeojson}
            boundaryDimActive={boundaryDimActive}
            boundaryFocus={boundaryFocus}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            zoomToTrackTrigger={zoomToTrackTrigger}
            resizeTrigger={resizeTrigger}
            isViewerOpen={isViewerOpen}
            viewState={viewState}
            isEmbed={isEmbed}
            setMapInstance={setMapInstance}
            setCurrentZoom={setCurrentZoom}
            onMapMoved={(c, z) => {
              setMapCenter([c.lat, c.lng]);
              setCurrentZoom(z);
            }}
          />

          <BBoxDrawLayer isActive={isBboxActive} onBoundsChange={setSpatialBounds} />

          {isPanotrackVisible && showPanotrackData && effectivePointsList.map((p) => {
            const lat = parseFloat(p.lat ?? p.latitude ?? p.y);
            const lon = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x);

            if (spatialBounds && !isNaN(lat) && !isNaN(lon)) {
              if (!spatialBounds.contains([lat, lon])) {
                return null;
              }
            }

            const fnKey = (p.filename || p.image_url || '').replace(/^.*[\\\/]/, '').toUpperCase();
            const dynamicDefect = dynamicDefectMap[fnKey];
            const rawSub = p.subgrid || (p.filename ? p.filename.split('-')[0] : '');
            const normSub = rawSub.toUpperCase().trim();
            const stagedInfo = stagedItemsMap[fnKey] || stagedItemsMap[normSub];

            const isDefect = isQaqcWorkbenchMode
              ? (dynamicDefect !== undefined ? Boolean(dynamicDefect) : false)
              : (
                dynamicDefect !== undefined
                  ? Boolean(dynamicDefect)
                  : Boolean(p.is_defect) || Boolean(p.isDefect) || (Number(p.defect_count) > 0) || (Number(p.defects) > 0) || (typeof p.qa_status === 'string' && (p.qa_status.toLowerCase().includes('flag') || p.qa_status.toLowerCase().includes('defect'))) || (p.defect_flags && typeof p.defect_flags === 'object' && Object.values(p.defect_flags).some(Boolean))
              );

            // Determine if the point is published based on specific stagedInfo or direct properties
            const isPointPub = stagedItemsMap[fnKey]
              ? Boolean(stagedItemsMap[fnKey].isPublished)
              : Boolean(p.isPublished || p.published || p.publishToWebGIS === 'yes' || p.status === 'yes' || (!p.isStagingPreview && !p.isStaged && p.status !== 'in process' && p.status !== 'stitching' && p.publishToWebGIS !== 'in process'));

            const isStagedPoint = !isPointPub && Boolean(
              p.isStagingPreview ||
              p.isStaged ||
              p.status === 'in process' ||
              p.status === 'stitching' ||
              p.publishToWebGIS === 'in process' ||
              p.publishToWebGIS === 'need to recheck' ||
              p.publishToWebGIS === 'no' ||
              (stagedItemsMap[fnKey] && !stagedItemsMap[fnKey].isPublished)
            );

            const isStitching = !isDefect && isStagedPoint;
            const isPublished = !isDefect && isPointPub;

            if (isDefect && !statusFilters.defect) return null;
            if (isPublished && !statusFilters.published) return null;
            if (isStitching && !statusFilters.stitching) return null;

            const color = isDefect
              ? (customLayerColors?.defectTrackColor || '#ef4444')
              : isStitching
                ? (customLayerColors?.stagingTrackColor || '#f59e0b')
                : (customLayerColors?.publishedTrackColor || '#10b981');

            const layerOpacityMultiplier = typeof customLayerColors?.opacity === 'number'
              ? customLayerColors.opacity
              : (typeof customLayerColors?.layerOpacity === 'number' ? customLayerColors.layerOpacity : 1.0);

            const baseOpacity = isDefect ? 1.0 : (isStitching ? 0.7 : 1.0);
            const pointOpacity = baseOpacity * layerOpacityMultiplier;

            return (
              <PointMarker
                key={p.id || `pt-${lat}-${lon}`}
                point={p}
                radius={markerRadius}
                weight={customLayerColors?.lineWidth ? Math.max(1, customLayerColors.lineWidth * 0.5) : markerWeight}
                color={color}
                opacity={pointOpacity}
                fillOpacity={pointOpacity}
                showPopup={isEmbed}
                onClick={onPointSelect}
              />
            );
          })}

          {(() => {
            if (isNoSonar) return null;
            const coords = extractCoordinates(selectedPoint);
            if (!coords) return null;
            return (
              <SonarMarker
                position={[coords.lat, coords.lon]}
                yaw={viewState?.yaw || 0}
              />
            );
          })()}
        </MapContainer>
      )}

      {/* 3D MapLibre View */}
      {(is3D || isVectorBasemap) && (
        <WebGL3DView
          // Remount a fresh MapLibre map whenever the selected basemap layer
          // changes (vector style URLs can't be swapped in-place; only raster
          // tiles can via the reactive raster update effect). Also remount on
          // 2D/3D toggle so the map always initializes with the correct pitch
          // and terrain, guaranteeing a clean return to the flat 2D view.
          key={`${basemap.id}-${overrideBasemap || ''}-${customTileUrl || ''}-${overrideOpacity ?? 1}-${is3D ? '3d' : '2d'}`}
          center={mapCenter}
          zoom={currentZoom}
          basemap={basemap}
          overrideOpacity={overrideOpacity}
          pitch3D={is3D ? 1 : 0}
          points={compiled3DPoints}
          selectedPoint={selectedPoint}
          boundaryGeojson={boundaryGeojson}
          boundaryDimActive={boundaryDimActive}
          boundaryFocus={boundaryFocus}
          noSonar={isNoSonar}
          viewState={viewState}
          onPointSelect={onPointSelect}
          onMapMoved={(c, z) => {
            setMapCenter(c);
            setCurrentZoom(z);
          }}
        />
      )}

      {activeTool && !['download', 'clear'].includes(activeTool) && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[3000] bg-white/95 backdrop-blur-md border border-gray-200/90 text-gray-800 text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="font-semibold text-gray-700">
            {activeTool === 'measure' && <><span className="text-blue-600 font-bold">📐 Distance Tool:</span> Click map to add points.</>}
            {activeTool === 'coordinate' && <><span className="text-blue-600 font-bold">🎯 Coords Converter:</span> Click map to view details.</>}
          </span>
          <button onClick={() => setActiveTool(null)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg"><X size={14} /></button>
        </div>
      )}

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