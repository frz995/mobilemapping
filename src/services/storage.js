const FACE_MAP = {
  front: 'b',
  back: 'f',
  left: 'r',
  right: 'l',
  top: 'u',
  bottom: 'd',
};

function extractSubgridName(name) {
  if (!name) return '';
  const match = String(name).match(/N\d{2,3}E\d{2,3}/i);
  return match ? match[0].toUpperCase() : '';
}

function formatCloudflareUrl(rawDomain) {
  let baseUrl = (rawDomain || '').trim();
  if (!baseUrl) return '';
  if (baseUrl.startsWith('/http')) baseUrl = baseUrl.substring(1);
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl.replace(/\/+$/, '');
  }
  return baseUrl.replace(/\/+$/, '');
}

// Default storage provider matching the Dashboard's default settings (Supabase public bucket).
export function defaultStorage() {
  return {
    storageProvider: 'supabase',
    imageStorageStrategy: 'single_equirectangular',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseBucket: import.meta.env.VITE_SUPABASE_BUCKET || 'MMS_PIC',
    imageStoragePath: '/MMS_PIC/',
  };
}

/**
 * Resolve a panorama filename to an absolute URL based on the active storage settings.
 * Mirrors the Dashboard's resolvePanoramaUrl (supabase.ts) so the WebGIS resolves
 * against the dynamic bucket instead of its own static origin.
 */
export function resolvePanoramaUrl(filename, settings = defaultStorage(), options = {}) {
  if (!filename) return '';
  const cleanFn = String(filename).replace(/^\/+/, '').replace(/^MMS_PIC\//i, '').trim();
  if (!cleanFn) return '';

  if (cleanFn.startsWith('http://') || cleanFn.startsWith('https://')) {
    return cleanFn;
  }

  const provider = (settings?.storageProvider) || 'supabase';
  const isMultiRes = String(settings?.imageStorageStrategy) !== 'single_equirectangular';
  const nameWithoutExt = cleanFn.replace(/\.[^/.]+$/, '');
  const targetSubgrid = (
    options?.subgrid ||
    extractSubgridName(cleanFn) ||
    cleanFn.match(/^([A-Za-z0-9_]+)-/)?.[1] ||
    nameWithoutExt
  ).toUpperCase().trim();

  switch (provider) {
    case 'cloudflare_r2':
    case 'custom_cdn': {
      const rawDomain =
        settings?.r2Domain ||
        settings?.r2PublicUrl ||
        settings?.r2PublicDomain ||
        settings?.customCdnUrl ||
        settings?.cloudStorageBaseUrl ||
        import.meta.env.VITE_R2_DOMAIN ||
        import.meta.env.VITE_IMAGE_CDN_URL ||
        '';
      const baseUrl = formatCloudflareUrl(rawDomain);

      if (options?.asConfigUrl || cleanFn.endsWith('.json')) {
        const pattern = settings?.multiResTilePattern || settings?.tilePathPattern;
        if (pattern) {
          const path = pattern
            .replace('{pointFolder}', nameWithoutExt)
            .replace('{filename}', nameWithoutExt)
            .replace('{subgrid}', targetSubgrid || nameWithoutExt)
            .replace(/^\/+/, '');
          return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
        }
        return targetSubgrid
          ? `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`
          : `${baseUrl}/tiles/${nameWithoutExt}/config.json`;
      }

      if (isMultiRes) {
        const fallbackPattern = settings?.multiResFallbackPattern;
        if (fallbackPattern) {
          const path = fallbackPattern
            .replace('{pointFolder}', nameWithoutExt)
            .replace('{filename}', nameWithoutExt)
            .replace('{subgrid}', targetSubgrid || nameWithoutExt)
            .replace(/^\/+/, '');
          return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
        }
        return targetSubgrid
          ? `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/fallback/f.jpg`
          : `${baseUrl}/tiles/${nameWithoutExt}/fallback/f.jpg`;
      }

      const singlePattern = settings?.singleImagePathPattern || settings?.imageFormatPattern;
      if (singlePattern && (singlePattern.includes('{subgrid}') || singlePattern.includes('{filename}'))) {
        const path = singlePattern
          .replace('{pointFolder}', nameWithoutExt)
          .replace('{filename}', cleanFn)
          .replace('{subgrid}', targetSubgrid || nameWithoutExt)
          .replace(/^\/+/, '');
        return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
      }

      const prefix = (settings?.imageStoragePath || '').replace(/^\/+/, '').replace(/\/+$/, '');
      if (prefix) {
        return baseUrl ? `${baseUrl}/${prefix}/${cleanFn}` : `/${prefix}/${cleanFn}`;
      }
      return baseUrl ? `${baseUrl}/${cleanFn}` : `/${cleanFn}`;
    }

    case 'aws_s3': {
      const bucket = settings?.s3Bucket || import.meta.env.VITE_S3_BUCKET || '';
      const region = settings?.s3Region || import.meta.env.VITE_S3_REGION || 'ap-southeast-1';
      const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
      if (options?.asConfigUrl) return `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
      return `${baseUrl}/${cleanFn}`;
    }

    case 'gcs': {
      const bucket = settings?.gcsBucket || import.meta.env.VITE_GCS_BUCKET || '';
      const baseUrl = `https://storage.googleapis.com/${bucket}`;
      if (options?.asConfigUrl) return `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
      return `${baseUrl}/${cleanFn}`;
    }

    case 'azure_blob': {
      const account = settings?.azureAccount || import.meta.env.VITE_AZURE_ACCOUNT || '';
      const container = settings?.azureContainer || import.meta.env.VITE_AZURE_CONTAINER || '';
      const baseUrl = `https://${account}.blob.core.windows.net/${container}`;
      if (options?.asConfigUrl) return `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
      return `${baseUrl}/${cleanFn}`;
    }

    case 'wasabi': {
      const bucket = settings?.wasabiBucket || import.meta.env.VITE_WASABI_BUCKET || '';
      const region = settings?.wasabiRegion || import.meta.env.VITE_WASABI_REGION || 'us-east-1';
      const baseUrl = `https://s3.${region}.wasabisys.com/${bucket}`;
      if (options?.asConfigUrl) return `${baseUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
      return `${baseUrl}/${cleanFn}`;
    }

    case 'nas_local': {
      const nasUrl = (settings?.nasServerUrl || import.meta.env.VITE_NAS_SERVER_URL || '').replace(/\/+$/, '');
      if (options?.asConfigUrl) return `${nasUrl}/tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
      return `${nasUrl}/${cleanFn}`;
    }

    case 'supabase':
    default: {
      const baseSupabaseUrl = (settings?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || 'https://frz995-360-processing.supabase.co').replace(/\/+$/, '');
      const bucket = settings?.supabaseBucket || import.meta.env.VITE_SUPABASE_BUCKET || 'MMS_PIC';

      if (options?.asConfigUrl || cleanFn.endsWith('.json')) {
        const pattern = settings?.multiResTilePattern || settings?.tilePathPattern;
        const rel = pattern
          ? pattern
            .replace('{pointFolder}', nameWithoutExt)
            .replace('{filename}', nameWithoutExt)
            .replace('{subgrid}', targetSubgrid || nameWithoutExt)
            .replace(/^\/+/, '')
          : `tiles/${targetSubgrid}/${nameWithoutExt}/config.json`;
        return `${baseSupabaseUrl}/storage/v1/object/public/${bucket}/${rel}`;
      }

      const pattern = settings?.singleImagePathPattern || settings?.imageFormatPattern;
      if (pattern && (pattern.includes('{subgrid}') || pattern.includes('{filename}'))) {
        const path = pattern
          .replace('{pointFolder}', nameWithoutExt)
          .replace('{filename}', cleanFn)
          .replace('{subgrid}', targetSubgrid || '')
          .replace(/^\/+/, '');
        return `${baseSupabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
      }

      return `${baseSupabaseUrl}/storage/v1/object/public/${bucket}/${cleanFn}`;
    }
  }
}

/**
 * Resolve the multi-resolution config.json URL (for PhotoSphereViewer cubemap-tiles).
 * Mirrors the Dashboard's resolvePanoramaConfigUrl (supabase.ts).
 */
export function resolvePanoramaConfigUrl(filename, settings = defaultStorage(), subgrid) {
  if (!filename) return '';
  const provider = String((settings?.storageProvider) || 'supabase').toLowerCase().trim();
  const cleanFilename = String(filename).split('/').pop()?.trim() || '';
  const pointFolder = cleanFilename.replace(/\.[a-zA-Z0-9]+$/i, '');
  const sg = (subgrid || cleanFilename.split('-')[0] || '').toUpperCase().trim();

  let baseUrl = '';
  if (provider === 'cloudflare_r2' || provider === 'r2') {
    baseUrl = (settings?.r2Domain || settings?.r2PublicDomain || settings?.cloudStorageBaseUrl || '').trim();
  } else if (provider === 'supabase') {
    const sbUrl = (settings?.supabaseUrl || '').replace(/\/+$/, '');
    const bucket = settings?.supabaseBucket || 'MMS_PIC';
    baseUrl = sbUrl ? `${sbUrl}/storage/v1/object/public/${bucket}` : '';
  } else {
    baseUrl = (settings?.customCdnUrl || settings?.customStorageUrl || settings?.cloudStorageBaseUrl || '').trim();
  }

  baseUrl = baseUrl.replace(/\/+$/, '');
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  const pattern = settings?.multiResTilePattern || settings?.tilePathPattern || 'tiles/{subgrid}/{pointFolder}/config.json';
  const relativePath = pattern
    .replace('{subgrid}', sg)
    .replace('{pointFolder}', pointFolder)
    .replace('{filename}', cleanFilename)
    .replace(/^\/+/, '');

  return `${baseUrl}/${relativePath}`;
}

/**
 * Build a PhotoSphereViewer CubemapTilesAdapter panorama from a config.json URL.
 * Mirrors the Dashboard's PhotoSphereViewerComponent.buildCubemapPanorama.
 */
export function buildCubemapPanorama(configUrl) {
  const cleanConfigUrl = String(configUrl).trim();
  const rawBasePath = cleanConfigUrl.substring(0, cleanConfigUrl.lastIndexOf('/') + 1).trim();
  const cleanBasePath = rawBasePath.replace(/([^:]\/)\/+/g, '$1').replace(/\/+$/, '');

  return {
    baseUrl: {
      front: `${cleanBasePath}/fallback/b.jpg`,
      back: `${cleanBasePath}/fallback/f.jpg`,
      left: `${cleanBasePath}/fallback/r.jpg`,
      right: `${cleanBasePath}/fallback/l.jpg`,
      top: `${cleanBasePath}/fallback/u.jpg`,
      bottom: `${cleanBasePath}/fallback/d.jpg`,
    },
    levels: [
      { faceSize: 512, nbTiles: 1 },
      { faceSize: 1024, nbTiles: 2 },
      { faceSize: 2048, nbTiles: 4 },
    ],
    tileUrl: (face, col, row, level) => {
      const faceKey = FACE_MAP[face] || face[0];
      const levelNum = (typeof level === 'number' ? level : 0) + 1;
      return `${cleanBasePath}/${levelNum}/${faceKey}${row}_${col}.jpg`;
    },
  };
}
