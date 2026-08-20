import db, { initializeDatabase } from '../src/db/database.js';
import {
    ALLOWANCE_CALCULATION_VERSION,
    calculateAllowances
} from '../src/services/allowanceCalculator.js';

const APPLY = process.argv.includes('--apply');
const HOUR_FIELDS = [
    'normal_hours',
    'evening_hours',
    'night_hours',
    'saturday_hours',
    'sunday_holiday_hours',
    'total_hours'
];

initializeDatabase();

const entries = db.prepare(`
    SELECT id, date, start_time, end_time, calculation_version,
           normal_hours, evening_hours, night_hours,
           saturday_hours, sunday_holiday_hours, total_hours
    FROM time_entries
    ORDER BY id
`).all();

const changes = entries.flatMap(entry => {
    const expected = calculateAllowances(entry.date, entry.start_time, entry.end_time);
    const changedFields = HOUR_FIELDS.filter(field => (
        Math.abs(Number(entry[field]) - Number(expected[field])) > 1e-9
    ));
    if (changedFields.length === 0 && entry.calculation_version === ALLOWANCE_CALCULATION_VERSION) {
        return [];
    }
    return [{ entry, expected, changedFields }];
});

console.log(`${entries.length} registreringer kontrolleret; ${changes.length} kræver opdatering.`);

if (!APPLY) {
    console.log('Ingen data er ændret. Kør med --apply for at gemme de genberegnede felter.');
    for (const { entry, changedFields } of changes.slice(0, 10)) {
        console.log(`#${entry.id} ${entry.date} ${entry.start_time}-${entry.end_time}: ${changedFields.join(', ') || 'kun versionsmærke'}`);
    }
    db.close();
    process.exit(0);
}

const updateEntry = db.prepare(`
    UPDATE time_entries SET
        normal_hours = ?, evening_hours = ?, night_hours = ?,
        saturday_hours = ?, sunday_holiday_hours = ?, total_hours = ?,
        calculation_version = ?
    WHERE id = ?
`);
const insertAudit = db.prepare(`
    INSERT INTO time_entry_audit (time_entry_id, action, actor, metadata)
    VALUES (?, 'calculation_recomputed', 'System – beregningsmigration', ?)
`);

db.transaction(() => {
    for (const { entry, expected, changedFields } of changes) {
        updateEntry.run(
            expected.normal_hours,
            expected.evening_hours,
            expected.night_hours,
            expected.saturday_hours,
            expected.sunday_holiday_hours,
            expected.total_hours,
            ALLOWANCE_CALCULATION_VERSION,
            entry.id
        );
        insertAudit.run(entry.id, JSON.stringify({
            fromVersion: entry.calculation_version,
            toVersion: ALLOWANCE_CALCULATION_VERSION,
            changedFields,
            previous: Object.fromEntries(HOUR_FIELDS.map(field => [field, entry[field]])),
            recalculated: Object.fromEntries(HOUR_FIELDS.map(field => [field, expected[field]]))
        }));
    }
})();

console.log(`${changes.length} registreringer opdateret og dokumenteret i auditloggen.`);
db.close();
