// De fire AD/Entra-roller der kommer til at styre adgangen til appen.
// Indtil grupperne findes i Entra ID, vælger man dem på demo-rolleskærmen —
// valget gemmes lokalt i browseren, så det kun gælder én selv.

export const ENTRA_ROLE_DEFS = Object.freeze([
    {
        key: 'access',
        number: 1,
        label: 'Adgang til app',
        groupName: 'Digitaliseringsportalen Barnepige timeregistrering - adgang til app',
        effect: 'Uden denne rolle ser man kun en "ingen adgang"-side.'
    },
    {
        key: 'bruger',
        number: 2,
        label: 'Brugere',
        groupName: 'Digitaliseringsportalen Barnepige timeregistrering - Brugere',
        effect: 'Barnepige-visningen: registrer timer og se egne registreringer.'
    },
    {
        key: 'administrator',
        number: 3,
        label: 'Administrator',
        groupName: 'Digitaliseringsportalen Barnepige timeregistrering - Administrator',
        effect: 'Administrator-visningen: børn, barnepiger, bevillinger, helligdage, roller og rettigheder.'
    },
    {
        key: 'godkender',
        number: 4,
        label: 'Godkender',
        groupName: 'Digitaliseringsportalen Barnepige timeregistrering - Godkender',
        effect: 'Godkender-visningen: gennemgå og godkend/afvis registrerede timer.'
    }
]);

export const ALL_ROLE_KEYS = Object.freeze(ENTRA_ROLE_DEFS.map(def => def.key));

const STORAGE_KEY = 'bpDemoEntraRoles';

// null = der er aldrig valgt roller (vis demo-rolleskærmen først).
export function loadDemoRoles() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter(key => ALL_ROLE_KEYS.includes(key));
    } catch {
        return null;
    }
}

export function saveDemoRoles(roleKeys) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roleKeys));
}

// Hvilke visninger i appen giver rollerne adgang til (rækkefølge = prioritet
// for hvor man lander efter login).
export function viewsForRoles(roleKeys) {
    const views = [];
    if (roleKeys.includes('administrator')) views.push('administrator');
    if (roleKeys.includes('godkender')) views.push('approver');
    if (roleKeys.includes('bruger')) views.push('caregiver');
    return views;
}
