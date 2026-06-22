import { useEffect } from 'react';
import { Wifi, WifiOff, Bell, Settings, User } from 'lucide-react';
import { useDataStore } from './stores/dataStore';
import { useGlobeStore } from './stores/globeStore';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './api/client';
import { useGlassStyle } from './utils/glass';
import { EarthGlobe } from './components/EarthGlobe';
import { LiveFeed } from './components/LiveFeed';
import { SolarWindCard } from './components/SolarWindCard';
import { GoesCard } from './components/GoesCard';
import { ActivityCard } from './components/ActivityCard';
import { FilterBar } from './components/FilterBar';
import { TimelineSlider } from './components/TimelineSlider';

export default function App() {
  const { setStatus, setAnomalies, setActivity, setLoading } = useDataStore();
  const GLASS = useGlassStyle();

  // WebSocket for real-time events
  const { isConnected } = useWebSocket();

  // Initial REST fetch for non-WebSocket data (status, anomalies, activity)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [statusData, anomalyData, activityData] = await Promise.all([
          api.getStatus(),
          api.getAnomalies({ hours: 24 }),
          api.getActivity(),
        ]);
        setStatus(statusData);
        setAnomalies(anomalyData.anomalies || []);
        setActivity(activityData);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
    const interval = setInterval(fetchMetadata, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Globe — IS the background, fills entire viewport */}
      <EarthGlobe />

      {/* UI Layer — floating over globe */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        {/* Header */}
        <header style={{ position: 'absolute', top: 32, left: 48, display: 'flex', alignItems: 'center', gap: 24, pointerEvents: 'auto' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 300, letterSpacing: '0.35em', color: '#fff', textTransform: 'uppercase', margin: 0 }}>
            TETHYS
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 10px', borderRadius: 9999 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#4ade80' : '#ef4444', boxShadow: `0 0 10px ${isConnected ? 'rgba(74,222,128,0.5)' : 'rgba(239,68,68,0.5)'}` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: isConnected ? '#4ade80' : '#ef4444', textTransform: 'uppercase', fontWeight: 600 }}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </header>

        {/* HUD — top right */}
        <div style={{ position: 'absolute', top: 32, right: 48, display: 'flex', alignItems: 'center', gap: 24, padding: '4px 24px', borderRadius: 9999, ...GLASS, pointerEvents: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em', color: '#71717a', textTransform: 'uppercase' }}>
            OPERATOR: Shorekeeper
          </span>
          {isConnected ? (
            <Wifi style={{ width: 16, height: 16, color: '#34d399' }} />
          ) : (
            <WifiOff style={{ width: 16, height: 16, color: '#ef4444' }} />
          )}
          <div style={{ position: 'relative' }}>
            <Bell style={{ width: 16, height: 16, color: '#71717a' }} />
            <span style={{ position: 'absolute', top: 1, right: 1, width: 6, height: 6, background: '#f43f5e', borderRadius: '50%' }} />
          </div>
          <Settings style={{ width: 16, height: 16, color: '#71717a' }} />
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 9999, background: 'rgba(255,255,255,0.08)' }}>
            <User style={{ width: 14, height: 14, color: '#71717a' }} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: '#a1a1aa' }}>SECURE</span>
          </div>
        </div>

        {/* Left panel */}
        <aside style={{ position: 'absolute', left: 48, top: 112, bottom: 112, width: 320, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', pointerEvents: 'auto' }}>
          <ActivityCard />
          <SolarWindCard />
          <GoesCard />
        </aside>

        {/* Right side — filter + live feed */}
        <div style={{ position: 'absolute', right: 48, top: 112, bottom: 112, width: 320, display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'auto' }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, ...GLASS }}>
            <FilterBar />
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 16, borderRadius: 16, ...GLASS, display: 'flex', flexDirection: 'column' }}>
            <LiveFeed />
          </div>
        </div>

        {/* Timeline */}
        <TimelineSlider />
      </div>
    </>
  );
}
