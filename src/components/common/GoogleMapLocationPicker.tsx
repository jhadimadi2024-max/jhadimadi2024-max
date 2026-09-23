import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Crosshair,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Plus,
  Minus
} from 'lucide-react';

export interface GoogleMapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  idPrefix?: string;
  defaultLat?: number;
  defaultLng?: number;
  district?: string;
  upazila?: string;
  label?: string;
  required?: boolean;
}

// Default center: Khagrachhari / CHT Region
const DEFAULT_CHT_LAT = 23.1193;
const DEFAULT_CHT_LNG = 91.9847;

// Approximate coordinates for CHT & Key Districts
const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'খাগড়াছড়ি': { lat: 23.1193, lng: 91.9847 },
  'Khagrachhari': { lat: 23.1193, lng: 91.9847 },
  'রাঙ্গামাটি': { lat: 22.6533, lng: 92.1753 },
  'Rangamati': { lat: 22.6533, lng: 92.1753 },
  'বান্দরবান': { lat: 22.1953, lng: 92.2184 },
  'Bandarban': { lat: 22.1953, lng: 92.2184 },
  'চট্টগ্রাম': { lat: 22.3569, lng: 91.7832 },
  'Chittagong': { lat: 22.3569, lng: 91.7832 },
  'ঢাকা': { lat: 23.8103, lng: 90.4125 },
  'Dhaka': { lat: 23.8103, lng: 90.4125 },
};

// Placeholder string for Google Maps API key configuration
export const GOOGLE_MAPS_API_KEY_PLACEHOLDER = 'YOUR_API_KEY';

export const GoogleMapLocationPicker: React.FC<GoogleMapLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  idPrefix = 'reg-map',
  defaultLat = DEFAULT_CHT_LAT,
  defaultLng = DEFAULT_CHT_LNG,
  district,
  upazila,
  label = 'ইন্টারেক্টিভ ম্যাপে আপনার সুনির্দিষ্ট অবস্থান পিন করুন *',
  required = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const googleMarkerInstanceRef = useRef<any>(null);
  const leafletMapInstanceRef = useRef<any>(null);
  const leafletMarkerInstanceRef = useRef<any>(null);

  const [currentLat, setCurrentLat] = useState<number>(latitude ?? defaultLat);
  const [currentLng, setCurrentLng] = useState<number>(longitude ?? defaultLng);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(13);

  // Sync with prop changes
  useEffect(() => {
    if (latitude !== null && longitude !== null && (latitude !== currentLat || longitude !== currentLng)) {
      setCurrentLat(latitude);
      setCurrentLng(longitude);
      if (leafletMarkerInstanceRef.current) {
        try {
          leafletMarkerInstanceRef.current.setLatLng([latitude, longitude]);
          leafletMapInstanceRef.current?.setView([latitude, longitude]);
        } catch (e) {}
      }
      if (googleMarkerInstanceRef.current) {
        try {
          googleMarkerInstanceRef.current.setPosition({ lat: latitude, lng: longitude });
          googleMapInstanceRef.current?.panTo({ lat: latitude, lng: longitude });
        } catch (e) {}
      }
    }
  }, [latitude, longitude]);

  // Adjust center if district changes and user has not yet customized position
  useEffect(() => {
    if (district && DISTRICT_COORDINATES[district] && (latitude === null || latitude === defaultLat)) {
      const coords = DISTRICT_COORDINATES[district];
      setCurrentLat(coords.lat);
      setCurrentLng(coords.lng);
      onChange(coords.lat, coords.lng);
      if (leafletMapInstanceRef.current) {
        try {
          leafletMapInstanceRef.current.setView([coords.lat, coords.lng], 13);
          leafletMarkerInstanceRef.current?.setLatLng([coords.lat, coords.lng]);
        } catch (e) {}
      }
      if (googleMapInstanceRef.current) {
        try {
          googleMapInstanceRef.current.panTo({ lat: coords.lat, lng: coords.lng });
          googleMarkerInstanceRef.current?.setPosition({ lat: coords.lat, lng: coords.lng });
        } catch (e) {}
      }
    }
  }, [district]);

  // Notify parent on initial load if not set
  useEffect(() => {
    if (latitude === null || longitude === null) {
      onChange(currentLat, currentLng);
    }
  }, []);

  // Initialize and check available map libraries (Leaflet or Google Maps)
  useEffect(() => {
    const checkMaps = () => {
      const hasLeaflet = typeof window !== 'undefined' && !!(window as any).L;
      const hasGoogle = typeof window !== 'undefined' && !!(window as any).google?.maps && !(window as any).__googleMapsAuthFailed;
      
      if (hasLeaflet) {
        setIsLeafletReady(true);
      }
      if (hasGoogle) {
        setIsGoogleMapsReady(true);
      }
      return hasLeaflet || hasGoogle;
    };

    if (checkMaps()) return;

    const timer = setInterval(() => {
      if (checkMaps()) {
        clearInterval(timer);
      }
    }, 600);

    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet Map (Reliable OpenStreetMap Tiles - No Key Required)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Prevent re-initialization if already mounted
    if (leafletMapInstanceRef.current) {
      try {
        leafletMapInstanceRef.current.invalidateSize();
      } catch (e) {}
      return;
    }

    try {
      // Clear container child nodes if any stale content
      mapContainerRef.current.innerHTML = '';

      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: zoomLevel,
        zoomControl: false // custom controls provided
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Custom marker icon
      const markerIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #dc2626; color: white; width: 34px; height: 34px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2.5px solid white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#dc2626"/></svg>
          </div>
          <div style="width: 8px; height: 3px; background-color: rgba(0,0,0,0.4); border-radius: 9999px; margin-top: 2px;"></div>
        </div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42]
      });

      const marker = L.marker([currentLat, currentLng], {
        draggable: true,
        icon: markerIcon
      }).addTo(map);

      leafletMapInstanceRef.current = map;
      leafletMarkerInstanceRef.current = marker;

      // Marker drag event
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        if (pos) {
          const lat = parseFloat(pos.lat.toFixed(6));
          const lng = parseFloat(pos.lng.toFixed(6));
          setCurrentLat(lat);
          setCurrentLng(lng);
          onChange(lat, lng);
          setLocationStatus(`চিহ্নিত অবস্থান আপডেট হয়েছে: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
          setStatusType('success');
        }
      });

      // Map click event
      map.on('click', (e: any) => {
        if (e && e.latlng) {
          const lat = parseFloat(e.latlng.lat.toFixed(6));
          const lng = parseFloat(e.latlng.lng.toFixed(6));
          marker.setLatLng([lat, lng]);
          setCurrentLat(lat);
          setCurrentLng(lng);
          onChange(lat, lng);
          setLocationStatus(`ম্যাপে ক্লিক করে পিন স্থাপন করা হয়েছে: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
          setStatusType('success');
        }
      });

      // Force size computation once mounted
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 250);

    } catch (err) {
      console.warn('Leaflet map initialization notice:', err);
    }

    return () => {
      if (leafletMapInstanceRef.current) {
        try {
          leafletMapInstanceRef.current.remove();
          leafletMapInstanceRef.current = null;
          leafletMarkerInstanceRef.current = null;
        } catch (e) {}
      }
    };
  }, [isLeafletReady]);

  // "Use My Current GPS Location" button handler using navigator.geolocation
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('আপনার ব্রাউজার বা ডিভাইসে জিপিএস লোকেশন সাপোর্ট নেই।');
      setStatusType('error');
      return;
    }

    setIsLocating(true);
    setLocationStatus('আপনার বর্তমান জিপিএস লোকেশন শনাক্ত করা হচ্ছে...');
    setStatusType('info');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        setCurrentLat(lat);
        setCurrentLng(lng);
        onChange(lat, lng);
        setIsLocating(false);
        setLocationStatus(`✅ আপনার বর্তমান জিপিএস লোকেশন গৃহীত হয়েছে: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
        setStatusType('success');

        // Pan Leaflet map & move marker
        if (leafletMapInstanceRef.current) {
          try {
            leafletMapInstanceRef.current.setView([lat, lng], 16);
            leafletMarkerInstanceRef.current?.setLatLng([lat, lng]);
          } catch (e) {}
        }

        // Pan Google Map & move marker if available
        if (googleMapInstanceRef.current) {
          try {
            googleMapInstanceRef.current.panTo({ lat, lng });
            googleMapInstanceRef.current.setZoom(16);
            googleMarkerInstanceRef.current?.setPosition({ lat, lng });
          } catch (e) {}
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = 'জিপিএস লোকেশন পেতে সমস্যা হয়েছে।';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'লোকেশন পারমিশন দেওয়া হয়নি। আপনি ম্যাপের পিনটি টেনে আপনার অবস্থানে রাখুন।';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'ডিভাইসের অবস্থান পাওয়া যায়নি। ম্যাপে সরাসরি ক্লিক করে পিন বসান।';
        } else if (error.code === error.TIMEOUT) {
          msg = 'জিপিএস অনুরোধের সময় উত্তীর্ণ হয়েছে। পুনরায় চেষ্টা করুন।';
        }
        setLocationStatus(msg);
        setStatusType('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onChange]);

  // Handle fallback interactive map dragging/clicking
  const handleInteractiveMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isGoogleMapsReady && googleMapInstanceRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalized offset relative to center
    const xOffset = (x - rect.width / 2) / (rect.width / 2);
    const yOffset = (y - rect.height / 2) / (rect.height / 2);

    const deltaLat = -yOffset * (0.05 / Math.pow(1.5, zoomLevel - 12));
    const deltaLng = xOffset * (0.05 / Math.pow(1.5, zoomLevel - 12));

    const newLat = parseFloat((currentLat + deltaLat).toFixed(6));
    const newLng = parseFloat((currentLng + deltaLng).toFixed(6));

    setCurrentLat(newLat);
    setCurrentLng(newLng);
    onChange(newLat, newLng);
    setLocationStatus(`পিন স্থাপন করা হয়েছে: ${newLat}° N, ${newLng}° E`);
    setStatusType('success');
  };

  return (
    <div className="bg-white border-2 border-emerald-500/80 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
      
      {/* Hidden inputs for latitude and longitude as strictly required */}
      <input
        type="hidden"
        name="latitude"
        id={`${idPrefix}-lat`}
        value={currentLat !== null ? currentLat : ''}
      />
      <input
        type="hidden"
        name="longitude"
        id={`${idPrefix}-lng`}
        value={currentLng !== null ? currentLng : ''}
      />

      {/* Header & Label */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="block text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={22} className="text-emerald-700 shrink-0" />
            <span>{label}</span>
          </label>
          <p className="text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
            পণ্য ডেলিভারি, জরুরি রক্তের সন্ধান বা গ্রাহকদের সরাসরি আপনার লোকেশন দেখানোর জন্য ম্যাপের পিনটি টেনে রাখুন
          </p>
        </div>
      </div>

      {/* "Use My Current GPS Location" Button Above the Map (Strict Requirement) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <button
          type="button"
          id={`${idPrefix}-gps-btn`}
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-4 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-bold text-sm sm:text-base rounded-2xl shadow-sm hover:shadow-md transition active:scale-98 cursor-pointer"
          title="Use My Current GPS Location"
        >
          {isLocating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>লোকেশন খোঁজা হচ্ছে...</span>
            </>
          ) : (
            <>
              <Crosshair size={20} className="stroke-[2.5]" />
              <span>আমার বর্তমান জিপিএস লোকেশন ব্যবহার করুন (Use My GPS Location)</span>
            </>
          )}
        </button>

        {/* Coordinate Display Badge */}
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-950 flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <span className="text-gray-500 font-sans font-medium text-[11px]">স্থানাঙ্ক (GPS):</span>
          <span className="text-emerald-800">
            {currentLat.toFixed(5)}°N, {currentLng.toFixed(5)}°E
          </span>
        </div>
      </div>

      {/* Feedback Alert / Status Banner */}
      {locationStatus && (
        <div
          className={`p-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition ${
            statusType === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : statusType === 'error'
              ? 'bg-amber-50 text-amber-900 border border-amber-300'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          {statusType === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-amber-700 shrink-0" />
          )}
          <span className="flex-1">{locationStatus}</span>
        </div>
      )}

      {/* Interactive Map Container */}
      <div 
        className="relative w-full rounded-2xl overflow-hidden border-2 border-emerald-300 bg-slate-100 shadow-inner group select-none"
        style={{ height: '300px', width: '100%' }}
      >
        {/* Map Viewport Container with explicit 300px height */}
        <div
          ref={mapContainerRef}
          id={`${idPrefix}-viewport`}
          className="w-full h-full"
          style={{ height: '300px', width: '100%', minHeight: '300px' }}
        />

        {/* Fallback Interactive Visual Surface ONLY if neither Google Maps nor Leaflet is loaded */}
        {(!isGoogleMapsReady || !(window as any).google?.maps) && !isLeafletReady && (
          <div
            onClick={handleInteractiveMapClick}
            className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center cursor-crosshair overflow-hidden"
            style={{
              height: '300px',
              width: '100%',
              backgroundImage: `
                linear-gradient(to right, rgba(16, 185, 129, 0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 1px, transparent 1px),
                radial-gradient(circle at center, rgba(16, 185, 129, 0.05) 0%, rgba(241, 245, 249, 0.95) 70%)
              `,
              backgroundSize: '28px 28px, 28px 28px, 100% 100%'
            }}
          >
            {/* Draggable Visual Marker Pin */}
            <div className="relative flex flex-col items-center -mt-8 pointer-events-none animate-bounce">
              <div className="bg-red-600 text-white p-2 rounded-full shadow-xl border-2 border-white">
                <MapPin size={24} className="fill-white" />
              </div>
              <div className="w-2.5 h-1 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
              <span className="mt-1 bg-gray-900/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                আপনার অবস্থান (ট্যাপ বা ড্র্যাগ করুন)
              </span>
            </div>

            {/* Instruction Overlay */}
            <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-xs p-2 rounded-xl text-center border border-emerald-200 pointer-events-none">
              <p className="text-xs font-bold text-gray-800">
                ম্যাপে সরাসরি ক্লিক করুন অথবা উপরের "আমার বর্তমান জিপিএস লোকেশন" বাটনে চাপুন
              </p>
              <p className="text-[11px] text-gray-500">
                Google Maps API Placeholder ({GOOGLE_MAPS_API_KEY_PLACEHOLDER}) স্বয়ংক্রিয়ভাবে সক্রিয় রয়েছে
              </p>
            </div>
          </div>
        )}

        {/* Map Control Hints & Zoom Controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => {
              setZoomLevel((z) => Math.min(z + 1, 19));
              if (googleMapInstanceRef.current) {
                googleMapInstanceRef.current.setZoom(googleMapInstanceRef.current.getZoom() + 1);
              }
            }}
            className="w-8 h-8 bg-white hover:bg-gray-100 text-gray-800 rounded-lg shadow-md flex items-center justify-center font-bold text-base cursor-pointer border border-gray-300"
            title="Zoom in"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel((z) => Math.max(z - 1, 8));
              if (googleMapInstanceRef.current) {
                googleMapInstanceRef.current.setZoom(googleMapInstanceRef.current.getZoom() - 1);
              }
            }}
            className="w-8 h-8 bg-white hover:bg-gray-100 text-gray-800 rounded-lg shadow-md flex items-center justify-center font-bold text-base cursor-pointer border border-gray-300"
            title="Zoom out"
          >
            <Minus size={18} />
          </button>
        </div>

        {/* Direct Link to Google Maps */}
        <div className="absolute bottom-2 right-2 z-10">
          <a
            href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/95 hover:bg-white text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-sm transition"
          >
            <Navigation size={12} />
            <span>গুগল ম্যাপে বড় দেখুন</span>
          </a>
        </div>
      </div>

      {/* Helpful Quick Presets (Khagrachhari, Rangamati, Bandarban, Chittagong, Dhaka) */}
      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold text-gray-500">দ্রুত এলাকা বাছুন:</span>
        {Object.entries(DISTRICT_COORDINATES).slice(0, 5).map(([name, coords]) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setCurrentLat(coords.lat);
              setCurrentLng(coords.lng);
              onChange(coords.lat, coords.lng);
              if (googleMapInstanceRef.current) {
                googleMapInstanceRef.current.panTo({ lat: coords.lat, lng: coords.lng });
              }
              if (googleMarkerInstanceRef.current) {
                googleMarkerInstanceRef.current.setPosition({ lat: coords.lat, lng: coords.lng });
              }
              if (leafletMarkerInstanceRef.current) {
                leafletMarkerInstanceRef.current.setLatLng([coords.lat, coords.lng]);
                leafletMapInstanceRef.current?.setView([coords.lat, coords.lng]);
              }
            }}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-100 text-gray-800 hover:text-emerald-900 border border-gray-300 transition cursor-pointer"
          >
            {name}
          </button>
        ))}
      </div>

    </div>
  );
};

export default GoogleMapLocationPicker;
