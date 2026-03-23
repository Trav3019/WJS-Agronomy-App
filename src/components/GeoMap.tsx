import { useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../types';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface ScoutMarker {
  location: GeoLocation;
  label: string;
  date: string;
  color?: string;
}

interface Props {
  currentLocation?: GeoLocation;
  markers?: ScoutMarker[];
  onLocationCapture?: (loc: GeoLocation) => void;
  height?: string;
  readonly?: boolean;
}

export default function GeoMap({ currentLocation, markers = [], onLocationCapture, height = '300px', readonly = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Dynamic import of leaflet to avoid SSR issues
  useEffect(() => {
    let map: any;
    let L: any;

    async function initMap() {
      if (!mapRef.current) return;

      try {
        L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const center: [number, number] = currentLocation
          ? [currentLocation.lat, currentLocation.lng]
          : [49.8, -97.1]; // Manitoba, Canada default

        map = L.map(mapRef.current).setView(center, 13);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Add existing markers
        markers.forEach(m => {
          const markerIcon = L.divIcon({
            className: '',
            html: `<div style="background:${m.color || '#2d6a4f'};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker([m.location.lat, m.location.lng], { icon: markerIcon })
            .addTo(map)
            .bindPopup(`<b>${m.label}</b><br/>${m.date}`);
        });

        // Add current location marker
        if (currentLocation) {
          L.marker([currentLocation.lat, currentLocation.lng])
            .addTo(map)
            .bindPopup('Current Location')
            .openPopup();
        }

        setMapReady(true);
      } catch (e) {
        console.error('Map init error:', e);
      }
    }

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map when location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !mapReady) return;
    mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
  }, [currentLocation, mapReady]);

  async function captureLocation() {
    if (!onLocationCapture) return;
    setLoading(true);
    setError(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      );

      const loc: GeoLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };

      onLocationCapture(loc);

      // Pan map to location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([loc.lat, loc.lng], 15);
      }
    } catch (e: any) {
      setError(e.code === 1 ? 'Location permission denied' : 'Unable to get location');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {!readonly && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={captureLocation}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {loading ? 'Getting Location...' : 'Save GPS Location'}
          </button>
          {currentLocation && (
            <span className="text-xs text-gray-500">
              {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
              {currentLocation.accuracy && ` (±${Math.round(currentLocation.accuracy)}m)`}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />

      {markers.length > 0 && (
        <p className="text-xs text-gray-500">{markers.length} previous scouting location{markers.length !== 1 ? 's' : ''} shown</p>
      )}
    </div>
  );
}
