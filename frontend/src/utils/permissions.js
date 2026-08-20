export const PERMISSIONS = Object.freeze({
    export_reports: 'Træk rapporter',
    manage_grants: 'Rediger grund-, ramme- og ekstrabevillinger',
    manage_children: 'Administrer børns stamdata',
    manage_caregivers: 'Administrer barnepiger',
    manage_holidays: 'Ret helligdage',
    manage_settings: 'Ret beregningsindstillinger',
    manage_permissions: 'Administrer roller og rettigheder'
});

export const ROLES = Object.freeze({
    approver: 'Godkender',
    administrator: 'Administrator',
    caregiver: 'Barnepige'
});

export const APPROVER_BASE_PERMISSIONS = Object.freeze(['export_reports', 'manage_grants']);

export const OPTIONAL_APPROVER_PERMISSIONS = Object.freeze([
    'manage_children',
    'manage_caregivers',
    'manage_holidays',
    'manage_settings'
]);

export const hasPermission = (approver, permission) => (
    Boolean(approver?.permissions?.includes(permission))
);
