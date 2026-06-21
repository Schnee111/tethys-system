import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  Sun, 
  Wind, 
  Bell, 
  User, 
  Wifi, 
  Compass, 
  Settings, 
  Share2, 
  HelpCircle, 
  Database, 
  Layers 
} from 'lucide-react';

import PlanetaryMap from './components/PlanetaryMap';
import LiveFeed from './components/LiveFeed';
import TimelineSlider from './components/TimelineSlider';
import AIAnalyst from './components/AIAnalyst';
import AnomaliesChart from './components/AnomaliesChart';
import { PlanetaryEvent, ChartDataPoint, EventCategory } from './types';

// Helper to format dynamic system times aligned with active simulated UTC increments
const getFormattedTimeOffset = (minutesAgo: number): string => {
  const date = new Date(Date.now() - minutesAgo * 60000);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export default function App() {
  const [timelinePercent, setTimelinePercent] = useState<number>(100);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<PlanetaryEvent | null>(null);
  
  // Catagory Filters Set
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(['seismic', 'solar', 'atmospheric'])
  );
  
  // Real-time counter for live simulated ticks
  const [tickCounter, setTickCounter] = useState<number>(0);

  // Dynamic state database for planetary alerts
  const [events, setEvents] = useState<PlanetaryEvent[]>([]);

  // System local UTC time clock for header
  const [systemTime, setSystemTime] = useState<string>('12:00:00 UTC');

  // Load initial simulated events correctly aligned to current temporal framework
  useEffect(() => {
    const initialEvents: PlanetaryEvent[] = [
      {
        id: "PLN-942",
        type: "seismic",
        timestamp: getFormattedTimeOffset(1),
        originalTime: "14:32:01",
        magnitude: "M 4.2",
        title: "M 4.2 - Honshu, Japan",
        location: "Honshu, Japan",
        x: 78,
        y: 34,
        intensity: 0.85,
        minutesAgo: 1,
        description: "Lithospheric slip mapped under Japan Trench. Depth: 12km. Acoustic hydrophone array registers standard shear resonance."
      },
      {
        id: "PLN-941",
        type: "atmospheric",
        timestamp: getFormattedTimeOffset(2),
        originalTime: "14:31:45",
        magnitude: "Pressure Drop 12hPa",
        title: "Pressure Drop 12hPa - N. Atlantic",
        location: "North Atlantic",
        x: 43,
        y: 28,
        intensity: 0.72,
        minutesAgo: 2,
        description: "Cyclonic pressure drop registered on deep-sea barometric buoy 44011. Isobars squeezing rapidly. Potential high-latitude vortex formation."
      },
      {
        id: "PLN-940",
        type: "solar",
        timestamp: getFormattedTimeOffset(4),
        originalTime: "14:30:12",
        magnitude: "C-Class Flare",
        title: "C-Class Flare Detected",
        location: "Sun Spot AR-3712",
        x: 50,
        y: 50,
        intensity: 0.65,
        minutesAgo: 4,
        description: "Solar flare eruption of peak intensity category C. Coronal mass density projection traveling radial trajectory."
      },
      {
        id: "PLN-939",
        type: "seismic",
        timestamp: getFormattedTimeOffset(6),
        originalTime: "14:28:55",
        magnitude: "M 2.1",
        title: "M 2.1 - California, USA",
        location: "California, USA",
        x: 18,
        y: 35,
        intensity: 0.52,
        minutesAgo: 6,
        description: "Minor fault release along active trace of San Andreas Fault Zone. No crustal distress alert issued."
      },
      {
        id: "PLN-938",
        type: "atmospheric",
        timestamp: getFormattedTimeOffset(9),
        originalTime: "14:25:30",
        magnitude: "120km/h Wind",
        title: "Wind Anomaly - 120km/h",
        location: "Southern Pacific Storm Basin",
        x: 28,
        y: 72,
        intensity: 0.78,
        minutesAgo: 9,
        description: "Tropospheric speed gusts exceed standard deviation thresholds. Marine advisory coordinates propagated."
      },
      // Historical Events further in time to populate timeline and trends
      {
        id: "PLN-935",
        type: "seismic",
        timestamp: getFormattedTimeOffset(45),
        originalTime: "13:48:10",
        magnitude: "M 3.6",
        title: "M 3.6 - Mid-Atlantic Ridge",
        location: "Mid-Atlantic Ridge",
        x: 42,
        y: 45,
        intensity: 0.62,
        minutesAgo: 45,
        description: "Standard divergent boundary seismic shift recorded at deep marine station."
      },
      {
        id: "PLN-930",
        type: "atmospheric",
        timestamp: getFormattedTimeOffset(125),
        originalTime: "12:28:40",
        magnitude: "Cyclonic Isobars",
        title: "Tropical Cyclone Formation Alert",
        location: "Indian Ocean",
        x: 68,
        y: 58,
        intensity: 0.9,
        minutesAgo: 125,
        description: "Sustained pressure drop surrounding tropical cell. Warm air convection spiraling outwards."
      },
      {
        id: "PLN-925",
        type: "solar",
        timestamp: getFormattedTimeOffset(210),
        originalTime: "11:02:15",
        magnitude: "M-Class Flare",
        title: "M-Class Solar Eruption Triggered",
        location: "Sun Spot AR-3709",
        x: 50,
        y: 50,
        intensity: 0.88,
        description: "Energetic radiation burst corresponding to M-class active flare. High-latitude aurora predictions updated.",
        minutesAgo: 210
      },
      {
        id: "PLN-920",
        type: "seismic",
        timestamp: getFormattedTimeOffset(340),
        originalTime: "08:52:11",
        magnitude: "M 5.1",
        title: "M 5.1 - Sumatra, Indonesia",
        location: "Sumatra, Indonesia",
        x: 74,
        y: 54,
        intensity: 0.95,
        minutesAgo: 340,
        description: "Significant subduction earthquake logged west of Sumatra. Tsunami warning buoys active but reading normal sea thresholds."
      },
      {
        id: "PLN-912",
        type: "atmospheric",
        timestamp: getFormattedTimeOffset(510),
        originalTime: "06:02:40",
        magnitude: "Jetstream Anomaly",
        title: "Stratospheric Jetstream Shift",
        location: "High Arctic Circle",
        x: 48,
        y: 12,
        intensity: 0.61,
        minutesAgo: 510,
        description: "Sudden stratospheric temperature anomaly displacing primary polar jet stream tracks."
      },
      {
        id: "PLN-902",
        type: "solar",
        timestamp: getFormattedTimeOffset(650),
        originalTime: "03:42:00",
        magnitude: "G1 Storm",
        title: "G1 Class Geomagnetic Resonance",
        location: "Magnetosphere Outer Crust",
        x: 50,
        y: 50,
        intensity: 0.69,
        minutesAgo: 650,
        description: "Solar wind impact initiates geomagnetic storm indices of standard G1 intensity levels."
      }
    ];

    setEvents(initialEvents);
    // Initially select the highest-level seismic event
    setSelectedEvent(initialEvents[0]);
  }, []);

  // System time ticker clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const utcString = now.toISOString().replace('T', ' ').substring(11, 19) + ' UTC';
      setSystemTime(utcString);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Autonomous timeline playback sweep loop
  useEffect(() => {
    let playInterval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      playInterval = setInterval(() => {
        setTimelinePercent((prev) => {
          if (prev >= 100) return 0; // Loop back
          return prev + 1;
        });
      }, 350);
    }
    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  }, [isPlaying]);

  // Handle category toggle
  const toggleCategory = (category: string) => {
    const next = new Set(activeCategories);
    if (next.has(category)) {
      // Don't deselect last category
      if (next.size > 1) {
        next.delete(category);
      }
    } else {
      next.add(category);
    }
    setActiveCategories(next);
  };

  // Live generator simulation injection to make the dashboard feel active and cinematic
  useEffect(() => {
    const generatorInterval = setInterval(() => {
      setTickCounter(prev => prev + 1);

      // Random generator injecting simulated new events every 30 seconds
      if (Math.random() > 0.65) {
        const categories: EventCategory[] = ['seismic', 'solar', 'atmospheric'];
        const chosenType = categories[Math.floor(Math.random() * categories.length)];
        
        let newEvent: PlanetaryEvent;
        const newId = `PLN-${Math.floor(100 + Math.random() * 899)}`;
        const timestamp = getFormattedTimeOffset(0);

        if (chosenType === 'seismic') {
          const intensity = Math.random();
          const magValue = (1.5 + Math.random() * 4).toFixed(1);
          newEvent = {
            id: newId,
            type: 'seismic',
            timestamp,
            originalTime: timestamp,
            magnitude: `M ${magValue}`,
            title: `M ${magValue} - Tectonic Rupture`,
            location: ['Tonga Trench', 'Aki, Japan', 'Gorda Plate', 'Chile Ridge'][Math.floor(Math.random() * 4)],
            x: 20 + Math.random() * 60,
            y: 30 + Math.random() * 40,
            intensity,
            minutesAgo: 0,
            description: `Seismic shock index logged on station receivers. Epicenter displacement indices normal.`
          };
        } else if (chosenType === 'solar') {
          newEvent = {
            id: newId,
            type: 'solar',
            timestamp,
            originalTime: timestamp,
            magnitude: 'Solar Wind High',
            title: 'Solar Plasma Gust Detected',
            location: 'Ionosphere Ring',
            x: 50,
            y: 50,
            intensity: 0.5 + Math.random() * 0.4,
            minutesAgo: 0,
            description: 'Plasma flux density particles impacting outer ionosphere satellites at elevated solar wind speeds.'
          };
        } else {
          const speed = Math.floor(70 + Math.random() * 60);
          newEvent = {
            id: newId,
            type: 'atmospheric',
            timestamp,
            originalTime: timestamp,
            magnitude: `${speed}km/h Wind`,
            title: `Dynamic Wind Anomalies - ${speed}km/h`,
            location: ['Indian Cyclone Sector', 'Bering Strait Basin', 'Cape Drake Crossing'][Math.floor(Math.random() * 3)],
            x: 10 + Math.random() * 80,
            y: 10 + Math.random() * 80,
            intensity: 0.6 + Math.random() * 0.35,
            minutesAgo: 0,
            description: `Atypical isobar compression detected causing high kinetic tropospheric velocity movements.`
          };
        }

        // Shift existing forward minutesAgo by 1 for accurate simulation tracking
        setEvents(prev => {
          const shifted = prev.map(e => ({
            ...e,
            minutesAgo: e.minutesAgo + 1,
            timestamp: getFormattedTimeOffset(e.minutesAgo + 1)
          }));
          return [newEvent, ...shifted].slice(0, 20); // Keep database size stable
        });
      }
    }, 15000);

    return () => clearInterval(generatorInterval);
  }, []);

  // Filter events dynamically based on timeline scrubbing progress (look-back window)
  // If pointer percent is 100%, show everything (0 minutes ago to 12 hours ago)
  // If pointer percent is X%, show events which occurred before/at that playback slice (e.g. minutesAgo >= threshold)
  // Wait, let's filter events such that we show what happened between 12 hours ago and the SELECTED timeline slice.
  // This allows the user to see the state develop historically as they slide forward!
  // At percent = 0, we see events that occurred 12 hours ago (minutesAgo around 720).
  // At percent = 100, we see all events up to now (minutesAgo >= 0).
  const visibleEvents = events.filter((e) => {
    // Convert slider progress (0-100) to a cutoff threshold
    // 0 threshold means show all events. 720 means show only events that occurred at least 12 hours ago.
    const sliderMinutesAgoThreshold = 720 - (timelinePercent / 100) * 720;
    return e.minutesAgo >= sliderMinutesAgoThreshold;
  });

  // Compile statistics for charts dynamically based on visible alerts
  const generateChartDataPoints = (): ChartDataPoint[] => {
    const points: ChartDataPoint[] = [];
    const divisions = 12;

    for (let i = divisions; i >= 0; i--) {
      const hourLabel = i === 0 ? 'NOW' : `-${i}H`;
      const minAgeStart = i * 60;
      const minAgeEnd = (i + 1) * 60;

      // Filter events visible in this temporal chunk
      const chunkEvents = visibleEvents.filter(
        e => e.minutesAgo >= minAgeStart && e.minutesAgo < minAgeEnd
      );

      points.push({
        timeLabel: hourLabel,
        seismic: chunkEvents.filter(e => e.type === 'seismic').length,
        solar: chunkEvents.filter(e => e.type === 'solar').length,
        atmospheric: chunkEvents.filter(e => e.type === 'atmospheric').length,
      });
    }

    return points;
  };

  const chartData = generateChartDataPoints();

  return (
    <div 
      className="min-h-screen bg-[#020205] text-zinc-100 flex flex-col justify-between overflow-hidden relative font-sans select-none"
      id="tethys-root-viewport"
    >
      {/* Central 3D Digital Globe Image Background Backdrop */}
      <main className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Deep space solid foundation */}
        <div className="absolute inset-0 bg-[#020208]"></div>
        
        {/* Dense deep cosmic starfield layer with different levels of depth and twinkle rates */}
        <div className="absolute inset-0 opacity-90 pointer-events-none">
          {/* Dense tiny deep stars */}
          <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20px_30px,#fff,transparent),radial-gradient(1.5px_1.5px_at_150px_60px,#fff,transparent),radial-gradient(1px_1px_at_300px_120px,#fff,transparent),radial-gradient(2px_2px_at_450px_400px,rgba(255,255,255,0.7),transparent),radial-gradient(1px_1px_at_200px_280px,#fff,transparent)] bg-[size:400px_400px] opacity-40"></div>
          <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_80px_100px,#fff,transparent),radial-gradient(1.5px_1.5px_at_250px_180px,#fff,transparent),radial-gradient(2px_2px_at_500px_250px,rgba(255,255,255,0.8),transparent),radial-gradient(1px_1px_at_350px_450px,#fff,transparent)] bg-[size:500px_500px] opacity-30 bg-center"></div>
          
          {/* Star groups with three scales of twinkling speeds */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Slow tranquil twinkle */}
            <g className="animate-twinkle-slow text-zinc-400">
              <circle cx="4%" cy="8%" r="1" fill="currentColor" />
              <circle cx="28%" cy="30%" r="1.5" fill="currentColor" />
              <circle cx="86%" cy="12%" r="1" fill="currentColor" />
              <circle cx="48%" cy="72%" r="1" fill="currentColor" />
              <circle cx="94%" cy="82%" r="1.5" fill="currentColor" className="text-zinc-500" />
              <circle cx="12%" cy="60%" r="1" fill="currentColor" />
              <circle cx="40%" cy="15%" r="1.2" fill="currentColor" />
              <circle cx="75%" cy="88%" r="1" fill="currentColor" />
            </g>
            {/* Mid speed soft twinkling stars */}
            <g className="animate-twinkle-mid text-zinc-300">
              <circle cx="16%" cy="17%" r="1.5" fill="currentColor" />
              <circle cx="41%" cy="20%" r="2" fill="currentColor" className="text-amber-100/80" />
              <circle cx="70%" cy="36%" r="1.2" fill="currentColor" />
              <circle cx="89%" cy="58%" r="1.5" fill="currentColor" className="text-sky-300/70" />
              <circle cx="10%" cy="85%" r="1" fill="currentColor" />
              <circle cx="64%" cy="84%" r="1.8" fill="currentColor" />
              <circle cx="55%" cy="5%" r="1.2" fill="currentColor" />
              <circle cx="93%" cy="30%" r="1.5" fill="currentColor" />
            </g>
            {/* Fast twinkling stars */}
            <g className="animate-twinkle-fast text-zinc-200">
              <circle cx="6%" cy="40%" r="1.2" fill="currentColor" />
              <circle cx="32%" cy="52%" r="1.5" fill="currentColor" />
              <circle cx="66%" cy="10%" r="1" fill="currentColor" />
              <circle cx="76%" cy="78%" r="1.5" fill="currentColor" className="text-cyan-200/90" />
              <circle cx="51%" cy="45%" r="1.2" fill="currentColor" />
              <circle cx="82%" cy="48%" r="1" fill="currentColor" />
              <circle cx="22%" cy="88%" r="1.2" fill="currentColor" />
            </g>
          </svg>
        </div>

        <img 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8ca9NcyQWB33HBVg2cy9w6r4ifOxkA20Znd3ESQB8Ah8DrX1G8it3NkHfu1S5RpYXtJB1axbi-UFBtwrEqmN92CMFT92HP9gal2l6zN4l4-bZ9lc3r2RAU7rz1UDlcj3bbf6WtQQVdUf7iRcx9hJfbXYRWuYdIZ2fTPkVkC-i_bCdtemr1JeNcFuuW0a_sKQLv9s1Eixpb28v7v4PVL7JzD5qCPAQOjabKuerjWCpNUWFIjaSYgH4QYSYJiYNl7XQAFXwDqU5_ak" 
          alt="Realistic Glowing Earth Globe Backdrop" 
          className="w-full h-full object-cover opacity-65 scale-100 select-none brightness-150 contrast-125 saturate-150 pointer-events-none"
          referrerPolicy="no-referrer"
        />
        {/* Cinematic shadows and atmospheric glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,2,8,0.92)_95%)] pointer-events-none"></div>
        
        {/* Vibrant, glowing cyan/blue planetary halo & backglow effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.3),rgba(34,197,94,0.06),transparent_65%)] pointer-events-none blur-3xl animate-pulse" style={{ animationDuration: "8s" }}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.22),transparent_55%)] pointer-events-none blur-2xl"></div>
      </main>

      {/* Floating Header - Top Left */}
      <header className="fixed top-8 left-12 z-50 flex items-center gap-6">
        <h1 className="font-sans text-2xl font-light tracking-[0.35em] text-white uppercase select-none">
          TETHYS
        </h1>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-0.5 rounded-full select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse"></div>
          <span className="font-mono text-[9px] tracking-widest text-green-400 uppercase font-semibold">NOMINAL</span>
        </div>
      </header>

      {/* Right Action HUD Buttons - Top Right */}
      <div className="fixed top-8 right-12 z-50 flex items-center gap-6 text-zinc-400/60 pl-6 pr-2 py-1 rounded-full bg-white/[0.035] backdrop-blur-3xl shadow-2xl shadow-black/40">
        <span className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase mr-1 select-none">OPERATOR: DAFFA</span>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="Signal Status">
          <Wifi className="w-4 h-4 text-emerald-400/80 animate-pulse" />
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 relative cursor-pointer" title="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
        </button>
        <button className="hover:text-white transition-colors duration-300 flex items-center p-1 cursor-pointer" title="System Settings">
          <Settings className="w-4 h-4" />
        </button>
        <span className="w-px h-3.5 bg-white/5" />
        <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-white/5 text-zinc-300" title="Account Details">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] uppercase font-mono tracking-widest hidden sm:inline">SECURE</span>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10" id="tethys-workspace-core">
        
        {/* Symmetrical Left Flowing Section Panel: Charts & AI */}
        <aside 
          id="dashboard-telemetry-panel" 
          className="fixed left-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 overflow-y-auto scrollbar-none pr-1 transition-all duration-500"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Trends line chart */}
          <AnomaliesChart data={chartData} />

          {/* Splicer Cognitive AI service interface */}
          <AIAnalyst events={visibleEvents} />

          {/* Underlay coordinate status ticker */}
          <div className="p-3.5 rounded-2xl bg-white/[0.035] backdrop-blur-3xl text-left font-sans text-[10px] text-zinc-500 space-y-1.5 shadow-2xl shadow-black/40 shrink-0">
            <div className="flex justify-between items-center">
              <span className="font-sans text-[9px] text-zinc-400/50 uppercase tracking-wider font-semibold">SENSORS GRID CAPTURE</span>
              <span className="text-emerald-400/80 font-bold font-mono text-[9px]">UTC_STABLE</span>
            </div>
            <div className="flex justify-between font-mono text-[9px]">
              <span>CRUSTAL VELOCITY</span>
              <span className="text-zinc-400">0.05μm/s [OK]</span>
            </div>
          </div>
        </aside>

        {/* Center Canvas overlay mapping vector markers on top of globe */}
        <div className="flex-1 flex flex-col justify-between relative bg-transparent" id="center-globe-panel">
          <PlanetaryMap 
            events={visibleEvents}
            selectedEvent={selectedEvent}
            onSelectEvent={(e) => setSelectedEvent(e)}
            activeCategories={activeCategories}
          />
        </div>

        {/* Floating Right Flowing Section Panel: Live Event Feed logs */}
        <LiveFeed 
          events={visibleEvents}
          selectedEvent={selectedEvent}
          onSelectEvent={(e) => setSelectedEvent(e)}
          activeCategories={activeCategories}
        />
      </div>

      {/* Floating Layer Dock - Bottom Left (Seismic, Solar, Atmospheric Switchers) */}
      <nav 
        id="category-filters-deck"
        className="fixed bottom-12 left-12 z-40 bg-white/[0.04] backdrop-blur-3xl rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl shadow-black/50 select-none"
      >
        <button 
          onClick={() => toggleCategory('seismic')}
          className={`flex flex-col items-center gap-1 group cursor-pointer transition-all duration-300 ${
            activeCategories.has('seismic') ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-75'
          }`}
        >
          <Globe className={`w-4 h-4 group-hover:scale-110 transition-transform ${activeCategories.has('seismic') ? 'text-rose-400' : 'text-zinc-400'}`} />
          <span className="font-mono text-[9px] tracking-widest text-zinc-300 uppercase font-bold">Seismic</span>
        </button>

        <button 
          onClick={() => toggleCategory('solar')}
          className={`flex flex-col items-center gap-1 group cursor-pointer transition-all duration-300 ${
            activeCategories.has('solar') ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-75'
          }`}
        >
          <Sun className={`w-4 h-4 group-hover:scale-110 transition-transform ${activeCategories.has('solar') ? 'text-amber-400' : 'text-zinc-400'}`} />
          <span className="font-mono text-[9px] tracking-widest text-zinc-300 uppercase font-bold">Solar</span>
        </button>

        <button 
          onClick={() => toggleCategory('atmospheric')}
          className={`flex flex-col items-center gap-1 group cursor-pointer transition-all duration-300 ${
            activeCategories.has('atmospheric') ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-75'
          }`}
        >
          <Wind className={`w-4 h-4 group-hover:scale-110 transition-transform ${activeCategories.has('atmospheric') ? 'text-sky-450 text-sky-400' : 'text-zinc-400'}`} />
          <span className="font-mono text-[9px] tracking-widest text-zinc-300 uppercase font-bold">Atmospheric</span>
        </button>
      </nav>

      {/* Floating Timeline Slider Scrubber at Bottom Center */}
      <div className="relative z-45" id="timeline-footer-dock">
        <TimelineSlider 
          percent={timelinePercent}
          onChange={(p) => setTimelinePercent(p)}
          isPlaying={isPlaying}
          setIsPlaying={(p) => setIsPlaying(p)}
        />
      </div>
    </div>
  );
}
