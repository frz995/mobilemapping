import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Map as MapIcon, Menu, X, LayoutDashboard, User, HelpCircle, Info, Ruler, PenTool, MousePointer2, Upload, Download, Trash2, MoreVertical, Calendar, Grid, Hexagon, Circle, Crosshair, Table, PanelRightClose, PanelRightOpen, Wrench, ChevronRight, LogOut, Sun, Moon, Search } from 'lucide-react';
import clsx from 'clsx';
import { BASEMAPS } from '../config/basemaps';
import { useTheme } from '../context/ThemeContext';

const MenuLink = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <Icon size={18} />
    <span>{label}</span>
    {onClick && <span className="ml-auto text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg></span>}
  </button>
);

const Sidebar = ({ isEmbed = false, isOpen, setIsOpen, qgisWmsUrl, activeLayers, setActiveLayers, activeBasemap, setActiveBasemap, activeTool, setActiveTool, filterSubgrid, setFilterSubgrid, availableSubgrids = [], filterDate, setFilterDate, filterColorByDate, setFilterColorByDate, filterDateStrict, setFilterDateStrict, onZoomToTrack, isTableOpen, setIsTableOpen, onOpenLayerSelect, isViewerOpen, setIsViewerOpen, onOpenAccount, user, signOut }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBasemapOpen, setIsBasemapOpen] = useState(false);
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);
  const [isUserToastExpanded, setIsUserToastExpanded] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    const coords = searchQuery.split(',').map(n => parseFloat(n.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { lat: coords[0], lon: coords[1] } }));
      setSearchLoading(false);
      return;
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } }));
      } else {
        alert('Location not found');
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isPreview = searchParams.get('preview') === 'true' || searchParams.get('hideControls') === 'true';

  if (isEmbed) {
    if (isPreview) return null;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9000]">
        {/* Top Right: Search Bar + Basemap Switcher Perfectly Aligned */}
        <div className="absolute top-3.5 right-3.5 pointer-events-auto z-[2000] flex items-center gap-2">

          {/* Search Bar Form */}
          <form
            onSubmit={handleSearchSubmit}
            className={clsx(
              "flex items-center backdrop-blur-md rounded-xl shadow-md border overflow-hidden transition-all duration-300 h-10",
              isDark
                ? "bg-slate-900/90 border-slate-700/70 text-slate-100 shadow-slate-950/50"
                : "bg-white/90 border-gray-200/50 text-gray-800 shadow-sm",
              isSearchOpen ? "w-56 sm:w-72 px-1" : "w-10 px-0"
            )}
          >
            {isSearchOpen && (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search location or lat,lon..."
                className={clsx(
                  "flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none min-w-0 transition-all",
                  isDark ? "text-slate-100 placeholder-slate-400" : "text-gray-700 placeholder-gray-400"
                )}
              />
            )}

            {isSearchOpen && searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={clsx("p-1.5 rounded-lg transition-colors shrink-0", isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}

            <button
              type={isSearchOpen && searchQuery.trim() ? "submit" : "button"}
              onClick={() => {
                if (!isSearchOpen) {
                  setIsSearchOpen(true);
                } else if (!searchQuery.trim()) {
                  setIsSearchOpen(false);
                }
              }}
              className={clsx(
                "h-10 w-10 transition-colors flex items-center justify-center shrink-0 rounded-xl",
                isDark
                  ? "text-blue-400 hover:text-blue-300 hover:bg-slate-800/80"
                  : "text-blue-600 hover:text-blue-800 hover:bg-slate-100/60"
              )}
              title="Search Map"
            >
              <Search size={18} />
            </button>
          </form>

          {/* Basemap Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setIsBasemapOpen(!isBasemapOpen)}
              className={clsx(
                "backdrop-blur-md p-2 rounded-xl shadow-md border transition-all duration-300 group h-10 w-10 flex items-center justify-center",
                isDark
                  ? "bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800 hover:text-blue-400"
                  : "bg-white/90 border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md"
              )}
              title="Change Basemap Layer"
            >
              <Layers size={20} />
            </button>

            {/* Basemap Dropdown */}
            <div className={clsx(
              "absolute right-0 top-12 backdrop-blur-md rounded-xl shadow-xl border w-72 overflow-hidden transition-all duration-300 origin-top-right z-[3000]",
              isDark ? "bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/60" : "bg-white/95 border-gray-100/50 text-gray-800",
              isBasemapOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
            )}>
              <div className={clsx("p-3 border-b text-[10px] font-bold uppercase tracking-widest flex items-center justify-between", isDark ? "bg-slate-800/80 border-slate-700/60 text-slate-400" : "bg-gray-50/80 border-gray-100 text-gray-400")}>
                <span>Select Basemap Layer</span>
                <span className={clsx("px-1.5 py-0.5 rounded text-[9px]", isDark ? "bg-blue-950/60 text-blue-400 border border-blue-800/40" : "bg-blue-100 text-blue-600")}>{BASEMAPS.length} Maps</span>
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
                          : isDark ? "border-slate-700 hover:border-slate-600 bg-slate-800/80" : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                      )}
                    >
                      {/* Preview Image */}
                      <div className={clsx("w-full h-20 relative overflow-hidden", isDark ? "bg-slate-800" : "bg-gray-100")}>
                        {map.preview ? (
                          <img
                            src={map.preview}
                            alt={map.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className={clsx("w-full h-full flex items-center justify-center", isDark ? "text-slate-600" : "text-gray-300")}>
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
                      <div className={clsx("w-full p-2 backdrop-blur-sm border-t text-xs font-bold", isDark ? "bg-slate-900/90 border-slate-700/60 text-slate-200" : "bg-white/90 border-gray-100/50 text-gray-800")}>
                        {map.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const layers = [
    { name: 'panotrack', title: 'Panotrack (360 Views)' }
  ];

  const toggleLayer = (layerName) => {
    if (activeLayers.includes(layerName)) {
      setActiveLayers(activeLayers.filter(l => l !== layerName));
    } else {
      setActiveLayers([...activeLayers, layerName]);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9000]">

      {/* Top Left Container: Burger + Account + Title + Toolbox */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center gap-1.5 sm:gap-3 pointer-events-auto z-[3000] max-w-[calc(100vw-5rem)]">
        {/* Burger Menu Button */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className={clsx(
            "backdrop-blur-md p-1.5 sm:p-2 rounded-xl shadow-sm border transition-all duration-300 group h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center shrink-0",
            isDark
              ? "bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800 hover:text-blue-400"
              : "bg-white/80 border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md"
          )}
        >
          <Menu size={18} />
        </button>

        {/* Account Widget - Fixed Pill Trigger + Floating Dropdown Panel */}
        {user && (
          <div className="relative shrink-0">
            {/* Account Avatar Pill Button */}
            <button
              type="button"
              title="User Account"
              onClick={() => setIsUserToastExpanded(prev => !prev)}
              className={clsx(
                "backdrop-blur-md border shadow-sm rounded-xl flex items-center px-2 sm:px-2.5 h-9 sm:h-10 gap-1.5 sm:gap-2 transition-all duration-300",
                isDark
                  ? "bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800"
                  : "bg-white/80 border-gray-200/50 text-gray-700 hover:bg-white hover:shadow-md"
              )}
            >
              <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className={clsx("text-xs font-bold max-w-[100px] truncate hidden md:inline", isDark ? "text-slate-200" : "text-gray-700")}>
                {user.email?.split('@')[0]}
              </span>
              <ChevronDown size={14} className={clsx("transition-transform duration-300 hidden sm:inline", isDark ? "text-slate-400" : "text-gray-500", isUserToastExpanded && "rotate-180")} />
            </button>

            {/* Floating Account Dropdown Panel */}
            {isUserToastExpanded && (
              <div className={clsx(
                "absolute left-0 top-11 w-60 sm:w-64 backdrop-blur-md border rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200",
                isDark ? "bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/60" : "bg-white/95 border-gray-200/80 text-gray-800"
              )}>
                <div className={clsx("flex items-center gap-3 pb-3 border-b", isDark ? "border-slate-800" : "border-gray-100")}>
                  <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0">
                    {user.email?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={clsx("truncate text-xs font-bold", isDark ? "text-slate-200" : "text-gray-800")}>{user.email}</p>
                    <span className={clsx("inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-0.5", isDark ? "bg-blue-950/60 text-blue-400 border border-blue-800/40" : "bg-blue-50 text-blue-600")}>Active Account</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={signOut}
                    title="Sign Out"
                    className={clsx(
                      "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all shadow-sm group",
                      isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-red-950/40 hover:border-red-800 hover:text-red-400" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    )}
                  >
                    <LogOut size={14} className="group-hover:text-red-500 transition-colors" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map Title Card - Hidden text on small mobile screens to prevent overflow */}
        <div className={clsx(
          "backdrop-blur-md border shadow-sm rounded-xl flex items-center p-1.5 gap-2.5 sm:min-w-[200px] pr-2 sm:pr-4 h-9 sm:h-10 transition-all duration-300 shrink-0",
          isDark ? "bg-slate-900/90 border-slate-700/70" : "bg-white/80 border-gray-200/50"
        )}>
          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-transparent rounded-lg flex items-center justify-center shrink-0">
            <MapIcon className={isDark ? "text-blue-400" : "text-blue-600"} size={16} />
          </div>
          <div className="hidden sm:flex flex-col justify-center h-full">
            <h1 className={clsx("text-xs font-extrabold tracking-tight leading-none font-display", isDark ? "text-slate-100" : "text-gray-800")}>360° Web Mapping</h1>
            <span className={clsx("text-[8px] font-bold uppercase tracking-widest mt-0.5", isDark ? "text-blue-400" : "text-blue-600")}>StreetView Imagery</span>
          </div>
        </div>

        {/* Toolbox - Next to Title Card */}
        <div className="flex items-center">
          <div className={clsx(
            "backdrop-blur-md border shadow-sm rounded-xl flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
            isDark ? "bg-slate-900/90 border-slate-700/70 text-slate-200" : "bg-white/80 border-gray-200/50 text-gray-700",
            isToolboxOpen ? "pr-1" : ""
          )}>
            <button
              onClick={() => setIsToolboxOpen(!isToolboxOpen)}
              className={clsx("flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-9 sm:h-10 transition-colors", isDark ? "text-slate-200 hover:text-blue-400" : "text-gray-700 hover:text-blue-600")}
            >
              <Wrench size={18} className={clsx("font-bold", isDark ? "text-blue-400" : "text-blue-600")} />
              <span className={clsx("text-xs font-bold hidden sm:inline", isDark ? "text-slate-200" : "text-gray-700")}>Toolbox</span>
              <ChevronRight size={16} className={clsx("transition-transform duration-300", isDark ? "text-blue-400" : "text-blue-600", isToolboxOpen ? "rotate-180" : "")} />
            </button>

            <div className={clsx(
              "flex items-center gap-1 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden",
              isToolboxOpen ? "max-w-[600px] opacity-100" : "max-w-0 opacity-0"
            )}>
              <div className={clsx("w-px h-5 mx-1 flex-shrink-0", isDark ? "bg-slate-700" : "bg-gray-300")}></div>
              <button
                onClick={() => setActiveTool(activeTool === 'identify' ? null : 'identify')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  activeTool === 'identify'
                    ? isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-100 text-blue-700"
                    : isDark ? "text-slate-300 hover:bg-slate-800 hover:text-blue-400" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                )}
                title="Identify Features"
              >
                <MousePointer2 size={18} className={activeTool === 'identify' ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-blue-500'} />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Identify</span>
              </button>

              <div className={clsx("w-px h-5 mx-1 flex-shrink-0", isDark ? "bg-slate-700" : "bg-gray-300")}></div>

              <button
                onClick={() => setActiveTool(activeTool === 'polygon-measure' ? null : 'polygon-measure')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  activeTool === 'polygon-measure'
                    ? isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-100 text-blue-700"
                    : isDark ? "text-slate-300 hover:bg-slate-800 hover:text-blue-400" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                )}
                title="Measure Area (Polygon)"
              >
                <Hexagon size={18} className={activeTool === 'polygon-measure' ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-pink-500'} />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Measure Area</span>
              </button>

              <button
                onClick={() => setActiveTool(activeTool === 'buffer' ? null : 'buffer')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  activeTool === 'buffer'
                    ? isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-100 text-blue-700"
                    : isDark ? "text-slate-300 hover:bg-slate-800 hover:text-blue-400" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                )}
                title="Buffer Analysis"
              >
                <Circle size={18} className={activeTool === 'buffer' ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-purple-500'} />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Buffer</span>
              </button>

              <div className={clsx("w-px h-5 mx-1 flex-shrink-0", isDark ? "bg-slate-700" : "bg-gray-300")}></div>

              <button
                onClick={() => onOpenLayerSelect ? onOpenLayerSelect() : setIsTableOpen(!isTableOpen)}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  isTableOpen
                    ? isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-100 text-blue-700"
                    : isDark ? "text-slate-300 hover:bg-slate-800 hover:text-blue-400" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                )}
                title="Attribute Table (Select Layer)"
              >
                <Table size={18} className={isTableOpen ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-emerald-500'} />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Attribute Table</span>
              </button>

              <div className={clsx("w-px h-5 mx-1 flex-shrink-0", isDark ? "bg-slate-700" : "bg-gray-300")}></div>

              <button
                onClick={() => setActiveTool('upload')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  activeTool === 'upload'
                    ? isDark ? "bg-blue-950/60 text-blue-400" : "bg-blue-100 text-blue-700"
                    : isDark ? "text-slate-300 hover:bg-slate-800 hover:text-blue-400" : "text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                )}
                title="Upload Data (GeoJSON, KML, CSV)"
              >
                <Upload size={18} className={activeTool === 'upload' ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-blue-500'} />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Upload Data</span>
              </button>

              <button
                onClick={() => setActiveTool('download')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  isDark ? "text-slate-300 hover:bg-slate-800 hover:text-green-400" : "text-gray-600 hover:bg-white hover:text-green-600 hover:shadow-sm"
                )}
                title="Export Data"
              >
                <Download size={18} className="text-green-500" />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Export Data</span>
              </button>

              <button
                onClick={() => setActiveTool('clear')}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center group relative",
                  isDark ? "text-slate-300 hover:bg-slate-800 hover:text-red-400" : "text-gray-600 hover:bg-white hover:text-red-500 hover:shadow-sm"
                )}
                title="Clear Analysis"
              >
                <Trash2 size={18} className="text-red-500" />
                <span className="absolute top-full mt-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Clear All</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: Search Bar + Theme Toggle + Viewer Toggle + Basemap Switcher */}
      <div className="absolute top-4 right-4 pointer-events-auto z-[2000] flex items-center gap-2">

        {/* Search Bar Form */}
        <form
          onSubmit={handleSearchSubmit}
          className={clsx(
            "flex items-center backdrop-blur-md rounded-xl shadow-md border overflow-hidden transition-all duration-300 h-10",
            isDark
              ? "bg-slate-900/90 border-slate-700/70 text-slate-100 shadow-slate-950/50"
              : "bg-white/90 border-gray-200/50 text-gray-800 shadow-sm",
            isSearchOpen ? "w-56 sm:w-72 px-1" : "w-10 px-0"
          )}
        >
          {isSearchOpen && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location or lat,lon..."
              className={clsx(
                "flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none min-w-0 transition-all",
                isDark ? "text-slate-100 placeholder-slate-400" : "text-gray-700 placeholder-gray-400"
              )}
            />
          )}

          {isSearchOpen && searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={clsx("p-1.5 rounded-lg transition-colors shrink-0", isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          <button
            type={isSearchOpen && searchQuery.trim() ? "submit" : "button"}
            onClick={() => {
              if (!isSearchOpen) {
                setIsSearchOpen(true);
              } else if (!searchQuery.trim()) {
                setIsSearchOpen(false);
              }
            }}
            className={clsx(
              "h-10 w-10 transition-colors flex items-center justify-center shrink-0 rounded-xl",
              isDark
                ? "text-blue-400 hover:text-blue-300 hover:bg-slate-800/80"
                : "text-blue-600 hover:text-blue-800 hover:bg-slate-100/60"
            )}
            title="Search Map"
          >
            <Search size={18} />
          </button>
        </form>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className={clsx(
            "relative h-10 w-[72px] rounded-xl border shadow-sm backdrop-blur-md transition-all duration-300 flex items-center px-1",
            isDark
              ? "bg-slate-900/90 border-slate-700/70 hover:bg-slate-800"
              : "bg-white/80 border-gray-200/50 hover:bg-white hover:shadow-md"
          )}
        >
          {/* Track icons */}
          <Sun size={14} className={clsx("absolute left-2 transition-all duration-300", isDark ? "text-slate-500 opacity-60" : "text-amber-500")} />
          <Moon size={14} className={clsx("absolute right-2 transition-all duration-300", isDark ? "text-indigo-400" : "text-gray-300 opacity-60")} />
          {/* Pill thumb */}
          <div className={clsx(
            "w-6 h-7 rounded-lg shadow-md transform transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center",
            isDark
              ? "translate-x-[36px] bg-blue-600"
              : "translate-x-0 bg-white border border-gray-200"
          )}>
            {isDark
              ? <Moon size={13} className="text-white" />
              : <Sun size={13} className="text-amber-500" />}
          </div>
        </button>

        {/* Viewer Toggle Button */}
        <button
          onClick={() => setIsViewerOpen(!isViewerOpen)}
          className={clsx(
            "backdrop-blur-md p-2 rounded-xl shadow-sm border transition-all duration-300 group h-10 w-10 flex items-center justify-center",
            isDark
              ? (!isViewerOpen ? "bg-blue-950/60 border-blue-800 text-blue-400" : "bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800 hover:text-blue-400")
              : (!isViewerOpen ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white/80 border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md")
          )}
          title={isViewerOpen ? "Hide 360° Viewer" : "Show 360° Viewer"}
        >
          {isViewerOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsBasemapOpen(!isBasemapOpen)}
            className={clsx(
              "backdrop-blur-md p-2 rounded-xl shadow-sm border transition-all duration-300 group h-10 w-10 flex items-center justify-center",
              isDark
                ? "bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800 hover:text-blue-400"
                : "bg-white/80 border-gray-200/50 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md"
            )}
            title="Change Basemap"
          >
            <Layers size={20} />
          </button>

          {/* Basemap Dropdown */}
          <div className={clsx(
            "absolute right-0 top-12 backdrop-blur-md rounded-xl shadow-xl border w-72 overflow-hidden transition-all duration-300 origin-top-right",
            isDark ? "bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/60" : "bg-white/90 border-gray-100/50 text-gray-800",
            isBasemapOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
          )}>
            <div className={clsx("p-3 border-b text-[10px] font-bold uppercase tracking-widest flex items-center justify-between", isDark ? "bg-slate-800/80 border-slate-700/60 text-slate-400" : "bg-gray-50/80 border-gray-100 text-gray-400")}>
              <span>Select Basemap</span>
              <span className={clsx("px-1.5 py-0.5 rounded text-[9px]", isDark ? "bg-blue-950/60 text-blue-400 border border-blue-800/40" : "bg-blue-100 text-blue-600")}>{BASEMAPS.length} Maps</span>
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
                        : isDark ? "border-slate-700 hover:border-slate-600 bg-slate-800/80" : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                    )}
                  >
                    {/* Preview Image */}
                    <div className={clsx("w-full h-20 relative overflow-hidden", isDark ? "bg-slate-800" : "bg-gray-100")}>
                      {map.preview ? (
                        <img
                          src={map.preview}
                          alt={map.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className={clsx("w-full h-full flex items-center justify-center", isDark ? "text-slate-600" : "text-gray-300")}>
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
                    <div className={clsx("w-full p-2 backdrop-blur-sm border-t text-xs font-bold", isDark ? "bg-slate-900/90 border-slate-700/60 text-slate-200" : "bg-white/90 border-gray-100/50 text-gray-800")}>
                      {map.name}
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto z-[9998] opacity-100"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            className="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-[9999] pointer-events-auto flex flex-col translate-x-0"
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
                <MenuLink
                  icon={User}
                  label="My Account"
                  onClick={() => { setIsDrawerOpen(false); onOpenAccount && onOpenAccount(); }}
                />
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
          "absolute top-14 left-2 sm:top-20 sm:left-4 pointer-events-auto backdrop-blur-md border shadow-lg overflow-hidden flex flex-col transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] origin-top-left z-[2000]",
          isDark
            ? "bg-slate-900/90 border-slate-700/70 text-slate-100 shadow-slate-950/50"
            : "bg-white/80 border-gray-200/50 text-gray-800",
          isOpen ? "w-[calc(100vw-1rem)] sm:w-80 rounded-2xl max-h-[calc(100vh-12rem)]" : "w-[130px] sm:w-[150px] rounded-xl max-h-[46px]"
        )}
      >
        {/* Header / Toggle Area - Always Visible */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "flex items-center gap-2 px-4 py-2.5 cursor-pointer w-full transition-colors duration-300 border-b",
            isDark
              ? (isOpen ? "bg-slate-800/80 border-slate-700/60" : "hover:bg-slate-800/60 border-transparent")
              : (isOpen ? "bg-slate-100/60 border-gray-200/50" : "hover:bg-slate-100/40 border-transparent"),
            !isOpen && "border-b-0"
          )}
        >
          <Layers size={16} className={clsx("transition-colors duration-300", isDark ? "text-blue-400" : "text-blue-600")} />
          <span className={clsx("text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300", isDark ? "text-slate-200" : "text-slate-700")}>Map Layers</span>
          <ChevronDown size={16} className={clsx("ml-auto transition-transform duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]", isOpen ? "rotate-180" : "", isDark ? "text-slate-400" : "text-gray-400")} />
        </div>

        {/* Content Area - Animate Opacity */}
        <div className={clsx(
          "flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin transition-all duration-500 ease-in-out",
          isDark ? "scrollbar-thumb-slate-700" : "scrollbar-thumb-gray-200/50",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        )}>
          {/* Layer List */}
          <div className="space-y-1.5 pt-2">
            {layers.length > 0 ? layers.map((ly) => {
              const isActive = activeLayers.includes(ly.name);
              return (
                <div key={ly.name} className={clsx(
                  "flex flex-col rounded-xl transition-all duration-200 border",
                  isDark
                    ? "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80"
                    : "bg-white/40 border-transparent hover:bg-white/80 hover:border-gray-200"
                )}>
                  <div className={clsx(
                    "flex items-center gap-2 p-2.5 rounded-xl transition-all duration-200",
                    isActive && (isDark ? "bg-blue-950/40" : "bg-blue-50/50")
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
                          isActive ? "bg-blue-600 border-blue-600" : isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-300"
                        )}>
                          {isActive && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                        </div>
                      </div>
                      <span className={clsx("text-xs font-medium select-none", isDark ? "text-slate-200" : "text-gray-700")}>{ly.title || ly.name}</span>
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
                          filterMenuOpen === ly.name
                            ? isDark ? "bg-blue-900/60 text-blue-400" : "bg-blue-100 text-blue-600"
                            : isDark ? "text-slate-400 hover:text-blue-400 hover:bg-slate-700" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        )}
                        title="Filter Options"
                      >
                        <MoreVertical size={16} />
                      </button>
                    )}
                  </div>

                  {/* Filter Panel */}
                  {filterMenuOpen === ly.name && isActive && (
                    <div className={clsx(
                      "mx-3 mb-3 mt-1 p-3 rounded-xl border text-xs space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-200",
                      isDark ? "bg-slate-800/90 border-slate-700/80 text-slate-200" : "bg-white/80 border-blue-100 text-gray-700"
                    )}>
                      {/* Subgrid Filter */}
                      <div className="space-y-1">
                        <div className={clsx("flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]", isDark ? "text-blue-400" : "text-blue-600")}>
                          <Grid size={12} />
                          <span>Subgrid Filter</span>
                        </div>
                        <div className="relative">
                          <select
                            value={filterSubgrid}
                            onChange={(e) => setFilterSubgrid(e.target.value)}
                            className={clsx(
                              "w-full px-2 py-1.5 rounded-lg border text-xs cursor-pointer focus:outline-none appearance-none",
                              isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-gray-200 text-gray-700"
                            )}
                          >
                            <option value="">All Subgrids</option>
                            {availableSubgrids.map((grid) => (
                              <option key={grid} value={grid}>{grid}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Date Input */}
                      <div className="space-y-1">
                        <div className={clsx("flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]", isDark ? "text-blue-400" : "text-blue-600")}>
                          <Calendar size={12} />
                          <span>Date Publish</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className={clsx(
                              "w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none",
                              isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-gray-200 text-gray-700"
                            )}
                          />
                          {filterDate && (
                            <button
                              onClick={() => setFilterDate('')}
                              className={clsx(
                                "p-1.5 rounded border transition-colors shrink-0",
                                isDark ? "bg-red-950/60 border-red-800 text-red-400 hover:bg-red-900" : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100"
                              )}
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
                          <span className={clsx("text-[10px]", isDark ? "text-slate-400" : "text-gray-600")}>Hide older data</span>
                        </label>

                        {/* Zoom to Track Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onZoomToTrack) onZoomToTrack();
                          }}
                          className={clsx(
                            "w-full flex items-center justify-center gap-2 px-2 py-1.5 mt-1 rounded border transition-colors text-xs font-medium",
                            isDark ? "bg-blue-950/60 text-blue-400 border-blue-800 hover:bg-blue-900/60" : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                          )}
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
                            filterColorByDate ? "bg-blue-600" : isDark ? "bg-slate-700 group-hover:bg-slate-600" : "bg-gray-200 group-hover:bg-gray-300"
                          )}>
                            <div className={clsx(
                              "w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300",
                              filterColorByDate ? "translate-x-4" : "translate-x-0"
                            )} />
                          </div>
                          <span className={clsx("transition-colors font-medium", isDark ? "text-slate-300 group-hover:text-blue-400" : "text-gray-600 group-hover:text-blue-600")}>Color by Date</span>
                        </label>

                        {/* Legend */}
                        {filterColorByDate && (
                          <div className={clsx("flex items-center gap-4 p-2 rounded border", isDark ? "bg-slate-900 border-slate-700" : "bg-gray-50 border-gray-100")}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-green-600" />
                              <span className={clsx("text-[10px] font-medium", isDark ? "text-slate-400" : "text-gray-500")}>Newer</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600" />
                              <span className={clsx("text-[10px] font-medium", isDark ? "text-slate-400" : "text-gray-500")}>Older</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className={clsx("text-xs px-2", isDark ? "text-slate-400" : "text-gray-500")}>No layers available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
