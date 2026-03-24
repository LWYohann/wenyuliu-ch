# %%
import pandas as pd
import json
import geopandas as gpd 
from shapely.geometry import Point
# %%

df = pd.read_excel('grandtour_items.xlsx', sheet_name='Sheet1')

lon_lat = df['geometry'].apply(lambda x: x.split('(')[1].split(')')[0].split())
df['geometry'] = lon_lat.apply(lambda x: Point(float(x[0]), float(x[1])))
df['dir_COA'] = df['dir_COA'].apply(lambda x: x.replace('C:\coatofarms\\', '/COA/'))
df['is_visited'] = df['is_visited'].fillna(0.0).astype(bool)
df.rename(columns={'name': 'canton'}, inplace=True)
# %%

# %%
gdf = gpd.GeoDataFrame(df, geometry='geometry', crs='EPSG:4326')
# %%
gdf_to_save = gdf[['id', 'title', 'titleinframe', 'canton', 'dir_COA', 'is_visited', 'geometry']]

gdf_to_save.to_file('./geoJSONs/grandtour_items.geojson', driver='GeoJSON')


# %%
