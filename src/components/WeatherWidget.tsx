import { useEffect, useState } from 'react';
import { Cloud, Droplets, Wind, Thermometer, Loader2, AlertTriangle } from 'lucide-react';
import { getCurrentWeather, getWeeklyForecast } from '../utils/weather';
import type { WeatherData } from '../types';

interface ForecastDay {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  weatherDescription: string;
  weatherCode: number;
  windSpeed: number;
}

const DEFAULT_LAT = 49.1215;
const DEFAULT_LNG = -97.9316;
const MM_PER_INCH = 25.4;

const WMO_ICON: Record<number, string> = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '❄️', 75: '❄️',
  80: '🌦', 81: '🌧', 82: '⛈',
  85: '🌨', 86: '❄️',
  95: '⛈', 96: '⛈', 99: '⛈',
};

function getWeatherEmoji(code: number): string {
  return WMO_ICON[code] ?? '🌡';
}

function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWeather = async (lat: number, lng: number, usingFallback = false) => {
      try {
        const [weatherResult, forecastResult] = await Promise.allSettled([
          getCurrentWeather(lat, lng),
          getWeeklyForecast(lat, lng),
        ]);

        if (weatherResult.status === 'fulfilled') {
          setWeather(weatherResult.value);
        }

        if (forecastResult.status === 'fulfilled') {
          setForecast(forecastResult.value);
        }

        if (weatherResult.status !== 'fulfilled') {
          setError(usingFallback ? 'Failed to load weather data.' : 'Using Winkler weather fallback.');
        } else if (usingFallback) {
          setError('Using Winkler weather fallback.');
        } else {
          setError(null);
        }
      } catch {
        setError('Failed to load weather data.');
      } finally {
        setLoading(false);
      }
    };

    if (!navigator.geolocation) {
      void loadWeather(DEFAULT_LAT, DEFAULT_LNG, true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        void loadWeather(pos.coords.latitude, pos.coords.longitude, false);
      },
      () => {
        void loadWeather(DEFAULT_LAT, DEFAULT_LNG, true);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    if (selectedForecastIndex >= forecast.length) {
      setSelectedForecastIndex(0);
    }
  }, [forecast, selectedForecastIndex]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-gray-500">Loading weather...</span>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="card flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!weather) return null;

  const selectedForecast = forecast[selectedForecastIndex] ?? null;
  const dayRain = forecast[0]?.precipitation ?? weather.precipitation ?? 0;
  const weekRain = forecast.reduce((sum, day) => sum + day.precipitation, 0);

  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
        <Cloud className="h-5 w-5" /> Current Weather
      </h2>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs sm:text-sm">{error}</span>
        </div>
      )}

      {/* Current conditions */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-5xl font-light text-gray-800">
            {Math.round(weather.temperature)}°C
          </div>
          <div className="text-sm text-gray-500 mt-1">{weather.weatherDescription}</div>
        </div>
        <div className="text-5xl">{getWeatherEmoji(weather.weatherCode ?? 0)}</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <Droplets className="h-4 w-4 text-blue-500 mx-auto mb-1" />
          <div className="text-sm font-medium text-blue-700">{mmToInches(weather.precipitation).toFixed(2)} in</div>
          <div className="text-xs text-gray-500">Precip</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Wind className="h-4 w-4 text-gray-500 mx-auto mb-1" />
          <div className="text-sm font-medium text-gray-700">{Math.round(weather.windSpeed)} km/h</div>
          <div className="text-xs text-gray-500">Wind</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <Thermometer className="h-4 w-4 text-green-500 mx-auto mb-1" />
          <div className="text-sm font-medium text-green-700">{weather.humidity ?? '--'}%</div>
          <div className="text-xs text-gray-500">Humidity</div>
        </div>
      </div>

      {/* 7-day forecast */}
      {forecast.length > 0 && (
        <div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-xs text-blue-700">Single-Day Rain Accumulation</div>
              <div className="text-xl font-semibold text-blue-800">{mmToInches(dayRain).toFixed(2)} in</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-xs text-blue-700">7-Day Rain Accumulation</div>
              <div className="text-xl font-semibold text-blue-800">{mmToInches(weekRain).toFixed(2)} in</div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">7-Day Forecast</h3>
          <div className="grid grid-cols-7 gap-1">
            {forecast.map((day, i) => (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedForecastIndex(i)}
                className={`text-center rounded-lg p-1 transition-colors ${selectedForecastIndex === i ? 'bg-green-100 ring-1 ring-green-300' : 'bg-gray-50 hover:bg-green-50'}`}
              >
                <div className="text-xs text-gray-500">
                  {i === 0 ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' })}
                </div>
                <div className="text-lg my-1">{getWeatherEmoji(day.weatherCode)}</div>
                <div className="text-xs font-medium text-red-600">{Math.round(day.temperatureMax)}°</div>
                <div className="text-xs text-blue-600">{Math.round(day.temperatureMin)}°</div>
                {day.precipitation > 0 && (
                  <div className="text-xs text-blue-500">{mmToInches(day.precipitation).toFixed(2)} in</div>
                )}
              </button>
            ))}
          </div>

          {selectedForecast && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-green-800">
                    {new Date(selectedForecast.date + 'T12:00:00').toLocaleDateString('en-CA', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{selectedForecast.weatherDescription}</div>
                </div>
                <div className="text-3xl">{getWeatherEmoji(selectedForecast.weatherCode)}</div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-white p-2">
                  <div className="text-gray-500">High / Low</div>
                  <div className="font-medium text-gray-800">{Math.round(selectedForecast.temperatureMax)}°C / {Math.round(selectedForecast.temperatureMin)}°C</div>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <div className="text-gray-500">Rain</div>
                  <div className="font-medium text-gray-800">{mmToInches(selectedForecast.precipitation).toFixed(2)} in</div>
                </div>
                <div className="rounded-lg bg-white p-2 col-span-2">
                  <div className="text-gray-500">Wind</div>
                  <div className="font-medium text-gray-800">{Math.round(selectedForecast.windSpeed)} km/h</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
