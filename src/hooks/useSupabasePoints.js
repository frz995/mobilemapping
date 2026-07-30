import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

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

                if (supabaseError) throw supabaseError;

                const formattedPoints = data.map(item => ({
                    ...item,
                    lon: item.longitude,
                    lat: item.latitude,
                    image_url: item.image_url?.startsWith('http')
                        ? item.image_url
                        : `${import.meta.env.VITE_IMAGE_BASE_URL}${item.image_url || item.filename}`
                }));

                setPoints(formattedPoints);
            } catch (err) {
                console.error('Error fetching panoramas_view:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPoints();
    }, []);

    return { points, loading, error };
}