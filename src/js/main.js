import { getLocalStorage, setLocalStorage } from './utils.mjs';
import { initWeatherPanel } from './weatherUI.mjs';

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = normalizedTheme;
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent =
      normalizedTheme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
    toggle.setAttribute(
      'aria-label',
      `Switch to ${normalizedTheme === 'dark' ? 'light' : 'dark'} mode`,
    );
  }
}

function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const savedTheme = getLocalStorage('theme', 'light');
  applyTheme(savedTheme);

  toggle.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    setLocalStorage('theme', nextTheme);
    applyTheme(nextTheme);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initWeatherPanel();
});
