import React, { useState } from 'react';
import { Layers, ChevronDown, Map as MapIcon, Menu, X, LayoutDashboard, User, HelpCircle, Info, Ruler, PenTool, MousePointer2, Download, Trash2, MoreVertical, Calendar, Grid, Hexagon, Circle, Crosshair, Table } from 'lucide-react';
import clsx from 'clsx';
import { BASEMAPS } from '../config/basemaps';

const MenuLink = ({ icon: Icon, label, active }) => (
  <button className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium", active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50")}>
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const Sidebar = ({ isOpen, setIsOpen, qgisWmsUrl, activeLayers, setActiveLayers, activeBasemap, setActiveBasemap, activeTool, setActiveTool, filterSubgrid, setFilterSubgrid, availableSubgrids = [], filterDate, setFilterDate, filterColorByDate, setFilterColorByDate, filterDateStrict, setFilterDateStrict, onZoomToTrack, isTableOpen, setIsTableOpen }) => {
  const layers = [
    { name: 'panotrack', title: 'Panotrack (360 Views)' }
  ];

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBasemapOpen, setIsBasemapOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(null);

  const toggleLayer = (layerName) => {
    if (activeLayers.includes(layerName)) {
      setActiveLayers(activeLayers.filter(l => l !== layerName));
    } else {
      setActiveLayers([...activeLayers, layerName]);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[5000]">
      
      {/* Top Left Container: Burger + Title */}
      <div className="absolute top-4 left-4 flex items-center gap-3 pointer-events-auto">
        {/* Burger Menu Button */}
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="bg-white/70 backdrop-blur-md p-2 rounded-xl shadow-sm border border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md transition-all duration-300 group h-10 w-10 flex items-center justify-center"
        >
          <Menu size={20} />
        </button>

        {/* Map Title Card */}
        <div className="bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-sm rounded-xl flex items-center p-1.5 gap-3 min-w-[260px] pr-4 h-10 transition-all duration-300">
          <div className="w-7 h-7 bg-transparent rounded-lg flex items-center justify-center shrink-0">
            <MapIcon className="text-blue-600" size={18} />
          </div>
          <div className="flex flex-col justify-center h-full">
            <h1 className="text-sm font-extrabold text-gray-800 tracking-tight leading-none font-display">360° Web Mapping</h1>
            <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">StreetView Imagery</span>
          </div>
        </div>

        {/* GIS Toolbar - Next to Title Card */}
        <div className="bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-sm rounded-xl flex items-center p-1 gap-1 h-10 transition-all duration-300">
          <button
            onClick={() => setActiveTool(activeTool === 'measure' ? null : 'measure')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'measure' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Measure Distance/Area"
          >
            <Ruler size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Measure</span>
          </button>
          
          <button
            onClick={() => setActiveTool(activeTool === 'extract' ? null : 'extract')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'extract' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Extraction Layer (Draw)"
          >
            <PenTool size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Extract Features</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'identify' ? null : 'identify')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'identify' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Identify Features"
          >
            <MousePointer2 size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Identify</span>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setActiveTool(activeTool === 'polygon-measure' ? null : 'polygon-measure')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'polygon-measure' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Measure Area (Polygon)"
          >
            <Hexagon size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Measure Area</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'buffer' ? null : 'buffer')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'buffer' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Buffer Analysis"
          >
            <Circle size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Buffer</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'coordinate' ? null : 'coordinate')}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              activeTool === 'coordinate' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Coordinate Converter"
          >
            <Crosshair size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Coords</span>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setIsTableOpen(!isTableOpen)}
            className={clsx(
              "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
              isTableOpen ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
            )}
            title="Attribute Table"
          >
            <Table size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Attribute Table</span>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setActiveTool('download')}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-green-600 hover:shadow-sm transition-colors flex items-center justify-center group relative"
            title="Export Data"
          >
            <Download size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Export Data</span>
          </button>

          <button
            onClick={() => setActiveTool('clear')}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-red-500 hover:shadow-sm transition-colors flex items-center justify-center group relative"
            title="Clear Analysis"
          >
            <Trash2 size={18} />
            <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Clear All</span>
          </button>
        </div>
      </div>

      {/* Top Right: Basemap Switcher */}
      <div className="absolute top-4 right-4 pointer-events-auto z-[2000]">
        <div className="relative">
          <button 
            onClick={() => setIsBasemapOpen(!isBasemapOpen)}
            className="bg-white/70 backdrop-blur-md p-2 rounded-xl shadow-sm border border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md transition-all duration-300 group h-10 w-10 flex items-center justify-center"
            title="Change Basemap"
          >
            <Layers size={20} />
          </button>

          {/* Basemap Dropdown */}
          <div className={clsx(
            "absolute right-0 top-12 bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-gray-100/50 w-72 overflow-hidden transition-all duration-300 origin-top-right",
            isBasemapOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
          )}>
            <div className="p-3 bg-gray-50/80 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
              <span>Select Basemap</span>
              <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px]">{BASEMAPS.length} Maps</span>
            </div>
            
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-2">
                {BASEMAPS.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => {
                      setActiveBasemap(map.id);
                      setIsBasemapOpen(false);
                    }}
                    className={clsx(
                      "group relative flex flex-col items-start overflow-hidden rounded-lg border transition-all duration-200",
                      activeBasemap === map.id 
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" 
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                    )}
                  >
                    {/* Preview Image */}
                    <div className="w-full h-20 bg-gray-100 relative overflow-hidden">
                      {map.preview ? (
                        <img 
                          src={map.preview} 
                          alt={map.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <MapIcon size={24} />
                        </div>
                      )}
                      
                      {/* Active Indicator Overlay */}
                      {activeBasemap === map.id && (
                        <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                          <div className="bg-blue-600 text-white p-1 rounded-full shadow-sm">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <div className="w-full p-2 bg-white/90 backdrop-blur-sm border-t border-gray-100/50">
                      <div className={clsx(
                        "text-xs font-medium truncate",
                        activeBasemap === map.id ? "text-blue-700" : "text-gray-700"
                      )}>
                        {map.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Drawer / Sidebar Overlay */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto z-[6000] opacity-100"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div 
            className="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-[6001] pointer-events-auto flex flex-col translate-x-0"
          >
          {/* Drawer Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <MapIcon className="text-white" size={18} />
              </div>
              <span className="font-bold text-gray-800 text-lg">Menu</span>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 hover:text-red-500 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Menu Items */}
            <div className="space-y-1">
              <MenuLink icon={LayoutDashboard} label="Dashboard" active />
              <MenuLink icon={User} label="My Account" />
              <MenuLink icon={HelpCircle} label="Help & Support" />
            </div>

            {/* Divider */}
            <hr className="border-gray-100" />

            {/* Description Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 px-2">
                <Info size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">About This WebMap</h3>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-gray-600 leading-relaxed space-y-2">
                <p>
                  Welcome to the <span className="font-semibold text-blue-700">360° Web Mapping</span> platform.
                </p>
                <p>
                  This application provides immersive high-resolution street-view imagery combined with precise geospatial data layers. 
                </p>
                <p>
                  Navigate the map, toggle layers, and explore the world in 360°.
                </p>
              </div>
              <div className="px-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Version 2.0.0 (Beta)</p>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 text-center">
            <p className="text-xs text-gray-400">© 2026 360° Web Mapping Solutions</p>
          </div>
          </div>
        </>
      )}

      {/* Layers Panel - Below Title */}
      <div 
        className={clsx(
          "absolute top-20 left-4 pointer-events-auto bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-lg overflow-hidden flex flex-col transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] origin-top-left z-[2000]",
          isOpen ? "w-80 rounded-2xl max-h-[calc(100vh-12rem)]" : "w-[150px] rounded-xl max-h-[46px] hover:bg-white"
        )}
      >
        {/* Header / Toggle Area - Always Visible */}
        <div 
           onClick={() => setIsOpen(!isOpen)}
           className={clsx(
             "flex items-center gap-2 px-4 py-2.5 cursor-pointer w-full transition-colors duration-300",
             isOpen ? "bg-white/50" : "hover:bg-white/50"
           )}
        >
             <Layers size={16} className={clsx("transition-colors duration-300", isOpen ? "text-gray-600" : "text-gray-500")} />
             <span className={clsx("text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300", isOpen ? "text-gray-700" : "text-gray-600")}>Map Layers</span>
             <ChevronDown size={16} className={clsx("ml-auto transition-transform duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]", isOpen ? "rotate-180 text-gray-600" : "text-gray-400")} />
        </div>

        {/* Content Area - Animate Opacity */}
        <div className={clsx(
            "flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-gray-200/50 transition-all duration-500 ease-in-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        )}>
           {/* Layer List */}
           <div className="space-y-1.5 pt-2">
             {layers.length > 0 ? layers.map((ly) => {
               const isActive = activeLayers.includes(ly.name);
               return (
                 <div key={ly.name} className="flex flex-col bg-white/40 rounded-lg transition-all duration-200 border border-transparent hover:bg-white/50 hover:border-gray-200">
                   <div className={clsx(
                     "flex items-center gap-2 p-2.5 rounded-lg transition-all duration-200",
                     isActive && "bg-blue-50/50"
                   )}>
                     <label className="flex-1 flex items-center gap-3 cursor-pointer">
                       <div className="relative flex items-center">
                         <input
                           type="checkbox"
                           checked={isActive}
                           onChange={() => toggleLayer(ly.name)}
                           className="peer sr-only" 
                         />
                         {/* Custom Checkbox UI */}
                         <div className={clsx(
                           "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                           isActive ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
                         )}>
                           {isActive && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                         </div>
                       </div>
                       <span className="text-xs font-medium select-none text-gray-700">{ly.title || ly.name}</span>
                     </label>
                     
                     {/* 3-Dot Menu Button (Only for Panotrack) */}
                     {ly.name === 'panotrack' && isActive && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setFilterMenuOpen(filterMenuOpen === ly.name ? null : ly.name); 
                          }}
                          className={clsx(
                            "p-1.5 rounded-md transition-colors",
                            filterMenuOpen === ly.name ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          )}
                          title="Filter Options"
                        >
                          <MoreVertical size={16} />
                        </button>
                     )}
                   </div>

                   {/* Filter Panel */}
                   {filterMenuOpen === ly.name && isActive && (
                      <div className="mx-3 mb-3 mt-1 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-blue-100 text-xs space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-200">
                         {/* Subgrid Filter */}
                         <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-wider text-[10px]">
                               <Grid size={12} />
                               <span>Subgrid Filter</span>
                            </div>
                            <div className="relative">
                              <select 
                                 value={filterSubgrid}
                                 onChange={(e) => setFilterSubgrid(e.target.value)}
                                 className="w-full px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 appearance-none text-xs cursor-pointer"
                              >
                                 <option value="">All Subgrids</option>
                                 {availableSubgrids.map((grid) => (
                                   <option key={grid} value={grid}>{grid}</option>
                                 ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                         </div>
              
                         {/* Date Input */}
                         <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-wider text-[10px]">
                               <Calendar size={12} />
                               <span>Date Publish</span>
                            </div>
                            <div className="flex items-center gap-1">
                               <input 
                                  type="date" 
                                  value={filterDate}
                                  onChange={(e) => setFilterDate(e.target.value)}
                                  className="w-full px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-gray-700"
                               />
                               {filterDate && (
                                 <button
                                   onClick={() => setFilterDate('')}
                                   className="p-1.5 bg-red-50 text-red-500 rounded border border-red-100 hover:bg-red-100 transition-colors shrink-0"
                                   title="Clear Date"
                                 >
                                   <X size={14} />
                                 </button>
                               )}
                            </div>

                            {/* Strict Filter Toggle */}
                            <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                               <input
                                  type="checkbox"
                                  checked={filterDateStrict}
                                  onChange={(e) => setFilterDateStrict(e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                               />
                               <span className="text-[10px] text-gray-600">Hide older data</span>
                            </label>
                            
                            {/* Zoom to Track Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onZoomToTrack) onZoomToTrack();
                              }}
                              className="w-full flex items-center justify-center gap-2 px-2 py-1.5 mt-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors text-xs font-medium"
                              title="Zoom to filtered data"
                            >
                              <MapIcon size={12} />
                              <span>Go to track</span>
                            </button>
                         </div>
              
                         {/* Color by Date Toggle */}
                         <div className="pt-1 flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                               <div className={clsx(
                                  "w-8 h-4 rounded-full p-0.5 transition-colors duration-300 border border-transparent",
                                  filterColorByDate ? "bg-blue-600" : "bg-gray-200 group-hover:bg-gray-300"
                               )}>
                                  <div className={clsx(
                                     "w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300",
                                     filterColorByDate ? "translate-x-4" : "translate-x-0"
                                  )} />
                               </div>
                               <span className="text-gray-600 group-hover:text-blue-600 transition-colors font-medium">Color by Date</span>
                            </label>

                            {/* Legend */}
                            {filterColorByDate && (
                               <div className="flex items-center gap-4 bg-gray-50 p-2 rounded border border-gray-100">
                                  <div className="flex items-center gap-1.5">
                                     <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-green-600" />
                                     <span className="text-[10px] text-gray-500 font-medium">Newer</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                     <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600" />
                                     <span className="text-[10px] text-gray-500 font-medium">Older</span>
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>
                   )}
                 </div>
               );
             }) : (
               <p className="text-xs text-gray-500 px-2">No layers available</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
