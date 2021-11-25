import got from 'got';
import { Server } from 'http';
import { createApp } from '../src/app';

describe('/package/:name/:version endpoint', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    // IMP: The "start-app-and-return-promise" functionality `packages.test.ts` could be moved into a central utility module (the promise wrapping is unnecessary noise and it will probably be needed for other tests).
    server = await new Promise((resolve, reject) => {
      const server = createApp().listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
          resolve(server);
        } else {
          // NP: Does not actually use backquotes for formatting the error message
          reject(new Error('Unexpected address ${addr} for server'));
        }
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('responds', async () => {
    // PERF: One might argue that hitting an external service is a bad idea because it makes the tests slower and flakier. However, as an integration test it is actually quite useful in verifying the our service interacts correctly with registry.npmjs.org. We might consider adding a locally run npm registry (or mock web server) that is spun up for for more fine-grained tests
    const packageName = 'react';
    const packageVersion = '16.13.0';

    // IMP: The any and the linter suppression are not necessary, just remove it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await got(
      `http://localhost:${port}/package/${packageName}/${packageVersion}`,
    );
    const json = JSON.parse(res.body);

    expect(res.statusCode).toEqual(200);
    expect(json.name).toEqual(packageName);
    expect(json.version).toEqual(packageVersion);
    // IMP: Would be an ideal case to use snapshot testing i.e. `expect(json).toMatchSnapshot()`
    expect(json.dependencies).toEqual({
      'loose-envify': {
        version: '1.4.0',
        dependencies: {
          'js-tokens': {
            version: '4.0.0',
            dependencies: {},
          },
        },
      },
      'object-assign': {
        version: '4.1.1',
        dependencies: {},
      },
      'prop-types': {
        version: '15.7.2',
        dependencies: {
          'object-assign': {
            version: '4.1.1',
            dependencies: {},
          },
          'loose-envify': {
            version: '1.4.0',
            dependencies: {
              'js-tokens': {
                version: '4.0.0',
                dependencies: {},
              },
            },
          },
          'react-is': {
            version: '16.13.1',
            dependencies: {},
          },
        },
      },
    });
  });
});
