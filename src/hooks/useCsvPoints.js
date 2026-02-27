import { useEffect, useState } from 'react';
import { fetchCsv } from '../services/csv';

export default function useCsvPoints(csvUrl) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!csvUrl) return;
    setLoading(true);
    setError(null);
    fetchCsv(csvUrl)
      .then(setPoints)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [csvUrl]);
  return { points, loading, error };
}
