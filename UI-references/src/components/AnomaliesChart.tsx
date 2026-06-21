import React, { useState } from 'react';
import { ChartDataPoint } from '../types';

interface AnomaliesChartProps {
  data: ChartDataPoint[];
}

export default function AnomaliesChart({ data }: AnomaliesChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 500;
  const height = 110;
  const padding = 20;

  // Max value for scaling (default to 6 to keep layout stable)
  const maxValue = 7;

  // Generate SVG coordinates for a series
  const getCoordinates = (key: 'seismic' | 'solar' | 'atmospheric') => {
    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const val = d[key];
      const y = height - padding - (val / maxValue) * (height - padding * 2);
      return { x, y, val };
    });

    const pathD = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
      : '';

    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return { pathD, areaD, points };
  };

  const seismic = getCoordinates('seismic');
  const solar = getCoordinates('solar');
  const atmospheric = getCoordinates('atmospheric');

  return (
    <div className="bg-white/[0.03] backdrop-blur-3xl p-4 rounded-2xl text-left font-sans flex flex-col justify-between shadow-2xl shadow-black/40" id="anomaly-trends-dashboard">
      <div className="flex flex-col gap-1.5 mb-2">
        <h4 className="font-sans text-[10px] text-zinc-400/60 uppercase tracking-widest font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Planetary Fluctuations (12H)
        </h4>
        <div className="flex gap-3 text-[9px] font-mono font-medium text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-rose-400 inline-block" /> SEISMIC</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-400 inline-block" /> SOLAR</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-sky-400 inline-block" /> ATMOS</span>
        </div>
      </div>

      <div className="relative w-full h-[110px]" id="anomalies-svg-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines - set to ultra clean transparent/faint */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + ratio * (height - padding * 2);
            return (
              <line
                key={`grid-${idx}`}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgba(255, 255, 255, 0.015)"
                strokeWidth="1"
              />
            );
          })}

          {/* Time divisions - set to clean transparent */}
          {data.map((d, idx) => {
            if (idx % 3 !== 0 && idx !== data.length - 1) return null;
            const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
            return (
              <g key={`time-tick-${idx}`}>
                <line
                  x1={x}
                  y1={padding}
                  x2={x}
                  y2={height - padding}
                  stroke="rgba(255, 255, 255, 0.01)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <text
                  x={x}
                  y={height - 2}
                  fill="rgba(255, 255, 255, 0.25)"
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  {d.timeLabel}
                </text>
              </g>
            );
          })}

          {/* Atmospheric Area & Code Line */}
          <path d={atmospheric.areaD} fill="rgba(96, 165, 250, 0.04)" />
          <path d={atmospheric.pathD} fill="none" stroke="#60a5fa" strokeWidth="1.25" opacity="0.65" />

          {/* Solar Area & Code Line */}
          <path d={solar.areaD} fill="rgba(251, 191, 36, 0.04)" />
          <path d={solar.pathD} fill="none" stroke="#fbbf24" strokeWidth="1.25" opacity="0.7" />

          {/* Seismic Area & Code Line */}
          <path d={seismic.areaD} fill="rgba(244, 114, 114, 0.04)" />
          <path d={seismic.pathD} fill="none" stroke="#f87171" strokeWidth="1.5" opacity="0.9" />

          {/* Vertical scrub scanner cursor tracking */}
          {data.map((d, index) => {
            const x = padding + (index / (data.length - 1)) * (width - padding * 2);
            return (
              <g 
                key={`hit-${index}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(index)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Visual Cursor Scanner Line */}
                {hoveredIdx === index && (
                  <line
                    x1={x}
                    y1={padding - 5}
                    x2={x}
                    y2={height - padding + 5}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 0 4px rgba(255, 255, 255, 0.2))"
                  />
                )}
                {/* Hit Box target overlay */}
                <rect
                  x={x - (width / data.length) / 2}
                  y={0}
                  width={width / data.length}
                  height={height}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Indicator Tooltip Card */}
        {hoveredIdx !== null && hoveredIdx < data.length && (
          <div 
            className="absolute z-30 bg-[#07070a]/95 backdrop-blur-xl p-2 rounded text-[10px] font-mono text-zinc-350 pointer-events-none shadow-xl shadow-black/80 flex gap-3 -top-16"
            style={{
              left: `${Math.min(Math.max((hoveredIdx / (data.length - 1)) * 100 - 10, 5), 75)}%`
            }}
          >
            <div>
              <div className="text-zinc-500 mb-0.5 uppercase">EPOCH TIME</div>
              <div className="font-bold text-white mb-1">{data[hoveredIdx].timeLabel}</div>
            </div>
            <div className="pl-2 bg-white/5 w-px self-stretch" />
            <div>
              <div className="text-rose-400">SEISMICS: {data[hoveredIdx].seismic}</div>
              <div className="text-amber-400">SOLAR FL: {data[hoveredIdx].solar}</div>
              <div className="text-sky-400">ATMOS CL: {data[hoveredIdx].atmospheric}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
