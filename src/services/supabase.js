import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tqqybumedywzylujjkqa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Nf52vHR8rCpvoj-w77ZehQ_QniT4-EV';

const MAX_SAFE_HEADER_LENGTH = 1500;

/**
 * Clean legacy bloated roadAnalysisState or oversized tokens directly from browser localStorage session
 * so supabase-js never loads or sends an oversized JWT token that triggers HTTP 431 (Request Header Fields Too Large).
 */
export function pruneLocalStorageSession() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        
        // If raw string contains bloated roadAnalysisState or is dangerously large (> 2000 chars)
        if (raw.includes('roadAnalysisState') || raw.length > 2000) {
          try {
            const parsed = JSON.parse(raw);
            const tokenLen = (parsed?.access_token || '').length;
            if (tokenLen > MAX_SAFE_HEADER_LENGTH || raw.includes('roadAnalysisState')) {
              console.warn('[WebGIS Supabase] Purging bloated session token from localStorage to cure HTTP 431:', key);
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[WebGIS Supabase] pruneLocalStorageSession notice:', err);
  }
}

// Immediately run local storage pruning on module load
pruneLocalStorageSession();

/**
 * Safe fetch wrapper that guards against oversized Authorization headers.
 */
function safeSupabaseFetch(input, init) {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input?.url || '';

  let headers;
  if (init?.headers instanceof Headers) {
    headers = new Headers(init.headers);
  } else if (Array.isArray(init?.headers)) {
    headers = new Headers(init.headers);
  } else if (init?.headers && typeof init.headers === 'object') {
    headers = new Headers(init.headers);
  } else {
    headers = new Headers();
  }

  const authHeader = headers.get('Authorization') || headers.get('authorization') || '';
  const isBloatedToken = authHeader.length > MAX_SAFE_HEADER_LENGTH;

  // Proactively swap bloated tokens for the anon key so the server never returns 431
  if (isBloatedToken) {
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
  }

  // Ensure Authorization header exists for Supabase requests
  if (urlStr.includes(supabaseUrl) && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
  }

  const safeInit = {
    ...init,
    headers
  };

  return fetch(input, safeInit)
    .then(async (res) => {
      if (res.status === 431) {
        console.warn('[WebGIS Supabase] Received HTTP 431 on', urlStr, 'Retrying with safe anon key...');
        const retryHeaders = new Headers(headers);
        retryHeaders.set('Authorization', `Bearer ${supabaseAnonKey}`);
        return fetch(input, { ...safeInit, headers: retryHeaders });
      }
      return res;
    })
    .catch(async (err) => {
      const currentAuth = headers.get('Authorization') || '';
      if (currentAuth && !currentAuth.includes(supabaseAnonKey)) {
        console.warn('[WebGIS Supabase] NetworkError on', urlStr, 'Retrying with anon key...', err);
        const retryHeaders = new Headers(headers);
        retryHeaders.set('Authorization', `Bearer ${supabaseAnonKey}`);
        return fetch(input, { ...safeInit, headers: retryHeaders });
      }
      throw err;
    });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: safeSupabaseFetch
  }
});
