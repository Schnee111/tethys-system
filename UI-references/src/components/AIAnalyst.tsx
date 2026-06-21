import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Loader2, ArrowRight, CornerDownLeft, ShieldAlert } from 'lucide-react';
import { PlanetaryEvent } from '../types';

interface AIAnalystProps {
  events: PlanetaryEvent[];
}

export default function AIAnalyst({ events }: AIAnalystProps) {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [error, setError] = useState<string>('');

  const sendAnalysisRequest = async (promptText?: string) => {
    setLoading(true);
    setResponse('');
    setError('');

    // Compile active telemetry context to feed into Gemini
    const telemetryContext = events.map(e => (
      `- [${e.timestamp}] Category: ${e.type.toUpperCase()}, Title: "${e.title}", Location: "${e.location}". Details: ${e.description}`
    )).join('\n');

    const bodyPayload = {
      telemetry: telemetryContext,
      customQuery: promptText || '',
    };

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        throw new Error('Analyst system offline or missing credentials.');
      }

      const data = await res.json();
      setResponse(data.analysis || 'No report could be compiled at this epoch.');
    } catch (err: any) {
      setError(err?.message || 'Cognitive channel disruption. Check secret API keys.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (customPrompt.trim()) {
        sendAnalysisRequest(customPrompt);
        setCustomPrompt('');
      }
    }
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-3xl p-5 rounded-2xl text-left font-sans flex flex-col justify-between shadow-2xl shadow-black/40" id="ai-cognitive-panel">
      <div className="flex flex-col gap-3 mb-3.5" id="ai-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-400/60 font-sans text-[10px] uppercase tracking-widest font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400/80 animate-pulse" />
            Planetary Cognitive Core
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-white font-sans">
            Tethys AI Core Synthesis
          </h4>
        </div>
        <button
          onClick={() => sendAnalysisRequest()}
          disabled={loading || events.length === 0}
          className="w-full text-[10px] font-sans uppercase bg-white/5 hover:bg-white/10 active:bg-white/8 text-zinc-300 hover:text-white px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-bold"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              Splicing...
            </>
          ) : (
            <>
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              Synthesize Outlook
            </>
          )}
        </button>
      </div>

      {/* Main output console */}
      <div 
        className="flex-1 min-h-[140px] max-h-[180px] overflow-y-auto mb-4 bg-black/15 p-4 rounded-xl text-xs font-mono leading-relaxed text-zinc-400 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
        id="ai-console-logs"
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 text-xs font-sans uppercase tracking-widest"
            >
              <div className="relative w-10 h-10 mb-4">
                <span className="absolute inset-0 rounded-full border border-purple-500/10 animate-ping" />
                <span className="absolute inset-2 rounded-full border border-white/10 animate-pulse" />
                <Brain className="absolute inset-2 w-6 h-6 text-purple-400 m-auto" />
              </div>
              <span className="text-[10px] text-zinc-400">Connecting Cognitive Co-Processors...</span>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 text-rose-400 p-2 uppercase tracking-wide text-[10px]"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold underline block mb-1">COGNITIVE FAULT CODES DETECTED</span>
                {error}
                <span className="text-[9px] text-zinc-500 block mt-2">
                  Verify process.env.GEMINI_API_KEY inside the dashboard secrets config.
                </span>
              </div>
            </motion.div>
          ) : response ? (
            <motion.div 
              key="response-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="text-[10px] text-purple-400 font-bold pb-1 flex justify-between items-center pr-1 uppercase tracking-widest leading-none">
                <span>SYNTHESIZED INTEL REPORT</span>
                <span className="text-zinc-650 text-[8px] font-normal font-sans">COGNITION LEVEL: 100%</span>
              </div>
              <div className="whitespace-pre-wrap text-zinc-350 antialiased font-sans text-[11px] leading-relaxed font-light">
                {response}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="idle-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-zinc-500 h-full flex flex-col justify-center items-center py-6 text-center antialiased"
            >
              <Brain className="w-5 h-5 text-zinc-700 mb-2" />
              <div className="text-zinc-400 font-bold text-[10px] tracking-wider uppercase mb-1">
                Awaiting Cognitive Trigger
              </div>
              <div className="text-[10px] text-zinc-600 max-w-[280px] font-sans font-light">
                Ask specific questions about earthquake trigger points, solar geomagnetic indexes, meteorological patterns, or hit "Synthesize Outlook".
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="relative flex items-center" id="custom-ai-inquire-box">
        <input
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={loading}
          placeholder="Ask Tethys Intelligence (e.g. 'Coincidence of solar & seismic shifts?')"
          className="w-full bg-white/[0.02] border-none rounded-xl pl-3 pr-10 py-2.5 text-xs font-sans text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-40 select-text"
        />
        <button
          onClick={() => {
            if (customPrompt.trim()) {
              sendAnalysisRequest(customPrompt);
              setCustomPrompt('');
            }
          }}
          disabled={loading || !customPrompt.trim()}
          className="absolute right-1.5 p-1 text-zinc-400 hover:text-white disabled:hover:text-zinc-500 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
