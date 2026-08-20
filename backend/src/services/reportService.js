import db from '../db/database.js';

const HOUR_FIELDS = [
    'total_hours',
    'normal_hours',
    'evening_hours',
    'night_hours',
    'saturday_hours',
    'sunday_holiday_hours'
];

function roundHours(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function getReportEntries(filters = {}) {
    let query = `
        SELECT
            te.id,
            te.child_id,
            te.caregiver_id,
            c.first_name || ' ' || c.last_name AS child_name,
            cg.first_name || ' ' || cg.last_name AS caregiver_name,
            cg.ma_number,
            te.date,
            te.start_time,
            te.end_time,
            te.normal_hours,
            te.evening_hours,
            te.night_hours,
            te.saturday_hours,
            te.sunday_holiday_hours,
            te.total_hours,
            te.calculation_version,
            te.grant_source,
            te.comment,
            te.status,
            te.submitted_at,
            te.reviewed_by,
            te.reviewed_at,
            te.rejection_reason,
            te.payroll_registered,
            te.payroll_date
        FROM time_entries te
        JOIN children c ON c.id = te.child_id
        JOIN caregivers cg ON cg.id = te.caregiver_id
        WHERE 1 = 1
    `;
    const params = [];

    if (filters.status) {
        query += ' AND te.status = ?';
        params.push(filters.status);
    }
    if (filters.childId) {
        query += ' AND te.child_id = ?';
        params.push(filters.childId);
    }
    if (filters.caregiverId) {
        query += ' AND te.caregiver_id = ?';
        params.push(filters.caregiverId);
    }
    if (filters.fromDate) {
        query += ' AND te.date >= ?';
        params.push(filters.fromDate);
    }
    if (filters.toDate) {
        query += ' AND te.date <= ?';
        params.push(filters.toDate);
    }

    query += ' ORDER BY te.date DESC, te.start_time DESC, te.id DESC';
    return db.prepare(query).all(...params);
}

export function getAvailableReportRange() {
    const range = db.prepare(`
        SELECT MIN(date) AS from_date, MAX(date) AS to_date
        FROM time_entries
    `).get();
    return {
        fromDate: range?.from_date || null,
        toDate: range?.to_date || null
    };
}

export function summarizeReport(entries) {
    const byStatus = {
        pending: { count: 0, hours: 0 },
        approved: { count: 0, hours: 0 },
        rejected: { count: 0, hours: 0 }
    };
    const hours = Object.fromEntries(HOUR_FIELDS.map(field => [field, 0]));
    const childIds = new Set();
    const caregiverIds = new Set();

    for (const entry of entries) {
        childIds.add(entry.child_id);
        caregiverIds.add(entry.caregiver_id);
        if (byStatus[entry.status]) {
            byStatus[entry.status].count += 1;
            byStatus[entry.status].hours += Number(entry.total_hours) || 0;
        }
        for (const field of HOUR_FIELDS) hours[field] += Number(entry[field]) || 0;
    }

    for (const status of Object.values(byStatus)) status.hours = roundHours(status.hours);
    for (const field of HOUR_FIELDS) hours[field] = roundHours(hours[field]);

    return {
        registrationCount: entries.length,
        totalHours: hours.total_hours,
        childCount: childIds.size,
        caregiverCount: caregiverIds.size,
        byStatus,
        hours
    };
}

export function getReportFilterLabels(filters = {}) {
    const child = filters.childId
        ? db.prepare("SELECT first_name || ' ' || last_name AS name FROM children WHERE id = ?").get(filters.childId)
        : null;
    const caregiver = filters.caregiverId
        ? db.prepare("SELECT first_name || ' ' || last_name AS name FROM caregivers WHERE id = ?").get(filters.caregiverId)
        : null;

    return {
        child: child?.name || 'Alle børn',
        caregiver: caregiver?.name || 'Alle barnepiger'
    };
}
