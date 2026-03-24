
const FillColor = '#FF8C00';
const DefaultOpacity = 0.55;
const HoverOpacity = 0.7;
const LineColor = 'black';
const LineHoverColor = '#FF8C00';
const linkToAirlineCode = `https://cdn.jsdelivr.net/gh/besrourms/airlines@latest/airlines.json`;

// const ArcSteps = 500;

let map;
let initialBbox;
const Padding = window.innerWidth > 600 ? 80 : 20;

const mapPopupMaxWidth = window.innerWidth > 600 ? '450px' : '80vw'; // Use a narrower popup on smaller screens for better readability

let routeData, airportData; // Declare routeData in the global scope so it can be accessed in the route click handler
let routeFeatures; // Declare routeFeatures in the global scope so it can be accessed in the route click handler
let flightData; // Declare flightData in the global scope so it can be accessed in the airport click handler
let airLineCodeJSON; // Declare airLineCodeJSON in the global scope so it can be accessed in exportFlightRecords()

function getFlagIcon(countryCode) {
    // using flag icons from https://flagicons.lipis.dev/ with CSS classes, specially for CH, we use square flag (add 'fis' class)
    const isSquareFlag = ['CH'].includes(countryCode); 
    return `<span class="fi fi-${countryCode.toLowerCase()} ${isSquareFlag ? 'fis' : ''}"></span>`;
}

async function initMap() {
    try {

        const [flightRes, airportRes, airlineCodeRes] = await Promise.all([
            fetch('./geoJSONs/my_flights_gdf.geojson'),
            fetch('./geoJSONs/my_airports_gdf.geojson'),
            fetch(linkToAirlineCode)
        ]);
        // console.log('Flight and airport data fetched successfully');

        airportData = await airportRes.json();
        flightData = await flightRes.json();
        airLineCodeJSON = await airlineCodeRes.json();


        


        initialBbox = turf.bbox(airportData);

        map = new maplibregl.Map({
            container: 'map-flight-log',
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            bounds: initialBbox,
            fitBoundsOptions: { padding: Padding }
        });
        map.on('load', () => {
            map.addSource('airports', { type: 'geojson', data: airportData });
            map.addLayer({
                'id': 'airport-circles',
                'type': 'circle',
                'source': 'airports',
                'paint': {
                    'circle-radius': ["+",["get", "No. visit"], 3],
                    'circle-color': FillColor,
                    'circle-opacity': DefaultOpacity,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': 'black'
                }
            });

            // Add flight paths

            // Calculate unique flight routes and count occurrences, handle bi-directional routes as the same
            routeData = {};
            flightData.features.forEach((feature) => {
                const departure = feature.properties['Departure'];
                const arrival = feature.properties['Arrival'];
                // Create a unique key for the route, sorting the airports to treat A->B and B->A as the same route
                const routeKey = [departure, arrival].sort().join('-');
                routeData[routeKey] = (routeData[routeKey] || 0) + 1;
            });
            // Make an arc for each unique route, using the count for styling
            routeFeatures = Object.keys(routeData).map((routeKey) => {
                const [airport1, airport2] = routeKey.split('-');
                const count = routeData[routeKey];
                // Find the coordinates of the two airports
                const airport1Data = airportData.features.find(f => f.properties['iata'] === airport1);
                const airport2Data = airportData.features.find(f => f.properties['iata'] === airport2);
                if (airport1Data && airport2Data) {
                    const from = airport1Data.geometry.coordinates;
                    const to = airport2Data.geometry.coordinates;
                    // Create a great circle arc between the two airports
                    // adjust the number of points in the arc based on the distance between airports (longer routes get more points for smoother arcs)

                    const Distance = turf.distance(turf.point(from), turf.point(to), {units: 'kilometers'});

                    const ArcSteps  = Math.max(100, Math.floor(Distance/10)); // minimum 100 points
                    const arcLine = turf.greatCircle(from, to, { npoints: ArcSteps });
                    const arcCoordinates = arcLine.geometry.coordinates;

                    // Create a GeoJSON LineString feature for the route
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: arcCoordinates
                        },
                        properties: {
                            'No. flight': count,
                            'Route': routeKey,
                            'Distance': Distance.toFixed(0) + ' km' // Add distance property, round to integer for cleaner display

                        }
                    };
                }
                return null; // Skip if airport data is missing
            }).filter(f => f !== null); // Remove any null features

            const routeDataCollection = {
                type: 'FeatureCollection',
                features: routeFeatures
            };
            


            map.addSource('routes', { type: 'geojson', data: routeDataCollection });
            map.addLayer({
                'id': 'flight-routes',
                'type': 'line',
                'source': 'routes',
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': LineColor,
                    'line-width': ["+", ["*", ["get", "No. flight"], 1.2], 0.5],
                    'line-opacity': 0.7
                }
            });
        });

        
        let popupAirport, popupRoute; // Declare popups in the global scope so they can be accessed in event handlers
        // Add click handler for airports to show popup with visit count
        map.on('click', 'airport-circles', (e) => {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const airportName = feature.properties['Name'] + ` (${feature.properties['iata']})`;
            const flightRecordsofAirport = flightData.features.filter(f => f.properties['Departure'] === feature.properties['iata'] || f.properties['Arrival'] === feature.properties['iata']);
            const noDepartures = flightData.features.filter(f => f.properties['Departure'] === feature.properties['iata']).length;
            const noArrivals = flightData.features.filter(f => f.properties['Arrival'] === feature.properties['iata']).length;
            const totalVisits = noDepartures + noArrivals;
            // make a table with columns: Route, Flight Number, Date, Airline, Aircraft
            const flightDetails = flightRecordsofAirport.map(f => {
                const route = `${f.properties['Departure']} → ${f.properties['Arrival']}`;
                const flightNumber = f.properties['Flight Number'];
                const date = new Date(f.properties['Date']).toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); // parse and format date as "YYYY-MM-DD"
                // const airline = f.properties['Airline'];
                const aircraft = f.properties['Aircraft'];
                return `
                <tr class="map-popup-table-row">
                    <td class = "map-popup-table-cell">${route}</td>
                    <td class = "map-popup-table-cell">${flightNumber}</td>
                    <td class = "map-popup-table-cell">${date}</td>
                    <td class = "map-popup-table-cell">${aircraft}</td>
                </tr>`;
            }).join('');

            const iconSpan = getFlagIcon(feature.properties['country_code']);

            // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being clicked on
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

        popupAirport = new maplibregl.Popup({
            maxWidth: mapPopupMaxWidth,
            minWidth: '320px',
        });
        popupAirport.setLngLat(coordinates)
            .setHTML(`
                <div class="map-flight-popup-title">
                    ${iconSpan} <span>${airportName}</span>
                </div>
                
                <div class="map-popup-stats">
                    <div class="map-stat-item">
                        <span class="map-stat-value">${noDepartures}</span>
                        <span class="map-stat-label">${noDepartures === 1 ? 'Departure' : 'Departures'}</span>
                    </div>
                    <div class="map-stat-item">
                        <span class="map-stat-value">${noArrivals}</span>
                        <span class="map-stat-label">${noArrivals === 1 ? 'Arrival' : 'Arrivals'}</span>
                    </div>
                    <div class="map-stat-item">
                        <span class="map-stat-value">${totalVisits}</span>
                        <span class="map-stat-label">${totalVisits === 1 ? 'Trip' : 'Trips'}</span>
                    </div>
                </div>

                <div class="map-popup-table-container">
                    <table class="map-popup-table">
                        <thead class="map-popup-table-header">
                            <tr class="map-popup-table-row">
                                <th class="map-popup-table-header">Route</th>
                                <th class="map-popup-table-header">Number</th>
                                <th class="map-popup-table-header">Date</th>
                                <th class="map-popup-table-header">Aircraft</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${flightDetails}
                        </tbody>
                    </table>
                </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'airport-circles', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('airport-circles', 'circle-opacity', [
                'case',
                ['==', ['get', 'iata'], e.features[0].properties['iata']], HoverOpacity, DefaultOpacity
            ]);
        });

        map.on('mouseleave', 'airport-circles', (e) => {
            map.getCanvas().style.cursor = '';
            // popupAirport.remove();
            map.setPaintProperty('airport-circles', 'circle-opacity', DefaultOpacity);
        });

        // TODO: Add route interactions
        map.on('click', 'flight-routes', (e) => {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]; // Get the midpoint of the route for popup placement
            const routeInfo = feature.properties['No. flight'] + ' flights on this route';
            // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being clicked on
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }


            // Add a popup showing the two airports and the number of flights on this route
            const routeKey = feature.properties['Route'];
            const distance = feature.properties['Distance'];

            const airport1 = routeKey.split('-')[0];
            const airport2 = routeKey.split('-')[1];

            const airport1Info = airportData.features.find(f => f.properties['iata'] === airport1);
            const airport2Info = airportData.features.find(f => f.properties['iata'] === airport2);

            const airport1Name = airport1Info ? `${airport1Info.properties['Name']}` : airport1;
            const airport2Name = airport2Info ? `${airport2Info.properties['Name']}` : airport2;

            const airport1Icon = airport1Info ? getFlagIcon(airport1Info.properties['country_code']) : '';
            const airport2Icon = airport2Info ? getFlagIcon(airport2Info.properties['country_code']) : '';

            // organize flight data to show details of flights on this route, first filter flights that match this route (considering both directions), then create a table of flight details similar to the airport popup
            const flightsOnRoute = flightData.features.filter(f => {
                const dep = f.properties['Departure'];
                const arr = f.properties['Arrival'];
                return (dep === airport1 && arr === airport2) || (dep === airport2 && arr === airport1);
            });



            const flightDetails = flightsOnRoute.map(f => {
                const route = `${f.properties['Departure']} → ${f.properties['Arrival']}`;
                const flightNumber = f.properties['Flight Number'];
                const date = new Date(f.properties['Date']).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); // parse and format date as "YYYY-MM-DD"
                // const airline = f.properties['Airline'];
                const aircraft = f.properties['Aircraft'];
                return `
                <tr class="map-popup-table-row">
                    <td class="map-popup-table-cell">${route}</td>
                    <td class="map-popup-table-cell">${flightNumber}</td>
                    <td class="map-popup-table-cell">${date}</td>
                    <td class="map-popup-table-cell">${aircraft}</td>
                </tr>`;
            }).join('');

            // count airlines by the first 2 letters of the flight number (e.g. "AA" for "AA1234"), then display the airline counts in the popup
            const airlineCounts = {};
            flightsOnRoute.forEach(f => {
                const airlineCode = f.properties['Flight Number'].substring(0, 2);
                airlineCounts[airlineCode] = (airlineCounts[airlineCode] || 0) + 1;
            });
            const noAirlines = airlineCounts ? Object.keys(airlineCounts).length : 0;

            popupRoute = new maplibregl.Popup({maxWidth: mapPopupMaxWidth, minWidth: '320px'});
            popupRoute.setLngLat(coordinates)
                .setHTML(
                    `
                    <div class="map-flight-popup-title">
                        <div>
                        ${airport1Icon} ${airport1} - ${airport1Name} 
                        </div>
                        <div>
                        ${airport2Icon} ${airport2} - ${airport2Name}
                        </div>
                    </div>
                    <div class="map-popup-stats">
                        <div class="map-stat-item">
                            <span class="map-stat-value">${distance}</span>
                            <span class="map-stat-label">Distance</span>
                        </div>
                        <div class="map-stat-item">
                            <span class="map-stat-value">${flightsOnRoute.length}</span>
                            <span class="map-stat-label">${flightsOnRoute.length === 1 ? 'Trip' : 'Trips'}</span>
                        </div>
                        <div class="map-stat-item">
                            <span class="map-stat-value">${noAirlines}</span>
                            <span class="map-stat-label">${noAirlines === 1 ? 'Airline' : 'Airlines'}</span>
                        </div>
                    </div>

                    <div class="map-popup-table-container">
                        <table class="map-popup-table">
                            <thead class="map-popup-table-header" >
                                <tr class="map-popup-table-row">
                                    <th class = "map-popup-table-header">Route</th>
                                    <th class = "map-popup-table-header">Number</th>
                                    <th class = "map-popup-table-header">Date</th>
                                    <th class = "map-popup-table-header">Aircraft</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${flightDetails}
                            </tbody>
                        </table>
                    </div>
                    `
                ).addTo(map);
            
        });
                   


        map.on('mouseenter', 'flight-routes', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('flight-routes', 'line-color', [
                'case',
                ['==', ['get', 'Route'], e.features[0].properties['Route']], LineHoverColor, LineColor
            ]);
        });

        map.on('mouseleave', 'flight-routes', () => {
            map.getCanvas().style.cursor = '';
            // popupRoute.remove();
            map.setPaintProperty('flight-routes', 'line-color', LineColor);
        });

        

        // reset map view when clicking outside of any features
        map.on('click', (e) => {
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['airport-circles', 'flight-routes']
            });

            if (features.length === 0) {
                resetMap();
            }
        });

        exportFlightRecords(flightData);
        exportTopAirlines(flightData);
        exportTopAircrafts(flightData);


        

        // convert the 3 tables to DataTables for better interactivity (sorting, searching, pagination)
        $(document).ready(function() {
            $('#flight-records').DataTable({
                dom: 'Bfrtip',
                pageLength: 20,
                lengthMenu: [20, 50, 100],
                order: [[0, 'desc']], // Default sorting by date descending
                buttons: [
                    'copy', 'csv'
                ],
                responsive: true,
                searching: false,
            });
            $('#top-airlines').DataTable({
                pageLength: 20,
                order: [[1, 'desc']], // Default sorting by count descending
                paging: false,
                searching: false,
                layout: {
                    bottomStart: null, // Remove from default left
                    bottomEnd: null,   // Remove from default right
                    bottom: 'info'     // Place 'info' in a full-width center slot
                }
            });
            $('#top-aircrafts').DataTable({
                order: [[1, 'desc']], // Default sorting by count descending
                paging: false,
                searching: false,
                layout: {
                    bottomStart: null, // Remove from default left
                    bottomEnd: null,   // Remove from default right
                    bottom: 'info'     // Place 'info' in a full-width center slot
                }
            });
        });
                






    } catch (err) {
        console.error('Initialization failed:', err);
    }
}

function resetMap() {
    map.fitBounds(initialBbox, {
        padding: Padding,
        duration: 1000,
        essential: true
    });
}







// organize and export the flight records to id=`flight-records` element as a table
// Columns: Date	Airlines	Flight	DEP	ARR	Aircraft	Tail	Distance

function exportFlightRecords(flightData) {
    const flightRecords = flightData.features.map(f => {
        const date = new Date(f.properties['Date']).toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
        
        const flightNumber = f.properties['Flight Number'];

        const airlineCode = flightNumber.substring(0, 2);
        const airlineInfo = airLineCodeJSON.find(a => a.code === airlineCode);
        const airline = airlineInfo ? airlineInfo.name : airlineCode; // Fallback to code if name not found

        const departure = f.properties['Departure'];
        const arrival = f.properties['Arrival'];
        const aircraft = f.properties['Aircraft'];
        const tail = f.properties['Aircraft Registration'] || '';
        const distance = f.properties['Distance'] || '';
        return `
        <tr>
            <td>${date}</td>
            <td>${airline}</td>
            <td>${flightNumber}</td>
            <td>${departure}</td>
            <td>${arrival}</td>
            <td>${aircraft}</td>
            <td>${tail}</td>
        </tr>`;
    }).join('');

    // Add header row
    const header = `
    <thead>
        <tr>
            <th>Date</th>
            <th>Airlines</th>
            <th>Flight</th>
            <th>DEP</th>
            <th>ARR</th>
            <th>Aircraft</th>
            <th>Tail</th>
        </tr>
    </thead>`;
    const output = header + `<tbody>` + flightRecords + `</tbody>`;
    document.getElementById('flight-records').innerHTML = output;
}


function exportTopAirlines(flightData) {
    const topAirlines = {};
    flightData.features.forEach(f => {
        const flightNumber = f.properties['Flight Number'];
        const airlineCode = flightNumber.substring(0, 2);
        const airlineInfo = airLineCodeJSON.find(a => a.code === airlineCode);
        const airline = airlineInfo ? airlineInfo.name : airlineCode; // Fallback to code if name not found
        topAirlines[airline] = {
            count: (topAirlines[airline] || { count: 0 }).count + 1,
            logoURL: airlineInfo ? airlineInfo.logo : null
        };
    });

    // Convert to array and sort by count
    const sortedAirlines = Object.entries(topAirlines).sort((a, b) => b[1].count - a[1].count);
    // const topAirlines = sortedAirlines//.slice(0, 5); // Get top 5 airlines

    // Create HTML output
    const output = sortedAirlines.map(
        ([airline, { count, logoURL }]) => 
        `
        <tr>
        <td>${logoURL ? `<img src="${logoURL}" alt="${airline}" class="airline-logo">` : ''}${airline}</td>
        <td>${count}</td>
        </tr>`).join('');
    const header = `
    <thead>
        <tr>
            <th>Airline</th>
            <th>Total Flights</th>
        </tr>
    </thead>`;
    document.getElementById('top-airlines').innerHTML = header + `<tbody>` + output + `</tbody>`;
}

function getAircraftCountry(aircraft) {
    // define a mapping 'Airbus':'eu', 'Boeing':'us', 'COMAC': 'cn'
    const mapping = {
        'Airbus': 'eu',
        'Boeing': 'us',
        'COMAC': 'cn',
        'Embraer': 'br',
        'Bombardier': 'ca',
        'Mitsubishi': 'jp',
        'Tupolev': 'ru',
        'Sukhoi': 'ru',
        'Ilyushin': 'ru',
    };

    for (const key in mapping) {
        if (aircraft.includes(key)) {
            return mapping[key];
        }
    }
    return null; // Return null if no match found
}


function exportTopAircrafts(flightData) {
    const topAircrafts = {};
    flightData.features.forEach(f => {
        const aircraft = f.properties['Aircraft'] || 'Unknown';
        topAircrafts[aircraft] = {
            count: (topAircrafts[aircraft] || { count: 0 }).count + 1,
            country: getAircraftCountry(aircraft)
        };
    });

    // Convert to array and sort by count
    const sortedAircrafts = Object.entries(topAircrafts).sort((a, b) => b[1].count - a[1].count);
    // const topAircrafts = sortedAircrafts.slice(0, 5); // Get top 5 aircrafts

    // Create HTML output
    const output = sortedAircrafts.map(
        ([aircraft, { count, country }]) => 
        `
        <tr>
        <td>${country ? getFlagIcon(country) : ''} ${aircraft}</td>
        <td>${count}</td>
        </tr>`).join('');
    const header = `
    <thead>
        <tr>
            <th>Aircraft</th>
            <th>Total Flights</th>
        </tr>
    </thead>`;
    document.getElementById('top-aircrafts').innerHTML = header + `<tbody>` + output + `</tbody>`;
}


initMap();


// Add event listener to handle window resize and adjust map size accordingly
window.addEventListener('resize', () => {
    map.resize();
});