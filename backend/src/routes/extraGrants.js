import { Router } from 'express';
import db from '../db/database.js';
import { assertDate, assertPositiveNumber, isValidationError, ValidationError } from '../utils/validation.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';
import { getGrantPeriod } from '../services/grantCalculator.js';

const router = Router();

function handleError(res, error, fallback) {
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
}

function validateGrant(hours, fromDate, toDate) {
    const parsedHours = assertPositiveNumber(hours, 'Antal timer');
    assertDate(fromDate, 'Fra-dato');
    assertDate(toDate, 'Til-dato');
    if (fromDate > toDate) throw new ValidationError('Fra-dato skal ligge før eller på til-dato');
    return parsedHours;
}

function validateGrantedBy(value) {
    const grantedBy = String(value ?? '').trim();
    if (!grantedBy) throw new ValidationError('Tildelt af er påkrævet');
    if (grantedBy.length > 100) throw new ValidationError('Tildelt af må maks. være 100 tegn');
    return grantedBy;
}

function validateGrantSource(value, child) {
    const source = value || (child.has_frame_grant ? 'frame' : 'normal');
    if (!['normal', 'frame'].includes(source)) throw new ValidationError('Ugyldig bevillingskilde');
    if (source === 'frame' && !child.has_frame_grant) {
        throw new ValidationError('Barnet har ikke en rammebevilling');
    }
    return source;
}

function validateNormalGrantPeriod(child, fromDate, toDate) {
    if (child.grant_type === 'specific_weekdays') {
        if (fromDate !== toDate) {
            throw new ValidationError('Ekstratimer til en ugedagsbevilling skal gælde én konkret dato');
        }
        let weekdays;
        try {
            weekdays = JSON.parse(child.grant_weekdays || '{}');
        } catch {
            throw new ValidationError('Barnets ugedagsbevilling er ugyldig');
        }
        const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${fromDate}T00:00:00Z`).getUTCDay()];
        if (!(Number(weekdays[weekday]) > 0)) {
            throw new ValidationError('Datoen skal være en ugedag, hvor barnet har en bevilling');
        }
        return;
    }
    const period = getGrantPeriod(child.grant_type, fromDate);
    if (fromDate !== period.startDate || toDate !== period.endDate) {
        throw new ValidationError(`Ekstratimer til normal bevilling skal følge perioden ${period.startDate} til ${period.endDate}`);
    }
}

// GET /api/extra-grants?child_id= – Hent ekstrabevillinger for et barn (eller alle)
router.get('/', (req, res) => {
    try {
        const { child_id } = req.query;
        let query = `
            SELECT eg.*, c.first_name as child_first_name, c.last_name as child_last_name
            FROM extra_grants eg
            JOIN children c ON eg.child_id = c.id
            WHERE 1=1
        `;
        const params = [];
        if (child_id) {
            query += ` AND eg.child_id = ?`;
            params.push(child_id);
        }
        query += ` ORDER BY COALESCE(eg.granted_at, eg.created_at) DESC, eg.id DESC`;

        const rows = db.prepare(query).all(...params);
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente ekstrabevillinger');
    }
});

// GET /api/extra-grants/:id
router.get('/:id', (req, res) => {
    try {
        const row = db.prepare(`
            SELECT eg.*, c.first_name as child_first_name, c.last_name as child_last_name
            FROM extra_grants eg
            JOIN children c ON eg.child_id = c.id
            WHERE eg.id = ?
        `).get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Ekstrabevilling ikke fundet' });
        res.json(row);
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente ekstrabevilling');
    }
});

// POST /api/extra-grants – Opret ekstrabevilling (gælder fra d.d. og frem)
router.post('/', requirePermission(PERMISSIONS.MANAGE_GRANTS), (req, res) => {
    try {
        const { child_id, hours, from_date, to_date, comment, grant_source } = req.body;
        if (!child_id || hours == null || !from_date || !to_date) {
            return res.status(400).json({
                error: 'Barn, antal timer, fra-dato og til-dato er påkrævet'
            });
        }
        const parsedHours = validateGrant(hours, from_date, to_date);
        const grantedBy = validateGrantedBy(req.approver?.name || 'Godkender');
        const child = db.prepare(`
            SELECT id, has_frame_grant, grant_type, grant_weekdays FROM children WHERE id = ? AND deleted_at IS NULL
        `).get(child_id);
        if (!child) return res.status(404).json({ error: 'Barn ikke fundet' });
        const grantSource = validateGrantSource(grant_source, child);
        if (grantSource === 'normal') validateNormalGrantPeriod(child, from_date, to_date);

        const result = db.prepare(`
            INSERT INTO extra_grants (child_id, hours, from_date, to_date, grant_source, comment, granted_by, granted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(child_id, parsedHours, from_date, to_date, grantSource, comment || null, grantedBy);

        const newRow = db.prepare('SELECT * FROM extra_grants WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newRow);
    } catch (error) {
        handleError(res, error, 'Kunne ikke oprette ekstrabevilling');
    }
});

// PUT /api/extra-grants/:id – Opdater ekstrabevilling (gælder fra d.d. og frem)
router.put('/:id', requirePermission(PERMISSIONS.MANAGE_GRANTS), (req, res) => {
    try {
        const { hours, from_date, to_date, comment } = req.body;
        const existing = db.prepare('SELECT * FROM extra_grants WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Ekstrabevilling ikke fundet' });

        const nextHours = hours != null ? hours : existing.hours;
        const nextFromDate = from_date || existing.from_date;
        const nextToDate = to_date || existing.to_date;
        const parsedHours = validateGrant(nextHours, nextFromDate, nextToDate);
        const child = db.prepare('SELECT id, has_frame_grant, grant_type, grant_weekdays FROM children WHERE id = ? AND deleted_at IS NULL').get(existing.child_id);
        if (!child) return res.status(404).json({ error: 'Barn ikke fundet' });
        if (existing.grant_source === 'normal') validateNormalGrantPeriod(child, nextFromDate, nextToDate);

        db.prepare(`
            UPDATE extra_grants SET
                hours = COALESCE(?, hours),
                from_date = COALESCE(?, from_date),
                to_date = COALESCE(?, to_date),
                comment = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            parsedHours,
            nextFromDate,
            nextToDate,
            comment !== undefined ? comment : existing.comment,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM extra_grants WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        handleError(res, error, 'Kunne ikke opdatere ekstrabevilling');
    }
});

// DELETE /api/extra-grants/:id
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_GRANTS), (req, res) => {
    try {
        const existing = db.prepare('SELECT id FROM extra_grants WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Ekstrabevilling ikke fundet' });
        db.prepare('DELETE FROM extra_grants WHERE id = ?').run(req.params.id);
        res.json({ message: 'Ekstrabevilling slettet' });
    } catch (error) {
        handleError(res, error, 'Kunne ikke slette ekstrabevilling');
    }
});

export default router;
