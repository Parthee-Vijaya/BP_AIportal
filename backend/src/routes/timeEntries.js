import { Router } from 'express';
import db from '../db/database.js';
import {
    ALLOWANCE_CALCULATION_VERSION,
    calculateAllowances
} from '../services/allowanceCalculator.js';
import { checkGrant } from '../services/grantCalculator.js';
import {
    assertDate,
    isValidationError,
    normalizeIdArray,
    validateTimeEntryInput,
    ValidationError
} from '../utils/validation.js';

const router = Router();

function actorName(value) {
    const actor = String(value ?? '').trim();
    return actor || 'Ukendt demo-aktør';
}

function recordAudit(timeEntryId, action, actor, metadata = null) {
    db.prepare(`
        INSERT INTO time_entry_audit (time_entry_id, action, actor, metadata)
        VALUES (?, ?, ?, ?)
    `).run(timeEntryId, action, actorName(actor), metadata ? JSON.stringify(metadata) : null);
}

function handleRouteError(res, error, fallbackMessage) {
    if (isValidationError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
}

function parsePositiveId(value, label) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError(`${label} er ugyldigt`);
    }
    return id;
}

// GET /api/time-entries - Hent alle registreringer med filtrering
router.get('/', (req, res) => {
    try {
        const { status, child_id, caregiver_id, from_date, to_date } = req.query;
        const allowedStatuses = new Set(['pending', 'approved', 'rejected']);
        if (status && !allowedStatuses.has(status)) {
            throw new ValidationError('Ugyldig status');
        }
        if (from_date) assertDate(from_date, 'Fra-dato');
        if (to_date) assertDate(to_date, 'Til-dato');
        if (from_date && to_date && from_date > to_date) {
            throw new ValidationError('Fra-dato skal ligge før eller på til-dato');
        }

        let query = `
            SELECT te.*,
                   c.first_name as child_first_name,
                   c.last_name as child_last_name,
                   c.birth_date as child_birth_date,
                   cg.first_name as caregiver_first_name,
                   cg.last_name as caregiver_last_name,
                   cg.ma_number
            FROM time_entries te
            JOIN children c ON te.child_id = c.id
            JOIN caregivers cg ON te.caregiver_id = cg.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND te.status = ?';
            params.push(status);
        }
        if (child_id) {
            query += ' AND te.child_id = ?';
            params.push(parsePositiveId(child_id, 'Barn'));
        }
        if (caregiver_id) {
            query += ' AND te.caregiver_id = ?';
            params.push(parsePositiveId(caregiver_id, 'Barnepige'));
        }
        if (from_date) {
            query += ' AND te.date >= ?';
            params.push(from_date);
        }
        if (to_date) {
            query += ' AND te.date <= ?';
            params.push(to_date);
        }

        query += status === 'pending'
            ? ' ORDER BY te.submitted_at ASC'
            : ' ORDER BY te.submitted_at DESC';

        const entries = db.prepare(query).all(...params).map(entry => ({
            ...entry,
            grant_status: checkGrant(entry.child_id, entry.date, 0, {
                useFrameGrant: entry.grant_source === 'frame'
            })
        }));
        res.json(entries);
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke hente registreringer');
    }
});

router.get('/:id/audit', (req, res) => {
    try {
        const id = parsePositiveId(req.params.id, 'Registrering');
        const entry = db.prepare('SELECT id FROM time_entries WHERE id = ?').get(id);
        if (!entry) return res.status(404).json({ error: 'Registrering ikke fundet' });
        const audit = db.prepare(`
            SELECT * FROM time_entry_audit
            WHERE time_entry_id = ?
            ORDER BY created_at ASC, id ASC
        `).all(id).map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));
        res.json(audit);
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke hente auditlog');
    }
});

// GET /api/time-entries/:id - Hent specifik registrering
router.get('/:id', (req, res) => {
    try {
        const entry = db.prepare(`
            SELECT te.*,
                   c.first_name as child_first_name,
                   c.last_name as child_last_name,
                   c.birth_date as child_birth_date,
                   cg.first_name as caregiver_first_name,
                   cg.last_name as caregiver_last_name,
                   cg.ma_number
            FROM time_entries te
            JOIN children c ON te.child_id = c.id
            JOIN caregivers cg ON te.caregiver_id = cg.id
            WHERE te.id = ?
        `).get(parsePositiveId(req.params.id, 'Registrering'));

        if (!entry) return res.status(404).json({ error: 'Registrering ikke fundet' });
        res.json({
            ...entry,
            grant_status: checkGrant(entry.child_id, entry.date, 0, {
                useFrameGrant: entry.grant_source === 'frame'
            })
        });
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke hente registrering');
    }
});

// POST /api/time-entries - Opret ny registrering
router.post('/', (req, res) => {
    try {
        const {
            caregiver_id,
            child_id,
            date,
            start_time,
            end_time,
            comment,
            use_frame_grant = false,
            submitted_by
        } = req.body;
        const caregiverId = parsePositiveId(caregiver_id, 'Barnepige');
        const childId = parsePositiveId(child_id, 'Barn');
        validateTimeEntryInput({ date, start_time, end_time });

        const connection = db.prepare(`
            SELECT 1 FROM child_caregiver cc
            JOIN children c ON c.id = cc.child_id AND c.deleted_at IS NULL
            JOIN caregivers cg ON cg.id = cc.caregiver_id AND cg.deleted_at IS NULL
            WHERE cc.child_id = ? AND cc.caregiver_id = ?
        `).get(childId, caregiverId);
        if (!connection) {
            return res.status(400).json({ error: 'Barnepigen er ikke tilknyttet dette aktive barn' });
        }

        const allowances = calculateAllowances(date, start_time, end_time);
        const useFrameGrant = use_frame_grant === true;
        const grantCheck = checkGrant(childId, date, allowances.total_hours, { useFrameGrant });
        if (grantCheck.error) {
            return res.status(400).json({ error: grantCheck.error, grantStatus: grantCheck });
        }

        const createEntry = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO time_entries (
                    caregiver_id, child_id, date, start_time, end_time,
                    normal_hours, evening_hours, night_hours,
                    saturday_hours, sunday_holiday_hours, total_hours,
                    calculation_version, grant_source, comment
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                caregiverId,
                childId,
                date,
                start_time,
                end_time,
                allowances.normal_hours,
                allowances.evening_hours,
                allowances.night_hours,
                allowances.saturday_hours,
                allowances.sunday_holiday_hours,
                allowances.total_hours,
                ALLOWANCE_CALCULATION_VERSION,
                useFrameGrant ? 'frame' : 'normal',
                String(comment ?? '').trim() || null
            );
            recordAudit(result.lastInsertRowid, 'submitted', submitted_by, {
                grantSource: useFrameGrant ? 'frame' : 'normal',
                grantExceeded: grantCheck.exceeded
            });
            return result.lastInsertRowid;
        });

        const entryId = createEntry();
        const newEntry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId);
        res.status(201).json({ entry: newEntry, allowances, grantStatus: grantCheck });
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke oprette registrering');
    }
});

// POST /api/time-entries/preview - Preview beregning uden at gemme
router.post('/preview', (req, res) => {
    try {
        const { child_id, date, start_time, end_time, use_frame_grant = false } = req.body;
        validateTimeEntryInput({ date, start_time, end_time });
        const allowances = calculateAllowances(date, start_time, end_time);
        const grantCheck = child_id
            ? checkGrant(
                parsePositiveId(child_id, 'Barn'),
                date,
                allowances.total_hours,
                { useFrameGrant: use_frame_grant === true }
            )
            : null;

        res.json({ allowances, grantStatus: grantCheck });
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke beregne preview');
    }
});

router.put('/:id/approve', (req, res) => {
    try {
        const id = parsePositiveId(req.params.id, 'Registrering');
        const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
        if (!entry) return res.status(404).json({ error: 'Registrering ikke fundet' });
        if (entry.status !== 'pending') {
            return res.status(400).json({ error: 'Kun afventende registreringer kan godkendes' });
        }

        const actor = actorName(req.body.reviewed_by);
        db.transaction(() => {
            db.prepare(`
                UPDATE time_entries SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(actor, id);
            recordAudit(id, 'approved', actor);
        })();
        res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id));
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke godkende registrering');
    }
});

router.put('/:id/reject', (req, res) => {
    try {
        const id = parsePositiveId(req.params.id, 'Registrering');
        const rejectionReason = String(req.body.rejection_reason ?? '').trim();
        if (!rejectionReason) throw new ValidationError('Årsag til afvisning er påkrævet');

        const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
        if (!entry) return res.status(404).json({ error: 'Registrering ikke fundet' });
        if (entry.status !== 'pending') {
            return res.status(400).json({ error: 'Kun afventende registreringer kan afvises' });
        }

        const actor = actorName(req.body.reviewed_by);
        db.transaction(() => {
            db.prepare(`
                UPDATE time_entries SET
                    status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                    rejection_reason = ?
                WHERE id = ?
            `).run(actor, rejectionReason, id);
            recordAudit(id, 'rejected', actor, { reason: rejectionReason });
        })();
        res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id));
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke afvise registrering');
    }
});

router.put('/:id/payroll', (req, res) => {
    try {
        const id = parsePositiveId(req.params.id, 'Registrering');
        const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
        if (!entry) return res.status(404).json({ error: 'Registrering ikke fundet' });
        if (entry.status !== 'approved') {
            return res.status(400).json({ error: 'Kun godkendte registreringer kan markeres i lønsystem' });
        }

        const payrollDate = req.body.payroll_date || new Date().toISOString().slice(0, 10);
        assertDate(payrollDate, 'Løndato');
        const actor = actorName(req.body.registered_by);
        db.transaction(() => {
            db.prepare(`
                UPDATE time_entries SET payroll_registered = 1, payroll_date = ? WHERE id = ?
            `).run(payrollDate, id);
            recordAudit(id, 'payroll_registered', actor, { payrollDate });
        })();
        res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id));
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke markere i lønsystem');
    }
});

router.post('/batch-approve', (req, res) => {
    try {
        const ids = normalizeIdArray(req.body.ids, 'Registreringer');
        if (ids.length === 0) throw new ValidationError('Ingen registreringer valgt');
        const placeholders = ids.map(() => '?').join(',');
        const pendingEntries = db.prepare(`
            SELECT id FROM time_entries WHERE id IN (${placeholders}) AND status = 'pending'
        `).all(...ids);
        const actor = actorName(req.body.reviewed_by);

        db.transaction(() => {
            const update = db.prepare(`
                UPDATE time_entries SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status = 'pending'
            `);
            for (const entry of pendingEntries) {
                update.run(actor, entry.id);
                recordAudit(entry.id, 'approved', actor, { batch: true });
            }
        })();

        res.json({
            message: `${pendingEntries.length} registreringer godkendt`,
            approvedCount: pendingEntries.length,
            requestedCount: ids.length
        });
    } catch (error) {
        handleRouteError(res, error, 'Kunne ikke godkende registreringer');
    }
});

export default router;
