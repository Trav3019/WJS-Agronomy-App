import { useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../types';
import { MapPin, Loader2, AlertCircle, Undo2, Trash2 } from 'lucide-react';

interface ScoutMarker {
  location: GeoLocation;
  label: string;
  date: string;
  color?: string;
}

interface Props {
  currentLocation?: GeoLocation;
  markers?: ScoutMarker[];
  // Draw mode
  trailPoints?: GeoLocation[];
  onTrailPointsChange?: (points: GeoLocation[]) => void;
  closedShape?: boolean;
  onClosedShapeChange?: (closed: boolean) => void;
  // Pin mode
  pinPoints?: GeoLocation[];
  pinLabels?: string[];
  onPinPointsChange?: (points: GeoLocation[]) => void;
  onPinLabelsChange?: (labels: string[]) => void;
  // Shared
  onLocationCapture?: (loc: GeoLocation) => void;
  height?: string;
  readonly?: boolean;
  drawingMode?: boolean;
  interactionMode?: 'pin' | 'draw';
  startAtCurrentLocation?: boolean;
}

export default function GeoMap({
  currentLocation,
  markers = [],
  trailPoints = [],
  onTrailPointsChange,
  closedShape = false,
  onClosedShapeChange,
  pinPoints = [],
  pinLabels = [],
  onPinPointsChange,
  onPinLabelsChange,
  onLocationCapture,
  height = '300px',
  readonly = false,
  drawingMode = false,
  interactionMode,
  startAtCurrentLocation = false,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const historyLayerRef = useRef<any>(null);
  const trailLayerRef = useRef<any>(null);
  const mapClickHandlerRef = useRef<((event: any) => void) | null>(null);
  const trailPointsRef = useRef<GeoLocation[]>(trailPoints);
  const pinPointsRef = useRef<GeoLocation[]>(pinPoints);
  const pinLabelsRef = useRef<string[]>(pinLabels);
  const pinLayerRef = useRef<any>(null);
  const centeredToUserRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const effectiveInteractionMode = drawingMode ? 'draw' : interactionMode;

  useEffect(() => {
    trailPointsRef.current = trailPoints;
  }, [trailPoints]);

  useEffect(() => {
    pinPointsRef.current = pinPoints;
  }, [pinPoints]);

  useEffect(() => {
    pinLabelsRef.current = pinLabels;
  }, [pinLabels]);

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

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri',
          maxZoom: 19,
        }).addTo(map);

        historyLayerRef.current = L.layerGroup().addTo(map);
        trailLayerRef.current = L.layerGroup().addTo(map);
        pinLayerRef.current = L.layerGroup().addTo(map);

        // Add existing markers
        markers.forEach(m => {
          const markerIcon = L.divIcon({
            className: '',
            html: `<div style="background:${m.color || '#2d6a4f'};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker([m.location.lat, m.location.lng], { icon: markerIcon })
            .addTo(historyLayerRef.current)
            .bindPopup(`<b>${m.label}</b><br/>${m.date}`);
        });

        // Add current location marker only when there is no drawn/pinned geometry
        if (currentLocation && trailPoints.length === 0) {
          currentMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng])
            .addTo(map)
            .bindPopup('Saved GPS Location')
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

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (mapClickHandlerRef.current) {
      map.off('click', mapClickHandlerRef.current);
      mapClickHandlerRef.current = null;
    }

    if (readonly) return;

    if (effectiveInteractionMode === 'draw' && onTrailPointsChange) {
      mapClickHandlerRef.current = (event: any) => {
        const point: GeoLocation = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        };
        onLocationCapture?.(point);
        onTrailPointsChange([...trailPointsRef.current, point]);
      };
      map.on('click', mapClickHandlerRef.current);
      return;
    }

    if (effectiveInteractionMode === 'pin') {
      mapClickHandlerRef.current = (event: any) => {
        const point: GeoLocation = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        };
        onLocationCapture?.(point);
        if (onPinPointsChange) {
          onPinPointsChange([...pinPointsRef.current, point]);
        }
        if (onPinLabelsChange) {
          const entered = window.prompt('Enter pin info (optional):', '');
          onPinLabelsChange([...pinLabelsRef.current, entered ?? '']);
        }
      };
      map.on('click', mapClickHandlerRef.current);
    }
  }, [mapReady, readonly, effectiveInteractionMode, onLocationCapture, onTrailPointsChange, onPinPointsChange, onPinLabelsChange]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || readonly || !startAtCurrentLocation || centeredToUserRef.current) return;

    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        centeredToUserRef.current = true;
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [mapReady, readonly, startAtCurrentLocation]);

  // Update map when location changes and show current location dot
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !mapReady) return;
    const map = mapInstanceRef.current;
    const currentZoom = map.getZoom();
    map.setView([currentLocation.lat, currentLocation.lng], currentZoom, { animate: false });

    // Always show current location as a blue dot
    if (currentMarkerRef.current) {
      currentMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
      import('leaflet').then(L => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        currentMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon })
          .addTo(map)
          .bindPopup('Your Current Location');
      });
    }
  }, [currentLocation, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !historyLayerRef.current) return;

    import('leaflet').then(L => {
      historyLayerRef.current.clearLayers();
      markers.forEach(m => {
        const markerIcon = L.divIcon({
          className: '',
          html: `<div style="background:${m.color || '#2d6a4f'};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([m.location.lat, m.location.lng], { icon: markerIcon })
          .addTo(historyLayerRef.current)
          .bindPopup(`<b>${m.label}</b><br/>${m.date}`);
      });
    });
  }, [markers, mapReady]);

  // Draw mode: render polyline + circle markers (no tooltips)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !trailLayerRef.current) return;

    import('leaflet').then(L => {
      trailLayerRef.current.clearLayers();
      if (trailPoints.length === 0) return;

      const pathPoints = (closedShape && trailPoints.length > 2)
        ? [...trailPoints, trailPoints[0]]
        : trailPoints;

      L.polyline(
        pathPoints.map(point => [point.lat, point.lng]),
        { color: '#2563eb', weight: 3, opacity: 0.8 }
      ).addTo(trailLayerRef.current);

      trailPoints.forEach((point, index) => {
        L.circleMarker([point.lat, point.lng], {
          radius: index === 0 ? 6 : 4,
          color: index === 0 ? '#16a34a' : '#2563eb',
          weight: 2,
          fillColor: index === 0 ? '#16a34a' : '#2563eb',
          fillOpacity: 0.9,
        })
          .addTo(trailLayerRef.current)
          .bindPopup(index === 0 ? 'Start point' : `Point ${index + 1}`);
      });
    });
  }, [trailPoints, closedShape, mapReady]);

  // Pin mode: render draggable markers with tooltips on separate layer
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !pinLayerRef.current) return;

    import('leaflet').then(L => {
      pinLayerRef.current.clearLayers();
      if (pinPoints.length === 0) return;

      pinPoints.forEach((point, index) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);cursor:grab"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([point.lat, point.lng], {
          icon,
          draggable: !readonly,
        }).addTo(pinLayerRef.current);

        // Update position in state on drag end
        marker.on('dragend', () => {
          const latlng = marker.getLatLng();
          const updated = [...pinPointsRef.current];
          updated[index] = { lat: latlng.lat, lng: latlng.lng };
          onPinPointsChange?.(updated);
        });

        const label = pinLabels[index]?.trim();
        const popupLabel = label ? `<b>${label}</b><br/>` : '';
        const popup = L.popup({ closeButton: false }).setContent(
          `<div style="text-align:center">${popupLabel}Pin ${index + 1}<br/><button id="remove-pin-${index}" style="margin-top:4px;padding:2px 8px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Remove</button></div>`
        );
        marker.bindPopup(popup);
        marker.on('popupopen', () => {
          const btn = document.getElementById(`remove-pin-${index}`);
          if (btn) {
            btn.onclick = () => {
              marker.closePopup();
              onPinPointsChange?.(pinPointsRef.current.filter((_, i) => i !== index));
              onPinLabelsChange?.(pinLabelsRef.current.filter((_, i) => i !== index));
            };
          }
        });

        if (label) {
          marker.bindTooltip(label, {
            permanent: true,
            direction: 'top',
            offset: [0, -15],
            className: 'geo-label-tooltip',
          });
        }
      });
    });
  }, [pinPoints, pinLabels, mapReady]);

  async function captureLocation() {
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

      // Only pan the map — do not drop a pin or add a point
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], mapInstanceRef.current.getZoom());
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
          {effectiveInteractionMode === 'draw' ? (
            <>
              <span className="text-xs text-gray-600">Draw mode: click map to add points.</span>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={captureLocation}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                Center to My Location
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => {
                  if (!onTrailPointsChange || trailPoints.length === 0) return;
                  onTrailPointsChange(trailPoints.slice(0, -1));
                }}
                disabled={!onTrailPointsChange || trailPoints.length === 0}
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => {
                  onTrailPointsChange?.([]);
                  onClosedShapeChange?.(false);
                }}
                disabled={!onTrailPointsChange || trailPoints.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => onClosedShapeChange?.(!closedShape)}
                disabled={trailPoints.length < 3}
              >
                {closedShape ? 'Open Shape' : 'Close Shape'}
              </button>
            </>
          ) : effectiveInteractionMode === 'pin' ? (
            <>
              <span className="text-xs text-gray-600">Pin mode: click map to drop a pin.</span>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={captureLocation}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                Center to My Location
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => {
                  if (!onPinPointsChange || pinPoints.length === 0) return;
                  onPinPointsChange(pinPoints.slice(0, -1));
                  onPinLabelsChange?.(pinLabels.slice(0, -1));
                }}
                disabled={!onPinPointsChange || pinPoints.length === 0}
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo Pin
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1.5"
                onClick={() => {
                  onPinPointsChange?.([]);
                  onPinLabelsChange?.([]);
                }}
                disabled={!onPinPointsChange || pinPoints.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear Pins
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={captureLocation}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {loading ? 'Getting Location...' : 'Save GPS Location'}
            </button>
          )}
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
      {trailPoints.length > 0 && (
        <p className="text-xs text-gray-500">{trailPoints.length} drawn point{trailPoints.length !== 1 ? 's' : ''}</p>
      )}
      {pinPoints.length > 0 && (
        <p className="text-xs text-gray-500">{pinPoints.length} pin{pinPoints.length !== 1 ? 's' : ''} dropped</p>
      )}
    </div>
  );
}
