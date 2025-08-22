export async function onRequest(context) {
  const { request, env, ctx } = context;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const SF_LAT = 37.80734;
      const SF_LON = -122.47477;
      
      // Check if we have cached data that hasn't expired
      const cacheKey = `https://cache.fogcast.local/weather-${SF_LAT}-${SF_LON}`;
      const cache = await caches.open('yr-no-weather');
      const cachedResponse = await cache.match(cacheKey);
      
      let requestHeaders = {
        'User-Agent': 'fogcast/1.0 (https://github.com/gain9999/fogcast) contact@example.com'
      };
      
      // If we have cached data, use If-Modified-Since for conditional request
      if (cachedResponse) {
        const lastModified = cachedResponse.headers.get('Last-Modified');
        if (lastModified) {
          requestHeaders['If-Modified-Since'] = lastModified;
        }
      }
      
      const response = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${SF_LAT}&lon=${SF_LON}`,
        { headers: requestHeaders }
      );

      if (response.status === 304 && cachedResponse) {
        // Data hasn't changed, return cached response
        const cachedData = await cachedResponse.json();
        return new Response(JSON.stringify(cachedData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=1800', // 30 minutes
            ...corsHeaders
          }
        });
      }

      if (!response.ok) {
        throw new Error(`Yr.no API error: ${response.status}`);
      }

      const data = await response.json();
      const forecast = extractFogForecast(data);
      
      // Cache the response respecting Expires header from yr.no
      const expires = response.headers.get('Expires');
      const lastModified = response.headers.get('Last-Modified');
      
      const cacheResponse = new Response(JSON.stringify(forecast), {
        headers: {
          'Last-Modified': lastModified || new Date().toUTCString(),
          'Expires': expires || new Date(Date.now() + 3600000).toUTCString() // 1 hour default
        }
      });
      
      await cache.put(cacheKey, cacheResponse.clone());

      return new Response(JSON.stringify(forecast, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800', // 30 minutes
          'Expires': expires || new Date(Date.now() + 1800000).toUTCString(), // 30 minutes
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch fog forecast',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
}

function extractFogForecast(data) {
  const now = new Date().toISOString();
  const timeseries = data.properties.timeseries;
  
  const current = timeseries[0];
  const forecast24h = timeseries.slice(0, 24);
  
  const currentDetails = current.data.instant.details;
  const fogForecast = forecast24h.map((entry, index) => {
    const details = entry.data.instant.details;
    const entryDate = new Date(entry.time);
    const dayOfYear = Math.floor((entryDate - new Date(entryDate.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const isNight = entryDate.getUTCHours() < 6 || entryDate.getUTCHours() >= 18;
    const timeOfDay = isNight ? 'night' : 'day';
    
    // Get symbol data from next_1_hours or next_6_hours
    const next1h = entry.data.next_1_hours;
    const next6h = entry.data.next_6_hours;
    const symbolData = next1h || next6h;
    
    return {
      time: entry.time,
      hours_ahead: index,
      [`forecast_${dayOfYear}${timeOfDay[0]}`]: {
        symbol_code: symbolData?.summary?.symbol_code || null,
        symbol_confidence: symbolData?.summary?.symbol_confidence || null
      },
      fog_area_fraction: details.fog_area_fraction || 0,
      relative_humidity: details.relative_humidity,
      cloud_area_fraction: details.cloud_area_fraction,
      visibility_status: getFogStatus(details.fog_area_fraction || 0)
    };
  });

  return {
    location: "Golden Gate Bridge Vista Point South, San Francisco",
    coordinates: { lat: 37.80734, lon: -122.47477 },
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