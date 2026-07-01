#!/usr/bin/env python3
"""One-off: build area.geojson shapes for the general app-preset networks.

Country/state polygons come from github.com/georgique/world-geojson; they are
dissolved (EU-27, AU states) as needed, simplified, and coordinate-rounded to
roughly match the existing in-repo area files. NZ and EU/UK reuse the boundaries
already committed for meshcore-nz and eu-uk-narrow (identical coverage).
"""
import json, os, urllib.request
from shapely.geometry import shape, mapping, box, MultiPolygon
from shapely.ops import unary_union

# Windows that keep the populated mainland and drop far-flung overseas
# territories (Heard/Norfolk for AU; French Guiana, Réunion, Azores, Canaries
# for the EU) — matching the "European window" convention of eu-uk-narrow.
AU_WIN = box(112, -44, 154, -9)
EU_WIN = box(-25, 34, 45, 72)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NETS = os.path.join(ROOT, "data", "networks")
RAW = "https://raw.githubusercontent.com/georgique/world-geojson/master"
CACHE = "/tmp/geo"
os.makedirs(CACHE, exist_ok=True)

TOL = 0.02          # simplify tolerance in degrees (~2 km); coverage overlays
DECIMALS = 4        # coordinate rounding (~11 m) — plenty for country shapes

EU27 = ["austria","belgium","bulgaria","croatia","cyprus","czechia","denmark",
        "estonia","finland","france","germany","greece","hungary","ireland",
        "italy","latvia","lithuania","luxembourg","malta","netherlands","poland",
        "portugal","romania","slovakia","slovenia","spain","sweden"]

# Per-country mainland windows — drop overseas territories before EU union.
EU_MAINLAND_CLIP = {
    "denmark": box(-8.5, 54.5, 15.5, 58.2),   # mainland DK; drops Faroe + Greenland
    "portugal": box(-10.0, 36.8, -6.0, 42.2),  # continental PT; drops Azores
    "spain": box(-9.5, 36.0, 4.5, 43.8),      # Iberian + Balearics; drops Canaries
    "france": box(-5.5, 41.3, 9.6, 51.2),     # metropolitan France
}


def fetch(path):
    local = os.path.join(CACHE, path.replace("/", "_"))
    if not os.path.exists(local):
        urllib.request.urlretrieve(f"{RAW}/{path}", local)
    return json.load(open(local))


def clean(geom):
    # buffer(0) repairs self-intersections / side-location conflicts that break
    # unary_union across separately-sourced country polygons.
    return geom if geom.is_valid else geom.buffer(0)


def geom_of(gj):
    feats = gj["features"] if gj.get("type") == "FeatureCollection" else [gj]
    return unary_union([clean(shape(f["geometry"])) for f in feats])


def country(name):
    return geom_of(fetch(f"countries/{name}.json"))


def au_state(name):
    return geom_of(fetch(f"states/australia/{name}.json"))


def round_coords(obj):
    if isinstance(obj, float):
        return round(obj, DECIMALS)
    if isinstance(obj, list):
        return [round_coords(x) for x in obj]
    return obj


def drop_remote_eu_parts(geom):
    """Drop remaining Atlantic / Arctic island fragments after mainland clipping."""
    if geom.geom_type != "MultiPolygon":
        return geom
    kept = []
    for p in geom.geoms:
        lon, lat = p.centroid.x, p.centroid.y
        if 61.0 <= lat <= 63.0 and -8.5 <= lon <= -5.5:  # Faroe Islands
            continue
        if lat > 70.5 and lon < 5:  # Jan Mayen / high Arctic islets
            continue
        if 36.5 <= lat <= 40.0 and -31.0 <= lon <= -24.5:  # Azores
            continue
        if 27.0 <= lat <= 29.5 and -18.5 <= lon <= -13.0:  # Canaries
            continue
        kept.append(p)
    if not kept:
        return geom
    return kept[0] if len(kept) == 1 else MultiPolygon(kept)


def drop_islets(geom, min_area):
    # Remove sub-polygons below min_area (deg²) — tiny reef cays / islets that
    # only add vertices and visual noise to a country-level coverage overlay.
    if not min_area or geom.geom_type != "MultiPolygon":
        return geom
    parts = [p for p in geom.geoms if p.area >= min_area]
    return MultiPolygon(parts) if parts else geom


def write_area(net_id, net_name, geom, source, tol=TOL, window=None, min_area=0.0):
    if window is not None:
        geom = geom.intersection(window)
    geom = geom.simplify(tol, preserve_topology=True)
    geom = drop_islets(geom, min_area)
    feature = {
        "type": "Feature",
        "properties": {"name": f"{net_name} area", "source": source},
        "geometry": round_coords(mapping(geom)),
    }
    fc = {"type": "FeatureCollection", "features": [feature]}
    out = os.path.join(NETS, net_id, "area.geojson")
    with open(out, "w") as f:
        json.dump(fc, f, separators=(",", ":"))
    print(f"  {net_id:22} {os.path.getsize(out)//1024:>4} KB  {source}")


def copy_existing(src_id, dst_id, new_name):
    src = json.load(open(os.path.join(NETS, src_id, "area.geojson")))
    for feat in src.get("features", [src]):
        props = feat.setdefault("properties", {})
        props["name"] = f"{new_name} area"
        props["source"] = props.get("source", "") + f" (shared with {src_id})"
    out = os.path.join(NETS, dst_id, "area.geojson")
    with open(out, "w") as f:
        json.dump(src, f, separators=(",", ":"))
    print(f"  {dst_id:22} {os.path.getsize(out)//1024:>4} KB  reuse {src_id}")


SRC_GEO = "world-geojson (github.com/georgique/world-geojson)"

print("Building preset area shapes...")

au = country("australia")
src_au = f"{SRC_GEO} AUS ADM0, simplified {TOL}deg / {DECIMALS}dp"
for nid, name in [("australia", "Australia"),
                  ("australia-narrow", "Australia (Narrow)"),
                  ("australia-mid", "Australia (Mid)")]:
    write_area(nid, name, au, src_au, window=AU_WIN, min_area=0.001)

sa_wa = unary_union([au_state("south_australia"), au_state("western_australia")])
write_area("australia-sa-wa", "Australia: SA, WA", sa_wa,
           f"{SRC_GEO} AUS ADM1, South Australia + Western Australia dissolved, simplified {TOL}deg / {DECIMALS}dp",
           window=AU_WIN, min_area=0.001)
write_area("australia-qld", "Australia: QLD", au_state("queensland"),
           f"{SRC_GEO} AUS ADM1 Queensland, simplified {TOL}deg / {DECIMALS}dp",
           window=AU_WIN, min_area=0.001)

write_area("brazil", "Brazil", country("brazil"),
           f"{SRC_GEO} BRA ADM0, simplified {TOL}deg / {DECIMALS}dp", min_area=0.001)

vn = country("vietnam")
for nid, name in [("vietnam-narrow", "Vietnam (Narrow)"),
                  ("vietnam-deprecated", "Vietnam (Deprecated)")]:
    write_area(nid, name, vn,
               f"{SRC_GEO} VNM ADM0, simplified {TOL}deg / {DECIMALS}dp", min_area=0.001)

def eu_mainland():
    geoms = []
    for c in EU27:
        g = clean(country(c))
        if c in EU_MAINLAND_CLIP:
            g = g.intersection(EU_MAINLAND_CLIP[c])
        geoms.append(g)
    return drop_remote_eu_parts(unary_union(geoms))

write_area("eu-433mhz-long-range", "EU 433MHz (Long Range)", eu_mainland(),
           f"{SRC_GEO} EU-27 members dissolved (UK excluded), European mainland window with overseas territories omitted, simplified 0.05deg / {DECIMALS}dp",
           tol=0.05, window=EU_WIN, min_area=0.002)

# Identical coverage to shapes already in the repo — reuse them.
copy_existing("meshcore-nz", "new-zealand", "New Zealand")
copy_existing("eu-uk-narrow", "eu-uk-deprecated", "EU/UK (Deprecated)")

print("Done.")
