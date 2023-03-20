import 'zone.js/dist/zone-node';

import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import { join } from 'path';
import * as compressionModule from 'compression';
import { default as serverTiming } from 'server-timing';

import { AppServerModule } from './projects/movies/src/main.server';
import { APP_BASE_HREF } from '@angular/common';
import { existsSync } from 'fs';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  server.use(serverTiming());

  // **🚀 Perf Tip:**
  // Serve gzip for faster load
  server.use(compressionModule());

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine(
    'html',
    ngExpressEngine({
      bootstrap: AppServerModule,
    })
  );
  const distFolder = join(process.cwd(), 'dist/movies/browser');
  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get(
    '*.*',
    express.static(distFolder, {
      maxAge: '1y',

      // missing assets results in 404 instead of continuing to next route handler (and rendering route)
      fallthrough: false,
    })
  );

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    // return rendered HTML including Angular generated DOM
    console.log('SSR for route', req.url);
    res.startTime('SSR', 'SSR Render Time');
    const indexHtml = existsSync(join(distFolder, 'index.original.html'))
      ? 'index.original.html'
      : 'index';
    res.render(
      indexHtml,
      {
        req,
        providers: [
          {
            provide: APP_BASE_HREF,
            useValue: req.baseUrl,
          },
        ],
      },
      (_, html) => {
        res.endTime('SSR');
        res.send(html);
      }
    );
  });

  return server;
}

function run(): void {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = (mainModule && mainModule.filename) || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from './projects/movies/src/main.server';
