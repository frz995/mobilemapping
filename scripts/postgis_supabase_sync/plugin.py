from qgis.PyQt.QtWidgets import QAction, QMessageBox
from qgis.PyQt.QtGui import QIcon
from qgis.core import Qgis, QgsMessageLog
from .sync_engine import SupabaseSyncEngine

class PostGISSupabaseSyncPlugin:
    def __init__(self, iface):
        self.iface = iface
        self.action = None

        # CONFIGURATION
        self.db_config = {
            "dbname": "360web",
            "user": "postgres",
            "password": "YOUR_LOCAL_PASSWORD",
            "host": "localhost",
            "port": "5432"
        }
        self.supabase_url = "https://tqqybumedywzylujjkqa.supabase.co"
        self.service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcXlidW1lZHl3enlsdWpqa3FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTM0NzU5MCwiZXhwIjoyMTAwOTIzNTkwfQ.hd6SjFHUvUK7889eTi_apzoijNT4cNOT7u9F2blAibs"
        self.table_name = "panoramas"

    def initGui(self):
        # Create action button in QGIS
        self.action = QAction("Sync PostGIS to Supabase", self.iface.mainWindow())
        self.action.triggered.connect(self.run)
        
        # Add button to QGIS Plugins Menu & Toolbar
        self.iface.addPluginToVectorMenu("&PostGIS Supabase Sync", self.action)
        self.iface.addVectorToolBarIcon(self.action)

    def unload(self):
        # Remove button when plugin is disabled
        self.iface.removePluginVectorMenu("&PostGIS Supabase Sync", self.action)
        self.iface.removeVectorToolBarIcon(self.action)

    def run(self):
        # Interactive confirmation dialog box in QGIS
        reply = QMessageBox.question(
            self.iface.mainWindow(),
            'Confirm Sync',
            'Do you want to synchronize local PostGIS edits and update to Supabase?',
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            try:
                self.iface.messageBar().pushMessage(
                    "Syncing...", "Running PostGIS to Supabase synchronization...", 
                    level=Qgis.Info, duration=3
                )

                engine = SupabaseSyncEngine(
                    self.db_config, 
                    self.supabase_url, 
                    self.service_role_key, 
                    self.table_name
                )
                deleted, upserted = engine.run_sync()

                # Success Notification
                self.iface.messageBar().pushMessage(
                    "Sync Complete!", 
                    f"Successfully synced! Updated/Restored: {upserted} | Deleted: {deleted}", 
                    level=Qgis.Success, duration=5
                )

            except Exception as e:
                self.iface.messageBar().pushMessage(
                    "Sync Error", f"Failed to sync: {str(e)}", 
                    level=Qgis.Critical, duration=5
                )