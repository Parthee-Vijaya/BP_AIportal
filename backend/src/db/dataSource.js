// Valg af datakilde pr. request: "demo" (legepladsen med testdata) eller
// "live" (rigtige data, starter helt tomme). Frontenden sender valget som
// X-Data-Source-header (eller ?data_source= for direkte download-links);
// AsyncLocalStorage bærer valget gennem hele requesten, så al eksisterende
// databasekode automatisk rammer den rigtige database via proxyen i
// database.js. Udenfor en request (seeds, scripts, tests) er demo standard.

import { AsyncLocalStorage } from 'node:async_hooks';

export const DATA_SOURCES = Object.freeze({
    DEMO: 'demo',
    LIVE: 'live'
});

const storage = new AsyncLocalStorage();

export function currentDataSource() {
    return storage.getStore() === DATA_SOURCES.LIVE ? DATA_SOURCES.LIVE : DATA_SOURCES.DEMO;
}

export function runWithDataSource(source, fn) {
    const resolved = source === DATA_SOURCES.LIVE ? DATA_SOURCES.LIVE : DATA_SOURCES.DEMO;
    return storage.run(resolved, fn);
}

// Express-middleware — monteres på /api før alle ruter der rører databasen.
export function dataSourceMiddleware(req, res, next) {
    const raw = req.get('X-Data-Source') || req.query.data_source;
    const source = raw === DATA_SOURCES.LIVE ? DATA_SOURCES.LIVE : DATA_SOURCES.DEMO;
    req.dataSource = source;
    runWithDataSource(source, next);
}
