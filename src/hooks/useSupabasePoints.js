import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

function extractSubgrid(text) {
    if (!text) return '';
    const match = String(text).match(/N\d{2,3}E\d{2,3}/i);
    return match ? match[0].toUpperCase() : '';
}

const SAMPLE_PANOTRACK_POINTS = [
    { id: 101, subgrid: 'N90E67', filename: 'N90E67-0001.jpg', lat: 2.548550, lon: 102.815300, image_url: '/MMS_PIC/N90E67-0023.jpg', heading: 72.0, captured_at: '2026-06-20T10:01:00Z' },
    { id: 102, subgrid: 'N90E67', filename: 'N90E67-0002.jpg', lat: 2.548580, lon: 102.815450, image_url: '/MMS_PIC/N93E70-0002.jpg', heading: 72.0, captured_at: '2026-06-20T10:02:00Z' },
    { id: 103, subgrid: 'N90E67', filename: 'N90E67-0003.jpg', lat: 2.548610, lon: 102.815600, image_url: '/MMS_PIC/N93E70-0003.jpg', heading: 72.0, captured_at: '2026-06-20T10:03:00Z' },
    { id: 104, subgrid: 'N90E67', filename: 'N90E67-0004.jpg', lat: 2.548640, lon: 102.815720, image_url: '/MMS_PIC/N93E70-0013.jpg', heading: 72.0, captured_at: '2026-06-20T10:04:00Z' },
    { id: 105, subgrid: 'N90E67', filename: 'N90E67-0005.jpg', lat: 2.548660, lon: 102.815835, image_url: '/MMS_PIC/N93E70-0016.jpg', heading: 72.0, captured_at: '2026-06-20T10:05:00Z' },
    { id: 106, subgrid: 'N90E67', filename: 'N90E67-0006.jpg', lat: 2.548680, lon: 102.815960, image_url: '/MMS_PIC/N93E70-0025.jpg', heading: 72.0, captured_at: '2026-06-20T10:06:00Z' },
    { id: 107, subgrid: 'N90E67', filename: 'N90E67-0007.jpg', lat: 2.548700, lon: 102.816100, image_url: '/MMS_PIC/N93E70-0030.jpg', heading: 72.0, captured_at: '2026-06-20T10:07:00Z' },
    { id: 108, subgrid: 'N90E67', filename: 'N90E67-0008.jpg', lat: 2.548720, lon: 102.816240, image_url: '/MMS_PIC/N93E70-0035.jpg', heading: 72.0, captured_at: '2026-06-20T10:08:00Z' },
    { id: 109, subgrid: 'N90E67', filename: 'N90E67-0009.jpg', lat: 2.548740, lon: 102.816380, image_url: '/MMS_PIC/N93E70-0046.jpg', heading: 72.0, captured_at: '2026-06-20T10:09:00Z' },
    { id: 110, subgrid: 'N90E67', filename: 'N90E67-0010.jpg', lat: 2.548760, lon: 102.816520, image_url: '/MMS_PIC/N93E70-0054.jpg', heading: 72.0, captured_at: '2026-06-20T10:10:00Z' },
    { id: 1, subgrid: 'N94E70', filename: 'N94E70-0001.jpg', lat: 2.542421, lon: 102.807700, image_url: '/MMS_PIC/N93E70-0002.jpg', heading: 255.8, captured_at: '2026-06-20T10:05:00Z' },
    { id: 2, subgrid: 'N93E70', filename: 'N93E70-0001.jpg', lat: 2.542429, lon: 102.807800, image_url: '/MMS_PIC/N93E70-0003.jpg', heading: 255.7, captured_at: '2026-06-21T15:40:00Z' }
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
                        const cleanFn = (item.filename || '').replace(/^\/+/, '').replace(/^MMS_PIC\//i, '');

                        let imageUrl = item.image_url;
                        // Map relative paths or fallback URLs to local MMS_PIC image file if available
                        if (!imageUrl || imageUrl.endsWith('N93E70-0008.jpg')) {
                            if (cleanFn && cleanFn !== 'N93E70-0008.jpg') {
                                imageUrl = `/MMS_PIC/${cleanFn}`;
                            }
                        }
                        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                            imageUrl = `/MMS_PIC/${imageUrl.replace(/^MMS_PIC\//i, '')}`;
                        }

                        return {
                            ...item,
                            subgrid: (rawSubgrid || 'UNKNOWN').toUpperCase(),
                            lon: parseFloat(item.longitude ?? item.lon),
                            lat: parseFloat(item.latitude ?? item.lat),
                            defect_count: item.defect_count ?? item.defects ?? item.defectCount ?? 0,
                            qa_status: item.qa_status || '',
                            image_url: imageUrl || `/MMS_PIC/${cleanFn || 'N93E70-0002.jpg'}`
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