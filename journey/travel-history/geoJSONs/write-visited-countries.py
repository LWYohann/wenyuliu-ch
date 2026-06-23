# %%
import pandas as pd
import geopandas as gpd

# %%

# use: first input in the travel-history.csv


travel_history = pd.read_csv("travel-history.csv")

# save to json for web loading

travel_history.to_json("travel-history.json", orient="index")
# %%

# from ./geoBoundaries, load ISO_ADM0 and construct a GeoDataFrame with the visited countries

world_gdf = gpd.read_file('../geoBoundaries/world-administrative-boundaries.zip')

adm0_gdfs = []
for iso3 in travel_history["iso3"].unique():
    # load the geojson for the country
    gdf = world_gdf[world_gdf["iso3"] == iso3]
    gdf["iso3"] = iso3
    gdf["iso2"] = travel_history[travel_history["iso3"] == iso3]["iso2"].values[0]
    gdf["name"] = travel_history[travel_history["iso3"] == iso3]["Country"].values[0]
    # add to the list of GeoDataFrames
    adm0_gdfs.append(gdf)



visited_countries_gdf = gpd.GeoDataFrame(pd.concat(adm0_gdfs, ignore_index=True))
visited_countries_gdf.geometry = visited_countries_gdf.geometry.simplify(tolerance=0.01)
# %%
# save to json
visited_countries_gdf.to_file("./visited_countries.geojson", driver="GeoJSON")

# %%
