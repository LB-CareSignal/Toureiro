import config from '../lib/config';
import toureiro from '../lib/toureiro';

const runtimeConfig = config.fromEnv(process.env);
const app = toureiro({
  development: runtimeConfig.development,
  redis: runtimeConfig.redis
});

app.listen(runtimeConfig.port, function() {
  console.log('Toureiro is now listening at port', runtimeConfig.port, '...');
});