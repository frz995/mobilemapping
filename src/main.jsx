import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import * as maplibregl from 'maplibre-gl';

// Runtime configuration (optional). When present at webroot /config.json the
// WebGIS uses these defaults for the Supabase backend INSTEAD of the build-time
// env vars — so you can retarget local/cloud databases without a rebuild:
//
//   {
//     "supabase": {
//       "url": "http://localhost:8000",
//       "anonKey": "eyJ..."
//     }
//   }
async function loadRuntimeConfig() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL || '/'}config.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg && cfg.supabase) {
      const url = String(cfg.supabase.url || '').trim();
      if (url) {
        window.__WEBGIS_RUNTIME_CONFIG__ = {
          supabase: {
            url,
            anonKey: String(cfg.supabase.anonKey || '').trim()
          }
        };
        console.info('[WebGIS Config] Loaded runtime config.json ->', url);
      }
    }
  } catch (e) {
    // config.json is optional; fall back to env / URL / settings silently.
  }
}

loadRuntimeConfig().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
})