import { Router } from 'express';
import db from '../db/database.js';
import { Parser } from 'json2csv';
import { checkGrant, getGrantSummary } from '../services/grantCalculator.js';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';

const router = Router();

function sanitizeSpreadsheetValue(value) {
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
    return value;
}

function sanitizeSpreadsheetRows(rows) {
    return rows.map(row => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetValue(value)])
    ));
}

// GET /api/export/time-entries - Eksporter registreringer til CSV
router.get('/time-entries', requirePermission(PERMISSIONS.EXPORT_REPORTS), (req, res) => {
    try {
        const { status, child_id, caregiver_id, from_date, to_date, format } = req.query;

        let query = `
            SELECT
                te.id,
                te.child_id as _child_id,
                cg.first_name || ' ' || cg.last_name as barnepige,
                cg.ma_number as ma_nummer,
                c.first_name || ' ' || c.last_name as barn,
                te.date as dato,
                te.start_time as start_tid,
                te.end_time as slut_tid,
                te.normal_hours as normaltimer,
                te.evening_hours as aftentillaeg,
                te.night_hours as nattillaeg,
                te.saturday_hours as loerdagstillaeg,
                te.sunday_holiday_hours as soendags_helligdagstillaeg,
                te.total_hours as total_timer,
                te.calculation_version as beregningsversion,
                te.grant_source as bevillingskilde,
                te.comment as kommentar,
                te.status,
                te.submitted_at as indberettet,
                te.reviewed_by as godkendt_af,
                te.reviewed_at as godkendt_dato,
                te.rejection_reason as afvisningsaarsag,
                CASE WHEN te.payroll_registered = 1 THEN 'Ja' ELSE 'Nej' END as registreret_i_loensystem,
                te.payroll_date as loensystem_dato
            FROM time_entries te
            JOIN children c ON te.child_id = c.id
            JOIN caregivers cg ON te.caregiver_id = cg.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ` AND te.status = ?`;
            params.push(status);
        }

        if (child_id) {
            query += ` AND te.child_id = ?`;
            params.push(child_id);
        }

        if (caregiver_id) {
            query += ` AND te.caregiver_id = ?`;
            params.push(caregiver_id);
        }

        if (from_date) {
            query += ` AND te.date >= ?`;
            params.push(from_date);
        }

        if (to_date) {
            query += ` AND te.date <= ?`;
            params.push(to_date);
        }

        query += ` ORDER BY te.date DESC, te.start_time DESC`;

        const entries = db.prepare(query).all(...params);

        // Translate status
        const translatedEntries = entries.map(entry => {
            const grantStatus = checkGrant(entry._child_id, entry.dato, 0, {
                useFrameGrant: entry.bevillingskilde === 'frame'
            });
            const { _child_id, ...publicEntry } = entry;
            return {
                ...publicEntry,
                status: translateStatus(entry.status),
                ramme_grundtimer: grantStatus.isFrameGrant ? grantStatus.baseGrantHours : '',
                ramme_grundtimer_brugt: grantStatus.isFrameGrant ? grantStatus.baseUsedHours : '',
                ekstra_timer_tildelt: grantStatus.extraGrantHours || '',
                ekstra_timer_brugt: grantStatus.extraUsedHours || '',
                ekstra_timer_resterende: grantStatus.extraRemainingHours || '',
                ekstrabevillinger: grantStatus.extraGrants?.length
                    ? grantStatus.extraGrants.map(grant => (
                        `${grant.hours} t. givet ${grant.granted_at || grant.created_at} af ${grant.granted_by}`
                    )).join(' | ')
                    : ''
            };
        });

        if (format === 'json') {
            res.json(translatedEntries);
            return;
        }

        // CSV export
        const fields = [
            { label: 'ID', value: 'id' },
            { label: 'Barnepige', value: 'barnepige' },
            { label: 'MA-nummer', value: 'ma_nummer' },
            { label: 'Barn', value: 'barn' },
            { label: 'Dato', value: 'dato' },
            { label: 'Start tid', value: 'start_tid' },
            { label: 'Slut tid', value: 'slut_tid' },
            { label: 'Normaltimer', value: 'normaltimer' },
            { label: 'Aftentillæg', value: 'aftentillaeg' },
            { label: 'Nattillæg', value: 'nattillaeg' },
            { label: 'Lørdagstillæg', value: 'loerdagstillaeg' },
            { label: 'Søndags-/helligdagstillæg', value: 'soendags_helligdagstillaeg' },
            { label: 'Total timer', value: 'total_timer' },
            { label: 'Beregningsversion', value: 'beregningsversion' },
            { label: 'Bevillingskilde', value: 'bevillingskilde' },
            { label: 'Ramme grundtimer', value: 'ramme_grundtimer' },
            { label: 'Ramme grundtimer brugt', value: 'ramme_grundtimer_brugt' },
            { label: 'Ekstra timer tildelt', value: 'ekstra_timer_tildelt' },
            { label: 'Ekstra timer brugt', value: 'ekstra_timer_brugt' },
            { label: 'Ekstra timer resterende', value: 'ekstra_timer_resterende' },
            { label: 'Ekstrabevillinger (tildeling)', value: 'ekstrabevillinger' },
            { label: 'Kommentar', value: 'kommentar' },
            { label: 'Status', value: 'status' },
            { label: 'Indberettet', value: 'indberettet' },
            { label: 'Godkendt af', value: 'godkendt_af' },
            { label: 'Godkendt dato', value: 'godkendt_dato' },
            { label: 'Afvisningsårsag', value: 'afvisningsaarsag' },
            { label: 'Registreret i lønsystem', value: 'registreret_i_loensystem' },
            { label: 'Lønsystem dato', value: 'loensystem_dato' }
        ];

        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(sanitizeSpreadsheetRows(translatedEntries));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=timeregistreringer-${new Date().toISOString().split('T')[0]}.csv`);

        // Add BOM for Excel compatibility with Danish characters
        res.send('\ufeff' + csv);
    } catch (error) {
        console.error('Fejl ved eksport:', error);
        res.status(500).json({ error: 'Kunne ikke eksportere data' });
    }
});

// GET /api/export/children - Eksporter børn
router.get('/children', requirePermission(PERMISSIONS.EXPORT_REPORTS), (req, res) => {
    try {
        const children = db.prepare(`
            SELECT
                c.id,
                c.first_name as fornavn,
                c.last_name as efternavn,
                c.birth_date as foedselsdato,
                c.grant_type as bevillingstype,
                c.grant_hours as bevilling_timer,
                CASE WHEN c.has_frame_grant = 1 THEN 'Ja' ELSE 'Nej' END as rammebevilling,
                c.frame_hours as rammebevilling_timer,
                GROUP_CONCAT(cg.first_name || ' ' || cg.last_name, ', ') as tilknyttede_barnepiger
            FROM children c
            LEFT JOIN child_caregiver cc ON c.id = cc.child_id
            LEFT JOIN caregivers cg ON cc.caregiver_id = cg.id AND cg.deleted_at IS NULL
            WHERE c.deleted_at IS NULL
            GROUP BY c.id
            ORDER BY c.last_name, c.first_name
        `).all();

        // Translate grant type
        const translatedChildren = children.map(child => {
            const summary = getGrantSummary(child.id);
            return {
                ...child,
                bevillingstype: translateGrantType(child.bevillingstype),
                ekstra_timer_tildelt: summary?.allExtraGrantHours ?? summary?.extraGrantHours ?? '',
                ekstra_timer_brugt: summary?.allExtraUsedHours ?? summary?.extraUsedHours ?? '',
                ekstra_timer_resterende: summary?.allExtraRemainingHours ?? summary?.extraRemainingHours ?? '',
                ekstrabevillinger: [...(summary?.extraGrants || []), ...(summary?.normalGrantSummary?.extraGrants || [])].length
                    ? [...(summary?.extraGrants || []), ...(summary?.normalGrantSummary?.extraGrants || [])].map(grant => (
                        `${grant.hours} t. givet ${grant.granted_at || grant.created_at} af ${grant.granted_by}`
                    )).join(' | ')
                    : ''
            };
        });

        const { format } = req.query;
        if (format === 'json') {
            res.json(translatedChildren);
            return;
        }

        const fields = [
            { label: 'ID', value: 'id' },
            { label: 'Fornavn', value: 'fornavn' },
            { label: 'Efternavn', value: 'efternavn' },
            { label: 'Fødselsdato', value: 'foedselsdato' },
            { label: 'Bevillingstype', value: 'bevillingstype' },
            { label: 'Bevilling (timer)', value: 'bevilling_timer' },
            { label: 'Rammebevilling', value: 'rammebevilling' },
            { label: 'Rammebevilling (timer)', value: 'rammebevilling_timer' },
            { label: 'Ekstra timer tildelt', value: 'ekstra_timer_tildelt' },
            { label: 'Ekstra timer brugt', value: 'ekstra_timer_brugt' },
            { label: 'Ekstra timer resterende', value: 'ekstra_timer_resterende' },
            { label: 'Ekstrabevillinger (tildeling)', value: 'ekstrabevillinger' },
            { label: 'Tilknyttede barnepiger', value: 'tilknyttede_barnepiger' }
        ];

        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(sanitizeSpreadsheetRows(translatedChildren));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=boern-${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\ufeff' + csv);
    } catch (error) {
        console.error('Fejl ved eksport af børn:', error);
        res.status(500).json({ error: 'Kunne ikke eksportere børn' });
    }
});

function translateStatus(status) {
    const translations = {
        pending: 'Afventer godkendelse',
        approved: 'Godkendt',
        rejected: 'Afvist'
    };
    return translations[status] || status;
}

function translateGrantType(type) {
    const translations = {
        week: 'Uge',
        month: 'Måned',
        quarter: 'Kvartal',
        half_year: 'Halvår',
        year: 'År',
        specific_weekdays: 'Specifikke ugedage'
    };
    return translations[type] || type;
}

export default router;
