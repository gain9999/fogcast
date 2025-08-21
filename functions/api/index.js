export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const SF_LAT = 37.7749;
      const SF_LON = -122.4194;
      
      const response = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${SF_LAT}&lon=${SF_LON}`,
        {
          headers: {
            'User-Agent': 'fogcast/1.0 (github.com/user/fogcast)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Yr.no API error: ${response.status}`);
      }

      const data = await response.json();
      const forecast = extractFogForecast(data);

      return new Response(JSON.stringify(forecast, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch fog forecast',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

function extractFogForecast(data) {
  const now = new Date().toISOString();
  const timeseries = data.properties.timeseries;
  
  const current = timeseries[0];
  const forecast24h = timeseries.slice(0, 24);
  
  const currentDetails = current.data.instant.details;
  const fogForecast = forecast24h.map(entry => {
    const details = entry.data.instant.details;
    return {
      time: entry.time,
      fog_area_fraction: details.fog_area_fraction || 0,
      relative_humidity: details.relative_humidity,
      cloud_area_fraction: details.cloud_area_fraction
    };
  });

  return {
    location: "San Francisco, CA",
    coordinates: { lat: 37.7749, lon: -122.4194 },
    updated: now,
    current: {
      fog_area_fraction: currentDetails.fog_area_fraction || 0,
      relative_humidity: currentDetails.relative_humidity,
      cloud_area_fraction: currentDetails.cloud_area_fraction,
      visibility_status: getFogStatus(currentDetails.fog_area_fraction || 0)
    },
    forecast_24h: fogForecast
  };
}

function getFogStatus(fogFraction) {
  if (fogFraction >= 75) return "Heavy fog";
  if (fogFraction >= 50) return "Moderate fog";
  if (fogFraction >= 25) return "Light fog";
  if (fogFraction > 0) return "Patches of fog";
  return "Clear";
}