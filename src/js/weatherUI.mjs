import { getLocalStorage, setLocalStorage } from './utils.mjs';
import { fetchWeatherForLocation, searchLocations } from './weather.mjs';

const STORAGE_KEYS = {
  location: 'sleepoutside-weather-location',
  unit: 'sleepoutside-weather-unit',
};

const state = {
  unit: 'c',
  currentLocation: null,
  currentForecast: null,
  currentAirQuality: null,
};

function pickWeatherDescription(code) {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Cloudy',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Heavy freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Showers',
    81: 'Heavy showers',
    82: 'Violent showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Hail storm',
    99: 'Severe storm',
  };

  return descriptions[code] || 'Changing conditions';
}

function formatTemperature(value, unit = state.unit) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return '—';
  }

  return `${Math.round(Number(value))}°${unit.toUpperCase()}`;
}

function formatDay(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function renderSearchResults(results, onSelect) {
  const container = document.getElementById('weather-results');
  if (!container) return;

  if (!results.length) {
    container.innerHTML =
      '<p class="weather-empty">No matching locations were found.</p>';
    return;
  }

  const buttons = results
    .map(
      (result) => `
        <button type="button" class="weather-result" data-name="${result.name}">
          ${result.name}${result.admin1 ? `, ${result.admin1}` : ''}${result.country ? `, ${result.country}` : ''}
        </button>
      `,
    )
    .join('');

  container.innerHTML = `<div class="weather-result-list">${buttons}</div>`;

  container.querySelectorAll('.weather-result').forEach((button) => {
    button.addEventListener('click', () => {
      const matchingResult = results.find(
        (result) => result.name === button.dataset.name,
      );
      if (matchingResult) {
        onSelect(matchingResult);
      }
    });
  });
}

function renderWeatherCards() {
  const container = document.getElementById('weather-results');
  if (!container || !state.currentForecast || !state.currentAirQuality) {
    return;
  }

  const current = state.currentForecast.current;
  const daily = state.currentForecast.daily;
  const cards = Array.from(
    { length: Math.min(5, daily.time.length) },
    (_, index) => {
      const date = daily.time[index];
      const low = daily.temperature_2m_min[index];
      const high = daily.temperature_2m_max[index];
      const rainChance = daily.precipitation_probability_max[index];
      const code = daily.weather_code[index];

      return `
      <article class="weather-card">
        <p class="weather-card__label">${formatDay(date)}</p>
        <h3>${formatTemperature(high)} / ${formatTemperature(low)}</h3>
        <p>${pickWeatherDescription(code)}</p>
        <span>Rain: ${rainChance}%</span>
      </article>
    `;
    },
  ).join('');

  const airQuality = state.currentAirQuality.current?.us_aqi ?? 'N/A';

  container.innerHTML = `
    <div class="weather-card-grid">
      <article class="weather-card weather-card--featured">
        <p class="weather-card__label">Now in ${state.currentLocation?.name || 'your area'}</p>
        <h3>${formatTemperature(current.temperature_2m)}</h3>
        <p>${pickWeatherDescription(current.weather_code)}</p>
        <span>Feels like ${formatTemperature(current.apparent_temperature)} · Humidity ${current.relative_humidity_2m}%</span>
      </article>
      <article class="weather-card weather-card--featured">
        <p class="weather-card__label">Air quality</p>
        <h3>${airQuality === 'N/A' ? 'N/A' : `${airQuality} AQI`}</h3>
        <p>${airQuality === 'N/A' ? 'Not available' : 'Good for trips'}</p>
        <span>${state.currentLocation?.country || ''}</span>
      </article>
      ${cards}
    </div>
  `;
}

function setUnitButtonText() {
  const toggle = document.getElementById('unit-toggle');
  if (!toggle) return;
  toggle.textContent = state.unit === 'c' ? '°C' : '°F';
}

function updateLocationName(locationName) {
  const locationElement = document.getElementById('weather-location-name');
  if (!locationElement) return;
  if (!locationName) {
    locationElement.textContent =
      'Search a location to see conditions for your next trip.';
    return;
  }
  locationElement.textContent = `${locationName}`;
}

async function loadLocationData(location) {
  const results = await searchLocations(location);
  if (!results.length) {
    const container = document.getElementById('weather-results');
    if (container) {
      container.innerHTML =
        '<p class="weather-empty">No matching locations were found.</p>';
    }
    return;
  }

  const firstResult = results[0];
  await selectLocation(firstResult);
}

async function selectLocation(location) {
  const container = document.getElementById('weather-results');
  if (!container) return;

  state.currentLocation = location;
  updateLocationName(`${location.name}, ${location.country || ''}`.trim());
  setLocalStorage(STORAGE_KEYS.location, location.name);

  container.innerHTML = '<p class="weather-empty">Loading forecast…</p>';

  try {
    const { forecast, airQuality } = await fetchWeatherForLocation(
      Number(location.latitude),
      Number(location.longitude),
      state.unit,
    );

    state.currentForecast = forecast;
    state.currentAirQuality = airQuality;
    renderWeatherCards();
  } catch {
    container.innerHTML =
      '<p class="weather-empty">Weather data could not be loaded for this location.</p>';
  }
}

export function initWeatherPanel() {
  const panel = document.getElementById('weather-panel');
  const searchInput = document.getElementById('weather-search');
  const searchButton = document.getElementById('weather-search-btn');
  const unitToggle = document.getElementById('unit-toggle');
  const refreshButton = document.getElementById('weather-refresh');
  const locationName = document.getElementById('weather-location-name');

  if (
    !panel ||
    !searchInput ||
    !searchButton ||
    !unitToggle ||
    !refreshButton ||
    !locationName
  ) {
    return;
  }

  if (panel.dataset.initialized === 'true') {
    return;
  }

  panel.dataset.initialized = 'true';

  const savedUnit = getLocalStorage(STORAGE_KEYS.unit, 'c');
  state.unit = savedUnit === 'f' ? 'f' : 'c';
  setUnitButtonText();

  const savedLocation = getLocalStorage(STORAGE_KEYS.location, 'Moab');
  if (savedLocation) {
    searchInput.value = savedLocation;
    updateLocationName(savedLocation);
    loadLocationData(savedLocation);
  }

  searchButton.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) {
      locationName.textContent =
        'Enter a location to search for camping weather.';
      return;
    }

    const results = await searchLocations(query);
    renderSearchResults(results, selectLocation);
  });

  searchInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    const results = await searchLocations(query);
    renderSearchResults(results, selectLocation);
  });

  unitToggle.addEventListener('click', () => {
    state.unit = state.unit === 'c' ? 'f' : 'c';
    setLocalStorage(STORAGE_KEYS.unit, state.unit);
    setUnitButtonText();

    if (state.currentLocation) {
      selectLocation(state.currentLocation);
    }
  });

  refreshButton.addEventListener('click', () => {
    const query =
      searchInput.value.trim() ||
      getLocalStorage(STORAGE_KEYS.location, 'Moab');
    if (query) {
      loadLocationData(query);
    }
  });
}
