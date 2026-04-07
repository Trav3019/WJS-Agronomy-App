import { ThermometerSun, ExternalLink } from 'lucide-react';

const SOIL_TEMP_URL = 'https://www.gov.mb.ca/agriculture/weather/soil-temperature.html';
const WINKLER_SOURCE_URL = 'https://www.gov.mb.ca/agriculture/weather/winkler-cc.html';
const WINKLER_IMAGE_URL = 'https://mbagweather.ca/partners/rtmc/Winkle230.png';

export default function SoilTemperatureWidget() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
          <ThermometerSun className="h-5 w-5" /> Soil Temperature
        </h2>
        <a
          href={SOIL_TEMP_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-green-700 hover:text-green-900 inline-flex items-center gap-1"
        >
          Open MB Graph <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <a href={WINKLER_SOURCE_URL} target="_blank" rel="noreferrer" className="block">
        <img
          src={WINKLER_IMAGE_URL}
          alt="Winkler current conditions from Manitoba Agriculture"
          className="w-full rounded-lg border border-gray-200"
          loading="lazy"
        />
      </a>

      <p className="text-xs text-gray-500">
        Source: Manitoba Agriculture Winkler station page. This is the same image data used by the government page, so values align exactly.
      </p>
    </div>
  );
}