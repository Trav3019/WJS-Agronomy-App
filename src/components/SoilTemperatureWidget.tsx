import { useEffect, useState } from 'react';
import { ThermometerSun, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { getWinklerSoilTemperatures, type SoilTemperatureSnapshot } from '../utils/weather';

const SOIL_TEMP_URL = 'https://www.gov.mb.ca/agriculture/weather/winkler-cc.html';

export default function SoilTemperatureWidget() {
  const [soil, setSoil] = useState<SoilTemperatureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snapshot = await getWinklerSoilTemperatures();
        setSoil(snapshot);
        setError(null);
      } catch {
        setError('Unable to load Winkler soil temperatures.');
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
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xs text-green-700">5 cm</div>
            <div className="text-2xl font-semibold text-green-900">{soil.temp0cm.toFixed(0)} C</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xs text-green-700">20 cm</div>
            <div className="text-2xl font-semibold text-green-900">{soil.temp6cm.toFixed(0)} C</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xs text-green-700">50 cm</div>
            <div className="text-2xl font-semibold text-green-900">{soil.temp18cm.toFixed(0)} C</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xs text-green-700">100 cm</div>
            <div className="text-2xl font-semibold text-green-900">{soil.temp54cm.toFixed(0)} C</div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Source: Winkler Manitoba Ag Weather station.
        {lastUpdated ? ` Updated ${lastUpdated.toLocaleString('en-CA')}.` : ''}
      </p>
    </div>
  );
}