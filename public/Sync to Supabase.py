import csv
import os
from supabase import create_client, Client

# ==========================================
# CONFIGURATION
# ==========================================
SUPABASE_URL = "https://tqqybumedywzylujjkqa.supabase.co"

# ⚠️ IMPORTANT: Use your Service Role Key for administrative write access in backend scripts.
# You can find this in: Supabase Dashboard -> Project Settings -> API -> service_role secret
SUPABASE_SERVICE_ROLE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY"

# Path to your local metadata CSV file
CSV_FILE_PATH = "./metadata.csv" 

# Name of your Supabase table
TABLE_NAME = "panoramas"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def parse_and_sync():
    if not os.path.exists(CSV_FILE_PATH):
        print(f"❌ Error: Could not find CSV file at '{CSV_FILE_PATH}'")
        return

    records = []

    print(f"📖 Reading CSV metadata from: {CSV_FILE_PATH}...")

    with open(CSV_FILE_PATH, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        
        for row in reader:
            try:
                # Extract coordinates (Ensure your CSV header names match these!)
                lon = float(row.get("longitude") or row.get("lon") or row.get("x"))
                lat = float(row.get("latitude") or row.get("lat") or row.get("y"))
                
                filename = row.get("filename")
                
                # Construct record dictionary matching your database schema
                record = {
                    "filename": filename,
                    "image_url": row.get("image_url", filename), # Defaults to filename if image_url is empty
                    "bearing": float(row.get("bearing", 0.0)),
                    "pitch": float(row.get("pitch", 0.0)),
                    "roll": float(row.get("roll", 0.0)),
                    "captured_at": row.get("captured_at") or None,
                    "description": row.get("description", "Imported via Auto-Sync Script"),
                    # Convert Lon/Lat into PostGIS EWKT format for the 'geom' GEOMETRY column
                    "geom": f"SRID=4326;POINT({lon} {lat})"
                }
                
                records.append(record)
                
            except Exception as e:
                print(f"⚠️ Skipping row {row.get('filename', 'Unknown')}: Error parsing fields ({e})")

    if not records:
        print("⚠️ No valid records found to upload.")
        return

    print(f"🚀 Upserting {len(records)} records to Supabase table '{TABLE_NAME}'...")

    try:
        # Upsert: Inserts new rows or updates existing rows if 'filename' matches
        response = supabase.table(TABLE_NAME).upsert(
            records, 
            on_conflict="filename"
        ).execute()

        print("✅ Sync Complete! Your live WebGIS site has been updated.")
        
    except Exception as e:
        print(f"❌ Error syncing to Supabase: {e}")


if __name__ == "__main__":
    parse_and_sync()