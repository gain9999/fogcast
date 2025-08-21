# Fogcast

A curl-friendly API for San Francisco fog forecasts using yr.no data.

## Usage

```bash
curl https://your-domain.pages.dev/api
```

Returns JSON with current fog conditions and 24-hour forecast.

## Deployment

1. Install dependencies: `npm install`
2. Deploy to Cloudflare Pages: `npm run deploy`

## API Response

```json
{
  "location": "San Francisco, CA",
  "coordinates": { "lat": 37.7749, "lon": -122.4194 },
  "updated": "2025-08-21T...",
  "current": {
    "fog_area_fraction": 45,
    "relative_humidity": 85,
    "cloud_area_fraction": 90,
    "visibility_status": "Moderate fog"
  },
  "forecast_24h": [...]
}
```