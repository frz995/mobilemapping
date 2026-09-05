import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

function extractSubgrid(text) {
    if (!text) return '';
    const match = String(text).match(/Nd{2,3}Ed{2,3}/i);
    return match ? match[0].toUpperCase() : '';
}

export function useSupabasePoints() {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchPoints() {
            try {
                setLoading(true);

                let sourceData = [];

                // 1. Primary query: panoramas_view
                const { data: viewData, error: viewError } = await supabase
                    .from('panoramas_view')
                    .select('*')
                    .order('filename', { ascending: true });

                if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
                    sourceData = viewData;
                } else {
                    if (viewError) console.warn('[useSupabasePoints] panoramas_view notice:', viewError.message);
                    // 2. Resilient Fallback: direct query to panoramas table
                    const { data: tableData, error: tableError } = await supabase
                        .from('panoramas')
                        .select('*')
                        .order('filename', { ascending: true });

                    if (!tableError && Array.isArray(tableData) && tableData.length > 0) {
                        console.info('[useSupabasePoints] Successfully retrieved points from fallback panoramas table. Count:', tableData.length);
                        sourceData = tableData.map(row => {
                            let lon = row.longitude ?? row.lon;
                            let lat = row.latitude ?? row.lat;
                            if ((lon == null || lat == null) && Array.isArray(row.coordinates) && row.coordinates.length >= 2) {
                                lon = row.coordinates[0];
                                lat = row.coordinates[1];
                            } else if ((lon == null || lat == null) && row.geom?.coordinates && Array.isArray(row.geom.coordinates)) {
                                lon = row.geom.coordinates[0];
                                lat = row.geom.coordinates[1];
                            }
                            return {
                                ...row,
                                longitude: lon,
                                latitude: lat,
                                lon,
                                lat
                            };
                        });
                    } else if (tableError) {
                        console.error('[useSupabasePoints] panoramas table fallback error:', tableError.message);
                    }
                }

                let qaMap = new Map();
                try {
                    const { data: qaData } = await supabase.from('qa_defects').select('*');
                    if (qaData && qaData.length > 0) {
                        qaData.forEach(q => {
                            const k = (q.item_key || q.filename || '').replace(/^.*[\\\/]/, '').toUpperCase();
                            if (k) qaMap.set(k, q);
                        });
                    }
                } catch (e) {
                    console.warn('qa_defects fetch notice:', e);
                }

                if (!sourceData || sourceData.length === 0) {
                    setPoints([]);
                } else {
                    const formattedPoints = sourceData.map(item => {
                        const rawSubgrid = item.subgrid || extractSubgrid(item.filename || item.image_url || item.description);
                        const cleanFn = (item.filename || '').replace(/^\/+/, '').replace(/^MMS_PIC\//i, '');
                        const cleanFnUpper = cleanFn.toUpperCase();
                        const qaRecord = qaMap.get(cleanFnUpper);

                        const isQaDefect = qaRecord && (
                            qaRecord.qa_status === 'flagged' ||
                            (qaRecord.defect_flags && typeof qaRecord.defect_flags === 'object' && Object.values(qaRecord.defect_flags).some(Boolean)) ||
                            (qaRecord.defect_count && Number(qaRecord.defect_count) > 0)
                        );

                        let imageUrl = item.image_url || (cleanFn ? `/MMS_PIC/${cleanFn}` : '');
                        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                            imageUrl = `/MMS_PIC/${imageUrl.replace(/^MMS_PIC\//i, '')}`;
                        }

                        const isDefect = Boolean(
                            item.is_defect === true ||
                            item.is_defect === 1 ||
                            isQaDefect ||
                            (typeof item.is_defect === 'string' && item.is_defect.toLowerCase() === 'true') ||
                            (item.defect_count && Number(item.defect_count) > 0) ||
                            (item.defects && Number(item.defects) > 0) ||
                            (typeof item.qa_status === 'string' && (
                                item.qa_status.toLowerCase().includes('flag') ||
                                item.qa_status.toLowerCase().includes('defect')
                            ))
                        );

                        return {
                            ...item,
                            subgrid: (rawSubgrid || '').toUpperCase(),
                            lon: parseFloat(item.longitude ?? item.lon),
                            lat: parseFloat(item.latitude ?? item.lat),
                            is_defect: isDefect,
                            defect_count: isDefect ? Math.max(1, item.defect_count || 1) : 0,
                            qa_status: isDefect ? 'flagged' : (item.qa_status || 'published'),
                            image_url: imageUrl || (cleanFn ? `/MMS_PIC/${cleanFn}` : '')
                        };
                    });

                    // Continuous Road Track Sorter (< 35m step) to prevent 150m jumps across road branches
                    const sortGeographicallyByRoadTrack = (pts) => {
                        if (!pts || pts.length <= 1) return pts;
                        const remaining = [...pts];
                        remaining.sort((a, b) => {
                            const getSeqNum = (item) => {
                                const fn = item.filename || item.image_url || '';
                                const m = String(fn).match(/-(\d+)\./);
                                return m ? parseInt(m[1], 10) : (item.id || 0);
                            };
                            return getSeqNum(a) - getSeqNum(b);
                        });

                        const result = [];
                        let current = remaining.shift();
                        result.push(current);

                        while (remaining.length > 0) {
                            const curLat = parseFloat(current.lat ?? current.latitude ?? 0);
                            const curLon = parseFloat(current.lon ?? current.longitude ?? current.lng ?? 0);

                            let nearestIdx = -1;
                            let minRoadDist = Infinity;

                            for (let i = 0; i < remaining.length; i++) {
                                const p = remaining[i];
                                const pLat = parseFloat(p.lat ?? p.latitude ?? 0);
                                const pLon = parseFloat(p.lon ?? p.longitude ?? p.lng ?? 0);

                                const dLat = (pLat - curLat) * 111000;
                                const dLon = (pLon - curLon) * 111000 * Math.cos(curLat * Math.PI / 180);
                                const distMeters = Math.sqrt(dLat * dLat + dLon * dLon);

                                if (distMeters <= 35) {
                                    if (distMeters < minRoadDist) {
                                        minRoadDist = distMeters;
                                        nearestIdx = i;
                                    }
                                }
                            }

                            if (nearestIdx !== -1) {
                                current = remaining.splice(nearestIdx, 1)[0];
                            } else {
                                current = remaining.shift();
                            }
                            result.push(current);
                        }

                        return result;
                    };

                    setPoints(sortGeographicallyByRoadTrack(formattedPoints));
                }
            } catch (err) {
                console.error('Error fetching panoramas data:', err);
                setPoints([]);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPoints();
    }, []);

    return { points, loading, error };
}
