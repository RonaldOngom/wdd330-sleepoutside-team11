const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `Weather service returned ${response.status}. Please try again.`,
      );
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function searchPlaces(query) {
  const params = new URLSearchParams({
    name: query.trim(),
    count: '6',
    language: 'en',
    format: 'json',
  });
  const data = await fetchJson(`${GEOCODING_URL}?${params}`);
  return Array.isArray(data.results) ? data.results : [];
}

export async function getTripConditions(place) {
  const coordinates = {
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: 'auto',
  };
  const forecastParams = new URLSearchParams({
    ...coordinates,
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    forecast_days: '7',
  });
  const airQualityParams = new URLSearchParams({
    ...coordinates,
    current: 'us_aqi,pm2_5,pm10',
  });

  const [forecast, airQualityResult] = await Promise.allSettled([
    fetchJson(`${FORECAST_URL}?${forecastParams}`),
    fetchJson(`${AIR_QUALITY_URL}?${airQualityParams}`),
  ]);

  if (forecast.status === 'rejected') {
    throw forecast.reason;
  }
  if (!forecast.value.current || !forecast.value.daily?.time?.length) {
    throw new Error(
      'The forecast response was incomplete. Please try another place.',
    );
  }

  return {
    forecast: forecast.value,
    airQuality:
      airQualityResult.status === 'fulfilled' ? airQualityResult.value : null,
  };
}
