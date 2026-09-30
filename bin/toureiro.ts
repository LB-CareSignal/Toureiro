#!/usr/bin/env tsx

import minimist from 'minimist';
import config from '../lib/config';
import toureiro from '../lib/toureiro';

const argv = minimist(process.argv.slice(2));

if (argv.h || argv.help) {
  console.log('Usage: toureiro [port]');
  console.log('[port]         Port for toureiro to listen to');
  console.log('Options:');
  console.log('--rh           Redis host, default to 127.0.0.1');
  console.log('--rp           Redis port, default to 6379');
  console.log('--rdb          Redis database number, default to 0');
  console.log('--pass         Redis password, default to null');
  process.exit(0);
}

const runtimeConfig = config.fromArgs(argv, process.env);
const app = toureiro({
  development: runtimeConfig.development,
  redis: runtimeConfig.redis
});

app.listen(runtimeConfig.port, function() {
  console.log('Toureiro is now listening at port', runtimeConfig.port, '...');
});