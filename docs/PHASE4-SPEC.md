# TETHYS — Phase 4 Technical Specification: Intelligence Layer

## Overview

Phase 4 makes Tethys feel alive. Not just data visualization, but a system that observes, interprets, and communicates. This is where the "Lament Detector" concept becomes real — Tethys watches for cascading anomalies across domains and explains what it sees in natural language.

**Duration:** 2 weeks
**Prerequisite:** Phase 1-3 complete, 30+ days of data, anomalies and correlations flowing
**Goal:** Tethys generates meaningful, human-readable insights about planetary state

---

## Components

```
┌─────────────────────────────────────────────────────────┐
│              INTELLIGENCE LAYER                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Pattern    │  │  Narrative   │  │   Lament     │  │
│  │   Memory     │  │  Generator   │  │   Detector   │  │
│  │              │  │              │  │              │  │
│  │ Historical   │  │ Template +   │  │ Cascading    │  │
│  │ pattern DB   │  │ dynamic fill │  │ anomaly      │  │
│  │ "I saw this  │  │ "Solar wind  │  │ detection    │  │
│  │  before..."  │  │  spiked..."  │  │ across       │  │
│  │              │  │              │  │ domains      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema (New Tables)

### Table: pattern_catalog (Non-Hypertable)

```sql
-- Pattern catalog: stores the "what" — unique pattern signatures.
-- NOT a hypertable because pattern_id is the primary key, not time.
-- Used for ON CONFLICT DO UPDATE to increment occurrence_count.

CREATE TABLE pattern_catalog (
    pattern_id        TEXT PRIMARY KEY,
    pattern_type      TEXT NOT NULL,
    domains_involved  TEXT[] NOT NULL,
    metrics_involved  TEXT[] NOT NULL,
    binned_signature  JSONB NOT NULL,
    description       TEXT,
    first_seen        TIMESTAMPTZ NOT NULL,
    last_seen         TIMESTAMPTZ NOT NULL,
    occurrence_count  INTEGER DEFAULT 1,
    avg_recurrence_interval_hours REAL,  -- RENAMED: this is time BETWEEN
                                         -- occurrences, not duration of event.
                                         -- "avg_duration" was misleading.
                                         -- Source: Gemini Review
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON pattern_catalog (pattern_type);
CREATE INDEX ON pattern_catalog (domains_involved);
```

### Table: pattern_events (Hypertable)

```sql
-- Pattern events: stores the "when" — append-only log of each occurrence.
-- IS a hypertable because time is the primary dimension.
-- Used for historical analysis and timeline queries.

CREATE TABLE pattern_events (
    time              TIMESTAMPTZ NOT NULL,
    pattern_id        TEXT NOT NULL,
    activity_score      REAL,
    domains_active    TEXT[],
    raw_snapshot      JSONB,
    PRIMARY KEY (time, pattern_id)
);

SELECT create_hypertable('pattern_events', 'time');
CREATE INDEX ON pattern_events (pattern_id, time DESC);
```

### Pattern Memory Logic

```python
class PatternMemory:
    """Remember and recognize recurring patterns.
    
    TWO-TABLE ARCHITECTURE:
    - pattern_catalog: stores unique patterns (PK = pattern_id)
      → ON CONFLICT DO UPDATE works because pattern_id is stable
    - pattern_events: stores occurrence timeline (PK = time, pattern_id)
      → append-only log for historical queries
    
    Source: Gemini Review — "Pattern Memory counter that never increments"
    Problem: PK (time, pattern_id) means ON CONFLICT never triggers
    because time changes with each occurrence.
    """
    
    # ... BIN_CONFIG and _bin_value methods (unchanged) ...
    
    async def check_pattern(self, pool, current_state):
        """Check if current state matches a known pattern in catalog."""
        signature = self._compute_signature(current_state)
        pattern_id = hashlib.md5(
            json.dumps(signature, sort_keys=True).encode()
        ).hexdigest()[:12]
        
        query = """
            SELECT pattern_id, description, occurrence_count, 
                   avg_recurrence_interval_hours, first_seen, last_seen
            FROM pattern_catalog
            WHERE pattern_id = $1
        """
        async with pool.acquire() as conn:
            match = await conn.fetchrow(query, pattern_id)
        
        if match:
            return {
                'is_recurrence': True,
                'pattern_id': match['pattern_id'],
                'times_seen': match['occurrence_count'],
                'avg_recurrence_interval': match['avg_recurrence_interval_hours'],
                'first_seen': match['first_seen'],
                'last_seen': match['last_seen'],
                'description': match['description']
            }
        
        return {'is_recurrence': False}
    
    async def record_pattern(self, pool, state):
        """Record a pattern occurrence in BOTH tables."""
        signature = self._compute_signature(state)
        pattern_id = hashlib.md5(
            json.dumps(signature, sort_keys=True).encode()
        ).hexdigest()[:12]
        now = datetime.utcnow()
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 1. Upsert into pattern_catalog (increment count)
                await conn.execute("""
                    INSERT INTO pattern_catalog 
                        (pattern_id, pattern_type, domains_involved, 
                         metrics_involved, binned_signature, description,
                         first_seen, last_seen, occurrence_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
                    ON CONFLICT (pattern_id) DO UPDATE SET
                        last_seen = EXCLUDED.last_seen,
                        occurrence_count = pattern_catalog.occurrence_count + 1,
                        avg_recurrence_interval_hours = (
                            pattern_catalog.avg_recurrence_interval_hours * 
                            pattern_catalog.occurrence_count + 
                            EXTRACT(EPOCH FROM (EXCLUDED.last_seen - 
                            pattern_catalog.last_seen)) / 3600
                        ) / (pattern_catalog.occurrence_count + 1)
                """, pattern_id, state.get('pattern_type', 'unknown'),
                    state.get('domains', []), state.get('metrics', []),
                    json.dumps(signature), state.get('description', ''),
                    now, now)
                
                # 2. Append to pattern_events (timeline log)
                await conn.execute("""
                    INSERT INTO pattern_events 
                        (time, pattern_id, activity_score, domains_active, raw_snapshot)
                    VALUES ($1, $2, $3, $4, $5)
                """, now, pattern_id, state.get('activity_score', 0),
                    state.get('domains', []), json.dumps(state))
```

### Table: narratives

```sql
CREATE TABLE narratives (
    time              TIMESTAMPTZ NOT NULL,
    narrative_id      TEXT NOT NULL,
    narrative_type    TEXT NOT NULL,  -- 'observation', 'alert', 'insight', 'lament'
    severity          TEXT NOT NULL,
    title             TEXT NOT NULL,
    body              TEXT NOT NULL,
    domains_mentioned TEXT[],
    data_references   JSONB,          -- specific data points cited
    PRIMARY KEY (time, narrative_id)
);

SELECT create_hypertable('narratives', 'time');
```

---

## Pattern Memory

Tethys remembers what it has seen before. When a pattern recurs, it can say "I have observed this 12 times in the past year."

```python
class PatternMemory:
    """Remember and recognize recurring patterns."""
    
    # Bin thresholds for pattern hashing (CRITICAL)
    # Raw floats produce different hashes for similar patterns.
    # Binning maps continuous values to discrete categories.
    # Source: Gemini review — "float hashing sensitivity"
    BIN_CONFIG = {
        'z_score': {
            'bins': [(-float('inf'), -5, 'z_lt_neg5'), (-5, -4, 'z_neg5_to_neg4'),
                     (-4, -3, 'z_neg4_to_neg3'), (-3, -2, 'z_neg3_to_neg2'),
                     (-2, 2, 'z_normal'), (2, 3, 'z_2_to_3'),
                     (3, 4, 'z_3_to_4'), (4, 5, 'z_4_to_5'),
                     (5, float('inf'), 'z_gt_5')]
        },
        'magnitude': {
            'bins': [(0, 3, 'mag_0_to_3'), (3, 4, 'mag_3_to_4'),
                     (4, 5, 'mag_4_to_5'), (5, 6, 'mag_5_to_6'),
                     (6, 7, 'mag_6_to_7'), (7, float('inf'), 'mag_gt_7')]
        },
        'speed': {
            'bins': [(0, 300, 'speed_lt_300'), (300, 500, 'speed_300_to_500'),
                     (500, 800, 'speed_500_to_800'), (800, float('inf'), 'speed_gt_800')]
        },
        'bz_gsm': {
            'bins': [(-float('inf'), -10, 'bz_lt_neg10'), (-10, -5, 'bz_neg10_to_neg5'),
                     (-5, 0, 'bz_neg5_to_0'), (0, 5, 'bz_0_to_5'),
                     (5, float('inf'), 'bz_gt_5')]
        }
    }
    
    def _bin_value(self, metric: str, value: float) -> str:
        """Convert raw float to categorical bin label."""
        config = self.BIN_CONFIG.get(metric)
        if not config:
            return f"{metric}_{round(value, 0):.0f}"
        
        for low, high, label in config['bins']:
            if low <= value < high:
                return label
        return f"{metric}_unknown"
    
    def _compute_signature(self, state: dict) -> dict:
        """Compute pattern signature with binned values.
        Raw floats are converted to categories so similar patterns
        produce the same hash."""
        signature = {
            'domains': sorted(state.get('domains', [])),
            'anomaly_count': len(state.get('anomalies', [])),
        }
        
        # Bin numeric values
        for anomaly in state.get('anomalies', []):
            metric = anomaly.get('metric', 'unknown')
            value = anomaly.get('value', 0)
            z_score = anomaly.get('z_score', 0)
            
            signature[f"{metric}_bin"] = self._bin_value(metric, value)
            signature[f"{metric}_z_bin"] = self._bin_value('z_score', z_score)
        
        return signature
    
    async def check_pattern(self, pool, current_state):
        """Check if current state matches a known pattern."""
        
        # Extract pattern signature (binned, not raw)
        signature = self._compute_signature(current_state)
        
        # Search for similar patterns in history
        query = """
            SELECT pattern_id, description, occurrence_count, avg_recurrence_interval_hours
            FROM pattern_memory
            WHERE domains_involved @> $1
              AND pattern_type = $2
            ORDER BY last_seen DESC
            LIMIT 5
        """
        async with pool.acquire() as conn:
            matches = await conn.fetch(query, 
                current_state['domains'], 
                current_state['pattern_type']
            )
        
        if matches:
            best_match = matches[0]
            return {
                'is_recurrence': True,
                'pattern_id': best_match['pattern_id'],
                'times_seen': best_match['occurrence_count'],
                'avg_recurrence_interval': best_match['avg_recurrence_interval_hours'],
                'description': best_match['description']
            }
        
        return {'is_recurrence': False}
    
    async def record_pattern(self, pool, state):
        """Record a new pattern occurrence."""
        signature = self._compute_signature(state)
        
        # Hash the BINNED signature (not raw floats)
        pattern_id = hashlib.md5(
            json.dumps(signature, sort_keys=True).encode()
        ).hexdigest()[:12]
        
        query = """
            INSERT INTO pattern_memory (time, pattern_id, pattern_type,
                domains_involved, metrics_involved, description,
                first_seen, last_seen, occurrence_count, raw_snapshot)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (time, pattern_id) DO UPDATE SET
                last_seen = EXCLUDED.last_seen,
                occurrence_count = pattern_memory.occurrence_count + 1
        """
        # ... execute
```

---

## Narrative Generator

Tethys speaks in natural language. Not raw data — insights.

### Template System

```python
class NarrativeGenerator:
    """Generate natural language descriptions of planetary state."""
    
    TEMPLATES = {
        'anomaly_observation': [
            "I am detecting {anomaly_count} anomalies in the {domain} domain. "
            "{metric} has reached {value}, which is {z_score:.1f} standard deviations "
            "from the norm. {context}",
            
            "A {severity} anomaly in {domain} data: {metric} = {value} "
            "(z-score: {z_score:.1f}). This places it in the top {percentile:.0f}% "
            "of observed values over the past {window} days."
        ],
        
        'correlation_insight': [
            "I have identified a correlation between {domain_a} ({metric_a}) "
            "and {domain_b} ({metric_b}). Over the past {window} hours, "
            "the Pearson coefficient is {r:.3f} (p={p:.4f}). "
            "{interpretation}",
            
            "Cross-domain signal detected: {domain_a} {metric_a} and "
            "{domain_b} {metric_b} show a {strength} {direction} correlation "
            "(r={r:.3f}). This pattern has occurred {times_seen} times before."
        ],
        
        'cascade_warning': [
            "⚠️ Multiple domains are showing simultaneous anomalies: "
            "{domains_list}. In {times_seen} previous occurrences, "
            "this pattern lasted an average of {avg_hours:.1f} hours. "
            "Current threat level: {activity_level}.",
            
            "I am monitoring a developing situation across {domain_count} "
            "planetary systems. {anomaly_summary}. "
            "Historical analysis shows this configuration has occurred "
            "{times_seen} times with an average duration of {avg_hours:.1f} hours."
        ],
        
        'nominal': [
            "All planetary systems are operating within normal parameters. "
            "No significant anomalies detected across {domain_count} monitored domains. "
            "Solar wind speed: {sw_speed} km/s. Seismic activity: nominal.",
            
            "The planet is quiet. {domain_count} domains monitored, "
            "{anomaly_count} anomalies in the past 24 hours (all within normal range). "
            "Current threat level: NOMINAL."
        ]
    }
    
    async def generate(self, pool, assessment, anomalies, correlations):
        """Generate a narrative based on current state."""
        
        if assessment['activity_level'] == 'nominal':
            template = random.choice(self.TEMPLATES['nominal'])
            return template.format(
                domain_count=6,
                anomaly_count=assessment['active_anomalies'],
                sw_speed=await self._get_latest_sw_speed(pool)
            )
        
        parts = []
        
        # Anomaly observations
        for domain, count in anomalies.items():
            if count > 0:
                top_anomaly = await self._get_top_anomaly(pool, domain)
                template = random.choice(self.TEMPLATES['anomaly_observation'])
                parts.append(template.format(**top_anomaly))
        
        # Correlation insights
        for corr in correlations:
            if corr['is_significant']:
                template = random.choice(self.TEMPLATES['correlation_insight'])
                parts.append(template.format(**corr))
        
        # Cascade warning if multiple domains affected
        if len([d for d, c in anomalies.items() if c > 0]) >= 2:
            template = random.choice(self.TEMPLATES['cascade_warning'])
            parts.append(template.format(
                domains_list=', '.join(d for d, c in anomalies.items() if c > 0),
                domain_count=len([d for d, c in anomalies.items() if c > 0]),
                anomaly_summary='. '.join(parts[:2]),
                times_seen=await self._get_cascade_count(pool),
                avg_hours=await self._get_cascade_duration(pool),
                activity_level=assessment['activity_level'].upper()
            ))
        
        return ' '.join(parts)
```

---

## Lament Detector

The core concept from Wuthering Waves — watching for cascading failures across planetary systems.

```python
class LamentDetector:
    """
    Detect when multiple planetary systems show simultaneous anomalies.
    Not predicting catastrophe — detecting when the data converges.
    """
    
    # Minimum domains with active anomalies to trigger cascade detection
    CASCADE_THRESHOLD = 2
    
    # Global trigger domains — at least ONE must be active
    # for a cascade to be valid. Two local random events (rain + earthquake)
    # are NOT a Lament pattern. A solar event correlating with seismic IS.
    GLOBAL_TRIGGERS = {'solar_wind', 'goes'}
    
    # Minimum threat score to trigger lament warning
    LAMENT_THRESHOLD = 0.6
    
    async def detect(self, pool, assessment, anomalies):
        """Check for cascading anomalies (the 'Lament' pattern).
        
        Valid cascade: global trigger (solar/goes) + local event (seismic/atmospheric)
        Invalid cascade: two local random events (rain + earthquake = noise)
        """
        
        active_domains = [d for d, c in anomalies.items() if c > 0]
        
        # Must have minimum domains active
        if len(active_domains) < self.CASCADE_THRESHOLD:
            return None
        
        # Must have at least one global trigger (solar_wind or goes)
        has_global_trigger = bool(set(active_domains) & self.GLOBAL_TRIGGERS)
        if not has_global_trigger:
            return None  # Two local events = noise, not signal
        
        if assessment['activity_score'] < self.LAMENT_THRESHOLD:
            return None
        
        # Check historical cascade patterns
        pattern = await self._check_history(pool, active_domains)
        
        return {
            'type': 'cascade',
            'domains': active_domains,
            'activity_score': assessment['activity_score'],
            'activity_level': assessment['activity_level'],
            'historical_matches': pattern['times_seen'],
            'avg_recurrence_interval_hours': pattern['avg_recurrence_interval'],
            'narrative': self._generate_lament_narrative(
                active_domains, assessment, pattern
            )
        }
    
    def _generate_lament_narrative(self, domains, assessment, pattern):
        """Generate the Lament narrative."""
        domain_list = ', '.join(domains)
        
        return (
            f"🌊 LAMENT PATTERN DETECTED\n\n"
            f"Multiple planetary systems are showing correlated anomalies: "
            f"{domain_list}.\n\n"
            f"Activity Score: {assessment['activity_score']:.2f} / 1.00\n"
            f"Activity Level: {assessment['activity_level'].upper()}\n\n"
            f"Historical Analysis:\n"
            f"- This pattern has been observed {pattern['times_seen']} times "
            f"in the past year\n"
            f"- Average duration: {pattern['avg_duration']:.1f} hours\n"
            f"- Previous outcomes: {pattern['outcome_summary']}\n\n"
            f"Tethys is monitoring the situation. "
            f"All data streams are being tracked at maximum resolution."
        )
```

---

## Sound Design (Optional)

```typescript
// Ambient cosmic sound
const AMBIENT_URL = '/audio/cosmic-ambient.mp3';

// Alert sounds by severity
const ALERT_SOUNDS = {
  low: '/audio/chime-soft.mp3',
  medium: '/audio/chime-medium.mp3',
  high: '/audio/alert-high.mp3',
  critical: '/audio/alert-critical.mp3',
};

// Sound manager
class SoundManager {
  private ambient: HTMLAudioElement;
  private enabled: boolean = false;
  
  enable() {
    this.enabled = true;
    this.ambient = new Audio(AMBIENT_URL);
    this.ambient.loop = true;
    this.ambient.volume = 0.1;
    this.ambient.play();
  }
  
  playAlert(severity: string) {
    if (!this.enabled) return;
    const audio = new Audio(ALERT_SOUNDS[severity]);
    audio.volume = 0.3;
    audio.play();
  }
}
```

## Event Replay System (High Research Value)

Instead of (or alongside) narrative AI, replay historical events on the globe.
This has MORE scientific value than AI-generated narratives.

```typescript
// Historical events to replay on the globe
const HISTORICAL_EVENTS = [
  {
    id: 'carrington-1859',
    name: 'Carrington Event',
    date: '1859-09-01',
    description: 'Largest recorded solar storm. Telegraph systems worldwide failed.',
    type: 'solar_storm',
    // No real-time data available — use simulated/approximated data
    data: 'simulated'
  },
  {
    id: 'tohoku-2011',
    name: 'Tōhoku Earthquake & Tsunami',
    date: '2011-03-11',
    start: '2011-03-11T05:46:24Z',
    end: '2011-03-18T00:00:00Z',
    description: 'M9.1 earthquake, massive tsunami, Fukushima disaster.',
    type: 'earthquake',
    data: 'real'  // USGS + NOAA historical data available
  },
  {
    id: 'tonga-2022',
    name: 'Hunga Tonga Eruption',
    date: '2022-01-15',
    start: '2022-01-13T00:00:00Z',
    end: '2022-01-20T00:00:00Z',
    description: 'Volcanic eruption that generated atmospheric shockwave worldwide.',
    type: 'volcanic',
    data: 'real'
  },
  {
    id: 'turkey-2023',
    name: 'Turkey-Syria Earthquake',
    date: '2023-02-06',
    start: '2023-02-06T01:00:00Z',
    end: '2023-02-13T00:00:00Z',
    description: 'M7.8 earthquake, catastrophic damage.',
    type: 'earthquake',
    data: 'real'
  }
];

// Replay component
function EventReplay({ eventId }) {
  const event = HISTORICAL_EVENTS.find(e => e.id === eventId);
  
  // Load historical data for the event time range
  useEffect(() => {
    if (event.data === 'real') {
      // Fetch from USGS/NOAA historical archives
      loadHistoricalData(event.start, event.end);
    } else {
      // Use simulated data based on historical descriptions
      loadSimulatedData(event);
    }
  }, [eventId]);
  
  // Use time scrubber to replay the event
  // Globe shows data flowing in real-time (accelerated)
  return (
    <div>
      <h3>{event.name}</h3>
      <p>{event.description}</p>
      <TimeScrubber 
        min={new Date(event.start).getTime()}
        max={new Date(event.end).getTime()}
        speed={100}  // 100x speed by default
      />
    </div>
  );
}
```

Research value: Users can SEE how planetary systems responded to major events.
This is more valuable than AI-generated narratives for scientific understanding.

## Scientific Disclaimer in UI (REQUIRED)

The disclaimer from PROJECT.md MUST appear in the dashboard UI, not just
developer documentation. Users who open the dashboard need to see it.

### Placement

```tsx
// components/Disclaimer/ScientificDisclaimer.tsx
// Show on first visit, dismissible, stored in localStorage

export function ScientificDisclaimer() {
  // sessionStorage instead of localStorage:
  // Safety disclaimer should appear once per session, not once forever.
  // If user opens in incognito, different browser, or clears cache,
  // disclaimer still appears. More responsible for safety information.
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('tethys_disclaimer_dismissed') === 'true'
  );
  
  if (dismissed) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="max-w-lg bg-gray-900 rounded-lg p-6 border border-yellow-500/50">
        <h2 className="text-yellow-400 text-lg font-bold mb-3">
          ⚠️ Research Tool — Not a Warning System
        </h2>
        <p className="text-gray-300 text-sm mb-4">
          Tethys observes <strong>correlations</strong> in planetary data.
          It does <strong>NOT</strong> predict earthquakes, solar storms,
          or any natural disasters.
        </p>
        <ul className="text-gray-400 text-xs mb-4 space-y-1">
          <li>• Correlation ≠ Causation</li>
          <li>• Anomalies are statistical outliers, not warnings</li>
          <li>• The "Lament Detector" is a narrative framework</li>
          <li>• Solar-seismic correlation is scientifically controversial</li>
        </ul>
        <p className="text-gray-500 text-xs mb-4">
          Do not use Tethys data to make safety decisions.
        </p>
        <button
          onClick={() => {
            sessionStorage.setItem('tethys_disclaimer_dismissed', 'true');
            setDismissed(true);
          }}
          className="w-full py-2 bg-gray-700 rounded text-gray-300 text-sm"
        >
          I understand — Continue to Dashboard
        </button>
      </div>
    </div>
  );
}

// In App.tsx:
function App() {
  return (
    <>
      <ScientificDisclaimer />
      {/* rest of app */}
    </>
  );
}
```

### Lament Detector Banner

```tsx
// components/Lament/LamentBanner.tsx
// Show disclaimer whenever Lament Detector is active

export function LamentBanner({ lamentData }) {
  if (!lamentData) return null;
  
  return (
    <div className="bg-yellow-900/30 border border-yellow-500/30 rounded p-3 mb-4">
      <p className="text-yellow-400 text-xs">
        ⚠️ This pattern indicates <strong>statistical correlation</strong>,
        not causal relationship. This is a research observation, not a
        disaster prediction. See{' '}
        <a href="/disclaimer" className="underline">full disclaimer</a>.
      </p>
    </div>
  );
}
```

---

## Phase 4 Deliverables

1. ✅ Pattern memory — Tethys recognizes recurring patterns
2. ✅ Narrative generator — natural language insights
3. ✅ Lament detector — cascading anomaly detection
4. ✅ Sound design — ambient + alert audio
5. ✅ Tethys Speaks feed on dashboard

## Phase 4 Success Criteria

- [ ] Tethys generates meaningful narratives (not just raw data)
- [ ] Pattern memory stores and recalls recurring patterns
- [ ] Lament detector triggers on multi-domain cascades
- [ ] Narratives reference specific data points
- [ ] Sound design enhances immersion (optional toggle)
