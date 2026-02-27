import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import MapComponent from './Map';
import Viewer from './Viewer';
import AttributeTable from './AttributeTable';
import useCsvPoints from '../hooks/useCsvPoints';
import useWfsPoints from '../hooks/useWfsPoints';
import { Maximize2, Play, Pause, SkipForward, SkipBack, Camera } from 'lucide-react';

const Layout = () => {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [viewState, setViewState] = useState({ yaw: 0, pitch: 0, hfov: 100 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null); // 'measure', 'extract', 'identify', 'polygon-measure', 'buffer', 'coordinate'
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // 50% split
  const [activeLayers, setActiveLayers] = useState(['panotrack']);
  const [activeBasemap, setActiveBasemap] = useState('osm');
  
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

  const handleZoomToTrack = () => {
    setZoomToTrackTrigger(prev => prev + 1);
  };

  const qgisWmsUrl = import.meta.env.VITE_QGIS_WMS_URL || undefined;
  
  // Decide whether to use CSV or WFS based on env vars
  const geoserverUrl = import.meta.env.VITE_GEOSERVER_URL;
  const geoserverLayer = import.meta.env.VITE_GEOSERVER_LAYER;
  const useWfs = !!(geoserverUrl && geoserverLayer);

  const csvUrl = import.meta.env.VITE_METADATA_CSV_URL || '/metadata.csv';
  
  const { points: csvPoints, loading: csvLoading } = useCsvPoints(useWfs ? null : csvUrl);
  const { points: wfsPoints, loading: wfsLoading } = useWfsPoints(geoserverUrl, geoserverLayer);
  
  const points = useWfs ? wfsPoints : csvPoints;
  const pointsLoading = useWfs ? wfsLoading : csvLoading;

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

  const handleNextFrame = () => {
    if (!selectedPoint || filteredPoints.length === 0) return;
    const currentIndex = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (currentIndex < filteredPoints.length - 1) {
      const nextPoint = filteredPoints[currentIndex + 1];
      setSelectedPoint(nextPoint);
      setViewState(v => ({ ...v, yaw: nextPoint.bearing }));
    }
  };

  const handlePrevFrame = () => {
    if (!selectedPoint || filteredPoints.length === 0) return;
    const currentIndex = filteredPoints.findIndex(p => p.id === selectedPoint.id);
    if (currentIndex > 0) {
      const prevPoint = filteredPoints[currentIndex - 1];
      setSelectedPoint(prevPoint);
      setViewState(v => ({ ...v, yaw: prevPoint.bearing }));
    }
  };

  const handleSnapshot = async () => {
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
  };

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

  const handlePointSelect = (point) => {
    setSelectedPoint(point);
    // When selecting a new point, reset view to its bearing
    setViewState({ ...viewState, yaw: point.bearing });
  };

  const handleViewChange = (newView) => {
    setViewState((prev) => ({ ...prev, ...newView }));
  };

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
      />
      
      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-row h-full relative transition-all duration-300" 
      >
        
        {/* Left Panel: Map */}
        <div 
          className="h-full relative overflow-hidden flex flex-col"
          style={{ width: `${splitRatio}%` }}
        >
             <div className="flex-1 relative min-h-0">
               <MapComponent 
                 points={activeLayers.includes('panotrack') ? points : []} 
                 filteredPoints={filteredPoints}
                 selectedPoint={selectedPoint} 
                 onPointSelect={handlePointSelect}
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
               />
             </div>
             
             <AttributeTable 
                points={filteredPoints}
                isOpen={isTableOpen}
                onClose={() => setIsTableOpen(false)}
                onPointSelect={handlePointSelect}
             />
        </div>

        {/* Divider */}
        <div 
          className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize z-10 flex items-center justify-center relative hover:shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-colors"
          onMouseDown={startDrag}
        >
          <div className="h-8 w-1 bg-gray-600 rounded-full" />
        </div>

        {/* Right Panel: Viewer */}
        <div 
          className="h-full bg-black relative flex flex-col overflow-hidden"
          style={{ width: `${100 - splitRatio}%` }}
        >
          {selectedPoint ? (
            <>
              <Viewer 
                ref={viewerRef}
                image={selectedPoint.image_url} 
                configUrl={selectedPoint.config_url}
                initialYaw={selectedPoint.bearing}
                initialPitch={0}
                initialHfov={100}
                onViewChange={handleViewChange}
              />
              {/* Playback Controls Overlay */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-md rounded-lg p-2 flex items-center gap-4 text-white z-20 shadow-lg border border-gray-700">
                <button 
                  onClick={handlePrevFrame}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
                  disabled={!selectedPoint || filteredPoints.indexOf(selectedPoint) <= 0}
                  title="Previous Frame"
                >
                  <SkipBack size={20} />
                </button>
                
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-3 rounded-full transition-colors ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  title={isPlaying ? "Pause" : "Play Walkthrough"}
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                <button 
                  onClick={handleNextFrame}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
                  disabled={!selectedPoint || filteredPoints.indexOf(selectedPoint) >= filteredPoints.length - 1}
                  title="Next Frame"
                >
                  <SkipForward size={20} />
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-1"></div>
                
                <div className="text-xs font-mono text-gray-400">
                   {filteredPoints.indexOf(selectedPoint) + 1} / {filteredPoints.length}
                </div>

                <div className="w-px h-6 bg-gray-600 mx-1"></div>

                <button 
                  onClick={handleSnapshot}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors text-blue-400 hover:text-blue-300"
                  title="Take Snapshot (Save Image)"
                >
                  <Camera size={20} />
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

      </div>
    </div>
  );
};

export default Layout;
