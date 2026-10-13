import { getTripConditions, searchPlaces } from './api.js';

const STORAGE_KEY = 'fieldnotes-preferences';
const DEFAULT_PLACE = {
  name: 'Moab',
  admin1: 'Utah',
  country: 'United States',
  country_code: 'US',
  latitude: 38.5733,
  longitude: -109.5498,
  timezone: 'America/Denver',
};

const elements = {
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#location-search'),
  searchResults: document.querySelector('#search-results'),
  status: document.querySelector('#app-status'),
  forecast: document.querySelector('#forecast-content'),
  conditions: document.querySelector('#conditions-content'),
  savedPlaces: document.querySelector('#saved-places-list'),
  unitToggle: document.querySelector('#unit-toggle'),
  unitLabel: document.querySelector('#unit-label'),
  themeToggle: document.querySelector('#theme-toggle'),
  refresh: document.querySelector('#refresh-button'),
};

function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      unit: value.unit === 'F' ? 'F' : 'C',
      theme: value.theme === 'dark' ? 'dark' : 'light',
      places: Array.isArray(value.places) ? value.places : [],
      lastPlace:
        value.lastPlace && typeof value.lastPlace === 'object'
          ? value.lastPlace
          : null,
    };
  } catch {
    return { unit: 'C', theme: 'light', places: [], lastPlace: null };
  }
}

const state = {
  ...readPreferences(),
  activePlace: null,
  conditions: null,
  requestId: 0,
  searchRequestId: 0,
};

function placeIdentity(place) {
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

function savePreferences() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      unit: state.unit,
      theme: state.theme,
      places: state.places,
      lastPlace: state.lastPlace,
    }),
  );
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function placeLabel(place) {
  return [place.name, place.admin1, place.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ');
}

function degrees(celsius) {
  const value = state.unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

function describeWeather(code) {
  if (code === 0) return { label: 'Clear sky', icon: '☀' };
  if (code === 1) return { label: 'Mostly clear', icon: '◒' };
  if (code === 2) return { label: 'Partly cloudy', icon: '◒' };
  if (code === 3) return { label: 'Overcast', icon: '☁' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '≋' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: 'Rain', icon: '☂' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: 'Snow', icon: '❄' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: 'ϟ' };
  return { label: 'Changing conditions', icon: '◌' };
}

function formatDay(dateString, index) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
  });
}

function formatClock(dateString) {
  if (!dateString) return 'Unavailable';
  const time = dateString.split('T')[1];
  if (!time) return 'Unavailable';
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setStatus(message, kind = '') {
  elements.status.textContent = message;
  elements.status.className = `status-message${kind ? ` status-message--${kind}` : ''}`;
}

function setSearchOpen(open) {
  elements.searchResults.hidden = !open;
  elements.searchInput.setAttribute('aria-expanded', String(open));
}

function makeButton(text, className, handler, label = text) {
  const button = element('button', className, text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.addEventListener('click', handler);
  return button;
}

function renderSearchResults(places) {
  elements.searchResults.replaceChildren();

  if (!places.length) {
    const empty = element(
      'p',
      'search-empty',
      'No places found. Try a nearby city or region.',
    );
    elements.searchResults.append(empty);
    setSearchOpen(true);
    return;
  }

  places.forEach((place, index) => {
    const button = makeButton(
      '',
      'search-result',
      () => loadPlace(place),
      `Show forecast for ${placeLabel(place)}`,
    );
    button.setAttribute('role', 'option');
    button.dataset.index = String(index);
    const name = element('span', 'search-result__name', place.name);
    const detail = element(
      'span',
      'search-result__detail',
      [place.admin1, place.country].filter(Boolean).join(', '),
    );
    button.append(name, detail);
    elements.searchResults.append(button);
  });
  setSearchOpen(true);
}

function renderLoading(place) {
  elements.forecast.replaceChildren();
  const loading = element('div', 'loading-state');
  loading.append(
    element('span', 'loading-orb'),
    element('p', '', `Finding the forecast for ${place.name}…`),
  );
  elements.forecast.append(loading);
  elements.conditions.querySelectorAll('.condition-value').forEach((value) => {
    value.textContent = '—';
  });
}

function renderForecast() {
  const { forecast } = state.conditions;
  const { current, daily } = forecast;
  const currentWeather = describeWeather(current.weather_code);
  const section = element('div', 'forecast-layout');
  const hero = element('article', 'current-card');
  const heroTop = element('div', 'current-card__top');
  const location = element('div', 'current-location');
  location.append(
    element('span', 'location-pin', '⌖'),
    element('span', '', placeLabel(state.activePlace)),
  );

  const saved = state.places.some(
    (place) => placeIdentity(place) === placeIdentity(state.activePlace),
  );
  const saveButton = makeButton(
    saved ? '★' : '☆',
    `favorite-button${saved ? ' favorite-button--saved' : ''}`,
    () => toggleSavedPlace(state.activePlace),
    saved ? 'Remove this place from saved places' : 'Save this place',
  );
  heroTop.append(location, saveButton);

  const currentMain = element('div', 'current-card__main');
  const currentCopy = element('div', 'current-card__copy');
  currentCopy.append(
    element('p', 'eyebrow eyebrow--light', 'RIGHT NOW'),
    element('p', 'current-temperature', degrees(current.temperature_2m)),
    element('p', 'current-description', currentWeather.label),
  );
  const currentIcon = element('span', 'weather-symbol', currentWeather.icon);
  currentIcon.setAttribute('aria-hidden', 'true');
  currentMain.append(currentCopy, currentIcon);

  const currentMeta = element('div', 'current-card__meta');
  currentMeta.append(
    element('span', '', `Feels like ${degrees(current.apparent_temperature)}`),
    element('span', '', `${current.relative_humidity_2m}% humidity`),
    element('span', '', `${Math.round(current.wind_speed_10m)} km/h wind`),
  );
  hero.append(heroTop, currentMain, currentMeta);

  const forecastHeading = element('div', 'forecast-strip-heading');
  forecastHeading.append(
    element('p', 'eyebrow', 'SEVEN-DAY OUTLOOK'),
    element('p', '', 'A good week to get outside'),
  );
  const strip = element('div', 'forecast-strip');

  daily.time.forEach((date, index) => {
    const weather = describeWeather(daily.weather_code[index]);
    const day = element('article', 'day-card');
    const icon = element('span', 'day-card__icon', weather.icon);
    icon.setAttribute('aria-hidden', 'true');
    day.append(
      element('p', 'day-card__day', formatDay(date, index)),
      icon,
      element('p', 'day-card__condition', weather.label),
      element(
        'p',
        'day-card__temperature',
        `${degrees(daily.temperature_2m_max[index])} / ${degrees(daily.temperature_2m_min[index])}`,
      ),
      element(
        'p',
        'day-card__rain',
        `${daily.precipitation_probability_max[index] ?? 0}% chance of rain`,
      ),
    );
    strip.append(day);
  });

  section.append(hero, element('div', 'forecast-strip-wrap'));
  section.lastElementChild.append(forecastHeading, strip);
  elements.forecast.replaceChildren(section);
}

function airQualityDescription(aqi) {
  if (aqi === null || aqi === undefined) return 'Not available right now';
  if (aqi <= 50) return 'Good · great for getting outside';
  if (aqi <= 100) return 'Moderate · sensitive groups take care';
  if (aqi <= 150) return 'Sensitive groups should limit exertion';
  return 'Consider rescheduling strenuous activity';
}

function renderConditions() {
  const { forecast, airQuality } = state.conditions;
  const today = forecast.daily;
  const daylightMinutes = Math.max(
    0,
    (new Date(today.sunset[0]) - new Date(today.sunrise[0])) / 60000,
  );
  const daylightHours = Math.floor(daylightMinutes / 60);
  const daylightRemainder = Math.round(daylightMinutes % 60);
  const aqi = airQuality?.current?.us_aqi ?? null;
  const values = [
    {
      label: 'Sunrise',
      value: formatClock(today.sunrise[0]),
      note: 'Local time',
      icon: '◷',
    },
    {
      label: 'Air quality',
      value: aqi === null ? '—' : `${Math.round(aqi)} AQI`,
      note: airQualityDescription(aqi),
      icon: '◉',
    },
    {
      label: 'UV index',
      value:
        today.uv_index_max?.[0] === undefined
          ? '—'
          : String(Math.round(today.uv_index_max[0])),
      note:
        today.uv_index_max?.[0] >= 6
          ? 'Sun protection recommended'
          : 'Today’s peak',
      icon: '↗',
    },
    {
      label: 'Daylight',
      value: `${daylightHours}h ${daylightRemainder}m`,
      note: `Sunset ${formatClock(today.sunset[0])}`,
      icon: '◌',
    },
  ];

  elements.conditions.replaceChildren();
  values.forEach((item) => {
    const card = element('article', 'condition-card');
    const icon = element('span', 'condition-icon', item.icon);
    icon.setAttribute('aria-hidden', 'true');
    card.append(
      icon,
      element('p', 'condition-label', item.label),
      element('p', 'condition-value', item.value),
      element('p', 'condition-note', item.note),
    );
    elements.conditions.append(card);
  });
}

function renderSavedPlaces() {
  elements.savedPlaces.replaceChildren();
  if (!state.places.length) {
    elements.savedPlaces.append(
      element(
        'p',
        'saved-empty',
        'Save a place from its forecast and it will be waiting here.',
      ),
    );
    return;
  }

  state.places.forEach((place) => {
    const card = element('article', 'saved-place');
    const openButton = makeButton(
      '',
      'saved-place__open',
      () => loadPlace(place),
      `Show forecast for ${placeLabel(place)}`,
    );
    const marker = element('span', 'saved-place__marker', '⌖');
    const copy = element('span', 'saved-place__copy');
    copy.append(
      element('span', 'saved-place__name', place.name),
      element(
        'span',
        'saved-place__detail',
        [place.admin1, place.country].filter(Boolean).join(', '),
      ),
    );
    openButton.append(
      marker,
      copy,
      element('span', 'saved-place__arrow', '↗'),
    );
    const removeButton = makeButton(
      '×',
      'saved-place__remove',
      () => toggleSavedPlace(place),
      `Remove ${place.name} from saved places`,
    );
    card.append(openButton, removeButton);
    elements.savedPlaces.append(card);
  });
}

function toggleSavedPlace(place) {
  const identity = placeIdentity(place);
  const exists = state.places.some((item) => placeIdentity(item) === identity);
  state.places = exists
    ? state.places.filter((item) => placeIdentity(item) !== identity)
    : [{ ...place }, ...state.places];
  savePreferences();
  renderSavedPlaces();
  if (
    state.activePlace &&
    placeIdentity(state.activePlace) === identity &&
    state.conditions
  ) {
    renderForecast();
  }
}

async function loadPlace(place) {
  const currentRequest = ++state.requestId;
  state.activePlace = place;
  state.lastPlace = place;
  state.conditions = null;
  elements.searchInput.value = place.name;
  setSearchOpen(false);
  setStatus('');
  savePreferences();
  renderLoading(place);

  try {
    const conditions = await getTripConditions(place);
    if (currentRequest !== state.requestId) return;
    state.conditions = conditions;
    renderForecast();
    renderConditions();
    setStatus(
      conditions.airQuality
        ? `Forecast updated for ${place.name}.`
        : `Forecast updated for ${place.name}; air quality is temporarily unavailable.`,
      conditions.airQuality ? 'success' : 'notice',
    );
  } catch (error) {
    if (currentRequest !== state.requestId) return;
    state.conditions = null;
    elements.forecast.replaceChildren();
    const errorCard = element('div', 'error-state');
    errorCard.append(
      element('span', 'error-state__icon', '↗'),
      element('p', 'error-state__title', 'We couldn’t get that forecast.'),
      element(
        'p',
        'error-state__message',
        error.message || 'Check your connection and try again.',
      ),
      makeButton('Try again', 'search-button error-state__button', () =>
        loadPlace(place),
      ),
    );
    elements.forecast.append(errorCard);
    setStatus(
      'Your place is saved, but current forecast data could not be loaded.',
      'error',
    );
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (!query) {
    setStatus('Enter a city or place to search.', 'error');
    elements.searchInput.focus();
    return;
  }

  setStatus(`Searching for ${query}…`);
  setSearchOpen(false);
  const currentSearch = ++state.searchRequestId;
  try {
    const places = await searchPlaces(query);
    if (currentSearch !== state.searchRequestId) return;
    renderSearchResults(places);
    setStatus(
      places.length
        ? `${places.length} matching places found.`
        : 'No matching places found.',
      places.length ? '' : 'notice',
    );
  } catch (error) {
    if (currentSearch !== state.searchRequestId) return;
    setStatus(
      error.message ||
        'Place search failed. Check your connection and try again.',
      'error',
    );
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  elements.themeToggle.setAttribute(
    'aria-label',
    state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );
  elements.themeToggle.innerHTML =
    state.theme === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.3 8.3 0 0 1 8.9 3.8 8.4 8.4 0 1 0 20.2 15Z" /></svg>';
}

elements.searchForm.addEventListener('submit', handleSearch);
elements.searchInput.addEventListener('input', () => {
  state.searchRequestId += 1;
  if (elements.searchInput.value.trim()) setStatus('');
  if (!elements.searchInput.value.trim()) setSearchOpen(false);
});
elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setSearchOpen(false);
});
elements.searchResults.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSearchOpen(false);
    elements.searchInput.focus();
  }
});
elements.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'C' ? 'F' : 'C';
  elements.unitLabel.textContent = `°${state.unit}`;
  savePreferences();
  if (state.conditions) renderForecast();
});
elements.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  savePreferences();
});
elements.refresh.addEventListener('click', () => {
  if (state.activePlace) loadPlace(state.activePlace);
});
document.addEventListener('click', (event) => {
  if (!elements.searchForm.contains(event.target)) setSearchOpen(false);
});

elements.unitLabel.textContent = `°${state.unit}`;
applyTheme();
renderSavedPlaces();
loadPlace(state.lastPlace || DEFAULT_PLACE);
