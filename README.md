# BYU-Pathway Worldwide Online

## WDD 330 - Web Frontend Development II

### ⛺ SleepOutside Starter Code

- This repository is the start of the SleepOutside web application project for WDD 330. The repository contains branches which are checkpoints for the team and individual assignments throughout the course.

- <https://byui-cse.github.io/wdd330-ww-course/week01/team.html>

### Prerequisites

- You must have Node installed to run the following commands.
[WDD 330 Setup Environment](https://byui-cse.github.io/wdd330-ww-course/intro/)

### Common Workflow Commands

- `npm run lint` to run ESLint against your code to find errors.
- `npm run format` to run Prettier to automatically format your code.
- `npm run start` starts up a local server and updates on any JS or CSS/SCSS.
- `npm run preview` runs the production build locally for deployment-style testing.
- `npm run build` to build final files when you are ready to turn in.
- `npm run test` to run the cart storage tests.

Before committing, run `npm run format`, `npm run lint`, and `npm run test`. Build
the production version with `npm run build`; Vite writes the deployable site to
`dist/`.

---

_BYU-Pathway Worldwide improves lives through access to spiritually based, online affordable higher education. Its mission is to develop disciples of Jesus Christ who are leaders in their homes, the Church, and their communities._

## Fieldnotes trip planner

Fieldnotes is a separate, responsive outdoor-trip planning application included
in this repository. The original SleepOutside storefront remains available at
the site root; Fieldnotes is available at `/fieldnotes/`.

### Run and build

Use the existing project commands:

- `npm run start` and open `/fieldnotes/` for local development.
- `npm run build` to build both the storefront and Fieldnotes for deployment.
- `npm run preview` to check the production build locally.

### Project highlights

- Searches worldwide locations using the Open-Meteo Geocoding API.
- Loads seven-day forecasts and separate air-quality data from Open-Meteo.
- Renders current conditions, seven daily forecast cards, sunrise/sunset,
  daylight duration, UV index, and air-quality guidance from API JSON.
- Supports place search, refresh, saving/removing places, Celsius/Fahrenheit,
  and persistent light/dark themes.
- Saves the selected unit, theme, saved places, and last viewed place in
  `localStorage`.
- Includes responsive layouts, hover/transition states, motion effects,
  keyboard-accessible controls, and reduced-motion support.

Open-Meteo provides the live data; location search and weather conditions need
an internet connection. Air quality is treated as optional so the forecast can
still be used while that service is unavailable.

### Skills demonstration checklist

Use Fieldnotes as one of the projects documented in the W07 Skills Development
document. When completing the submission, include your own name, public app
URL, source repository URL, Trello board URL, and public video URL. Those
personal and deployment links are intentionally not invented in this
repository. In the video, demonstrate a place search, forecast, saved-place
interaction, unit/theme settings, and the corresponding implementation in
`src/fieldnotes/`.
