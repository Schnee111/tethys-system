import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Wifi, Bell, Settings, User } from 'lucide-react';
import { useDataStore } from './stores/dataStore';
import { useGlobeStore } from './stores/globeStore';
import { api } from './api/client';
import { EarthGlobe } from './components/Globe/EarthGlobe';
import { LiveFeed } from './components/Panels/LiveFeed';
import { AnomalyPanel } from './components/Panels/AnomalyPanel';
import { ActivityCard } from './components/Panels/ActivityCard';
import { TimelineSlider } from './components/Panels/TimelineSlider';
import { Starfield } from './components/Layout/Starfield';

export default function App() {
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#020205] text-zinc-100 flex flex-col justify-between overflow-hidden relative font-sans select-none"
      id="tethys-root-viewport"
    >
      {/* Starfield background */}
      <Starfield />

      {/* Floating Header */}
      <header className="fixed top-8 left-12 z-50 flex items-center gap-6">
        <h1 className="font-sans text-2xl font-light tracking-[0.35em] text-white uppercase select-none">
          TETHYS
        </h1>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-0.5 rounded-full select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" />
          <span className="font-mono text-[9px] tracking-widest text-green-400 uppercase font-semibold">
            NOMINAL
          </span>
        </div>
      </header>

      {/* Right Action HUD */}
      <div className="fixed top-8 right-12 z-50 flex items-center gap-6 text-zinc-400/60 pl-6 pr-2 py-1 rounded-full bg-white/[0.035] backdrop-blur-3xl shadow-2xl shadow-black/40">
        <span className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase mr-1 select-none">
          OPERATOR: DAFFA
        </span>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="Signal Status">
          <Wifi className="w-4 h-4 text-emerald-400/80 animate-pulse" />
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 relative cursor-pointer" title="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="System Settings">
          <Settings className="w-4 h-4" />
        </button>
        <span className="w-px h-3.5 bg-white/5" />
        <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-white/5 text-zinc-300" title="Account">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] uppercase font-mono tracking-widest hidden sm:inline">SECURE</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10" id="tethys-workspace-core">
        {/* Left Panel */}
        <aside
          id="dashboard-telemetry-panel"
          className="fixed left-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 overflow-y-auto scrollbar-none pr-1 transition-all duration-500"
          style={{ scrollbarWidth: 'none' }}
        >
          <ActivityCard />
          <AnomalyPanel />
        </aside>

        {/* Center Globe */}
        <main className="flex-1 relative">
          <EarthGlobe />
        </main>

        {/* Right Panel */}
        <aside className="fixed right-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 bg-white/[0.035] backdrop-blur-3xl px-5 py-5 rounded-2xl shadow-2xl shadow-black/40 transition-all duration-500">
          <LiveFeed />
        </aside>
      </div>

      {/* Timeline */}
      <TimelineSlider />
    </div>
  );
}
