import { useEffect, useState } from 'react';
import { ThermometerSun, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { getNearestSoilTemperatures, getWinklerSoilTemperatures, type SoilTemperatureSnapshot } from '../utils/weather';

const SOIL_TEMP_URL = 'https://www.gov.mb.ca/agriculture/weather/winkler-cc.html';
const SOIL_CACHE_KEY = 'winkler-soil-snapshot';
const WINKLER_COORDS = { lat: 49.122, lng: -97.932 };

function isValidSnapshot(value: unknown): value is SoilTemperatureSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as SoilTemperatureSnapshot;
  return (
    typeof v.at === 'string' &&
    Number.isFinite(v.temp0cm) &&
    Number.isFinite(v.temp6cm) &&
    Number.isFinite(v.temp18cm) &&
    Number.isFinite(v.temp54cm)
  );
}

function readCachedSnapshot(): SoilTemperatureSnapshot | null {
  try {
    const raw = localStorage.getItem(SOIL_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function SoilTemperatureWidget() {
  const [soil, setSoil] = useState<SoilTemperatureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Winkler Manitoba Ag Weather station.');

  useEffect(() => {
    const load = async () => {
      try {
        const snapshot = await getWinklerSoilTemperatures();
        setSoil(snapshot);
        setError(null);
        setWarning(null);
        setSourceLabel('Winkler Manitoba Ag Weather station.');
        localStorage.setItem(SOIL_CACHE_KEY, JSON.stringify(snapshot));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load Winkler soil temperatures.';
        try {
          const nearest = await getNearestSoilTemperatures(WINKLER_COORDS.lat, WINKLER_COORDS.lng);
          setSoil(nearest.snapshot);
          setWarning(
            `${message} Showing nearest station: ${nearest.stationName} (${nearest.distanceKm.toFixed(0)} km away).`
          );
          setSourceLabel(`Nearby Manitoba Ag Weather station: ${nearest.stationName}.`);
          setError(null);
          return;
        } catch {
          // Try cached Winkler values next.
        }

        const cached = readCachedSnapshot();
        if (cached) {
          setSoil(cached);
          setWarning(`${message} Showing last available Winkler reading.`);
          setSourceLabel('Winkler Manitoba Ag Weather station (cached reading).');
          setError(null);
        } else {
          setError(message);
          setWarning(null);
          setSourceLabel('Winkler Manitoba Ag Weather station.');
          setSoil(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const lastUpdated = soil?.at ? new Date(soil.at) : null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
          <ThermometerSun className="h-5 w-5" /> Winkler Soil Temperatures
        </h2>
        <a
          href={SOIL_TEMP_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-green-700 hover:text-green-900 inline-flex items-center gap-1"
        >
          Open Source <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {loading ? (
        <div className="rounded-lg bg-gray-50 p-4 flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading Winkler soil temperatures...</span>
        </div>
      ) : error || !soil ? (
        <div className="rounded-lg bg-amber-50 p-4 flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error || 'Soil temperatures unavailable.'}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {warning && (
            <div className="rounded-lg bg-amber-50 p-3 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{warning}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xs text-green-700">5 cm (2")</div>
              <div className="text-2xl font-semibold text-green-900">{soil.temp0cm.toFixed(0)} C</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xs text-green-700">20 cm (8")</div>
              <div className="text-2xl font-semibold text-green-900">{soil.temp6cm.toFixed(0)} C</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xs text-green-700">50 cm (20")</div>
              <div className="text-2xl font-semibold text-green-900">{soil.temp18cm.toFixed(0)} C</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xs text-green-700">100 cm (39")</div>
              <div className="text-2xl font-semibold text-green-900">{soil.temp54cm.toFixed(0)} C</div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Source: {sourceLabel}
        {lastUpdated ? ` Updated ${lastUpdated.toLocaleString('en-CA')}.` : ''}
      </p>
    </div>
  );
}