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

export async function fetchCsv(url, signal) {
  const res = await fetch(url, { signal });
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
    
    // If image_url is missing OR if it is relative (doesn't start with http/https)
    // we use the base URL from env or fallback
    if (!image_url || (typeof image_url === 'string' && !image_url.startsWith('http'))) {
      const targetFile = image_url || filename;
      if (targetFile) {
        const cleanFilename = targetFile.replace(/^\/+/, '');
        image_url = `${baseImage}${cleanFilename}`;
      }
    }
    let config_url = pick(row, ['config_url']);
    
    // Auto-detect config_url if missing but filename exists
    // ENABLED: We have verified that tiles exist and path issues are resolved.
    if (!config_url && filename) {
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        config_url = `/tiles/${nameWithoutExt}/config.json`;
    }

    // Fix config_url path to use baseImage if relative
    if (config_url && typeof config_url === 'string') {
        if (!config_url.startsWith('http') && !config_url.startsWith('/')) {
            config_url = `/${config_url}`;
        }
        // If it starts with 'tiles/', make sure it has leading slash
        if (config_url.startsWith('tiles/')) {
             config_url = `/${config_url}`;
        }
    }

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
