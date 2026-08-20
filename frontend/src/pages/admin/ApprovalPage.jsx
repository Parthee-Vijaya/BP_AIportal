import { useState, useEffect } from 'react';
import { timeEntriesApi, childrenApi, caregiversApi, exportApi, settingsApi } from '../../utils/api';
import { formatHours, padMaNumber } from '../../utils/helpers';
import DialogShell from '../../components/DialogShell';

// Icons
const ClockIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const XIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const CheckMarkIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const WarningIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const UserIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const TableIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CardIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const SortIcon = ({ direction }) => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {direction === 'asc' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : direction === 'desc' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        )}
    </svg>
);

// Kort datoformat (dd/mm/åå)
function formatShortDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Dag navn
function getDayName(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('da-DK', { weekday: 'short' });
}

function formatChildAge(dateString) {
    if (!dateString) return null;
    const birthDate = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayHasPassed = today.getMonth() > birthDate.getMonth()
        || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!birthdayHasPassed) age -= 1;
    return age >= 0 ? `${age} år` : null;
}

function isValidMonthInterval({ start_day, end_day }) {
    return (start_day === 1 && end_day === 31)
        || (start_day >= 2 && start_day <= 28 && end_day === start_day - 1);
}

// Sorterbar kolonneheader
function SortableHeader({ label, sortKey, currentSort, onSort, className = '' }) {
    const isActive = currentSort.key === sortKey;
    const isRight = className.includes('text-right');
    return (
        <th
            className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
            onClick={() => onSort(sortKey)}
        >
            <div className={`flex items-center gap-1 ${isRight ? 'justify-end' : ''}`}>
                {label}
                {isActive && <SortIcon direction={currentSort.direction} />}
            </div>
        </th>
    );
}

export default function ApprovalPage({ isMobileView = false, approver = null, permissions = [], roleLabel = 'Godkender' }) {
    const currentActor = approver?.name || 'Godkender (demo)';
    const canExport = permissions.includes('export_reports');
    const canManageSettings = permissions.includes('manage_settings');
    const [activeTab, setActiveTab] = useState('pending');
    const [entries, setEntries] = useState([]);
    const [children, setChildren] = useState([]);
    const [childrenMap, setChildrenMap] = useState({});
    const [caregivers, setCaregivers] = useState([]);
    const [grantSummaries, setGrantSummaries] = useState({});
    const [selectedChild, setSelectedChild] = useState('all');
    const [selectedCaregiver, setSelectedCaregiver] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [rejectModal, setRejectModal] = useState({ open: false, entryId: null });
    const [rejectReason, setRejectReason] = useState('');
    const [viewReasonModal, setViewReasonModal] = useState({ open: false, reason: '', entry: null });
    const [payrollModal, setPayrollModal] = useState({ open: false, entryId: null, payrollDate: new Date().toISOString().slice(0, 10) });
    const [isCompactView, setIsCompactView] = useState(true);
    const [page, setPage] = useState(1);

    // Sorterings-state: key + direction (default sættes pr. tab)
    const [sortConfig, setSortConfig] = useState({ key: 'caregiver_name', direction: 'asc' });

    // Samme periodefilter anvendes på alle statusfaner.
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Månedsinterval indstillinger
    const [monthInterval, setMonthInterval] = useState({ start_day: 1, end_day: 31 });
    const [showMonthIntervalModal, setShowMonthIntervalModal] = useState(false);
    const [newMonthInterval, setNewMonthInterval] = useState({ start_day: 1, end_day: 31 });
    const monthIntervalIsValid = isValidMonthInterval(newMonthInterval);

    // Automatisk kompakt visning på mobil
    const effectiveCompactView = isMobileView || isCompactView;

    // Standardsortering pr. tab: Afventer/afviste = barnepige, Godkendte = barn
    useEffect(() => {
        if (activeTab === 'pending' || activeTab === 'rejected') {
            setSortConfig({ key: 'caregiver_name', direction: 'asc' });
        } else if (activeTab === 'approved') {
            setSortConfig({ key: 'child_name', direction: 'asc' });
        }
    }, [activeTab]);

    useEffect(() => {
        loadData();
    }, [activeTab, selectedChild, selectedCaregiver, fromDate, toDate]);

    useEffect(() => {
        loadMonthInterval();
    }, []);

    async function loadMonthInterval() {
        try {
            const data = await settingsApi.getMonthInterval();
            setMonthInterval(data);
            setNewMonthInterval({ start_day: data.start_day, end_day: data.end_day });
        } catch (error) {
            console.error('Fejl ved hentning af månedsinterval:', error);
        }
    }

    async function handleSaveMonthInterval() {
        if (!monthIntervalIsValid) {
            alert('Vælg 1-31 eller en sammenhængende forskudt måned, fx 16-15.');
            return;
        }
        try {
            await settingsApi.updateMonthInterval(newMonthInterval.start_day, newMonthInterval.end_day);
            setShowMonthIntervalModal(false);
            loadMonthInterval();
            alert(`Månedsinterval ændret til d. ${newMonthInterval.start_day} - d. ${newMonthInterval.end_day}.\nGælder fra i dag og frem.`);
        } catch (error) {
            alert('Fejl: ' + error.message);
        }
    }

    async function loadData() {
        setLoading(true);
        try {
            const params = { status: activeTab };
            if (selectedChild !== 'all') {
                params.child_id = selectedChild;
            }
            if (selectedCaregiver !== 'all') {
                params.caregiver_id = selectedCaregiver;
            }
            if (fromDate) {
                params.from_date = fromDate;
            }
            if (toDate) {
                params.to_date = toDate;
            }

            const [entriesData, childrenData, caregiversData] = await Promise.all([
                timeEntriesApi.getAll(params),
                childrenApi.getAll(),
                caregiversApi.getAll()
            ]);

            setEntries(entriesData);
            setChildren(childrenData);
            setCaregivers(caregiversData);

            const cMap = {};
            childrenData.forEach(c => { cMap[c.id] = c; });
            setChildrenMap(cMap);

            const summaries = Object.fromEntries(
                childrenData
                    .filter(child => child.grantSummary)
                    .map(child => [child.id, child.grantSummary])
            );
            setGrantSummaries(summaries);
            setChildrenMap({ ...cMap });
        } catch (error) {
            console.error('Fejl ved indlæsning:', error);
        } finally {
            setLoading(false);
        }
    }

    // Sorteringsfunktion
    function handleSort(key) {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }

    function resetFilters() {
        setSearchQuery('');
        setSelectedChild('all');
        setSelectedCaregiver('all');
        setFromDate('');
        setToDate('');
        if (activeTab === 'pending' || activeTab === 'rejected') {
            setSortConfig({ key: 'caregiver_name', direction: 'asc' });
        } else if (activeTab === 'approved') {
            setSortConfig({ key: 'child_name', direction: 'asc' });
        }
    }

    function getSortValue(entry, key) {
        switch (key) {
            case 'caregiver_name':
                return `${entry.caregiver_first_name} ${entry.caregiver_last_name}`.toLowerCase();
            case 'child_name':
                return `${entry.child_first_name} ${entry.child_last_name}`.toLowerCase();
            case 'date':
                return entry.date;
            case 'time':
                return entry.start_time;
            case 'total_hours':
                return entry.total_hours;
            case 'ma_number':
                return entry.ma_number || '';
            case 'payroll_date':
                return entry.payroll_date || 'zzz';
            default:
                return '';
        }
    }

    const filteredEntries = entries
        .filter(entry => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const caregiverName = `${entry.caregiver_first_name} ${entry.caregiver_last_name}`.toLowerCase();
            const childName = `${entry.child_first_name} ${entry.child_last_name}`.toLowerCase();
            const maNumber = padMaNumber(entry.ma_number || '').toLowerCase();
            return caregiverName.includes(query) || childName.includes(query) || maNumber.includes(query);
        })
        .sort((a, b) => {
            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);
            const direction = sortConfig.direction === 'asc' ? 1 : -1;
            if (typeof aVal === 'number') return (aVal - bVal) * direction;
            return aVal.localeCompare(bVal, 'da') * direction;
        });

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    const visibleEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        setPage(1);
    }, [activeTab, searchQuery, selectedChild, selectedCaregiver, fromDate, toDate, sortConfig.key, sortConfig.direction]);

    async function handleApprove(entryOrId) {
        const entry = typeof entryOrId === 'object' ? entryOrId : entries.find(item => item.id === entryOrId);
        const id = entry?.id ?? entryOrId;
        if (entry && getGrantStatus(entry)?.isExceeded) {
            const confirmed = confirm('Registreringen overskrider bevillingen. Vil du godkende den alligevel? Handlingen registreres i auditloggen.');
            if (!confirmed) return;
        }
        try {
            await timeEntriesApi.approve(id, currentActor);
            loadData();
        } catch (error) {
            alert('Fejl ved godkendelse: ' + error.message);
        }
    }

    async function handleReject() {
        if (!rejectReason.trim()) {
            alert('Angiv venligst en årsag');
            return;
        }

        try {
            await timeEntriesApi.reject(rejectModal.entryId, currentActor, rejectReason);
            setRejectModal({ open: false, entryId: null });
            setRejectReason('');
            loadData();
        } catch (error) {
            alert('Fejl ved afvisning: ' + error.message);
        }
    }

    async function handleBatchApprove() {
        if (selectedIds.length === 0) {
            alert('Vælg mindst én registrering');
            return;
        }

        try {
            await timeEntriesApi.batchApprove(selectedIds, currentActor);
            setSelectedIds([]);
            loadData();
        } catch (error) {
            alert('Fejl ved batch-godkendelse: ' + error.message);
        }
    }

    function openPayrollModal(entryId) {
        setPayrollModal({ open: true, entryId, payrollDate: new Date().toISOString().slice(0, 10) });
    }

    async function handleMarkPayroll() {
        if (!payrollModal.entryId) return;
        try {
            await timeEntriesApi.markPayroll(payrollModal.entryId, payrollModal.payrollDate, currentActor);
            setPayrollModal({ open: false, entryId: null, payrollDate: new Date().toISOString().slice(0, 10) });
            loadData();
        } catch (error) {
            alert('Fejl: ' + error.message);
        }
    }

    function toggleSelect(id) {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    }

    function toggleSelectAll() {
        const safeEntries = filteredEntries.filter(entry => !getGrantStatus(entry)?.isExceeded);
        if (selectedIds.length === safeEntries.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(safeEntries.map(e => e.id));
        }
    }

    const tabs = [
        { id: 'pending', label: 'Afventer', icon: <ClockIcon />, count: entries.length },
        { id: 'approved', label: 'Godkendte', icon: <CheckIcon /> },
        { id: 'rejected', label: 'Afviste', icon: <XIcon /> }
    ];

    function getGrantStatus(entry) {
        const summary = entry.grant_status || grantSummaries[entry.child_id];
        if (!summary) return null;

        if (summary.grantType === 'specific_weekdays' && summary.weekdays) {
            let totalGrant = 0;
            let totalUsed = 0;
            let anyExceeded = false;

            Object.values(summary.weekdays).forEach(day => {
                totalGrant += day.effectiveGrantHours ?? day.grantHours;
                totalUsed += day.usedHours;
                if (day.exceeded) anyExceeded = true;
            });

            const percentage = totalGrant > 0 ? (totalUsed / totalGrant) * 100 : 0;

            return {
                usedHours: totalUsed,
                grantHours: totalGrant,
                percentage,
                isExceeded: anyExceeded || percentage > 100,
                periodStart: summary.periodStart,
                periodEnd: summary.periodEnd,
                source: entry.grant_source
            };
        }

        const grantHours = summary.effectiveGrantHours ?? summary.grantHours;
        const percentage = grantHours > 0
            ? (summary.usedHours / grantHours) * 100
            : 0;

        return {
            usedHours: summary.usedHours,
            grantHours,
            percentage,
            isExceeded: summary.exceeded || percentage > 100,
            periodStart: summary.periodStart,
            periodEnd: summary.periodEnd,
            source: entry.grant_source,
            baseGrantHours: summary.baseGrantHours,
            baseUsedHours: summary.baseUsedHours,
            extraGrantHours: summary.extraGrantHours || 0,
            extraUsedHours: summary.extraUsedHours || 0,
            extraRemainingHours: summary.extraRemainingHours || 0,
            extraGrants: summary.extraGrants || []
        };
    }

    function formatTimeBreakdown(entry) {
        const parts = [];
        // Normaltimer vises kun i de samlede tal, ikke som tillægs-badge
        if (entry.evening_hours > 0) parts.push({ label: 'Aften', value: entry.evening_hours, color: 'border border-stone-300 bg-white text-slate-700' });
        if (entry.night_hours > 0) parts.push({ label: 'Nat', value: entry.night_hours, color: 'border border-stone-300 bg-white text-slate-700' });
        if (entry.saturday_hours > 0) parts.push({ label: 'Lørdag', value: entry.saturday_hours, color: 'border border-stone-300 bg-white text-slate-700' });
        if (entry.sunday_holiday_hours > 0) parts.push({ label: 'Søn/Hellig', value: entry.sunday_holiday_hours, color: 'border border-stone-300 bg-white text-slate-700' });
        return parts;
    }

    // Beregn opsummering af alle timer
    function calculateSummary(entries) {
        return entries.reduce((acc, entry) => ({
            totalHours: acc.totalHours + (entry.total_hours || 0),
            normalHours: acc.normalHours + (entry.normal_hours || 0),
            eveningHours: acc.eveningHours + (entry.evening_hours || 0),
            nightHours: acc.nightHours + (entry.night_hours || 0),
            saturdayHours: acc.saturdayHours + (entry.saturday_hours || 0),
            sundayHours: acc.sundayHours + (entry.sunday_holiday_hours || 0),
            count: acc.count + 1
        }), {
            totalHours: 0, normalHours: 0, eveningHours: 0,
            nightHours: 0, saturdayHours: 0, sundayHours: 0, count: 0
        });
    }

    // Beregn opsummering for aktuelle filtrerede entries
    const summary = calculateSummary(filteredEntries);

    // Beregn statistik - kun overskridelser
    const exceededCount = filteredEntries.filter(e => getGrantStatus(e)?.isExceeded).length;

    return (
        <div className="space-y-6">
            {/* Header - compact single line */}
            <div className="page-heading mb-0 animate-fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="eyebrow">{roleLabel}</div>
                        <h1>Godkendelse af timer</h1>
                        <p>Gennemgå, godkend eller afvis registrerede timer.</p>
                        {activeTab === 'pending' && filteredEntries.length > 0 && (
                            <div className="mt-3 flex items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 border-r border-stone-300 pr-3 text-xs">
                                    <span className="font-semibold text-gray-900">{filteredEntries.length}</span>
                                    <span className="text-gray-500">afventer</span>
                                </span>
                                {exceededCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-red-800">
                                        <span className="font-semibold">{exceededCount}</span>
                                        <span>overskrider</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="approval-header-actions flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        {canManageSettings && (
                            <button
                                onClick={() => setShowMonthIntervalModal(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium text-xs"
                                title="Indstil månedsinterval"
                            >
                                <SettingsIcon />
                                <span className="hidden sm:inline">d. {monthInterval.start_day}-{monthInterval.end_day}</span>
                            </button>
                        )}
                        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                            <button
                                onClick={() => setIsCompactView(false)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    !effectiveCompactView
                                        ? 'bg-white text-[#B54A32] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <CardIcon />
                                Detaljeret
                            </button>
                            <button
                                onClick={() => setIsCompactView(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    effectiveCompactView
                                        ? 'bg-white text-[#B54A32] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <TableIcon />
                                Kompakt
                            </button>
                        </div>
                        {canExport && (
                            <a
                                href={exportApi.timeEntries({ status: activeTab })}
                                download
                                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                            >
                                <DownloadIcon />
                                CSV
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="surface overflow-clip rounded-lg animate-fade-in-up">
                {/* Sticky wrapper for tabs + summary + filters */}
                <div className="sticky top-[72px] z-20 bg-white">
                {/* Tabs */}
                <div className="flex overflow-x-auto rounded-t-2xl border-b border-gray-200 bg-gray-50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex min-w-fit flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all sm:flex-none sm:px-6 ${
                                activeTab === tab.id
                                    ? 'text-[#B54A32]'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            <span className={activeTab === tab.id ? 'text-[#B54A32]' : 'text-gray-400'}>
                                {tab.icon}
                            </span>
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#A6402C]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Summary Card - Kompakt inline design */}
                {filteredEntries.length > 0 && (
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                            {/* Hovedtal */}
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Opsummering:</span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                                    <span className="text-sm font-semibold text-gray-900">{summary.count}</span>
                                    <span className="text-xs text-gray-500">stk</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B54A32]/10 rounded-lg border border-[#B54A32]/20">
                                    <span className="text-sm font-bold text-[#B54A32]">{formatHours(summary.totalHours)}</span>
                                    <span className="text-xs text-[#B54A32]/70">normaltimer</span>
                                </span>
                            </div>
                            {/* Separator */}
                            <div className="hidden sm:block h-4 w-px bg-gray-300"></div>
                            {/* Tillægsfordeling med navne (kun tillægstyper) */}
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-4">
                                <span className="text-gray-400">Fordeling:</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-gray-500">Aften:</span>
                                <span className="font-semibold text-slate-800">{formatHours(summary.eveningHours)}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-gray-500">Nat:</span>
                                <span className="font-semibold text-slate-800">{formatHours(summary.nightHours)}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-gray-500">Lørdag:</span>
                                <span className="font-semibold text-slate-800">{formatHours(summary.saturdayHours)}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-gray-500">Søn/Hellig:</span>
                                <span className="font-semibold text-slate-800">{formatHours(summary.sundayHours)}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="border-b border-gray-200 bg-white p-4">
                    <div className="approval-filter-grid">
                        <div className="relative min-w-0">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <SearchIcon />
                            </div>
                            <input
                                type="text"
                                aria-label="Søg på navn eller MA-nummer"
                                placeholder="Søg navn eller MA-nr."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30 transition-all"
                            />
                        </div>

                        <select
                            value={selectedChild}
                            onChange={(e) => setSelectedChild(e.target.value)}
                            aria-label="Filtrer efter barn"
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20"
                        >
                            <option value="all">Alle børn</option>
                            {children.map((child) => (
                                <option key={child.id} value={child.id}>
                                    {child.first_name} {child.last_name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedCaregiver}
                            onChange={(e) => setSelectedCaregiver(e.target.value)}
                            aria-label="Filtrer efter barnepige"
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20"
                        >
                            <option value="all">Alle barnepiger</option>
                            {caregivers.map((cg) => (
                                <option key={cg.id} value={cg.id}>
                                    {cg.first_name} {cg.last_name}
                                </option>
                            ))}
                        </select>

                        {/* Sortering */}
                        <div className="flex min-w-0 items-center gap-2">
                            <label htmlFor="approval-sort" className="shrink-0 text-xs font-medium text-gray-500">Sortér:</label>
                            <select
                                id="approval-sort"
                                value={`${sortConfig.key}-${sortConfig.direction}`}
                                onChange={(e) => {
                                    const [key, direction] = e.target.value.split('-');
                                    setSortConfig({ key, direction });
                                }}
                                className="min-w-0 flex-1 px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20"
                            >
                                <option value="date-desc">Dato (nyeste først)</option>
                                <option value="date-asc">Dato (ældste først)</option>
                                <option value="caregiver_name-asc">Barnepige (A-Å)</option>
                                <option value="caregiver_name-desc">Barnepige (Å-A)</option>
                                <option value="child_name-asc">Barn (A-Å)</option>
                                <option value="child_name-desc">Barn (Å-A)</option>
                                <option value="total_hours-desc">Timer (flest først)</option>
                                <option value="total_hours-asc">Timer (færrest først)</option>
                            </select>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                            <label htmlFor="filter-from-date" className="shrink-0 text-xs font-medium text-gray-500">Fra:</label>
                            <input id="filter-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-w-0 flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20" />
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                            <label htmlFor="filter-to-date" className="shrink-0 text-xs font-medium text-gray-500">Til:</label>
                            <input id="filter-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-w-0 flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#B54A32]/20" />
                        </div>

                        {/* Generel nulstil-knap for filtre */}
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="min-h-11 whitespace-nowrap px-3 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50"
                        >
                            Nulstil filtre
                        </button>

                    </div>
                    {activeTab === 'pending' && filteredEntries.length > 0 && (
                            <div className="approval-batch mt-3 flex items-center justify-end gap-3 border-t border-stone-200 pt-3">
                                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.filter(entry => !getGrantStatus(entry)?.isExceeded).length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32] w-4 h-4"
                                    />
                                    Vælg uden advarsler
                                </label>
                                <button
                                    onClick={handleBatchApprove}
                                    disabled={selectedIds.length === 0}
                                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CheckMarkIcon />
                                    Godkend valgte ({selectedIds.length})
                                </button>
                            </div>
                        )}
                </div>
                </div>{/* End sticky wrapper */}

                {/* Content */}
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-3 border-white/30 border-t-[#B54A32] mx-auto"></div>
                        <p className="text-gray-500 mt-4 font-medium">Indlæser registreringer...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30 text-white">
                            <CheckIcon />
                        </div>
                        <p className="text-gray-700 font-semibold text-lg">
                            {searchQuery ? 'Ingen resultater fundet' : 'Ingen registreringer'}
                        </p>
                        <p className="text-gray-500 mt-2">
                            {searchQuery ? 'Prøv at justere din søgning' : 'Der er ingen registreringer i denne kategori'}
                        </p>
                    </div>
                ) : effectiveCompactView ? (
                    /* COMPACT TABLE VIEW */
                    <div>
                        <table className="responsive-table">
                            <thead className="bg-white/95 backdrop-blur-sm sticky top-[305px] z-10 shadow-sm">
                                <tr>
                                    {activeTab === 'pending' && (
                                        <th className="px-4 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length > 0 && selectedIds.length === filteredEntries.filter(entry => !getGrantStatus(entry)?.isExceeded).length}
                                                onChange={toggleSelectAll}
                                                aria-label="Vælg alle registreringer uden bevillingsadvarsler"
                                                className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]"
                                            />
                                        </th>
                                    )}
                                    <SortableHeader label="Barnepige" sortKey="caregiver_name" currentSort={sortConfig} onSort={handleSort} className="text-left" />
                                    <SortableHeader label="Barn" sortKey="child_name" currentSort={sortConfig} onSort={handleSort} className="text-left" />
                                    <SortableHeader label="Dato" sortKey="date" currentSort={sortConfig} onSort={handleSort} className="text-left" />
                                    <SortableHeader label="Tid" sortKey="time" currentSort={sortConfig} onSort={handleSort} className="text-left" />
                                    <SortableHeader label="Timer" sortKey="total_hours" currentSort={sortConfig} onSort={handleSort} className="text-center" />
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tillæg</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bevilling</th>
                                    {activeTab === 'approved' && (
                                        <SortableHeader label="Overført til løn" sortKey="payroll_date" currentSort={sortConfig} onSort={handleSort} className="text-left w-44" />
                                    )}
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Handlinger</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleEntries.map((entry) => {
                                    const grantStatus = getGrantStatus(entry);
                                    const isExceeded = grantStatus?.isExceeded;
                                    const timeBreakdown = formatTimeBreakdown(entry);

                                    return (
                                        <tr
                                            key={entry.id}
                                            className={`
                                                transition-colors
                                                ${activeTab === 'pending' && isExceeded
                                                    ? 'approval-row-warning hover:bg-stone-50'
                                                    : 'hover:bg-stone-50'
                                                }
                                            `}
                                        >
                                            {activeTab === 'pending' && (
                                                <td data-label="" className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(entry.id)}
                                                        onChange={() => toggleSelect(entry.id)}
                                                        disabled={isExceeded}
                                                        aria-label={isExceeded ? 'Kan ikke massevælges på grund af bevillingsoverskridelse' : `Vælg registrering ${entry.id}`}
                                                        className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]"
                                                    />
                                                </td>
                                            )}
                                            <td data-label="Barnepige" className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedCaregiver(String(entry.caregiver_id))}
                                                    className="text-left font-medium text-sm text-[#B54A32] hover:underline focus:outline-none focus:ring-2 focus:ring-[#B54A32]/30 rounded"
                                                >
                                                    {entry.caregiver_first_name} {entry.caregiver_last_name}
                                                </button>
                                                <div className="text-xs text-gray-500 font-mono">{padMaNumber(entry.ma_number)}</div>
                                            </td>
                                            <td data-label="Barn" className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedChild(String(entry.child_id))}
                                                    className="text-left font-medium text-sm text-[#B54A32] hover:underline focus:outline-none focus:ring-2 focus:ring-[#B54A32]/30 rounded"
                                                >
                                                    {entry.child_first_name} {entry.child_last_name}
                                                </button>
                                                {formatChildAge(entry.child_birth_date) && (
                                                    <div className="text-xs text-gray-500">{formatChildAge(entry.child_birth_date)}</div>
                                                )}
                                            </td>
                                            <td data-label="Dato" className="px-4 py-3">
                                                <div className="text-sm text-gray-900">{formatShortDate(entry.date)}</div>
                                                <div className="text-xs text-gray-500 capitalize">{getDayName(entry.date)}</div>
                                            </td>
                                            <td data-label="Tid" className="px-4 py-3 text-sm text-gray-700">
                                                {entry.start_time?.slice(0,5)} - {entry.end_time?.slice(0,5)}
                                            </td>
                                            <td data-label="Timer" className="px-4 py-3 text-right">
                                                <span className="font-bold text-gray-900">{formatHours(entry.total_hours)}</span>
                                            </td>
                                            <td data-label="Tillæg" className="px-4 py-3">
                                                {/* Tillæg badges i kompakt visning */}
                                                {timeBreakdown.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {timeBreakdown.map((item, idx) => (
                                                            <span key={idx} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${item.color}`}>
                                                                {item.label}: {formatHours(item.value)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td data-label="Bevilling" className="px-4 py-3">
                                                {grantStatus && (
                                                    <div className="w-28 max-w-[7rem]">
                                                        <div className={`text-xs font-medium mb-1 ${
                                                            isExceeded ? 'text-red-800' : 'text-slate-800'
                                                        }`}>
                                                            {formatHours(grantStatus.usedHours)}/{formatHours(grantStatus.grantHours)}
                                                            {isExceeded && (
                                                                <span className="ml-1 text-rose-500" title="Overskrider bevilling">▲</span>
                                                            )}
                                                        </div>
                                                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                            {grantStatus.source === 'frame' ? 'Rammebevilling' : 'Normal bevilling'}
                                                        </div>
                                                        {grantStatus.periodStart && (
                                                            <div className="mb-1 text-[10px] text-gray-500">{formatShortDate(grantStatus.periodStart)} – {formatShortDate(grantStatus.periodEnd)}</div>
                                                        )}
                                                        {grantStatus.extraGrantHours > 0 && (
                                                            <div className="mb-1 text-[10px] font-semibold text-[#823322]">Ekstra {formatHours(grantStatus.extraUsedHours)}/{formatHours(grantStatus.extraGrantHours)} t.</div>
                                                        )}
                                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${
                                                                    isExceeded ? 'bg-[#A6402C]' : 'bg-slate-700'
                                                                }`}
                                                                style={{ width: `${Math.min(grantStatus.percentage, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {activeTab === 'approved' && (
                                                <td data-label="Overført til løn" className="px-4 py-3">
                                                    {entry.payroll_date ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="text-xs text-emerald-600 font-medium">
                                                                {new Date(entry.payroll_date).toLocaleString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Afventer</span>
                                                    )}
                                                </td>
                                            )}
                                            <td data-label="Handlinger" className="px-4 py-3 text-right">
                                                {activeTab === 'pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(entry)}
                                                            className="approval-action-primary"
                                                        >
                                                            Godkend
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectModal({ open: true, entryId: entry.id })}
                                                            className="approval-action-secondary"
                                                        >
                                                            Afvis
                                                        </button>
                                                    </div>
                                                )}
                                                {activeTab === 'approved' && !entry.payroll_date && (
                                                    <button
                                                        onClick={() => openPayrollModal(entry.id)}
                                                        className="px-3 py-1.5 bg-[#B54A32] text-white text-xs rounded-lg font-medium hover:bg-[#9a3f2b] transition-colors"
                                                    >
                                                        Indberettet manuelt
                                                    </button>
                                                )}
                                                {activeTab === 'approved' && entry.payroll_date && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg border border-emerald-100">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Indberettet
                                                    </span>
                                                )}
                                                {activeTab === 'rejected' && entry.rejection_reason && (
                                                    <span
                                                        className="text-rose-600 text-xs font-medium cursor-default"
                                                        title={entry.rejection_reason}
                                                    >
                                                        {entry.rejection_reason.length > 50
                                                            ? entry.rejection_reason.slice(0, 50) + '…'
                                                            : entry.rejection_reason
                                                        }
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* DETAILED CARD VIEW */
                    <div className="p-4">
                        <div className="grid gap-3">
                            {visibleEntries.map((entry) => {
                                const grantStatus = getGrantStatus(entry);
                                const childData = childrenMap[entry.child_id];
                                const isExceeded = grantStatus?.isExceeded;
                                const timeBreakdown = formatTimeBreakdown(entry);

                                return (
                                    <div
                                        key={entry.id}
                                        className={`
                                            relative rounded-xl border transition-all duration-200
                                            ${activeTab === 'pending' && isExceeded
                                                ? 'approval-card-warning bg-white border-stone-300'
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        {/* Bevilling overskredet notifikation */}
                                        {isExceeded && (
                                            <div className="border-b border-stone-200 px-6 py-2">
                                                <div className="flex items-center gap-2 text-red-800 text-xs font-bold">
                                                    <WarningIcon />
                                                    Det indtastede antal timer overskrider bevillingen. Det er godkender/leders opgave at sikre at det kan godkendes.
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4 pl-6">
                                            <div className="flex items-start gap-4">
                                                {/* Checkbox */}
                                                {activeTab === 'pending' && (
                                                    <div className="pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(entry.id)}
                                                            onChange={() => toggleSelect(entry.id)}
                                                            className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32] w-5 h-5"
                                                        />
                                                    </div>
                                                )}

                                                {/* Main content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        {/* Left side - People info */}
                                                        <div className="flex-1">

                                                            <div className="grid grid-cols-2 gap-4">
                                                                {/* Barnepige */}
                                                                <div>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                                        <UserIcon />
                                                                        Barnepige
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedCaregiver(String(entry.caregiver_id))}
                                                                        className="text-left font-semibold text-gray-900 hover:text-[#B54A32] hover:underline focus:outline-none focus:ring-2 focus:ring-[#B54A32]/30 rounded"
                                                                    >
                                                                        {entry.caregiver_first_name} {entry.caregiver_last_name}
                                                                    </button>
                                                                    <div className="text-xs text-gray-500 font-mono">{padMaNumber(entry.ma_number)}</div>
                                                                </div>

                                                                {/* Barn */}
                                                                <div>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                                        </svg>
                                                                        Barn
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedChild(String(entry.child_id))}
                                                                        className="text-left font-semibold text-gray-900 hover:text-[#B54A32] hover:underline focus:outline-none focus:ring-2 focus:ring-[#B54A32]/30 rounded"
                                                                    >
                                                                        {entry.child_first_name} {entry.child_last_name}
                                                                    </button>
                                                                    {formatChildAge(entry.child_birth_date) && (
                                                                        <div className="text-xs text-gray-500">{formatChildAge(entry.child_birth_date)}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right side - Time and Grant */}
                                                        <div className="text-right flex-shrink-0">
                                                            {/* Date and time */}
                                                            <div className="flex items-center gap-2 justify-end text-gray-500 text-sm mb-2">
                                                                <CalendarIcon />
                                                                <span className="capitalize">{getDayName(entry.date)}</span>
                                                                <span className="font-medium text-gray-700">{formatShortDate(entry.date)}</span>
                                                            </div>
                                                            <div className="text-lg font-semibold text-gray-700 mb-2">
                                                                {entry.start_time?.slice(0,5)} - {entry.end_time?.slice(0,5)}
                                                            </div>

                                                            {/* Total hours */}
                                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#B54A32] to-[#9a3f2b] text-white rounded-lg shadow-lg shadow-[#B54A32]/25">
                                                                <ClockIcon />
                                                                <span className="text-xl font-bold">{formatHours(entry.total_hours)}</span>
                                                                <span className="text-white/80 text-sm">timer</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bottom section - Breakdown and Grant status */}
                                                    <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-end justify-between gap-4">
                                                        {/* Time breakdown */}
                                                        <div className="flex-1">
                                                            <div className="text-xs text-gray-500 mb-2">Timefordeling</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {timeBreakdown.map((item, idx) => (
                                                                    <span key={idx} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${item.color}`}>
                                                                        {item.label}: {formatHours(item.value)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Grant status */}
                                                        {grantStatus && (
                                                            <div className="flex-shrink-0 w-48">
                                                                <div className="text-xs text-gray-500 mb-1 text-right">Bevillingsstatus</div>
                                                                <div className="mb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                                    {grantStatus.source === 'frame' ? 'Rammebevilling' : 'Normal bevilling'}
                                                                </div>
                                                                <div className={`text-right font-semibold mb-1 ${
                                                                    isExceeded ? 'text-red-800' : 'text-slate-800'
                                                                }`}>
                                                                    {formatHours(grantStatus.usedHours)} / {formatHours(grantStatus.grantHours)} timer
                                                                </div>
                                                                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${
                                                                            isExceeded ? 'bg-[#A6402C]' : 'bg-slate-700'
                                                                        }`}
                                                                        style={{ width: `${Math.min(grantStatus.percentage, 100)}%` }}
                                                                    />
                                                                </div>
                                                                {grantStatus.periodStart && (
                                                                    <div className="mt-1 text-right text-[10px] text-gray-500">{formatShortDate(grantStatus.periodStart)} – {formatShortDate(grantStatus.periodEnd)}</div>
                                                                )}
                                                                {grantStatus.extraGrantHours > 0 && (
                                                                    <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-2 text-right text-[11px] text-slate-700">
                                                                        <div>Grundbevilling: {formatHours(grantStatus.baseUsedHours)} / {formatHours(grantStatus.baseGrantHours)} t.</div>
                                                                        <div className="font-semibold">Ekstra: {formatHours(grantStatus.extraUsedHours)} brugt · {formatHours(grantStatus.extraRemainingHours)} tilbage</div>
                                                                    </div>
                                                                )}
                                                                {isExceeded && (
                                                                    <div className="text-xs text-rose-600 font-bold mt-1 text-right">
                                                                        +{formatHours(grantStatus.usedHours - grantStatus.grantHours)} over grænsen
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Actions */}
                                                        {activeTab === 'pending' && (
                                                            <div className="flex gap-2 flex-shrink-0">
                                                                <button
                                                                    onClick={() => handleApprove(entry)}
                                                                    className="approval-action-primary flex items-center gap-2 px-5 py-2.5"
                                                                >
                                                                    <CheckMarkIcon />
                                                                    Godkend
                                                                </button>
                                                                <button
                                                                    onClick={() => setRejectModal({ open: true, entryId: entry.id })}
                                                                    className="approval-action-secondary flex items-center gap-2 px-5 py-2.5"
                                                                >
                                                                    <XIcon />
                                                                    Afvis
                                                                </button>
                                                            </div>
                                                        )}

                                                        {activeTab === 'approved' && (
                                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                                <div className="text-right">
                                                                    <div className="text-xs text-gray-500">Godkendt af</div>
                                                                    <div className="font-medium text-gray-700">{entry.reviewed_by}</div>
                                                                </div>
                                                                {entry.payroll_date ? (
                                                                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                                                                        Sendt {formatShortDate(entry.payroll_date)}
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => openPayrollModal(entry.id)}
                                                                        className="px-4 py-2 bg-[#B54A32] text-white rounded-lg font-medium hover:bg-[#9a3f2b] transition-all"
                                                                    >
                                                                        Send til løn
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activeTab === 'rejected' && (
                                                            <div className="flex-shrink-0 text-right">
                                                                <div className="text-xs text-gray-500 mb-1">Afvist af {entry.reviewed_by}</div>
                                                                <button
                                                                    onClick={() => setViewReasonModal({ open: true, reason: entry.rejection_reason, entry })}
                                                                    className="text-rose-600 hover:text-rose-700 text-sm font-medium underline"
                                                                >
                                                                    Se årsag
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Comment if exists */}
                                                    {entry.comment && (
                                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                            <div className="text-xs text-gray-500 mb-1">Kommentar</div>
                                                            <div className="text-sm text-gray-700">{entry.comment}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {filteredEntries.length > pageSize && (
                    <nav aria-label="Sider med registreringer" className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row">
                        <span className="text-sm text-slate-600">Viser {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredEntries.length)} af {filteredEntries.length}</span>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40">Forrige</button>
                            <span className="min-w-20 text-center text-sm font-semibold">Side {page} af {totalPages}</span>
                            <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40">Næste</button>
                        </div>
                    </nav>
                )}
            </div>

            {/* Reject Modal */}
            {rejectModal.open && (
                <DialogShell onClose={() => { setRejectModal({ open: false, entryId: null }); setRejectReason(''); }} labelledBy="reject-dialog-title" maxWidth="max-w-md" panelClassName="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                                <XIcon />
                            </div>
                            <h3 id="reject-dialog-title" className="text-xl font-bold text-gray-900">Afvis registrering</h3>
                        </div>
                        <label htmlFor="reject-reason" className="mb-2 block text-sm font-semibold text-gray-700">Begrundelse *</label>
                        <textarea
                            id="reject-reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Angiv årsag til afvisning..."
                            className="w-full border border-gray-200 rounded-xl p-4 h-32 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                        />
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={handleReject}
                                className="flex-1 px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl hover:from-rose-600 hover:to-rose-700 font-medium transition-all shadow-lg shadow-rose-500/25"
                            >
                                Afvis registrering
                            </button>
                            <button
                                onClick={() => {
                                    setRejectModal({ open: false, entryId: null });
                                    setRejectReason('');
                                }}
                                className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
                            >
                                Annuller
                            </button>
                        </div>
                </DialogShell>
            )}

            {/* View Rejection Reason Modal */}
            {viewReasonModal.open && (
                <DialogShell onClose={() => setViewReasonModal({ open: false, reason: '', entry: null })} labelledBy="reason-dialog-title" maxWidth="max-w-md" panelClassName="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                                <XIcon />
                            </div>
                            <div>
                                <h3 id="reason-dialog-title" className="text-lg font-bold text-gray-900">Afvisningsårsag</h3>
                                {viewReasonModal.entry && (
                                    <p className="text-sm text-gray-500">
                                        {viewReasonModal.entry.caregiver_first_name} {viewReasonModal.entry.caregiver_last_name} - {viewReasonModal.entry.child_first_name}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                            <p className="text-gray-800 whitespace-pre-wrap">{viewReasonModal.reason}</p>
                        </div>
                        {viewReasonModal.entry && (
                            <div className="text-sm text-gray-500 mb-4">
                                Afvist af <span className="font-medium">{viewReasonModal.entry.reviewed_by}</span> den {formatShortDate(viewReasonModal.entry.reviewed_at)}
                            </div>
                        )}
                        <button
                            onClick={() => setViewReasonModal({ open: false, reason: '', entry: null })}
                            className="w-full px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
                        >
                            Luk
                        </button>
                </DialogShell>
            )}

            {/* Månedsinterval Modal */}
            {showMonthIntervalModal && (
                <DialogShell onClose={() => setShowMonthIntervalModal(false)} labelledBy="month-dialog-title" maxWidth="max-w-md" panelClassName="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#B54A32] to-[#9a3f2b] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#B54A32]/30">
                                <SettingsIcon />
                            </div>
                            <div>
                                <h3 id="month-dialog-title" className="text-xl font-bold text-gray-900">Månedsinterval</h3>
                                <p className="text-sm text-gray-500">Indstil perioden for månedlige indberetninger</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                            <div className="flex items-start gap-2 text-amber-700 text-sm">
                                <WarningIcon />
                                <div>
                                    <div className="font-semibold">Bemærk</div>
                                    <div>Ændringer gælder fra d.d. og frem. Tidligere perioder påvirkes ikke.</div>
                                </div>
                            </div>
                        </div>

                        {/* Nuværende interval */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
                            <div className="text-xs text-gray-500 font-medium mb-1">Nuværende interval</div>
                            <div className="text-lg font-bold text-gray-900">
                                d. {monthInterval.start_day} - d. {monthInterval.end_day}
                            </div>
                            {monthInterval.effective_from && (
                                <div className="text-xs text-gray-500 mt-1">Gældende fra {monthInterval.effective_from}</div>
                            )}
                            {monthInterval.is_default && (
                                <div className="text-xs text-gray-400 mt-1">Standard (1. til sidste dag i md.)</div>
                            )}
                        </div>

                        {/* Nyt interval */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="month-start-day" className="block text-sm font-semibold text-gray-700 mb-2">Første dag i perioden</label>
                                    <input
                                        id="month-start-day"
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={newMonthInterval.start_day}
                                        onChange={(e) => setNewMonthInterval({ ...newMonthInterval, start_day: parseInt(e.target.value) || 1 })}
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="month-end-day" className="block text-sm font-semibold text-gray-700 mb-2">Sidste dag i perioden</label>
                                    <input
                                        id="month-end-day"
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={newMonthInterval.end_day}
                                        onChange={(e) => setNewMonthInterval({ ...newMonthInterval, end_day: parseInt(e.target.value) || 31 })}
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30"
                                    />
                                </div>
                            </div>
                            <div className={`text-sm ${monthIntervalIsValid ? 'text-gray-500' : 'font-semibold text-rose-700'}`}>
                                {monthIntervalIsValid
                                    ? `Periode: d. ${newMonthInterval.start_day} til d. ${newMonthInterval.end_day}`
                                    : 'Intervallet skal være 1-31 eller sammenhængende, fx 16-15 (startdag højst 28).'}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleSaveMonthInterval}
                                disabled={!monthIntervalIsValid}
                                className="flex-1 px-5 py-3 btn-kalundborg rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Gem ændring
                            </button>
                            <button
                                onClick={() => {
                                    setShowMonthIntervalModal(false);
                                    setNewMonthInterval({ start_day: monthInterval.start_day, end_day: monthInterval.end_day });
                                }}
                                className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
                            >
                                Annuller
                            </button>
                        </div>
                </DialogShell>
            )}

            {/* Registreret i løn – dato-modal */}
            {payrollModal.open && (
                <DialogShell onClose={() => setPayrollModal({ open: false, entryId: null, payrollDate: new Date().toISOString().slice(0, 10) })} labelledBy="payroll-dialog-title" maxWidth="max-w-sm" panelClassName="p-6">
                        <h3 id="payroll-dialog-title" className="text-lg font-bold text-gray-900 mb-2">Indberettet manuelt</h3>
                        <p className="text-sm text-gray-500 mb-4">Bekræft manuel indberetning til løn. Nuværende dato og tidspunkt registreres.</p>
                        <div className="flex gap-3">
                            <button onClick={handleMarkPayroll} className="flex-1 px-4 py-3 btn-kalundborg rounded-xl font-medium">
                                Gem
                            </button>
                            <button
                                onClick={() => setPayrollModal({ open: false, entryId: null, payrollDate: new Date().toISOString().slice(0, 10) })}
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
                            >
                                Annuller
                            </button>
                        </div>
                </DialogShell>
            )}
        </div>
    );
}
