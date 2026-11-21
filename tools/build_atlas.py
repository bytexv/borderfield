"""Regenerate the bundled atlas from Natural Earth 1:10m and mledoze/countries.
Usage: python tools/build_atlas.py countries.json ne_10m_admin_0_countries.geojson
Requires shapely and pyproj. Input sources and licenses are listed in README.md.
"""
import csv
import json
import math
import sys
from pathlib import Path
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
names = {'COG':'Republic of the Congo', 'COD':'DR Congo','CIV':'Côte d’Ivoire','CPV':'Cabo Verde'}
aliases = {
    'GBR':['UK','Great Britain','Britain'], 'USA':['USA','US','America','United States of America'],
    'ARE':['UAE','United Arab Emirates'], 'CIV':['Ivory Coast','Cote d Ivoire'], 'CPV':['Cape Verde'],
    'TUR':['Turkey'], 'COD':['DRC','Congo Kinshasa','Democratic Republic of Congo','Democratic Republic of the Congo'],
    'COG':['Congo Brazzaville','Republic of Congo','Congo'], 'KOR':['Republic of Korea'], 'PRK':['DPRK'],
    'MMR':['Burma'], 'CZE':['Czech Republic'], 'SWZ':['Swaziland'], 'TLS':['East Timor'],
    'FSM':['Federated States of Micronesia'], 'VAT':['Holy See','Vatican'], 'RUS':['Russian Federation'],
    'LAO':['Lao PDR'], 'MKD':['Macedonia'], 'PSE':['State of Palestine'], 'KNA':['St Kitts and Nevis'],
    'VCT':['St Vincent and the Grenadines'], 'LCA':['St Lucia'], 'STP':['Sao Tome and Principe'],
    'BIH':['Bosnia','Bosnia Herzegovina'], 'KIR':['Republic of Kiribati'], 'TZA':['United Republic of Tanzania']
}
capitals = {'NRU':'Yaren (seat of government)', 'LKA':'Sri Jayawardenepura Kotte (legislative), Colombo (executive and judicial)',
            'PSE':'East Jerusalem (claimed), Ramallah (administrative)', 'BOL':'Sucre (constitutional), La Paz (seat of government)',
            'ISR':'Jerusalem (status disputed)', 'SWZ':'Mbabane (administrative), Lobamba (royal and legislative)'}
# Focus familiar contiguous land or the main island group when remote territories
# would reduce the study outline to a dot. Labels travel with the quiz card.
focus = {
    'USA':(-124.9,24.3,-66.6,49.6,'Contiguous states'), 'FRA':(-6,41,10,52,'Metropolitan outline'),
    'NOR':(3,56,33,72,'Mainland & coastal islands'), 'AUS':(110,-45,155,-9,'Mainland & Tasmania'),
    'NZL':(165,-48.5,179.5,-33,'Main islands'), 'ECU':(-82,-6,-74,2,'Mainland outline'),
    'CHL':(-77,-57,-66,-16,'Mainland & coastal islands'), 'PRT':(-10,36,-6,43,'Mainland outline'),
    'ESP':(-10,35.9,5,44,'Mainland & Balearic Islands'), 'NLD':(3,50,8,54,'European outline'),
    'DNK':(7,54,16,59,'European outline'), 'GBR':(-9,49,2,61.5,'Main island group'),
    'KIR':(-158,-1,-156,3,'Kiritimati island detail'), 'SYC':(54.8,-5,56,-3.7,'Main island group'),
    'MUS':(57.1,-20.7,58,-19.8,'Mauritius island detail'), 'YEM':(41,12,55,20,'Mainland outline'),
    'COL':(-80,-5,-66,13,'Mainland outline'), 'JPN':(128,29,147,46,'Main island chain'),
    'ZAF':(16,-36,34,-21,'Mainland outline'), 'IND':(67,6,98,38,'Mainland outline')
}
metadata = json.loads(Path(sys.argv[1]).read_text())
features = {f['properties']['ADM0_A3']:f for f in json.loads(Path(sys.argv[2]).read_text())['features']}
notes = dict(csv.reader((ROOT/'tools/field-notes.tsv').open(),delimiter='\t'))
countries = []
all_names = {c['cca3']:names.get(c['cca3'], c['name']['common']) for c in metadata}
for c in metadata:
    code = c['cca3']
    if not c['unMember'] and code not in ('PSE','VAT'):
        continue
    geom = shape(features[{'PSE':'PSX','SSD':'SDS'}.get(code,code)]['geometry'])
    polys = list(geom.geoms) if geom.geom_type=='MultiPolygon' else [geom]
    tag = 'Country outline'
    if code in focus:
        west,south,east,north,tag = focus[code]
        polys = [p for p in polys if west<=p.representative_point().x<=east and south<=p.representative_point().y<=north]
    lat,lon = c['latlng']
    if code in ['KIR','SYC','MUS']: lon,lat=polys[0].representative_point().coords[0]
    # Each vertex goes through a country-centred equal-area projection. This also
    # keeps islands on opposite sides of the antimeridian together.
    project = Transformer.from_crs('EPSG:4326',f'+proj=laea +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m',always_xy=True).transform
    projected = unary_union([transform(project,p).buffer(0) for p in polys])
    x0,y0,x1,y1=projected.bounds
    scale=min(268/(x1-x0),157/(y1-y0))
    planar=affine_transform(projected,[scale,0,0,-scale,150-(x0+x1)/2*scale,90+(y0+y1)/2*scale])
    parts=list(planar.geoms) if planar.geom_type=='MultiPolygon' else [planar]
    paths=[]; dots=[]
    for p in parts:
        if p.area < .50:
            if p.area>.025 or code in ('MHL','TUV','FSM','MDV'):
                x,y=p.representative_point().coords[0]; dots.append([round(x,1),round(y,1)])
            continue
        simplified=p.simplify(.28,preserve_topology=True)
        for ring in [simplified.exterior]+[r for r in simplified.interiors if Polygon(r).area>1.5]:
            coords=list(ring.coords)[:-1]
            paths.append('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in coords)+'Z')
    assert paths or dots, code
    name=all_names[code]
    accepted=[name,c['name']['common'],c['name']['official'],*aliases.get(code,[])]
    # Common English alternatives from the source, excluding opaque country codes.
    accepted.extend(s for s in c['altSpellings'] if len(s)>3 and s.isascii())
    region=c['region'] if c['region']!='Americas' else ('South America' if c['subregion']=='South America' else 'North America')
    countries.append(dict(id=code,name=name,region=region,capital=capitals.get(code,', '.join(c['capital'])),
                    neighbors=sorted(all_names[n] for n in c['borders'] if n in all_names),
                    aliases=list(dict.fromkeys(accepted)),note=notes[code],detail=tag,path=''.join(paths),dots=dots))
assert len(countries)==len(notes)==195
countries.sort(key=lambda c:c['name'])
(ROOT/'app/assets/atlas.js').write_text('const ATLAS = '+json.dumps(countries,ensure_ascii=False,separators=(',',':'))+';\n')
