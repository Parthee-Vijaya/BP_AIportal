// Portal-session auth — appen har ikke sit eget login. Bag AI-portalen
// (Traefik, samme origin) sender browseren portalens `shield-session`-cookie
// med til /barnepige-app; cookien er et id_token fra portalens Entra ID-login.
// Vi verificerer det mod tenantens JWKS (audience = portalens client id) og
// kan derudover kræve medlemskab af en Entra-gruppe (BARNEPIGE_ENTRA_GROUP).
//
// Uden ENTRA_TENANT_ID + ENTRA_CLIENT_ID er auth slået fra (lokal udvikling):
// alle kald får en syntetisk udvikler-identitet, præcis som de andre
// portal-apps (KAIA/skabeloner-mønstret).

import { createRemoteJWKSet, jwtVerify } from 'jose';

const tenantId = process.env.ENTRA_TENANT_ID || '';
const audiences = [
    process.env.ENTRA_CLIENT_ID,
    process.env.BARNEPIGE_ENTRA_CLIENT_ID
].filter(Boolean);
const cookieName = process.env.SHIELD_SESSION_COOKIE || 'shield-session';
const requiredGroup = process.env.BARNEPIGE_ENTRA_GROUP || '';

// De fire AD/Entra-grupper der kommer til at styre appens roller
// ("Digitaliseringsportalen Barnepige timeregistrering - ..."). Sæt gruppernes
// object-id'er når de er oprettet; indtil da svarer resolveEntraRoles null
// for hver rolle, og frontendens demo-rolleskærm bruges i stedet.
const roleGroups = Object.freeze({
    access: process.env.BARNEPIGE_GROUP_ACCESS || '',
    bruger: process.env.BARNEPIGE_GROUP_BRUGER || '',
    godkender: process.env.BARNEPIGE_GROUP_GODKENDER || '',
    administrator: process.env.BARNEPIGE_GROUP_ADMINISTRATOR || ''
});

export const entraRolesConfigured = Object.values(roleGroups).some(Boolean);

// true/false pr. rolle når gruppens id er konfigureret, ellers null (= ukendt).
export function resolveEntraRoles(groups = []) {
    const roles = {};
    for (const [key, groupId] of Object.entries(roleGroups)) {
        roles[key] = groupId ? groups.includes(groupId) : null;
    }
    return roles;
}

export const authEnabled = Boolean(tenantId && audiences.length);

// Azure AD udsteder både v1- og v2-formede tokens — accepter begge issuers.
const allowedIssuers = [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`
];

const jwks = authEnabled
    ? createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    )
    : null;

function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) {
            try {
                return decodeURIComponent(part.slice(eq + 1).trim());
            } catch {
                return part.slice(eq + 1).trim();
            }
        }
    }
    return null;
}

function claimsToUser(claims) {
    return {
        upn: claims.preferred_username || claims.upn || 'unknown',
        name: claims.name || null,
        oid: claims.oid || null,
        groups: Array.isArray(claims.groups) ? claims.groups : [],
        // Entra udelader groups-claimet ved for mange medlemskaber ("overage")
        // og sætter en henvisning i _claim_names i stedet — vis det til debug.
        groupOverage: Boolean(claims._claim_names && claims._claim_names.groups)
    };
}

// Express-middleware: 401 hvis man ikke er logget ind i portalen,
// 403 hvis man er logget ind men ikke er i den krævede gruppe.
export async function requirePortalUser(req, res, next) {
    if (!authEnabled) {
        req.portalUser = {
            upn: 'dev@localhost',
            name: 'Udvikling (login slået fra)',
            oid: null,
            groups: [],
            groupOverage: false
        };
        return next();
    }

    const token = readCookie(req, cookieName);
    if (!token) {
        return res.status(401).json({ error: 'Du er ikke logget ind i AI-portalen' });
    }

    let claims;
    try {
        ({ payload: claims } = await jwtVerify(token, jwks, {
            algorithms: ['RS256'],
            audience: audiences,
            requiredClaims: ['exp', 'iat', 'aud', 'iss']
        }));
    } catch {
        return res.status(401).json({ error: 'Portal-login er udløbet eller ugyldigt' });
    }

    if (!allowedIssuers.includes(claims.iss)) {
        return res.status(401).json({ error: 'Portal-login er udløbet eller ugyldigt' });
    }

    if (requiredGroup && !(Array.isArray(claims.groups) && claims.groups.includes(requiredGroup))) {
        return res.status(403).json({ error: 'Du har ikke adgang til Barnepige Timer' });
    }

    req.portalUser = claimsToUser(claims);
    next();
}
