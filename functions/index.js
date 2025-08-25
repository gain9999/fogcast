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
    let forecast;
    
    if (isApiRequest) {
      // For API requests, fetch data from our own /api endpoint
      const apiResponse = await fetch(new URL('/api', url.origin), {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }
      
      forecast = await apiResponse.json();
      
      return new Response(JSON.stringify(forecast, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } else {
      // For HTML requests, fetch data from /api endpoint
      const apiResponse = await fetch(new URL('/api', url.origin), {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }
      
      forecast = await apiResponse.json();
      
      return new Response(generateHTML(forecast), {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
    
    if (isApiRequest) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch fog forecast',
        message: error.message,
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


function generateHTML(forecast) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WeatherForecast",
    "name": "Golden Gate Bridge Vista Point Fog Forecast",
    "description": "Real-time fog forecast for Golden Gate Bridge Vista Point in San Francisco",
    "about": {
      "@type": "Place",
      "@id": "https://fogcast.in#golden-gate-bridge-vista-point",
      "name": "Golden Gate Bridge Vista Point",
      "alternateName": ["Marin Headlands Vista Point", "Battery Spencer Overlook"],
      "description": "Popular viewpoint for Golden Gate Bridge photography and sightseeing"
    },
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
        "streetAddress": "Conzelman Rd",
        "addressLocality": "Sausalito",
        "addressRegion": "CA",
        "postalCode": "94965",
        "addressCountry": "US"
      }
    },
    "dateModified": forecast.updated,
    "provider": {
      "@type": "Organization",
      "name": "Norwegian Meteorological Institute",
      "alternateName": "Yr.no",
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
          "unitText": "percent",
          "description": "Percentage of area covered by fog affecting Golden Gate Bridge visibility"
        },
        {
          "@type": "QuantitativeValue", 
          "name": "Relative Humidity",
          "value": forecast.current.relative_humidity,
          "unitText": "percent"
        },
        {
          "@type": "QuantitativeValue", 
          "name": "Cloud Coverage",
          "value": forecast.current.cloud_area_fraction,
          "unitText": "percent"
        }
      ]
    },
    "temporalCoverage": "P1D",
    "spatialCoverage": {
      "@type": "Place",
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": forecast.coordinates.lat,
        "longitude": forecast.coordinates.lon
      }
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fog Forecast Golden Gate Bridge Vista Point | Current: ${forecast.current.status} | San Francisco Weather</title>
    <meta name="description" content="Real-time Golden Gate Bridge fog forecast for Vista Point, San Francisco. Current: ${forecast.current.status} (${forecast.current.fog_area_fraction}% fog coverage). Hourly predictions for optimal bridge photography and sightseeing. Live weather data from Marin Headlands viewpoint.">
    <meta name="keywords" content="Golden Gate Bridge fog forecast, San Francisco fog prediction, bridge visibility weather, Marin Headlands vista point, SF fog conditions, bridge photography weather, tourist viewing conditions, Golden Gate weather radar, SF bay fog, bridge webcam alternative">
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
        .see-more-link {
            text-align: center;
            margin: 15px 0;
            cursor: pointer;
            color: #3498db;
            font-weight: 500;
            padding: 10px;
            border-radius: 6px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
        }
        .see-more-link:hover {
            background: #e9ecef;
            color: #2980b9;
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
    
    <main role="main">
        <section class="current" aria-labelledby="current-conditions">
            <h3 id="current-conditions">🌡️ Current Fog Conditions</h3>
            <div class="status" role="status" aria-live="polite">${forecast.current.status}</div>
            <div itemscope itemtype="https://schema.org/WeatherObservation">
                <p><strong>Fog Coverage:</strong> <span class="highlight" itemprop="measuredValue" itemscope itemtype="https://schema.org/QuantitativeValue"><span itemprop="value">${forecast.current.fog_area_fraction}</span><span itemprop="unitText">%</span></span></p>
                <p><strong>Relative Humidity:</strong> <span itemprop="measuredValue" itemscope itemtype="https://schema.org/QuantitativeValue"><span itemprop="value">${forecast.current.relative_humidity}</span><span itemprop="unitText">%</span></span></p>
                <p><strong>Cloud Coverage:</strong> <span itemprop="measuredValue" itemscope itemtype="https://schema.org/QuantitativeValue"><span itemprop="value">${forecast.current.cloud_area_fraction}</span><span itemprop="unitText">%</span></span></p>
            </div>
        </section>

        <section aria-labelledby="hourly-forecast-heading">
            <h3 id="hourly-forecast-heading">⏰ 24-Hour Fog Forecast</h3>
            <p>Plan your Golden Gate Bridge visit with hourly fog predictions:</p>
            <div id="forecast-container">
                ${forecast.forecast_24h.slice(0, 6).map(item => `
                    <article class="forecast-item">
                        <strong>${item.time}</strong> - ${item.status}
                        <br>🌫️ Fog: ${item.fog_area_fraction}% | 💧 Humidity: ${item.relative_humidity}%
                    </article>
                `).join('')}
                <div id="remaining-forecast" style="display: none;">
                    ${forecast.forecast_24h.slice(6).map(item => `
                        <article class="forecast-item">
                            <strong>${item.time}</strong> - ${item.status}
                            <br>🌫️ Fog: ${item.fog_area_fraction}% | 💧 Humidity: ${item.relative_humidity}%
                        </article>
                    `).join('')}
                </div>
                <div id="see-more" class="see-more-link" onclick="toggleForecast()">
                    <span id="see-more-text">See more (${forecast.forecast_24h.length - 6} hours)</span>
                </div>
            </div>
        </section>

        <section aria-labelledby="extended-forecast-heading">
            <h3 id="extended-forecast-heading">📅 Extended Forecast (Next 8 Days)</h3>
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

        <aside class="faq" role="complementary" aria-labelledby="about-forecast">
            <h3 id="about-forecast">❓ About This Forecast</h3>
            <div itemscope itemtype="https://schema.org/DefinedTerm">
                <p><strong itemprop="name">What does fog coverage mean?</strong> <span itemprop="description">Fog coverage indicates the percentage of the area covered by fog. Higher percentages mean reduced visibility of the Golden Gate Bridge.</span></p>
            </div>
            <p><strong>Best viewing times:</strong> Look for periods with <strong>0-25% fog coverage</strong> for the clearest bridge views and photography opportunities.</p>
            <p><strong>Data source:</strong> Weather data provided by the <a href="https://yr.no" rel="noopener" target="_blank">Norwegian Meteorological Institute (Yr.no)</a>, updated hourly.</p>
        </aside>

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

    <script>
        function toggleForecast() {
            const remainingForecast = document.getElementById('remaining-forecast');
            const seeMoreText = document.getElementById('see-more-text');
            
            if (remainingForecast.style.display === 'none') {
                remainingForecast.style.display = 'block';
                seeMoreText.textContent = 'Show less';
            } else {
                remainingForecast.style.display = 'none';
                seeMoreText.textContent = 'See more (' + ${forecast.forecast_24h.length - 6} + ' hours)';
            }
        }
    </script>
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