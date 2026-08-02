import React, { useState } from 'react';
import { X, Download, Globe, FileCode, Check, SlidersHorizontal } from 'lucide-react';
import JSZip from 'jszip';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const FORMAT_OPTIONS = [
  { id: 'GeoJson', label: 'GeoJSON', ext: '.geojson', mime: 'application/json', desc: 'Standard GIS GeoJSON' },
  { id: 'Kml', label: 'KML', ext: '.kml', mime: 'application/vnd.google-earth.kml+xml', desc: 'Google Earth KML' },
  { id: 'ShapeFile', label: 'ShapeFile', ext: '.zip', mime: 'application/zip', desc: 'ESRI Shapefile Bundle (.shp, .shx, .dbf, .prj)' },
  { id: 'Gml', label: 'GML', ext: '.gml', mime: 'application/gml+xml', desc: 'OGC Geography Markup' },
  { id: 'Dxf', label: 'DXF', ext: '.dxf', mime: 'image/vnd.dxf', desc: 'AutoCAD DXF R12 CAD' },
];

const EXTENT_OPTIONS = [
  { id: 'All Data', label: 'All Features', desc: 'Entire dataset' },
  { id: 'Map BBox', label: 'Map Viewport', desc: 'Visible extent' },
  { id: 'Draw BBox', label: 'Custom Boundary', desc: 'User drawn box' }
];

// --- 1. SHP Geometry File Generator ---
const generateShpBuffer = (dataPoints) => {
  const numPoints = dataPoints.length;
  const totalBytes = 100 + numPoints * 28;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  dataPoints.forEach(p => {
    const x = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
    const y = Number(p.lat ?? p.latitude ?? 0);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  // Header
  view.setInt32(0, 9994, false); // File Code 9994
  view.setInt32(24, totalBytes / 2, false); // File length in 16-bit words
  view.setInt32(28, 1000, true); // Version 1000
  view.setInt32(32, 1, true);    // Shape Type 1 (Point)

  view.setFloat64(36, minX, true);
  view.setFloat64(44, minY, true);
  view.setFloat64(52, maxX, true);
  view.setFloat64(60, maxY, true);

  let offset = 100;
  dataPoints.forEach((p, idx) => {
    const x = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
    const y = Number(p.lat ?? p.latitude ?? 0);

    view.setInt32(offset, idx + 1, false);  // Record Number (1-based)
    view.setInt32(offset + 4, 10, false);   // Content Length (10 words = 20 bytes)
    view.setInt32(offset + 8, 1, true);     // Shape Type 1 (Point)
    view.setFloat64(offset + 12, x, true);  // X
    view.setFloat64(offset + 20, y, true);  // Y

    offset += 28;
  });

  return buffer;
};

// --- 2. SHX Index File Generator ---
const generateShxBuffer = (dataPoints) => {
  const numPoints = dataPoints.length;
  const totalBytes = 100 + numPoints * 8;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  dataPoints.forEach(p => {
    const x = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
    const y = Number(p.lat ?? p.latitude ?? 0);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  view.setInt32(0, 9994, false);
  view.setInt32(24, totalBytes / 2, false);
  view.setInt32(28, 1000, true);
  view.setInt32(32, 1, true);

  view.setFloat64(36, minX, true);
  view.setFloat64(44, minY, true);
  view.setFloat64(52, maxX, true);
  view.setFloat64(60, maxY, true);

  let offset = 100;
  dataPoints.forEach((p, idx) => {
    const recordOffsetWords = (100 + idx * 28) / 2;
    view.setInt32(offset, recordOffsetWords, false);
    view.setInt32(offset + 4, 10, false);
    offset += 8;
  });

  return buffer;
};

// --- 3. DBF Attribute Database Generator ---
const generateDbfBuffer = (dataPoints) => {
  const fields = [
    { name: 'ID', type: 'C', size: 10 },
    { name: 'SUBGRID', type: 'C', size: 16 },
    { name: 'BEARING', type: 'N', size: 10, dec: 2 },
    { name: 'ELEV', type: 'N', size: 10, dec: 2 }
  ];

  const headerLen = 32 + fields.length * 32 + 1;
  const recordLen = 1 + fields.reduce((sum, f) => sum + f.size, 0);
  const totalBytes = headerLen + dataPoints.length * recordLen + 1;
  
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // dBASE III Header
  bytes[0] = 0x03;
  const d = new Date();
  bytes[1] = d.getFullYear() - 1900;
  bytes[2] = d.getMonth() + 1;
  bytes[3] = d.getDate();

  view.setUint32(4, dataPoints.length, true);
  view.setUint16(8, headerLen, true);
  view.setUint16(10, recordLen, true);

  // Field Descriptors
  let fieldOffset = 32;
  fields.forEach(f => {
    for (let i = 0; i < f.name.length; i++) {
      bytes[fieldOffset + i] = f.name.charCodeAt(i);
    }
    bytes[fieldOffset + 11] = f.type.charCodeAt(0);
    bytes[fieldOffset + 16] = f.size;
    bytes[fieldOffset + 17] = f.dec || 0;
    fieldOffset += 32;
  });

  bytes[fieldOffset] = 0x0D; // Header terminator

  // Records
  let recOffset = headerLen;
  dataPoints.forEach(p => {
    bytes[recOffset] = 0x20; // Space (valid record)
    let cur = recOffset + 1;

    const valId = String(p.id || '').padEnd(10, ' ').slice(0, 10);
    const valSub = String(p.subgrid || '').padEnd(16, ' ').slice(0, 16);
    const valBear = Number(p.bearing ?? p.yaw ?? 0).toFixed(2).padStart(10, ' ').slice(0, 10);
    const valElev = Number(p.elevation ?? p.z ?? p.elev ?? 0).toFixed(2).padStart(10, ' ').slice(0, 10);

    const values = [valId, valSub, valBear, valElev];
    values.forEach((v) => {
      for (let i = 0; i < v.length; i++) {
        bytes[cur + i] = v.charCodeAt(i);
      }
      cur += v.length;
    });

    recOffset += recordLen;
  });

  bytes[totalBytes - 1] = 0x1A; // EOF
  return buffer;
};

// --- 4. PRJ Projection File ---
const getPrjContent = (crs) => {
  if (crs === 'EPSG:3857') {
    return `PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]`;
  }
  return `GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]`;
};

const ExportModal = ({ isOpen, onClose, dataPoints = [], onStartDrawBBox }) => {
  const { isDark } = useTheme();
  const [format, setFormat] = useState('GeoJson');
  const [extent, setExtent] = useState('All Data');
  const [crs, setCrs] = useState('EPSG:4326');
  const [attachDomainTable, setAttachDomainTable] = useState(true);
  const [downloadAttachmentIds, setDownloadAttachmentIds] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!dataPoints || dataPoints.length === 0) {
      alert("No feature data points available to export.");
      return;
    }

    setIsExporting(true);
    try {
      let blob;
      const selectedFmt = FORMAT_OPTIONS.find(f => f.id === format) || FORMAT_OPTIONS[0];
      let filename = `gis_export_${Date.now()}${selectedFmt.ext}`;

      if (format === 'ShapeFile') {
        // Bundle complete ESRI Shapefile dataset (.shp, .shx, .dbf, .prj) inside ZIP
        const zip = new JSZip();
        zip.file("gis_export.shp", generateShpBuffer(dataPoints));
        zip.file("gis_export.shx", generateShxBuffer(dataPoints));
        zip.file("gis_export.dbf", generateDbfBuffer(dataPoints));
        zip.file("gis_export.prj", getPrjContent(crs));

        blob = await zip.generateAsync({ type: "blob" });
      } else {
        let fileContent = '';

        if (format === 'GeoJson') {
          const geojson = {
            type: "FeatureCollection",
            name: "360_WebGIS_Features",
            crs: {
              type: "name",
              properties: { name: crs }
            },
            features: dataPoints.map(p => {
              const lng = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
              const lat = Number(p.lat ?? p.latitude ?? 0);
              const elev = Number(p.elevation ?? p.z ?? p.elev ?? 0);
              return {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [lng, lat, elev]
                },
                properties: {
                  id: p.id,
                  subgrid: p.subgrid || '',
                  captured_at: p.captured_at || p.date || '',
                  bearing: p.bearing ?? p.yaw ?? 0,
                  elevation_m: elev,
                  description: p.description || '',
                  image_url: p.image_url || '',
                  ...(attachDomainTable ? { domain_table: "GIS_INFRA_2026", system: "360_WEB_MAPPING" } : {}),
                  ...(downloadAttachmentIds ? { attachment_ids: String(p.id) } : {})
                }
              };
            })
          };
          fileContent = JSON.stringify(geojson, null, 2);

        } else if (format === 'Kml') {
          const placemarks = dataPoints.map(p => {
            const lng = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
            const lat = Number(p.lat ?? p.latitude ?? 0);
            const elev = Number(p.elevation ?? p.z ?? p.elev ?? 0);
            return `
    <Placemark>
      <name>Point #${p.id}</name>
      <description><![CDATA[
        <b>ID:</b> ${p.id}<br/>
        <b>Subgrid:</b> ${p.subgrid || 'N/A'}<br/>
        <b>Bearing:</b> ${p.bearing ?? 0}°<br/>
        <b>Elevation:</b> ${elev} m
      ]]></description>
      <styleUrl>#pointStyle</styleUrl>
      <ExtendedData>
        <Data name="id"><value>${p.id}</value></Data>
        <Data name="subgrid"><value>${p.subgrid || ''}</value></Data>
        <Data name="bearing"><value>${p.bearing ?? 0}</value></Data>
        <Data name="elevation"><value>${elev}</value></Data>
      </ExtendedData>
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${lng},${lat},${elev}</coordinates>
      </Point>
    </Placemark>`;
          }).join('');

          fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>360 WebGIS Exported Points</name>
    <description>Spatial survey feature dataset</description>
    <Style id="pointStyle">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>${placemarks}
  </Document>
</kml>`;

        } else if (format === 'Gml') {
          const members = dataPoints.map(p => {
            const lng = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
            const lat = Number(p.lat ?? p.latitude ?? 0);
            const elev = Number(p.elevation ?? p.z ?? p.elev ?? 0);
            return `
  <gml:featureMember>
    <ogr:Feature gml:id="Feature.${p.id}">
      <ogr:geometryProperty>
        <gml:Point srsName="${crs}">
          <gml:pos>${lat} ${lng} ${elev}</gml:pos>
        </gml:Point>
      </ogr:geometryProperty>
      <ogr:id>${p.id}</ogr:id>
      <ogr:subgrid>${p.subgrid || ''}</ogr:subgrid>
      <ogr:bearing>${p.bearing ?? 0}</ogr:bearing>
      <ogr:elevation>${elev}</ogr:elevation>
    </ogr:Feature>
  </gml:featureMember>`;
          }).join('');

          fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<gml:FeatureCollection 
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ogr="http://ogr.maptools.org/"
  gml:id="360_WebGIS_Collection">
  <gml:boundedBy>
    <gml:Envelope srsName="${crs}">
      <gml:lowerCorner>-90 -180</gml:lowerCorner>
      <gml:upperCorner>90 180</gml:upperCorner>
    </gml:Envelope>
  </gml:boundedBy>${members}
</gml:FeatureCollection>`;

        } else if (format === 'Dxf') {
          let entities = '';
          dataPoints.forEach(p => {
            const lng = Number(p.lon ?? p.lng ?? p.longitude ?? 0);
            const lat = Number(p.lat ?? p.latitude ?? 0);
            const elev = Number(p.elevation ?? p.z ?? p.elev ?? 0);
            entities += `0\nPOINT\n8\nGIS_NODES\n10\n${lng}\n20\n${lat}\n30\n${elev}\n0\nTEXT\n8\nGIS_LABELS\n10\n${lng}\n20\n${lat}\n30\n${elev}\n40\n0.0005\n1\nPt_${p.id}\n`;
          });

          fileContent = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
        }

        blob = new Blob([fileContent], { type: selectedFmt.mime });
      }

      // Download file using Blob URL
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to generate export file: " + err.message);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={clsx(
        "backdrop-blur-2xl border max-w-lg w-full p-6 space-y-6 relative overflow-hidden rounded-3xl transition-all duration-300",
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
              <Download size={22} />
            </div>
            <div>
              <h3 className={clsx("font-extrabold text-base tracking-tight", isDark ? "text-slate-100" : "text-slate-800")}>Export Spatial Data</h3>
              <p className="text-[11px] font-semibold text-slate-400">Select GIS vector format & projection parameters ({dataPoints.length} features)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={clsx("p-2 rounded-2xl transition-all", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Content Body */}
        <div className="space-y-5">
          
          {/* Format Selection Cards Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Export Format</span>
              <span className={clsx("text-[10px] font-bold px-2.5 py-0.5 rounded-full border", isDark ? "text-blue-400 bg-blue-950/60 border-blue-800/40" : "text-blue-600 bg-blue-50 border-blue-100")}>
                {FORMAT_OPTIONS.find(f => f.id === format)?.ext}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {FORMAT_OPTIONS.map((item) => {
                const isSelected = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id)}
                    className={clsx(
                      "py-3 px-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-95",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-600/25 ring-2 ring-blue-600/20"
                        : isDark
                        ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                        : "bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                    )}
                  >
                    <FileCode size={16} className={isSelected ? "text-white" : "text-slate-400"} />
                    <span className="text-xs font-bold leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spatial Extent Options */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Spatial Extent</span>
            <div className={clsx("grid grid-cols-3 gap-2 p-1 border rounded-2xl", isDark ? "bg-slate-800/60 border-slate-700/60" : "bg-slate-100/70 border-slate-200/60")}>
              {EXTENT_OPTIONS.map((item) => {
                const isSelected = extent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'Draw BBox') {
                        setExtent('Draw BBox');
                        onClose();
                        if (onStartDrawBBox) onStartDrawBBox();
                      } else {
                        setExtent(item.id);
                      }
                    }}
                    className={clsx(
                      "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                      isSelected
                        ? isDark ? "bg-slate-900 text-blue-400 border border-slate-700 shadow-sm" : "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                        : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check size={13} strokeWidth={3} className={isDark ? "text-blue-400" : "text-blue-600"} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coordinate Reference System Selector */}
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
                <option value="EPSG:4326">EPSG:4326 — WGS 84 (Geographic Lat/Lon)</option>
                <option value="EPSG:3857">EPSG:3857 — Web Mercator (Auxiliary Sphere)</option>
                <option value="EPSG:3168">EPSG:3168 — KERTETU (Malaysian National Grid)</option>
                <option value="EPSG:32647">EPSG:32647 — UTM Zone 47N (WGS 84)</option>
                <option value="EPSG:32648">EPSG:32648 — UTM Zone 48N (WGS 84)</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <SlidersHorizontal size={14} />
              </div>
            </div>
          </div>

          {/* Additional Options Checkbox Cards */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Output Properties</span>
            
            <div className="grid grid-cols-2 gap-2.5">
              <label
                onClick={() => setAttachDomainTable(!attachDomainTable)}
                className={clsx(
                  "p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2 select-none",
                  attachDomainTable
                    ? isDark ? "bg-blue-950/60 border-blue-800/60 shadow-sm" : "bg-blue-50/80 border-blue-500/80 shadow-sm"
                    : isDark ? "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800" : "bg-slate-50/60 border-slate-200/70 hover:bg-white hover:border-slate-300"
                )}
              >
                <span className={clsx("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-800")}>Attach Domain Table</span>
                <div className={clsx(
                  "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                  attachDomainTable ? "bg-blue-600 border-blue-600 text-white" : isDark ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-white"
                )}>
                  {attachDomainTable && <Check size={11} strokeWidth={3} />}
                </div>
              </label>

              <label
                onClick={() => setDownloadAttachmentIds(!downloadAttachmentIds)}
                className={clsx(
                  "p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2 select-none",
                  downloadAttachmentIds
                    ? isDark ? "bg-blue-950/60 border-blue-800/60 shadow-sm" : "bg-blue-50/80 border-blue-500/80 shadow-sm"
                    : isDark ? "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800" : "bg-slate-50/60 border-slate-200/70 hover:bg-white hover:border-slate-300"
                )}
              >
                <span className={clsx("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-800")}>Include Attachment IDs</span>
                <div className={clsx(
                  "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                  downloadAttachmentIds ? "bg-blue-600 border-blue-600 text-white" : isDark ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-white"
                )}>
                  {downloadAttachmentIds && <Check size={11} strokeWidth={3} />}
                </div>
              </label>
            </div>
          </div>

        </div>

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
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export Dataset'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExportModal;
