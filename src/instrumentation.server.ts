import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'https://4f52ba357f3b76ff2c52760047ab1065@o4512073687367680.ingest.de.sentry.io/4512086482813008',

  tracesSampleRate: 1.0,
  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: import.meta.env.DEV,
});