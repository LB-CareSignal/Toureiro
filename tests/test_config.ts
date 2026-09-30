import assert from 'node:assert/strict';
import config from '../lib/config';

describe('Config', function() {

  it('uses local defaults', function() {
    const result = config.fromEnv({});

    assert.equal(result.port, 3000);
    assert.equal(result.development, false);
    assert.deepEqual(result.redis, {
      host: '127.0.0.1',
      port: 6379,
      db: 0,
      auth_pass: null
    });
  });

  it('reads environment overrides', function() {
    const result = config.fromEnv({
      PORT: '4000',
      TOUREIRO_DEV_STATIC: 'true',
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6380',
      REDIS_DB: '3',
      REDIS_PASSWORD: 'secret'
    });

    assert.equal(result.port, 4000);
    assert.equal(result.development, true);
    assert.deepEqual(result.redis, {
      host: 'redis.local',
      port: 6380,
      db: 3,
      auth_pass: 'secret'
    });
  });

  it('lets CLI args override environment', function() {
    const result = config.fromArgs({
      _: ['4100'],
      rh: 'redis.cli',
      rp: '6381',
      rdb: '4',
      pass: 'cli-secret'
    }, {
      PORT: '4000',
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6380',
      REDIS_DB: '3',
      REDIS_PASSWORD: 'secret'
    });

    assert.equal(result.port, 4100);
    assert.deepEqual(result.redis, {
      host: 'redis.cli',
      port: 6381,
      db: 4,
      auth_pass: 'cli-secret'
    });
  });

});