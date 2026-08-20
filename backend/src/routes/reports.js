import { Router } from 'express';
import { PERMISSIONS, requirePermission } from '../services/permissions.js';
import {
    getAvailableReportRange,
    getReportEntries,
    getReportFilterLabels,
    summarizeReport
} from '../services/reportService.js';
import { createReportWorkbook } from '../services/reportWorkbook.js';
import {
    assertDate,
    isValidationError,
    ValidationError
} from '../utils/validation.js';

const router = Router();
const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

function parsePositiveId(value, label) {
    if (value == null || value === '') return null;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`${label} er ugyldigt`);
    return id;
}

function parseFilters(query) {
    const status = String(query.status || '').trim();
    if (status && !ALLOWED_STATUSES.has(status)) throw new ValidationError('Ugyldig status');
    const fromDate = String(query.from_date || '').trim();
    const toDate = String(query.to_date || '').trim();
    if (fromDate) assertDate(fromDate, 'Fra-dato');
    if (toDate) assertDate(toDate, 'Til-dato');
    if (fromDate && toDate && fromDate > toDate) {
        throw new ValidationError('Fra-dato skal ligge før eller på til-dato');
    }
    return {
        status: status || null,
        childId: parsePositiveId(query.child_id, 'Barn'),
        caregiverId: parsePositiveId(query.caregiver_id, 'Barnepige'),
        fromDate: fromDate || null,
        toDate: toDate || null
    };
}

function handleError(res, error, fallbackMessage) {
    if (isValidationError(error)) return res.status(error.statusCode).json({ error: error.message });
    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
}

router.get('/', requirePermission(PERMISSIONS.EXPORT_REPORTS), (req, res) => {
    try {
        const filters = parseFilters(req.query);
        const entries = getReportEntries(filters);
        res.json({
            generatedAt: new Date().toISOString(),
            availableRange: getAvailableReportRange(),
            filters,
            summary: summarizeReport(entries),
            entries
        });
    } catch (error) {
        handleError(res, error, 'Kunne ikke hente rapporten');
    }
});

router.get('/excel', requirePermission(PERMISSIONS.EXPORT_REPORTS), async (req, res) => {
    try {
        const filters = parseFilters(req.query);
        const entries = getReportEntries(filters);
        const summary = summarizeReport(entries);
        const generatedAt = new Date();
        const buffer = await createReportWorkbook({
            entries,
            summary,
            filters,
            labels: getReportFilterLabels(filters),
            generatedAt,
            generatedBy: req.approver.name
        });
        const from = filters.fromDate || 'alle-datoer';
        const to = filters.toDate || 'alle-datoer';
        const filename = `timeregistreringer-${from}-til-${to}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(buffer));
    } catch (error) {
        handleError(res, error, 'Kunne ikke oprette Excel-rapporten');
    }
});

export default router;
