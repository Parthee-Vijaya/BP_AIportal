import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const testDirectory = mkdtempSync(join(tmpdir(), 'bp3-calculation-tests-'));
process.env.DB_PATH = join(testDirectory, 'database.sqlite');
process.env.NODE_ENV = 'test';

const { default: db, initializeDatabase } = await import('../src/db/database.js');
const {
    ALLOWANCE_CALCULATION_VERSION,
    calculateAllowances,
    getDanishHolidays,
    isHoliday
} = await import('../src/services/allowanceCalculator.js');
const {
    checkGrant,
    getGrantPeriod,
    getUsedHours,
    validateMonthInterval
} = await import('../src/services/grantCalculator.js');

let caregiverId;
let weeklyChildId;
let decimalChildId;

before(() => {
    initializeDatabase();
    caregiverId = Number(db.prepare(`
        INSERT INTO caregivers (first_name, last_name, ma_number)
        VALUES ('Motor', 'Test', '88888888')
    `).run().lastInsertRowid);
    weeklyChildId = Number(db.prepare(`
        INSERT INTO children (first_name, last_name, grant_type, grant_hours)
        VALUES ('Uge', 'Test', 'week', 10)
    `).run().lastInsertRowid);
    decimalChildId = Number(db.prepare(`
        INSERT INTO children (first_name, last_name, grant_type, grant_hours)
        VALUES ('Decimal', 'Test', 'week', 0.3)
    `).run().lastInsertRowid);
});

after(() => {
    db.close();
    rmSync(testDirectory, { recursive: true, force: true });
});

test('regelsættet har en sporbar version', () => {
    assert.match(ALLOWANCE_CALCULATION_VERSION, /^\d{4}-\d{2}-v\d+$/);
});

test('beregner alle døgnets grænser som grundtimer plus ikke-overlappende tillæg', () => {
    const cases = [
        ['2026-08-10', '00:00', '06:00', { total: 6, night: 6 }],
        ['2026-08-10', '06:00', '17:00', { total: 11 }],
        ['2026-08-10', '17:00', '23:00', { total: 6, evening: 6 }],
        ['2026-08-10', '23:00', '00:00', { total: 1, night: 1 }],
        ['2026-08-08', '00:00', '06:00', { total: 6, night: 6 }],
        ['2026-08-08', '06:00', '08:00', { total: 2 }],
        ['2026-08-08', '08:00', '00:00', { total: 16, saturday: 16 }],
        ['2026-08-09', '00:00', '23:45', { total: 23.75, sunday: 23.75 }]
    ];

    for (const [date, start, end, expected] of cases) {
        const result = calculateAllowances(date, start, end);
        assert.equal(result.total_hours, expected.total, `${date} ${start}-${end}: total`);
        assert.equal(result.normal_hours, expected.total, `${date} ${start}-${end}: grundtimer`);
        assert.equal(result.evening_hours, expected.evening || 0, `${date} ${start}-${end}: aften`);
        assert.equal(result.night_hours, expected.night || 0, `${date} ${start}-${end}: nat`);
        assert.equal(result.saturday_hours, expected.saturday || 0, `${date} ${start}-${end}: lørdag`);
        assert.equal(result.sunday_holiday_hours, expected.sunday || 0, `${date} ${start}-${end}: søn/hellig`);
    }
});

test('klassificerer hvert kvarter i en hel uge ved de rigtige grænser', () => {
    const dates = [
        '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
        '2026-08-14', '2026-08-15', '2026-08-16'
    ];
    const fields = ['evening_hours', 'night_hours', 'saturday_hours', 'sunday_holiday_hours'];

    for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
        for (let minute = 0; minute < 24 * 60; minute += 15) {
            const start = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
            const endMinute = minute + 15;
            const end = endMinute === 24 * 60
                ? '00:00'
                : `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
            const expected = Object.fromEntries(fields.map(field => [field, 0]));

            if (dayIndex === 6) {
                expected.sunday_holiday_hours = 0.25;
            } else if (dayIndex === 5) {
                if (minute < 6 * 60) expected.night_hours = 0.25;
                else if (minute >= 8 * 60) expected.saturday_hours = 0.25;
            } else if (minute < 6 * 60 || minute >= 23 * 60) {
                expected.night_hours = 0.25;
            } else if (minute >= 17 * 60) {
                expected.evening_hours = 0.25;
            }

            const result = calculateAllowances(dates[dayIndex], start, end);
            assert.equal(result.total_hours, 0.25, `${dates[dayIndex]} ${start}-${end}: total`);
            assert.equal(result.normal_hours, 0.25, `${dates[dayIndex]} ${start}-${end}: grundtimer`);
            for (const field of fields) {
                assert.equal(result[field], expected[field], `${dates[dayIndex]} ${start}-${end}: ${field}`);
            }
        }
    }
});

test('afrunder begge klokkeslæt op til næste kvarter uden at miste datoovergangen', () => {
    assert.deepEqual(calculateAllowances('2026-08-10', '12:07', '13:47'), {
        normal_hours: 1.75,
        evening_hours: 0,
        night_hours: 0,
        saturday_hours: 0,
        sunday_holiday_hours: 0,
        total_hours: 1.75
    });

    const boundary = calculateAllowances('2026-08-10', '16:59', '17:01');
    assert.equal(boundary.total_hours, 0.25);
    assert.equal(boundary.evening_hours, 0.25);

    const midnight = calculateAllowances('2026-08-10', '23:59', '00:01');
    assert.equal(midnight.total_hours, 0.25);
    assert.equal(midnight.night_hours, 0.25);
});

test('beregner de bevægelige danske helligdage for 2026', () => {
    const holidays = new Set(getDanishHolidays(2026));
    for (const date of ['2026-04-02', '2026-04-03', '2026-04-05', '2026-04-06', '2026-05-14', '2026-05-24', '2026-05-25']) {
        assert.equal(holidays.has(date), true, date);
        assert.equal(isHoliday(date), true, date);
    }
    assert.equal(holidays.has('2026-05-08'), false, 'Store bededag må ikke ligge i regelsættet');
    for (const date of ['2026-01-21', '2026-05-01', '2026-06-05', '2026-12-24', '2026-12-31']) {
        assert.equal(holidays.has(date), false, `${date} er ikke en officiel helligdag`);
    }
    assert.equal(holidays.has('2026-12-25'), true, 'Juledag skal ligge i regelsættet');
});

test('respekterer tilbagevendende og delvise lokale helligdage uden dobbelt tillæg', () => {
    db.prepare(`
        INSERT INTO custom_holidays (date, name, all_day, recurring)
        VALUES ('2020-08-17', 'Gentagelse', 1, 1)
    `).run();
    db.prepare(`
        INSERT INTO custom_holidays (date, name, all_day, start_time, end_time, recurring)
        VALUES ('2026-08-18', 'Delvis aften', 0, '18:00', '20:00', 0)
    `).run();

    const recurring = calculateAllowances('2026-08-17', '10:00', '12:00');
    assert.equal(recurring.sunday_holiday_hours, 2);

    const partial = calculateAllowances('2026-08-18', '17:00', '21:00');
    assert.equal(partial.evening_hours, 2);
    assert.equal(partial.sunday_holiday_hours, 2);
    assert.equal(partial.evening_hours + partial.sunday_holiday_hours, partial.total_hours);
});

test('beregner uge, kvartal, halvår og år med inklusive periodegrænser', () => {
    assert.deepEqual(getGrantPeriod('week', '2026-08-16'), { startDate: '2026-08-10', endDate: '2026-08-16' });
    assert.deepEqual(getGrantPeriod('quarter', '2026-03-31'), { startDate: '2026-01-01', endDate: '2026-03-31' });
    assert.deepEqual(getGrantPeriod('quarter', '2026-04-01'), { startDate: '2026-04-01', endDate: '2026-06-30' });
    assert.deepEqual(getGrantPeriod('half_year', '2026-06-30'), { startDate: '2026-01-01', endDate: '2026-06-30' });
    assert.deepEqual(getGrantPeriod('half_year', '2026-07-01'), { startDate: '2026-07-01', endDate: '2026-12-31' });
    assert.deepEqual(getGrantPeriod('year', '2026-12-31'), { startDate: '2026-01-01', endDate: '2026-12-31' });
});

test('ugeperioden er identisk i en server-tidszone vest for UTC', () => {
    const moduleUrl = new URL('../src/services/grantCalculator.js', import.meta.url).href;
    const script = `
        const { getGrantPeriod } = await import(${JSON.stringify(moduleUrl)});
        process.stdout.write(JSON.stringify(getGrantPeriod('week', '2026-08-10')));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: { ...process.env, TZ: 'America/Los_Angeles' }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
        startDate: '2026-08-10',
        endDate: '2026-08-16'
    });
});

test('månedsintervaller dækker datoen uden huller eller overlap', () => {
    assert.deepEqual(validateMonthInterval(1, 31), { startDay: 1, endDay: 31 });
    assert.deepEqual(validateMonthInterval(16, 15), { startDay: 16, endDay: 15 });
    assert.throws(() => validateMonthInterval(5, 20), /sammenhængende/);
    assert.throws(() => validateMonthInterval(31, 30), /startdag 2-28/);

    db.prepare(`
        INSERT INTO month_interval_history (start_day, end_day, effective_from)
        VALUES (16, 15, '2026-01-01')
    `).run();
    assert.deepEqual(getGrantPeriod('month', '2026-02-15'), { startDate: '2026-01-16', endDate: '2026-02-15' });
    assert.deepEqual(getGrantPeriod('month', '2026-02-16'), { startDate: '2026-02-16', endDate: '2026-03-15' });
});

test('forbrug tæller kun afventende og godkendte timer i den valgte pulje', () => {
    const insert = db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time,
            normal_hours, total_hours, grant_source, status
        ) VALUES (?, ?, ?, '08:00', '09:00', ?, ?, ?, ?)
    `);
    insert.run(caregiverId, weeklyChildId, '2026-08-10', 1, 1, 'normal', 'pending');
    insert.run(caregiverId, weeklyChildId, '2026-08-11', 2, 2, 'normal', 'approved');
    insert.run(caregiverId, weeklyChildId, '2026-08-12', 4, 4, 'normal', 'rejected');
    insert.run(caregiverId, weeklyChildId, '2026-08-13', 3, 3, 'frame', 'pending');

    assert.equal(getUsedHours(weeklyChildId, '2026-08-10', '2026-08-16', null, 'normal'), 3);
    assert.equal(getUsedHours(weeklyChildId, '2026-08-10', '2026-08-16', null, 'frame'), 3);
    assert.throws(
        () => getUsedHours(weeklyChildId, '2026-08-10', '2026-08-16', 'funday', 'normal'),
        /Ugyldig ugedag/
    );
});

test('decimalgrænser giver ikke falsk bevillingsoverskridelse', () => {
    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time,
            normal_hours, total_hours, grant_source, status
        ) VALUES (?, ?, '2026-08-10', '08:00', '08:06', 0.1, 0.1, 'normal', 'pending')
    `).run(caregiverId, decimalChildId);

    const exact = checkGrant(decimalChildId, '2026-08-10', 0.2, { useFrameGrant: false });
    assert.equal(exact.totalAfterNew, 0.3);
    assert.equal(exact.valid, true);
    assert.equal(exact.exceeded, false);
    assert.equal(exact.exceededBy, 0);
});
