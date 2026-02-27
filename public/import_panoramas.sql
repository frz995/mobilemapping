-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create table for panoramas
CREATE TABLE IF NOT EXISTS public.panoramas (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE,
    geom GEOMETRY(Point, 4326),
    image_url TEXT,
    bearing FLOAT,
    pitch FLOAT,
    roll FLOAT,
    captured_at TIMESTAMP,
    description TEXT
);

-- Ensure unique constraint on filename exists (safe migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'panoramas_filename_key') THEN
        ALTER TABLE public.panoramas ADD CONSTRAINT panoramas_filename_key UNIQUE (filename);
    END IF;
END;
$$;


-- Insert data from CSV (Upsert: Update if exists, Insert if new)
INSERT INTO public.panoramas (filename, geom, image_url, bearing, pitch, roll, captured_at, description) VALUES
('N93E70-0116.jpg', ST_SetSRID(ST_MakePoint(102.8254, 2.55844), 4326), 'N93E70-0116.jpg', 109.1245, 0, 0, '4/9/2022 46:10.5', 'Imported from CSV'),
('N93E70-0117.jpg', ST_SetSRID(ST_MakePoint(102.8254265, 2.55843082), 4326), 'N93E70-0117.jpg', 109.1012, 0, 0, '4/9/2022 46:11.8', 'Imported from CSV'),
('N93E70-0118.jpg', ST_SetSRID(ST_MakePoint(102.8254531, 2.55842163), 4326), 'N93E70-0118.jpg', 109.1434, 0, 0, '4/9/2022 46:13.2', 'Imported from CSV'),
('N93E70-0119.jpg', ST_SetSRID(ST_MakePoint(102.8254796, 2.55841245), 4326), 'N93E70-0119.jpg', 109.0856, 0, 0, '4/9/2022 46:14.5', 'Imported from CSV'),
('N93E70-0120.jpg', ST_SetSRID(ST_MakePoint(102.8255061, 2.55840327), 4326), 'N93E70-0120.jpg', 109.1121, 0, 0, '4/9/2022 46:15.9', 'Imported from CSV'),
('N93E70-0121.jpg', ST_SetSRID(ST_MakePoint(102.8255327, 2.55839408), 4326), 'N93E70-0121.jpg', 109.1387, 0, 0, '4/9/2022 46:17.4', 'Imported from CSV'),
('N93E70-0122.jpg', ST_SetSRID(ST_MakePoint(102.8255592, 2.5583849), 4326), 'N93E70-0122.jpg', 109.0945, 0, 0, '4/9/2022 46:18.8', 'Imported from CSV'),
('N93E70-0123.jpg', ST_SetSRID(ST_MakePoint(102.8255857, 2.55837571), 4326), 'N93E70-0123.jpg', 109.0712, 0, 0, '4/9/2022 46:20.1', 'Imported from CSV'),
('N93E70-0124.jpg', ST_SetSRID(ST_MakePoint(102.8256122, 2.55836653), 4326), 'N93E70-0124.jpg', 109.1154, 0, 0, '4/9/2022 46:21.5', 'Imported from CSV'),
('N93E70-0125.jpg', ST_SetSRID(ST_MakePoint(102.8256388, 2.55835735), 4326), 'N93E70-0125.jpg', 109.1401, 0, 0, '4/9/2022 46:22.9', 'Imported from CSV'),
('N93E70-0126.jpg', ST_SetSRID(ST_MakePoint(102.8256653, 2.55834816), 4326), 'N93E70-0126.jpg', 109.0889, 0, 0, '4/9/2022 46:24.2', 'Imported from CSV'),
('N93E70-0127.jpg', ST_SetSRID(ST_MakePoint(102.8256918, 2.55833898), 4326), 'N93E70-0127.jpg', 109.1023, 0, 0, '4/9/2022 46:25.6', 'Imported from CSV'),
('N93E70-0128.jpg', ST_SetSRID(ST_MakePoint(102.8257184, 2.55832979), 4326), 'N93E70-0128.jpg', 109.1345, 0, 0, '4/9/2022 46:27.0', 'Imported from CSV'),
('N93E70-0129.jpg', ST_SetSRID(ST_MakePoint(102.8257449, 2.55832061), 4326), 'N93E70-0129.jpg', 109.1102, 0, 0, '4/9/2022 46:28.3', 'Imported from CSV'),
('N93E70-0130.jpg', ST_SetSRID(ST_MakePoint(102.8257714, 2.55831143), 4326), 'N93E70-0130.jpg', 109.0767, 0, 0, '4/9/2022 46:29.7', 'Imported from CSV'),
('N93E70-0131.jpg', ST_SetSRID(ST_MakePoint(102.825798, 2.55830224), 4326), 'N93E70-0131.jpg', 109.0911, 0, 0, '4/9/2022 46:31.2', 'Imported from CSV'),
('N93E70-0132.jpg', ST_SetSRID(ST_MakePoint(102.8258245, 2.55829306), 4326), 'N93E70-0132.jpg', 109.1256, 0, 0, '4/9/2022 46:32.5', 'Imported from CSV'),
('N93E70-0133.jpg', ST_SetSRID(ST_MakePoint(102.825851, 2.55828388), 4326), 'N93E70-0133.jpg', 109.1489, 0, 0, '4/9/2022 46:33.9', 'Imported from CSV'),
('N93E70-0134.jpg', ST_SetSRID(ST_MakePoint(102.8258776, 2.55827469), 4326), 'N93E70-0134.jpg', 109.1034, 0, 0, '4/9/2022 46:35.3', 'Imported from CSV'),
('N93E70-0135.jpg', ST_SetSRID(ST_MakePoint(102.8259041, 2.55826551), 4326), 'N93E70-0135.jpg', 109.0812, 0, 0, '4/9/2022 46:36.7', 'Imported from CSV'),
('N93E70-0136.jpg', ST_SetSRID(ST_MakePoint(102.8259306, 2.55825633), 4326), 'N93E70-0136.jpg', 109.1145, 0, 0, '4/9/2022 46:38.2', 'Imported from CSV'),
('N93E70-0137.jpg', ST_SetSRID(ST_MakePoint(102.8259571, 2.55824714), 4326), 'N93E70-0137.jpg', 109.1398, 0, 0, '4/9/2022 46:39.6', 'Imported from CSV'),
('N93E70-0138.jpg', ST_SetSRID(ST_MakePoint(102.8259837, 2.55823796), 4326), 'N93E70-0138.jpg', 109.0954, 0, 0, '4/9/2022 46:41.0', 'Imported from CSV'),
('N93E70-0139.jpg', ST_SetSRID(ST_MakePoint(102.8260102, 2.55822877), 4326), 'N93E70-0139.jpg', 109.0721, 0, 0, '4/9/2022 46:42.4', 'Imported from CSV'),
('N93E70-0140.jpg', ST_SetSRID(ST_MakePoint(102.8260367, 2.55821959), 4326), 'N93E70-0140.jpg', 109.1065, 0, 0, '4/9/2022 46:43.9', 'Imported from CSV'),
('N93E70-0141.jpg', ST_SetSRID(ST_MakePoint(102.8260633, 2.55821041), 4326), 'N93E70-0141.jpg', 109.1312, 0, 0, '4/9/2022 46:45.3', 'Imported from CSV'),
('N93E70-0142.jpg', ST_SetSRID(ST_MakePoint(102.8260898, 2.55820122), 4326), 'N93E70-0142.jpg', 109.0878, 0, 0, '4/9/2022 46:46.8', 'Imported from CSV'),
('N93E70-0143.jpg', ST_SetSRID(ST_MakePoint(102.8261163, 2.55819204), 4326), 'N93E70-0143.jpg', 109.0645, 0, 0, '4/9/2022 46:48.2', 'Imported from CSV'),
('N93E70-0144.jpg', ST_SetSRID(ST_MakePoint(102.8261429, 2.55818286), 4326), 'N93E70-0144.jpg', 109.0989, 0, 0, '4/9/2022 46:49.6', 'Imported from CSV'),
('N93E70-0145.jpg', ST_SetSRID(ST_MakePoint(102.8261694, 2.55817367), 4326), 'N93E70-0145.jpg', 109.1234, 0, 0, '4/9/2022 46:51.1', 'Imported from CSV'),
('N93E70-0146.jpg', ST_SetSRID(ST_MakePoint(102.8261959, 2.55816449), 4326), 'N93E70-0146.jpg', 109.0811, 0, 0, '4/9/2022 46:52.5', 'Imported from CSV'),
('N93E70-0147.jpg', ST_SetSRID(ST_MakePoint(102.8262225, 2.55815531), 4326), 'N93E70-0147.jpg', 109.0578, 0, 0, '4/9/2022 46:53.9', 'Imported from CSV'),
('N93E70-0148.jpg', ST_SetSRID(ST_MakePoint(102.826249, 2.55814612), 4326), 'N93E70-0148.jpg', 109.0911, 0, 0, '4/9/2022 46:55.3', 'Imported from CSV'),
('N93E70-0149.jpg', ST_SetSRID(ST_MakePoint(102.8262755, 2.55813694), 4326), 'N93E70-0149.jpg', 109.1156, 0, 0, '4/9/2022 46:56.7', 'Imported from CSV'),
('N93E70-0150.jpg', ST_SetSRID(ST_MakePoint(102.826302, 2.55812776), 4326), 'N93E70-0150.jpg', 109.0721, 0, 0, '4/9/2022 46:58.2', 'Imported from CSV'),
('N93E70-0151.jpg', ST_SetSRID(ST_MakePoint(102.8263286, 2.55811857), 4326), 'N93E70-0151.jpg', 109.0498, 0, 0, '4/9/2022 46:59.6', 'Imported from CSV'),
('N93E70-0152.jpg', ST_SetSRID(ST_MakePoint(102.8263551, 2.55810939), 4326), 'N93E70-0152.jpg', 109.0832, 0, 0, '4/9/2022 47:01.0', 'Imported from CSV'),
('N93E70-0153.jpg', ST_SetSRID(ST_MakePoint(102.8263816, 2.5581002), 4326), 'N93E70-0153.jpg', 109.1089, 0, 0, '4/9/2022 47:02.4', 'Imported from CSV'),
('N93E70-0154.jpg', ST_SetSRID(ST_MakePoint(102.8264082, 2.55809102), 4326), 'N93E70-0154.jpg', 109.0654, 0, 0, '4/9/2022 47:03.9', 'Imported from CSV'),
('N93E70-0155.jpg', ST_SetSRID(ST_MakePoint(102.8264347, 2.55808184), 4326), 'N93E70-0155.jpg', 109.0421, 0, 0, '4/9/2022 47:05.3', 'Imported from CSV'),
('N93E70-0156.jpg', ST_SetSRID(ST_MakePoint(102.8264612, 2.55807265), 4326), 'N93E70-0156.jpg', 109.0756, 0, 0, '4/9/2022 47:06.8', 'Imported from CSV'),
('N93E70-0157.jpg', ST_SetSRID(ST_MakePoint(102.8264878, 2.55806347), 4326), 'N93E70-0157.jpg', 109.0998, 0, 0, '4/9/2022 47:08.2', 'Imported from CSV'),
('N93E70-0158.jpg', ST_SetSRID(ST_MakePoint(102.8265143, 2.55805429), 4326), 'N93E70-0158.jpg', 109.0567, 0, 0, '4/9/2022 47:09.6', 'Imported from CSV'),
('N93E70-0159.jpg', ST_SetSRID(ST_MakePoint(102.8265408, 2.5580451), 4326), 'N93E70-0159.jpg', 109.0345, 0, 0, '4/9/2022 47:11.1', 'Imported from CSV'),
('N93E70-0160.jpg', ST_SetSRID(ST_MakePoint(102.8265674, 2.55803592), 4326), 'N93E70-0160.jpg', 109.0678, 0, 0, '4/9/2022 47:12.5', 'Imported from CSV'),
('N93E70-0161.jpg', ST_SetSRID(ST_MakePoint(102.8265939, 2.54802673), 4326), 'N93E70-0161.jpg', 109.0911, 0, 0, '4/9/2022 47:13.9', 'Imported from CSV'),
('N93E70-0162.jpg', ST_SetSRID(ST_MakePoint(102.8266204, 2.55801755), 4326), 'N93E70-0162.jpg', 109.0492, 0, 0, '4/9/2022 47:15.3', 'Imported from CSV'),
('N93E70-0163.jpg', ST_SetSRID(ST_MakePoint(102.8266469, 2.55800837), 4326), 'N93E70-0163.jpg', 109.0267, 0, 0, '4/9/2022 47:16.8', 'Imported from CSV'),
('N93E70-0164.jpg', ST_SetSRID(ST_MakePoint(102.8266735, 2.55799918), 4326), 'N93E70-0164.jpg', 109.0598, 0, 0, '4/9/2022 47:18.2', 'Imported from CSV'),
('N93E70-0165.jpg', ST_SetSRID(ST_MakePoint(102.8267, 2.55799), 4326), 'N93E70-0165.jpg', 109.0845, 0, 0, '4/9/2022 47:19.6', 'Imported from CSV')
ON CONFLICT (filename) DO UPDATE SET
        geom = EXCLUDED.geom,
        image_url = EXCLUDED.image_url,
        bearing = EXCLUDED.bearing,
        pitch = EXCLUDED.pitch,
        roll = EXCLUDED.roll,
        captured_at = EXCLUDED.captured_at,
        description = EXCLUDED.description;