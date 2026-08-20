import { Router } from 'express';
import db from '../db/database.js';
import { getGrantSummary } from '../services/grantCalculator.js';
import {
    assertDate,
    assertPositiveNumber,
    isValidationError,
    normalizeIdArray,
    ValidationError
} from '../utils/validation.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';

const router = Router();
const GRANT_TYPES = new Set(['week', 'month', 'quarter', 'half_year', 'year', 'specific_weekdays']);
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function handleError(res, error, fallback) {
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
}

function normalizeGrantWeekdays(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new ValidationError('Ugedagsbevilling skal være et objekt');
    }
    return Object.fromEntries(WEEKDAYS.map(day => [
        day,
        assertPositiveNumber(value[day] ?? 0, `Timer for ${day}`, { allowZero: true })
    ]));
}

function validateGrant({ grant_type, grant_hours, grant_weekdays, has_frame_grant, frame_hours }) {
    const grantType = grant_type || 'week';
    if (!GRANT_TYPES.has(grantType)) throw new ValidationError('Ugyldig bevillingstype');
    const grantHours = assertPositiveNumber(grant_hours ?? 0, 'Bevillingstimer', { allowZero: true });
    const weekdays = normalizeGrantWeekdays(grant_weekdays);
    if (grantType === 'specific_weekdays' && !weekdays) {
        throw new ValidationError('Ugedagstimer er påkrævet for specifikke ugedage');
    }
    const frameHours = assertPositiveNumber(frame_hours ?? 0, 'Rammebevillingstimer', { allowZero: true });
    if (has_frame_grant && frameHours <= 0) {
        throw new ValidationError('Rammebevilling skal have et positivt timetal');
    }
    return { grantType, grantHours, weekdays, frameHours };
}

function assertActiveCaregivers(ids) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const count = db.prepare(`
        SELECT COUNT(*) AS count FROM caregivers
        WHERE id IN (${placeholders}) AND deleted_at IS NULL
    `).get(...ids).count;
    if (count !== ids.length) throw new ValidationError('En eller flere valgte barnepiger findes ikke');
}

function toPublicChild(child) {
    const result = { ...child };
    delete result.psp_element;
    return result;
}

function getExtraGrants(childId) {
    return db.prepare(`
        SELECT id, child_id, hours, from_date, to_date, grant_source,
               comment, granted_by, granted_at, created_at, updated_at
        FROM extra_grants
        WHERE child_id = ?
        ORDER BY from_date DESC, to_date DESC, COALESCE(granted_at, created_at) DESC, id DESC
    `).all(childId);
}

router.get('/', (req, res) => {
    try {
        const children = db.prepare(`
            SELECT c.*,
                   GROUP_CONCAT(cg.id) as caregiver_ids,
                   GROUP_CONCAT(cg.first_name || ' ' || cg.last_name) as caregiver_names
            FROM children c
            LEFT JOIN child_caregiver cc ON c.id = cc.child_id
            LEFT JOIN caregivers cg ON cc.caregiver_id = cg.id AND cg.deleted_at IS NULL
            WHERE c.deleted_at IS NULL
            GROUP BY c.id
            ORDER BY c.last_name, c.first_name
        `).all();

        res.json(children.map(child => ({
            ...toPublicChild(child),
            caregivers: child.caregiver_ids
                ? child.caregiver_ids.split(',').map((id, index) => ({
                    id: Number(id),
                    name: child.caregiver_names.split(',')[index]
                }))
                : [],
            grant_weekdays: child.grant_weekdays ? JSON.parse(child.grant_weekdays) : null,
            grantSummary: getGrantSummary(child.id),
            extraGrants: getExtraGrants(child.id)
        })));
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente børn');
    }
});

router.get('/:id', (req, res) => {
    try {
        const child = db.prepare('SELECT * FROM children WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        if (!child) return res.status(404).json({ error: 'Barn ikke fundet' });
        const caregivers = db.prepare(`
            SELECT cg.* FROM caregivers cg
            JOIN child_caregiver cc ON cg.id = cc.caregiver_id
            WHERE cc.child_id = ? AND cg.deleted_at IS NULL
        `).all(req.params.id);
        res.json({
            ...toPublicChild(child),
            grant_weekdays: child.grant_weekdays ? JSON.parse(child.grant_weekdays) : null,
            caregivers,
            grantSummary: getGrantSummary(child.id),
            extraGrants: getExtraGrants(child.id)
        });
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente barn');
    }
});

router.post('/', requirePermission(PERMISSIONS.MANAGE_CHILDREN), (req, res) => {
    try {
        const firstName = String(req.body.first_name ?? '').trim();
        const lastName = String(req.body.last_name ?? '').trim();
        if (!firstName || !lastName) throw new ValidationError('Fornavn og efternavn er påkrævet');
        if (req.body.birth_date) assertDate(req.body.birth_date, 'Fødselsdato');

        const caregiverIds = normalizeIdArray(req.body.caregiver_ids, 'Barnepiger');
        assertActiveCaregivers(caregiverIds);
        const grant = validateGrant(req.body);

        const childId = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO children (
                    first_name, last_name, birth_date, psp_element,
                    grant_type, grant_hours, grant_weekdays, has_frame_grant, frame_hours
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                firstName,
                lastName,
                req.body.birth_date || null,
                null,
                grant.grantType,
                grant.grantHours,
                grant.weekdays ? JSON.stringify(grant.weekdays) : null,
                req.body.has_frame_grant ? 1 : 0,
                grant.frameHours
            );
            const insertCaregiver = db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)');
            for (const caregiverId of caregiverIds) insertCaregiver.run(result.lastInsertRowid, caregiverId);
            return result.lastInsertRowid;
        })();

        const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
        res.status(201).json({
            ...toPublicChild(child),
            grant_weekdays: child.grant_weekdays ? JSON.parse(child.grant_weekdays) : null
        });
    } catch (error) {
        handleError(res, error, 'Kunne ikke oprette barn');
    }
});

router.put('/:id', requirePermission(PERMISSIONS.MANAGE_CHILDREN), (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM children WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Barn ikke fundet' });

        const firstName = String(req.body.first_name ?? existing.first_name).trim();
        const lastName = String(req.body.last_name ?? existing.last_name).trim();
        if (!firstName || !lastName) throw new ValidationError('Fornavn og efternavn er påkrævet');
        const birthDate = req.body.birth_date !== undefined ? req.body.birth_date : existing.birth_date;
        if (birthDate) assertDate(birthDate, 'Fødselsdato');
        const existingWeekdays = existing.grant_weekdays ? JSON.parse(existing.grant_weekdays) : null;
        const mergedGrant = {
            grant_type: req.body.grant_type ?? existing.grant_type,
            grant_hours: req.body.grant_hours ?? existing.grant_hours,
            grant_weekdays: req.body.grant_weekdays !== undefined ? req.body.grant_weekdays : existingWeekdays,
            has_frame_grant: req.body.has_frame_grant ?? Boolean(existing.has_frame_grant),
            frame_hours: req.body.frame_hours ?? existing.frame_hours
        };
        const grant = validateGrant(mergedGrant);
        const caregiverIds = req.body.caregiver_ids !== undefined
            ? normalizeIdArray(req.body.caregiver_ids, 'Barnepiger')
            : null;
        if (caregiverIds) assertActiveCaregivers(caregiverIds);

        db.transaction(() => {
            db.prepare(`
                UPDATE children SET
                    first_name = ?, last_name = ?, birth_date = ?, psp_element = ?,
                    grant_type = ?, grant_hours = ?, grant_weekdays = ?,
                    has_frame_grant = ?, frame_hours = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                firstName,
                lastName,
                birthDate || null,
                existing.psp_element,
                grant.grantType,
                grant.grantHours,
                grant.weekdays ? JSON.stringify(grant.weekdays) : null,
                mergedGrant.has_frame_grant ? 1 : 0,
                grant.frameHours,
                req.params.id
            );
            if (caregiverIds) {
                db.prepare('DELETE FROM child_caregiver WHERE child_id = ?').run(req.params.id);
                const insert = db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)');
                for (const caregiverId of caregiverIds) insert.run(req.params.id, caregiverId);
            }
        })();

        const child = db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id);
        res.json({
            ...toPublicChild(child),
            grant_weekdays: child.grant_weekdays ? JSON.parse(child.grant_weekdays) : null
        });
    } catch (error) {
        handleError(res, error, 'Kunne ikke opdatere barn');
    }
});

router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_CHILDREN), (req, res) => {
    try {
        const existing = db.prepare('SELECT id FROM children WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Barn ikke fundet' });
        db.prepare(`
            UPDATE children SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.id);
        res.json({ message: 'Barn arkiveret; historiske timeregistreringer er bevaret' });
    } catch (error) {
        handleError(res, error, 'Kunne ikke arkivere barn');
    }
});

export default router;
