import db from '../db/database.js';

export const PERMISSIONS = Object.freeze({
    EXPORT_REPORTS: 'export_reports',
    MANAGE_CHILDREN: 'manage_children',
    MANAGE_CAREGIVERS: 'manage_caregivers',
    MANAGE_HOLIDAYS: 'manage_holidays',
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_PERMISSIONS: 'manage_permissions'
});

export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS));

export function getApprover(id) {
    const approver = db.prepare(`
        SELECT * FROM approvers WHERE id = ? AND active = 1
    `).get(id);
    if (!approver) return null;
    return {
        ...approver,
        permissions: db.prepare(`
            SELECT permission FROM approver_permissions
            WHERE approver_id = ? ORDER BY permission
        `).all(approver.id).map(row => row.permission)
    };
}

export function getRequestApprover(req) {
    const rawId = req.get('X-Approver-Id') || req.query.approver_id;
    if (!/^\d+$/.test(String(rawId || ''))) return null;
    return getApprover(Number(rawId));
}

export function requirePermission(permission) {
    return (req, res, next) => {
        const approver = getRequestApprover(req);
        if (!approver) return res.status(401).json({ error: 'Vælg en aktiv godkenderprofil' });
        if (!approver.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Godkenderen har ikke rettighed til denne handling' });
        }
        req.approver = approver;
        next();
    };
}
