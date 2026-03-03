import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import MapComponent from './Map';
import Viewer from './Viewer';
import AttributeTable from './AttributeTable';
import useCsvPoints from '../hooks/useCsvPoints';
import useWfsPoints from '../hooks/useWfsPoints';
import { Maximize2, Play, Pause, SkipForward, SkipBack, Camera } from 'lucide-react';
import * as turf from '@turf/turf';

const EMPTY_HOTSPOTS = [];

const Layout = () => {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [viewState, setViewState] = useState({ yaw: 0, pitch: 0, hfov: 100 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null); // 'measure', 'extract', 'identify', 'polygon-measure', 'buffer', 'coordinate'
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // 50% split
  const [activeLayers, setActiveLayers] = useState(['panotrack']);
  const [activeBasemap, setActiveBasemap] = useState('osm');
  const [isViewerOpen, setIsViewerOpen] = useState(true);
  
  const viewerRef = useRef(null);
  
  // --- Filter State ---
  const [filterSubgrid, setFilterSubgrid] = useState('');
  const [filterDate, setFilterDate] = useState(''); // ISO Date string YYYY-MM-DD
  const [filterColorByDate, setFilterColorByDate] = useState(false);
  const [filterDateStrict, setFilterDateStrict] = useState(false);
  const [zoomToTrackTrigger, setZoomToTrackTrigger] = useState(0);

  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per frame

  const handleZoomToTrack = React.useCallback(() => {
    setZoomToTrackTrigger(prev => prev + 1);
  }, []);

  const qgisWmsUrl = import.meta.env.VITE_QGIS_WMS_URL || undefined;
  
  // Decide whether to use CSV or WFS based on env vars
  const geoserverUrl = import.meta.env.VITE_GEOSERVER_URL;
  const geoserverLayer = import.meta.env.VITE_GEOSERVER_LAYER;
  const useWfs = !!(geoserverUrl && geoserverLayer);

  const csvUrl = import.meta.env.VITE_METADATA_CSV_URL || '/metadata.csv';
  
  const { points: csvPoints, loading: csvLoading, error: csvError } = useCsvPoints(useWfs ? null : csvUrl);
  const { points: wfsPoints, loading: wfsLoading, error: wfsError } = useWfsPoints(geoserverUrl, geoserverLayer);
  
  const points = useWfs ? wfsPoints : csvPoints;
  const pointsLoading = useWfs ? wfsLoading : csvLoading;
  const pointsError = useWfs ? wfsError : csvError;

  // Show error toast/notification if data fetching fails
  useEffect(() => {
    if (pointsError) {
      console.error("Data fetching error:", pointsError);
      // You could also set a state to show a UI alert here
    }
  }, [pointsError]);

  // --- Filter Logic (Lifted from Map.jsx) ---
  const filteredPoints = useMemo(() => {
    if (!points) return [];
    
    return points.filter(point => {
      // 1. Subgrid Filter
      if (filterSubgrid && filterSubgrid.trim() !== '') {
        const searchTerms = filterSubgrid.toLowerCase().split(',').map(s => s.trim()).filter(s => s);
        const pointSubgrid = (point.subgrid || '').toLowerCase();
        
        if (searchTerms.length > 0) {
          const matches = searchTerms.some(term => pointSubgrid.includes(term));
          if (!matches) return false;
        }
      }

      // 2. Date Filter (Strict)
      if (filterDateStrict && filterDate) {
         const pointDate = new Date(point.captured_at);
         const thresholdDate = new Date(filterDate);
         if (!isNaN(pointDate.getTime()) && !isNaN(thresholdDate.getTime())) {
            // Hide older points
            if (pointDate < thresholdDate) return false;
         }
      }
      
      return true;
    });
  }, [points, filterSubgrid, filterDate, filterDateStrict]);

  // --- Auto-Play Logic ---
  useEffect(() => {
    let intervalId;
    if (isPlaying && filteredPoints.length > 0) {
      intervalId = setInterval(() => {
        setSelectedPoint(prev => {
          if (!prev) return filteredPoints[0];
          const currentIndex = filteredPoints.findIndex(p => p.id === prev.id);
          if (currentIndex === -1 || currentIndex === filteredPoints.length - 1) {
            // Stop at end or if not found
            setIsPlaying(false);
            return prev;
          }
          const nextPoint = filteredPoints[currentIndex + 1];
          // Update view state for new point
          setViewState(v => ({ ...v, yaw: nextPoint.bearing }));
          return nextPoint;
        });
      }, playbackSpeed);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, filteredPoints, playbackSpeed]);

  const handleNextFrame = React.useCallback(() => {
    if (!selectedPoint || filteredPoints.length === 0) return;
    const currentIndex = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (currentIndex < filteredPoints.length - 1) {
      const nextPoint = filteredPoints[currentIndex + 1];
      setSelectedPoint(nextPoint);
      setViewState(v => ({ ...v, yaw: nextPoint.bearing }));
    }
  }, [selectedPoint, filteredPoints]);

  const handlePrevFrame = React.useCallback(() => {
    if (!selectedPoint || filteredPoints.length === 0) return;
    const currentIndex = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (currentIndex > 0) {
      const prevPoint = filteredPoints[currentIndex - 1];
      setSelectedPoint(prevPoint);
      setViewState(v => ({ ...v, yaw: prevPoint.bearing }));
    }
  }, [selectedPoint, filteredPoints]);

  const handleSnapshot = React.useCallback(async () => {
    if (!viewerRef.current || !selectedPoint) return;
    
    const dataUrl = await viewerRef.current.captureSnapshot({
      id: selectedPoint.id,
      date: selectedPoint.captured_at,
      lat: selectedPoint.lat,
      lon: selectedPoint.lon
    });
    
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `snapshot_${selectedPoint.id}_${new Date().toISOString().slice(0,10)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [selectedPoint]);

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

  // Calculate navigation hotspots (arrows on the road)
  const navTargets = useMemo(() => {
    if (!selectedPoint || !filteredPoints.length) return [];
    
    const currentIndex = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (currentIndex === -1) return [];

    const spots = [];
    // Ensure we have valid coordinates
    if (!selectedPoint.lon || !selectedPoint.lat) return [];
    
    const currentGeo = turf.point([selectedPoint.lon, selectedPoint.lat]);

    // Calculate navigation targets for hover-based navigation
    // We want the immediate "Next" point, preventing skips unless points are essentially duplicates (< 1m)
    const MIN_DIST = 1; // Minimum distance in meters to consider a move valid
    
    let forwardTarget = null;
    let backwardTarget = null;

    // Helper to calculate relative yaw
    const getRelativeYaw = (absBearing, vehicleHeading) => {
        let rel = absBearing - vehicleHeading;
        while (rel > 180) rel -= 360;
        while (rel < -180) rel += 360;
        return rel;
    };

    // Find Forward Target (Next in sequence)
    for (let i = 1; i <= 5; i++) { // Reduced lookahead window since we want immediate next
        const idx = currentIndex + i;
        if (idx >= filteredPoints.length) break;
        
        const p = filteredPoints[idx];
        if (!p.lon || !p.lat) continue;

        const targetGeo = turf.point([p.lon, p.lat]);
        const dist = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;
        
        // Only skip if it's practically the same point (GPS jitter / stop)
        if (dist < MIN_DIST) continue;

        // Found the first valid next point
        // Create a target object that preserves the point data but adds navigation properties
        // We spread 'p' so that the onNavigate callback receives the full point object
        // Set pitch to -25 to place hotspot on the road
        forwardTarget = { ...p, yaw: turf.bearing(currentGeo, targetGeo), pitch: -25, distance: dist };
        break; 
    }

    // Find Backward Target (Previous in sequence)
    for (let i = 1; i <= 5; i++) {
        const idx = currentIndex - i;
        if (idx < 0) break;
        
        const p = filteredPoints[idx];
        if (!p.lon || !p.lat) continue;

        const targetGeo = turf.point([p.lon, p.lat]);
        const dist = turf.distance(currentGeo, targetGeo, { units: 'kilometers' }) * 1000;

        if (dist < MIN_DIST) continue;

        backwardTarget = { ...p, yaw: turf.bearing(currentGeo, targetGeo), pitch: -25, distance: dist };
        break;
    }

    // Return array of valid targets for Viewer to iterate
    return [forwardTarget, backwardTarget].filter(Boolean);
  }, [selectedPoint, filteredPoints]);

  const handlePointSelect = React.useCallback((point) => {
    setSelectedPoint(point);
    // When selecting a new point, reset view to its bearing
    setViewState(prev => ({ ...prev, yaw: point.bearing }));
  }, []);

  const handleViewChange = React.useCallback((newView) => {
    setViewState((prev) => ({ ...prev, ...newView }));
  }, []);

  // Stable callback for map point selection to prevent PointsLayer re-renders
  const handleMapPointSelect = React.useCallback((point) => {
    handlePointSelect(point);
    setIsViewerOpen(true);
  }, [handlePointSelect]);

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

  // Preload next/prev images for smoother playback
  useEffect(() => {
    if (!selectedPoint || !filteredPoints.length) return;

    const currentIndex = filteredPoints.indexOf(selectedPoint);
    if (currentIndex === -1) return;

    const pointsToPreload = [];
    // Preload next 2 images
    if (currentIndex + 1 < filteredPoints.length) pointsToPreload.push(filteredPoints[currentIndex + 1]);
    if (currentIndex + 2 < filteredPoints.length) pointsToPreload.push(filteredPoints[currentIndex + 2]);
    // Preload previous image
    if (currentIndex - 1 >= 0) pointsToPreload.push(filteredPoints[currentIndex - 1]);

    pointsToPreload.forEach(point => {
      if (point.image_url) {
        let url = point.image_url;
        // Match Viewer.jsx logic for CDN
         if (!url.startsWith('http')) {
            const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL || '/';
            // Only prepend if not already present
            const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            if (!url.startsWith(cleanBase)) {
                 url = `${cleanBase}${url.startsWith('/') ? url.substring(1) : url}`;
            }
         }
        const img = new Image();
        img.src = url;
      }
    });
  }, [selectedPoint, filteredPoints]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 relative font-sans">
      
      {/* Sidebar - Fixed overlay */}
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        qgisWmsUrl={qgisWmsUrl}
        activeLayers={activeLayers}
        setActiveLayers={setActiveLayers}
        activeBasemap={activeBasemap}
        setActiveBasemap={setActiveBasemap}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
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
        isViewerOpen={isViewerOpen}
        setIsViewerOpen={setIsViewerOpen}
      />
      
      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-row h-full relative transition-all duration-300" 
      >
        
        {/* Left Panel: Map */}
        <div 
            className="h-full relative overflow-hidden flex flex-col transition-all duration-300"
            style={{ width: isViewerOpen ? `${splitRatio}%` : '100%' }}
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
                 zoomToTrackTrigger={zoomToTrackTrigger}
                 resizeTrigger={isViewerOpen ? splitRatio : 100}
                 isViewerOpen={isViewerOpen}
               />
             </div>
             
             <AttributeTable 
                points={filteredPoints}
                isOpen={isTableOpen}
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
            className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize z-10 flex items-center justify-center relative hover:shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-colors"
            onMouseDown={startDrag}
          >
            <div className="h-8 w-1 bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Right Panel: Viewer */}
        {isViewerOpen && (
          <div 
            className="h-full bg-black relative flex flex-col overflow-hidden"
            style={{ width: `${100 - splitRatio}%` }}
          >
            {selectedPoint ? (
            <>
              <Viewer 
                // key={selectedPoint.id} // REMOVED: Prevent remounting to avoid WebGL context churn
                ref={viewerRef}
                image={selectedPoint.image_url} 
                configUrl={selectedPoint.config_url}
                initialYaw={selectedPoint.bearing}
                initialPitch={0}
                initialHfov={100}
                onViewChange={handleViewChange}
                navTargets={navTargets}
                onNavigate={handlePointSelect}
                hotSpots={pathHotspots}
              />
              {/* Playback Controls Overlay */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-xl rounded-2xl p-2 flex items-center gap-2 shadow-2xl border border-white/50 z-20 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1">
                <button 
                  onClick={handlePrevFrame}
                  className="p-2.5 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                  disabled={!selectedPoint || filteredPoints.indexOf(selectedPoint) <= 0}
                  title="Previous Frame"
                >
                  <SkipBack size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-3 rounded-xl transition-all shadow-sm transform active:scale-95 flex items-center justify-center ${
                    isPlaying 
                      ? 'bg-red-50 text-red-500 hover:bg-red-100 ring-1 ring-red-200' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 ring-1 ring-blue-600'
                  }`}
                  title={isPlaying ? "Pause" : "Play Walkthrough"}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>

                <button 
                  onClick={handleNextFrame}
                  className="p-2.5 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                  disabled={!selectedPoint || filteredPoints.indexOf(selectedPoint) >= filteredPoints.length - 1}
                  title="Next Frame"
                >
                  <SkipForward size={20} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                
                <div className="w-px h-8 bg-gray-200 mx-1"></div>
                
                <div className="flex flex-col items-center px-2 min-w-[60px]">
                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Frame</span>
                   <div className="text-sm font-bold text-gray-700 font-mono leading-none">
                     {filteredPoints.indexOf(selectedPoint) + 1}<span className="text-gray-300 font-normal mx-1">/</span>{filteredPoints.length}
                   </div>
                </div>

                <div className="w-px h-8 bg-gray-200 mx-1"></div>

                <button 
                  onClick={handleSnapshot}
                  className="p-2.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all group"
                  title="Take Snapshot (Save Image)"
                >
                  <Camera size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-900 select-none">
              <Maximize2 size={64} className="mb-4 opacity-30" />
              <p className="text-lg font-light">Select a location on the map</p>
              <p className="text-sm opacity-50 mt-2">to view 360° imagery</p>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
};

export default Layout;
