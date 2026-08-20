import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import db, { initializeDatabase } from './db/database.js';
import { DATA_SOURCES, dataSourceMiddleware } from './db/dataSource.js';
import { authEnabled, entraRolesConfigured, requirePortalUser, resolveEntraRoles } from './services/portalAuth.js';
import { findApproverByEmail } from './services/permissions.js';
import childrenRouter from './routes/children.js';
import caregiversRouter from './routes/caregivers.js';
import timeEntriesRouter from './routes/timeEntries.js';
import exportRouter from './routes/export.js';
import settingsRouter from './routes/settings.js';
import extraGrantsRouter from './routes/extraGrants.js';
import holidaysRouter from './routes/holidays.js';
import approversRouter from './routes/approvers.js';
import reportsRouter from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.disable('x-powered-by');
app.use(cors({
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : false
}));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // SAMEORIGIN (ikke DENY): AI-portalen indlejrer appen i en iframe på
    // samme origin (/barnepige inde i portalen viser /barnepige-app/).
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Initialize database
initializeDatabase();

// Health check — før login-vagten, så containerens healthcheck kan nå den.
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Barnepige Timeregistrering API'
    });
});

// Vælg datakilde (demodata/rigtige data) for hele requesten, kræv derefter
// et gyldigt portal-login (shield-session) for alle øvrige /api-ruter.
app.use('/api', dataSourceMiddleware);
app.use('/api', requirePortalUser);
console.log(authEnabled
    ? 'Portal-login: aktiveret (shield-session valideres mod Entra ID)'
    : 'Portal-login: SLÅET FRA (ENTRA_TENANT_ID/ENTRA_CLIENT_ID er ikke sat)');

// Rigtige data starter helt tomme — den første bruger der åbner appen,
// oprettes automatisk som administrator, så verdenen kan bygges op. Alle
// efterfølgende brugere oprettes af administratoren under Roller og
// rettigheder. Kører kun mens approvers-tabellen er tom.
app.use('/api', (req, res, next) => {
    if (req.dataSource === DATA_SOURCES.LIVE && req.portalUser?.upn) {
        const count = db.prepare('SELECT COUNT(*) AS n FROM approvers').get().n;
        if (count === 0) {
            db.prepare(`
                INSERT INTO approvers (name, email, role) VALUES (?, ?, 'administrator')
            `).run(req.portalUser.name || req.portalUser.upn, String(req.portalUser.upn).toLowerCase());
            console.log(`Rigtige data: ${req.portalUser.upn} oprettet som første administrator`);
        }
    }
    next();
});

function findCaregiverByEmail(email) {
    if (!email) return null;
    return db.prepare(`
        SELECT id, first_name, last_name, ma_number, email
        FROM caregivers WHERE lower(email) = lower(?) AND deleted_at IS NULL
    `).get(String(email)) || null;
}

// Hvem er logget ind (til demo-rolleskærmen og debugging): identitet fra
// portalens id_token + hvilke af de fire Barnepige-Entra-roller brugeren har
// (null pr. rolle indtil gruppernes id'er er konfigureret). I "rigtige
// data"-tilstanden medsendes brugerens egne profiler (matchet på e-mail),
// så frontenden ved hvem man ER — uden demo-vælgere.
app.get('/api/me', (req, res) => {
    const liveMode = req.dataSource === DATA_SOURCES.LIVE;
    res.json({
        ...req.portalUser,
        authEnabled,
        rolesConfigured: entraRolesConfigured,
        entraRoles: resolveEntraRoles(req.portalUser.groups),
        dataSource: req.dataSource,
        approverProfile: liveMode ? findApproverByEmail(req.portalUser.upn) : null,
        caregiverProfile: liveMode ? findCaregiverByEmail(req.portalUser.upn) : null
    });
});

// API Routes
app.use('/api/children', childrenRouter);
app.use('/api/caregivers', caregiversRouter);
app.use('/api/time-entries', timeEntriesRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/extra-grants', extraGrantsRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/approvers', approversRouter);
app.use('/api/reports', reportsRouter);

// Serve frontend static files in production
const distPath = join(__dirname, '../../frontend/dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/{*path}', (req, res) => {
        res.sendFile(join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            message: 'Barnepige Timeregistrering API',
            version: '1.0.0',
            endpoints: {
                children: '/api/children',
                caregivers: '/api/caregivers',
                timeEntries: '/api/time-entries',
                export: '/api/export',
                reports: '/api/reports',
                health: '/api/health'
            }
        });
    });
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' ? { message: err.message } : {})
    });
});

// Start server
const isMainModule = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isMainModule) {
    app.listen(PORT, () => {
        console.log(`
========================================
  Barnepige Timeregistrering API
========================================
  Server kører på: http://localhost:${PORT}
  API Endpoints:
    - GET  /api/children
    - GET  /api/caregivers
    - GET  /api/time-entries
    - GET  /api/export/time-entries
    - GET  /api/reports
    - GET  /api/reports/excel
    - GET  /api/health
========================================
        `);
    });
}

export default app;
