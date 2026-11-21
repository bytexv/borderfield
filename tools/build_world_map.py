"""Build the offline Equal Earth map.
Usage: python tools/build_world_map.py countries.json ne_10m_admin_0_countries.geojson
Uses the same inputs and Python dependencies as build_atlas.py.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
metadata = json.loads(Path(sys.argv[1]).read_text())
features = json.loads(Path(sys.argv[2]).read_text())["features"]
roster = {c["cca3"] for c in metadata if c["unMember"] or c["cca3"] in ("PSE", "VAT")}
admin_codes = {code: code for code in roster}
admin_codes.update(PSX="PSE", SDS="SSD")
parents = {}
for feature in features:
    p = feature["properties"]
    if p["ADM0_A3"] in admin_codes and p["ADMIN"] == p["SOVEREIGNT"]:
        parents[p["SOV_A3"]] = admin_codes[p["ADM0_A3"]]

project = Transformer.from_crs("EPSG:4326", "EPSG:8857", always_xy=True).transform
scale = 484 / project(180, 0)[0]
def point(lon, lat):
    x, y = project(lon, lat)
    return (500 + x * scale, 255 - y * scale)

def path(points, close=False):
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in points) + ("Z" if close else "")

paths = defaultdict(list)
centers = {}
small = []
for feature in features:
    props = feature["properties"]
    own_code = admin_codes.get(props["ADM0_A3"])
    code = own_code or parents.get(props["SOV_A3"], "other")
    geom = transform(project, shape(feature["geometry"]))
    geom = affine_transform(geom, [scale, 0, 0, -scale, 500, 255])
    polygons = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    if own_code:
        largest = max(polygons, key=lambda p: p.area)
        center = largest.representative_point()
        centers[own_code] = [round(center.x, 1), round(center.y, 1)]
        if largest.area < 19:
            small.append(own_code)
    for polygon in polygons:
        if polygon.area < .07:
            continue
        simplified = polygon.simplify(.20, preserve_topology=True)
        paths[code].append(path(list(simplified.exterior.coords)[:-1], True))
        for hole in simplified.interiors:
            paths[code].append(path(list(hole.coords)[:-1], True))

graticule = []
for lon in range(-150, 180, 30):
    graticule.append(path(point(lon, lat) for lat in range(-90, 91, 2)))
for lat in range(-60, 61, 30):
    graticule.append(path([point(-180, lat), point(180, lat)]))
edge = [point(-180, lat) for lat in range(-90, 91, 2)]
edge.extend(point(180, lat) for lat in range(90, -91, -2))
assert len(roster) == 195 and centers.keys() == roster
assert all(paths[code] or code in small for code in roster)
world = {
    "frame": path(edge, True),
    "grid": "".join(graticule),
    "other": "".join(paths["other"]),
    "countries": {code: "".join(paths[code]) for code in sorted(roster)},
    "centers": centers,
    "small": sorted(small),
}
(ROOT / "app/assets/world-map.js").write_text("const WORLD_MAP = " + json.dumps(world, separators=(",", ":")) + ";\n")
