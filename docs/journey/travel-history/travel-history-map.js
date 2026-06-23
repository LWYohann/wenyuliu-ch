const FillColor = '#FF8C00';
const HoverOpacity = 0.7;
const DefaultOpacity = 0.55;
const SubdivisionFillColor = FillColor;
const SubdivisionVisitedColor = FillColor;
const SubdivisionNotVisitedColor = '#D3D3D3';
const SubdivisionOpacity = 0.6;
const LineWidth = 1;

// Set padding as a global variable according to the viewport size, if larger than 600px, use 80px, otherwise use 20px
const Padding = window.innerWidth > 600 ? 80 : 20;


// Global variables
let travelHistory, visitedIsoCodes, admDict;
let map; // Declare map in the global scope so it can be accessed in resetMap()
let initialBbox;


function getFlagIcon(countryCode) {
    // using flag icons from https://flagicons.lipis.dev/ with CSS classes, specially for CH, LI, VA, we use square flag (add 'fis' class)
    const isSquareFlag = ['CH', 'LI', 'VA'].includes(countryCode); 
    return `<span class="fi-container"><span class="fi fi-${countryCode.toLowerCase()} ${isSquareFlag ? 'fis' : ''}"></span></span>`;
}

async function initMap() {
    try {
        // Load history, ADM levels, AND the ADM0 GeoJSON
        const [historyRes, admRes, countriesRes] = await Promise.all([
            fetch('./geoJSONs/travel-history.json'),
            fetch('./geoJSONs/adm-level.json'),
            fetch('./geoJSONs/visited_countries.geojson') // Fetch early for the bbox
        ]);

        const historyData = await historyRes.json();
        admDict = await admRes.json();
        const countriesGeoJSON = await countriesRes.json();

        travelHistory = Object.values(historyData);
        visitedIsoCodes = new Set(travelHistory.map(h => h.iso3));

        // Calculate bbox from the actual GeoJSON data
        initialBbox = turf.bbox(countriesGeoJSON); 

        map = new maplibregl.Map({
            container: 'map-travel',
            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
            bounds: initialBbox,
            fitBoundsOptions: { padding: Padding }
        });

        map.on('load', () => {
            // Since we already fetched countriesGeoJSON, 
            // pass the object directly instead of the URL
            setupLayers(map, countriesGeoJSON); 
        });

    } catch (err) {
        console.error('Initialization failed:', err);
    }
}

const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
let activeCountryMetadata = {
    iso: null,
    visitTimeInfo: []
};

function setupLayers(map, countriesGeoJSON) {
    map.addSource('adm-0-source', { type: 'geojson', data: countriesGeoJSON });
    
    map.addLayer({
        'id': 'adm-0-fill',
        'type': 'fill',
        'source': 'adm-0-source',
        'paint': {
            'fill-color': FillColor,
            'fill-opacity': DefaultOpacity,
        }
    });

    map.addLayer({
        'id': 'adm-0-outline',
        'type': 'line',
        'source': 'adm-0-source',
        'paint': {
            'line-color': '#000',
            'line-width': 1
        }
    });

    // CLICK HANDLER
    map.on('click', 'adm-0-fill', async (e) => {
        const feature = e.features[0];
        const iso = feature.properties.iso3;
        const iso2 = feature.properties.iso2;
        console.log('Clicked country ISO2:', iso2);
        const countryName = feature.properties.name;
0
        // Get ADM level from the pre-loaded dictionary
        const levels = admDict[iso] || [0];
        const admLevel = Math.max(...levels);

        try {
            // Fetch the specific country GeoJSON
            const geoRes = await fetch(`./geoBoundaries/${iso}_ADM${admLevel}.geojson`);
            if (!geoRes.ok) throw new Error('GeoData not found');
            const data = await geoRes.json();

            // Update Source
            if (map.getSource('adm-1-source')) {
                map.getSource('adm-1-source').setData(data);
            } else {
                map.addSource('adm-1-source', { type: 'geojson', data: data });
            }

            // Fly to country
            const bbox = turf.bbox(data);
            map.fitBounds(bbox, { padding: Padding, duration: 1500 });

            // Toggle visibility
            map.setLayoutProperty('adm-0-fill', 'visibility', 'none');
            map.setLayoutProperty('adm-0-outline', 'visibility', 'none');

            // Handle ADM1 Layer
            const selectedCountryHistory = travelHistory.filter(h => h.iso3 === iso);
            const visitedTerms = selectedCountryHistory.map(h => h.Subdivisions).flat();
            const visitTimeInfo = selectedCountryHistory.map(h => ({ [h.Subdivisions]: h['First visit'] }));

            activeCountryMetadata = {
                iso: iso,
                visitTimeInfo: selectedCountryHistory.map(h => ({ [h.Subdivisions]: h['First visit'] }))
            };

            // If layer exists, remove it to re-add with new filter logic, 
            if (map.getLayer('adm-1-fill')) map.removeLayer('adm-1-fill');

            map.addLayer({
                'id': 'adm-1-fill',
                'type': 'fill',
                'source': 'adm-1-source',
                'paint': {
                    'fill-color': [
                        'case',
                        ['any', ...visitedTerms.map(t => [
                            'in',
                            t.toLowerCase(),
                            [   'downcase',
                                ['get', 'shapeName']]
                        ])],
                        SubdivisionVisitedColor,
                        SubdivisionNotVisitedColor
                    ],
                    'fill-opacity': SubdivisionOpacity,
                    'fill-outline-color': '#000'
                }
            });
            map.addLayer({
                'id': 'adm-1-outline',
                'type': 'line',
                'source': 'adm-1-source',
                'paint': {
                    'line-color': '#000',
                    'line-width': 0.5
                }
            });

            showCard(`${getFlagIcon(iso2)} `,`${countryName}`, `${visitedTerms.length} out of ${data.features.length} subdivisions visited`);
        } catch (error) {
            console.error(error);
            alert(`Error loading subdivisions for ${countryName}`);
         }
        });

        // Hover effect for subdivisions
        let hoveredSubdivisionId = null;
        map.on('mousemove', 'adm-1-fill', (e) => {
            if (e.features.length === 0) return;

            const props = e.features[0].properties;
            const subdivisionName = props.shapeName; // Assuming shapeName is the subdivision name
            map.getCanvas().style.cursor = 'pointer';
            popup.setLngLat(e.lngLat);

            if (hoveredSubdivisionId !== subdivisionName) {
                hoveredSubdivisionId = subdivisionName;
                
                map.setPaintProperty('adm-1-fill', 'fill-opacity', [
                    'case',
                    ['==', ['get', 'shapeName'], subdivisionName], HoverOpacity, SubdivisionOpacity
                ]);
                let iconCOA = ``;
                const { iso, visitTimeInfo } = activeCountryMetadata;

                if (iso === 'CHE') {
                    iconCOA = `<img src="../grandtour/COA/${subdivisionName}_COA.svg" alt="${subdivisionName}" class="fi-container"/> `; // Special case for Switzerland
                }


                popup.setHTML(`<p class="map-travel-popup-title">${iconCOA}${subdivisionName}</p><p>First Visit: ${visitTimeInfo.find(info => info[subdivisionName]) ? visitTimeInfo.find(info => info[subdivisionName])[subdivisionName] : 'N/A'}</p>`)
                    .addTo(map);
            }

            if (!popup.isOpen()) popup.addTo(map);
        });

        map.on('mouseleave', 'adm-1-fill', () => {
            hoveredSubdivisionId = null;
            popup.remove();
            map.getCanvas().style.cursor = ''; 
            map.setPaintProperty('adm-1-fill', 'fill-opacity', SubdivisionOpacity);
        });


    // hover effect for amd-0 layer
    map.on('mousemove', 'adm-0-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        map.setPaintProperty('adm-0-fill', 'fill-opacity', [
            'case',
            ['==', ['get', 'iso3'], e.features[0].properties.iso3], HoverOpacity, DefaultOpacity
        ]); 
    });

     map.on('mouseleave', 'adm-0-fill', () => {
        map.getCanvas().style.cursor = '';
        map.setPaintProperty('adm-0-fill', 'fill-opacity', DefaultOpacity);
    });

    map.on('click', (e) => {
        // If the user clicks the map but NOT on a country/subdivision
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['adm-0-fill']
        });

        if (features.length === 0 && hoveredSubdivisionId === null) {
            resetMap();
        }
    });

    
}

initMap();

window.addEventListener('resize', () => {
    map.resize();
});

function showCard(icon, title, stats) {
    if (title === 'China') {
        title = 'China Mainland'; // Special case for China
    }
    else if (title === 'Hong Kong') {
        title = 'Hong Kong SAR';
    }
    else if (title === 'Macau') {
        title = 'Macau SAR';
    }


    const card = document.getElementById('info-card');
    // document.getElementById('info-card').style.display = 'block';
    document.getElementById('card-title').innerHTML = `${icon} ${title}`;
    document.getElementById('card-stats').innerText = stats;
    card.classList.add('active');
}

function resetMap() {
    map.fitBounds(initialBbox, {
        padding: Padding,
        duration: 1000,
        essential: true
    });
    if (map.getSource('adm-1-source')) {
        map.getSource('adm-1-source').setData({ type: 'FeatureCollection', features: [] });
    }
    map.setLayoutProperty('adm-0-fill', 'visibility', 'visible');
    map.setLayoutProperty('adm-0-outline', 'visibility', 'visible');
    // map.removeLayer('adm-1-fill');
    if (map.getLayer('adm-1-fill')) map.removeLayer('adm-1-fill');
    if (map.getLayer('adm-1-outline')) map.removeLayer('adm-1-outline');
    const card = document.getElementById('info-card');
    card.classList.remove('active');
}