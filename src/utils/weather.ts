import type { WeatherData } from '../types';

// Using Open-Meteo API (free, no API key required)
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const MB_HOURLY_CSV_URL = import.meta.env.DEV
  ? '/api/mbagweather/partners/agol/hourly-data.csv'
  : 'https://mbagweather.ca/partners/agol/hourly-data.csv';
const WINKLER_STATION_ID = '230';

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

export interface SoilTemperatureSnapshot {
  at: string;
  temp0cm: number;
  temp6cm: number;
  temp18cm: number;
  temp54cm: number;
}

export interface NearbySoilTemperatureResult {
  stationName: string;
  stationId: string;
  distanceKm: number;
  snapshot: SoilTemperatureSnapshot;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      // Support escaped quote "" inside quoted CSV cells.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function toNumber(value: string | undefined): number {
  const normalized = (value ?? '').trim();
  if (!normalized) throw new Error('Missing soil temperature value');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error('Invalid soil temperature value');
  return parsed;
}

function hasValue(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

function parseFeedTimestamp(dateValue: string | undefined, timeValue: string | undefined): number {
  const date = (dateValue ?? '').trim();
  const time = (timeValue ?? '').trim();
  const dateMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return Number.NEGATIVE_INFINITY;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  const timestamp = Date.UTC(year, month - 1, day, hours, minutes);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function toFiniteNumber(value: string | undefined): number | null {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export async function getWinklerSoilTemperatures(): Promise<SoilTemperatureSnapshot> {
  const res = await fetch(MB_HOURLY_CSV_URL);
  if (!res.ok) throw new Error('Winkler soil feed fetch failed');

  const csv = await res.text();
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error('Winkler soil feed is empty');

  const header = parseCsvLine(lines[0]);
  const idx = {
    date: header.indexOf('DATE'),
    time: header.indexOf('TIME'),
    stationId: header.indexOf('StnID'),
    stationName: header.indexOf('StnNAME'),
    soil5: header.indexOf('SoilTemp(5cm, Celsius)'),
    soil20: header.indexOf('SoilTemp(20cm, Celsius)'),
    soil50: header.indexOf('SoilTemp(50cm, Celsius)'),
    soil100: header.indexOf('SoilTemp(100cm, Celsius)'),
  };

  if (
    idx.stationId === -1 ||
    idx.stationName === -1 ||
    idx.soil5 === -1 ||
    idx.soil20 === -1 ||
    idx.soil50 === -1 ||
    idx.soil100 === -1
  ) {
    throw new Error('Winkler soil feed format changed');
  }

  const winklerRows = lines
    .slice(1)
    .map(parseCsvLine)
    .filter(row => row[idx.stationId] === WINKLER_STATION_ID || row[idx.stationName] === 'Winkler');

  if (winklerRows.length === 0) throw new Error('Winkler station not found in feed');

  const winklerRow = winklerRows
    .filter(row => hasValue(row[idx.soil5]) && hasValue(row[idx.soil20]) && hasValue(row[idx.soil50]) && hasValue(row[idx.soil100]))
    .sort(
      (a, b) =>
        parseFeedTimestamp(b[idx.date], b[idx.time]) - parseFeedTimestamp(a[idx.date], a[idx.time])
    )[0];

  if (!winklerRow) {
    throw new Error('Winkler station is online, but soil probe values are currently unavailable.');
  }

  return {
    at: `${winklerRow[idx.date] ?? ''} ${winklerRow[idx.time] ?? ''}`.trim(),
    // Keep existing property names used by UI while mapping Manitoba depths.
    temp0cm: toNumber(winklerRow[idx.soil5]),
    temp6cm: toNumber(winklerRow[idx.soil20]),
    temp18cm: toNumber(winklerRow[idx.soil50]),
    temp54cm: toNumber(winklerRow[idx.soil100]),
  };
}

export async function getNearestSoilTemperatures(
  lat: number,
  lng: number,
  maxDistanceKm = 250
): Promise<NearbySoilTemperatureResult> {
  const res = await fetch(MB_HOURLY_CSV_URL);
  if (!res.ok) throw new Error('Soil feed fetch failed');

  const csv = await res.text();
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error('Soil feed is empty');

  const header = parseCsvLine(lines[0]);
  const idx = {
    date: header.indexOf('DATE'),
    time: header.indexOf('TIME'),
    stationId: header.indexOf('StnID'),
    stationName: header.indexOf('StnNAME'),
    stationLat: header.indexOf('Lat'),
    stationLng: header.indexOf('Long'),
    soil5: header.indexOf('SoilTemp(5cm, Celsius)'),
    soil20: header.indexOf('SoilTemp(20cm, Celsius)'),
    soil50: header.indexOf('SoilTemp(50cm, Celsius)'),
    soil100: header.indexOf('SoilTemp(100cm, Celsius)'),
  };

  if (
    idx.stationId === -1 ||
    idx.stationName === -1 ||
    idx.stationLat === -1 ||
    idx.stationLng === -1 ||
    idx.soil5 === -1 ||
    idx.soil20 === -1 ||
    idx.soil50 === -1 ||
    idx.soil100 === -1
  ) {
    throw new Error('Soil feed format changed');
  }

  let best: NearbySoilTemperatureResult | null = null;

  for (const row of lines.slice(1).map(parseCsvLine)) {
    if (!hasValue(row[idx.soil5]) || !hasValue(row[idx.soil20]) || !hasValue(row[idx.soil50]) || !hasValue(row[idx.soil100])) {
      continue;
    }

    const stationLat = toFiniteNumber(row[idx.stationLat]);
    const stationLng = toFiniteNumber(row[idx.stationLng]);
    if (stationLat === null || stationLng === null) continue;

    const distanceKm = haversineKm(lat, lng, stationLat, stationLng);
    if (distanceKm > maxDistanceKm) continue;

    const candidate: NearbySoilTemperatureResult = {
      stationName: row[idx.stationName] ?? 'Unknown Station',
      stationId: row[idx.stationId] ?? '',
      distanceKm,
      snapshot: {
        at: `${row[idx.date] ?? ''} ${row[idx.time] ?? ''}`.trim(),
        temp0cm: toNumber(row[idx.soil5]),
        temp6cm: toNumber(row[idx.soil20]),
        temp18cm: toNumber(row[idx.soil50]),
        temp54cm: toNumber(row[idx.soil100]),
      },
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.distanceKm < best.distanceKm) {
      best = candidate;
      continue;
    }

    if (
      Math.abs(candidate.distanceKm - best.distanceKm) < 0.01 &&
      parseFeedTimestamp(candidate.snapshot.at.split(' ')[0], candidate.snapshot.at.split(' ')[1]) >
        parseFeedTimestamp(best.snapshot.at.split(' ')[0], best.snapshot.at.split(' ')[1])
    ) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error('No nearby station with soil probe values is currently available.');
  }

  return best;
}

export async function getCurrentSoilTemperatures(lat: number, lng: number): Promise<SoilTemperatureSnapshot> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: 'soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm',
    temperature_unit: 'celsius',
    forecast_days: '1',
    timezone: 'auto',
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Soil temperature fetch failed');
  const data = await res.json();
  const hourly = data.hourly;

  const times: string[] = hourly?.time ?? [];
  if (times.length === 0) throw new Error('No soil temperature data available');

  const now = new Date();
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < times.length; i += 1) {
    const delta = Math.abs(new Date(times[i]).getTime() - now.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }

  return {
    at: times[bestIndex],
    temp0cm: hourly.soil_temperature_0cm?.[bestIndex],
    temp6cm: hourly.soil_temperature_6cm?.[bestIndex],
    temp18cm: hourly.soil_temperature_18cm?.[bestIndex],
    temp54cm: hourly.soil_temperature_54cm?.[bestIndex],
  };
}
