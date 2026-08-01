import os
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client
from datetime import datetime, timezone

# ==========================================
# CONFIGURATION
# ==========================================
LOCAL_DB_CONFIG = {
    "dbname": "360web",    # Replace with your local database name
    "user": "postgres",                # Replace with your postgres username
    "password": "Skrillex95!", # Replace with your postgres password
    "host": "localhost",
    "port": "5432"
}

SUPABASE_URL = "https://tqqybumedywzylujjkqa.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcXlidW1lZHl3enlsdWpqa3FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTM0NzU5MCwiZXhwIjoyMTAwOTIzNTkwfQ.hd6SjFHUvUK7889eTi_apzoijNT4cNOT7u9F2blAibs" # Replace with service role key
SUPABASE_TABLE = "panoramas"

# File name used to store the last sync timestamp
SYNC_TIMESTAMP_FILE = "last_sync.txt"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_last_sync_time():
    """Reads the last sync timestamp from a file, or defaults to epoch."""
    if os.path.exists(SYNC_TIMESTAMP_FILE):
        with open(SYNC_TIMESTAMP_FILE, "r") as f:
            return f.read().strip()
    return "1970-01-01 00:00:00+00"


def save_current_sync_time(sync_time):
    """Saves execution timestamp to file."""
    with open(SYNC_TIMESTAMP_FILE, "w") as f:
        f.write(sync_time)


def fetch_all_supabase_ids(batch_size=1000):
    """Safely retrieves ALL primary key IDs from Supabase using pagination."""
    all_ids = set()
    start = 0

    while True:
        res = (
            supabase.table(SUPABASE_TABLE)
            .select("id")
            .range(start, start + batch_size - 1)
            .execute()
        )
        data = res.data
        if not data:
            break

        for row in data:
            all_ids.add(row["id"])

        if len(data) < batch_size:
            break

        start += batch_size

    return all_ids


def run_full_sync():
    last_sync = get_last_sync_time()
    current_run_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S%z")

    try:
        print("🔌 Connecting to local PostGIS database...")
        conn = psycopg2.connect(**LOCAL_DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Fetch all active IDs locally
        cursor.execute("SELECT id FROM panoramas;")
        local_ids = set(row["id"] for row in cursor.fetchall())

        # Fetch all active IDs in Supabase
        print("🔍 Querying Supabase record IDs...")
        supabase_ids = fetch_all_supabase_ids()

        print(f"📊 Total Local PostGIS Rows: {len(local_ids)}")
        print(f"📊 Total Supabase Rows:     {len(supabase_ids)}")

        # -------------------------------------------------------------
        # LOGIC 1: RECONCILE DIFFERENCES & SYNC DELETIONS
        # -------------------------------------------------------------
        print("\n--- syncing: Reconciling State Differences ---")
        
        # 1A. Items deleted locally in PostGIS but present on Supabase
        ids_to_delete = list(supabase_ids - local_ids)
        if ids_to_delete:
            print(f"🗑️ Found {len(ids_to_delete)} deleted record(s) in local PostGIS. Removing from Supabase...")
            for i in range(0, len(ids_to_delete), 500):
                batch = ids_to_delete[i:i + 500]
                supabase.table(SUPABASE_TABLE).delete().in_("id", batch).execute()
            print(f"✅ Successfully deleted {len(ids_to_delete)} record(s) from Supabase.")
        else:
            print("✨ No local deletions to mirror.")

        # 1B. Items missing from Supabase but existing locally
        missing_in_supabase = list(local_ids - supabase_ids)
        if missing_in_supabase:
            print(f"⚠️ Found {len(missing_in_supabase)} record(s) missing from Supabase. Flagged for updated!")

        # -------------------------------------------------------------
        # LOGIC 2: SYNC LATEST UPDATED METADATA & MISSING ROWS
        # -------------------------------------------------------------
        print("\n--- syncing: Incremental Delta & Restore Sync ---")
        print(f"🔍 Fetching changes updated since: {last_sync}")

        # Fetch rows updated after last_sync OR rows missing in Supabase
        query = """
            SELECT 
                id,
                filename, 
                image_url, 
                bearing, pitch, roll, 
                captured_at, description, 
                ST_AsText(ST_Transform(geom, 4326)) AS geom,
                updated_at
            FROM panoramas
            WHERE updated_at > %s OR id = ANY(%s);
        """
        
        cursor.execute(query, (last_sync, missing_in_supabase if missing_in_supabase else [-1]))
        rows = cursor.fetchall()

        if rows:
            print(f"⚡ Found {len(rows)} record(s) to insert/update on Supabase...")

            records_to_sync = []
            for row in rows:
                record = {
                    "id": row["id"],
                    "filename": row.get("filename") or row.get("image_url"),
                    "image_url": row.get("image_url") or row.get("filename"),
                    "bearing": float(row.get("bearing") or 0.0),
                    "pitch": float(row.get("pitch") or 0.0),
                    "roll": float(row.get("roll") or 0.0),
                    "captured_at": str(row["captured_at"]) if row.get("captured_at") else None,
                    "description": row.get("description") or "Incremental Sync",
                    "geom": row["geom"]
                }
                records_to_sync.append(record)

            # Batch upsert to Supabase
            for i in range(0, len(records_to_sync), 500):
                batch = records_to_sync[i:i + 500]
                supabase.table(SUPABASE_TABLE).upsert(batch, on_conflict="id").execute()

            print(f"✅ Upsert successful for {len(records_to_sync)} record(s)!")
        else:
            print("✨ No updated or missing records found.")

        # Save latest sync time
        save_current_sync_time(current_run_time)

        cursor.close()
        conn.close()
        print("\n🚀 Full Sync Complete!")

    except Exception as e:
        print(f"❌ Sync failed: {e}")


if __name__ == "__main__":
    run_full_sync()