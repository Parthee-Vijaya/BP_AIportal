import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testDirectory = mkdtempSync(join(tmpdir(), 'bp3-tests-'));
process.env.DB_PATH = join(testDirectory, 'database.sqlite');
process.env.NODE_ENV = 'test';

const { default: db, initializeDatabase } = await import('../src/db/database.js');
const { calculateAllowances } = await import('../src/services/allowanceCalculator.js');
const { checkGrant, getGrantPeriod, getUsedHours } = await import('../src/services/grantCalculator.js');
const { default: app } = await import('../src/index.js');

let server;
let baseUrl;
let caregiverId;
let frameChildId;
let specificChildId;
let primaryApproverId;
let reportApproverId;
let holidayApproverId;

function approverHeaders() {
    return { 'Content-Type': 'application/json', 'X-Approver-Id': String(primaryApproverId) };
}

before(async () => {
    initializeDatabase();
    primaryApproverId = db.prepare(`SELECT id FROM approvers WHERE email = 'mette.sorensen@example.test'`).get().id;
    reportApproverId = db.prepare(`SELECT id FROM approvers WHERE email = 'jonas.nielsen@example.test'`).get().id;
    holidayApproverId = db.prepare(`SELECT id FROM approvers WHERE email = 'lene.hansen@example.test'`).get().id;

    caregiverId = Number(db.prepare(`
        INSERT INTO caregivers (first_name, last_name, ma_number) VALUES ('Test', 'Barnepige', '99999999')
    `).run().lastInsertRowid);

    frameChildId = Number(db.prepare(`
        INSERT INTO children (
            first_name, last_name, grant_type, grant_hours, has_frame_grant, frame_hours
        ) VALUES ('Ramme', 'Barn', 'week', 4, 1, 55)
    `).run().lastInsertRowid);

    specificChildId = Number(db.prepare(`
        INSERT INTO children (
            first_name, last_name, grant_type, grant_hours, grant_weekdays
        ) VALUES ('Ugedag', 'Barn', 'specific_weekdays', 0, ?)
    `).run(JSON.stringify({
        monday: 3,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
    })).lastInsertRowid);

    db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)').run(frameChildId, caregiverId);
    db.prepare('INSERT INTO child_caregiver (child_id, caregiver_id) VALUES (?, ?)').run(specificChildId, caregiverId);

    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(testDirectory, { recursive: true, force: true });
});

test('afviser ugyldige datoer og tidsrum', () => {
    assert.throws(
        () => calculateAllowances('2026-08-10', '12:00', '12:00'),
        /må ikke være ens/
    );
    assert.throws(
        () => calculateAllowances('ikke-en-dato', '12:00', '13:00'),
        /gyldig dato/
    );
    assert.throws(
        () => calculateAllowances('2026-08-10', '25:99', '13:00'),
        /gyldigt klokkeslæt/
    );
});

test('fordeler tillæg korrekt på begge sider af midnat', () => {
    const sundayToMonday = calculateAllowances('2026-08-09', '22:00', '10:00');
    assert.equal(sundayToMonday.total_hours, 12);
    assert.equal(sundayToMonday.sunday_holiday_hours, 2);
    assert.equal(sundayToMonday.night_hours, 6);

    const saturdayToSunday = calculateAllowances('2026-08-08', '22:00', '10:00');
    assert.equal(saturdayToSunday.normal_hours, saturdayToSunday.total_hours);
    assert.equal(saturdayToSunday.saturday_hours, 2);
    assert.equal(saturdayToSunday.sunday_holiday_hours, 10);
});

test('respekterer tidsafgrænsede brugerdefinerede helligdage', () => {
    db.prepare(`
        INSERT INTO custom_holidays (date, name, all_day, start_time, end_time)
        VALUES ('2026-08-10', 'Delvis', 0, '12:00', '14:00')
    `).run();
    const result = calculateAllowances('2026-08-10', '11:00', '15:00');
    assert.equal(result.total_hours, 4);
    assert.equal(result.sunday_holiday_hours, 2);
});

test('afgrænser standardmåneden til månedens faktiske sidste dag', () => {
    assert.deepEqual(getGrantPeriod('month', '2026-02-10'), {
        startDate: '2026-02-01',
        endDate: '2026-02-28'
    });
});

test('beregner specifikke ugedagsbevillinger uden serverfejl', () => {
    const result = checkGrant(specificChildId, '2026-08-10', 1, { useFrameGrant: false });
    assert.equal(result.valid, true);
    assert.equal(result.grantHours, 3);
    assert.equal(result.weekday, 'monday');
});

test('holder normal- og rammebevilling adskilt', () => {
    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time, total_hours, normal_hours, grant_source
        ) VALUES (?, ?, '2026-08-10', '08:00', '10:00', 2, 2, 'normal')
    `).run(caregiverId, frameChildId);
    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time, total_hours, normal_hours, grant_source
        ) VALUES (?, ?, '2026-08-10', '10:00', '13:00', 3, 3, 'frame')
    `).run(caregiverId, frameChildId);

    assert.equal(getUsedHours(frameChildId, '2026-08-10', '2026-08-16', null, 'normal'), 2);
    assert.equal(getUsedHours(frameChildId, '2026-01-01', '2026-12-31', null, 'frame'), 3);
    assert.equal(checkGrant(frameChildId, '2026-08-10', 0, { useFrameGrant: false }).grantType, 'week');
    assert.equal(checkGrant(frameChildId, '2026-08-10', 0, { useFrameGrant: true }).grantType, 'frame_grant');
});

test('preview returnerer 400 for ugyldigt tidsrum', async () => {
    const response = await fetch(`${baseUrl}/api/time-entries/preview`, {
        method: 'POST',
        headers: approverHeaders(),
        body: JSON.stringify({ date: '2026-08-10', start_time: '12:00', end_time: '12:00' })
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /må ikke være ens/);
});

test('API afviser månedsintervaller med huller eller overlap', async () => {
    const response = await fetch(`${baseUrl}/api/settings/month-interval`, {
        method: 'PUT',
        headers: approverHeaders(),
        body: JSON.stringify({ start_day: 5, end_day: 20 })
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /sammenhængende/);
});

test('registrering gemmer bevillingskilde og append-only auditlog', async () => {
    const createResponse = await fetch(`${baseUrl}/api/time-entries`, {
        method: 'POST',
        headers: approverHeaders(),
        body: JSON.stringify({
            caregiver_id: caregiverId,
            child_id: frameChildId,
            date: '2026-08-10',
            start_time: '14:00',
            end_time: '15:00',
            use_frame_grant: true,
            submitted_by: 'Test Barnepige'
        })
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.entry.grant_source, 'frame');
    assert.equal(created.entry.calculation_version, '2026-08-v2');

    const approveResponse = await fetch(`${baseUrl}/api/time-entries/${created.entry.id}/approve`, {
        method: 'PUT',
        headers: approverHeaders(),
        body: JSON.stringify({ reviewed_by: 'Test Godkender' })
    });
    assert.equal(approveResponse.status, 200);

    const auditResponse = await fetch(`${baseUrl}/api/time-entries/${created.entry.id}/audit`);
    assert.equal(auditResponse.status, 200);
    const audit = await auditResponse.json();
    assert.deepEqual(audit.map(item => item.action), ['submitted', 'approved']);
    assert.deepEqual(audit.map(item => item.actor), ['Test Barnepige', 'Test Godkender']);
});

test('ekstrabevilling på rammebevilling viser forbrug særskilt', async () => {
    const childId = Number(db.prepare(`
        INSERT INTO children (
            first_name, last_name, grant_type, grant_hours, has_frame_grant, frame_hours
        ) VALUES ('Ekstra', 'Ramme', 'week', 4, 1, 10)
    `).run().lastInsertRowid);

    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time,
            total_hours, normal_hours, status, grant_source
        ) VALUES (?, ?, '2026-08-11', '08:00', '20:00', 12, 12, 'pending', 'frame')
    `).run(caregiverId, childId);

    const response = await fetch(`${baseUrl}/api/extra-grants`, {
        method: 'POST',
        headers: approverHeaders(),
        body: JSON.stringify({
            child_id: childId,
            hours: 5,
            from_date: '2026-01-01',
            to_date: '2026-12-31',
            granted_by: 'Test Leder',
            comment: 'Testbevilling'
        })
    });
    assert.equal(response.status, 201);
    const grant = await response.json();
    assert.equal(grant.granted_by, 'Mette Sørensen');
    assert.ok(grant.granted_at);

    const frame = checkGrant(childId, '2026-08-11', 0, { useFrameGrant: true });
    assert.equal(frame.baseGrantHours, 10);
    assert.equal(frame.baseUsedHours, 10);
    assert.equal(frame.extraGrantHours, 5);
    assert.equal(frame.extraUsedHours, 2);
    assert.equal(frame.extraRemainingHours, 3);
    assert.equal(frame.extraGrants[0].usedHours, 2);

    const normal = checkGrant(childId, '2026-08-11', 0, { useFrameGrant: false });
    assert.equal(normal.extraGrantHours, 0);
    assert.equal(normal.effectiveGrantHours, normal.grantHours);
});

test('ekstrabevilling kan gives til normal bevilling og gælder kun den valgte periode', async () => {
    const childId = Number(db.prepare(`
        INSERT INTO children (
            first_name, last_name, grant_type, grant_hours, has_frame_grant, frame_hours
        ) VALUES ('Ekstra', 'Normal', 'week', 4, 0, 0)
    `).run().lastInsertRowid);
    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time,
            total_hours, normal_hours, status, grant_source
        ) VALUES (?, ?, '2026-08-11', '08:00', '13:00', 5, 5, 'pending', 'normal')
    `).run(caregiverId, childId);

    const response = await fetch(`${baseUrl}/api/extra-grants`, {
        method: 'POST',
        headers: approverHeaders(),
        body: JSON.stringify({
            child_id: childId,
            hours: 2,
            from_date: '2026-08-10',
            to_date: '2026-08-16',
            grant_source: 'normal',
            granted_by: 'Test Leder'
        })
    });
    assert.equal(response.status, 201);
    const grant = await response.json();
    assert.equal(grant.grant_source, 'normal');

    const status = checkGrant(childId, '2026-08-11', 0, { useFrameGrant: false });
    assert.equal(status.grantHours, 4);
    assert.equal(status.extraGrantHours, 2);
    assert.equal(status.effectiveGrantHours, 6);
    assert.equal(status.usedHours, 5);
    assert.equal(status.extraUsedHours, 1);
    assert.equal(status.extraRemainingHours, 1);
    assert.equal(checkGrant(childId, '2026-08-18', 0, { useFrameGrant: false }).extraGrantHours, 0);

    const childResponse = await fetch(`${baseUrl}/api/children/${childId}`);
    assert.equal(childResponse.status, 200);
    const child = await childResponse.json();
    assert.equal(child.grantSummary.grantHours, 4);
    assert.equal(child.grantSummary.extraGrantHours, 0, 'udløbne ekstratimer må ikke tælle i den aktuelle periode');
    assert.equal(child.grantSummary.effectiveGrantHours, 4);
    assert.equal(child.extraGrants.length, 1);
    assert.equal(child.extraGrants[0].from_date, '2026-08-10');
    assert.equal(child.extraGrants[0].to_date, '2026-08-16');
});

test('ekstrabevilling kan gives til en konkret ugedagsbevilling', async () => {
    const response = await fetch(`${baseUrl}/api/extra-grants`, {
        method: 'POST',
        headers: approverHeaders(),
        body: JSON.stringify({
            child_id: specificChildId,
            hours: 2,
            from_date: '2026-08-10',
            to_date: '2026-08-10',
            grant_source: 'normal',
            granted_by: 'Test Leder'
        })
    });
    assert.equal(response.status, 201);
    const status = checkGrant(specificChildId, '2026-08-10', 0, { useFrameGrant: false });
    assert.equal(status.grantHours, 3);
    assert.equal(status.extraGrantHours, 2);
    assert.equal(status.effectiveGrantHours, 5);
});

test('administrative API-handlinger håndhæver godkenderens rettigheder', async () => {
    const payload = JSON.stringify({ date: '2026-09-01', name: 'Lokaldag', all_day: true });
    const missing = await fetch(`${baseUrl}/api/holidays`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload
    });
    assert.equal(missing.status, 401);

    const forbidden = await fetch(`${baseUrl}/api/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Approver-Id': String(reportApproverId) },
        body: payload
    });
    assert.equal(forbidden.status, 403);

    const allowed = await fetch(`${baseUrl}/api/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Approver-Id': String(holidayApproverId) },
        body: payload
    });
    assert.equal(allowed.status, 201);
    const holiday = await allowed.json();

    const removed = await fetch(`${baseUrl}/api/holidays/${holiday.id}`, {
        method: 'DELETE', headers: { 'X-Approver-Id': String(holidayApproverId) }
    });
    assert.equal(removed.status, 200);
});

test('rapportdashboard filtrerer registreringer, viser kommentarer og leverer formateret Excel', async () => {
    db.prepare(`
        INSERT INTO time_entries (
            caregiver_id, child_id, date, start_time, end_time,
            normal_hours, evening_hours, total_hours, grant_source,
            comment, status, calculation_version, reviewed_by, reviewed_at
        ) VALUES (?, ?, '2026-08-12', '16:00', '18:30', 2.5, 1.5, 2.5, 'frame',
            'Aftale med familien om sen afhentning', 'approved', '2026-08-v2', 'Test Godkender', '2026-08-13 08:00:00')
    `).run(caregiverId, frameChildId);

    const query = new URLSearchParams({
        child_id: String(frameChildId),
        caregiver_id: String(caregiverId),
        status: 'approved',
        from_date: '2026-08-12',
        to_date: '2026-08-12'
    });
    const headers = { 'X-Approver-Id': String(reportApproverId) };

    const missingPermission = await fetch(`${baseUrl}/api/reports?${query}`);
    assert.equal(missingPermission.status, 401);
    const forbidden = await fetch(`${baseUrl}/api/reports?${query}`, {
        headers: { 'X-Approver-Id': String(holidayApproverId) }
    });
    assert.equal(forbidden.status, 403);

    const response = await fetch(`${baseUrl}/api/reports?${query}`, { headers });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.summary.registrationCount, 1);
    assert.equal(report.summary.totalHours, 2.5);
    assert.equal(report.summary.byStatus.approved.count, 1);
    assert.equal(report.entries[0].comment, 'Aftale med familien om sen afhentning');
    assert.equal(report.entries[0].child_name, 'Ramme Barn');

    const excelResponse = await fetch(`${baseUrl}/api/reports/excel?${query}`, { headers });
    assert.equal(excelResponse.status, 200);
    assert.equal(
        excelResponse.headers.get('content-type'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    assert.match(excelResponse.headers.get('content-disposition'), /\.xlsx/);
    const bytes = Buffer.from(await excelResponse.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Oversigt', 'Registreringer']);
    assert.equal(workbook.getWorksheet('Oversigt').getCell('A6').value, 1);
    assert.equal(workbook.getWorksheet('Registreringer').getCell('P7').value, 'Aftale med familien om sen afhentning');

    const invalidRange = await fetch(`${baseUrl}/api/reports?from_date=2026-08-13&to_date=2026-08-12`, { headers });
    assert.equal(invalidRange.status, 400);
});
