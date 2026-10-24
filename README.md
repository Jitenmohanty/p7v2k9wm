# Wind Outlook

Wind Outlook is a pilot dashboard for reviewing GB national wind generation forecasts at a day-ahead decision cutoff and comparing those forecasts with actual generation. It uses only Elexon BMRS Insights `WINDFOR` and `FUELHH` data.

## What the pilot shows

- A delivery-day half-hour profile comparing the selected forecast vintage with actual wind generation.
- The latest forecast publication available by the selected decision cutoff for each settlement interval.
- January 2026 forecast accuracy: MAE, RMSE, bias, WAPE, data coverage, and a day-by-day error view.
- A clear error sign convention: `forecast − actual`; positive means the wind forecast was higher than the outturn.

The selected date is the **decision date**. Delivery is the following day. The January 2026 decision window therefore covers delivery dates 2 January through 1 February 2026. The default reference cutoff is 09:20 Europe/London for the GB day-ahead 60-minute auction; the cutoff can be changed in the dashboard. This is a historical analysis tool, not an automated trading or procurement recommendation system.

This pilot cannot calculate the utility’s total procurement gap because demand and non-wind generation data are outside the agreed scope.

## Data and analysis

The backend calls Elexon’s public Insights API ([developer portal](https://developer.data.elexon.co.uk/)):

- [`GET /datasets/FUELHH/stream`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) with settlement date filters for 2 January–1 February 2026 and `fuelType=WIND`.
- [`GET /datasets/WINDFOR/stream`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) with publication-time filters from 31 December 2025 through 31 January 2026.

For each half-hour delivery interval, the service picks the newest forecast `publishTime` at or before that decision date’s cutoff, then joins it to the latest available wind outturn for the same `startTime`. January has 48 half-hour intervals per delivery date, so period coverage is measured against 1,488 expected intervals. Missing or unmatched observations are excluded from error metrics and remain visible as missing values; they are not filled or inferred.

Elexon describes the WINDFOR series as hourly values across its forecast horizon ([WINDFOR glossary](https://www.elexon.co.uk/bsc/glossary/wind-generation-forecast/)); FUELHH actuals are half-hourly. This implementation scores exact `startTime` matches only and does not interpolate the hourly forecast to half-hour periods. A full day can therefore have 24 matched samples out of 48 expected half-hour periods, and the dashboard exposes that coverage.

The default 09:20 Europe/London reference is based on EPEX SPOT’s published GB 60-minute day-ahead auction timing ([EPEX SPOT announcement](https://www.epexspot.com/en/news/exchange-council-welcomes-new-timing-gb-day-ahead-auction)). The cutoff is shown in the interface and can be changed for sensitivity review.

Metric definitions:

- **MAE**: mean absolute forecast error in MW.
- **RMSE**: square root of mean squared forecast error in MW.
- **Bias**: mean of `forecast − actual` in MW. A positive value indicates over-forecast wind.
- **WAPE**: sum of absolute errors divided by the sum of actual generation, shown as a percentage.
- **Coverage**: matched intervals divided by expected intervals.

The API response is cached in-process for 15 minutes. The application needs outbound access to Elexon. If Elexon is unavailable, the UI shows an error and retry action rather than substituting sample data.

## Start with Docker

From the repository root:

```bash
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000). The same container serves the built React app and the FastAPI endpoints. Check the API health at [http://localhost:8000/api/health](http://localhost:8000/api/health).

## Local development

Run the API and React dev server in separate terminals.

Backend:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
cd backend
uvicorn app.main:app --reload --port 8000
```

Frontend, from the repository root in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` calls to the local FastAPI service. For a separately hosted API, set `VITE_API_BASE_URL` in the frontend environment before building and configure `CORS_ORIGINS` on the backend.

## Tests and build checks

```bash
# Backend unit and API/service integration tests
python -m pytest backend

# Frontend component/API tests
npm --prefix frontend test

# TypeScript check and production build
npm --prefix frontend run build
```

The tests cover metric calculations and signs, latest-vintage selection at the cutoff, dataset-specific Elexon query parameters, API validation, service data joining, caching, frontend rendering, date selection, API errors, and retry affordance.

## Repository layout

```text
backend/
  app/
    analysis.py      Forecast selection, interval matching, and accuracy metrics
    config.py        January 2026 window, cutoff, timezone, and cache settings
    elexon.py        HTTP adapter for the FUELHH and WINDFOR stream endpoints
    main.py          FastAPI app, routes, CORS, and built React static serving
    service.py       Month-window retrieval and short-lived in-process cache
  main.py            FastAPI entry point used by Vercel Services
  tests/             Backend unit and integration tests
  requirements.txt   Runtime dependencies
  requirements-dev.txt Test dependencies
frontend/
  src/
    components/      Focused chart, metric, brand, and table components
    App.tsx          Dashboard layout and interaction state
    api.ts           Typed backend client
    format.ts        Number and date presentation helpers
    types.ts         API response contracts
    *.test.ts(x)     Frontend unit and integration tests
  index.html         HTML entry point and metadata
  package.json       Frontend scripts and pinned dependencies
  vite.config.ts     React build, test setup, and local API proxy
Dockerfile           Multi-stage React build and Python application image
docker-compose.yml   Local container startup
heroku.yml           Heroku container deployment configuration
vercel.json          Vercel frontend/backend service routing and build settings
README.md            Product, data, setup, testing, and architecture notes
```

## Deployment

The Vercel project configuration in `vercel.json` builds the React frontend and FastAPI backend as two services in one deployment. `/api/*` is routed to Python, while all other paths go to the Vite single-page app. The Python service uses `backend/main.py` as its FastAPI entry point. Vercel Services is currently in Beta.

After connecting the repository to Vercel and selecting the intended team, deploy from the repository root:

```bash
vercel deploy
```

The public deployment URL will be added here after the app is deployed and checked. The same project can also be run with Docker; `Dockerfile`, `docker-compose.yml`, and `heroku.yml` provide the container path for local use or a container host.

## AI-assisted development

OpenAI Codex was used to help plan, implement, and test this application. The code and data interpretation should receive human review before any production or trading use.
