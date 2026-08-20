const calendarCache = new Map();
const officialDateCache = new Map();

function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

export function getOfficialHolidayFallback(year) {
    const easter = easterSunday(year);
    return [
        [`${year}-01-01`, 'Nytårsdag'],
        [isoDate(addDays(easter, -3)), 'Skærtorsdag'],
        [isoDate(addDays(easter, -2)), 'Langfredag'],
        [isoDate(easter), 'Påskedag'],
        [isoDate(addDays(easter, 1)), '2. påskedag'],
        [isoDate(addDays(easter, 39)), 'Kristi himmelfartsdag'],
        [isoDate(addDays(easter, 49)), 'Pinsedag'],
        [isoDate(addDays(easter, 50)), '2. pinsedag'],
        [`${year}-12-25`, 'Juledag'],
        [`${year}-12-26`, '2. juledag']
    ].map(([date, name]) => ({
        date,
        name,
        fullName: name,
        isPublicHoliday: true,
        isNotable: false,
        isChurch: true,
        wikiLink: null,
        source: 'local-fallback'
    }));
}

function getCalendarFallback(year) {
    const notable = [
        [`${year}-05-01`, '1. maj'],
        [`${year}-06-05`, 'Grundlovsdag'],
        [`${year}-12-24`, 'Juleaftensdag'],
        [`${year}-12-31`, 'Nytårsaftensdag']
    ].map(([date, name]) => ({
        date,
        name,
        fullName: name,
        isPublicHoliday: false,
        isNotable: true,
        isChurch: false,
        wikiLink: null,
        source: 'local-fallback'
    }));
    return [...getOfficialHolidayFallback(year), ...notable]
        .sort((a, b) => a.date.localeCompare(b.date));
}

function mapKalendarium(data) {
    const holidays = data
        .filter(item => item.holliday === 'True' || item.merke === 'True')
        .map(item => ({
            date: item.date,
            formattedDate: item.formattedDate,
            name: item.danishShort,
            fullName: item.danishLong,
            isPublicHoliday: item.holliday === 'True',
            isChurch: item.kirke === 'True',
            isNotable: item.merke === 'True',
            wikiLink: item.wikiLink ? `https://da.wikipedia.org/wiki/${item.wikiLink}` : null,
            source: 'kalendarium'
        }))
        .filter((item, index, all) => (
            all.findIndex(other => other.date === item.date && other.name === item.name) === index
        ))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (!holidays.some(item => item.isPublicHoliday)) {
        throw new Error('Kalendarium returnerede ingen officielle helligdage');
    }
    return holidays;
}

function cacheCalendar(year, holidays) {
    calendarCache.set(year, holidays);
    officialDateCache.set(year, new Set(
        holidays.filter(item => item.isPublicHoliday).map(item => item.date)
    ));
}

export async function getHolidayCalendar(year, { refresh = false } = {}) {
    if (!refresh && calendarCache.has(year)) return calendarCache.get(year);

    try {
        const response = await fetch(`https://api.kalendarium.dk/CalendarList/${year}`, {
            headers: { 'User-Agent': 'BarnepigeTR/1.0' },
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const holidays = mapKalendarium(await response.json());
        cacheCalendar(year, holidays);
        return holidays;
    } catch (error) {
        console.error('Fejl ved hentning fra Kalendarium API:', error.message);
        const fallback = getCalendarFallback(year);
        cacheCalendar(year, fallback);
        return fallback;
    }
}

export function getOfficialHolidayDates(year) {
    if (officialDateCache.has(year)) return [...officialDateCache.get(year)];
    return getOfficialHolidayFallback(year).map(item => item.date);
}
