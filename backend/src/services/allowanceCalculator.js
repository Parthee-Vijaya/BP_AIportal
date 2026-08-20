/**
 * Beregner grundtimer og tillæg for en timeregistrering.
 * Alle registreringer må højst spænde over ét døgn, og intervaller behandles
 * som halvt åbne: 17:00-18:00 er fx én aftentime.
 */

import db from '../db/database.js';
import {
    assertDate,
    assertTimeRange,
    parseTimeMinutes,
    ValidationError
} from '../utils/validation.js';
import { getOfficialHolidayDates } from './holidayCalendar.js';

const MINUTES_PER_DAY = 24 * 60;
const QUARTER_MINUTES = 15;
export const ALLOWANCE_CALCULATION_VERSION = '2026-08-v2';

function dateFromString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return formatDate(result);
}

function addDaysToString(dateStr, days) {
    return addDays(dateFromString(dateStr), days);
}

function getDanishHolidays(year) {
    return getOfficialHolidayDates(year);
}

function getCustomHolidays(dateStr) {
    const monthDay = dateStr.slice(5);
    return db.prepare(`
        SELECT * FROM custom_holidays
        WHERE (date = ? AND recurring = 0)
           OR (recurring = 1 AND substr(date, 6) = ?)
    `).all(dateStr, monthDay);
}

/**
 * Tjekker om et tidspunkt ligger på en officiel eller brugerdefineret helligdag.
 * Uden minuteOfDay bevares den tidligere boolske dagskontrol.
 */
function isHoliday(dateStr, minuteOfDay = null) {
    assertDate(dateStr);
    const year = Number(dateStr.slice(0, 4));
    if (getDanishHolidays(year).includes(dateStr)) return true;

    const customHolidays = getCustomHolidays(dateStr);
    if (minuteOfDay == null) return customHolidays.length > 0;

    return customHolidays.some(holiday => {
        if (holiday.all_day) return true;
        if (!holiday.start_time || !holiday.end_time) return false;
        try {
            const start = parseTimeMinutes(holiday.start_time);
            const end = parseTimeMinutes(holiday.end_time);
            return start < end && minuteOfDay >= start && minuteOfDay < end;
        } catch {
            return false;
        }
    });
}

function getDayOfWeek(dateStr) {
    return dateFromString(dateStr).getUTCDay();
}

function roundUpToQuarter(minutes) {
    return Math.ceil(minutes / QUARTER_MINUTES) * QUARTER_MINUTES;
}

function addSupplement(result, dateStr, minuteOfDay, hours) {
    const dayOfWeek = getDayOfWeek(dateStr);

    if (dayOfWeek === 0 || isHoliday(dateStr, minuteOfDay)) {
        result.sunday_holiday_hours += hours;
        return;
    }

    if (dayOfWeek === 6) {
        if (minuteOfDay < 6 * 60) {
            result.night_hours += hours;
        } else if (minuteOfDay >= 8 * 60) {
            result.saturday_hours += hours;
        }
        return;
    }

    if (minuteOfDay < 6 * 60 || minuteOfDay >= 23 * 60) {
        result.night_hours += hours;
    } else if (minuteOfDay >= 17 * 60) {
        result.evening_hours += hours;
    }
}

/**
 * Beregn tillæg for en registrering.
 * Tider rundes op til nærmeste kvarter som hidtil, men datoovergange
 * klassificeres efter den faktiske kalenderdag.
 */
export function calculateAllowances(dateStr, startTime, endTime) {
    assertDate(dateStr);
    assertTimeRange(startTime, endTime);

    const rawStart = parseTimeMinutes(startTime);
    const rawEnd = parseTimeMinutes(endTime);
    const crossesMidnight = rawEnd < rawStart;
    const roundedStart = roundUpToQuarter(rawStart);
    const roundedEnd = roundUpToQuarter(rawEnd) + (crossesMidnight ? MINUTES_PER_DAY : 0);

    if (roundedEnd <= roundedStart) {
        throw new ValidationError('Tidsrummet giver ingen registrerbare timer efter kvartersafrunding');
    }

    const totalMinutes = roundedEnd - roundedStart;
    if (totalMinutes >= MINUTES_PER_DAY) {
        throw new ValidationError('En registrering skal være kortere end 24 timer');
    }

    const result = {
        normal_hours: totalMinutes / 60,
        evening_hours: 0,
        night_hours: 0,
        saturday_hours: 0,
        sunday_holiday_hours: 0,
        total_hours: totalMinutes / 60
    };

    for (let absoluteMinute = roundedStart; absoluteMinute < roundedEnd; absoluteMinute += QUARTER_MINUTES) {
        const dateOffset = Math.floor(absoluteMinute / MINUTES_PER_DAY);
        const minuteOfDay = absoluteMinute % MINUTES_PER_DAY;
        addSupplement(
            result,
            addDaysToString(dateStr, dateOffset),
            minuteOfDay,
            QUARTER_MINUTES / 60
        );
    }

    return roundResult(result);
}

function roundResult(result) {
    for (const key of Object.keys(result)) {
        result[key] = Math.round(result[key] * 100) / 100;
    }
    return result;
}

export { getDanishHolidays, isHoliday };
