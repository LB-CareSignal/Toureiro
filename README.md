# Toureiro

[![npm version](https://badge.fury.io/js/toureiro.svg)](https://badge.fury.io/js/toureiro)
[![Build Status](https://travis-ci.org/Epharmix/Toureiro.svg?branch=master)](https://travis-ci.org/Epharmix/Toureiro)

A graphical monitoring interface for the distributed job queue [bull](https://github.com/OptimalBits/bull) built using `express`, `react`, and Ant Design. Toureiro provides queue visibility as well as the ability to promote, rerun, and remove jobs when readonly mode is disabled.

## Screenshots

![Job List](https://raw.githubusercontent.com/Epharmix/Toureiro/screenshots/public/screenshots/Job%20List.png "Job List")

![Search Job](https://raw.githubusercontent.com/Epharmix/Toureiro/screenshots/public/screenshots/Search%20Job.png "Search Job")

## Get Started

First install `toureiro` from `npm`.

```
npm install toureiro
```

You can then use `toureiro` in your project. The constructor `toureiro()` returns an `express` app, which you can then have it listen to any port you desire:

```ts
import toureiro from 'toureiro';

const app = toureiro();
const server = app.listen(3000, function() {
  console.log('Toureiro is now listening at port 3000...');
});
```

Or you can mount it to a subpath for your own `express` server:

```ts
import express from 'express';
import toureiro from 'toureiro';

const app = express();
/**
 * Your own setup...
 */
app.use('/toureiro', toureiro());

const server = app.listen(8080);
```

You can also run `toureiro` as a standalone program:

```bash
> toureiro
Toureiro is now listening at port 3000...
```

## Config

By default, `toureiro` will try to connect to Redis db #0 at 127.0.0.1:6379, but you can configure it yourself:

```ts
const app = toureiro({
  // Options to be passed directly to redis.createClient(),
  // see https://github.com/NodeRedis/node_redis#rediscreateclient
  redis: {
    // Redis host
    host: '127.0.0.1',
    // Port
    port: 6379,
    // DB number
    db: 1
    // Other redis options...
  }
});
```

The standalone server and CLI also read these environment variables:

```bash
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

The app serves static assets from `public`.

## Usage

You can invoke `toureiro --help` to see usage instructions:

```
Usage: toureiro [port]
[port]         Port for toureiro to listen to
Options:
--rh           Redis host, default to 127.0.0.1
--rp           Redis port, default to 6379
--rdb          Redis database number, default to 0
--pass         Redis password, default to null
```

## Development

Use a modern Node runtime. This modernization pass has been validated on Node 22 without adding a hard package engine constraint.

Install dependencies:

```bash
npm install
```

Start Redis locally, then build the UI and run the standalone app:

```bash
npm run build
npm start
```

For local configuration, pass environment variables to `npm start`:

```bash
PORT=3100 REDIS_DB=7 npm start
```

Build and typecheck:

```bash
npm run build
npm run typecheck
```

### Testing

The test suite requires a running Redis instance.

Run all backend tests:

```bash
npm test
```

Run a targeted test using the standard convention:

```bash
npm run test -- --target=Config
npm run test -- --target=rerun
npm run test -- --target=#fetch
```

Preview the mocha command without executing tests:

```bash
npm run test -- --target=Config --dry-run
```

`npm run build:watch` rebuilds the frontend bundle when TypeScript or CSS files change.

Any issues reporting or pull requests are welcomed!

## Why Bull?

Distributed task queue is a necessity in a lot of use cases. Among all the queues out there, [Celery](http://www.celeryproject.org/) is probably the most prominent and has the biggest community. However, it's hard to integrate `Celery` into the Node.js programs, simply because that's another language environment to maintain. Therefore, a javascript native task queue is much needed.

Among the queues written for `javascript`, [Kue](https://github.com/Automattic/kue.git) is the most widely used one. `Kue` is a great library, and we have relied heavily on `Kue` before, but we are gradually troubled by the various bugs of the library. Due to the time when `Kue` was first written, a lot of things weren't possible (for example, atomicity of complex `redis` operations, which is now enabled by the built-in `LUA` scripting engine). What's more, several important features (FIFO behavior of delayed jobs, for instance) are missing from `Kue` or are hard to implement due to the early design decisions.

Then `bull` came along. It's written by the guys from OptimalBits and its APIs are modeled heavily after those of `Kue`. In its core, however, it's written very carefully (and differently from `Kue`) to ensure robustness and atomicity. Bugs that are common to distributed queue designs are not found with `bull` or have been fixed along the way.

As awesome as `bull` is, the only thing that is missing is a web monitoring interface, much like that of `Kue`, so we decided to make our own, thus `toureiro` is born.

## Browser Compatibility

It's compatible with modern evergreen browsers supported by the current React and Ant Design stack.

## License

The MIT License (MIT)

Copyright (c) 2015 Epharmix <evan@epharmix.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
