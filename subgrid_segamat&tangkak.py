import json
import math
import urllib.parse
import urllib.request
import processing
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsField,
    QgsFeature,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsVectorLayer,
)
from qgis.PyQt.QtCore import QVariant

print("Fetching Segamat & Tangkak boundaries from OpenStreetMap...")

# 1. Fetch Boundary Lines from OpenStreetMap
overpass_url = "https://overpass-api.de/api/interpreter"
overpass_query = """
[out:json][timeout:30];
(
  relation["boundary"="administrative"]["name"="Segamat"];
  relation["boundary"="administrative"]["name"="Tangkak"];
);
out body;
>;
out skel qt;
"""

req = urllib.request.Request(
    overpass_url,
    data=urllib.parse.urlencode({"data": overpass_query}).encode("utf-8"),
    headers={"User-Agent": "QGIS Python Script"},
)

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode("utf-8"))

nodes = {
    el["id"]: (el["lon"], el["lat"])
    for el in data.get("elements", [])
    if el["type"] == "node"
}
ways = [
    el for el in data.get("elements", []) if el["type"] == "way" and "nodes" in el
]

# 2. Convert to Target CRS (EPSG:3168 - Kertau RSO Malaya)
wgs84_crs = QgsCoordinateReferenceSystem("EPSG:4326")
target_crs = QgsCoordinateReferenceSystem("EPSG:3168")
transform = QgsCoordinateTransform(
    wgs84_crs, target_crs, QgsProject.instance()
)

boundary_lines = []
for way in ways:
    pts = [
        QgsPointXY(*nodes[node_id])
        for node_id in way["nodes"]
        if node_id in nodes
    ]
    if len(pts) > 1:
        line = QgsGeometry.fromPolylineXY(pts)
        line.transform(transform)
        boundary_lines.append(line)

# Create a bounding box polygon for boundary coverage
merged_lines = QgsGeometry.unaryUnion(boundary_lines)
boundary_polygon = merged_lines.convexHull()

# 3. Define 5km Grid and Extents
extent = boundary_polygon.boundingBox()
minx, miny = extent.xMinimum(), extent.yMinimum()
maxx, maxy = extent.xMaximum(), extent.yMaximum()

grid_size = 5000  # 5,000 meters = 5 km

start_x = math.floor(minx / grid_size) * grid_size
start_y = math.floor(miny / grid_size) * grid_size

# 4. Build Memory Layer for Grid
grid_layer = QgsVectorLayer(
    f"Polygon?crs={target_crs.authid()}",
    "Segamat_Tangkak_Clipped_5km_Grid",
    "memory",
)
provider = grid_layer.dataProvider()

provider.addAttributes(
    [
        QgsField("grid_id", QVariant.String),
        QgsField("easting_m", QVariant.Double),
        QgsField("northing_m", QVariant.Double),
    ]
)
grid_layer.updateFields()

# 5. Generate Cells and Apply NxxExx Labels
features = []
x = start_x

while x < maxx:
    y = start_y
    while y < maxy:
        p1 = QgsPointXY(x, y)
        p2 = QgsPointXY(x + grid_size, y)
        p3 = QgsPointXY(x + grid_size, y + grid_size)
        p4 = QgsPointXY(x, y + grid_size)

        cell_geom = QgsGeometry.fromPolygonXY([[p1, p2, p3, p4, p1]])

        # Intersect cell with the district region
        if cell_geom.intersects(boundary_polygon):
            clipped_geom = cell_geom.intersection(boundary_polygon)

            if not clipped_geom.isEmpty():
                # Format coordinate grid IDs (e.g., N94E70)
                easting_idx = int(x // 10000)
                northing_idx = int(y // 10000)
                grid_id = f"N{northing_idx:02d}E{easting_idx:02d}"

                feat = QgsFeature()
                feat.setGeometry(clipped_geom)
                feat.setAttributes([grid_id, x, y])
                features.append(feat)

        y += grid_size
    x += grid_size

# 6. Push Layer to Canvas over Google Basemap
provider.addFeatures(features)
grid_layer.updateExtents()
QgsProject.instance().addMapLayer(grid_layer)

print(
    f"Success! Generated and clipped {len(features)} subgrid cells for Segamat & Tangkak."
)