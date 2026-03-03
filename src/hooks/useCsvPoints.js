import { useEffect, useState } from 'react';
import { fetchCsv } from '../services/csv';

export default function useCsvPoints(csvUrl) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!csvUrl) return;
    
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    
    fetchCsv(csvUrl, controller.signal)
      .then(setPoints)
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [csvUrl]);
  return { points, loading, error };
}
