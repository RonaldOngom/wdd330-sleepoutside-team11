export async function searchLocations(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedQuery)}&count=5&language=en&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Location search failed.');
  }

  const data = await response.json();
  return data.results || [];
}

export async function fetchWeatherForLocation(latitude, longitude, unit = 'c') {
  const temperatureUnit = unit === 'f' ? 'fahrenheit' : 'celsius';

  const [forecastResponse, airQualityResponse] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${temperatureUnit}&timezone=auto&forecast_days=5`,
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi&timezone=auto`,
    ),
  ]);

  if (!forecastResponse.ok || !airQualityResponse.ok) {
    throw new Error('Weather data could not be loaded.');
  }

  const forecast = await forecastResponse.json();
  const airQuality = await airQualityResponse.json();

  return { forecast, airQuality };
}
