# Fogcast

Real-time fog forecast for Golden Gate Bridge Vista Point in San Francisco. Features both a web interface and REST API using data from the Norwegian Meteorological Institute (Yr.no).

## Features

- 🌫️ Real-time fog conditions and visibility status
- ⏰ 24-hour hourly fog forecast
- 📅 8-day extended weather forecast with morning/afternoon/night periods
- 🔍 SEO-optimized web interface with structured data
- 🔗 REST API for developers and automation
- 📱 Mobile-responsive design

## Live Site

Visit [fogcast.in](https://fogcast.in) for the web interface or use the API endpoints below.

## API Usage

### REST API Endpoint
```bash
curl https://fogcast.in/api
```

### JSON Response from Main Page
```bash
curl https://fogcast.in?format=json
```

Both endpoints return identical JSON data with current conditions, 24-hour forecast, and 8-day extended forecast.

## API Response Format

```json
{
  "location": "Golden Gate Bridge Vista Point South, San Francisco",
  "coordinates": { "lat": 37.80734, "lon": -122.47477 },
  "updated": "August 25, 2025 at 10:30:45 AM PDT",
  "current": {
    "fog_area_fraction": 15,
    "relative_humidity": 78,
    "cloud_area_fraction": 45,
    "status": "Clear"
  },
  "forecast_24h": [
    {
      "time": "11:00 AM",
      "fog_area_fraction": 20,
      "relative_humidity": 80,
      "cloud_area_fraction": 50,
      "status": "Clear"
    }
  ],
  "forecast_1d": {
    "morning": "partlycloudy",
    "afternoon": "fair", 
    "night": "clearsky"
  }
}
```

## Fog Status Categories

- **Clear** (0% fog coverage) - Perfect bridge visibility
- **Patches of fog** (1-24%) - Generally good visibility
- **Light fog** (25-49%) - Partially obscured bridge
- **Moderate fog** (50-74%) - Significantly reduced visibility
- **Heavy fog** (75-100%) - Bridge likely not visible

## Best Viewing Times

Look for periods with **0-25% fog coverage** for optimal Golden Gate Bridge photography and viewing opportunities.

## Development

This is a Cloudflare Pages application with serverless functions.

### Local Development
```bash
npm install
wrangler pages dev
```

### Deployment
Deploy directly through Cloudflare Pages dashboard or:
```bash
wrangler pages deploy
```

## Architecture

- **Main Function** (`/functions/index.js`) - Handles content negotiation, returns HTML for browsers and JSON for API requests
- **API Endpoint** (`/functions/api.js`) - Dedicated REST endpoint, processes Yr.no weather data
- **Data Source** - Norwegian Meteorological Institute (Yr.no) LocationForecast API

## License

Weather data provided by [Yr.no](https://yr.no) (Norwegian Meteorological Institute) under Creative Commons license.