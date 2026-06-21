import { useEffect, useState, useCallback } from 'react';
import { Wifi, Bell, Settings, User } from 'lucide-react';
import { useDataStore } from './stores/dataStore';
import { api } from './api/client';
import { EarthGlobe } from './components/EarthGlobe';
import { LiveFeed } from './components/LiveFeed';
import { AnomalyPanel } from './components/AnomalyPanel';
import { ActivityCard } from './components/ActivityCard';
import { SensorsGrid } from './components/SensorsGrid';
import { CategoryFilter } from './components/CategoryFilter';
import { TimelineSlider } from './components/TimelineSlider';

export default function App() {
  const { setStatus, setEvents, setAnomalies, setActivity, setLoading } = useDataStore();
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(['seismic', 'solar', 'atmospheric'])
  );

  const toggleCategory = useCallback((category: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size > 1) next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusData, seismicData, anomalyData, activityData] = await Promise.all([
          api.getStatus(),
          api.getSeismic({ hours: 168, limit: 500 }),
          api.getAnomalies({ hours: 24 }),
          api.getActivity(),
        ]);
        setStatus(statusData);
        setEvents(seismicData.events || []);
        setAnomalies(anomalyData.anomalies || []);
        setActivity(activityData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Globe — IS the background, fills entire viewport */}
      <EarthGlobe />

      {/* Overlays — on top of globe, behind panels */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          radial-gradient(circle at center, transparent 30%, rgba(2,2,8,0.6) 80%),
          linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 20%, transparent 80%, rgba(0,0,0,0.5))
        `,
      }} />

      {/* UI Layer — on top of everything */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        {/* Header */}
        <header style={{ position: 'absolute', top: 32, left: 48, display: 'flex', alignItems: 'center', gap: 24, pointerEvents: 'auto' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 300, letterSpacing: '0.35em', color: '#fff', textTransform: 'uppercase', margin: 0 }}>
            TETHYS
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', padding: '2px 10px', borderRadius: 9999 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.5)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: '#4ade80', textTransform: 'uppercase', fontWeight: 600 }}>
              NOMINAL
            </span>
          </div>
        </header>

        {/* HUD — top right */}
        <div style={{ position: 'absolute', top: 32, right: 48, display: 'flex', alignItems: 'center', gap: 24, padding: '4px 24px', borderRadius: 9999, background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(64px)', pointerEvents: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em', color: '#71717a', textTransform: 'uppercase' }}>
            OPERATOR: DAFFA
          </span>
          <Wifi style={{ width: 16, height: 16, color: '#34d399' }} />
          <div style={{ position: 'relative' }}>
            <Bell style={{ width: 16, height: 16, color: '#71717a' }} />
            <span style={{ position: 'absolute', top: 1, right: 1, width: 6, height: 6, background: '#f43f5e', borderRadius: '50%' }} />
          </div>
          <Settings style={{ width: 16, height: 16, color: '#71717a' }} />
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)' }}>
            <User style={{ width: 14, height: 14, color: '#71717a' }} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: '#a1a1aa' }}>SECURE</span>
          </div>
        </div>

        {/* Left panel */}
        <aside style={{ position: 'absolute', left: 48, top: 112, bottom: 112, width: 320, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', pointerEvents: 'auto' }}>
          <ActivityCard />
          <AnomalyPanel />
          <SensorsGrid />
        </aside>

        {/* Right panel */}
        <aside style={{ position: 'absolute', right: 48, top: 112, bottom: 112, width: 320, display: 'flex', flexDirection: 'column', gap: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(64px)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', pointerEvents: 'auto' }}>
          <LiveFeed />
        </aside>

        {/* Category filter — bottom left */}
        <div style={{ pointerEvents: 'auto' }}>
          <CategoryFilter activeCategories={activeCategories} onToggle={toggleCategory} />
        </div>

        {/* Timeline — bottom center */}
        <div style={{ pointerEvents: 'auto' }}>
          <TimelineSlider />
        </div>
      </div>
    </>
  );
}
