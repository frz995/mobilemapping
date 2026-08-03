import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

function extractSubgrid(text) {
  if (!text) return '';
  const match = String(text).match(/N\d{2,3}E\d{2,3}/i);
  return match ? match[0].toUpperCase() : '';
}

const SAMPLE_PANOTRACK_POINTS = [
  { id: 1, subgrid: 'N94E70', filename: 'N94E70-0001.jpg', lat: 2.542421, lon: 102.8077, image_url: 'https://pannellum.org/images/alma.jpg', heading: 255.8, captured_at: '2026-06-20T10:05:00Z' },
  { id: 2, subgrid: 'N93E70', filename: 'N93E70-0001.jpg', lat: 2.542429, lon: 102.8078, image_url: 'https://pannellum.org/images/cerro-toco-0.jpg', heading: 255.7, captured_at: '2026-06-21T15:40:00Z' },
  { id: 3, subgrid: 'N101E83', filename: 'N101E83-0012.jpg', lat: 2.542437, lon: 102.8078, image_url: 'https://pannellum.org/images/bma-0.jpg', heading: 254.6, captured_at: '2026-06-22T13:10:00Z' },
  { id: 4, subgrid: 'N101E84', filename: 'N101E84-0045.jpg', lat: 2.542449, lon: 102.8078, image_url: 'https://pannellum.org/images/alma.jpg', heading: 239.9, captured_at: '2026-06-23T09:20:00Z' },
  { id: 5, subgrid: 'N101E85', filename: 'N101E85-0089.jpg', lat: 2.542471, lon: 102.8078, image_url: 'https://pannellum.org/images/cerro-toco-0.jpg', heading: 209.8, captured_at: '2026-06-24T16:45:00Z' },
  { id: 6, subgrid: 'N101E86', filename: 'N101E86-0120.jpg', lat: 2.542498, lon: 102.8078, image_url: 'https://pannellum.org/images/bma-0.jpg', heading: 174.5, captured_at: '2026-06-25T11:15:00Z' },
  { id: 7, subgrid: 'N101E87', filename: 'N101E87-0155.jpg', lat: 2.542524, lon: 102.8078, image_url: 'https://pannellum.org/images/alma.jpg', heading: 171.2, captured_at: '2026-06-26T14:30:00Z' },
  { id: 8, subgrid: 'N101E88', filename: 'N101E88-0201.jpg', lat: 2.542552, lon: 102.8078, image_url: 'https://pannellum.org/images/cerro-toco-0.jpg', heading: 176.4, captured_at: '2026-06-27T16:00:00Z' },
  { id: 9, subgrid: 'N102E83', filename: 'N102E83-0050.jpg', lat: 2.542580, lon: 102.8078, image_url: 'https://pannellum.org/images/bma-0.jpg', heading: 179.6, captured_at: '2026-06-28T09:45:00Z' },
];

export function useSupabasePoints() {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchPoints() {
            try {
                setLoading(true);

                const { data, error: supabaseError } = await supabase
                    .from('panoramas_view')
                    .select('*');

                if (supabaseError || !data || data.length === 0) {
                    console.warn('Supabase returned no panotrack points, using default panotrack dataset.');
                    setPoints(SAMPLE_PANOTRACK_POINTS);
                } else {
                    const formattedPoints = data.map(item => {
                        const rawSubgrid = item.subgrid || extractSubgrid(item.filename || item.image_url || item.description);
                        return {
                            ...item,
                            subgrid: (rawSubgrid || 'UNKNOWN').toUpperCase(),
                            lon: item.longitude ?? item.lon,
                            lat: item.latitude ?? item.lat,
                            image_url: item.image_url?.startsWith('http')
                                ? item.image_url
                                : `${import.meta.env.VITE_IMAGE_BASE_URL || ''}${item.image_url || item.filename}`
                        };
                    });
                    setPoints(formattedPoints);
                }
            } catch (err) {
                console.error('Error fetching panoramas_view, falling back to sample points:', err);
                setPoints(SAMPLE_PANOTRACK_POINTS);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPoints();
    }, []);

    return { points, loading, error };
}