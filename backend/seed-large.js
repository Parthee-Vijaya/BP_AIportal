// Large demo data script - 5x more data
import db, { initializeDatabase } from './src/db/database.js';
import { ALLOWANCE_CALCULATION_VERSION, calculateAllowances } from './src/services/allowanceCalculator.js';

initializeDatabase();

console.log('Opretter stor mængde demo data...\n');

// Ryd eksisterende data og nulstil ID-tællere
db.exec('DELETE FROM time_entry_audit');
db.exec('DELETE FROM time_entries');
db.exec('DELETE FROM child_caregiver');
db.exec('DELETE FROM children');
db.exec('DELETE FROM caregivers');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('caregivers', 'children', 'time_entries', 'time_entry_audit')");
console.log('Eksisterende data slettet\n');

// Danske navne
const firstNames = ['Maria', 'Sofie', 'Line', 'Anna', 'Emma', 'Ida', 'Laura', 'Mette', 'Camilla', 'Louise', 'Katrine', 'Julie', 'Sara', 'Nanna', 'Maja'];
const lastNames = ['Jensen', 'Nielsen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Petersen', 'Madsen', 'Kristensen', 'Olsen', 'Thomsen', 'Poulsen'];
const childFirstNames = ['Emil', 'Laura', 'Oliver', 'Ida', 'Noah', 'Emma', 'William', 'Alma', 'Oscar', 'Freja', 'Lucas', 'Ella', 'Victor', 'Clara', 'Malthe', 'Sofie', 'Alfred', 'Agnes', 'Carl', 'Karla'];

// Opret 15 barnepiger
const insertCaregiver = db.prepare(`
    INSERT INTO caregivers (first_name, last_name, ma_number)
    VALUES (?, ?, ?)
`);

const caregiverCount = 15;
for (let i = 0; i < caregiverCount; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const maNumber = String(i + 1).padStart(8, '0');
    insertCaregiver.run(firstName, lastName, maNumber);
    console.log(`Barnepige oprettet: ${firstName} ${lastName} (${maNumber})`);
}

// Opret 20 børn med forskellige bevillingstyper
const insertChild = db.prepare(`
    INSERT INTO children (
        first_name, last_name, birth_date, psp_element,
        grant_type, grant_hours, grant_weekdays, has_frame_grant, frame_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const grantTypes = ['week', 'month', 'quarter', 'half_year', 'year', 'specific_weekdays'];
const childCount = 20;

for (let i = 0; i < childCount; i++) {
    const firstName = childFirstNames[i % childFirstNames.length];
    const lastName = lastNames[(i + 5) % lastNames.length];
    const year = 2017 + (i % 5);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const birthDate = `${year}-${month}-${day}`;
    // PSP format: XX-0000000000-0000 (2 bogstaver - 10 tal - 4 tal)
    const pspElement = `XG-${String(10031 + i).padStart(10, '0')}-${String(i + 1).padStart(4, '0')}`;
    const grantType = grantTypes[i % grantTypes.length];

    let grantHours = 0;
    let grantWeekdays = null;
    let hasFrameGrant = 0;
    let frameHours = 0;

    switch (grantType) {
        case 'week':
            grantHours = 8 + (i % 5) * 2;
            break;
        case 'month':
            grantHours = 30 + (i % 4) * 10;
            break;
        case 'quarter':
            grantHours = 80 + (i % 3) * 20;
            break;
        case 'half_year':
            grantHours = 150 + (i % 4) * 25;
            break;
        case 'year':
            hasFrameGrant = 1;
            frameHours = 200 + (i % 5) * 50;
            break;
        case 'specific_weekdays':
            grantWeekdays = JSON.stringify({
                monday: 2 + (i % 3),
                tuesday: i % 2 === 0 ? 2 : 0,
                wednesday: 3,
                thursday: i % 2 === 1 ? 2 : 0,
                friday: 2 + (i % 2),
                saturday: 0,
                sunday: 0
            });
            break;
    }

    insertChild.run(firstName, lastName, birthDate, pspElement, grantType, grantHours, grantWeekdays, hasFrameGrant, frameHours);
    console.log(`Barn oprettet: ${firstName} ${lastName} (${grantType})`);
}

// Hent faktiske IDs fra databasen
const caregiverIds = db.prepare('SELECT id FROM caregivers ORDER BY id').all().map(r => r.id);
const childIds = db.prepare('SELECT id FROM children ORDER BY id').all().map(r => r.id);

// Tilknyt barnepiger til børn (2-3 barnepiger per barn)
const insertLink = db.prepare(`
    INSERT OR IGNORE INTO child_caregiver (child_id, caregiver_id)
    VALUES (?, ?)
`);

childIds.forEach((childId, idx) => {
    const numCaregivers = 2 + (idx % 2);
    for (let j = 0; j < numCaregivers; j++) {
        const caregiverId = caregiverIds[(idx + j) % caregiverIds.length];
        insertLink.run(childId, caregiverId);
    }
});
console.log('\nTilknytninger oprettet');

// Opret mange timeregistreringer (ca. 50 stk)
const insertEntry = db.prepare(`
    INSERT INTO time_entries (
        caregiver_id, child_id, date, start_time, end_time,
        normal_hours, evening_hours, night_hours, saturday_hours, sunday_holiday_hours,
        total_hours, calculation_version, comment, status, reviewed_by, reviewed_at, payroll_registered, payroll_date, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const statuses = ['pending', 'pending', 'pending', 'approved', 'approved', 'rejected'];
const adminNames = ['Peter Thomsen', 'Kirsten Madsen', 'Henrik Sørensen', 'Lone Nielsen', 'Thomas Jensen'];
const rejectionReasons = [
    'Forkert barn valgt - kontroller venligst',
    'Tidspunkt overlapper med anden registrering',
    'Mangler dokumentation for aftenpasning',
    'Overstiger bevillingens timetal for denne uge',
    'Dato stemmer ikke overens med aftale',
    'Barnet var i institution på dette tidspunkt',
    'PSP-element passer ikke til barnet',
    'Timer registreret uden for bevillingsperioden',
    'Kontakt venligst administrationen for afklaring',
    'Duplikat registrering - allerede godkendt tidligere'
];
const comments = [
    'Pasning mens forældre arbejdede',
    'Aftenpasning',
    'Weekendpasning',
    'Hjælp med lektier',
    'Aktiviteter og leg',
    'Transport til fritidsaktiviteter',
    null,
    null,
    'Ekstra pasning pga. sygdom',
    'Feriepassning'
];

const timeSlots = [
    { start: '08:00', end: '14:00', normal: 6, evening: 0, night: 0, saturday: 0, sunday: 0 },
    { start: '09:00', end: '15:00', normal: 6, evening: 0, night: 0, saturday: 0, sunday: 0 },
    { start: '14:00', end: '18:00', normal: 3, evening: 1, night: 0, saturday: 0, sunday: 0 },
    { start: '17:00', end: '21:00', normal: 0, evening: 4, night: 0, saturday: 0, sunday: 0 },
    { start: '18:00', end: '22:00', normal: 0, evening: 4, night: 0, saturday: 0, sunday: 0 },
    { start: '10:00', end: '16:00', normal: 0, evening: 0, night: 0, saturday: 6, sunday: 0 },
    { start: '12:00', end: '18:00', normal: 0, evening: 0, night: 0, saturday: 0, sunday: 6 },
    { start: '07:00', end: '12:00', normal: 5, evening: 0, night: 0, saturday: 0, sunday: 0 },
    { start: '15:00', end: '20:00', normal: 2, evening: 3, night: 0, saturday: 0, sunday: 0 },
    { start: '22:00', end: '02:00', normal: 0, evening: 1, night: 3, saturday: 0, sunday: 0 },
];

const entryCount = 150;
for (let i = 0; i < entryCount; i++) {
    const caregiverId = caregiverIds[i % caregiverIds.length];
    const childId = childIds[i % childIds.length];

    // Datoer fra de sidste 30 dage
    const daysAgo = i % 30;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];

    const slot = timeSlots[i % timeSlots.length];
    const allowances = calculateAllowances(dateStr, slot.start, slot.end);
    const status = statuses[i % statuses.length];
    const comment = comments[i % comments.length];

    // For godkendte og afviste: tilføj reviewer info
    let reviewedBy = null;
    let reviewedAt = null;
    let payrollRegistered = 0;
    let payrollDate = null;
    let rejectionReason = null;

    if (status === 'approved' || status === 'rejected') {
        reviewedBy = adminNames[i % adminNames.length];
        const reviewDate = new Date(date);
        reviewDate.setDate(reviewDate.getDate() + 1);
        reviewedAt = reviewDate.toISOString();

        // Halvdelen af godkendte har fået sendt data
        if (status === 'approved' && i % 2 === 0) {
            payrollRegistered = 1;
            const payDate = new Date(reviewDate);
            payDate.setDate(payDate.getDate() + 1);
            payrollDate = payDate.toISOString();
        }

        // Afviste får en årsag
        if (status === 'rejected') {
            rejectionReason = rejectionReasons[i % rejectionReasons.length];
        }
    }

    insertEntry.run(
        caregiverId, childId,
        dateStr, slot.start, slot.end,
        allowances.normal_hours, allowances.evening_hours, allowances.night_hours,
        allowances.saturday_hours, allowances.sunday_holiday_hours,
        allowances.total_hours, ALLOWANCE_CALCULATION_VERSION, comment, status,
        reviewedBy, reviewedAt, payrollRegistered, payrollDate, rejectionReason
    );
}

console.log(`${entryCount} timeregistreringer oprettet`);

console.log('\n✅ Stor mængde demo data oprettet!');
console.log('\nOversigt:');
console.log(`- ${caregiverCount} barnepiger`);
console.log(`- ${childCount} børn med forskellige bevillingstyper`);
console.log(`- ${entryCount} timeregistreringer (pending, approved, rejected)`);
console.log('- Tilknytninger mellem børn og barnepiger');
