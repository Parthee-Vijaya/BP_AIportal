import { Router } from 'express';
import db from '../db/database.js';
import {
    getApprover,
    APPROVER_BASE_PERMISSIONS,
    PERMISSIONS,
    PERMISSION_VALUES,
    ROLES,
    ROLE_VALUES,
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

function validateRole(value) {
    const role = String(value || 'approver');
    if (!ROLE_VALUES.includes(role)) throw new ValidationError('Ugyldig brugerrolle');
    return role;
}

function assignedPermissionsForRole(permissions, role) {
    if (role === ROLES.ADMINISTRATOR) return [];
    return permissions.filter(permission => (
        !APPROVER_BASE_PERMISSIONS.includes(permission)
        && permission !== PERMISSIONS.MANAGE_PERMISSIONS
    ));
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
        const role = validateRole(req.body.role);
        const permissions = assignedPermissionsForRole(
            validatePermissions(req.body.assigned_permissions ?? req.body.permissions ?? []),
            role
        );
        const id = db.transaction(() => {
            const result = db.prepare('INSERT INTO approvers (name, email, role) VALUES (?, ?, ?)')
                .run(name, email, role);
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
        const role = validateRole(req.body.role ?? target.role);
        const permissions = assignedPermissionsForRole(
            validatePermissions(req.body.assigned_permissions ?? req.body.permissions ?? target.assigned_permissions),
            role
        );
        if (!name || !email) throw new ValidationError('Navn og e-mail er påkrævet');

        if (target.role === ROLES.ADMINISTRATOR && role !== ROLES.ADMINISTRATOR) {
            const otherAdmins = db.prepare(`
                SELECT COUNT(*) AS count
                FROM approvers
                WHERE role = ? AND active = 1 AND id != ?
            `).get(ROLES.ADMINISTRATOR, target.id).count;
            if (otherAdmins === 0) {
                throw new ValidationError('Mindst én aktiv administrator skal være tilbage');
            }
        }

        db.transaction(() => {
            db.prepare(`UPDATE approvers SET name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                .run(name, email, role, target.id);
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
