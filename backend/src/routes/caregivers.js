import { Router } from 'express';
import db from '../db/database.js';
import { getGrantSummary } from '../services/grantCalculator.js';
import {
    isValidationError,
    normalizeIdArray,
    normalizeMaNumber,
    ValidationError
} from '../utils/validation.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';

const router = Router();

function handleError(res, error, fallback) {
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
}

function assertActiveChildren(ids) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const count = db.prepare(`
        SELECT COUNT(*) AS count FROM children
        WHERE id IN (${placeholders}) AND deleted_at IS NULL
    `).get(...ids).count;
    if (count !== ids.length) throw new ValidationError('Et eller flere valgte børn findes ikke');
}

function findDuplicateMaNumber(maNumber, excludedId = null) {
    return db.prepare('SELECT id, ma_number FROM caregivers').all().find(caregiver => {
        if (excludedId != null && caregiver.id === Number(excludedId)) return false;
        const normalized = String(caregiver.ma_number).replace(/\D/g, '').padStart(8, '0');
        return normalized === maNumber;
    });
}

router.get('/', (req, res) => {
    try {
        const caregivers = db.prepare(`
            SELECT cg.*,
                   GROUP_CONCAT(c.id) as child_ids,
                   GROUP_CONCAT(c.first_name || ' ' || c.last_name) as child_names
            FROM caregivers cg
            LEFT JOIN child_caregiver cc ON cg.id = cc.caregiver_id
            LEFT JOIN children c ON cc.child_id = c.id AND c.deleted_at IS NULL
            WHERE cg.deleted_at IS NULL
            GROUP BY cg.id
            ORDER BY cg.last_name, cg.first_name
        `).all();

        res.json(caregivers.map(caregiver => ({
            ...caregiver,
            children: caregiver.child_ids
                ? caregiver.child_ids.split(',').map((id, index) => ({
                    id: Number(id),
                    name: caregiver.child_names.split(',')[index]
                }))
                : []
        })));
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente barnepiger');
    }
});

router.get('/:id', (req, res) => {
    try {
        const caregiver = db.prepare(`
            SELECT * FROM caregivers WHERE id = ? AND deleted_at IS NULL
        `).get(req.params.id);
        if (!caregiver) return res.status(404).json({ error: 'Barnepige ikke fundet' });
        const children = db.prepare(`
            SELECT c.* FROM children c
            JOIN child_caregiver cc ON c.id = cc.child_id
            WHERE cc.caregiver_id = ? AND c.deleted_at IS NULL
        `).all(req.params.id).map(child => {
            const result = { ...child };
            delete result.psp_element;
            return {
                ...result,
                grant_weekdays: child.grant_weekdays ? JSON.parse(child.grant_weekdays) : null,
                grantSummary: getGrantSummary(child.id)
            };
        });
        res.json({ ...caregiver, children });
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente barnepige');
    }
});

router.post('/', requirePermission(PERMISSIONS.MANAGE_CAREGIVERS), (req, res) => {
    try {
        const firstName = String(req.body.first_name ?? '').trim();
        const lastName = String(req.body.last_name ?? '').trim();
        if (!firstName || !lastName) throw new ValidationError('Fornavn og efternavn er påkrævet');
        const maNumber = normalizeMaNumber(req.body.ma_number);
        const duplicate = findDuplicateMaNumber(maNumber);
        if (duplicate) throw new ValidationError('MA-nummer findes allerede');
        const childIds = normalizeIdArray(req.body.child_ids, 'Børn');
        assertActiveChildren(childIds);

        const caregiverId = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO caregivers (first_name, last_name, ma_number) VALUES (?, ?, ?)
            `).run(firstName, lastName, maNumber);
            const insert = db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)');
            for (const childId of childIds) insert.run(childId, result.lastInsertRowid);
            return result.lastInsertRowid;
        })();
        res.status(201).json(db.prepare('SELECT * FROM caregivers WHERE id = ?').get(caregiverId));
    } catch (error) {
        handleError(res, error, 'Kunne ikke oprette barnepige');
    }
});

router.put('/:id', requirePermission(PERMISSIONS.MANAGE_CAREGIVERS), (req, res) => {
    try {
        const existing = db.prepare(`
            SELECT * FROM caregivers WHERE id = ? AND deleted_at IS NULL
        `).get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Barnepige ikke fundet' });

        const firstName = String(req.body.first_name ?? existing.first_name).trim();
        const lastName = String(req.body.last_name ?? existing.last_name).trim();
        if (!firstName || !lastName) throw new ValidationError('Fornavn og efternavn er påkrævet');
        const maNumber = req.body.ma_number !== undefined
            ? normalizeMaNumber(req.body.ma_number)
            : existing.ma_number;
        const duplicate = findDuplicateMaNumber(maNumber, req.params.id);
        if (duplicate) throw new ValidationError('MA-nummer bruges allerede af en anden barnepige');

        const childIds = req.body.child_ids !== undefined
            ? normalizeIdArray(req.body.child_ids, 'Børn')
            : null;
        if (childIds) assertActiveChildren(childIds);

        db.transaction(() => {
            db.prepare(`
                UPDATE caregivers SET first_name = ?, last_name = ?, ma_number = ?,
                    updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(firstName, lastName, maNumber, req.params.id);
            if (childIds) {
                db.prepare('DELETE FROM child_caregiver WHERE caregiver_id = ?').run(req.params.id);
                const insert = db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)');
                for (const childId of childIds) insert.run(childId, req.params.id);
            }
        })();
        res.json(db.prepare('SELECT * FROM caregivers WHERE id = ?').get(req.params.id));
    } catch (error) {
        handleError(res, error, 'Kunne ikke opdatere barnepige');
    }
});

router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_CAREGIVERS), (req, res) => {
    try {
        const existing = db.prepare(`
            SELECT id FROM caregivers WHERE id = ? AND deleted_at IS NULL
        `).get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Barnepige ikke fundet' });
        db.prepare(`
            UPDATE caregivers SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.id);
        res.json({ message: 'Barnepige arkiveret; historiske timeregistreringer er bevaret' });
    } catch (error) {
        handleError(res, error, 'Kunne ikke arkivere barnepige');
    }
});

export default router;
