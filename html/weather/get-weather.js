function getWindIcon(windspeed) {

    baseURL = "https://cdn.meteocons.com/3.0.0-next.10/svg/flat/"
    if (windspeed < 3) {
        return baseURL + "windsock-calm.svg";
    } else if (windspeed < 10) {
        return baseURL + "windsock-weak.svg";
    } else if (windspeed < 25) {
        return baseURL + "windsock-moderate.svg";
    } else {
        return baseURL + "windsock.svg";
    }
}

async function getWeather() {
    // Get approximate location from IP
    // Example
    // const lat = 46.515848;
    // const lon = 6.563157;
    // const city = "Ecublens";

    const locRes = await fetch("http://ip-api.com/json/");
    const locData = await locRes.json();

    const { lat, lon, city } = locData;



    // Fetch weather
    const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );


    const weatherData = await weatherRes.json();
    if (weatherData.current_weather) {
        const { temperature, weathercode, is_day, windspeed } = weatherData.current_weather;

        const day_night = is_day ? "day" : "night";

        

        const weatherCodeSheet = await fetch("/html/descriptions.json");
        const weatherCodeData = await weatherCodeSheet.json();


        const weatherDescription = weatherCodeData[weathercode][day_night]['description'] || "Unknown weather condition";
        const weatherIcon = weatherCodeData[weathercode][day_night]['image'] || "unknown.png";
        document.getElementById("local-weather").innerHTML = `
            <img class="weather-icon" src=${weatherIcon}> ${city}, ${weatherDescription}, ${temperature}°C  <img class="weather-icon" src="${getWindIcon(windspeed)}">
        `;
    } else {
        console.log("Could not fetch weather data of location");

    }
}

getWeather();