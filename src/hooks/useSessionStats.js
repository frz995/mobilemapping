import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = '360webmap_usage_stats';

const defaultStats = {
  // Cumulative (persisted across sessions)
  totalSessions: 0,
  totalPointsVisited: 0,
  totalNavSteps: 0,       // point-to-point arrow navigations
  totalMapClicks: 0,      // map marker clicks
  totalSnapshots: 0,      // camera captures
  totalPdfReports: 0,     // PDF reports generated
  totalBasemapChanges: 0, // basemap switches
  totalToolsUsed: 0,      // tool activations
  totalPlaybackRuns: 0,   // play button presses
  totalExports: 0,        // data exports
  totalTimeSeconds: 0,    // total time spent (seconds)
  uniqueSubgridsVisited: [],
  firstUsed: null,
  lastUsed: null,

  // Current session (reset each visit)
  session: {
    pointsVisited: 0,
    navSteps: 0,
    mapClicks: 0,
    snapshots: 0,
    basemapChanges: 0,
    toolsUsed: 0,
    playbackRuns: 0,
    exports: 0,
    durationSeconds: 0,
    startedAt: null,
  }
};

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats;
    const stored = JSON.parse(raw);
    return { ...defaultStats, ...stored, session: { ...defaultStats.session } };
  } catch {
    return defaultStats;
  }
}

function saveStats(stats) {
  try {
    // Don't persist session object to storage (it's only for current session)
    const { session, ...toSave } = stats;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

export function useSessionStats() {
  const [stats, setStats] = useState(() => {
    const loaded = loadStats();
    const now = new Date().toISOString();
    return {
      ...loaded,
      session: {
        ...defaultStats.session,
        startedAt: now,
        durationSeconds: 0,
      }
    };
  });

  // Session timer — ticks every second
  const timerRef = useRef(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setStats(prev => {
        const updated = {
          ...prev,
          totalTimeSeconds: prev.totalTimeSeconds + 1,
          session: {
            ...prev.session,
            durationSeconds: prev.session.durationSeconds + 1,
          }
        };
        saveStats(updated);
        return updated;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Increment a stat by key (both cumulative and session)
  const increment = useCallback((cumulativeKey, sessionKey, amount = 1) => {
    setStats(prev => {
      const updated = {
        ...prev,
        [cumulativeKey]: (prev[cumulativeKey] || 0) + amount,
        lastUsed: new Date().toISOString(),
        session: {
          ...prev.session,
          ...(sessionKey ? { [sessionKey]: (prev.session[sessionKey] || 0) + amount } : {})
        }
      };
      saveStats(updated);
      return updated;
    });
  }, []);

  // Track a subgrid as visited
  const trackSubgridVisit = useCallback((subgrid) => {
    if (!subgrid) return;
    setStats(prev => {
      if (prev.uniqueSubgridsVisited.includes(subgrid)) return prev;
      const updated = {
        ...prev,
        uniqueSubgridsVisited: [...prev.uniqueSubgridsVisited, subgrid],
        lastUsed: new Date().toISOString(),
      };
      saveStats(updated);
      return updated;
    });
  }, []);

  // Record session start
  const recordSessionStart = useCallback(() => {
    setStats(prev => {
      const updated = {
        ...prev,
        totalSessions: prev.totalSessions + 1,
        firstUsed: prev.firstUsed || new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };
      saveStats(updated);
      return updated;
    });
  }, []);

  // Expose individual track functions for clean call sites
  const trackPointVisit = useCallback((subgrid) => {
    increment('totalPointsVisited', 'pointsVisited');
    if (subgrid) trackSubgridVisit(subgrid);
  }, [increment, trackSubgridVisit]);

  const trackNavStep = useCallback(() => increment('totalNavSteps', 'navSteps'), [increment]);
  const trackMapClick = useCallback(() => increment('totalMapClicks', 'mapClicks'), [increment]);
  const trackSnapshot = useCallback(() => increment('totalSnapshots', 'snapshots'), [increment]);
  const trackPdfReport = useCallback(() => increment('totalPdfReports', 'pdfReports'), [increment]);
  const trackBasemapChange = useCallback(() => increment('totalBasemapChanges', 'basemapChanges'), [increment]);
  const trackToolUsed = useCallback(() => increment('totalToolsUsed', 'toolsUsed'), [increment]);
  const trackPlayback = useCallback(() => increment('totalPlaybackRuns', 'playbackRuns'), [increment]);
  const trackExport = useCallback(() => increment('totalExports', 'exports'), [increment]);

  // Reset all stats
  const resetStats = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStats({ ...defaultStats, session: { ...defaultStats.session, startedAt: new Date().toISOString() } });
  }, []);

  return {
    stats,
    recordSessionStart,
    trackPointVisit,
    trackNavStep,
    trackMapClick,
    trackSnapshot,
    trackPdfReport,
    trackBasemapChange,
    trackToolUsed,
    trackPlayback,
    trackExport,
    resetStats,
  };
}
