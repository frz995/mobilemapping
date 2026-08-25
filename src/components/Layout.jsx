import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import MapComponent from './Map';
import Viewer from './Viewer';
import AttributeTable from './AttributeTable';
import UploadModal from './UploadModal';
import ExportModal from './ExportModal';
import LayerSelectModal from './LayerSelectModal';
import MyAccountModal from './MyAccountModal';
import useCsvPoints from '../hooks/useCsvPoints';
import useWfsPoints from '../hooks/useWfsPoints';
import useAuth from '../hooks/useAuth';
import { useSupabasePoints } from '../hooks/useSupabasePoints';
import { useSessionStats } from '../hooks/useSessionStats';
import { Maximize2, Play, Pause, SkipForward, SkipBack, Camera, LogOut, FileText } from 'lucide-react';
import { generatePdfInspectionReport } from '../services/pdfReportService';
import * as turf from '@turf/turf';

const EMPTY_HOTSPOTS = [];

const parsePointCoords = (p) => {
  if (!p) return null;
  const lat = parseFloat(p.lat ?? p.latitude ?? p.y ?? p.northing);
  const lon = parseFloat(p.lon ?? p.longitude ?? p.lng ?? p.x ?? p.easting);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
};

const Layout = ({ isEmbed = false }) => {
  const { user, signOut } = useAuth();
  const {
    stats: usageStats,
    recordSessionStart,
    trackPointVisit,
    trackNavStep,
    trackMapClick,
    trackSnapshot,
    trackPdfReport,
    trackBasemapChange,
    trackToolUsed,
    trackPlayback,
    trackExport,
    resetStats,
  } = useSessionStats();

  // Record session start once on mount
  useEffect(() => { recordSessionStart(); }, []);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [viewState, setViewState] = useState({ yaw: 0, pitch: 0, hfov: 100 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null); // 'measure', 'extract', 'identify', 'polygon-measure', 'buffer', 'coordinate'
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isLayerSelectOpen, setIsLayerSelectOpen] = useState(false);
  const [selectedTableLayer, setSelectedTableLayer] = useState(null);
  const [isDrawingExportBBox, setIsDrawingExportBBox] = useState(false);
  const [customBBoxPoints, setCustomBBoxPoints] = useState(null);
  const [splitRatio, setSplitRatio] = useState(50); // 50% split
  const [activeLayers, setActiveLayers] = useState(['panotrack']);
  const [activeBasemap, setActiveBasemap] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const urlBm = p.get('basemap');
      if (urlBm) {
        return urlBm === 'esri_satellite' ? 'satellite' :
          urlBm === 'osm_standard' ? 'osm' :
            urlBm === 'carto_dark' ? 'dark' :
              urlBm === 'carto_light' ? 'positron' :
                urlBm === 'google_hybrid' ? 'google-hybrid' : urlBm;
      }
    }
    return 'positron';
  });
  const [isViewerOpen, setIsViewerOpen] = useState(!isEmbed);
  const [isUserToastExpanded, setIsUserToastExpanded] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const viewerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Filter State ---
  const [filterSubgrid, setFilterSubgrid] = useState('');
  const [filterDate, setFilterDate] = useState(''); // ISO Date string YYYY-MM-DD
  const [filterColorByDate, setFilterColorByDate] = useState(false);
  const [filterDateStrict, setFilterDateStrict] = useState(false);
  const [isSingleRun, setIsSingleRun] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('isSingleRun') === 'true' || Boolean(params.get('runId'));
    }
    return false;
  });
  const [runId, setRunId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('runId') || null;
    }
    return null;
  });
  const [zoomToTrackTrigger, setZoomToTrackTrigger] = useState(0);

  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per frame

  // Initialize filterSubgrid from URL query parameter (e.g. ?subgrid=N94E70) AND listen for postMessage from parent Dashboard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSubgrid = params.get('subgrid');
      if (urlSubgrid) {
        setFilterSubgrid(urlSubgrid);
      }
    }

    const handleMessage = (event) => {
      if (!event.data) return;

      if (event.data.type === 'SET_SUBGRID_FILTER' || event.data.type === 'FILTER_SUBGRID') {
        const sub = event.data.subgrid !== undefined ? event.data.subgrid : event.data.filter || '';
        const dt = event.data.date || '';
        const isSingle = event.data.isSingleRun !== undefined ? Boolean(event.data.isSingleRun) : Boolean(event.data.runId);
        const rId = event.data.runId || null;
        console.log('Layout received SUBGRID_FILTER message from parent:', sub, dt, isSingle, rId);
        setFilterSubgrid(sub || '');
        setFilterDate(dt || '');
        setIsSingleRun(isSingle);
        setRunId(rId);
      } else if (event.data.type === 'CAMERA_ROTATED') {
        setViewState(prev => ({
          ...prev,
          yaw: typeof event.data.yaw === 'number' ? event.data.yaw : prev.yaw,
          pitch: typeof event.data.pitch === 'number' ? event.data.pitch : prev.pitch
        }));
      } else if (event.data.type === 'MAP_POINT_SELECTED') {
        const pt = event.data.point || event.data.payload || event.data;
        if (pt) {
          setSelectedPoint(prev => ({
            ...prev,
            ...pt,
            lat: typeof pt.lat === 'number' ? pt.lat : (parseFloat(pt.lat) || (prev ? prev.lat : 2.54866)),
            lon: typeof pt.lon === 'number' ? pt.lon : (typeof pt.lng === 'number' ? pt.lng : (parseFloat(pt.lon || pt.lng) || (prev ? prev.lon : 102.815835)))
          }));
          if (typeof pt.bearing === 'number') {
            setViewState(prev => ({ ...prev, yaw: pt.bearing }));
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleZoomToTrack = React.useCallback(() => {
    setZoomToTrackTrigger(prev => prev + 1);
  }, []);

  const qgisWmsUrl = import.meta.env.VITE_QGIS_WMS_URL || undefined;

  // Fetch data directly from Supabase
  const { points, loading: pointsLoading, error: pointsError } = useSupabasePoints();

  // Show error toast/notification if data fetching fails
  useEffect(() => {
    if (pointsError) {
      console.error("Data fetching error:", pointsError);
      // You could also set a state to show a UI alert here
    }
  }, [pointsError]);

  // --- Filter Logic (Lifted from Map.jsx) ---
  // Filter points based on active subgrid or date range
  // --- Filter Logic (Lifted from Map.jsx) ---
  // Filter points based on active subgrid or date range
  const filteredPoints = useMemo(() => {
    if (!points || points.length === 0) return [];

    const activeSubgrid = filterSubgrid || '';
    const activeDate = filterDate || '';

    // 1. Subgrid Filter
    let subgridMatched = points;
    if (activeSubgrid && activeSubgrid.trim() !== '') {
      const searchTerms = activeSubgrid.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      // Strict matching for subgrid terms
      if (searchTerms.length > 0) {
        subgridMatched = points.filter(point => {
          const pointSubgrid = (
            point.subgrid ||
            (point.filename ? point.filename.match(/N\d{2,3}E\d{2,3}/i)?.[0] : '') ||
            (point.image_url ? point.image_url.match(/N\d{2,3}E\d{2,3}/i)?.[0] : '') ||
            (point.description ? point.description.match(/N\d{2,3}E\d{2,3}/i)?.[0] : '') ||
            ''
          ).toLowerCase();
          return searchTerms.some(term => pointSubgrid === term || pointSubgrid.includes(term));
        });
      }
    }

    // 2. Date Filter
    if (activeDate && activeDate.trim() !== '' && subgridMatched.length > 0) {
      const dateQuery = activeDate.trim().toLowerCase();
      const qYear = dateQuery.match(/\b\d{4}\b/)?.[0] || '';
      const qDayMatch = dateQuery.match(/\b(0?[1-9]|[12]\d|3[01])\b/)?.[0] || '';
      const qDay = qDayMatch ? parseInt(qDayMatch, 10) : null;
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const qMonthIdx = months.findIndex(m => dateQuery.includes(m));

      subgridMatched = subgridMatched.filter(point => {
        const rawDate = String(point.captured_at || point.date || point.created_at || '');
        if (!rawDate) return false;

        // 1. Direct string match
        if (rawDate.toLowerCase().includes(dateQuery)) return true;

        // 2. UTC Date matching (e.g. "2022-04-06T16:00:00")
        const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          const [, yr, mo, dy] = isoMatch;
          const yrNum = parseInt(yr, 10);
          const moNum = parseInt(mo, 10) - 1; // 0-indexed
          const dyNum = parseInt(dy, 10);

          if (qYear && yrNum !== parseInt(qYear, 10)) return false;
          if (qMonthIdx !== -1 && moNum !== qMonthIdx) return false;
          if (qDay !== null && Math.abs(dyNum - qDay) > 1 && dyNum !== qDay) return false;
          return true;
        }

        // 3. Date object fallback
        const pDate = new Date(rawDate);
        if (!isNaN(pDate.getTime())) {
          const utcYr = pDate.getUTCFullYear();
          const utcMo = pDate.getUTCMonth();
          const utcDy = pDate.getUTCDate();
          const locDy = pDate.getDate();

          if (qYear && utcYr !== parseInt(qYear, 10)) return false;
          if (qMonthIdx !== -1 && utcMo !== qMonthIdx && pDate.getMonth() !== qMonthIdx) return false;
          if (qDay !== null && (utcDy === qDay || locDy === qDay || Math.abs(utcDy - qDay) <= 1)) return true;
        }

        return false;
      });
    }

    // Strictly sort points by numerical frame sequence number (e.g. N93E70-0001 -> 0002 -> 0003)
    subgridMatched.sort((a, b) => {
      const getSeqNum = (item) => {
        const fn = item.filename || item.image_url || '';
        const m = String(fn).match(/-(\d+)\./);
        return m ? parseInt(m[1], 10) : (item.id || 0);
      };
      const numA = getSeqNum(a);
      const numB = getSeqNum(b);
      if (numA !== numB) return numA - numB;
      return (a.filename || '').localeCompare(b.filename || '');
    });

    console.log(`Layout: Filtered points count: ${subgridMatched.length}/${points.length} (Active Subgrid: "${activeSubgrid}", Date: "${activeDate}")`);
    return subgridMatched;
  }, [points, filterSubgrid, filterDate, filterDateStrict]);

  const handleSnapshot = React.useCallback(async () => {
    if (!viewerRef.current || !selectedPoint) return;
    trackSnapshot();
    const dataUrl = await viewerRef.current.captureSnapshot({
      id: selectedPoint.id,
      date: selectedPoint.captured_at,
      lat: selectedPoint.lat,
      lon: selectedPoint.lon
    });
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `snapshot_${selectedPoint.id}_${new Date().toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [selectedPoint, trackSnapshot]);

  const handlePdfReport = React.useCallback(async () => {
    if (!selectedPoint) return;
    trackPdfReport();
    let snapshotUrl = null;
    if (viewerRef.current) {
      snapshotUrl = await viewerRef.current.captureSnapshot({
        id: selectedPoint.id,
        date: selectedPoint.captured_at,
        lat: selectedPoint.lat,
        lon: selectedPoint.lon
      });
    }
    await generatePdfInspectionReport({
      point: selectedPoint,
      snapshotDataUrl: snapshotUrl
    });
  }, [selectedPoint, trackPdfReport]);

  // Extract unique subgrids for filter dropdown
  const uniqueSubgrids = React.useMemo(() => {
    if (!points) return [];
    const grids = new Set();
    points.forEach(p => {
      if (p.subgrid) {
        // Handle potential comma-separated subgrids in source data if any, though usually 1 point = 1 subgrid
        grids.add(p.subgrid.trim());
      }
    });
    return Array.from(grids).sort();
  }, [points]);

  // Calculate navigation hotspots (arrows on the road) based on spatial direction & sonar orientation
  const navTargets = useMemo(() => {
    if (!selectedPoint || !filteredPoints || !filteredPoints.length) return [];

    const cur = parsePointCoords(selectedPoint);
    if (!cur) return [];

    const currentGeo = turf.point([cur.lon, cur.lat]);
    const vehicleHeading = parseFloat(selectedPoint.bearing ?? selectedPoint.heading ?? 0);

    const getRelativeYaw = (absBearing, heading) => {
      let rel = absBearing - heading;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      return rel;
    };

    let forwardTarget = null;
    let backwardTarget = null;
    let minFwdDist = Infinity;
    let minBwdDist = Infinity;

    filteredPoints.forEach(p => {
      if (p.id === selectedPoint.id) return;
      const targetCoords = parsePointCoords(p);
      if (!targetCoords) return;

      const targetGeo = turf.point([targetCoords.lon, targetCoords.lat]);
      const dist = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;

      // Restrict spatial search strictly to immediate local road neighbors within 35 meters
      if (dist > 0.2 && dist <= 35) {
        const absBearing = turf.bearing(currentGeo, targetGeo);
        const relYaw = getRelativeYaw(absBearing, vehicleHeading);

        // Forward cone sector (-90deg to +90deg relative to vehicle direction)
        if (Math.abs(relYaw) <= 90) {
          if (dist < minFwdDist) {
            minFwdDist = dist;
            forwardTarget = { ...p, yaw: relYaw, pitch: -25, distance: dist };
          }
        } else { // Backward cone sector
          if (dist < minBwdDist) {
            minBwdDist = dist;
            backwardTarget = { ...p, yaw: relYaw, pitch: -25, distance: dist };
          }
        }
      }
    });

    // Fallback to sequential index if no spatial neighbor is found within 35m
    const curIdx = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (!forwardTarget && curIdx !== -1 && curIdx + 1 < filteredPoints.length) {
      const p = filteredPoints[curIdx + 1];
      const targetCoords = parsePointCoords(p);
      if (targetCoords) {
        const targetGeo = turf.point([targetCoords.lon, targetCoords.lat]);
        const dist = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;
        const absBearing = turf.bearing(currentGeo, targetGeo);
        const relYaw = getRelativeYaw(absBearing, vehicleHeading);
        forwardTarget = { ...p, yaw: relYaw, pitch: -25, distance: dist };
      }
    }

    if (!backwardTarget && curIdx > 0) {
      const p = filteredPoints[curIdx - 1];
      const targetCoords = parsePointCoords(p);
      if (targetCoords) {
        const targetGeo = turf.point([targetCoords.lon, targetCoords.lat]);
        const dist = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;
        const absBearing = turf.bearing(currentGeo, targetGeo);
        const relYaw = getRelativeYaw(absBearing, vehicleHeading);
        backwardTarget = { ...p, yaw: relYaw, pitch: -25, distance: dist };
      }
    }

    return [forwardTarget, backwardTarget].filter(Boolean);
  }, [selectedPoint, filteredPoints]);

  const handlePointSelect = React.useCallback((point) => {
    if (!point) return;
    const fn = (point.filename || '').replace(/^\/+/, '').replace(/^MMS_PIC\//i, '');
    const resolvedUrl = (point.image_url && typeof point.image_url === 'string' && point.image_url.trim().length > 0)
      ? (point.image_url.startsWith('http') || point.image_url.startsWith('/') ? point.image_url : `/MMS_PIC/${point.image_url.replace(/^\/+/, '').replace(/^MMS_PIC\//i, '')}`)
      : (fn ? `/MMS_PIC/${fn}` : '');

    const selectedPt = {
      ...point,
      image_url: resolvedUrl,
      subgrid: point.subgrid || 'KL_Drive_04',
      lat: parseFloat(point.lat ?? point.latitude ?? 2.54866),
      lng: parseFloat(point.lon ?? point.longitude ?? point.lng ?? 102.815835)
    };

    setSelectedPoint(selectedPt);
    setViewState(prev => ({ ...prev, yaw: point?.bearing || point?.heading || 0 }));
    trackPointVisit(point?.subgrid);

    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'MAP_POINT_SELECTED',
        point: selectedPt
      }, '*');
    }
  }, [trackPointVisit]);

  // Calculate clean frame index relative to active dataset (unfiltered unless sidebar filter is selected)
  const currentFrameIndex = React.useMemo(() => {
    if (!selectedPoint || !filteredPoints || filteredPoints.length === 0) return 0;
    const idx = filteredPoints.findIndex(p =>
      (p.id !== undefined && p.id === selectedPoint.id) ||
      (p.filename && selectedPoint.filename && p.filename === selectedPoint.filename) ||
      (p.image_url && selectedPoint.image_url && p.image_url === selectedPoint.image_url)
    );
    return idx >= 0 ? idx : 0;
  }, [selectedPoint, filteredPoints]);

  const getConeDirectionalTarget = React.useCallback((isForward = true) => {
    if (!selectedPoint || !filteredPoints || filteredPoints.length === 0) return null;

    const cur = parsePointCoords(selectedPoint);
    if (!cur) return null;

    const currentGeo = turf.point([cur.lon, cur.lat]);
    const vehicleBearing = parseFloat(selectedPoint.bearing ?? selectedPoint.heading ?? 0);
    const cameraYaw = parseFloat(viewState?.yaw ?? 0);

    let coneDirection = (vehicleBearing + cameraYaw + (isForward ? 0 : 180) + 360) % 360;

    let bestPoint = null;
    let minDistance = Infinity;

    filteredPoints.forEach(p => {
      if (p.id === selectedPoint.id || (p.filename && p.filename === selectedPoint.filename)) return;
      const targetCoords = parsePointCoords(p);
      if (!targetCoords) return;

      const targetGeo = turf.point([targetCoords.lon, targetCoords.lat]);
      const distMeters = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;

      if (distMeters >= 0.5 && distMeters <= 35) {
        const absBearing = (turf.bearing(currentGeo, targetGeo) + 360) % 360;
        let angleDiff = Math.abs(absBearing - coneDirection);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        if (angleDiff <= 75) {
          if (distMeters < minDistance) {
            minDistance = distMeters;
            bestPoint = p;
          }
        }
      }
    });

    if (!bestPoint) {
      filteredPoints.forEach(p => {
        if (p.id === selectedPoint.id || (p.filename && p.filename === selectedPoint.filename)) return;
        const targetCoords = parsePointCoords(p);
        if (!targetCoords) return;

        const targetGeo = turf.point([targetCoords.lon, targetCoords.lat]);
        const distMeters = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;

        if (distMeters >= 0.5 && distMeters <= 35) {
          if (distMeters < minDistance) {
            minDistance = distMeters;
            bestPoint = p;
          }
        }
      });
    }

    if (!bestPoint) {
      const curIdx = filteredPoints.findIndex(p =>
        (p.id !== undefined && p.id === selectedPoint.id) ||
        (p.filename && selectedPoint.filename && p.filename === selectedPoint.filename)
      );
      if (curIdx !== -1) {
        const nextIdx = isForward ? (curIdx + 1 < filteredPoints.length ? curIdx + 1 : 0) : (curIdx > 0 ? curIdx - 1 : filteredPoints.length - 1);
        bestPoint = filteredPoints[nextIdx];
      }
    }

    return bestPoint;
  }, [selectedPoint, filteredPoints, viewState?.yaw]);

  const handlePrevFrame = React.useCallback(() => {
    if (!filteredPoints || filteredPoints.length === 0) return;
    if (currentFrameIndex > 0) {
      handlePointSelect(filteredPoints[currentFrameIndex - 1]);
    }
  }, [currentFrameIndex, filteredPoints, handlePointSelect]);

  const handleNextFrame = React.useCallback(() => {
    if (!filteredPoints || filteredPoints.length === 0) return;
    if (currentFrameIndex < filteredPoints.length - 1) {
      handlePointSelect(filteredPoints[currentFrameIndex + 1]);
    } else {
      setIsPlaying(false); // Stop autoplay when reaching the final frame
    }
  }, [currentFrameIndex, filteredPoints, handlePointSelect]);

  // --- Auto-Play Logic ---
  useEffect(() => {
    let intervalId;
    if (isPlaying && filteredPoints.length > 0) {
      intervalId = setInterval(() => {
        handleNextFrame();
      }, playbackSpeed);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, filteredPoints, playbackSpeed, handleNextFrame]);

  const handleViewChange = React.useCallback((newView) => {
    setViewState((prev) => ({ ...prev, ...newView }));
  }, []);

  // Stable callback for map point selection — also counts as a map click
  const handleMapPointSelect = React.useCallback((point) => {
    handlePointSelect(point);
    if (!isEmbed) {
      setIsViewerOpen(true);
    }
    trackMapClick();
  }, [handlePointSelect, isEmbed, trackMapClick]);

  // Navigate via hotspot arrow — counts as nav step
  const handleNavigate = React.useCallback((point) => {
    handlePointSelect(point);
    trackNavStep();
  }, [handlePointSelect, trackNavStep]);

  // Calculate path visualization hotspots (flat crosses on the road)
  // DISABLED: User requested to remove track path visualization
  const pathHotspots = React.useMemo(() => [], []);

  // Simple drag implementation for split screen
  const handleDrag = (e) => {
    // Calculate percentage based on window width
    // Adjust for sidebar width if needed, but absolute mouse position is easier
    const newSplit = (e.clientX / window.innerWidth) * 100;

    // Constraints (min 20%, max 80%)
    if (newSplit > 20 && newSplit < 80) {
      setSplitRatio(newSplit);
    }
  };

  const startDrag = () => {
    const onMouseMove = (e) => handleDrag(e);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  // Preload next/prev images and tile configs for smoother Street View style jumps
  useEffect(() => {
    if (!selectedPoint || !filteredPoints.length || currentFrameIndex === -1) return;

    const pointsToPreload = [];
    // Preload next 2 points and previous 1 point
    if (currentFrameIndex + 1 < filteredPoints.length) pointsToPreload.push(filteredPoints[currentFrameIndex + 1]);
    if (currentFrameIndex + 2 < filteredPoints.length) pointsToPreload.push(filteredPoints[currentFrameIndex + 2]);
    if (currentFrameIndex - 1 >= 0) pointsToPreload.push(filteredPoints[currentFrameIndex - 1]);

    pointsToPreload.forEach(point => {
      // 1. Preload config JSON if tile configUrl is present
      if (point.config_url) {
        fetch(point.config_url)
          .then(res => res.ok ? res.json() : null)
          .then(config => {
            if (config && config.multiRes && config.multiRes.fallbackPath) {
              const basePath = point.config_url.substring(0, point.config_url.lastIndexOf('/') + 1);
              const fallbackFile = config.multiRes.fallbackPath.replace('%s', 'f');
              const fallbackUrl = `${basePath}${fallbackFile}`;
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = fallbackUrl;
            }
          })
          .catch(() => { });
      }

      // 2. Preload direct image_url
      if (point.image_url) {
        let url = point.image_url;
        if (!url.startsWith('http')) {
          const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL || '/';
          const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
          if (!url.startsWith(cleanBase)) {
            url = `${cleanBase}${url.startsWith('/') ? url.substring(1) : url}`;
          }
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
      }
    });
  }, [selectedPoint, filteredPoints]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 relative font-sans">

      {/* Sidebar - Fixed overlay */}
      <Sidebar
        isEmbed={isEmbed}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        qgisWmsUrl={qgisWmsUrl}
        activeLayers={activeLayers}
        setActiveLayers={setActiveLayers}
        activeBasemap={activeBasemap}
        setActiveBasemap={(id) => { setActiveBasemap(id); trackBasemapChange(); }}
        activeTool={activeTool}
        setActiveTool={(tool) => { setActiveTool(tool); if (tool) trackToolUsed(); }}
        filterSubgrid={filterSubgrid}
        setFilterSubgrid={setFilterSubgrid}
        availableSubgrids={uniqueSubgrids}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterColorByDate={filterColorByDate}
        setFilterColorByDate={setFilterColorByDate}
        filterDateStrict={filterDateStrict}
        setFilterDateStrict={setFilterDateStrict}
        onZoomToTrack={handleZoomToTrack}
        isTableOpen={isTableOpen}
        setIsTableOpen={setIsTableOpen}
        onOpenLayerSelect={() => setIsLayerSelectOpen(true)}
        isViewerOpen={isViewerOpen}
        setIsViewerOpen={setIsViewerOpen}
        onOpenAccount={() => setIsAccountOpen(true)}
        user={user}
        signOut={signOut}
      />

      {/* Layer Selection Popup Modal before opening Attribute Table */}
      <LayerSelectModal
        isOpen={isLayerSelectOpen}
        onClose={() => setIsLayerSelectOpen(false)}
        activeLayers={activeLayers}
        onSelectLayer={(layer) => {
          setSelectedTableLayer(layer);
          setIsTableOpen(true);
        }}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col md:flex-row h-full relative transition-all duration-300"
      >

        {/* Left / Top Panel: Map */}
        <div
          className="relative overflow-hidden flex flex-col transition-all duration-300"
          style={
            isMobile
              ? { width: '100%', height: isViewerOpen ? '50%' : '100%' }
              : { width: isViewerOpen ? `${splitRatio}%` : '100%', height: '100%' }
          }
        >
          {pointsError && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Failed to load map data. Please check your connection.</span>
            </div>
          )}
          <div className="flex-1 relative min-h-0">
            <MapComponent
              isEmbed={isEmbed}
              points={activeLayers.includes('panotrack') ? points : []}
              filteredPoints={filteredPoints}
              selectedPoint={selectedPoint}
              onPointSelect={handleMapPointSelect}
              viewState={viewState}
              activeLayers={activeLayers}
              activeBasemap={activeBasemap}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              qgisWmsUrl={qgisWmsUrl}
              filterSubgrid={filterSubgrid}
              filterDate={filterDate}
              filterColorByDate={filterColorByDate}
              filterDateStrict={filterDateStrict}
              isSingleRun={isSingleRun}
              runId={runId}
              zoomToTrackTrigger={zoomToTrackTrigger}
              resizeTrigger={isViewerOpen ? splitRatio : 100}
              isViewerOpen={isViewerOpen}
              isDrawingExportBBox={isDrawingExportBBox}
              onBoundaryDrawn={(pointsInside) => {
                setCustomBBoxPoints(pointsInside);
                setIsDrawingExportBBox(false);
                setActiveTool('export');
              }}
            />
          </div>

          <AttributeTable
            points={filteredPoints}
            isOpen={isTableOpen}
            selectedLayer={selectedTableLayer}
            onClose={() => setIsTableOpen(false)}
            onPointSelect={(point) => {
              handlePointSelect(point);
              if (!isViewerOpen) setIsViewerOpen(true);
            }}
          />
        </div>

        {/* Divider */}
        {isViewerOpen && (
          <div
            className={
              isMobile
                ? "h-1.5 w-full bg-gray-800 hover:bg-blue-500 cursor-row-resize z-10 flex items-center justify-center relative hover:shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-colors shrink-0"
                : "w-1 h-full bg-gray-800 hover:bg-blue-500 cursor-col-resize z-10 flex items-center justify-center relative hover:shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-colors shrink-0"
            }
            onMouseDown={!isMobile ? startDrag : undefined}
          >
            <div className={isMobile ? "w-8 h-1 bg-gray-600 rounded-full" : "h-8 w-1 bg-gray-600 rounded-full"} />
          </div>
        )}

        {/* Right / Bottom Panel: Viewer */}
        {isViewerOpen && (
          <div
            className="bg-black relative flex flex-col overflow-hidden transition-all duration-300"
            style={
              isMobile
                ? { width: '100%', height: '50%' }
                : { width: `${100 - splitRatio}%`, height: '100%' }
            }
          >
            {selectedPoint ? (
              <Viewer
                ref={viewerRef}
                image={selectedPoint.image_url}
                configUrl={selectedPoint.config_url}
                initialYaw={selectedPoint.bearing}
                initialPitch={0}
                initialHfov={100}
                onViewChange={handleViewChange}
                navTargets={navTargets}
                onNavigate={handleNavigate}
                hotSpots={pathHotspots}
                selectedPoint={selectedPoint}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-900 select-none">
                <Maximize2 size={64} className="mb-4 opacity-30" />
                <p className="text-lg font-light">Select a location on the map</p>
                <p className="text-sm opacity-50 mt-2">to view 360° imagery</p>
              </div>
            )}

            {/* Playback Controls Overlay - ALWAYS VISIBLE */}
            <div className="absolute bottom-3 sm:bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-xl rounded-xl sm:rounded-2xl p-1 sm:p-2 flex items-center gap-1 sm:gap-2 shadow-2xl border border-white/50 z-50 max-w-[calc(100vw-1rem)]">
              <button
                onClick={handlePrevFrame}
                className="p-1.5 sm:p-2.5 hover:bg-gray-100 text-gray-700 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group shrink-0"
                disabled={currentFrameIndex <= 0}
                title="Previous Frame"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => {
                  if (!selectedPoint && filteredPoints.length > 0) {
                    handlePointSelect(filteredPoints[0]);
                  }
                  if (!isPlaying) trackPlayback();
                  setIsPlaying(!isPlaying);
                }}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all shadow-sm transform active:scale-95 flex items-center justify-center shrink-0 ${isPlaying
                  ? 'bg-red-50 text-red-500 hover:bg-red-100 ring-1 ring-red-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg ring-1 ring-blue-600'
                  }`}
                title={isPlaying ? "Pause" : "Play Walkthrough"}
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleNextFrame}
                className="p-1.5 sm:p-2.5 hover:bg-gray-100 text-gray-700 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group shrink-0"
                disabled={currentFrameIndex >= filteredPoints.length - 1}
                title="Next Frame"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="w-px h-6 sm:h-8 bg-gray-200 mx-0.5 sm:mx-1 shrink-0"></div>

              <div className="flex flex-col items-center px-1 sm:px-2 min-w-[45px] sm:min-w-[60px] shrink-0">
                <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Frame</span>
                <div className="text-xs sm:text-sm font-bold text-gray-700 font-mono leading-none">
                  {currentFrameIndex + 1}<span className="text-gray-300 font-normal mx-0.5 sm:mx-1">/</span>{filteredPoints.length}
                </div>
              </div>

              <div className="w-px h-6 sm:h-8 bg-gray-200 mx-0.5 sm:mx-1 shrink-0"></div>

              <button
                onClick={handleSnapshot}
                className="p-1.5 sm:p-2.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all group disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                disabled={!selectedPoint}
                title="Take Snapshot (Save Image)"
              >
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
              </button>

              <button
                onClick={handlePdfReport}
                className="p-1.5 sm:p-2.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all group disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                disabled={!selectedPoint}
                title="Generate PDF Survey Inspection Report"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Upload Spatial File Modal */}
      <UploadModal
        isOpen={activeTool === 'upload'}
        onClose={() => setActiveTool(null)}
        onUploadSuccess={(uploadInfo) => {
          console.log("Uploaded spatial file successfully:", uploadInfo);
          setActiveTool(null);
        }}
      />

      {/* Advanced Spatial Data Export Modal */}
      <ExportModal
        isOpen={activeTool === 'download' || activeTool === 'export'}
        onClose={() => {
          setActiveTool(null);
          setIsDrawingExportBBox(false);
        }}
        dataPoints={customBBoxPoints || filteredPoints}
        onStartDrawBBox={() => {
          setIsDrawingExportBBox(true);
          setActiveTool('polygon-measure');
        }}
      />
      {/* My Account Modal */}
      <MyAccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        user={user}
        signOut={signOut}
        usageStats={usageStats}
        onResetStats={resetStats}
      />
    </div>
  );
};

export default Layout;
