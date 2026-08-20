// Extended demo data script med flere barnepiger, børn og realistiske timeregistreringer
import db, { initializeDatabase } from './src/db/database.js';
import { ALLOWANCE_CALCULATION_VERSION, calculateAllowances } from './src/services/allowanceCalculator.js';

initializeDatabase();

console.log('Opretter udvidet demo data...\n');

// Ryd eksisterende data
db.exec('DELETE FROM time_entry_audit');
db.exec('DELETE FROM time_entries');
db.exec('DELETE FROM child_caregiver');
db.exec('DELETE FROM children');
db.exec('DELETE FROM caregivers');

// Reset autoincrement
db.exec("DELETE FROM sqlite_sequence WHERE name='caregivers'");
db.exec("DELETE FROM sqlite_sequence WHERE name='children'");
db.exec("DELETE FROM sqlite_sequence WHERE name='time_entries'");
db.exec("DELETE FROM sqlite_sequence WHERE name='time_entry_audit'");

console.log('Eksisterende data ryddet\n');

// Opret barnepiger (10 stk)
const insertCaregiver = db.prepare(`
    INSERT INTO caregivers (first_name, last_name, ma_number)
    VALUES (?, ?, ?)
`);

const caregivers = [
    { first_name: 'Maria', last_name: 'Jensen', ma_number: '00000001' },
    { first_name: 'Sofie', last_name: 'Nielsen', ma_number: '00000002' },
    { first_name: 'Line', last_name: 'Hansen', ma_number: '00000003' },
    { first_name: 'Emma', last_name: 'Pedersen', ma_number: '00000004' },
    { first_name: 'Laura', last_name: 'Andersen', ma_number: '00000005' },
    { first_name: 'Freja', last_name: 'Christensen', ma_number: '00000006' },
    { first_name: 'Ida', last_name: 'Larsen', ma_number: '00000007' },
    { first_name: 'Clara', last_name: 'Sørensen', ma_number: '00000008' },
    { first_name: 'Maja', last_name: 'Rasmussen', ma_number: '00000009' },
    { first_name: 'Anna', last_name: 'Jørgensen', ma_number: '00000010' }
];

caregivers.forEach(cg => {
    insertCaregiver.run(cg.first_name, cg.last_name, cg.ma_number);
    console.log(`Barnepige oprettet: ${cg.first_name} ${cg.last_name}`);
});

console.log('');

// Opret børn (15 stk med forskellige bevillingstyper)
const insertChild = db.prepare(`
    INSERT INTO children (
        first_name, last_name, birth_date, psp_element,
        grant_type, grant_hours, grant_weekdays, has_frame_grant, frame_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const children = [
    // UGE-bevillinger (5 børn) - let at overskride
    {
        first_name: 'Emil', last_name: 'Pedersen', birth_date: '2018-05-15',
        psp_element: 'PSP-12345', grant_type: 'week', grant_hours: 10,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Viktor', last_name: 'Thomsen', birth_date: '2019-02-20',
        psp_element: 'PSP-12346', grant_type: 'week', grant_hours: 8,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Noah', last_name: 'Madsen', birth_date: '2017-11-08',
        psp_element: 'PSP-12347', grant_type: 'week', grant_hours: 12,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Oscar', last_name: 'Kristensen', birth_date: '2020-03-25',
        psp_element: 'PSP-12348', grant_type: 'week', grant_hours: 6,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'William', last_name: 'Olsen', birth_date: '2018-09-12',
        psp_element: 'PSP-12349', grant_type: 'week', grant_hours: 15,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },

    // MÅNEDS-bevillinger (3 børn)
    {
        first_name: 'Laura', last_name: 'Andersen', birth_date: '2019-08-22',
        psp_element: 'PSP-67890', grant_type: 'month', grant_hours: 40,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Ella', last_name: 'Mortensen', birth_date: '2018-04-17',
        psp_element: 'PSP-67891', grant_type: 'month', grant_hours: 35,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Alma', last_name: 'Poulsen', birth_date: '2020-01-03',
        psp_element: 'PSP-67892', grant_type: 'month', grant_hours: 50,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },

    // SPECIFIKKE UGEDAGE (3 børn)
    {
        first_name: 'Oliver', last_name: 'Christensen', birth_date: '2017-03-10',
        psp_element: 'PSP-11111', grant_type: 'specific_weekdays', grant_hours: 0,
        grant_weekdays: JSON.stringify({ monday: 3, tuesday: 0, wednesday: 3, thursday: 0, friday: 4, saturday: 0, sunday: 0 }),
        has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Lucas', last_name: 'Knudsen', birth_date: '2019-07-29',
        psp_element: 'PSP-11112', grant_type: 'specific_weekdays', grant_hours: 0,
        grant_weekdays: JSON.stringify({ monday: 4, tuesday: 4, wednesday: 0, thursday: 4, friday: 0, saturday: 0, sunday: 0 }),
        has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Mathias', last_name: 'Lund', birth_date: '2018-12-01',
        psp_element: 'PSP-11113', grant_type: 'specific_weekdays', grant_hours: 0,
        grant_weekdays: JSON.stringify({ monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 0, sunday: 0 }),
        has_frame_grant: 0, frame_hours: 0
    },

    // RAMMEBEVILLING (2 børn)
    {
        first_name: 'Ida', last_name: 'Larsen', birth_date: '2020-01-30',
        psp_element: 'PSP-22222', grant_type: 'year', grant_hours: 0,
        grant_weekdays: null, has_frame_grant: 1, frame_hours: 200
    },
    {
        first_name: 'Karla', last_name: 'Berg', birth_date: '2017-06-14',
        psp_element: 'PSP-22223', grant_type: 'year', grant_hours: 0,
        grant_weekdays: null, has_frame_grant: 1, frame_hours: 150
    },

    // KVARTAL og HALVÅR
    {
        first_name: 'Sofia', last_name: 'Holm', birth_date: '2019-10-05',
        psp_element: 'PSP-33333', grant_type: 'quarter', grant_hours: 100,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    },
    {
        first_name: 'Alberte', last_name: 'Bech', birth_date: '2018-08-19',
        psp_element: 'PSP-33334', grant_type: 'half_year', grant_hours: 180,
        grant_weekdays: null, has_frame_grant: 0, frame_hours: 0
    }
];

children.forEach(child => {
    insertChild.run(
        child.first_name, child.last_name, child.birth_date, child.psp_element,
        child.grant_type, child.grant_hours, child.grant_weekdays,
        child.has_frame_grant, child.frame_hours
    );
    console.log(`Barn oprettet: ${child.first_name} ${child.last_name} (${child.grant_type}${child.has_frame_grant ? ' + rammebevilling' : ''})`);
});

console.log('');

// Tilknyt barnepiger til børn
const insertLink = db.prepare(`
    INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)
`);

const links = [
    // Emil (week 10t) - Maria + Sofie
    { child: 1, caregiver: 1 }, { child: 1, caregiver: 2 },
    // Viktor (week 8t) - Line
    { child: 2, caregiver: 3 },
    // Noah (week 12t) - Emma + Laura
    { child: 3, caregiver: 4 }, { child: 3, caregiver: 5 },
    // Oscar (week 6t) - Freja
    { child: 4, caregiver: 6 },
    // William (week 15t) - Ida + Clara
    { child: 5, caregiver: 7 }, { child: 5, caregiver: 8 },
    // Laura (month 40t) - Maria
    { child: 6, caregiver: 1 },
    // Ella (month 35t) - Sofie + Maja
    { child: 7, caregiver: 2 }, { child: 7, caregiver: 9 },
    // Alma (month 50t) - Anna
    { child: 8, caregiver: 10 },
    // Oliver (specific) - Line + Emma
    { child: 9, caregiver: 3 }, { child: 9, caregiver: 4 },
    // Lucas (specific) - Laura
    { child: 10, caregiver: 5 },
    // Mathias (specific) - Freja + Ida
    { child: 11, caregiver: 6 }, { child: 11, caregiver: 7 },
    // Ida (frame 200t) - Clara + Maja
    { child: 12, caregiver: 8 }, { child: 12, caregiver: 9 },
    // Karla (frame 150t) - Anna + Maria
    { child: 13, caregiver: 10 }, { child: 13, caregiver: 1 },
    // Sofia (quarter 100t) - Sofie
    { child: 14, caregiver: 2 },
    // Alberte (half_year 180t) - Line + Emma
    { child: 15, caregiver: 3 }, { child: 15, caregiver: 4 }
];

links.forEach(link => {
    insertLink.run(link.child, link.caregiver);
});

console.log('Tilknytninger oprettet\n');

// Opret timeregistreringer
const insertEntry = db.prepare(`
    INSERT INTO time_entries (
        caregiver_id, child_id, date, start_time, end_time,
        normal_hours, evening_hours, night_hours, saturday_hours, sunday_holiday_hours,
        total_hours, calculation_version, comment, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Hjælpefunktion til at få dato i denne uge
function getDateInWeek(daysFromMonday) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday + daysFromMonday);
    return monday.toISOString().split('T')[0];
}

// Hjælpefunktion til tidligere uger
function getDateInPreviousWeeks(weeksBack, daysFromMonday) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday - (weeksBack * 7) + daysFromMonday);
    return monday.toISOString().split('T')[0];
}

const entries = [
    // === EMIL (barn 1, week 10t) - OVERSKREDET! ===
    // Godkendte timer: 8t i denne uge
    { caregiver_id: 1, child_id: 1, date: getDateInWeek(0), start_time: '08:00', end_time: '12:00',
      normal_hours: 4, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Mandag morgen pasning', status: 'approved' },
    { caregiver_id: 2, child_id: 1, date: getDateInWeek(2), start_time: '14:00', end_time: '18:00',
      normal_hours: 3, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Onsdag eftermiddag', status: 'approved' },

    // Pending timer der overskrider bevillingen (+4t = 12t total, bevilling er 10t)
    { caregiver_id: 1, child_id: 1, date: getDateInWeek(3), start_time: '09:00', end_time: '13:00',
      normal_hours: 4, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'OVERSKRIDER BEVILLING - Torsdag', status: 'pending' },

    // === VIKTOR (barn 2, week 8t) - TÆT PÅ OVERSKRIDELSE ===
    { caregiver_id: 3, child_id: 2, date: getDateInWeek(0), start_time: '10:00', end_time: '14:00',
      normal_hours: 4, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 3, child_id: 2, date: getDateInWeek(1), start_time: '10:00', end_time: '13:00',
      normal_hours: 3, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 3, comment: 'Tirsdag - bruger 7/8 timer', status: 'approved' },
    // Pending - præcis på grænsen
    { caregiver_id: 3, child_id: 2, date: getDateInWeek(3), start_time: '15:00', end_time: '16:00',
      normal_hours: 1, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 1, comment: 'Sidste time i bevillingen', status: 'pending' },

    // === NOAH (barn 3, week 12t) - KRAFTIGT OVERSKREDET ===
    { caregiver_id: 4, child_id: 3, date: getDateInWeek(0), start_time: '07:00', end_time: '15:00',
      normal_hours: 7, evening_hours: 0, night_hours: 1, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 8, comment: 'Lang dag mandag', status: 'approved' },
    { caregiver_id: 5, child_id: 3, date: getDateInWeek(2), start_time: '12:00', end_time: '18:00',
      normal_hours: 5, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Onsdag - allerede 14t brugt!', status: 'approved' },
    // Pending - massiv overskridelse
    { caregiver_id: 4, child_id: 3, date: getDateInWeek(4), start_time: '08:00', end_time: '14:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'MASSIV OVERSKRIDELSE - fredag', status: 'pending' },

    // === OSCAR (barn 4, week 6t) - OK STATUS ===
    { caregiver_id: 6, child_id: 4, date: getDateInWeek(1), start_time: '14:00', end_time: '17:00',
      normal_hours: 3, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 3, comment: 'Tirsdag eftermiddag', status: 'approved' },
    { caregiver_id: 6, child_id: 4, date: getDateInWeek(3), start_time: '14:00', end_time: '16:00',
      normal_hours: 2, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 2, comment: 'Indenfor bevilling', status: 'pending' },

    // === WILLIAM (barn 5, week 15t) - OK MED MANGE TIMER ===
    { caregiver_id: 7, child_id: 5, date: getDateInWeek(0), start_time: '08:00', end_time: '14:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 8, child_id: 5, date: getDateInWeek(2), start_time: '08:00', end_time: '12:00',
      normal_hours: 4, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Onsdag', status: 'pending' },
    { caregiver_id: 7, child_id: 5, date: getDateInWeek(4), start_time: '13:00', end_time: '17:00',
      normal_hours: 3, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Fredag - 14/15 timer', status: 'pending' },

    // === LAURA (barn 6, month 40t) - OVERSKREDET I DENNE MÅNED ===
    { caregiver_id: 1, child_id: 6, date: getDateInWeek(0), start_time: '08:00', end_time: '16:00',
      normal_hours: 7, evening_hours: 0, night_hours: 1, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 8, comment: 'Lang dag', status: 'approved' },
    { caregiver_id: 1, child_id: 6, date: getDateInPreviousWeeks(1, 0), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Meget lang dag', status: 'approved' },
    { caregiver_id: 1, child_id: 6, date: getDateInPreviousWeeks(1, 2), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Meget lang dag 2', status: 'approved' },
    { caregiver_id: 1, child_id: 6, date: getDateInPreviousWeeks(2, 1), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Meget lang dag 3', status: 'approved' },
    // Pending der overskrider månedskvoten
    { caregiver_id: 1, child_id: 6, date: getDateInWeek(3), start_time: '08:00', end_time: '14:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'OVERSKRIDER MÅNEDSKVOTE', status: 'pending' },

    // === ELLA (barn 7, month 35t) - TÆTTI PÅ ===
    { caregiver_id: 2, child_id: 7, date: getDateInWeek(0), start_time: '09:00', end_time: '15:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 9, child_id: 7, date: getDateInPreviousWeeks(1, 3), start_time: '10:00', end_time: '18:00',
      normal_hours: 7, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 8, comment: 'Torsdag', status: 'approved' },
    { caregiver_id: 2, child_id: 7, date: getDateInPreviousWeeks(2, 0), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Lang dag', status: 'approved' },
    { caregiver_id: 9, child_id: 7, date: getDateInWeek(2), start_time: '12:00', end_time: '20:00',
      normal_hours: 5, evening_hours: 3, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 8, comment: 'Aften pasning - 32/35t brugt', status: 'pending' },

    // === OLIVER (barn 9, specific weekdays) - OVERSKRIDER ONSDAGSKVOTE ===
    // Mandag 3t, onsdag 3t, fredag 4t per uge
    { caregiver_id: 3, child_id: 9, date: getDateInWeek(0), start_time: '14:00', end_time: '17:00',
      normal_hours: 3, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 3, comment: 'Mandag - præcis 3t', status: 'approved' },
    { caregiver_id: 4, child_id: 9, date: getDateInWeek(2), start_time: '14:00', end_time: '17:00',
      normal_hours: 3, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 3, comment: 'Onsdag - præcis 3t', status: 'approved' },
    // Pending der overskrider fredagskvoten
    { caregiver_id: 3, child_id: 9, date: getDateInWeek(4), start_time: '12:00', end_time: '18:00',
      normal_hours: 5, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'OVERSKRIDER FREDAG (4t tilladt)', status: 'pending' },

    // === LUCAS (barn 10, specific weekdays) - OK ===
    { caregiver_id: 5, child_id: 10, date: getDateInWeek(0), start_time: '14:00', end_time: '18:00',
      normal_hours: 3, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 5, child_id: 10, date: getDateInWeek(1), start_time: '14:00', end_time: '17:00',
      normal_hours: 3, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 3, comment: 'Tirsdag - under kvoten', status: 'pending' },

    // === IDA (barn 12, frame 200t) - OVERSKREDET ÅRLIG ===
    { caregiver_id: 8, child_id: 12, date: getDateInPreviousWeeks(4, 0), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Stor dag 1', status: 'approved' },
    { caregiver_id: 9, child_id: 12, date: getDateInPreviousWeeks(3, 2), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'Stor dag 2', status: 'approved' },
    { caregiver_id: 8, child_id: 12, date: getDateInPreviousWeeks(2, 1), start_time: '06:00', end_time: '20:00',
      normal_hours: 11, evening_hours: 3, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 14, comment: 'Meget lang dag', status: 'approved' },

    // Simuler flere store dage for at nærme sig 200t
    ...Array.from({length: 15}, (_, i) => ({
        caregiver_id: i % 2 === 0 ? 8 : 9,
        child_id: 12,
        date: getDateInPreviousWeeks(5 + Math.floor(i / 3), i % 5),
        start_time: '08:00',
        end_time: '18:00',
        normal_hours: 9,
        evening_hours: 1,
        night_hours: 0,
        saturday_hours: 0,
        sunday_holiday_hours: 0,
        total_hours: 10,
        comment: `Arkiveret dag ${i + 1}`,
        status: 'approved'
    })),

    // Pending der overskrider rammebevillingen
    { caregiver_id: 8, child_id: 12, date: getDateInWeek(2), start_time: '08:00', end_time: '18:00',
      normal_hours: 9, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 10, comment: 'OVERSKRIDER RAMMEBEVILLING', status: 'pending' },

    // === KARLA (barn 13, frame 150t) - OK MEN MANGE TIMER ===
    { caregiver_id: 10, child_id: 13, date: getDateInWeek(0), start_time: '09:00', end_time: '15:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 1, child_id: 13, date: getDateInWeek(3), start_time: '12:00', end_time: '18:00',
      normal_hours: 5, evening_hours: 1, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Torsdag', status: 'pending' },

    // === SOFIA (barn 14, quarter 100t) - PENDING ===
    { caregiver_id: 2, child_id: 14, date: getDateInWeek(1), start_time: '10:00', end_time: '16:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Tirsdag', status: 'pending' },

    // === ALBERTE (barn 15, half_year 180t) - FLERE PENDING ===
    { caregiver_id: 3, child_id: 15, date: getDateInWeek(0), start_time: '08:00', end_time: '14:00',
      normal_hours: 6, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Mandag', status: 'approved' },
    { caregiver_id: 4, child_id: 15, date: getDateInWeek(2), start_time: '14:00', end_time: '20:00',
      normal_hours: 3, evening_hours: 3, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Onsdag aften', status: 'pending' },
    { caregiver_id: 3, child_id: 15, date: getDateInWeek(4), start_time: '08:00', end_time: '12:00',
      normal_hours: 4, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Fredag', status: 'pending' },

    // === WEEKEND OG NAT REGISTRERINGER ===
    // Lørdag
    { caregiver_id: 6, child_id: 4, date: getDateInWeek(5), start_time: '10:00', end_time: '16:00',
      normal_hours: 0, evening_hours: 0, night_hours: 0, saturday_hours: 6, sunday_holiday_hours: 0,
      total_hours: 6, comment: 'Lørdag pasning', status: 'pending' },

    // Søndag
    { caregiver_id: 7, child_id: 5, date: getDateInWeek(6), start_time: '12:00', end_time: '18:00',
      normal_hours: 0, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 6,
      total_hours: 6, comment: 'Søndag pasning', status: 'pending' },

    // Nat
    { caregiver_id: 2, child_id: 1, date: getDateInWeek(1), start_time: '22:00', end_time: '02:00',
      normal_hours: 0, evening_hours: 0, night_hours: 4, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 4, comment: 'Nat pasning - overskrider også!', status: 'pending' },

    // === AFVISTE REGISTRERINGER ===
    { caregiver_id: 1, child_id: 1, date: getDateInPreviousWeeks(1, 2), start_time: '08:00', end_time: '20:00',
      normal_hours: 9, evening_hours: 3, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 12, comment: 'For mange timer - afvist', status: 'rejected' },
    { caregiver_id: 3, child_id: 2, date: getDateInPreviousWeeks(2, 4), start_time: '08:00', end_time: '16:00',
      normal_hours: 8, evening_hours: 0, night_hours: 0, saturday_hours: 0, sunday_holiday_hours: 0,
      total_hours: 8, comment: 'Manglende dokumentation', status: 'rejected' },
];

let entryCount = 0;
entries.forEach(entry => {
    try {
        const allowances = calculateAllowances(entry.date, entry.start_time, entry.end_time);
        insertEntry.run(
            entry.caregiver_id, entry.child_id,
            entry.date, entry.start_time, entry.end_time,
            allowances.normal_hours, allowances.evening_hours, allowances.night_hours,
            allowances.saturday_hours, allowances.sunday_holiday_hours,
            allowances.total_hours, ALLOWANCE_CALCULATION_VERSION, entry.comment, entry.status
        );
        entryCount++;
    } catch (e) {
        console.error('Fejl ved entry:', e.message);
    }
});

console.log(`${entryCount} timeregistreringer oprettet`);

// Opdater rejection info for afviste entries
db.prepare(`
    UPDATE time_entries
    SET reviewed_by = 'Admin',
        reviewed_at = datetime('now', '-3 days'),
        rejection_reason = 'Bevillingen var allerede overskredet for perioden'
    WHERE status = 'rejected' AND id = (SELECT MAX(id) FROM time_entries WHERE status = 'rejected')
`).run();

db.prepare(`
    UPDATE time_entries
    SET reviewed_by = 'Admin',
        reviewed_at = datetime('now', '-5 days'),
        rejection_reason = 'Manglende dokumentation for ekstra timer'
    WHERE status = 'rejected' AND id = (SELECT MIN(id) FROM time_entries WHERE status = 'rejected')
`).run();

// Opdater approved entries med godkender info
db.prepare(`
    UPDATE time_entries
    SET reviewed_by = 'Admin',
        reviewed_at = datetime('now', '-1 days')
    WHERE status = 'approved'
`).run();

console.log('\n✅ Udvidet demo data oprettet!');
console.log('\nOversigt:');
console.log('- 10 barnepiger');
console.log('- 15 børn med forskellige bevillingstyper');
console.log(`- ${entryCount} timeregistreringer`);
console.log('\n🔴 Børn med OVERSKREDET bevilling (pending):');
console.log('  - Emil (week 10t) - 12t registreret');
console.log('  - Noah (week 12t) - 20t registreret');
console.log('  - Laura (month 40t) - 44t registreret');
console.log('  - Oliver (specific) - fredag overskrider');
console.log('  - Ida (frame 200t) - overskrider rammebevilling');
console.log('\n🟡 Børn TÆT PÅ grænsen:');
console.log('  - Viktor (week 8t) - præcis 8t');
console.log('  - Ella (month 35t) - 32t registreret');
