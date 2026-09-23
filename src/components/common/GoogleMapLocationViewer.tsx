import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

export interface GoogleMapLocationViewerProps {
  latitude?: number | null;
  longitude?: number | null;
  title?: string;
  subtitle?: string;
  zoom?: number;
}

export const GoogleMapLocationViewer: React.FC<GoogleMapLocationViewerProps> = ({
  latitude = 23.1193,
  longitude = 91.9847,
  title = 'নিবন্ধিত ভৌগোলিক অবস্থান (Map Location)',
  subtitle,
  zoom = 15
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const leafletMapRef = useRef<any>(null);

  const safeLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : 23.1193;
  const safeLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : 91.9847;

  useEffect(() => {
    const checkMaps = () => {
      const hasLeaflet = typeof window !== 'undefined' && !!(window as any).L;
      const hasGoogle = typeof window !== 'undefined' && !!(window as any).google?.maps && !(window as any).__googleMapsAuthFailed;
      if (hasLeaflet) setIsLeafletReady(true);
      if (hasGoogle) setIsGoogleMapsReady(true);
      return hasLeaflet || hasGoogle;
    };

    if (checkMaps()) return;

    (window as any).__googleMapsLoadedCallback = () => {
      setIsGoogleMapsReady(true);
    };

    const interval = setInterval(() => {
      if (checkMaps()) {
        clearInterval(interval);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet viewer
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView([safeLat, safeLng], zoom);
        leafletMapRef.current.invalidateSize();
      } catch (e) {}
      return;
    }

    try {
      mapContainerRef.current.innerHTML = '';
      const map = L.map(mapContainerRef.current, {
        center: [safeLat, safeLng],
        zoom: zoom,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'custom-leaflet-viewer-marker',
        html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #dc2626; color: white; width: 34px; height: 34px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2.5px solid white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#dc2626"/></svg>
          </div>
          <div style="width: 8px; height: 3px; background-color: rgba(0,0,0,0.4); border-radius: 9999px; margin-top: 2px;"></div>
        </div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42]
      });

      L.marker([safeLat, safeLng], { icon: markerIcon }).addTo(map);
      leafletMapRef.current = map;

      setTimeout(() => {
        try { map.invalidateSize(); } catch (e) {}
      }, 250);
    } catch (err) {
      console.warn('Leaflet viewer notice:', err);
    }

    return () => {
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        } catch (e) {}
      }
    };
  }, [isLeafletReady, safeLat, safeLng, zoom]);

  // Google Maps fallback if available
  useEffect(() => {
    if (isLeafletReady || !isGoogleMapsReady || !mapContainerRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    try {
      const map = new gmaps.Map(mapContainerRef.current, {
        center: { lat: safeLat, lng: safeLng },
        zoom: zoom,
        mapTypeId: gmaps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      new gmaps.Marker({
        position: { lat: safeLat, lng: safeLng },
        map: map,
        title: title,
        animation: gmaps.Animation.DROP
      });
    } catch (err) {
      console.warn('GoogleMapLocationViewer notice:', err);
    }
  }, [isGoogleMapsReady, isLeafletReady, safeLat, safeLng, zoom]);

  const mapsUrl = `https://www.google.com/maps?q=${safeLat},${safeLng}`;

  return (
    <div className="bg-white border-2 border-emerald-300 rounded-3xl p-4 sm:p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <MapPin size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-base sm:text-lg">{title}</h4>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold rounded-xl border border-emerald-300 transition"
        >
          <ExternalLink size={14} />
          <span>ম্যাপে সরাসরি দেখুন</span>
        </a>
      </div>

      {/* Map Viewport with explicit 300px height */}
      <div 
        className="relative w-full rounded-2xl overflow-hidden border border-emerald-200 bg-slate-100 shadow-inner"
        style={{ height: '300px', width: '100%' }}
      >
        <div 
          ref={mapContainerRef} 
          className="w-full h-full" 
          style={{ height: '300px', width: '100%', minHeight: '300px' }} 
        />

        {/* Fallback Display if neither Google Maps nor Leaflet is loaded */}
        {(!isGoogleMapsReady || !(window as any).google?.maps) && !isLeafletReady && (
          <div
            className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center p-4 text-center"
            style={{
              height: '300px',
              width: '100%',
              backgroundImage: `
                linear-gradient(to right, rgba(16, 185, 129, 0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px'
            }}
          >
            <div className="bg-red-600 text-white p-3 rounded-full shadow-lg border-2 border-white mb-2">
              <MapPin size={26} className="fill-white" />
            </div>
            <p className="font-bold text-gray-900 text-sm sm:text-base">সংরক্ষিত সুনির্দিষ্ট ভৌগোলিক অবস্থান</p>
            <p className="text-xs font-mono font-bold text-emerald-800 mt-1">
              অক্ষাংশ: {safeLat.toFixed(5)}° N | দ্রাঘিমাংশ: {safeLng.toFixed(5)}° E
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Navigation size={14} />
              <span>গুগল ম্যাপে নেভিগেশন চালু করুন</span>
            </a>
          </div>
        )}
      </div>

      {/* Coordinate & Directions Footer */}
      <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
        <span className="font-mono font-semibold">
          GPS Coordinates: {safeLat.toFixed(6)}, {safeLng.toFixed(6)}
        </span>
        <span className="font-medium text-emerald-700">সংরক্ষিত অবস্থান পিন করা রয়েছে</span>
      </div>
    </div>
  );
};

export default GoogleMapLocationViewer;
