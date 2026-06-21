import { useEffect } from 'react';
import { Wifi, Bell, Settings, User } from 'lucide-react';
import { useDataStore } from './stores/dataStore';
import { api } from './api/client';
import { Starfield } from './components/Starfield';
import { EarthGlobe } from './components/EarthGlobe';
import { LiveFeed } from './components/LiveFeed';
import { AnomalyPanel } from './components/AnomalyPanel';
import { ActivityCard } from './components/ActivityCard';
import { TimelineSlider } from './components/TimelineSlider';

export default function App() {
  const { setStatus, setEvents, setAnomalies, setActivity, setLoading } = useDataStore();

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
    <div className="min-h-screen bg-[#020205] text-zinc-100 flex flex-col justify-between overflow-hidden relative font-sans select-none">
      {/* Background layer: starfield + globe */}
      <main className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#020208]" />
        <Starfield />
        {/* Cinematic shadows */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,2,8,0.92)_95%)] pointer-events-none" />
        {/* Atmospheric glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.3),rgba(34,197,94,0.06),transparent_65%)] pointer-events-none blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.22),transparent_55%)] pointer-events-none blur-2xl" />
        {/* Globe */}
        <div className="w-full h-full">
          <EarthGlobe />
        </div>
      </main>

      {/* Header — top left */}
      <header className="fixed top-8 left-12 z-50 flex items-center gap-6">
        <h1 className="font-sans text-2xl font-light tracking-[0.35em] text-white uppercase select-none">
          TETHYS
        </h1>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-0.5 rounded-full select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" />
          <span className="font-mono text-[9px] tracking-widest text-green-400 uppercase font-semibold">NOMINAL</span>
        </div>
      </header>

      {/* HUD — top right */}
      <div className="fixed top-8 right-12 z-50 flex items-center gap-6 text-zinc-400/60 pl-6 pr-2 py-1 rounded-full bg-white/[0.035] backdrop-blur-3xl shadow-2xl shadow-black/40">
        <span className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase mr-1 select-none">OPERATOR: DAFFA</span>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="Signal Status">
          <Wifi className="w-4 h-4 text-emerald-400/80 animate-pulse" />
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 relative cursor-pointer" title="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="Settings">
          <Settings className="w-4 h-4" />
        </button>
        <span className="w-px h-3.5 bg-white/5" />
        <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-white/5 text-zinc-300" title="Account">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] uppercase font-mono tracking-widest hidden sm:inline">SECURE</span>
        </div>
      </div>

      {/* Left panel — floating */}
      <aside className="fixed left-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 overflow-y-auto scrollbar-none pr-1 transition-all duration-500" style={{ scrollbarWidth: 'none' }}>
        <ActivityCard />
        <AnomalyPanel />
      </aside>

      {/* Right panel — floating */}
      <aside className="fixed right-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 bg-white/[0.035] backdrop-blur-3xl px-5 py-5 rounded-2xl shadow-2xl shadow-black/40 transition-all duration-500">
        <LiveFeed />
      </aside>

      {/* Timeline */}
      <TimelineSlider />
    </div>
  );
}
