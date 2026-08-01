import os
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client
from datetime import datetime, timezone

class SupabaseSyncEngine:
    def __init__(self, db_config, supabase_url, service_role_key, table_name, timestamp_file="last_sync.txt"):
        self.db_config = db_config
        self.table_name = table_name
        self.timestamp_file = timestamp_file
        self.supabase: Client = create_client(supabase_url, service_role_key)

    def get_last_sync_time(self):
        if os.path.exists(self.timestamp_file):
            with open(self.timestamp_file, "r") as f:
                return f.read().strip()
        return "1970-01-01 00:00:00+00"

    def save_sync_time(self, sync_time):
        with open(self.timestamp_file, "w") as f:
            f.write(sync_time)

    def fetch_all_supabase_ids(self, batch_size=1000):
        all_ids = set()
        start = 0
        while True:
            res = (
                self.supabase.table(self.table_name)
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

    def run_sync(self):
        last_sync = self.get_last_sync_time()
        current_run_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S%z")

        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Fetch Local IDs
        cursor.execute("SELECT id FROM panoramas;")
        local_ids = set(row["id"] for row in cursor.fetchall())

        # 2. Fetch Supabase IDs
        supabase_ids = self.fetch_all_supabase_ids()

        # ---------------------------------------------------------
        # LOGIC 1: Deletions
        # ---------------------------------------------------------
        ids_to_delete = list(supabase_ids - local_ids)
        deleted_count = 0
        if ids_to_delete:
            for i in range(0, len(ids_to_delete), 500):
                batch = ids_to_delete[i:i + 500]
                self.supabase.table(self.table_name).delete().in_("id", batch).execute()
            deleted_count = len(ids_to_delete)

        # ---------------------------------------------------------
        # LOGIC 2: Incremental Sync & Restores
        # ---------------------------------------------------------
        missing_in_supabase = list(local_ids - supabase_ids)

        query = """
            SELECT 
                id, filename, image_url, bearing, pitch, roll, 
                captured_at, description, 
                ST_AsText(ST_Transform(geom, 4326)) AS geom,
                updated_at
            FROM panoramas
            WHERE updated_at > %s OR id = ANY(%s);
        """
        cursor.execute(query, (last_sync, missing_in_supabase if missing_in_supabase else [-1]))
        rows = cursor.fetchall()

        upserted_count = 0
        if rows:
            records_to_sync = []
            for row in rows:
                records_to_sync.append({
                    "id": row["id"],
                    "filename": row.get("filename") or row.get("image_url"),
                    "image_url": row.get("image_url") or row.get("filename"),
                    "bearing": float(row.get("bearing") or 0.0),
                    "pitch": float(row.get("pitch") or 0.0),
                    "roll": float(row.get("roll") or 0.0),
                    "captured_at": str(row["captured_at"]) if row.get("captured_at") else None,
                    "description": row.get("description") or "QGIS Plugin Sync",
                    "geom": row["geom"]
                })

            for i in range(0, len(records_to_sync), 500):
                batch = records_to_sync[i:i + 500]
                self.supabase.table(self.table_name).upsert(batch, on_conflict="id").execute()
            
            upserted_count = len(records_to_sync)

        self.save_sync_time(current_run_time)
        cursor.close()
        conn.close()

        return deleted_count, upserted_count