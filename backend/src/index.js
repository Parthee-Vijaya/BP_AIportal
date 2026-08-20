import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import { initializeDatabase } from './db/database.js';
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
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Initialize database
initializeDatabase();

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Barnepige Timeregistrering API'
    });
});

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
