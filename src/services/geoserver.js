

export async function fetchWfsPoints(baseUrl, typeName) {
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
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GeoServer WFS error: ${res.statusText}`);
    }
    const data = await res.json();
    
    // Map GeoJSON features to our app's point format
    const baseImage = import.meta.env.VITE_IMAGE_BASE_URL || '';

    return data.features.map((f, idx) => {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0]; // [lon, lat]
      
      // Handle property mapping similar to CSV
      const filename = props.filename || props.image_name || '';
      let image_url = props.image_url || props.url;
      
      if (!image_url && filename) {
        image_url = baseImage ? `${baseImage.replace(/\/$/, '')}/${filename}` : filename;
      }

      let subgrid = props.subgrid || props.grid;
      if (!subgrid && filename) {
        const match = filename.match(/^([A-Z0-9]+)-/);
        if (match) subgrid = match[1];
      }

      return {
        id: f.id || props.id || idx,
        lat: coords[1], // Latitude is the second coordinate
        lon: coords[0], // Longitude is the first coordinate
        image_url: image_url || '',
        bearing: parseFloat(props.heading || props.bearing || 0),
        pitch: parseFloat(props.pitch || 0),
        captured_at: props.captured_at || (props.date && props.time ? `${props.date} ${props.time}` : ''),
        description: props.description || filename || `Point ${f.id}`,
        subgrid: subgrid || '',
      };
    });
  } catch (err) {
    console.error('Failed to fetch WFS points:', err);
    throw err;
  }
}
