import { useEffect, useState } from 'react';
import { fetchWfsPoints } from '../services/geoserver';

export default function useWfsPoints(baseUrl, typeName) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!baseUrl || !typeName) return;

    setLoading(true);
    fetchWfsPoints(baseUrl, typeName)
      .then(setPoints)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [baseUrl, typeName]);

  return { points, loading, error };
}
