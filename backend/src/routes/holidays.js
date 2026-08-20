import { Router } from 'express';
import db from '../db/database.js';
import {
    assertDate,
    assertTimeRange,
    isValidationError,
    parseTimeMinutes,
    ValidationError
} from '../utils/validation.js';
import { getHolidayCalendar } from '../services/holidayCalendar.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';

const router = Router();

function validateHoliday({ date, name, all_day, start_time, end_time }) {
    assertDate(date);
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) throw new ValidationError('Dato og navn er påkrævet');
    if (trimmedName.length > 20) throw new ValidationError('Navn må maks. være 20 tegn');
    if (!all_day) {
        assertTimeRange(start_time, end_time);
        if (parseTimeMinutes(start_time) >= parseTimeMinutes(end_time)) {
            throw new ValidationError('En delvis helligdag skal starte før den slutter samme dag');
        }
    }
    return trimmedName;
}

function handleError(res, error, fallback) {
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
}

router.get('/kalendarium/:year', async (req, res) => {
    const year = parseInt(req.params.year);
    if (isNaN(year) || year < 1 || year > 9999) {
        return res.status(400).json({ error: 'Ugyldigt år' });
    }

    try {
        res.json(await getHolidayCalendar(year, { refresh: req.query.refresh === 'true' }));
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente helligdagskalender');
    }
});

// GET /api/holidays — alle custom helligdage
router.get('/', (req, res) => {
    try {
        const holidays = db.prepare('SELECT * FROM custom_holidays ORDER BY date ASC').all();
        res.json(holidays);
    } catch (error) {
        console.error('Fejl ved hentning af helligdage:', error);
        res.status(500).json({ error: 'Kunne ikke hente helligdage' });
    }
});

// POST /api/holidays — opret ny
router.post('/', requirePermission(PERMISSIONS.MANAGE_HOLIDAYS), (req, res) => {
    try {
        const { date, all_day = 1, start_time, end_time, recurring = 0 } = req.body;
        const name = validateHoliday({ ...req.body, all_day });

        const result = db.prepare(`
            INSERT INTO custom_holidays (date, name, all_day, start_time, end_time, recurring)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(date, name, all_day ? 1 : 0, all_day ? null : start_time, all_day ? null : end_time, recurring ? 1 : 0);

        const holiday = db.prepare('SELECT * FROM custom_holidays WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(holiday);
    } catch (error) {
        handleError(res, error, 'Kunne ikke oprette helligdag');
    }
});

// PUT /api/holidays/:id — rediger
router.put('/:id', requirePermission(PERMISSIONS.MANAGE_HOLIDAYS), (req, res) => {
    try {
        const { date, name, all_day, start_time, end_time, recurring } = req.body;
        const existing = db.prepare('SELECT * FROM custom_holidays WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Helligdag ikke fundet' });
        }
        const nextHoliday = {
            date: date || existing.date,
            name: name ?? existing.name,
            all_day: all_day != null ? Boolean(all_day) : Boolean(existing.all_day),
            start_time: start_time ?? existing.start_time,
            end_time: end_time ?? existing.end_time
        };
        const validatedName = validateHoliday(nextHoliday);

        db.prepare(`
            UPDATE custom_holidays SET
                date = COALESCE(?, date),
                name = COALESCE(?, name),
                all_day = COALESCE(?, all_day),
                start_time = ?,
                end_time = ?,
                recurring = COALESCE(?, recurring)
            WHERE id = ?
        `).run(
            nextHoliday.date,
            validatedName,
            nextHoliday.all_day ? 1 : 0,
            nextHoliday.all_day ? null : nextHoliday.start_time,
            nextHoliday.all_day ? null : nextHoliday.end_time,
            recurring != null ? (recurring ? 1 : 0) : null,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM custom_holidays WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        handleError(res, error, 'Kunne ikke opdatere helligdag');
    }
});

// DELETE /api/holidays/:id — slet
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_HOLIDAYS), (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM custom_holidays WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Helligdag ikke fundet' });
        }
        db.prepare('DELETE FROM custom_holidays WHERE id = ?').run(req.params.id);
        res.json({ message: 'Helligdag slettet' });
    } catch (error) {
        console.error('Fejl ved sletning af helligdag:', error);
        res.status(500).json({ error: 'Kunne ikke slette helligdag' });
    }
});

export default router;
