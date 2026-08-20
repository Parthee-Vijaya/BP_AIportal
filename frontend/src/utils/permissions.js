export const PERMISSIONS = Object.freeze({
    export_reports: 'Træk rapporter',
    manage_children: 'Administrer børn og bevillinger',
    manage_caregivers: 'Administrer barnepiger',
    manage_holidays: 'Ret helligdage',
    manage_settings: 'Ret beregningsindstillinger',
    manage_permissions: 'Tildel godkenderrettigheder'
});

export const hasPermission = (approver, permission) => (
    Boolean(approver?.permissions?.includes(permission))
);
