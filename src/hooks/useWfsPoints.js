import { useEffect, useState } from 'react';
import { fetchWfsPoints } from '../services/geoserver';

export default function useWfsPoints(baseUrl, typeName) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!baseUrl || !typeName) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchWfsPoints(baseUrl, typeName, controller.signal)
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
  }, [baseUrl, typeName]);

  return { points, loading, error };
}
