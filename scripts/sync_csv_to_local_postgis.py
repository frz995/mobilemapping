import os
import csv
import psycopg2
from psycopg2.extras import RealDictCursor

LOCAL_DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "360web"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "YOUR_LOCAL_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432")
}

def insert_rows_to_local_postgis(rows_data):
    """
    Inserts a list of dicts with keys: filename, lat, lon, heading/bearing, pitch, roll, date
    into local PostgreSQL/PostGIS 'panoramas' table.
    """
    conn = psycopg2.connect(**LOCAL_DB_CONFIG)
    cursor = conn.cursor()
    
    query = """
        INSERT INTO panoramas (filename, image_url, bearing, pitch, roll, captured_at, description, geom, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), NOW())
        ON CONFLICT (filename) DO UPDATE SET
            bearing = EXCLUDED.bearing,
            pitch = EXCLUDED.pitch,
            roll = EXCLUDED.roll,
            geom = EXCLUDED.geom,
            updated_at = NOW()
        RETURNING id, filename, ST_AsText(geom) as wkt;
    """
    
    success_count = 0
    for r in rows_data:
        filename = r.get("filename")
        if not filename:
            continue
        lat = float(r.get("latitude") or r.get("lat") or 2.5389)
        lon = float(r.get("longitude") or r.get("lon") or r.get("lng") or 102.805)
        bearing = float(r.get("heading") or r.get("bearing") or 16.2)
        pitch = float(r.get("pitch") or 0.0)
        roll = float(r.get("roll") or 0.0)
        captured_at = r.get("date") or "2022-09-04 00:43:00"
        desc = f"Imported via Processing Dashboard ({filename})"
        
        cursor.execute(query, (filename, filename, bearing, pitch, roll, captured_at, desc, lon, lat))
        conn.commit()
        success_count += 1

    cursor.close()
    conn.close()
    print(f"Successfully inserted/updated {success_count} row(s) in local PostGIS 'panoramas' table!")

if __name__ == "__main__":
    print("Local PostGIS batch insert helper ready.")
