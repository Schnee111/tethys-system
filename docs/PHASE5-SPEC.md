# TETHYS — Phase 5 Technical Specification: Polish & Scale

## Overview

Phase 5 takes Tethys from working prototype to production-ready system. Performance optimization, security hardening, data lifecycle management, monitoring, documentation, and open-source preparation.

**Duration:** 2 weeks
**Prerequisite:** Phase 1-4 complete and functional
**Goal:** Production-quality system, documented, deployable, open-source ready

---

## 1. Data Lifecycle Management

### Retention Policy

```sql
-- TimescaleDB automatic data retention
-- 
-- CRITICAL: Retention must be LONGER than continuous aggregate refresh window.
-- If retention drops raw data before aggregation runs, aggregated data will
-- have permanent gaps. The refresh job will see deleted raw data and delete
-- the aggregate data too.
--
-- Source: tigerdata.com/docs/learn/data-lifecycle/data-retention/
--   data-retention-with-continuous-aggregates
--
-- Rule: retention_after = aggregate_refresh_offset + buffer
-- Our aggregates refresh with end_offset = INTERVAL '1 hour'
-- So retention must be well beyond the aggregate's lookback window.
--
-- SAFE CONFIGURATION:
-- Aggregate refresh: covers last 3 days to 1 hour ago
-- Retention: drop raw data after 6 months + 7 days (buffer)

-- goes_flux: 1-minute data → aggregate to hourly, keep raw 6 months + 7 days
SELECT add_retention_policy('goes_flux', INTERVAL '6 months 7 days');

-- solar_wind: 5-minute data → aggregate to hourly, keep raw 6 months + 7 days
SELECT add_retention_policy('solar_wind', INTERVAL '6 months 7 days');

-- seismic_events: keep all (low volume, high value)
-- No retention policy — event data is sparse and valuable

-- atmospheric_data: hourly data → aggregate to daily, keep raw 1 year + 7 days
SELECT add_retention_policy('atmospheric_data', INTERVAL '1 year 7 days');

-- space_weather_events: keep all (event-driven, low volume)
-- volcanic_events: keep all (event-driven, low volume)

-- anomalies: keep 1 year (analysis results)
SELECT add_retention_policy('anomalies', INTERVAL '1 year');

-- correlations: keep 2 years (research value)
SELECT add_retention_policy('correlations', INTERVAL '2 years');

-- narratives: keep 1 year
SELECT add_retention_policy('narratives', INTERVAL '1 year');
```

### Compression Policy

```sql
-- TimescaleDB columnar compression (90%+ reduction)
-- Compress data older than 7 days

ALTER TABLE goes_flux SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'flux_type, energy_band',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('goes_flux', INTERVAL '7 days');

ALTER TABLE solar_wind SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'source',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('solar_wind', INTERVAL '7 days');

ALTER TABLE atmospheric_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'location_name',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('atmospheric_data', INTERVAL '7 days');

ALTER TABLE anomalies SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'domain, severity',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('anomalies', INTERVAL '7 days');
```

### Downsampling (Continuous Aggregates)

```sql
-- Create hourly aggregates for high-frequency data
-- After 6 months, raw data is dropped but hourly aggregates remain

CREATE MATERIALIZED VIEW goes_flux_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    flux_type,
    energy_band,
    satellite,
    AVG(flux) AS avg_flux,
    MAX(flux) AS max_flux,
    MIN(flux) AS min_flux,
    COUNT(*) AS sample_count
FROM goes_flux
GROUP BY hour, flux_type, energy_band, satellite;

CREATE MATERIALIZED VIEW solar_wind_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    source,
    AVG(density) AS avg_density,
    AVG(speed) AS avg_speed,
    AVG(temperature) AS avg_temperature,
    AVG(bt) AS avg_bt,
    AVG(bz_gsm) AS avg_bz_gsm,
    MAX(speed) AS max_speed,
    COUNT(*) AS sample_count
FROM solar_wind
GROUP BY hour, source;

CREATE MATERIALIZED VIEW atmospheric_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    location_name,
    category,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    MIN(temperature) AS min_temp,
    AVG(wind_speed) AS avg_wind,
    SUM(precipitation) AS total_precip
FROM atmospheric_data
GROUP BY day, location_name, category;

-- Refresh policies (keep aggregates up to date)
SELECT add_continuous_aggregate_policy('goes_flux_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('solar_wind_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('atmospheric_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
```

### Storage Monitoring

```python
# Monitor storage usage weekly
async def check_storage(pool):
    query = """
        SELECT 
            hypertable_name,
            pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass)) as size,
            pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass, true)) as compressed_size
        FROM timescaledb_information.hypertables
        ORDER BY hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass) DESC;
    """
    # Alert if total storage exceeds 50GB
```

---

## 2. Security Hardening

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/tethys

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

server {
    listen 80;
    server_name api.tethys.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.tethys.yourdomain.com;

    # SSL (Let's Encrypt via Certbot)
    ssl_certificate /etc/letsencrypt/live/api.tethys.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tethys.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # API endpoints
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/api/status;
    }
}
```

### SSL Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (requires domain pointing to VPS)
sudo certbot --nginx -d api.tethys.yourdomain.com

# Auto-renewal (certbot sets this up automatically)
sudo certbot renew --dry-run
```

### Alternative: Cloudflare Tunnel (No Domain Required)

```bash
# If you don't have a domain, use Cloudflare Tunnel
# This gives you HTTPS without buying a domain

# Install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Create tunnel (free Cloudflare account required)
cloudflared tunnel create tethys
cloudflared tunnel route dns tethys api.tethys.dev

# Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: api.tethys.dev
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run tethys
```

### Uvicorn Binding

```bash
# Bind to localhost only (Nginx handles external traffic)
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```

---

## 3. Monitoring & Alerting

### Health Check Endpoint

```python
# /api/status enhanced
@app.get("/api/status")
async def get_status():
    return {
        "status": "operational",
        "uptime_seconds": time.time() - START_TIME,
        "version": TETHYS_VERSION,
        "collectors": {
            name: {
                "status": c.last_status,
                "last_poll": c.last_poll_time,
                "records_stored": c.total_records,
                "errors_24h": c.errors_24h,
                "avg_latency_ms": c.avg_latency
            }
            for name, c in collectors.items()
        },
        "database": {
            "total_records": await get_total_records(),
            "storage_mb": await get_storage_size(),
            "compression_ratio": await get_compression_ratio(),
            "oldest_record": await get_oldest_record()
        },
        "analysis": {
            "anomalies_24h": await get_anomaly_count(24),
            "correlations_active": await get_correlation_count(),
            "activity_level": await get_current_activity_level()
        }
    }
```

### Systemd Hardening

```ini
# /etc/systemd/system/tethys.service
[Unit]
Description=Tethys Planetary Intelligence System
After=postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=tethys
Group=tethys
WorkingDirectory=/opt/tethys/backend
ExecStart=/opt/tethys/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
Environment=DATABASE_URL=postgresql://tethys:***@localhost:5432/tethys
Environment=TETHYS_ENV=production

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/tethys/data
PrivateTmp=yes

# Resource limits
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

### Log Rotation

```bash
# /etc/logrotate.d/tethys
/opt/tethys/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 tethys tethys
}
```

---

## 4. Documentation

### README.md Structure

```markdown
# TETHYS — Planetary Intelligence System

## What Is This?
[One paragraph description]

## Quick Start
[5-minute setup guide]

## Architecture
[Diagram + explanation]

## Data Sources
[Table of all APIs used]

## API Documentation
[Endpoint reference]

## Deployment
[Step-by-step VPS setup]

## Contributing
[Open-source guidelines]

## License
[MIT or GPL-3.0]
```

### API Documentation

```
Auto-generated from FastAPI:
- OpenAPI spec at /docs (Swagger UI)
- ReDoc at /redoc
- Export to markdown for README
```

---

## 5. Testing

### Backend Tests

```python
# tests/test_collectors.py
async def test_seismic_collector_fetches_data():
    collector = SeismicCollector()
    records = await collector.collect()
    assert len(records) > 0
    assert 'magnitude' in records[0]
    assert 'latitude' in records[0]

async def test_solar_wind_upsert_merges_data():
    # Insert plasma data
    await store_plasma(timestamp, density=5.0, speed=400.0)
    # Insert mag data for same timestamp
    await store_mag(timestamp, bt=4.0, bz=-2.0)
    # Verify both are present
    record = await get_solar_wind(timestamp)
    assert record.density == 5.0
    assert record.bt == 4.0

async def test_anomaly_detector_finds_spike():
    # Insert anomalous data
    for i in range(100):
        await insert_seismic_event(magnitude=random.uniform(2, 4))
    await insert_seismic_event(magnitude=7.0)  # Anomaly
    
    anomalies = await detector.detect(pool, 'seismic_events', 'magnitude', 'seismic')
    assert any(a['z_score'] > 3.0 for a in anomalies)
```

### Frontend Tests

```tsx
// Globe renders without error
test('EarthGlobe renders', () => {
  render(<EarthGlobe />);
  expect(screen.getByRole('img')).toBeInTheDocument();
});

// WebSocket connects and receives data
test('useWebSocket receives events', async () => {
  const { result } = renderHook(() => useWebSocket());
  // ... mock WebSocket server
  await waitFor(() => {
    expect(result.current.events).toHaveLength(1);
  });
});

// WebGL detection returns boolean
test('isWebGLSupported returns boolean', () => {
  const result = isWebGLSupported();
  expect(typeof result).toBe('boolean');
});

// Fallback map renders when WebGL fails
test('FallbackMap2D renders without WebGL', () => {
  // Mock WebGL as unavailable
  jest.spyOn(global, 'WebGLRenderingContext').mockReturnValue(undefined);
  render(<App />);
  // Use data-testid for robust assertion (not fragile text match)
  expect(screen.getByTestId('fallback-map')).toBeInTheDocument();
});

// Time scrubber buffers events when not LIVE
test('time scrubber buffers WebSocket events in historical mode', () => {
  const { result } = renderHook(() => useTimeScrubber());
  
  // Switch to historical mode
  act(() => result.current.handleScrub(Date.now() - 86400000));
  expect(result.current.isLive).toBe(false);
  
  // Send WebSocket event — should be buffered, not displayed
  act(() => result.current.handleWSEvent({ type: 'seismic', data: {} }));
  expect(result.current.bufferedEvents).toHaveLength(1);
  expect(result.current.displayEvents).toHaveLength(0);
  
  // Switch back to LIVE — buffer should flush
  act(() => result.current.handleLive());
  expect(result.current.isLive).toBe(true);
  expect(result.current.bufferedEvents).toHaveLength(0);
});

// Buffer cap prevents RAM bomb
test('buffer caps at MAX_BUFFER_SIZE', () => {
  const { result } = renderHook(() => useTimeScrubber());
  act(() => result.current.handleScrub(Date.now() - 86400000));
  
  // Send 5001 events
  for (let i = 0; i < 5001; i++) {
    act(() => result.current.handleWSEvent({ type: 'seismic', data: { i } }));
  }
  
  // Buffer should be capped at 5000, oldest discarded
  expect(result.current.bufferedEvents.length).toBeLessThanOrEqual(5000);
});
```

### Backend Tests

```python
# tests/test_correlation.py

# FDR correction runs on Python backend, not frontend.
# Source: statsmodels.stats.multitest.multipletests
from statsmodels.stats.multitest import multipletests

async def test_fdr_correction_reduces_false_positives():
    """21 tests with raw p=0.04 should NOT be significant after BH correction."""
    # Simulate 21 correlation results all with raw p=0.04
    raw_pvals = [0.04] * 21
    
    # Apply Benjamini-Hochberg FDR correction
    reject, pvals_corrected, _, _ = multipletests(
        raw_pvals, alpha=0.05, method='fdr_bh'
    )
    
    # After BH correction, none should be significant
    # (because we're testing 21 hypotheses simultaneously)
    assert not any(reject), f"FDR should reject all, but got {sum(reject)} accepted"

async def test_correlation_engine_applies_fdr(pool):
    """Verify CorrelationEngine.run_all() uses corrected p-values."""
    correlator = CorrelationEngine()
    results = await correlator.run_all(pool)
    
    for result in results:
        # Results should have corrected p-value, not just raw
        assert 'p_value_corrected' in result
        assert 'fdr_method' in result
        assert result['fdr_method'] == 'benjamini_hochberg'
        # is_significant should be based on corrected p-value
        assert result['is_significant'] == (result['p_value_corrected'] < 0.05)
```

---

## 6. Open-Source Preparation

### Repository Structure

```
tethys/
├── backend/           # Python backend
├── frontend/          # React frontend
├── docs/              # All specifications
├── scripts/           # Setup scripts
├── .github/
│   └── workflows/
│       ├── test.yml   # CI: run tests
│       └── deploy.yml # CD: deploy to VPS
├── docker-compose.yml # Local development
├── .env.example       # Environment template
├── LICENSE            # MIT or GPL-3.0
├── README.md
└── CONTRIBUTING.md
```

### Environment Configuration

```bash
# .env.example
DATABASE_URL=postgresql://tethys:password@localhost:5432/tethys
API_HOST=127.0.0.1
API_PORT=8000
TETHYS_ENV=development
LOG_LEVEL=INFO
```

---

## Phase 5 Deliverables

1. ✅ Data retention + compression policies active
2. ✅ Nginx reverse proxy + SSL configured
3. ✅ Systemd hardening applied
4. ✅ Monitoring + alerting operational
5. ✅ Documentation complete
6. ✅ Test suite passing
7. ✅ Open-source ready (LICENSE, README, CONTRIBUTING)

## Phase 5 Success Criteria

- [ ] Storage usage predictable and monitored
- [ ] HTTPS working for API endpoint
- [ ] System survives VPS reboot automatically
- [ ] All tests passing
- [ ] Documentation covers setup, API, deployment
- [ ] Code ready for public GitHub repository
