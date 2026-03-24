
const VisitedColor = '#EA291C';
const UnvisitedColor = '#adb5bd';
const DefaultOpacity = 0.8;
const HoverOpacity = 0.8;
const LineColor = 'black';
const LineHoverColor = '#FF8C00';

// Mapbox Public Access Token (restricted to URL wenyuliu.ch)
const MapBoxKey = 'pk.eyJ1Ijoid2VueXUtbGl1IiwiYSI6ImNtbjUwb2M2bTAxdG4ycHM3OWNreWNka3IifQ.VZJtHh8f8W60qdeLy9no6g';


let map;
let initialBbox;
const Padding = window.innerWidth > 600 ? 80 : 20;
const ScaleFactor = window.innerWidth > 600 ? 0.8 : 0.6;


function getLightPreset() {
    // get user time and return the corresponding preset from 'dawn', 'day', 'dusk', 'night'

    const UserTime = new Date().getHours();
    if (UserTime >= 5 && UserTime < 8) {
        return 'dawn';
    }
    else if (UserTime >= 8 && UserTime < 17) {
        return 'day';
    }
    else if (UserTime >= 17 && UserTime < 20) {
        return 'dusk';
    }
    else {
        return 'night';
    }
}


let grandtourData;

async function initMap() {
    try {

        const response = await fetch('./geoJSONs/grandtour_items.geojson');
        grandtourData = await response.json();

        const bounds = turf.bbox(grandtourData);
        initialBbox = bounds;
        mapboxgl.accessToken = MapBoxKey;
        map = new mapboxgl.Map({
            container: 'map-grandtour',
            style: 'mapbox://styles/mapbox/standard',
            config: {
                basemap: {
                    lightPreset: getLightPreset(),
                }
            },
            // style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            bounds: initialBbox,
            fitBoundsOptions: { padding: Padding },

            

        });

        map.on('load', async () => {

            // Add Source
            map.addSource('grandtour-items', {
                type: 'geojson',
                data: grandtourData
            });

            

            // Add Markers
            grandtourData.features.forEach((feature) => {
                const is_visited = feature.properties.is_visited;
                const marker = new mapboxgl.Marker({
                    color: is_visited ? VisitedColor : UnvisitedColor,
                    opacity: DefaultOpacity,
                    scale: ScaleFactor,
                })
                .setLngLat(feature.geometry.coordinates)
                .addTo(map);
            
                // Hover
                const el = marker.getElement();

                el.addEventListener('mouseenter', () => {
                    el.classList.add('marker-hover');

                    


                });

                el.addEventListener('mouseleave', () => {
                    el.classList.remove('marker-hover');
                });
                
                // Photo in frame (if visited, load id.svg)

                let photoHtml;
                if (is_visited) {
                    photoHtml = `<object data="./photos/${feature.properties.id}.svg" type="image/svg+xml" class="grandtour-photo" style="text-align: center; bottom: 40%; transform: translateY(50%);"> SVG NOT SUPPORTED </object>`;
                }
                else {
                    // If not visited, show "Photo not available", move it vertically and horizontally to the center of the frame
                    photoHtml = `<div class="grandtour-photo" style="text-align: center; bottom: 40%; transform: translateY(50%);">Photo not available</div>`;
                }


                // add popup when click
                el.addEventListener('click', () => {
                    // const popup = new maplibregl.Popup({ offset: 25 })
                    //     .setLngLat(feature.geometry.coordinates)
                    //     .setHTML(`
                    //         <h3 class="grandtour-popup-title"><img src=".${feature.properties.dir_COA}" alt="${feature.properties.titleinframe}" class="inline-svg" />  ${feature.properties.titleinframe}</h3>
                    //         <div class = "grandtour-image-container">
                            
                    //         <img src="./frames/${feature.properties.id}.svg"  class="grandtour-frame" />

                            
                    //         ${photoHtml}

                    //         </div>
                    //     `)
                    //     .addTo(map);
                    // marker.setPopup(popup).togglePopup();

                    




                    map.flyTo({
                        center: feature.geometry.coordinates,
                        zoom: 13,
                        essential: true,
                        duration: 1500
                    });

                    const ImageHtml = `
                        <img src="./frames/${feature.properties.id}.svg"  class="grandtour-frame" id = "main-frame-img"/>
                        ${photoHtml}
                    `;



                    
                    const cardImage = document.getElementById('grandtour-image-container');
                    cardImage.innerHTML = ImageHtml;

                    
                    
                    
                    document.getElementById('grandtour-card-title').innerHTML = `<img src=".${feature.properties.dir_COA}" alt="${feature.properties.titleinframe}" class="inline-svg" style="margin-right: 10px;" />  ${feature.properties.titleinframe}`;


                    map.once('moveend', () => {
                        const card = document.getElementById('grandtour-card');
                        card.classList.remove('hidden');
                    });
                
                    

                    

                    
                    


                    
                    
                });
            });
            

        });
    } catch (error) {
        console.error('Error loading map or GeoJSON:', error);
    }
}


function resetMap() {
    const card = document.getElementById('grandtour-card');
    card.classList.add('hidden');
    map.fitBounds(initialBbox, {
        padding: Padding,
        duration: 1500,
        essential: true
    });
}


initMap();