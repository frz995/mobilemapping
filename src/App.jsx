import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Camera, FileText } from 'lucide-react';
import Layout from './components/Layout';
import Viewer from './components/Viewer';
import MapComponent from './components/Map';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import useAuth from './hooks/useAuth';
import { useSupabasePoints } from './hooks/useSupabasePoints';

function StandaloneViewer() {
  const { points } = useSupabasePoints();
  const [isPlaying, setIsPlaying] = useState(false);
  const [adminSubgridFilter, setAdminSubgridFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('adminSubgrid') || params.get('filterSubgrid') || params.get('subgrid') || '';
  });

  const [selectedPoint, setSelectedPoint] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const paramImg = params.get('image');
    return {
      image_url: paramImg || '',
      bearing: parseFloat(params.get('bearing') || '0'),
      subgrid: params.get('subgrid') || 'KL_Drive_04',
      lat: parseFloat(params.get('lat') || '2.54866'),
      lon: parseFloat(params.get('lon') || params.get('lng') || '102.815835')
    };
  });

  useEffect(() => {
    // Notify parent window that viewer iframe is fully ready to receive SET_PANORAMA messages
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'VIEWER_READY' }, '*');
    }

    const handleMessage = (e) => {
      if (e.data?.type === 'FILTER_SUBGRID') {
        setAdminSubgridFilter(e.data.subgrid || '');
      } else if (e.data?.type === 'MAP_POINT_SELECTED' || e.data?.type === 'SET_PANORAMA') {
        const pt = e.data.point || e.data.payload || e.data;
        if (pt) {
          const fn = (pt.filename || '').replace(/^\/+/, '').replace(/^MMS_PIC\//i, '');
          const imgUrl = (pt.image_url && typeof pt.image_url === 'string' && pt.image_url.trim().length > 0)
            ? (pt.image_url.startsWith('http') || pt.image_url.startsWith('/') ? pt.image_url : `/MMS_PIC/${pt.image_url.replace(/^\/+/, '').replace(/^MMS_PIC\//i, '')}`)
            : (fn ? `/MMS_PIC/${fn}` : '');

          setSelectedPoint({
            ...pt,
            image_url: imgUrl || pt.image_url,
            bearing: pt.bearing ?? pt.heading ?? 0,
            subgrid: pt.subgrid || 'KL_Drive_04',
            lat: parseFloat(pt.lat ?? 2.54866),
            lon: parseFloat(pt.lon ?? pt.lng ?? 102.815835)
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const lastNotifyRef = React.useRef(0);
  const throttledViewChange = React.useCallback((view) => {
    const now = Date.now();
    if (now - lastNotifyRef.current < 16) return; // 60fps max
    lastNotifyRef.current = now;
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CAMERA_ROTATED',
        source: 'viewer',
        yaw: view.yaw,
        pitch: view.pitch,
        fov: view.hfov
      }, '*');
    }
  }, []);

  // Filter points matching active admin subgrid filter (only if selected from processing control table)
  const filteredPoints = useMemo(() => {
    if (!points || points.length === 0) return [selectedPoint];
    const sub = (adminSubgridFilter || '').toUpperCase().trim();
    if (!sub) return points; // No table row selected -> show ALL project points (265)
    const matched = points.filter(p => (p.subgrid || '').toUpperCase().trim() === sub);
    return matched.length > 0 ? matched : points;
  }, [points, adminSubgridFilter, selectedPoint]);

  const currentIndex = useMemo(() => {
    if (!selectedPoint || !filteredPoints || filteredPoints.length === 0) return 0;
    const idx = filteredPoints.findIndex(p =>
      (p.id !== undefined && p.id === selectedPoint.id) ||
      (p.filename && selectedPoint.filename && p.filename === selectedPoint.filename) ||
      (p.image_url && selectedPoint.image_url && p.image_url === selectedPoint.image_url)
    );
    return idx >= 0 ? idx : 0;
  }, [filteredPoints, selectedPoint]);

  const handlePointSelect = React.useCallback((point) => {
    if (!point) return;
    setSelectedPoint(point);
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'MAP_POINT_SELECTED',
        point: point
      }, '*');
    }
  }, []);

  const handlePrevFrame = () => {
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : filteredPoints.length - 1;
    handlePointSelect(filteredPoints[prevIdx]);
  };

  const handleNextFrame = () => {
    const nextIdx = currentIndex < filteredPoints.length - 1 ? currentIndex + 1 : 0;
    handlePointSelect(filteredPoints[nextIdx]);
  };

  // Autoplay walkthrough timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      handleNextFrame();
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, currentIndex, filteredPoints]);

  return (
    <div className="w-full h-full bg-black relative">
      <Viewer
        image={selectedPoint.image_url}
        initialYaw={selectedPoint.bearing}
        selectedPoint={selectedPoint}
        hideToolbox={true}
        onViewChange={throttledViewChange}
      />

      {/* WebGIS Playback Controls Overlay */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 transform -translate-x-1/2 bg-[#f1f5f9]/95 backdrop-blur-xl rounded-2xl p-1.5 px-3 flex items-center gap-2 shadow-2xl border border-white/60 z-50 select-none max-w-[calc(100vw-1rem)]">
        {/* Previous Frame */}
        <button
          onClick={handlePrevFrame}
          className="p-2 hover:bg-slate-200 text-slate-700 hover:text-blue-600 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
          title="Previous Frame"
        >
          <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
        </button>

        {/* Play / Pause Autoplay */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2.5 sm:p-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center cursor-pointer shrink-0 ${
            isPlaying
              ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-400'
              : 'bg-[#2563eb] text-white hover:bg-blue-700 shadow-blue-500/30'
          }`}
          title={isPlaying ? "Pause Autoplay" : "Play Walkthrough"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Next Frame */}
        <button
          onClick={handleNextFrame}
          className="p-2 hover:bg-slate-200 text-slate-700 hover:text-blue-600 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
          title="Next Frame"
        >
          <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
        </button>

        <div className="w-px h-7 bg-slate-300/80 mx-1 shrink-0"></div>

        {/* Frame Counter Display */}
        <div className="flex flex-col items-center px-1.5 min-w-[55px] shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">FRAME</span>
          <div className="text-xs sm:text-sm font-bold text-slate-800 font-mono leading-none">
            {currentIndex + 1} <span className="text-slate-400 font-normal mx-0.5">/</span> {filteredPoints.length}
          </div>
        </div>

        <div className="w-px h-7 bg-slate-300/80 mx-1 shrink-0"></div>

        {/* Snapshot Action */}
        <button
          className="p-2 hover:bg-slate-200 text-slate-500 hover:text-blue-600 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
          title="Take Snapshot"
        >
          <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
        </button>

        {/* PDF Survey Report Action */}
        <button
          className="p-2 hover:bg-slate-200 text-slate-500 hover:text-blue-600 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
          title="Generate Survey Report"
        >
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
        </button>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEmbed = searchParams.get('embed') === 'true' || searchParams.get('clean') === 'true' || searchParams.get('ui') === 'false';
  const isViewerOnly = searchParams.get('viewerOnly') === 'true';

  if (isViewerOnly) {
    return (
      <ErrorBoundary>
        <div className="h-screen w-screen bg-black text-white overflow-hidden">
          <StandaloneViewer />
        </div>
      </ErrorBoundary>
    );
  }

  // Show blank screen while checking auth session (unless in embed mode)
  if (loading && !isEmbed) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-400 text-sm">Loading WebGIS...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated (unless in embed mode)
  if (!user && !isEmbed) {
    return <LoginPage />;
  }

  // Show the map if authenticated or in embed mode
  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
        <Layout isEmbed={isEmbed} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
