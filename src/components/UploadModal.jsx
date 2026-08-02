import React, { useState, useRef } from 'react';
import { Upload, X, FileCheck, AlertCircle, Check, FileArchive, FileJson, Globe, SlidersHorizontal } from 'lucide-react';
import shpjs from 'shpjs';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { isDark } = useTheme();
  const [file, setFile] = useState(null);
  const [crs, setCrs] = useState('EPSG:4326');
  const [addToPanorama, setAddToPanorama] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const MAX_SIZE_MB = 50;
  const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
  const SUPPORTED_EXTS = ['geojson', 'json', 'kml', 'csv', 'zip'];
  const SUPPORTED_LABEL = 'GeoJSON, KML, CSV, Shapefile (.zip)';

  const getFileIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <FileArchive className="text-blue-600 mb-2" size={32} />;
    if (ext === 'csv') return <FileCheck className="text-blue-600 mb-2" size={32} />;
    return <FileJson className="text-blue-600 mb-2" size={32} />;
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return;

    if (selectedFile.size > MAX_BYTES) {
      setError(`File size exceeds the maximum limit of ${MAX_SIZE_MB} MB.`);
      setFile(null);
      return;
    }

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      setError(`Unsupported file type. Please upload: ${SUPPORTED_LABEL}`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const parseFile = async (f) => {
    const ext = f.name.split('.').pop()?.toLowerCase();

    if (ext === 'zip') {
      setUploadProgress('Parsing Shapefile (.shp)…');
      const buffer = await f.arrayBuffer();
      const geojson = await shpjs(buffer);
      return geojson;
    }

    const text = await f.text();

    if (ext === 'geojson' || ext === 'json') {
      setUploadProgress('Parsing GeoJSON…');
      return JSON.parse(text);
    }

    if (ext === 'kml') {
      setUploadProgress('Parsing KML…');
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(text, 'application/xml');
      const placemarks = Array.from(kmlDoc.querySelectorAll('Placemark'));
      const features = placemarks.map(pm => {
        const name = pm.querySelector('name')?.textContent || '';
        const coords = pm.querySelector('coordinates')?.textContent?.trim();
        if (!coords) return null;
        const parts = coords.split(',').map(Number);
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parts[0], parts[1]] },
          properties: { name }
        };
      }).filter(Boolean);
      return { type: 'FeatureCollection', features };
    }

    if (ext === 'csv') {
      setUploadProgress('Parsing CSV…');
      return text;
    }

    return text;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a valid spatial data file.'); return; }

    setIsUploading(true);
    setUploadProgress('Reading file…');
    try {
      const parsedData = await parseFile(file);

      if (onUploadSuccess) {
        onUploadSuccess({
          fileName: file.name,
          fileSize: file.size,
          crs,
          addToPanorama,
          content: parsedData
        });
      }

      setIsUploading(false);
      setUploadProgress('');
      setFile(null);
      onClose();
    } catch (err) {
      console.error('Upload parsing error:', err);
      setError('Failed to parse file. For Shapefiles, ensure it is a .zip containing .shp, .dbf, and .prj files.');
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const fileTypeBadges = ['GeoJSON', 'KML', 'CSV', 'SHP .zip'];

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={clsx(
        "backdrop-blur-2xl border max-w-lg w-full p-6 space-y-5 relative overflow-hidden flex flex-col rounded-3xl transition-all duration-300",
        isDark
          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl shadow-slate-950/80"
          : "bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]"
      )}>

        {/* Top Decorative Subtle Ambient Gradient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className={clsx("flex items-center justify-between pb-4 border-b relative", isDark ? "border-slate-800" : "border-slate-100")}>
          <div className="flex items-center gap-3">
            <div className={clsx("p-2.5 border rounded-2xl shadow-sm", isDark ? "bg-blue-950/60 border-blue-800/60 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600")}>
              <Upload size={22} />
            </div>
            <div>
              <h3 className={clsx("font-extrabold text-base tracking-tight", isDark ? "text-slate-100" : "text-slate-800")}>Upload Spatial Data</h3>
              <p className="text-[11px] font-semibold text-slate-400">Max {MAX_SIZE_MB} MB · GeoJSON, KML, CSV, Shapefile</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={clsx("p-2 rounded-2xl transition-all", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Supported format badges */}
          <div className="flex flex-wrap gap-1.5">
            {fileTypeBadges.map(label => (
              <span key={label} className={clsx("text-[10px] font-bold px-3 py-1 rounded-xl border", isDark ? "bg-blue-950/60 text-blue-400 border-blue-800/40" : "bg-blue-50/80 text-blue-600 border-blue-100")}>
                {label}
              </span>
            ))}
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
              isDragging
                ? isDark ? "border-blue-500 bg-blue-950/40 scale-[1.01]" : "border-blue-500 bg-blue-50/80 scale-[1.01]"
                : file
                ? isDark ? "border-blue-500/60 bg-blue-950/20 border-solid" : "border-blue-500/60 bg-blue-50/40 border-solid"
                : isDark
                ? "border-slate-700/80 hover:border-blue-500 bg-slate-800/40 hover:bg-slate-800/80"
                : "border-slate-200/90 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json,.kml,.csv,.zip"
              className="hidden"
              onChange={(e) => e.target.files && validateAndSetFile(e.target.files[0])}
            />

            {file ? (
              <div className="flex flex-col items-center text-center">
                {getFileIcon(file.name)}
                <span className={clsx("font-bold text-xs truncate max-w-[260px]", isDark ? "text-slate-100" : "text-slate-800")}>{file.name}</span>
                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                  className={clsx("mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all", isDark ? "border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-800 hover:bg-red-950/40" : "border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50")}
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <Upload className={isDark ? "text-blue-400 mb-2" : "text-blue-500/80 mb-2"} size={28} />
                <span className={clsx("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-700")}>
                  Drag & drop here, or <span className={isDark ? "text-blue-400 underline underline-offset-2" : "text-blue-600 underline underline-offset-2"}>browse</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 mt-1">{SUPPORTED_LABEL} · Max {MAX_SIZE_MB} MB</span>
                <div className={clsx("mt-3 flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-xl border", isDark ? "text-blue-400 bg-blue-950/60 border-blue-800/40" : "text-blue-600 bg-blue-50/80 border-blue-100")}>
                  <FileArchive size={12} className={isDark ? "text-blue-400" : "text-blue-600"} />
                  <span>Shapefile: upload as <strong>.zip</strong> (containing .shp + .dbf + .prj)</span>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className={clsx("flex items-start gap-2 p-3 rounded-2xl border text-xs font-medium", isDark ? "bg-red-950/60 border-red-800 text-red-400" : "bg-red-50/80 border-red-200 text-red-600")}>
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* CRS Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Globe size={12} className={isDark ? "text-blue-400" : "text-blue-600"} />
              <span>Coordinate Reference System (CRS)</span>
            </label>
            <div className="relative">
              <select
                value={crs}
                onChange={(e) => setCrs(e.target.value)}
                className={clsx(
                  "w-full rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none shadow-sm transition-all border",
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-slate-50/90 border-slate-200/90 text-slate-800"
                )}
              >
                <option value="EPSG:4326">EPSG:4326 — WGS 84 (Geographic)</option>
                <option value="EPSG:3857">EPSG:3857 — Web Mercator</option>
                <option value="EPSG:32647">EPSG:32647 — UTM Zone 47N</option>
                <option value="EPSG:32648">EPSG:32648 — UTM Zone 48N</option>
                <option value="EPSG:2062">EPSG:2062 — RSO Malaya</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <SlidersHorizontal size={14} />
              </div>
            </div>
          </div>

          {/* Add to Panorama Toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none py-1.5 group">
            <div
              onClick={() => setAddToPanorama(v => !v)}
              className={clsx(
                "w-10 h-5 rounded-full p-0.5 transition-colors duration-300 border shrink-0",
                addToPanorama
                  ? "bg-blue-600 border-blue-600"
                  : isDark ? "bg-slate-800 border-slate-700" : "bg-slate-200 border-slate-300"
              )}
            >
              <div className={clsx("w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300", addToPanorama ? "translate-x-5" : "translate-x-0")} />
            </div>
            <div>
              <span className={clsx("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-800")}>Add to Panorama Viewer</span>
              <p className="text-[10px] font-semibold text-slate-400">Overlay features on the 360° map view</p>
            </div>
          </label>

          {/* Footer Action Buttons */}
          <div className={clsx("flex items-center justify-end gap-3 pt-3 border-t", isDark ? "border-slate-800" : "border-slate-100")}>
            <button
              type="button"
              onClick={onClose}
              className={clsx("px-5 py-2.5 rounded-2xl font-semibold text-xs transition-all", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>{uploadProgress || 'Importing…'}</span>
                </>
              ) : (
                <>
                  <Check size={15} strokeWidth={2.5} />
                  <span>Submit / Import</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
