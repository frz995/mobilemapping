import { jsPDF } from 'jspdf';
import proj4 from 'proj4';

// Helper for DMS conversion
const toDMS = (deg, type) => {
  const d = Math.floor(Math.abs(deg));
  const minfloat = (Math.abs(deg) - d) * 60;
  const m = Math.floor(minfloat);
  const s = ((minfloat - m) * 60).toFixed(2);
  const dir = deg > 0 ? (type === 'lat' ? 'N' : 'E') : (type === 'lat' ? 'S' : 'W');
  return `${d}° ${m}' ${s}" ${dir}`;
};

export const generatePdfInspectionReport = async ({ point, snapshotDataUrl, measurements = [], digitizedAssets = [] }) => {
  if (!point) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- Header Banner ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MOBILE MAPPING WEBGIS', margin, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('ASSET INSPECTION & SURVEY REPORT', margin, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - margin - 35, 15);

  let y = 32;

  // --- Point Metadata Box ---
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`FEATURE ID: ${point.id || 'N/A'}`, margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Captured Date: ${point.captured_at ? new Date(point.captured_at).toLocaleString() : 'N/A'}`, margin + 5, y + 14);
  doc.text(`Sequence Frame: ${point.sequence_index || point.id}`, margin + 90, y + 7);
  doc.text(`Subgrid: ${point.subgrid || 'Default'}`, margin + 90, y + 14);

  y += 28;

  // --- Coordinate Summary Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Spatial Coordinate Reference', margin, y);
  y += 5;

  const lat = point.lat || 0;
  const lon = point.lon || 0;

  // Calculate UTM
  const zone = Math.floor((lon + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'N' : 'S';
  let utmX = 'N/A';
  let utmY = 'N/A';
  try {
    const utmDef = `+proj=utm +zone=${zone} +${lat >= 0 ? 'north' : 'south'} +datum=WGS84 +units=m +no_defs`;
    const result = proj4('EPSG:4326', utmDef, [lon, lat]);
    utmX = result[0].toFixed(2);
    utmY = result[1].toFixed(2);
  } catch (e) {}

  // Draw Coordinate Table
  doc.setLineWidth(0.2);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Coordinate System', margin + 4, y + 5);
  doc.text('X / Latitude', margin + 60, y + 5);
  doc.text('Y / Longitude', margin + 115, y + 5);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  // WGS84 Decimal
  doc.rect(margin, y, pageWidth - (margin * 2), 6);
  doc.text('WGS 84 (Decimal Degrees)', margin + 4, y + 4.5);
  doc.text(lat.toFixed(6), margin + 60, y + 4.5);
  doc.text(lon.toFixed(6), margin + 115, y + 4.5);
  y += 6;

  // DMS
  doc.rect(margin, y, pageWidth - (margin * 2), 6);
  doc.text('WGS 84 (DMS)', margin + 4, y + 4.5);
  doc.text(toDMS(lat, 'lat'), margin + 60, y + 4.5);
  doc.text(toDMS(lon, 'lng'), margin + 115, y + 4.5);
  y += 6;

  // UTM
  doc.rect(margin, y, pageWidth - (margin * 2), 6);
  doc.text(`UTM Zone ${zone}${hemisphere}`, margin + 4, y + 4.5);
  doc.text(`${utmX} m E`, margin + 60, y + 4.5);
  doc.text(`${utmY} m N`, margin + 115, y + 4.5);
  y += 12;

  // --- 360° Photo Imagery Snapshot Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. 360° Field Inspection Imagery', margin, y);
  y += 5;

  if (snapshotDataUrl) {
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = 85;
    doc.addImage(snapshotDataUrl, 'JPEG', margin, y, imgWidth, imgHeight);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, imgWidth, imgHeight);
    y += imgHeight + 10;
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - (margin * 2), 40, 'F');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No snapshot image attached', margin + 65, y + 22);
    y += 48;
  }

  // --- Survey & Digitized Assets Section ---
  if (digitizedAssets && digitizedAssets.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Digitized Assets & Inspections', margin, y);
    y += 6;

    digitizedAssets.forEach((asset, idx) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${idx + 1}. [${asset.category || 'Asset'}] ${asset.label || 'Feature'}`, margin + 2, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Condition: ${asset.condition || 'Good'} | Lat/Lon: ${asset.lat?.toFixed(6)}, ${asset.lon?.toFixed(6)}`, margin + 6, y + 4.5);
      if (asset.notes) {
        doc.text(`Notes: ${asset.notes}`, margin + 6, y + 9);
        y += 13;
      } else {
        y += 8;
      }
    });
  }

  // --- Footer ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text('Generated automatically by Mobile Mapping WebGIS Application', margin, pageHeight - 10);
  doc.text(`Page 1 of 1`, pageWidth - margin - 15, pageHeight - 10);

  // Save PDF
  doc.save(`Inspection_Report_${point.id}_${Date.now()}.pdf`);
};
