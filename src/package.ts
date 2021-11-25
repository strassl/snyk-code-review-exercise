import { RequestHandler } from 'express';
// IMP: Add `@types/semver` to get typings for the semver package.
import { maxSatisfying } from 'semver';
import got from 'got';
import { NPMPackage } from './types';

type Package = { version: string; dependencies: Record<string, Package> };

// IMP: The comment does not really add any information (except that an NPM package is retrieved which could also be part of the functions name).
/**
 * Attempts to retrieve package data from the npm registry and return it
 */
export const getPackage: RequestHandler = async function (req, res, next) {
  // ARCH: Depending on how this service is used, it might be worth considering a different architecture with a worker periodically fetching the latest data from npm and storing it in our own database, while this service only returns the results of database lookups. This would provide us with lower latency and alleviate the performance issues (see below). If periodic fetching is not feasible we could still use the database as a kind of persistent cache.

  // COR: Passing a dependency containing a slash (e.g. `@types/react`) will result in a failed request to npm. This is mostly a problem due to the endpoint definition (expects path segments for package name/version). This can be fixed by encoding the package name before calling the endpoint (e.g. `curl -v http://127.0.0.1:3000/package/%40types%2Freact/16.13.0`) but should probably be mentioned somewhere.
  // IMP: I'd personally try to unpack the request params get params in `app.ts`, so they are closer to the route definition and can be passed as a typed object to the request handler.
  const { name, version } = req.params;

  // IMP: Having logic here intermingles it with the request handler function . I'd recommend moving the logic into a separate (strongly-typed) function and reduce the request handler to calling this function and transforming it into a http response. The function call should communicate errors (by throwing or a result sum type) and be wrapped in a try/catch all as we see here.
  const dependencyTree = {};
  try {
    // IMP: Move the registry URL into a constant (or into some kind of configuration if we want to replace it for e.g. a mock server)
    // IMP: Use some kind of URL builder instead of constructing it ad-hoc using string concatenation. I think it might be sound in this case, but in the big picture it is just asking for trouble (query parameters, fragments, ...).
    // IMP: Move the "fetch npm package" functionality into a separate function
    const npmPackage: NPMPackage = await got(
      `https://registry.npmjs.org/${name}`,
    ).json();

    // COR: Passing an invalid version number (e.g. `curl http://127.0.0.1:3000/package/react/999 | jq`) results in a 500 error. This line assumes that the version exists in the `npmPackage.versions` object. Fix by checking if it is `!= null` before use and returning 404 in case it is.
    const dependencies: Record<string, string> =
      npmPackage.versions[version].dependencies ?? {};
    for (const [name, range] of Object.entries(dependencies)) {
      const subDep = await getDependencies(name, range);
      dependencyTree[name] = subDep;
    }

    return res
      .status(200)
      .json({ name, version, dependencies: dependencyTree });
  } catch (error) {
    return next(error);
  }
};

async function getDependencies(name: string, range: string): Promise<Package> {
  /*
  PERF: The recursive lookup produces a lot of external http requests, especially for deeply nested recursive dependencies, hidden behind the neat async/await syntax. This may also result in quite a bit of duplicate lookups. Although this shouldn't pose a correctness problem (a cursory search tells me packages published on npm should be immutable - https://docs.npmjs.com/policies/unpublish), it is not pretty. Getting `http://127.0.0.1:3000/package/snyk-docker-plugin/4.19.5` takes 22s due to this

  Two recommendations (depending on the use case of this service, of course):
    - First keep an internal, per-request cache of the already fetched packages and their results. This gets rid of duplicate lookups.
    - Secondly add a global caching layer to improve cross-request performance (also mentioned in the related issue). If we were to use the database-backed architecture we could even just use the database instead of an additional cache.
  */

  // COR: Cycles in the dependency graph (apparently possible, although I didn't take the time to repro it - https://github.com/npm/npm/issues/2063) will result in an infinite loop (which also opens the service up to DoS attacks). Cycle detection can be done by simply passing the current dependency-path to the getDependencies function. However we need to decide how to handle cycles at the API level - changing the response to a flat list of dependencies with each containing the dependency path might be a possibility.

  // IMP: Move the registry URL into a shared constant
  const npmPackage: NPMPackage = await got(
    `https://registry.npmjs.org/${name}`,
  ).json();

  const v = maxSatisfying(Object.keys(npmPackage.versions), range);
  const dependencies: Record<string, Package> = {};


  // IMP: I'd recommend explicit `!= null` checks instead of the `if(value)` test, since the shorthand will result in the value being coerced into a boolean (e.g. '' -> false, or 0 -> false) which is usually not what one intends or expects.
  if (v) {
    const newDeps = npmPackage.versions[v].dependencies;
    // PERF: These requests could be run concurrently using Promise.all(). However we'd have to make sure that we do not spawn a ridiculous amount of HTTP requests - ideally we'd use some kind of pooling to limit the maximum number.
    for (const [name, range] of Object.entries(newDeps ?? {})) {
      dependencies[name] = await getDependencies(name, range);
    }
  }

  // COR: We just "ignore" the fact that we were apparently unable to resolve a dependency. It is probably preferrable to throw an error
  return { version: v ?? range, dependencies };
}
