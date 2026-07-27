# TETHYS — Infrastructure & Deployment Specification

## Overview

This document covers the complete infrastructure topology for Tethys — from VPS setup to production deployment. It addresses the security and deployment concerns raised during planning.

---

## Deployment Topology

### Development (Phase 1-2)

```
[Your Laptop] ──(localhost:8000)──> [FastAPI on WSL/VPS]
                                          │
                                    [TimescaleDB]
```

- No SSL needed (localhost)
- No Nginx needed (direct access)
- CORS not relevant (same origin)

### Staging (Phase 3)

```
[Browser] ──(https)──> [Cloudflare Pages]     (Frontend)
                              │
                    (https API calls)
                              │
                              ▼
[Browser] ──(https)──> [Cloudflare Tunnel] ──(http:8000)──> [FastAPI on VPS]
                                                               │
                                                         [TimescaleDB]
```

- Cloudflare Tunnel provides HTTPS without buying a domain
- Free tier: unlimited bandwidth
- No Nginx needed during staging

### Production (Phase 5)

```
[Browser] ──(https:443)──> [Nginx] ──(http:8000)──> [FastAPI]
                               │                          │
                         [Certbot SSL]             [TimescaleDB]
                               │
                         [Rate Limiting]
                         [Security Headers]
```

- Nginx handles SSL termination, rate limiting, security headers
- FastAPI bound to 127.0.0.1:8000 (not exposed to internet)
- Certbot provides free SSL via Let's Encrypt

---

## VPS Setup Checklist

### Initial Server Setup

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Create tethys user
sudo useradd -m -s /bin/bash tethys
sudo usermod -aG sudo tethys

# 3. Install dependencies
sudo apt install -y python3.12 python3.12-venv postgresql postgresql-contrib \
    nginx certbot python3-certbot-nginx git curl

# 4. Add TimescaleDB repository
sudo add-apt-repository ppa:timescale/timescaledb-ppa
sudo apt update
sudo apt install -y timescaledb-2-postgresql-16

# 5. Tune PostgreSQL for your VPS resources (CRITICAL)
# Without this, PostgreSQL uses default shared_buffers (128MB)
# which causes disk thrashing instead of using your 4GB RAM.
# Source: github.com/timescale/timescaledb-tune
# Auto-adjusts: shared_buffers, effective_cache_size, work_mem,
# WAL settings, max_connections, background workers
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql

# 6. Configure PostgreSQL
sudo -u postgres psql
```

### Database Setup

```sql
-- Create user and database
CREATE USER tethys WITH PASSWORD 'strong_password_here';
CREATE DATABASE tethys OWNER tethys;

-- Connect to tethys database
\c tethys

-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE tethys TO tethys;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tethys;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tethys;
```

### Application Setup

```bash
# Switch to tethys user
sudo su - tethys

# Clone repository
git clone https://github.com/yourusername/tethys.git /opt/tethys
cd /opt/tethys/backend

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://tethys:strong_password_here@localhost:5432/tethys
API_HOST=127.0.0.1
API_PORT=8000
TETHYS_ENV=production
LOG_LEVEL=INFO
EOF

# Run database migrations
python migrations.py

# Exit tethys user
exit
```

### Systemd Service

```bash
# Create service file
sudo tee /etc/systemd/system/tethys.service << EOF
[Unit]
Description=Tethys Planetary Intelligence System
After=postgresql.service
Wants=postgresql.service
# Prevent systemd thrashing: if crash 5 times in 60 seconds, stop trying.
# Without this, a database outage causes infinite restart loop + log spam.
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=tethys
Group=tethys
WorkingDirectory=/opt/tethys/backend
ExecStart=/opt/tethys/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
EnvironmentFile=/opt/tethys/backend/.env

# Security
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/tethys/data

# Resources
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable tethys
sudo systemctl start tethys

# Check status
sudo systemctl status tethys
```

### Collector Service (Separate from API)

```ini
# /etc/systemd/system/tethys-collector.service
# CRITICAL: Collectors MUST run in a separate service from the API.
# Uvicorn --workers 2 forks the process, creating duplicate collectors
# that double API calls and cause database deadlocks.
#
# Source: Gemini Review — "Bom Multi-Proses Uvicorn"

[Unit]
Description=Tethys Data Collectors
After=postgresql.service tethys.service
Wants=postgresql.service

[Service]
Type=simple
User=tethys
Group=tethys
WorkingDirectory=/opt/tethys/backend
ExecStart=/opt/tethys/backend/venv/bin/python run_collectors.py
Restart=always
RestartSec=30
EnvironmentFile=/opt/tethys/backend/.env

# Security
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/tethys/data

# Resources (collectors are I/O bound, not CPU bound)
MemoryMax=1G
CPUQuota=100%

[Install]
WantedBy=multi-user.target
```

```python
# run_collectors.py — Entry point for collector service
import asyncio
from db.connection import init_pool, close_pool
from config import DATABASE_URL
from collectors import (
    SeismicCollector, SolarWindCollector, GOESFluxCollector,
    DONKICollector, AtmosphericCollector, VolcanicCollector
)
from analysis import analysis_scheduler  # Phase 2

async def main():
    pool = await init_pool(DATABASE_URL)
    
    collectors = [
        SeismicCollector(pool),
        SolarWindCollector(pool),
        GOESFluxCollector(pool),
        DONKICollector(pool),
        AtmosphericCollector(pool),
        VolcanicCollector(pool),
    ]
    
    tasks = [c.run() for c in collectors]
    tasks.append(analysis_scheduler(pool))  # Phase 2
    
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
```

```bash
# Enable and start collector service
sudo systemctl daemon-reload
sudo systemctl enable tethys-collector
sudo systemctl start tethys-collector
sudo systemctl status tethys-collector
```

### Nginx Configuration (Phase 5)

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/tethys << 'EOF'
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

server {
    listen 80;
    server_name api.tethys.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.tethys.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.tethys.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tethys.yourdomain.com/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

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
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/tethys /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Setup (Phase 5)

```bash
# Get SSL certificate (requires domain pointing to VPS)
sudo certbot --nginx -d api.tethys.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## Alternative: Cloudflare Tunnel (No Domain Needed)

For development/staging without buying a domain:

```bash
# Install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Login to Cloudflare (free account)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create tethys

# Configure
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: <TUNNEL_ID>
credentials-file: /home/tethys/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: tethys-api.trycloudflare.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Firewall Configuration

```bash
# Allow only SSH, HTTP, HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verify
sudo ufw status verbose
```

---

## Backup Strategy

```bash
#!/bin/bash
# /opt/tethys/scripts/backup.sh

BACKUP_DIR="/opt/tethys/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump -U tethys tethys | gzip > "$BACKUP_DIR/tethys_$DATE.sql.gz"

# Keep last 30 backups
ls -t "$BACKUP_DIR"/tethys_*.sql.gz | tail -n +31 | xargs rm -f

echo "Backup completed: tethys_$DATE.sql.gz"
```

```bash
# Cron job: daily backup at 3 AM
echo "0 3 * * * /opt/tethys/scripts/backup.sh" | crontab -
```

### Monthly Restore Test Checklist

```bash
#!/bin/bash
# /opt/tethys/scripts/test_restore.sh
# Run monthly to verify backups are actually restorable.
# A backup you never test is an illusion of safety.

BACKUP_FILE=$(ls -t /opt/tethys/backups/tethys_*.sql.gz | head -1)
TEST_DB="tethys_restore_test"

echo "=== Tethys Restore Test ==="
echo "Backup: $BACKUP_FILE"
echo "Date: $(date)"

# 1. Create test database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $TEST_DB;"
sudo -u postgres psql -c "CREATE DATABASE $TEST_DB OWNER tethys;"

# 2. Restore backup
gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -d "$TEST_DB"

# 3. Verify record counts
echo "=== Record Counts ==="
for table in seismic_events solar_wind goes_flux space_weather_events atmospheric_data volcanic_events; do
    COUNT=$(sudo -u postgres psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM $table;")
    echo "$table: $COUNT records"
done

# 4. Verify latest data
echo "=== Latest Records ==="
sudo -u postgres psql -d "$TEST_DB" -c "SELECT MAX(time) FROM seismic_events;"
sudo -u postgres psql -d "$TEST_DB" -c "SELECT MAX(time) FROM solar_wind;"

# 5. Cleanup
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $TEST_DB;"

echo "=== Restore test complete ==="
```

```bash
# Cron job: monthly restore test on 1st at 4 AM
echo "0 4 1 * * /opt/tethys/scripts/test_restore.sh >> /opt/tethys/logs/restore_test.log 2>&1" | crontab -
```

---

## Resource Budget

```
COMPONENT           RAM        CPU        STORAGE
──────────────────  ─────────  ─────────  ──────────
PostgreSQL          512MB      10%        ~50MB/day
TimescaleDB ext     included   included   included
FastAPI (2 workers) 200MB      20%        minimal
Collectors (6)      200MB      10%        minimal
Nginx               50MB       5%         minimal
System overhead     200MB      10%        2GB
──────────────────  ─────────  ─────────  ──────────
TOTAL               ~1.2GB     ~55%       ~50MB/day
HEADROOM            ~2.8GB     ~45%       ~55GB

After compression (7+ days): ~5MB/day effective
After downsampling (6+ months): ~1MB/day effective
```

---

## Monitoring Commands

```bash
# Check Tethys status
sudo systemctl status tethys

# View logs
sudo journalctl -u tethys -f

# Check database size
sudo -u postgres psql -d tethys -c "
  SELECT hypertable_name, 
         pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass))
  FROM timescaledb_information.hypertables;
"

# Check API health
curl -s http://localhost:8000/api/status | python3 -m json.tool

# Check storage
df -h /

# Check memory
free -h

# Check Nginx status
sudo systemctl status nginx
```

---

## Decision Log

| Decision | Rationale | Phase |
|----------|-----------|-------|
| No Nginx in Phase 1-2 | Development only, localhost access | 1-2 |
| Cloudflare Tunnel for Phase 3 | HTTPS without domain purchase | 3 |
| Nginx + SSL in Phase 5 | Production hardening | 5 |
| Compression after 7 days | Balance query speed vs storage | 5 |
| Downsampling after 6 months | Long-term storage efficiency | 5 |
| 2 Uvicorn workers | VPS has 2 vCPUs typically | 1+ |
| MemoryMax=2G | Leave headroom for OS + PostgreSQL | 1+ |
