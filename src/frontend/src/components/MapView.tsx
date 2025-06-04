import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface MapViewProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
  className?: string;
  markerColor?: string;
}

// Set your Mapbox token here
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'your-mapbox-token';

export default function MapView({
  onLocationSelect,
  selectedLocation,
  interactive = true,
  center = [0, 0],
  zoom = 2,
  className = '',
  markerColor = '#3b82f6'
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        interactive
      });

      if (interactive && onLocationSelect) {
        map.current.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          onLocationSelect(lat, lng);
        });
      }
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [interactive, center, zoom]);

  useEffect(() => {
    if (!map.current) return;

    if (selectedLocation) {
      if (marker.current) {
        marker.current.setLngLat([selectedLocation.lng, selectedLocation.lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: markerColor })
          .setLngLat([selectedLocation.lng, selectedLocation.lat])
          .addTo(map.current);
      }
    } else if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
  }, [selectedLocation, markerColor]);

  return <div ref={mapContainer} className={`w-full h-full ${className}`} />;
}