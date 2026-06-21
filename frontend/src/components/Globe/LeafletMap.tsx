import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useGlobeStore } from '../../stores/globeStore';

export function LeafletMap() {
  const { mapCenter, mapZoom, selectedEvent } = useGlobeStore();

  return (
    <MapContainer
      center={mapCenter || [0, 0]}
      zoom={mapZoom || 2}
      className="w-full h-full"
      style={{ background: '#020205' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
      />
      {selectedEvent && (
        <CircleMarker
          center={[selectedEvent.latitude, selectedEvent.longitude]}
          radius={selectedEvent.magnitude || 5}
          fillColor="#f59e0b"
          fillOpacity={0.8}
          color="#fff"
          weight={1}
        >
          <Popup>
            <strong>{selectedEvent.place}</strong><br />
            Mag: {selectedEvent.magnitude}<br />
            Depth: {selectedEvent.depth_km} km
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
