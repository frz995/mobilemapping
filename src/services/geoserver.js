

export async function fetchWfsPoints(baseUrl, typeName, signal) {
  if (!baseUrl || !typeName) return [];

  // WFS 2.0.0 GetFeature Request for GeoJSON
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: typeName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  });

  const url = `${baseUrl}/wfs?${params.toString()}`;
  
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`GeoServer WFS error: ${res.statusText}`);
    }
    const data = await res.json();
    
      // Map GeoJSON features to our app's point format
      const baseImage = import.meta.env.VITE_IMAGE_BASE_URL || '';
      
      return data.features.map(f => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0]; // [lon, lat]
        
        // Handle property mapping similar to CSV
        const filename = props.filename || props.image_name || '';
        let image_url = props.image_url || props.url;
        let config_url = props.config_url || '';
        
         // Auto-detect config_url if missing but filename exists (ONLY for local tiles, not cloud storage)
         const isCloudStorage = baseImage && baseImage.startsWith('http');
         if (!config_url && filename && !isCloudStorage) {
              const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
              config_url = `/tiles/${nameWithoutExt}/config.json`;
         }

        if (!image_url && filename) {
          let cleanBase = baseImage;
          if (cleanBase && cleanBase.startsWith('/http')) cleanBase = cleanBase.substring(1);
          const cleanFilename = filename.replace(/^\/+/, '').replace(/^MMS_PIC\//i, '');
          image_url = cleanBase ? `${cleanBase.replace(/\/$/, '')}/${cleanFilename}` : filename;
        }

        let subgrid = props.subgrid || props.grid;
        if (!subgrid && filename) {
          const match = filename.match(/^([A-Z0-9]+)-/);
          if (match) subgrid = match[1];
        }

        return {
          id: f.id || props.id,
          lat: coords[1], // Latitude is the second coordinate
          lon: coords[0], // Longitude is the first coordinate
          image_url: image_url || '',
          config_url: config_url,
          bearing: parseFloat(props.heading || props.bearing || 0),
          pitch: parseFloat(props.pitch || 0),
          captured_at: props.captured_at || (props.date && props.time ? `${props.date} ${props.time}` : ''),
          description: props.description || filename || `Point ${f.id}`,
          subgrid: subgrid || '',
        };
      });
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to fetch WFS points:', err);
    }
    throw err;
  }
}
