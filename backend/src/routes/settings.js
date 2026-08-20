import { Router } from 'express';
import db from '../db/database.js';
import { validateMonthInterval } from '../services/grantCalculator.js';
import { isValidationError } from '../utils/validation.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';

const router = Router();

// GET /api/settings/month-interval - Hent nuværende månedsinterval
router.get('/month-interval', (req, res) => {
    try {
        // Hent det aktive interval (seneste der er trådt i kraft)
        const today = new Date().toISOString().split('T')[0];
        const interval = db.prepare(`
            SELECT * FROM month_interval_history
            WHERE effective_from <= ?
            ORDER BY effective_from DESC
            LIMIT 1
        `).get(today);

        if (!interval) {
            // Standard: 1. til sidste dag i måneden
            return res.json({
                start_day: 1,
                end_day: 31,
                effective_from: null,
                is_default: true
            });
        }

        res.json({
            ...interval,
            is_default: false
        });
    } catch (error) {
        console.error('Fejl ved hentning af månedsinterval:', error);
        res.status(500).json({ error: 'Kunne ikke hente månedsinterval' });
    }
});

// GET /api/settings/month-interval/history - Hent historik
router.get('/month-interval/history', (req, res) => {
    try {
        const history = db.prepare(`
            SELECT * FROM month_interval_history
            ORDER BY effective_from DESC
        `).all();

        res.json(history);
    } catch (error) {
        console.error('Fejl:', error);
        res.status(500).json({ error: 'Kunne ikke hente historik' });
    }
});

// PUT /api/settings/month-interval - Opdater månedsinterval (gælder fra d.d. og frem)
router.put('/month-interval', requirePermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const { startDay, endDay } = validateMonthInterval(req.body.start_day, req.body.end_day);

        const today = new Date().toISOString().split('T')[0];

        db.transaction(() => {
            const todayEntry = db.prepare(`
                SELECT id FROM month_interval_history WHERE effective_from = ? ORDER BY id DESC LIMIT 1
            `).get(today);
            if (todayEntry) {
                db.prepare(`
                    UPDATE month_interval_history SET start_day = ?, end_day = ? WHERE id = ?
                `).run(startDay, endDay, todayEntry.id);
            } else {
                db.prepare(`
                    INSERT INTO month_interval_history (start_day, end_day, effective_from)
                    VALUES (?, ?, ?)
                `).run(startDay, endDay, today);
            }

            db.prepare(`
                INSERT OR REPLACE INTO settings (key, value, updated_at, effective_from)
                VALUES ('month_interval_start', ?, CURRENT_TIMESTAMP, ?)
            `).run(String(startDay), today);

            db.prepare(`
                INSERT OR REPLACE INTO settings (key, value, updated_at, effective_from)
                VALUES ('month_interval_end', ?, CURRENT_TIMESTAMP, ?)
            `).run(String(endDay), today);
        })();

        res.json({
            start_day: startDay,
            end_day: endDay,
            effective_from: today,
            message: `Månedsinterval ændret til d. ${startDay} - d. ${endDay}. Gælder fra ${today} og frem.`
        });
    } catch (error) {
        if (isValidationError(error)) return res.status(400).json({ error: error.message });
        console.error('Fejl ved opdatering af månedsinterval:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere månedsinterval' });
    }
});

export default router;
