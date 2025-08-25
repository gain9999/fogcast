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

    const url = new URL(request.url);
    const acceptHeader = request.headers.get('Accept') || '';
    const isApiRequest = acceptHeader.includes('application/json') || 
                        url.searchParams.has('format') && url.searchParams.get('format') === 'json';

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

      if (isApiRequest) {
        return new Response(JSON.stringify(forecast, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } else {
        return new Response(generateHTML(forecast), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }
    } catch (error) {
      console.error('API Error:', error);
      
      if (isApiRequest) {
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
      } else {
        return new Response(generateErrorHTML(error.message), {
          status: 500,
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }
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
    const entryTime = new Date(entry.time);
    const pacificTime = entryTime.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit'
    });
    
    return {
      time: pacificTime,
      fog_area_fraction: details.fog_area_fraction || 0,
      relative_humidity: details.relative_humidity,
      cloud_area_fraction: details.cloud_area_fraction,
      status: getFogStatus(details.fog_area_fraction || 0)
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
        const symbolCode = symbolData.summary.symbol_code.replace(/_day|_night/, '');
        dayForecasts[`forecast_${dayOffset}d`][timeOfDay] = symbolCode;
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
      status: getFogStatus(currentDetails.fog_area_fraction || 0)
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

function generateHTML(forecast) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WeatherForecast",
    "name": "Golden Gate Bridge Vista Point Fog Forecast",
    "description": "Real-time fog forecast for Golden Gate Bridge Vista Point in San Francisco",
    "location": {
      "@type": "Place",
      "name": forecast.location,
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": forecast.coordinates.lat,
        "longitude": forecast.coordinates.lon
      },
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "San Francisco",
        "addressRegion": "CA",
        "addressCountry": "US"
      }
    },
    "dateModified": forecast.updated,
    "provider": {
      "@type": "Organization",
      "name": "Yr.no",
      "url": "https://yr.no"
    },
    "mainEntity": {
      "@type": "WeatherObservation",
      "observationDate": forecast.updated,
      "measuredValue": [
        {
          "@type": "QuantitativeValue",
          "name": "Fog Coverage",
          "value": forecast.current.fog_area_fraction,
          "unitText": "percent"
        },
        {
          "@type": "QuantitativeValue", 
          "name": "Relative Humidity",
          "value": forecast.current.relative_humidity,
          "unitText": "percent"
        }
      ]
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fog Forecast Golden Gate Bridge Vista Point | Current: ${forecast.current.status} | San Francisco Weather</title>
    <meta name="description" content="Real-time fog forecast for Golden Gate Bridge Vista Point in San Francisco. Current conditions: ${forecast.current.status} (${forecast.current.fog_area_fraction}% fog coverage). Get 24-hour predictions for the best viewing times and photography opportunities.">
    <meta name="keywords" content="fog forecast, Golden Gate Bridge, San Francisco fog, weather visibility, bridge viewing, photography, tourism, vista point">
    <meta name="author" content="FogCast">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://fogcast.in">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://fogcast.in">
    <meta property="og:title" content="Golden Gate Bridge Fog Forecast | Current: ${forecast.current.status}">
    <meta property="og:description" content="Real-time fog conditions at Golden Gate Bridge Vista Point. Current: ${forecast.current.status} with ${forecast.current.fog_area_fraction}% fog coverage.">
    <meta property="og:site_name" content="FogCast">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary">
    <meta property="twitter:url" content="https://fogcast.in">
    <meta property="twitter:title" content="Golden Gate Bridge Fog Forecast | ${forecast.current.status}">
    <meta property="twitter:description" content="Current fog conditions: ${forecast.current.status} (${forecast.current.fog_area_fraction}% coverage)">
    
    <!-- Additional SEO -->
    <meta name="geo.region" content="US-CA">
    <meta name="geo.placename" content="San Francisco">
    <meta name="geo.position" content="${forecast.coordinates.lat},${forecast.coordinates.lon}">
    <meta name="ICBM" content="${forecast.coordinates.lat},${forecast.coordinates.lon}">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
    </script>
    
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            max-width: 900px; 
            margin: 0 auto; 
            padding: 20px; 
            line-height: 1.6;
            color: #333;
        }
        header { margin-bottom: 2rem; }
        h1 { 
            font-size: 2.5rem; 
            margin: 0.5rem 0; 
            color: #2c3e50;
        }
        h2 {
            color: #34495e;
            margin: 1rem 0;
        }
        .current { 
            background: linear-gradient(135deg, #f0f8ff 0%, #e8f4f8 100%); 
            padding: 25px; 
            border-radius: 12px; 
            margin: 25px 0; 
            border: 1px solid #d4edda;
        }
        .status { 
            font-size: 28px; 
            font-weight: bold; 
            margin: 15px 0; 
            color: #2c3e50;
        }
        .forecast-item { 
            background: #f9f9f9; 
            margin: 12px 0; 
            padding: 18px; 
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        .forecast-item strong {
            color: #2c3e50;
            font-size: 1.1rem;
        }
        .api-link { 
            background: #e8f4fd; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 30px 0;
            border: 1px solid #bee5eb;
        }
        .coordinates { 
            color: #666; 
            font-size: 0.9rem; 
            margin: 0.5rem 0;
        }
        .updated {
            color: #666;
            font-size: 0.95rem;
            margin: 1rem 0;
        }
        footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
            text-align: center;
        }
        .faq {
            margin: 2rem 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .faq h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .highlight {
            background-color: #fff3cd;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .extended-forecast {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .day-forecast {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
        }
        .day-forecast h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 1rem;
        }
        .day-periods {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .period {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .period-label {
            font-size: 0.9rem;
            color: #6c757d;
        }
        .weather-symbol {
            font-weight: bold;
            color: #495057;
            text-transform: capitalize;
        }
        @media (max-width: 600px) {
            body { padding: 15px; }
            h1 { font-size: 2rem; }
            .current { padding: 20px; }
            .extended-forecast {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <header>
        <h1>🌫️ Fog Forecast</h1>
        <h2>${forecast.location}</h2>
        <p class="coordinates">📍 Coordinates: ${forecast.coordinates.lat}, ${forecast.coordinates.lon}</p>
        <p class="updated"><strong>🕒 Last Updated:</strong> ${forecast.updated}</p>
    </header>
    
    <main>
        <section class="current">
            <h3>🌡️ Current Fog Conditions</h3>
            <div class="status">${forecast.current.status}</div>
            <p><strong>Fog Coverage:</strong> <span class="highlight">${forecast.current.fog_area_fraction}%</span></p>
            <p><strong>Relative Humidity:</strong> ${forecast.current.relative_humidity}%</p>
            <p><strong>Cloud Coverage:</strong> ${forecast.current.cloud_area_fraction}%</p>
        </section>

        <section>
            <h3>⏰ 24-Hour Fog Forecast</h3>
            <p>Plan your Golden Gate Bridge visit with hourly fog predictions:</p>
            ${forecast.forecast_24h.map(item => `
                <article class="forecast-item">
                    <strong>${item.time}</strong> - ${item.status}
                    <br>🌫️ Fog: ${item.fog_area_fraction}% | 💧 Humidity: ${item.relative_humidity}%
                </article>
            `).join('')}
        </section>

        <section>
            <h3>📅 Extended Forecast (Next 8 Days)</h3>
            <p>Weather symbols for morning, afternoon, and night periods:</p>
            <div class="extended-forecast">
                ${Object.keys(forecast).filter(key => key.startsWith('forecast_') && key !== 'forecast_24h').sort().map(dayKey => {
                    const dayNumber = dayKey.replace('forecast_', '').replace('d', '');
                    const dayData = forecast[dayKey];
                    const dayDate = new Date(Date.now() + parseInt(dayNumber) * 24 * 60 * 60 * 1000);
                    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    
                    return `
                        <div class="day-forecast">
                            <h4>Day ${dayNumber} - ${dayName}</h4>
                            <div class="day-periods">
                                ${dayData.morning ? `<div class="period"><span class="period-label">Morning:</span> <span class="weather-symbol">${formatWeatherSymbol(dayData.morning)}</span></div>` : ''}
                                ${dayData.afternoon ? `<div class="period"><span class="period-label">Afternoon:</span> <span class="weather-symbol">${formatWeatherSymbol(dayData.afternoon)}</span></div>` : ''}
                                ${dayData.night ? `<div class="period"><span class="period-label">Night:</span> <span class="weather-symbol">${formatWeatherSymbol(dayData.night)}</span></div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </section>

        <section class="faq">
            <h3>❓ About This Forecast</h3>
            <p><strong>What does fog coverage mean?</strong> Fog coverage indicates the percentage of the area covered by fog. Higher percentages mean reduced visibility of the Golden Gate Bridge.</p>
            <p><strong>Best viewing times:</strong> Look for periods with <strong>0-25% fog coverage</strong> for the clearest bridge views and photography opportunities.</p>
            <p><strong>Data source:</strong> Weather data provided by the Norwegian Meteorological Institute (Yr.no), updated hourly.</p>
        </section>

        <section class="api-link">
            <h3>🔗 Developer API Access</h3>
            <p><strong>JSON API:</strong> <a href="?format=json" title="Get fog forecast data in JSON format">fogcast.in?format=json</a></p>
            <p><strong>REST Endpoint:</strong> <a href="/api" title="REST API endpoint for developers">fogcast.in/api</a></p>
            <p>Perfect for apps, widgets, and automated systems!</p>
        </section>
    </main>

    <footer>
        <p><small>📊 Weather data provided by <a href="https://yr.no" rel="noopener" target="_blank">Yr.no</a> (Norwegian Meteorological Institute)</small></p>
        <p><small>🌉 Helping visitors find the best times to view the Golden Gate Bridge since 2024</small></p>
    </footer>
</body>
</html>`;
}

function formatWeatherSymbol(symbolCode) {
  const symbolMap = {
    'clearsky': '☀️ Clear sky',
    'fair': '🌤️ Fair',
    'partlycloudy': '⛅ Partly cloudy',
    'cloudy': '☁️ Cloudy',
    'rainshowers': '🌦️ Rain showers',
    'rainshowersandthunder': '⛈️ Rain showers and thunder',
    'sleetshowers': '🌨️ Sleet showers',
    'snowshowers': '🌨️ Snow showers',
    'rain': '🌧️ Rain',
    'heavyrain': '🌧️ Heavy rain',
    'heavyrainandthunder': '⛈️ Heavy rain and thunder',
    'sleet': '🌨️ Sleet',
    'snow': '❄️ Snow',
    'snowandthunder': '⛈️ Snow and thunder',
    'fog': '🌫️ Fog',
    'sleetshowersandthunder': '⛈️ Sleet showers and thunder',
    'snowshowersandthunder': '⛈️ Snow showers and thunder',
    'rainandthunder': '⛈️ Rain and thunder',
    'sleetandthunder': '⛈️ Sleet and thunder',
    'lightrainshowers': '🌦️ Light rain showers',
    'heavyrainshowers': '🌧️ Heavy rain showers',
    'lightsleetshowers': '🌨️ Light sleet showers',
    'heavysleetshowers': '🌨️ Heavy sleet showers',
    'lightsnowshowers': '🌨️ Light snow showers',
    'heavysnowshowers': '🌨️ Heavy snow showers',
    'lightrain': '🌦️ Light rain',
    'lightsleet': '🌨️ Light sleet',
    'heavysleet': '🌨️ Heavy sleet',
    'lightsnow': '❄️ Light snow',
    'heavysnow': '❄️ Heavy snow'
  };
  
  return symbolMap[symbolCode] || symbolCode.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function generateErrorHTML(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fog Forecast - Error</title>
    <meta name="description" content="Fog forecast for Golden Gate Bridge Vista Point - currently experiencing technical difficulties">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>🌫️ Fog Forecast</h1>
    <h2>Service Temporarily Unavailable</h2>
    <p>We're experiencing technical difficulties retrieving the fog forecast.</p>
    <p><strong>Error:</strong> ${errorMessage}</p>
    <p>Please try again in a few moments.</p>
    <footer>
        <p><small>Data provided by <a href="https://yr.no">Yr.no</a> (Norwegian Meteorological Institute)</small></p>
    </footer>
</body>
</html>`;
}