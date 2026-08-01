import React, { useState, useRef } from 'react';
import { Upload, X, FileCheck, AlertCircle, Check, FileArchive, FileJson, MapPin } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import shpjs from 'shpjs';

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
    if (ext === 'zip') return <FileArchive className="text-amber-500 mb-2" size={32} />;
    if (ext === 'csv') return <FileCheck className="text-emerald-500 mb-2" size={32} />;
    return <FileJson className="text-blue-500 mb-2" size={32} />;
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
      // Basic KML → GeoJSON: extract placemarks
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
      return text; // raw text, consumer handles it
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

  // ── Theme classes ──
  const modal = isDark ? 'bg-gray-900 border-gray-700/60 text-gray-100' : 'bg-white border-gray-200 text-gray-900';
  const header = isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-100 bg-gray-50/80';
  const iconBg = isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600';
  const subText = isDark ? 'text-gray-400' : 'text-gray-500';
  const closeBtn = isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100';
  const dropIdle = isDark ? 'border-gray-700 hover:border-gray-500 bg-gray-800/40' : 'border-gray-300 hover:border-blue-400 bg-gray-50';
  const dropFile = isDark ? 'border-green-500/50 bg-green-500/5' : 'border-green-400 bg-green-50/60';
  const dropDrag = isDark ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-blue-500 bg-blue-50 scale-[1.01]';
  const fileName = isDark ? 'text-white' : 'text-gray-800';
  const label = isDark ? 'text-gray-300' : 'text-gray-600';
  const select = isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800';
  const checkLabel = isDark ? 'text-gray-200' : 'text-gray-700';
  const divider = isDark ? 'border-gray-800' : 'border-gray-100';
  const cancelBtn = isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600';
  const errorBox = isDark ? 'bg-red-950/60 border-red-800/60 text-red-400' : 'bg-red-50 border-red-200 text-red-600';

  const fileTypeBadges = [
    { label: 'GeoJSON', color: isDark ? 'bg-blue-900/40 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-600 border-blue-200' },
    { label: 'KML', color: isDark ? 'bg-violet-900/40 text-violet-300 border-violet-800' : 'bg-violet-50 text-violet-600 border-violet-200' },
    { label: 'CSV', color: isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { label: 'SHP .zip', color: isDark ? 'bg-amber-900/40 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-600 border-amber-200' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className={`${modal} border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>

        {/* Header */}
        <div className={`flex justify-between items-center px-5 py-4 border-b ${header}`}>
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Upload size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Upload Spatial Data</h3>
              <span className={`text-[10px] font-medium ${subText}`}>Max 50 MB · GeoJSON, KML, CSV, Shapefile</span>
            </div>
          </div>
          <button onClick={onClose} className={`${closeBtn} p-1.5 rounded-lg transition-colors`}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Supported format badges */}
          <div className="flex flex-wrap gap-1.5">
            {fileTypeBadges.map(b => (
              <span key={b.label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isDragging ? dropDrag : file ? dropFile : dropIdle
              }`}
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
                <span className={`font-bold text-xs ${fileName} truncate max-w-[250px]`}>{file.name}</span>
                <span className={`text-[10px] ${subText} mt-0.5`}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                  className={`mt-2 text-[10px] px-2 py-0.5 rounded-full border ${isDark ? 'border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-600' : 'border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300'} transition-colors`}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <Upload className={`${subText} mb-2`} size={28} />
                <span className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-600'}`}>
                  Drag & drop here, or <span className="text-blue-500 underline underline-offset-2">browse</span>
                </span>
                <span className={`text-[10px] ${subText} mt-1`}>{SUPPORTED_LABEL} · Max {MAX_SIZE_MB} MB</span>
                <div className={`mt-3 flex items-center gap-1.5 text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-600'} bg-amber-500/10 border ${isDark ? 'border-amber-800/40' : 'border-amber-200'} px-3 py-1.5 rounded-lg`}>
                  <FileArchive size={11} />
                  <span>Shapefile: upload as <strong>.zip</strong> (containing .shp + .dbf + .prj)</span>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${errorBox}`}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* CRS Selector */}
          <div>
            <label className={`block text-xs font-semibold ${label} mb-1.5`}>
              Coordinate System (CRS)
            </label>
            <select
              value={crs}
              onChange={(e) => setCrs(e.target.value)}
              className={`w-full ${select} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="EPSG:4326">EPSG:4326 — WGS 84 (Geographic)</option>
              <option value="EPSG:3857">EPSG:3857 — Web Mercator</option>
              <option value="EPSG:32647">EPSG:32647 — UTM Zone 47N</option>
              <option value="EPSG:32648">EPSG:32648 — UTM Zone 48N</option>
              <option value="EPSG:2062">EPSG:2062 — RSO Malaya</option>
            </select>
          </div>

          {/* Add to Panorama */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 group">
            <div
              onClick={() => setAddToPanorama(v => !v)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 border shrink-0 ${addToPanorama
                  ? 'bg-blue-600 border-blue-600'
                  : isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'
                }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${addToPanorama ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <div>
              <span className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Add to Panorama Viewer</span>
              <p className={`text-[10px] ${subText}`}>Overlay features on the 360° map view</p>
            </div>
          </label>

          {/* Buttons */}
          <div className={`flex items-center gap-2 pt-2 border-t ${divider}`}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 ${cancelBtn} text-xs font-semibold rounded-xl transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>{uploadProgress || 'Importing…'}</span>
                </>
              ) : (
                <>
                  <Check size={15} />
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
