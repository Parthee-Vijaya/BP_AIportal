/**
 * Bevillingsberegning for Barnepige Timeregistrering
 *
 * REGLER:
 * - Bevilling er ALTID pr. barn, uanset antal barnepiger
 * - Både GODKENDTE og AFVENTER GODKENDELSE timer tælles med
 * - Ekstrabevillinger lægges oven på den valgte normale bevilling eller rammebevilling
 *
 * BEVILLINGSPERIODER:
 * - Uge: Mandag → Søndag
 * - Måned: Bruger month_interval_history (fx d. 16 – d. 15); kalendermåned hvis ingen historik
 * - Kvartal: Q1 (01/01-31/03), Q2 (01/04-30/06), Q3 (01/07-30/09), Q4 (01/10-31/12)
 * - Halvår: H1 (01/01-30/06), H2 (01/07-31/12)
 * - År: 01/01 → 31/12
 * - Specifikke ugedage: Timer pr. ugedag, hver uge (kun valgte dage tilladt)
 */

import db from '../db/database.js';
import { assertDate, ValidationError } from '../utils/validation.js';

const HOUR_DECIMALS = 2;
const COMPARISON_EPSILON = 1e-9;

function dateFromString(dateStr) {
    assertDate(dateStr);
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function roundHours(value) {
    const factor = 10 ** HOUR_DECIMALS;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function nonNegativeHours(value, label) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0) {
        throw new ValidationError(`${label} skal være 0 eller et positivt tal`);
    }
    return roundHours(hours);
}

function buildGrantStatus({ grantType, grantHours, extraGrantHours, usedHours, newHours, period, extra = {} }) {
    const baseHours = nonNegativeHours(grantHours, 'Bevillingstimer');
    const additionalHours = nonNegativeHours(extraGrantHours, 'Ekstrabevillingstimer');
    const used = nonNegativeHours(usedHours, 'Forbrugte timer');
    const incoming = nonNegativeHours(newHours, 'Nye timer');
    const effective = roundHours(baseHours + additionalHours);
    const totalAfterNew = roundHours(used + incoming);
    const exceededBy = roundHours(Math.max(0, totalAfterNew - effective));
    const exceeded = totalAfterNew - effective > COMPARISON_EPSILON;

    return {
        valid: !exceeded,
        grantType,
        grantHours: baseHours,
        extraGrantHours: additionalHours,
        effectiveGrantHours: effective,
        usedHours: used,
        remainingHours: roundHours(Math.max(0, effective - used)),
        projectedRemainingHours: roundHours(Math.max(0, effective - totalAfterNew)),
        newHours: incoming,
        totalAfterNew,
        exceeded,
        exceededBy,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        ...extra
    };
}

/**
 * Få start og slut dato for en bevillingsperiode
 * @param {string} grantType - Bevillingstype
 * @param {string} dateStr - Reference dato (YYYY-MM-DD)
 * @returns {Object} - { startDate, endDate }
 */
export function getGrantPeriod(grantType, dateStr) {
    const date = dateFromString(dateStr);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const dayOfWeek = date.getUTCDay(); // 0 = søndag

    switch (grantType) {
        case 'week': {
            // Mandag til søndag
            const monday = new Date(date);
            // Hvis søndag (0), gå 6 dage tilbage, ellers gå (dag-1) dage tilbage
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            monday.setUTCDate(date.getUTCDate() - daysToMonday);

            const sunday = new Date(monday);
            sunday.setUTCDate(monday.getUTCDate() + 6);

            return {
                startDate: formatDate(monday),
                endDate: formatDate(sunday)
            };
        }

        case 'month': {
            const interval = getMonthIntervalForDate(dateStr);
            return getCustomMonthPeriod(dateStr, interval.start_day, interval.end_day);
        }

        case 'quarter': {
            const quarter = Math.floor(month / 3);
            const quarterStarts = [
                { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 2, 31)) },   // Q1
                { start: new Date(Date.UTC(year, 3, 1)), end: new Date(Date.UTC(year, 5, 30)) },   // Q2
                { start: new Date(Date.UTC(year, 6, 1)), end: new Date(Date.UTC(year, 8, 30)) },   // Q3
                { start: new Date(Date.UTC(year, 9, 1)), end: new Date(Date.UTC(year, 11, 31)) }   // Q4
            ];
            return {
                startDate: formatDate(quarterStarts[quarter].start),
                endDate: formatDate(quarterStarts[quarter].end)
            };
        }

        case 'half_year': {
            if (month < 6) {
                return {
                    startDate: `${year}-01-01`,
                    endDate: `${year}-06-30`
                };
            } else {
                return {
                    startDate: `${year}-07-01`,
                    endDate: `${year}-12-31`
                };
            }
        }

        case 'year': {
            return {
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`
            };
        }

        case 'specific_weekdays': {
            // For specifikke ugedage returneres ugen som periode
            // (beregningen pr. dag håndteres separat)
            const monday = new Date(date);
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            monday.setUTCDate(date.getUTCDate() - daysToMonday);

            const sunday = new Date(monday);
            sunday.setUTCDate(monday.getUTCDate() + 6);

            return {
                startDate: formatDate(monday),
                endDate: formatDate(sunday)
            };
        }

        default:
            throw new Error(`Ukendt bevillingstype: ${grantType}`);
    }
}

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createClampedDate(year, month, requestedDay) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(requestedDay, lastDay)));
}

/**
 * Et månedsinterval skal dække alle datoer præcis én gang.
 * Derfor understøttes kalendermåned (1-31) eller en forskudt måned, hvor
 * slutdagen er dagen før startdagen (fx 16-15). Start 29-31 afvises, da
 * korte måneder ellers giver overlappende perioder.
 */
export function validateMonthInterval(startDay, endDay) {
    const start = Number(startDay);
    const end = Number(endDay);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new ValidationError('Start- og slutdag skal være hele tal');
    }
    if (start === 1 && end === 31) return { startDay: start, endDay: end };
    if (start < 2 || start > 28 || end !== start - 1) {
        throw new ValidationError('Vælg 1-31 eller en sammenhængende forskudt måned, fx 16-15 (startdag 2-28)');
    }
    return { startDay: start, endDay: end };
}

/**
 * Hent det aktive månedsinterval for en dato (fra month_interval_history).
 * Returnerer { start_day, end_day } eller null for standard 1–31.
 */
function getMonthIntervalForDate(dateStr) {
    const row = db.prepare(`
        SELECT start_day, end_day FROM month_interval_history
        WHERE effective_from <= ?
        ORDER BY effective_from DESC
        LIMIT 1
    `).get(dateStr);
    if (!row) return { start_day: 1, end_day: 31 };
    return { start_day: row.start_day, end_day: row.end_day };
}

/**
 * Beregn start- og slutdato for en månedsperiode med brugerdefineret interval.
 * Eksempel: start_day=16, end_day=15 → 16. jan–15. feb, 16. feb–15. mar osv.
 */
function getCustomMonthPeriod(dateStr, startDay, endDay) {
    const interval = validateMonthInterval(startDay, endDay);
    const date = dateFromString(dateStr);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-indexed
    const day = date.getUTCDate();

    if (interval.startDay === 1) {
        const startDate = createClampedDate(year, month, 1);
        const endDate = createClampedDate(year, month, 31);
        return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
    }

    // Perioden spænder over to kalendermåneder (fx 16–15)
    if (day <= interval.endDay) {
        // Vi er i den del der slutter denne måned (fx 1–15. feb)
        const endDate = createClampedDate(year, month, interval.endDay);
        const startDate = createClampedDate(year, month - 1, interval.startDay);
        return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
    } else {
        // Vi er i den del der starter denne måned (fx 16–28. feb)
        const startDate = createClampedDate(year, month, interval.startDay);
        const endDate = createClampedDate(year, month + 1, interval.endDay);
        return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
    }
}

// Ugedagsnavne til database queries
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Sum ekstrabevillingstimer for et barn på en dato (fra-dato <= dateStr <= til-dato).
 */
function getActiveExtraGrants(childId, dateStr, grantSource = 'normal') {
    if (!['normal', 'frame'].includes(grantSource)) throw new ValidationError('Ugyldig bevillingskilde');
    return db.prepare(`
        SELECT id, child_id, hours, from_date, to_date, comment,
               grant_source, granted_by, granted_at, created_at, updated_at
        FROM extra_grants
        WHERE child_id = ? AND grant_source = ? AND ? >= from_date AND ? <= to_date
        ORDER BY COALESCE(granted_at, created_at) ASC, id ASC
    `).all(childId, grantSource, dateStr, dateStr);
}

function allocateExtraGrantUsage(grants, usedHours) {
    let hoursToAllocate = roundHours(Math.max(0, usedHours));
    return grants.map(grant => {
        const hours = roundHours(grant.hours);
        const used = roundHours(Math.min(hours, hoursToAllocate));
        hoursToAllocate = roundHours(Math.max(0, hoursToAllocate - used));
        return {
            ...grant,
            hours,
            usedHours: used,
            remainingHours: roundHours(hours - used)
        };
    });
}

/**
 * Beregn forbrugte timer for et barn i en periode
 * @param {number} childId - Barn ID
 * @param {string} startDate - Start dato (YYYY-MM-DD)
 * @param {string} endDate - Slut dato (YYYY-MM-DD)
 * @param {string} specificWeekday - Valgfri: specifik ugedag at filtrere på
 * @param {'normal'|'frame'} grantSource - Den valgte bevillingspulje
 * @returns {number} - Total timer
 */
export function getUsedHours(childId, startDate, endDate, specificWeekday = null, grantSource = 'normal') {
    assertDate(startDate, 'Startdato');
    assertDate(endDate, 'Slutdato');
    if (startDate > endDate) throw new ValidationError('Startdato skal ligge før eller på slutdato');
    if (!['normal', 'frame'].includes(grantSource)) throw new ValidationError('Ugyldig bevillingskilde');
    let query = `
        SELECT COALESCE(SUM(total_hours), 0) as total
        FROM time_entries
        WHERE child_id = ?
        AND date >= ?
        AND date <= ?
        AND status IN ('pending', 'approved')
        AND grant_source = ?
    `;

    const params = [childId, startDate, endDate, grantSource];

    // Filtrer på specifik ugedag hvis angivet
    if (specificWeekday !== null) {
        // SQLite's strftime('%w', date) returnerer 0-6 (0 = søndag)
        const weekdayIndex = WEEKDAY_NAMES.indexOf(specificWeekday);
        if (weekdayIndex === -1) throw new ValidationError('Ugyldig ugedag');
        query += ` AND CAST(strftime('%w', date) AS INTEGER) = ?`;
        params.push(weekdayIndex);
    }

    const result = db.prepare(query).get(...params);
    return roundHours(result.total || 0);
}

/**
 * Tjek bevilling for et barn på en given dato
 * @param {number} childId - Barn ID
 * @param {string} dateStr - Dato at tjekke (YYYY-MM-DD)
 * @param {number} newHours - Nye timer der skal registreres
 * @param {Object} options
 * @param {boolean} options.useFrameGrant - Eksplicit valg fra registreringsflowet
 * @returns {Object} - Bevillingsstatus
 */
export function checkGrant(childId, dateStr, newHours = 0, { useFrameGrant } = {}) {
    assertDate(dateStr);
    const incomingHours = nonNegativeHours(newHours, 'Nye timer');
    // Hent barn data
    const child = db.prepare(`
        SELECT * FROM children WHERE id = ? AND deleted_at IS NULL
    `).get(childId);

    if (!child) {
        return {
            valid: false,
            error: 'Barn ikke fundet'
        };
    }

    // Ved eksplicit valg respekteres brugerens valgte bevillingskilde.
    if (useFrameGrant === true && !child.has_frame_grant) {
        return {
            valid: false,
            exceeded: true,
            error: 'Barnet har ikke en aktiv rammebevilling'
        };
    }

    // Uden eksplicit valg bevares den hidtidige standard til oversigtsvisninger.
    if (useFrameGrant === true || (useFrameGrant == null && child.has_frame_grant)) {
        return checkFrameGrant(child, dateStr, incomingHours);
    }

    // Håndter specifikke ugedage
    if (child.grant_type === 'specific_weekdays') {
        return checkSpecificWeekdayGrant(child, dateStr, incomingHours);
    }

    const period = getGrantPeriod(child.grant_type, dateStr);
    const usedHours = getUsedHours(childId, period.startDate, period.endDate, null, 'normal');
    const extraGrants = getActiveExtraGrants(child.id, dateStr, 'normal');
    const extraHours = roundHours(extraGrants.reduce((sum, grant) => sum + Number(grant.hours), 0));
    const baseGrantHours = roundHours(child.grant_hours);
    const extraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours - baseGrantHours)));
    const projectedExtraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours + incomingHours - baseGrantHours)));

    return buildGrantStatus({
        grantType: child.grant_type,
        grantHours: baseGrantHours,
        extraGrantHours: extraHours,
        usedHours,
        newHours: incomingHours,
        period,
        extra: {
            baseGrantHours,
            baseUsedHours: roundHours(Math.min(usedHours, baseGrantHours)),
            baseRemainingHours: roundHours(Math.max(0, baseGrantHours - usedHours)),
            extraUsedHours,
            extraRemainingHours: roundHours(Math.max(0, extraHours - extraUsedHours)),
            projectedExtraUsedHours,
            projectedExtraRemainingHours: roundHours(Math.max(0, extraHours - projectedExtraUsedHours)),
            newHoursFromExtra: roundHours(Math.max(0, projectedExtraUsedHours - extraUsedHours)),
            extraGrants: allocateExtraGrantUsage(extraGrants, extraUsedHours)
        }
    });
}

/**
 * Tjek rammebevilling (årlig, overruler normal bevilling)
 */
function checkFrameGrant(child, dateStr, newHours) {
    const date = dateFromString(dateStr);
    const year = date.getUTCFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const extraGrants = getActiveExtraGrants(child.id, dateStr, 'frame');
    const extraHours = roundHours(extraGrants.reduce((sum, grant) => sum + Number(grant.hours), 0));
    const usedHours = getUsedHours(child.id, startDate, endDate, null, 'frame');
    const baseGrantHours = roundHours(child.frame_hours);
    const baseUsedHours = roundHours(Math.min(usedHours, baseGrantHours));
    const extraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours - baseGrantHours)));
    const projectedUsedHours = roundHours(usedHours + newHours);
    const projectedExtraUsedHours = roundHours(Math.min(
        extraHours,
        Math.max(0, projectedUsedHours - baseGrantHours)
    ));

    return buildGrantStatus({
        grantType: 'frame_grant',
        grantHours: baseGrantHours,
        extraGrantHours: extraHours,
        usedHours,
        newHours,
        period: { startDate, endDate },
        extra: {
            isFrameGrant: true,
            baseGrantHours,
            baseUsedHours,
            baseRemainingHours: roundHours(Math.max(0, baseGrantHours - usedHours)),
            extraUsedHours,
            extraRemainingHours: roundHours(Math.max(0, extraHours - extraUsedHours)),
            projectedExtraUsedHours,
            projectedExtraRemainingHours: roundHours(Math.max(0, extraHours - projectedExtraUsedHours)),
            newHoursFromExtra: roundHours(Math.max(0, projectedExtraUsedHours - extraUsedHours)),
            extraGrants: allocateExtraGrantUsage(extraGrants, extraUsedHours)
        }
    });
}

/**
 * Tjek bevilling for specifikke ugedage
 */
function checkSpecificWeekdayGrant(child, dateStr, newHours) {
    const date = dateFromString(dateStr);
    const dayOfWeek = date.getUTCDay();
    const weekdayName = WEEKDAY_NAMES[dayOfWeek];

    // Parse ugedags-bevilling
    let weekdayGrants = {};
    try {
        weekdayGrants = JSON.parse(child.grant_weekdays || '{}');
    } catch (e) {
        return {
            valid: false,
            error: 'Ugyldig ugedags-konfiguration'
        };
    }

    // Tjek om denne ugedag er tilladt
    const configuredHours = Number(weekdayGrants[weekdayName]);
    if (!(weekdayName in weekdayGrants) || !Number.isFinite(configuredHours) || configuredHours <= 0) {
        return {
            valid: false,
            exceeded: true,
            error: `Registrering ikke tilladt på ${translateWeekday(weekdayName)}`,
            grantType: 'specific_weekdays',
            allowedDays: Object.keys(weekdayGrants).filter(d => weekdayGrants[d] > 0).map(translateWeekday)
        };
    }

    // Hent periodens start/slut (ugen)
    const period = getGrantPeriod('specific_weekdays', dateStr);

    // Beregn forbrugte timer for denne specifikke ugedag i denne uge.
    const grantHours = configuredHours;
    const usedHours = getUsedHours(child.id, period.startDate, period.endDate, weekdayName, 'normal');
    const extraGrants = getActiveExtraGrants(child.id, dateStr, 'normal');
    const extraHours = roundHours(extraGrants.reduce((sum, grant) => sum + Number(grant.hours), 0));
    const extraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours - grantHours)));
    const projectedExtraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours + newHours - grantHours)));

    return buildGrantStatus({
        grantType: 'specific_weekdays',
        grantHours,
        extraGrantHours: extraHours,
        usedHours,
        newHours,
        period,
        extra: {
            weekday: weekdayName,
            weekdayDanish: translateWeekday(weekdayName),
            allWeekdayGrants: weekdayGrants,
            baseGrantHours: grantHours,
            baseUsedHours: roundHours(Math.min(usedHours, grantHours)),
            baseRemainingHours: roundHours(Math.max(0, grantHours - usedHours)),
            extraUsedHours,
            extraRemainingHours: roundHours(Math.max(0, extraHours - extraUsedHours)),
            projectedExtraUsedHours,
            projectedExtraRemainingHours: roundHours(Math.max(0, extraHours - projectedExtraUsedHours)),
            newHoursFromExtra: roundHours(Math.max(0, projectedExtraUsedHours - extraUsedHours)),
            extraGrants: allocateExtraGrantUsage(extraGrants, extraUsedHours)
        }
    });
}

function translateWeekday(weekday) {
    const translations = {
        monday: 'Mandag',
        tuesday: 'Tirsdag',
        wednesday: 'Onsdag',
        thursday: 'Torsdag',
        friday: 'Fredag',
        saturday: 'Lørdag',
        sunday: 'Søndag'
    };
    return translations[weekday] || weekday;
}

/**
 * Få samlet bevillingsoversigt for et barn
 */
export function getGrantSummary(childId) {
    const child = db.prepare(`
        SELECT * FROM children WHERE id = ? AND deleted_at IS NULL
    `).get(childId);

    if (!child) {
        return null;
    }

    const today = formatDate(new Date());

    if (child.has_frame_grant) {
        const frameSummary = checkFrameGrant(child, today, 0);
        const normalSummary = checkGrant(childId, today, 0, { useFrameGrant: false });
        return {
            ...frameSummary,
            normalGrantSummary: normalSummary,
            allExtraGrantHours: roundHours(frameSummary.extraGrantHours + (normalSummary.extraGrantHours || 0)),
            allExtraUsedHours: roundHours(frameSummary.extraUsedHours + (normalSummary.extraUsedHours || 0)),
            allExtraRemainingHours: roundHours(frameSummary.extraRemainingHours + (normalSummary.extraRemainingHours || 0))
        };
    }

    if (child.grant_type === 'specific_weekdays') {
        // Returner oversigt for alle ugedage
        let weekdayGrants = {};
        try {
            weekdayGrants = JSON.parse(child.grant_weekdays || '{}');
        } catch (e) {
            return null;
        }

        const period = getGrantPeriod('specific_weekdays', today);
        const summary = {
            grantType: 'specific_weekdays',
            periodStart: period.startDate,
            periodEnd: period.endDate,
            weekdays: {},
            extraGrantHours: 0,
            extraUsedHours: 0,
            extraRemainingHours: 0,
            extraGrants: []
        };

        for (const [weekday, hours] of Object.entries(weekdayGrants)) {
            if (hours > 0) {
                const effectiveHours = roundHours(Number(hours));
                const usedHours = getUsedHours(childId, period.startDate, period.endDate, weekday, 'normal');
                const weekdayIndex = WEEKDAY_NAMES.indexOf(weekday);
                const periodStart = dateFromString(period.startDate);
                const startIndex = periodStart.getUTCDay();
                const daysForward = (weekdayIndex - startIndex + 7) % 7;
                const weekdayDate = new Date(periodStart);
                weekdayDate.setUTCDate(periodStart.getUTCDate() + daysForward);
                const dateStr = formatDate(weekdayDate);
                const extraGrants = getActiveExtraGrants(childId, dateStr, 'normal');
                const extraHours = roundHours(extraGrants.reduce((sum, grant) => sum + Number(grant.hours), 0));
                const effectiveTotal = roundHours(effectiveHours + extraHours);
                const extraUsedHours = roundHours(Math.min(extraHours, Math.max(0, usedHours - effectiveHours)));
                summary.weekdays[weekday] = {
                    grantHours: roundHours(hours),
                    extraGrantHours: extraHours,
                    effectiveGrantHours: effectiveTotal,
                    usedHours: usedHours,
                    remainingHours: roundHours(Math.max(0, effectiveTotal - usedHours)),
                    extraUsedHours,
                    extraRemainingHours: roundHours(Math.max(0, extraHours - extraUsedHours)),
                    extraGrants: allocateExtraGrantUsage(extraGrants, extraUsedHours),
                    exceeded: usedHours - effectiveTotal > COMPARISON_EPSILON
                };
                summary.extraGrantHours = roundHours(summary.extraGrantHours + extraHours);
                summary.extraUsedHours = roundHours(summary.extraUsedHours + extraUsedHours);
                summary.extraRemainingHours = roundHours(summary.extraRemainingHours + Math.max(0, extraHours - extraUsedHours));
                summary.extraGrants.push(...allocateExtraGrantUsage(extraGrants, extraUsedHours));
            }
        }

        return summary;
    }

    return checkGrant(childId, today, 0);
}
