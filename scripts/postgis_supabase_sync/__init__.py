def classFactory(iface):
    from .plugin import PostGISSupabaseSyncPlugin
    return PostGISSupabaseSyncPlugin(iface)