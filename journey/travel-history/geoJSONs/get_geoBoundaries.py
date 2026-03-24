# %%
import pandas as pd
import requests
import json
# %%

travel_df = pd.read_csv('travel-history.csv')

with open('adm-level.json', 'r') as f:
    adm_dict = json.load(f)

# %%


def get_geoboundaries(iso3: str, admin_level: int) -> dict:
    BASE_URL = "https://www.geoboundaries.org/api/current/gbOpen/"
    url = f"{BASE_URL}{iso3}/ADM{admin_level}"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Error fetching data for {iso3} at admin level {admin_level}: {response.status_code}")


def save_geojson(iso3: str, admin_level: int, geojson_link: str):
    response = requests.get(geojson_link)
    if response.status_code == 200:
        with open(f"./geoBoundaries/{iso3}_ADM{admin_level}.geojson", 'w') as f:
            json.dump(response.json(), f)
    else:
        raise Exception(f"Error fetching geojson for {iso3} at admin level {admin_level}: {response.status_code}")
# %%
# Check if the iso_ADM files already exist, if not, fetch from geoboundaries and save as geojson

special_iso3_2_name = {'HKG': 'Hong Kong', 'MAC': 'Macau', 'TWN': 'Taiwan'}

for c_iso in travel_df['iso3'].unique():
    for adm_level in adm_dict[c_iso]:
        if len(adm_dict[c_iso])>1 and adm_level > 0:
            try:
                with open(f"./geoBoundaries/{c_iso}_ADM{adm_level}.geojson", 'r') as f:
                    print(f"{c_iso}_ADM{adm_level}.geojson already exists.")
            except FileNotFoundError:
                print(f"{c_iso}_ADM{adm_level}.geojson not found. Fetching from geoboundaries...")

                if c_iso not in special_iso3_2_name:

                    fetch_data = get_geoboundaries(c_iso, adm_level)
                    
                    geojson_link = fetch_data.get('simplifiedGeometryGeoJSON', None)
                    if geojson_link:
                        save_geojson(c_iso, adm_level, geojson_link)
                    else:
                        raise Exception(f"No geojson link found for {c_iso} at admin level {adm_level}.")
                else:
                    print(f"{c_iso} is a special case, skipping fetch from geoboundaries.")
# %% 
# For HKG, MAC, TWN, we split the data from CHN
import geopandas as gpd
gdf_CHN = gpd.read_file('./geoBoundaries/CHN_ADM1.geojson')
# %%
for iso3, name in special_iso3_2_name.items():
    gdf_iso3 = gdf_CHN[gdf_CHN['shapeName'].str.contains(name)].copy(deep=True)
    if not gdf_iso3.empty:
        print(f"Found {name} in CHN ADM1 geojson, extracting and saving as {iso3}_ADM0.geojson")
        gdf_iso3['shapeISO'] = iso3
        gdf_iso3.to_file(f"./geoBoundaries/{iso3}_ADM0.geojson", driver='GeoJSON')
        # delete the item from CHN geojson
        gdf_CHN = gdf_CHN[~gdf_CHN['shapeName'].str.contains(name)]
    else:
        print(f"{name} not found in CHN ADM1 geojson, please check the name and try again.")
# %%
gdf_CHN.to_file('./geoBoundaries/CHN_ADM1.geojson', driver='GeoJSON')
# %%

with open('./geoBoundaries/CHN_ADM1.geojson', 'r') as f:
    geojson_CHN = json.load(f)

for iso3, name in special_iso3_2_name.items():
    for feature in geojson_CHN['features']:
        if name in feature['properties']['shapeName']:
            print(f"Found {name} in CHN ADM1 geojson, extracting and saving as {iso3}_ADM0.geojson")
            feature['properties']['shapeISO'] = iso3
            with open(f"./geoBoundaries/{iso3}_ADM0.geojson", 'w') as f:
                json.dump(feature, f)
            # delete the item from CHN geojson
            geojson_CHN['features'].remove(feature)
# %%
with open('./geoBoundaries/CHN_ADM1.geojson', 'w') as f:
    json.dump(geojson_CHN, f)

# %%
# export the df to json
travel_df.T.to_json('./travel-history.json')
# %%
