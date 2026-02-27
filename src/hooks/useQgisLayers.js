import { useEffect, useState } from 'react';
import { fetchWmsLayers } from '../services/qgis';

export default function useQgisLayers(baseUrl) {
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    fetchWmsLayers(baseUrl)
      .then(setLayers)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [baseUrl]);
  return { layers, loading, error };
}
