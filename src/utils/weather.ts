import type { WeatherData } from '../types';

// Using Open-Meteo API (free, no API key required)
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const WMO_CODES: Record<number, string> = {
  0: 'Clear Sky', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Thunderstorm w/ Heavy Hail',
};

export function getWeatherDescription(code: number): string {
  return WMO_CODES[code] ?? 'Unknown';
}

export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    forecast_days: '1',
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const c = data.current;

  return {
    temperature: c.temperature_2m,
    precipitation: c.precipitation,
    windSpeed: c.wind_speed_10m,
    humidity: c.relative_humidity_2m,
    weatherCode: c.weather_code,
    weatherDescription: getWeatherDescription(c.weather_code),
    date: c.time,
  };
}

export async function getWeeklyRainfall(lat: number, lng: number): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    daily: 'precipitation_sum',
    temperature_unit: 'celsius',
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Weekly rainfall fetch failed');
  const data = await res.json();
  const values: number[] = data.daily?.precipitation_sum ?? [];
  return values.reduce((sum, v) => sum + (v ?? 0), 0);
}

export async function getHistoricalWeather(lat: number, lng: number, date: string): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    start_date: date,
    end_date: date,
  });

  const res = await fetch(`${ARCHIVE_URL}?${params}`);
  if (!res.ok) throw new Error('Historical weather fetch failed');
  const data = await res.json();
  const d = data.daily;

  return {
    temperature: (d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2,
    temperatureMin: d.temperature_2m_min[0],
    temperatureMax: d.temperature_2m_max[0],
    precipitation: d.precipitation_sum[0] ?? 0,
    windSpeed: d.wind_speed_10m_max[0] ?? 0,
    date,
  };
}

export async function getWeeklyForecast(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Forecast fetch failed');
  const data = await res.json();
  const d = data.daily;

  return d.time.map((date: string, i: number) => ({
    date,
    temperatureMax: d.temperature_2m_max[i],
    temperatureMin: d.temperature_2m_min[i],
    precipitation: d.precipitation_sum[i] ?? 0,
    weatherCode: d.weather_code[i],
    weatherDescription: getWeatherDescription(d.weather_code[i]),
    windSpeed: d.wind_speed_10m_max[i] ?? 0,
  }));
}
