import { useEffect } from 'react';
import { useDataStore } from './stores/dataStore';
import { useGlobeStore } from './stores/globeStore';
import { api } from './api/client';
import { Header } from './components/Layout/Header';
import { EarthGlobe } from './components/Globe/EarthGlobe';
import { LeafletMap } from './components/Globe/LeafletMap';
import { LiveFeed } from './components/Panels/LiveFeed';
import { AnomalyPanel } from './components/Panels/AnomalyPanel';
import { ActivityCard } from './components/Panels/ActivityCard';
import { TimelineSlider } from './components/Panels/TimelineSlider';
import { Starfield } from './components/Layout/Starfield';

export default function App() {
  const { viewMode } = useGlobeStore();
  const { setStatus, setEvents, setAnomalies, setActivity, setLoading } = useDataStore();

  // Fetch initial data
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
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative font-sans select-none bg-[#020205] text-zinc-100">
      {/* Starfield background */}
      <Starfield />

      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left panel — Activity + Anomalies */}
        <aside className="w-72 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-none">
          <ActivityCard />
          <AnomalyPanel />
        </aside>

        {/* Center — Globe or Map */}
        <main className="flex-1 relative">
          {viewMode === 'globe' ? <EarthGlobe /> : <LeafletMap />}
        </main>

        {/* Right panel — Live Feed */}
        <aside className="w-80 flex flex-col p-4 overflow-hidden">
          <LiveFeed />
        </aside>
      </div>

      {/* Timeline scrubber */}
      <TimelineSlider />
    </div>
  );
}
