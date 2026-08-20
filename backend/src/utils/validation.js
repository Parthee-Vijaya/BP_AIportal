const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

export function isValidDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

export function assertDate(value, label = 'Dato') {
    if (!isValidDate(value)) {
        throw new ValidationError(`${label} skal være en gyldig dato i formatet YYYY-MM-DD`);
    }
}

export function assertTime(value, label = 'Tid') {
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
        throw new ValidationError(`${label} skal være et gyldigt klokkeslæt i formatet HH:MM`);
    }
}

export function parseTimeMinutes(value) {
    assertTime(value);
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

export function assertTimeRange(startTime, endTime) {
    assertTime(startTime, 'Starttid');
    assertTime(endTime, 'Sluttid');
    if (startTime === endTime) {
        throw new ValidationError('Start- og sluttid må ikke være ens');
    }
}

export function assertNotFutureDate(value) {
    assertDate(value);
    const today = new Date().toISOString().slice(0, 10);
    if (value > today) {
        throw new ValidationError('Der kan ikke registreres timer i fremtiden');
    }
}

export function assertPositiveNumber(value, label, { allowZero = false } = {}) {
    const number = Number(value);
    const valid = Number.isFinite(number) && (allowZero ? number >= 0 : number > 0);
    if (!valid) {
        throw new ValidationError(`${label} skal være ${allowZero ? '0 eller et positivt tal' : 'et positivt tal'}`);
    }
    return number;
}

export function normalizeMaNumber(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits || digits.length > 8) {
        throw new ValidationError('MA-nummer skal bestå af højst 8 cifre');
    }
    return digits.padStart(8, '0');
}

export function normalizeIdArray(value, label) {
    if (value == null) return [];
    if (!Array.isArray(value)) {
        throw new ValidationError(`${label} skal være en liste`);
    }
    const ids = value.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
        throw new ValidationError(`${label} indeholder et ugyldigt id`);
    }
    return [...new Set(ids)];
}

export function validateTimeEntryInput({ date, start_time, end_time }) {
    assertNotFutureDate(date);
    assertTimeRange(start_time, end_time);
}

export function isValidationError(error) {
    return error instanceof ValidationError;
}
