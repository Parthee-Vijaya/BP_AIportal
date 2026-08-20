import db from '../db/database.js';
import { currentDataSource, DATA_SOURCES } from '../db/dataSource.js';

export const PERMISSIONS = Object.freeze({
    EXPORT_REPORTS: 'export_reports',
    MANAGE_GRANTS: 'manage_grants',
    MANAGE_CHILDREN: 'manage_children',
    MANAGE_CAREGIVERS: 'manage_caregivers',
    MANAGE_HOLIDAYS: 'manage_holidays',
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_PERMISSIONS: 'manage_permissions'
});

export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS));

export const ROLES = Object.freeze({
    APPROVER: 'approver',
    ADMINISTRATOR: 'administrator'
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const APPROVER_BASE_PERMISSIONS = Object.freeze([
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.MANAGE_GRANTS
]);

function effectivePermissions(approver, assignedPermissions) {
    if (approver.role === ROLES.ADMINISTRATOR) return [...PERMISSION_VALUES];
    return [...new Set([
        ...APPROVER_BASE_PERMISSIONS,
        ...assignedPermissions.filter(permission => permission !== PERMISSIONS.MANAGE_PERMISSIONS)
    ])].sort();
}

export function getApprover(id) {
    const approver = db.prepare(`
        SELECT * FROM approvers WHERE id = ? AND active = 1
    `).get(id);
    if (!approver) return null;
    const assignedPermissions = db.prepare(`
        SELECT permission FROM approver_permissions
        WHERE approver_id = ? ORDER BY permission
    `).all(approver.id).map(row => row.permission);
    return {
        ...approver,
        assigned_permissions: assignedPermissions,
        permissions: effectivePermissions(approver, assignedPermissions)
    };
}

export function findApproverByEmail(email) {
    if (!email) return null;
    const row = db.prepare(`
        SELECT id FROM approvers WHERE lower(email) = lower(?) AND active = 1
    `).get(String(email));
    return row ? getApprover(row.id) : null;
}

export function getRequestApprover(req) {
    // Rigtige data: profilen følger den loggede bruger (portal-SSO) — et
    // klientvalgt X-Approver-Id ignoreres. Demodata: profil-vælgeren i
    // headeren sender fortsat id'et.
    if (currentDataSource() === DATA_SOURCES.LIVE) {
        return findApproverByEmail(req.portalUser?.upn);
    }
    const rawId = req.get('X-Approver-Id') || req.query.approver_id;
    if (!/^\d+$/.test(String(rawId || ''))) return null;
    return getApprover(Number(rawId));
}

export function requirePermission(permission) {
    return (req, res, next) => {
        const approver = getRequestApprover(req);
        if (!approver) {
            // 403, ikke 401: brugeren ER logget ind i portalen (401 sender
            // browseren til login), men mangler en profil i appen.
            const error = currentDataSource() === DATA_SOURCES.LIVE
                ? 'Din bruger er ikke oprettet som godkender eller administrator'
                : 'Vælg en aktiv godkender- eller administratorprofil';
            return res.status(403).json({ error });
        }
        if (!approver.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Profilen har ikke rettighed til denne handling' });
        }
        req.approver = approver;
        next();
    };
}
