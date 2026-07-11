-- Tsunami Warnings Table
CREATE TABLE IF NOT EXISTS tsunami_warnings (
    id SERIAL PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    alert_level TEXT NOT NULL,
    headline TEXT,
    description TEXT,
    instruction TEXT,
    area_desc TEXT,
    effective TIMESTAMP WITH TIME ZONE,
    expires TIMESTAMP WITH TIME ZONE,
    sender_name TEXT,
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsunami_alert_level ON tsunami_warnings(alert_level);
CREATE INDEX IF NOT EXISTS idx_tsunami_effective ON tsunami_warnings(effective);
CREATE INDEX IF NOT EXISTS idx_tsunami_expires ON tsunami_warnings(expires);
