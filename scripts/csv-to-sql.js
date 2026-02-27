import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// --- DATABASE CONFIGURATION ---
const DB_CONFIG = {
  user: 'postgres',
  host: 'localhost',
  database: '360web', // Ensure this matches your PostGIS database name
  password: 'Skrillex95!',
  port: 5432,
};
// ------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const outputPath = path.resolve(__dirname, '../public/import_panoramas.sql');

// Find the latest CSV file in the public folder
const files = fs.readdirSync(publicDir)
  .filter(file => file.toLowerCase().endsWith('.csv'))
  .map(file => {
    const filePath = path.join(publicDir, file);
    return {
      name: file,
      path: filePath,
      time: fs.statSync(filePath).mtime.getTime()
    };
  })
  .sort((a, b) => b.time - a.time); // Sort by time (newest first)

if (files.length === 0) {
  console.error(`No CSV files found in: ${publicDir}`);
  process.exit(1);
}

const latestCsv = files[0];
console.log(`\nFound ${files.length} CSV files.`);
console.log(`Using the latest file: "${latestCsv.name}" (Last modified: ${new Date(latestCsv.time).toLocaleString()})`);

const csvContent = fs.readFileSync(latestCsv.path, 'utf8');

Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const rows = results.data;
    if (rows.length === 0) {
      console.log('No data found in CSV.');
      return;
    }

    const sqlLines = [];

    // 0. Enable PostGIS Extension
    sqlLines.push(`-- Enable PostGIS extension if not already enabled`);
    sqlLines.push(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    sqlLines.push('');

    // 1. Create Table Statement
    sqlLines.push(`-- Create table for panoramas`);
    sqlLines.push(`CREATE TABLE IF NOT EXISTS public.panoramas (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE,
    geom GEOMETRY(Point, 4326),
    image_url TEXT,
    bearing FLOAT,
    pitch FLOAT,
    roll FLOAT,
    captured_at TIMESTAMP,
    description TEXT
);`);
    
    // Ensure Unique Constraint exists (for existing tables)
    sqlLines.push(`
-- Ensure unique constraint on filename exists (safe migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'panoramas_filename_key') THEN
        ALTER TABLE public.panoramas ADD CONSTRAINT panoramas_filename_key UNIQUE (filename);
    END IF;
END;
$$;
`);
    sqlLines.push('');

    // 2. Insert Statements
    sqlLines.push(`-- Insert data from CSV (Upsert: Update if exists, Insert if new)`);
    sqlLines.push(`INSERT INTO public.panoramas (filename, geom, image_url, bearing, pitch, roll, captured_at, description) VALUES`);

    // Deduplicate rows by filename (last one wins)
    const uniqueRows = new Map();
    rows.forEach(row => {
      const filename = row.filename || '';
      if (filename) {
        uniqueRows.set(filename, row);
      }
    });

    const values = Array.from(uniqueRows.values())
      .map(row => {
      // Map CSV headers to DB columns
      // CSV: filename, latitude, longitude, roll, pitch, heading, date, time
      const filename = row.filename || '';
      const lat = parseFloat(row.latitude || row.lat || 0);
      const lon = parseFloat(row.longitude || row.lon || 0);
      const heading = parseFloat(row.heading || row.bearing || 0);
      const pitch = parseFloat(row.pitch || 0);
      const roll = parseFloat(row.roll || 0);
      
      // Construct captured_at
      let captured_at = 'NULL';
      if (row.date && row.time) {
        // Simply escape single quotes if any
        const dt = `${row.date} ${row.time}`.replace(/'/g, "''");
        captured_at = `'${dt}'`;
      }

      // Construct image_url base
      // Escape filename for SQL
      const safeFilename = filename.replace(/'/g, "''");
      const image_url = safeFilename;

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lon)) return null;

      return `('${safeFilename}', ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), '${image_url}', ${heading}, ${pitch}, ${roll}, ${captured_at}, 'Imported from CSV')`;
    })
    .filter(v => v !== null);

    if (values.length > 0) {
      // Fix join syntax: values array items are individual row tuples
      sqlLines.push(values.join(',\n'));
      
      // Add ON CONFLICT clause for Upsert
      sqlLines.push(`ON CONFLICT (filename) DO UPDATE SET
        geom = EXCLUDED.geom,
        image_url = EXCLUDED.image_url,
        bearing = EXCLUDED.bearing,
        pitch = EXCLUDED.pitch,
        roll = EXCLUDED.roll,
        captured_at = EXCLUDED.captured_at,
        description = EXCLUDED.description;`);
      
      // Write to file
      fs.writeFileSync(outputPath, sqlLines.join('\n'));
      console.log(`Successfully generated SQL script at: ${outputPath}`);
      // --- AUTOMATION ---
      console.log(`\n--- AUTOMATION ---`);
      console.log(`Attempting to execute SQL script in PostGIS (DB: ${DB_CONFIG.database})...`);
      
      // Update this path if your PostgreSQL version is different!
      const psqlPath = `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"`;
      
      const psqlCommand = `${psqlPath} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -f "${outputPath}"`;

      exec(psqlCommand, {
        env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`\n[ERROR] Failed to execute SQL automatically.`);
          console.error(`Error details: ${error.message}`);
          console.log(`\nTroubleshooting:`);
          console.log(`1. Make sure "psql" is installed and in your system PATH.`);
          console.log(`2. Check if database "${DB_CONFIG.database}" exists.`);
          console.log(`3. Verify the password in this script.`);
          console.log(`\nYou can still run the SQL manually: psql -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -f "${outputPath}"`);
          return;
        }

        if (stderr) {
          // psql outputs notices to stderr, which is normal
          console.log(`\n[PSQL Output]:\n${stderr}`);
        }
        if (stdout) {
          console.log(stdout);
        }
        
        console.log(`\n[SUCCESS] Data successfully imported/updated in PostGIS!`);
        console.log(`You can refresh your web map to see the changes.`);
      });
      
    } else {
      console.log('No valid rows to generate SQL.');
    }
  }
});
