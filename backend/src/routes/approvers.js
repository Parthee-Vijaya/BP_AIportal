import { Router } from 'express';
import db from '../db/database.js';
import {
    getApprover,
    PERMISSIONS,
    PERMISSION_VALUES,
    requirePermission
} from '../services/permissions.js';
import { ValidationError, isValidationError } from '../utils/validation.js';

const router = Router();

function listApprovers() {
    return db.prepare('SELECT id FROM approvers WHERE active = 1 ORDER BY name').all()
        .map(row => getApprover(row.id));
}

function validatePermissions(value) {
    if (!Array.isArray(value)) throw new ValidationError('Rettigheder skal være en liste');
    const permissions = [...new Set(value.map(String))];
    if (permissions.some(permission => !PERMISSION_VALUES.includes(permission))) {
        throw new ValidationError('En eller flere rettigheder er ugyldige');
    }
    return permissions;
}

function handleError(res, error) {
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    console.error('Fejl ved godkenderadministration:', error);
    return res.status(500).json({ error: 'Kunne ikke administrere godkendere' });
}

router.get('/', (req, res) => res.json(listApprovers()));

router.get('/permissions', (req, res) => res.json(PERMISSION_VALUES));

router.post('/', requirePermission(PERMISSIONS.MANAGE_PERMISSIONS), (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!name || !email) throw new ValidationError('Navn og e-mail er påkrævet');
        const permissions = validatePermissions(req.body.permissions || []);
        const id = db.transaction(() => {
            const result = db.prepare('INSERT INTO approvers (name, email) VALUES (?, ?)').run(name, email);
            const insert = db.prepare(`
                INSERT INTO approver_permissions (approver_id, permission, granted_by)
                VALUES (?, ?, ?)
            `);
            for (const permission of permissions) insert.run(result.lastInsertRowid, permission, req.approver.name);
            return Number(result.lastInsertRowid);
        })();
        res.status(201).json(getApprover(id));
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) return res.status(400).json({ error: 'E-mailen bruges allerede' });
        handleError(res, error);
    }
});

router.put('/:id', requirePermission(PERMISSIONS.MANAGE_PERMISSIONS), (req, res) => {
    try {
        const target = getApprover(Number(req.params.id));
        if (!target) return res.status(404).json({ error: 'Godkender ikke fundet' });
        const name = String(req.body.name ?? target.name).trim();
        const email = String(req.body.email ?? target.email).trim().toLowerCase();
        const permissions = validatePermissions(req.body.permissions ?? target.permissions);
        if (!name || !email) throw new ValidationError('Navn og e-mail er påkrævet');

        if (target.permissions.includes(PERMISSIONS.MANAGE_PERMISSIONS)
            && !permissions.includes(PERMISSIONS.MANAGE_PERMISSIONS)) {
            const otherAdmins = db.prepare(`
                SELECT COUNT(*) AS count
                FROM approver_permissions ap
                JOIN approvers a ON a.id = ap.approver_id
                WHERE ap.permission = ? AND a.active = 1 AND a.id != ?
            `).get(PERMISSIONS.MANAGE_PERMISSIONS, target.id).count;
            if (otherAdmins === 0) {
                throw new ValidationError('Mindst én godkender skal kunne tildele rettigheder');
            }
        }

        db.transaction(() => {
            db.prepare(`UPDATE approvers SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(name, email, target.id);
            db.prepare('DELETE FROM approver_permissions WHERE approver_id = ?').run(target.id);
            const insert = db.prepare(`
                INSERT INTO approver_permissions (approver_id, permission, granted_by)
                VALUES (?, ?, ?)
            `);
            for (const permission of permissions) insert.run(target.id, permission, req.approver.name);
        })();
        res.json(getApprover(target.id));
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) return res.status(400).json({ error: 'E-mailen bruges allerede' });
        handleError(res, error);
    }
});

export default router;
