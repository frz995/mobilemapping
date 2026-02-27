import Papa from 'papaparse';

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== '') return obj[k];
    const alt = Object.keys(obj).find(h => h.toLowerCase() === k.toLowerCase());
    if (alt && obj[alt] !== undefined && obj[alt] !== '') return obj[alt];
  }
  return undefined;
}

function toNumber(v, d = undefined) {
  if (v === undefined) return d;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

export async function fetchCsv(url) {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  // Use environment variable or fallback to the known GitHub CDN URL
  const baseImage = import.meta.env.VITE_IMAGE_BASE_URL || 'https://cdn.jsdelivr.net/gh/frz995/mobilemapping@main/MMS%20PIC/';
  
  console.log('CSV Service: Base Image URL:', baseImage);

  return parsed.data.map((row, idx) => {
    const lat = toNumber(pick(row, ['lat', 'latitude']));
    const lon = toNumber(pick(row, ['lon', 'longitude']));
    const bearing = toNumber(pick(row, ['bearing', 'heading']), 0);
    const pitch = toNumber(pick(row, ['pitch']), 0);
    const idRaw = pick(row, ['id']);
    const id = idRaw !== undefined ? parseInt(idRaw) : idx + 1;
    const filename = pick(row, ['filename']);
    let image_url = pick(row, ['image_url']);
    
    // Explicitly check for VITE_IMAGE_BASE_URL override, then fallback
    const resolvedBase = baseImage || '';
    
    if (!image_url && filename) {
      // If resolvedBase is present, use it. Otherwise, assume local relative path (which might fail if files are missing)
      image_url = resolvedBase ? `${resolvedBase.replace(/\/$/, '')}/${filename}` : filename;
    }
    const config_url = pick(row, ['config_url']);
    const date = pick(row, ['captured_at', 'date']);
    const time = pick(row, ['time']);
    const captured_at = date && time ? `${date} ${time}` : (date || '');
    const description = pick(row, ['description']) || filename || '';
    let subgrid = pick(row, ['subgrid', 'grid']);
    
    // Fallback: Extract subgrid from filename if not present in columns
    // Expected format: N93E70-0001.jpg -> N93E70
    if (!subgrid && filename) {
      const match = filename.match(/^([A-Z0-9]+)-/);
      if (match) {
        subgrid = match[1];
      }
    }
    
    return {
      id,
      lat,
      lon,
      image_url: image_url || '',
      config_url: config_url || '',
      bearing,
      pitch,
      captured_at,
      description,
      subgrid: subgrid || '',
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}
