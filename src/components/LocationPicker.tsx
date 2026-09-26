import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Check } from 'lucide-react';

// Fix default marker icons (CDN-less bundling breaks leaflet's image paths).
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  initial: { lat: number; lng: number };
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

// Full-screen interactive map: pin starts at GPS fix, customer can drag
// the pin or tap anywhere to move it, then confirms. Free OSM tiles, no key.
export function LocationPicker({ initial, onConfirm, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pendingRef = useRef<{ lat: number; lng: number }>(initial);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([initial.lat, initial.lng], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);
    markerRef.current = marker;
    const sync = () => {
      const p = marker.getLatLng();
      pendingRef.current = { lat: p.lat, lng: p.lng };
    };
    marker.on('dragend', sync);
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      sync();
    });
    // Fix tiles if modal animated in with zero size initially.
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-sm">Adjust delivery location</h3>
          <p className="text-xs text-gray-500">Drag the pin or tap the map — starts at your GPS position</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0" aria-label="Close map">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div ref={mapRef} className="flex-1 min-h-0 z-0" />
      <div className="p-4 border-t border-gray-200 pb-safe shrink-0 bg-white">
        <button
          onClick={() => onConfirm(pendingRef.current)}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Check className="w-5 h-5" /> Confirm This Location
        </button>
      </div>
    </div>
  );
}
