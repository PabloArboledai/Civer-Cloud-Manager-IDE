import { bootstrapNestServer } from './src/server/main';

async function run() {
  console.log('Starting NestJS server standalone...');
  await bootstrapNestServer({
    enabled: true,
    port: 8045,
    api_key: 'agm-key-local',
    auto_start: true,
    backend_canary_enabled: false,
    parity_enabled: false,
    parity_shadow_enabled: false,
    parity_kill_switch: false,
    upstream_proxy: { enabled: false, url: '' }
  } as any);
}

run();
