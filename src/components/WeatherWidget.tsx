import { useEffect, useState } from 'react';
import { Cloud, Droplets, Wind, Thermometer, Loader2, AlertTriangle, CloudRain } from 'lucide-react';
import { getCurrentWeather, getWeeklyRainfall, getWeeklyForecast } from '../utils/weather';
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

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [weekRain, setWeekRain] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const [w, rain, fc] = await Promise.all([
            getCurrentWeather(pos.coords.latitude, pos.coords.longitude),
            getWeeklyRainfall(pos.coords.latitude, pos.coords.longitude),
            getWeeklyForecast(pos.coords.latitude, pos.coords.longitude),
          ]);
          setWeather(w);
          setWeekRain(rain);
          setForecast(fc);
        } catch {
          setError('Failed to load weather data');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Location permission required for weather');
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="card flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-gray-500">Loading weather...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
        <Cloud className="h-5 w-5" /> Current Weather
      </h2>

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
          <div className="text-sm font-medium text-blue-700">{weather.precipitation} mm</div>
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

      {/* Weekly rainfall */}
      {weekRain !== null && (
        <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3">
          <CloudRain className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-sm font-semibold text-blue-800">7-Day Rainfall Total</div>
            <div className="text-xl font-bold text-blue-700">{weekRain.toFixed(1)} mm</div>
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {forecast.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">7-Day Forecast</h3>
          <div className="grid grid-cols-7 gap-1">
            {forecast.map((day, i) => (
              <div key={day.date} className="text-center bg-gray-50 rounded-lg p-1">
                <div className="text-xs text-gray-500">
                  {i === 0 ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' })}
                </div>
                <div className="text-lg my-1">{getWeatherEmoji(day.weatherCode)}</div>
                <div className="text-xs font-medium text-red-600">{Math.round(day.temperatureMax)}°</div>
                <div className="text-xs text-blue-600">{Math.round(day.temperatureMin)}°</div>
                {day.precipitation > 0 && (
                  <div className="text-xs text-blue-500">{day.precipitation.toFixed(1)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
