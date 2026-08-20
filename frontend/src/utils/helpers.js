// Formater dato til dansk format med bindestreg (dd-mm-yyyy)
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Formater dato og tid med bindestreg og kolon (dd-mm-yyyy HH:MM)
export function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

// Oversæt status
export function translateStatus(status) {
    const translations = {
        pending: 'Afventer godkendelse',
        approved: 'Godkendt',
        rejected: 'Afvist'
    };
    return translations[status] || status;
}

// Oversæt bevillingstype
export function translateGrantType(type) {
    const translations = {
        week: 'Uge',
        month: 'Måned',
        quarter: 'Kvartal',
        half_year: 'Halvår',
        year: 'År',
        specific_weekdays: 'Specifikke ugedage'
    };
    return translations[type] || type;
}

// Oversæt ugedag
export function translateWeekday(weekday) {
    const translations = {
        monday: 'Mandag',
        tuesday: 'Tirsdag',
        wednesday: 'Onsdag',
        thursday: 'Torsdag',
        friday: 'Fredag',
        saturday: 'Lørdag',
        sunday: 'Søndag'
    };
    return translations[weekday] || weekday;
}

// Beregn bevillingsstatus (percentage)
export function calculateGrantPercentage(used, total) {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}

// Få farve baseret på bevillingsstatus
export function getGrantStatusColor(percentage) {
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'yellow';
    return 'green';
}

// Formater timer i decimalformat (0,25 = 15 min, 0,50 = 30 min, 0,75 = 45 min, 1,00 = 1 time)
export function formatHours(hours) {
    const h = hours || 0;
    // Rund til nærmeste 0,25
    const rounded = Math.round(h * 4) / 4;
    return rounded.toFixed(2).replace('.', ',');
}

// Formater MA-nummer til præcis 8 cifre med foranstillede 0'er
export function padMaNumber(value) {
    if (!value) return '00000000';
    const cleaned = String(value).replace(/\D/g, '').slice(0, 8);
    return cleaned.padStart(8, '0');
}

// Initialer til avatar-cirkler ("Bjørn Skalkam" -> "BS").
export function initialsOf(name) {
    if (!name) return '?';
    const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '?';
}
