import ExcelJS from 'exceljs';

const BRAND = '#A6402C';
const BRAND_DARK = '#823322';
const BRAND_SOFT = '#F7EBE7';
const INK = '#1D2428';
const MUTED = '#667079';
const LINE = '#D8D4CC';
const CANVAS = '#F6F4EF';
const WHITE = '#FFFFFF';

function argb(value) {
    return { argb: value.replace('#', '') };
}

const STATUS_LABELS = {
    pending: 'Afventer godkendelse',
    approved: 'Godkendt',
    rejected: 'Afvist'
};

const STATUS_STYLES = {
    pending: { fill: '#FFF2CC', font: '#6B4E00' },
    approved: { fill: '#E2F0D9', font: '#375623' },
    rejected: { fill: '#FCE4E4', font: '#8B1F1F' }
};

function safeText(value) {
    const text = String(value ?? '');
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function parseDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function parseDateTime(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return safeText(value);
    return new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] || 0)
    ));
}

function formatDanishDate(value) {
    if (!value) return 'Ikke valgt';
    const [year, month, day] = value.split('-');
    return `${day}-${month}-${year}`;
}

function applyTitleBand(sheet, range, value, { size = 18, fill = BRAND } = {}) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.font = { name: 'Arial', size, bold: true, color: argb(WHITE) };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(fill) };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

function styleMetric(sheet, columns, label, value, numberFormat = '0') {
    const [from, to] = columns;
    sheet.mergeCells(`${from}5:${to}5`);
    sheet.mergeCells(`${from}6:${to}7`);
    const labelCell = sheet.getCell(`${from}5`);
    const valueCell = sheet.getCell(`${from}6`);
    labelCell.value = label;
    valueCell.value = value;
    for (const range of [`${from}5:${to}5`, `${from}6:${to}7`]) {
        const cells = sheet.getCell(range.split(':')[0]);
        cells.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(WHITE) };
    }
    labelCell.font = { name: 'Arial', size: 10, bold: true, color: argb(MUTED) };
    valueCell.font = { name: 'Arial', size: 24, bold: true, color: argb(BRAND_DARK) };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
    valueCell.numFmt = numberFormat;
    const outer = sheet.getCell(`${from}5`);
    outer.border = { left: { style: 'thin', color: argb(LINE) }, top: { style: 'thin', color: argb(LINE) } };
    sheet.getCell(`${to}5`).border = { right: { style: 'thin', color: argb(LINE) }, top: { style: 'thin', color: argb(LINE) } };
    sheet.getCell(`${from}7`).border = { left: { style: 'thin', color: argb(LINE) }, bottom: { style: 'thin', color: argb(LINE) } };
    sheet.getCell(`${to}7`).border = { right: { style: 'thin', color: argb(LINE) }, bottom: { style: 'thin', color: argb(LINE) } };
}

function addOverviewSheet(workbook, { summary, filters, labels, generatedAt, generatedBy }) {
    const sheet = workbook.addWorksheet('Oversigt', {
        views: [{ showGridLines: false }],
        properties: { defaultRowHeight: 20 }
    });
    sheet.columns = Array.from({ length: 8 }, () => ({ width: 16 }));
    sheet.getColumn(1).width = 19;
    sheet.getColumn(8).width = 19;
    sheet.getRow(1).height = 38;
    sheet.getRow(2).height = 32;
    sheet.getRow(3).height = 30;

    applyTitleBand(sheet, 'A1:H1', 'KALUNDBORG KOMMUNE · RAPPORTDASHBOARD', { size: 18 });
    applyTitleBand(sheet, 'A2:H2', 'Timeregistreringer', { size: 16, fill: BRAND_DARK });
    sheet.mergeCells('A3:H3');
    sheet.getCell('A3').value = `Periode: ${formatDanishDate(filters.fromDate)} – ${formatDanishDate(filters.toDate)}  ·  Barn: ${labels.child}  ·  Barnepige: ${labels.caregiver}  ·  Status: ${filters.status ? STATUS_LABELS[filters.status] : 'Alle statusser'}`;
    sheet.getCell('A3').font = { name: 'Arial', size: 10, color: argb(INK) };
    sheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND_SOFT) };
    sheet.getCell('A3').alignment = { vertical: 'middle', wrapText: true };

    styleMetric(sheet, ['A', 'B'], 'REGISTRERINGER', summary.registrationCount);
    styleMetric(sheet, ['C', 'D'], 'TIMER I ALT', summary.totalHours, '0.00');
    styleMetric(sheet, ['E', 'F'], 'BØRN', summary.childCount);
    styleMetric(sheet, ['G', 'H'], 'BARNEPIGER', summary.caregiverCount);

    sheet.mergeCells('A9:D9');
    sheet.getCell('A9').value = 'Statusfordeling';
    sheet.mergeCells('F9:H9');
    sheet.getCell('F9').value = 'Grundtimer og tillæg';
    for (const cellRef of ['A9', 'F9']) {
        const cell = sheet.getCell(cellRef);
        cell.font = { name: 'Arial', size: 12, bold: true, color: argb(WHITE) };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND_DARK) };
        cell.alignment = { vertical: 'middle' };
    }

    const statusRows = [
        ['Afventer godkendelse', summary.byStatus.pending.count, summary.byStatus.pending.hours],
        ['Godkendt', summary.byStatus.approved.count, summary.byStatus.approved.hours],
        ['Afvist', summary.byStatus.rejected.count, summary.byStatus.rejected.hours]
    ];
    sheet.getCell('A10').value = 'Status';
    sheet.getCell('C10').value = 'Antal';
    sheet.getCell('D10').value = 'Timer';
    for (const cellRef of ['A10', 'C10', 'D10']) {
        sheet.getCell(cellRef).font = { name: 'Arial', size: 9, italic: true, color: argb(MUTED) };
    }
    statusRows.forEach((row, index) => {
        const rowNumber = 11 + index;
        sheet.getCell(`A${rowNumber}`).value = row[0];
        sheet.getCell(`C${rowNumber}`).value = row[1];
        sheet.getCell(`D${rowNumber}`).value = row[2];
        sheet.getCell(`C${rowNumber}`).numFmt = '0';
        sheet.getCell(`D${rowNumber}`).numFmt = '0.00';
    });

    const hourRows = [
        ['Normaltimer', summary.hours.normal_hours],
        ['Aftentillæg', summary.hours.evening_hours],
        ['Nattillæg', summary.hours.night_hours],
        ['Lørdagstillæg', summary.hours.saturday_hours],
        ['Søn-/helligdag', summary.hours.sunday_holiday_hours]
    ];
    hourRows.forEach((row, index) => {
        const rowNumber = 10 + index;
        sheet.getCell(`F${rowNumber}`).value = row[0];
        sheet.getCell(`H${rowNumber}`).value = row[1];
        sheet.getCell(`H${rowNumber}`).numFmt = '0.00';
    });

    for (let rowNumber = 10; rowNumber <= 14; rowNumber += 1) {
        for (let column = 1; column <= 8; column += 1) {
            if (column === 5) continue;
            const cell = sheet.getCell(rowNumber, column);
            cell.font = cell.font || { name: 'Arial', size: 10, color: argb(INK) };
            cell.border = { bottom: { style: 'thin', color: argb(LINE) } };
            cell.alignment = { vertical: 'middle', horizontal: [3, 4, 8].includes(column) ? 'right' : 'left' };
        }
    }

    sheet.mergeCells('A17:H17');
    sheet.getCell('A17').value = `Genereret ${generatedAt.toLocaleString('da-DK')} af ${safeText(generatedBy)}. Detaljer og kommentarer findes på arket “Registreringer”.`;
    sheet.getCell('A17').font = { name: 'Arial', size: 9, italic: true, color: argb(MUTED) };
    sheet.getCell('A17').alignment = { wrapText: true };
    sheet.getRow(17).height = 30;
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 };
    sheet.headerFooter.oddFooter = '&LKalundborg Kommune&C&P af &N&R&F';
}

function addEntriesSheet(workbook, { entries, filters, labels }) {
    const sheet = workbook.addWorksheet('Registreringer', {
        views: [{ state: 'frozen', xSplit: 2, ySplit: 6, topLeftCell: 'C7', showGridLines: false }],
        properties: { defaultRowHeight: 20 }
    });
    const columns = [
        ['ID', 8], ['Dato', 13], ['Barn', 23], ['Barnepige', 23], ['MA-nummer', 14],
        ['Start', 10], ['Slut', 10], ['Total timer', 13], ['Normaltimer', 13], ['Aftentillæg', 13],
        ['Nattillæg', 13], ['Lørdagstillæg', 14], ['Søn-/helligdag', 17], ['Bevillingskilde', 17],
        ['Status', 23], ['Kommentar', 42], ['Indberettet', 19], ['Behandlet af', 20],
        ['Behandlet den', 19], ['Afvisningsårsag', 30], ['Lønstatus', 17]
    ];
    sheet.columns = columns.map(([, width]) => ({ width }));

    applyTitleBand(sheet, 'A1:U1', 'KALUNDBORG KOMMUNE · TIMEREGISTRERINGER', { size: 18 });
    sheet.mergeCells('A2:U2');
    sheet.getCell('A2').value = `Periode: ${formatDanishDate(filters.fromDate)} – ${formatDanishDate(filters.toDate)}  ·  Barn: ${labels.child}  ·  Barnepige: ${labels.caregiver}  ·  Status: ${filters.status ? STATUS_LABELS[filters.status] : 'Alle statusser'}`;
    sheet.getCell('A2').font = { name: 'Arial', size: 10, color: argb(INK) };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND_SOFT) };
    sheet.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
    sheet.mergeCells('A4:U4');
    sheet.getCell('A4').value = 'Alle timer er gemt som decimaltimer. Kommentarer og afvisningsårsager vises i fuld længde.';
    sheet.getCell('A4').font = { name: 'Arial', size: 9, italic: true, color: argb(MUTED) };

    const headerRow = sheet.getRow(6);
    headerRow.values = columns.map(([name]) => name);
    headerRow.height = 32;
    headerRow.eachCell(cell => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: argb(WHITE) };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND) };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = { bottom: { style: 'medium', color: argb(BRAND_DARK) } };
    });

    entries.forEach((entry, index) => {
        const row = sheet.addRow([
            entry.id,
            parseDate(entry.date),
            safeText(entry.child_name),
            safeText(entry.caregiver_name),
            safeText(entry.ma_number),
            safeText(entry.start_time?.slice(0, 5)),
            safeText(entry.end_time?.slice(0, 5)),
            Number(entry.total_hours) || 0,
            Number(entry.normal_hours) || 0,
            Number(entry.evening_hours) || 0,
            Number(entry.night_hours) || 0,
            Number(entry.saturday_hours) || 0,
            Number(entry.sunday_holiday_hours) || 0,
            entry.grant_source === 'frame' ? 'Rammebevilling' : 'Normal bevilling',
            STATUS_LABELS[entry.status] || entry.status,
            safeText(entry.comment),
            parseDateTime(entry.submitted_at),
            safeText(entry.reviewed_by),
            parseDateTime(entry.reviewed_at),
            safeText(entry.rejection_reason),
            entry.payroll_registered ? 'Registreret' : 'Ikke registreret'
        ]);
        row.height = entry.comment || entry.rejection_reason ? 34 : 24;
        row.eachCell({ includeEmpty: true }, cell => {
            cell.font = { name: 'Arial', size: 10, color: argb(INK) };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(index % 2 === 0 ? WHITE : CANVAS) };
            cell.border = { bottom: { style: 'thin', color: argb(LINE) } };
            cell.alignment = { vertical: 'top', wrapText: true };
        });
        row.getCell(2).numFmt = 'dd-mm-yyyy';
        for (let column = 8; column <= 13; column += 1) {
            row.getCell(column).numFmt = '0.00';
            row.getCell(column).alignment = { vertical: 'top', horizontal: 'right' };
        }
        for (const column of [17, 19]) row.getCell(column).numFmt = 'dd-mm-yyyy hh:mm';
        const statusStyle = STATUS_STYLES[entry.status];
        if (statusStyle) {
            row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: argb(statusStyle.fill) };
            row.getCell(15).font = { name: 'Arial', size: 10, bold: true, color: argb(statusStyle.font) };
        }
    });

    const firstDataRow = 7;
    const lastDataRow = Math.max(firstDataRow, 6 + entries.length);
    sheet.autoFilter = { from: 'A6', to: 'U6' };
    const totalRowNumber = lastDataRow + 2;
    sheet.mergeCells(`A${totalRowNumber}:G${totalRowNumber}`);
    sheet.getCell(`A${totalRowNumber}`).value = 'I alt';
    sheet.getCell(`A${totalRowNumber}`).font = { name: 'Arial', size: 11, bold: true, color: argb(WHITE) };
    sheet.getCell(`A${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND_DARK) };
    for (let column = 8; column <= 13; column += 1) {
        const computed = entries.reduce((sum, entry) => sum + Number([
            entry.total_hours,
            entry.normal_hours,
            entry.evening_hours,
            entry.night_hours,
            entry.saturday_hours,
            entry.sunday_holiday_hours
        ][column - 8] || 0), 0);
        const cell = sheet.getCell(totalRowNumber, column);
        cell.value = entries.length
            ? { formula: `SUM(${sheet.getCell(firstDataRow, column).address}:${sheet.getCell(lastDataRow, column).address})`, result: Math.round(computed * 100) / 100 }
            : 0;
        cell.numFmt = '0.00';
        cell.font = { name: 'Arial', size: 11, bold: true, color: argb(WHITE) };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(BRAND_DARK) };
        cell.alignment = { horizontal: 'right' };
    }

    sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        printTitlesRow: '1:6',
        printArea: `A1:U${totalRowNumber}`
    };
    sheet.headerFooter.oddFooter = '&LKalundborg Kommune&C&P af &N&R&F';
}

export async function createReportWorkbook(payload) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kalundborg Kommune';
    workbook.lastModifiedBy = payload.generatedBy;
    workbook.created = payload.generatedAt;
    workbook.modified = payload.generatedAt;
    workbook.company = 'Kalundborg Kommune';
    workbook.subject = 'Rapport over timeregistreringer';
    workbook.title = 'Timeregistreringer';
    workbook.calcProperties.fullCalcOnLoad = true;

    addOverviewSheet(workbook, payload);
    addEntriesSheet(workbook, payload);
    return workbook.xlsx.writeBuffer();
}
