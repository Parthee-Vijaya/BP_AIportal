import { useState, useEffect } from 'react';
import { holidaysApi } from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import DialogShell from '../../components/DialogShell';

const PlusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);
const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);
const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);
const CloseIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);
const ChevronLeftIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);
const ChevronRightIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);
const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);
const GlobeIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

const DANISH_WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

function formatDanishDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
    return `${day}. ${months[d.getMonth()]}`;
}

function getDayName(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return DANISH_WEEKDAYS[d.getDay()];
}

function isDatePast(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    return d < today;
}

function isDateToday(dateStr) {
    const today = new Date();
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export default function HolidaysPage() {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [kalendariumHolidays, setKalendariumHolidays] = useState([]);
    const [customHolidays, setCustomHolidays] = useState([]);
    const [loadingKalendarium, setLoadingKalendarium] = useState(true);
    const [loadingCustom, setLoadingCustom] = useState(true);
    const [kalendariumError, setKalendariumError] = useState(null);
    const [kalendariumSource, setKalendariumSource] = useState('kalendarium');
    const [activeTab, setActiveTab] = useState('official');
    const [modal, setModal] = useState({ open: false, holiday: null });
    const [formData, setFormData] = useState({ date: '', name: '', all_day: true, start_time: '', end_time: '', recurring: false });

    useEffect(() => {
        loadKalendarium(selectedYear);
    }, [selectedYear]);

    useEffect(() => {
        loadCustomHolidays();
    }, []);

    async function loadKalendarium(year) {
        setLoadingKalendarium(true);
        setKalendariumError(null);
        try {
            const data = await holidaysApi.getKalendarium(year);
            setKalendariumHolidays(data);
            setKalendariumSource(data.some(holiday => holiday.source === 'local-fallback') ? 'local-fallback' : 'kalendarium');
        } catch (e) {
            console.error('Fejl ved Kalendarium:', e);
            setKalendariumError('Kunne ikke hente officielle helligdage');
        } finally {
            setLoadingKalendarium(false);
        }
    }

    async function loadCustomHolidays() {
        setLoadingCustom(true);
        try {
            const data = await holidaysApi.getAll();
            setCustomHolidays(data);
        } catch (e) {
            console.error('Fejl:', e);
        } finally {
            setLoadingCustom(false);
        }
    }

    function openCreate() {
        setFormData({ date: '', name: '', all_day: true, start_time: '', end_time: '', recurring: false });
        setModal({ open: true, holiday: null });
    }

    function openEdit(h) {
        setFormData({
            date: h.date,
            name: h.name,
            all_day: !!h.all_day,
            start_time: h.start_time || '',
            end_time: h.end_time || '',
            recurring: !!h.recurring
        });
        setModal({ open: true, holiday: h });
    }

    async function handleSave() {
        if (!formData.date || !formData.name) {
            alert('Dato og navn er påkrævet');
            return;
        }
        if (formData.name.length > 20) {
            alert('Navn må maks. være 20 tegn');
            return;
        }
        try {
            if (modal.holiday) {
                await holidaysApi.update(modal.holiday.id, formData);
            } else {
                await holidaysApi.create(formData);
            }
            setModal({ open: false, holiday: null });
            loadCustomHolidays();
        } catch (e) {
            alert('Fejl: ' + e.message);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Slet denne helligdag?')) return;
        try {
            await holidaysApi.delete(id);
            loadCustomHolidays();
        } catch (e) {
            alert('Fejl: ' + e.message);
        }
    }

    const officialCount = kalendariumHolidays.filter(h => h.isPublicHoliday).length;
    const notableCount = kalendariumHolidays.filter(h => !h.isPublicHoliday && h.isNotable).length;
    const customCount = customHolidays.length;

    const nextHoliday = kalendariumHolidays.find(h => h.isPublicHoliday && !isDatePast(h.date));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="page-heading mb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="eyebrow">Administration</div>
                        <h1>Helligdage</h1>
                        <p>Kontrollér kalendergrundlaget for timeberegningen.</p>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center border-r border-stone-300 pr-2 text-xs font-medium text-slate-700">
                                {officialCount} helligdage
                            </span>
                            <span className="inline-flex items-center border-r border-stone-300 pr-2 text-xs font-medium text-slate-700">
                                {notableCount} mærkedage
                            </span>
                            <span className="inline-flex items-center text-xs font-medium text-slate-700">
                                {customCount} brugerdefinerede
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Year selector */}
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-1 py-0.5">
                            <button
                                onClick={() => setSelectedYear(y => y - 1)}
                                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-white rounded transition-all"
                                title="Forrige år"
                            >
                                <ChevronLeftIcon />
                            </button>
                            <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center tabular-nums">
                                {selectedYear}
                            </span>
                            <button
                                onClick={() => setSelectedYear(y => y + 1)}
                                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-white rounded transition-all"
                                title="Næste år"
                            >
                                <ChevronRightIcon />
                            </button>
                        </div>

                        <button
                            onClick={openCreate}
                            className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                        >
                            <PlusIcon />
                            Tilføj helligdag
                        </button>
                    </div>
                </div>
            </div>

            <div className={`rounded-xl border px-4 py-3 text-sm ${kalendariumSource === 'local-fallback' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`} role="status">
                <strong>Datakilde:</strong> {kalendariumSource === 'local-fallback'
                    ? 'Lokal beregning anvendes, fordi Kalendarium ikke kunne kontaktes. Timer beregnes fortsat efter samme lokale kalendergrundlag.'
                    : 'Kalendarium.dk. Data er hentet og kontrolleret for det valgte år.'}
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Kun røde, officielle helligdage påvirker den automatiske timeberegning. Mærkedage er kun information; lokale dage oprettes under <strong>Brugerdefinerede</strong>.
            </div>

            {/* Next holiday banner */}
            {nextHoliday && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl px-4 py-3 border border-red-100/60 flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg shadow-sm border border-red-100 flex items-center justify-center">
                        <CalendarIcon />
                    </div>
                    <div>
                        <span className="text-xs text-gray-500">Næste helligdag</span>
                        <div className="text-sm font-semibold text-gray-900">
                            {nextHoliday.name || nextHoliday.fullName}
                            <span className="text-gray-500 font-normal ml-2">
                                {formatDanishDate(nextHoliday.date)} ({getDayName(nextHoliday.date)})
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="bg-white rounded-xl overflow-clip shadow-sm border border-gray-200">
                {/* Tabs */}
                <div className="border-b border-gray-200 flex bg-gray-50 rounded-t-xl">
                    <button
                        onClick={() => setActiveTab('official')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                            activeTab === 'official'
                                ? 'border-[#B54A32] text-[#B54A32] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <GlobeIcon />
                        Kalendarium
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                            activeTab === 'official' ? 'bg-[#B54A32]/10 text-[#B54A32]' : 'bg-gray-200 text-gray-500'
                        }`}>
                            {kalendariumHolidays.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('custom')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                            activeTab === 'custom'
                                ? 'border-[#B54A32] text-[#B54A32] bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <CalendarIcon />
                        Brugerdefinerede
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                            activeTab === 'custom' ? 'bg-[#B54A32]/10 text-[#B54A32]' : 'bg-gray-200 text-gray-500'
                        }`}>
                            {customCount}
                        </span>
                    </button>
                </div>

                {/* Official holidays tab */}
                {activeTab === 'official' && (
                    <>
                        {loadingKalendarium ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-[#B54A32]"></div>
                            </div>
                        ) : kalendariumError ? (
                            <div className="p-8 text-center">
                                <div className="text-gray-400 mb-2">
                                    <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-500">{kalendariumError}</p>
                                <button onClick={() => loadKalendarium(selectedYear)} className="mt-3 text-sm text-[#B54A32] hover:underline font-medium">
                                    Prøv igen
                                </button>
                            </div>
                        ) : (
                            <table className="responsive-table">
                                <thead>
                                    <tr className="sticky top-[124px] z-10">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 w-36">Dato</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 w-28">Dag</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Navn</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 w-36">Type</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {kalendariumHolidays.map((h, i) => {
                                        const past = isDatePast(h.date);
                                        const today = isDateToday(h.date);
                                        return (
                                            <tr
                                                key={`${h.date}-${h.name}-${i}`}
                                                className={`transition-colors ${
                                                    today
                                                        ? 'bg-amber-50 ring-1 ring-inset ring-amber-200'
                                                        : past
                                                            ? 'opacity-50'
                                                            : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <td data-label="Dato" className="px-4 py-3">
                                                    <span className={`text-sm font-medium ${today ? 'text-amber-800' : 'text-gray-900'}`}>
                                                        {formatDanishDate(h.date)}
                                                    </span>
                                                </td>
                                                <td data-label="Dag" className="px-4 py-3">
                                                    <span className={`text-sm capitalize ${today ? 'text-amber-700' : 'text-gray-600'}`}>
                                                        {getDayName(h.date)}
                                                    </span>
                                                </td>
                                                <td data-label="Navn" className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-medium ${today ? 'text-amber-900' : 'text-gray-900'}`}>
                                                            {h.name || h.fullName}
                                                        </span>
                                                        {h.wikiLink && (
                                                            <a
                                                                href={h.wikiLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-gray-300 hover:text-[#B54A32] transition-colors"
                                                                title="Læs mere på Wikipedia"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                </svg>
                                                            </a>
                                                        )}
                                                        {today && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-800">
                                                                I dag
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-label="Type" className="px-4 py-3">
                                                    {h.isPublicHoliday ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                                            Helligdag
                                                        </span>
                                                    ) : h.isChurch ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                            Kirkedag
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                            Mærkedag
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {!loadingKalendarium && !kalendariumError && kalendariumHolidays.length > 0 && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 flex items-center gap-1.5">
                                <GlobeIcon />
                                Data fra Kalendarium.dk
                            </div>
                        )}
                    </>
                )}

                {/* Custom holidays tab */}
                {activeTab === 'custom' && (
                    <>
                        {loadingCustom ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-[#B54A32]"></div>
                            </div>
                        ) : customHolidays.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <CalendarIcon />
                                </div>
                                <p className="text-sm text-gray-500 mb-1">Ingen brugerdefinerede helligdage</p>
                                <p className="text-xs text-gray-400 mb-4">Tilføj helligdage som ikke er med i den officielle liste</p>
                                <button
                                    onClick={openCreate}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#B54A32] to-[#9a3f2b] text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-all"
                                >
                                    <PlusIcon />
                                    Tilføj helligdag
                                </button>
                            </div>
                        ) : (
                            <table className="responsive-table">
                                <thead>
                                    <tr className="sticky top-[124px] z-10">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Dato</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Navn</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Tidsrum</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Gentages</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Handlinger</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {customHolidays.map(h => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                            <td data-label="Dato" className="px-4 py-3">
                                                <span className="text-sm font-medium text-gray-900">{formatDate(h.date)}</span>
                                            </td>
                                            <td data-label="Navn" className="px-4 py-3">
                                                <span className="text-sm text-gray-900">{h.name}</span>
                                            </td>
                                            <td data-label="Tidsrum" className="px-4 py-3">
                                                <span className="text-sm text-gray-600">
                                                    {h.all_day ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                                            Hele dagen
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                            {h.start_time} – {h.end_time}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td data-label="Gentages" className="px-4 py-3">
                                                {h.recurring ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                        Årligt
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Nej</span>
                                                )}
                                            </td>
                                            <td data-label="Handlinger" className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEdit(h)}
                                                        className="p-1.5 text-gray-400 hover:text-[#B54A32] hover:bg-gray-100 rounded-lg transition-all"
                                                        title="Rediger"
                                                    >
                                                        <EditIcon />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(h.id)}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Slet"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>

            {/* Modal */}
            {modal.open && (
                <DialogShell onClose={() => setModal({ open: false, holiday: null })} labelledBy="holiday-dialog-title" maxWidth="max-w-md" panelClassName="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 id="holiday-dialog-title" className="text-lg font-bold text-gray-900">
                                {modal.holiday ? 'Rediger helligdag' : 'Tilføj helligdag'}
                            </h3>
                            <button type="button" aria-label="Luk dialog" onClick={() => setModal({ open: false, holiday: null })} className="min-h-11 min-w-11 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                                <CloseIcon />
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                            Opret en lokal lukke- eller helligdag. Vælg om den gælder hele dagen og om den skal gentages hvert år.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="holiday-date" className="block text-sm font-semibold text-gray-700 mb-1">Dato *</label>
                                <input
                                    id="holiday-date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30 transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="holiday-name" className="block text-sm font-semibold text-gray-700 mb-1">Navn på dag * <span className="font-normal text-gray-500">(maks. 20 tegn)</span></label>
                                <input
                                    id="holiday-name"
                                    type="text"
                                    maxLength={20}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="F.eks. Kommunens lukkedag"
                                    className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30 transition-all"
                                />
                                <div className="flex justify-end mt-1">
                                    <span className={`text-xs ${formData.name.length >= 18 ? 'text-amber-500' : 'text-gray-400'}`}>
                                        {formData.name.length}/20
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.all_day}
                                        onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                                        className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Hele dagen</span>
                                </label>
                                {!formData.all_day && (
                                    <div className="grid grid-cols-2 gap-3 mt-3 pl-8">
                                        <div>
                                            <label htmlFor="holiday-start" className="block text-xs font-medium text-gray-600 mb-1">Fra</label>
                                            <input
                                                id="holiday-start"
                                                type="time"
                                                value={formData.start_time}
                                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                                className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="holiday-end" className="block text-xs font-medium text-gray-600 mb-1">Til</label>
                                            <input
                                                id="holiday-end"
                                                type="time"
                                                value={formData.end_time}
                                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                                className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20 focus:border-[#B54A32]/30 transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.recurring}
                                        onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                                        className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Gentag hvert år</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                            <button
                                onClick={handleSave}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#B54A32] to-[#9a3f2b] text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                            >
                                Gem
                            </button>
                            <button
                                onClick={() => setModal({ open: false, holiday: null })}
                                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all border border-gray-200"
                            >
                                Annuller
                            </button>
                        </div>
                </DialogShell>
            )}
        </div>
    );
}
