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
      
      const response = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${SF_LAT}&lon=${SF_LON}`,
        { 
          headers: {
            'User-Agent': 'fogcast/1.0 (https://github.com/gain9999/fogcast) contact@example.com'
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
  const timeseries = data.properties.timeseries;
  const firstEntryTime = new Date(timeseries[0].time);
  const nowLocal = firstEntryTime.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  
  const current = timeseries[0];
  const forecast24h = timeseries.slice(0, 24);
  
  const currentDetails = current.data.instant.details;
  const fogForecast = forecast24h.slice(1).map((entry, index) => {
    const details = entry.data.instant.details;
    
    return {
      hours_ahead: index + 1,
      fog_area_fraction: details.fog_area_fraction || 0,
      relative_humidity: details.relative_humidity,
      cloud_area_fraction: details.cloud_area_fraction,
      visibility_status: getFogStatus(details.fog_area_fraction || 0)
    };
  });
  
  // Create day-based forecasts
  const dayForecasts = {};
  const startDate = new Date(timeseries[0].time);
  const msPerDay = 24 * 60 * 60 * 1000;
  
  // Group entries by day and extract day/night symbols
  timeseries.forEach((entry, index) => {
    const entryDate = new Date(entry.time);
    const dayOffset = Math.floor((entryDate - startDate) / msPerDay);
    
    if (dayOffset >= 1 && dayOffset <= 8) { // Days 1-8, skip day 0 and day 9
      // Convert to Pacific Time for accurate morning/afternoon/night classification
      const utcHour = entryDate.getUTCHours();
      // Pacific Time is UTC-8 (PST) or UTC-7 (PDT) - currently PDT in August
      const pacificHour = (utcHour - 7 + 24) % 24;
      let timeOfDay;
      
      if (pacificHour >= 6 && pacificHour < 12) {
        timeOfDay = 'morning';
      } else if (pacificHour >= 12 && pacificHour < 18) {
        timeOfDay = 'afternoon';
      } else {
        timeOfDay = 'night';
      }
      
      if (!dayForecasts[`forecast_${dayOffset}d`]) {
        dayForecasts[`forecast_${dayOffset}d`] = {};
      }
      
      // Get symbol from next_1_hours, next_6_hours, or next_12_hours
      const symbolData = entry.data.next_1_hours || entry.data.next_6_hours || entry.data.next_12_hours;
      if (symbolData?.summary?.symbol_code && !dayForecasts[`forecast_${dayOffset}d`][timeOfDay]) {
        dayForecasts[`forecast_${dayOffset}d`][timeOfDay] = symbolData.summary.symbol_code;
      }
    }
  });
  
  // Reorder each day forecast to ensure consistent morning, afternoon, night order
  Object.keys(dayForecasts).forEach(dayKey => {
    const originalDay = dayForecasts[dayKey];
    dayForecasts[dayKey] = {
      ...(originalDay.morning && { morning: originalDay.morning }),
      ...(originalDay.afternoon && { afternoon: originalDay.afternoon }),
      ...(originalDay.night && { night: originalDay.night })
    };
  });

  return {
    location: "Golden Gate Bridge Vista Point South, San Francisco",
    coordinates: { lat: 37.80734, lon: -122.47477 },
    updated: nowLocal,
    current: {
      fog_area_fraction: currentDetails.fog_area_fraction || 0,
      relative_humidity: currentDetails.relative_humidity,
      cloud_area_fraction: currentDetails.cloud_area_fraction,
      visibility_status: getFogStatus(currentDetails.fog_area_fraction || 0)
    },
    forecast_24h: fogForecast,
    ...dayForecasts
  };
}

function getFogStatus(fogFraction) {
  if (fogFraction >= 75) return "Heavy fog";
  if (fogFraction >= 50) return "Moderate fog";
  if (fogFraction >= 25) return "Light fog";
  if (fogFraction > 0) return "Patches of fog";
  return "Clear";
}