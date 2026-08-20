// Demo data script
import db, { initializeDatabase } from './src/db/database.js';
import { ALLOWANCE_CALCULATION_VERSION, calculateAllowances } from './src/services/allowanceCalculator.js';

initializeDatabase();

console.log('Opretter demo data...\n');

// Opret barnepiger
const insertCaregiver = db.prepare(`
    INSERT INTO caregivers (first_name, last_name, ma_number)
    VALUES (?, ?, ?)
`);

const caregivers = [
    { key: 'maria', first_name: 'Maria', last_name: 'Jensen', ma_number: '00000001' },
    { key: 'sofie', first_name: 'Sofie', last_name: 'Nielsen', ma_number: '00000002' },
    { key: 'line', first_name: 'Line', last_name: 'Hansen', ma_number: '00000003' }
];

const caregiverIds = {};
caregivers.forEach(cg => {
    const existing = db.prepare('SELECT id, ma_number FROM caregivers').all()
        .find(row => String(row.ma_number).replace(/\D/g, '').padStart(8, '0') === cg.ma_number);
    if (existing) {
        caregiverIds[cg.key] = existing.id;
        console.log(`Barnepige findes allerede: ${cg.first_name}`);
    } else {
        const result = insertCaregiver.run(cg.first_name, cg.last_name, cg.ma_number);
        caregiverIds[cg.key] = result.lastInsertRowid;
        console.log(`Barnepige oprettet: ${cg.first_name} ${cg.last_name}`);
    }
});

// Opret børn
const insertChild = db.prepare(`
    INSERT INTO children (
        first_name, last_name, birth_date, psp_element,
        grant_type, grant_hours, grant_weekdays, has_frame_grant, frame_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const children = [
    {
        key: 'emil',
        first_name: 'Emil',
        last_name: 'Pedersen',
        birth_date: '2018-05-15',
        psp_element: 'PSP-12345',
        grant_type: 'week',
        grant_hours: 10,
        grant_weekdays: null,
        has_frame_grant: 0,
        frame_hours: 0
    },
    {
        key: 'laura',
        first_name: 'Laura',
        last_name: 'Andersen',
        birth_date: '2019-08-22',
        psp_element: 'PSP-67890',
        grant_type: 'month',
        grant_hours: 40,
        grant_weekdays: null,
        has_frame_grant: 0,
        frame_hours: 0
    },
    {
        key: 'oliver',
        first_name: 'Oliver',
        last_name: 'Christensen',
        birth_date: '2017-03-10',
        psp_element: 'PSP-11111',
        grant_type: 'specific_weekdays',
        grant_hours: 0,
        grant_weekdays: JSON.stringify({
            monday: 3,
            tuesday: 0,
            wednesday: 3,
            thursday: 0,
            friday: 4,
            saturday: 0,
            sunday: 0
        }),
        has_frame_grant: 0,
        frame_hours: 0
    },
    {
        key: 'ida',
        first_name: 'Ida',
        last_name: 'Larsen',
        birth_date: '2020-01-30',
        psp_element: 'PSP-22222',
        grant_type: 'year',
        grant_hours: 0,
        grant_weekdays: null,
        has_frame_grant: 1,
        frame_hours: 200
    }
];

const childIds = {};
children.forEach(child => {
    const existing = db.prepare('SELECT id FROM children WHERE psp_element = ? ORDER BY id LIMIT 1').get(child.psp_element);
    if (existing) {
        childIds[child.key] = existing.id;
        console.log(`Barn findes allerede: ${child.first_name}`);
    } else {
        const result = insertChild.run(
            child.first_name, child.last_name, child.birth_date, child.psp_element,
            child.grant_type, child.grant_hours, child.grant_weekdays,
            child.has_frame_grant, child.frame_hours
        );
        childIds[child.key] = result.lastInsertRowid;
        console.log(`Barn oprettet: ${child.first_name} ${child.last_name} (${child.grant_type})`);
    }
});

// Tilknyt barnepiger til børn
const insertLink = db.prepare(`
    INSERT OR IGNORE INTO child_caregiver (child_id, caregiver_id)
    VALUES (?, ?)
`);

const links = [
    { child: childIds.emil, caregiver: caregiverIds.maria },
    { child: childIds.emil, caregiver: caregiverIds.sofie },
    { child: childIds.laura, caregiver: caregiverIds.maria },
    { child: childIds.oliver, caregiver: caregiverIds.sofie },
    { child: childIds.ida, caregiver: caregiverIds.line }
];

links.forEach(link => {
    try {
        insertLink.run(link.child, link.caregiver);
    } catch (e) { }
});

console.log('\nTilknytninger oprettet');

// Opret nogle demo timeregistreringer
const insertEntry = db.prepare(`
    INSERT INTO time_entries (
        caregiver_id, child_id, date, start_time, end_time,
        normal_hours, evening_hours, night_hours, saturday_hours, sunday_holiday_hours,
        total_hours, calculation_version, comment, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const entries = [
    // Pending entries
    {
        caregiver_id: caregiverIds.maria, child_id: childIds.emil,
        date: '2026-01-13', start_time: '08:00', end_time: '14:00',
        normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
        total_hours: 6, comment: 'Pasning mens forældre arbejdede', status: 'pending'
    },
    {
        caregiver_id: caregiverIds.sofie, child_id: childIds.emil,
        date: '2026-01-14', start_time: '17:00', end_time: '21:00',
        normal_hours: 0, evening_hours: 4, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
        total_hours: 4, comment: 'Aften pasning', status: 'pending'
    },
    // Approved entry
    {
        caregiver_id: caregiverIds.maria, child_id: childIds.laura,
        date: '2026-01-10', start_time: '09:00', end_time: '15:00',
        normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
        total_hours: 6, comment: null, status: 'approved'
    }
];

entries.forEach(entry => {
    try {
        const exists = db.prepare(`
            SELECT id FROM time_entries
            WHERE caregiver_id = ? AND child_id = ? AND date = ? AND start_time = ? AND end_time = ?
        `).get(entry.caregiver_id, entry.child_id, entry.date, entry.start_time, entry.end_time);
        if (exists) return;
        const allowances = calculateAllowances(entry.date, entry.start_time, entry.end_time);
        insertEntry.run(
            entry.caregiver_id, entry.child_id,
            entry.date, entry.start_time, entry.end_time,
            allowances.normal_hours, allowances.evening_hours, allowances.night_hours,
            allowances.saturday_hours, allowances.sunday_holiday_hours,
            allowances.total_hours, ALLOWANCE_CALCULATION_VERSION, entry.comment, entry.status
        );
    } catch (e) {
        console.error('Fejl ved entry:', e.message);
    }
});

console.log('Demo timeregistreringer oprettet');

console.log('\n✅ Demo data oprettet!');
console.log('\nOversigt:');
console.log('- 3 barnepiger (Maria, Sofie, Line)');
console.log('- 4 børn med forskellige bevillingstyper');
console.log('- Tilknytninger mellem børn og barnepiger');
console.log('- Demo timeregistreringer');
