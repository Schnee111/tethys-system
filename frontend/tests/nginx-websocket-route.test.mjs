import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const configUrl = new URL('../../docs/nginx-websocket-location.conf', import.meta.url);

test('production Nginx WebSocket route upgrades before the SPA fallback', () => {
  assert.ok(existsSync(configUrl), 'checked-in production WebSocket location snippet must exist');
  const config = readFileSync(configUrl, 'utf8');

  assert.match(config, /location \/ws\/ \{/);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:8000;/);
  assert.match(config, /proxy_http_version 1\.1;/);
  assert.match(config, /proxy_set_header Upgrade \$http_upgrade;/);
  assert.match(config, /proxy_set_header Connection "upgrade";/);
  assert.match(config, /proxy_set_header Host \$host;/);
  assert.match(config, /proxy_set_header X-Real-IP \$remote_addr;/);
  assert.match(config, /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
  assert.match(config, /proxy_set_header X-Forwarded-Proto \$scheme;/);
  assert.match(config, /proxy_read_timeout 86400s;/);
  assert.match(config, /proxy_send_timeout 86400s;/);
  assert.doesNotMatch(config, /try_files|index\.html/, 'snippet must not fall through to the SPA');
});
