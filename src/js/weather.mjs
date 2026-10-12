async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchLocations(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedQuery)}&count=5&language=en&format=json`;

  try {
    const data = await fetchJson(url);
    const locations = Array.isArray(data?.results) ? data.results : [];

    return locations
      .filter(
        (location) =>
          location &&
          typeof location.name === 'string' &&
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number',
      )
      .filter(
        (location, index, items) =>
          items.findIndex(
            (item) =>
              item.name === location.name &&
              item.latitude === location.latitude &&
              item.longitude === location.longitude,
          ) === index,
      );
  } catch {
    return [];
  }
}

export async function fetchWeatherForLocation(latitude, longitude, unit = 'c') {
  const temperatureUnit = unit === 'f' ? 'fahrenheit' : 'celsius';
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${temperatureUnit}&timezone=auto&forecast_days=5`;
  const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi&timezone=auto`;

  try {
    const [forecast, airQuality] = await Promise.all([
      fetchJson(forecastUrl),
      fetchJson(airQualityUrl),
    ]);

    if (!forecast || !airQuality) {
      throw new Error('Weather data could not be loaded.');
    }

    return { forecast, airQuality };
  } catch {
    throw new Error('Weather data could not be loaded.');
  }
}
