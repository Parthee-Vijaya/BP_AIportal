import { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import { caregiversApi, childrenApi, reportsApi } from '../../utils/api';
import { formatDate, formatDateTime, formatHours } from '../../utils/helpers';

const PAGE_SIZE = 20;
const EMPTY_FILTERS = {
    child_id: '',
    caregiver_id: '',
    status: '',
    from_date: '',
    to_date: ''
};

const EMPTY_REPORT = {
    generatedAt: null,
    availableRange: { fromDate: null, toDate: null },
    summary: {
        registrationCount: 0,
        totalHours: 0,
        childCount: 0,
        caregiverCount: 0,
        byStatus: {
            pending: { count: 0, hours: 0 },
            approved: { count: 0, hours: 0 },
            rejected: { count: 0, hours: 0 }
        },
        hours: {
            normal_hours: 0,
            evening_hours: 0,
            night_hours: 0,
            saturday_hours: 0,
            sunday_holiday_hours: 0
        }
    },
    entries: []
};

const DownloadIcon = () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" />
    </svg>
);

function activeParams(filters) {
    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
}

function StatusSummary({ label, value, total, colorClass }) {
    const percentage = total ? Math.round((value.count / total) * 100) : 0;
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="font-semibold text-slate-800">{label}</div>
                <div className="text-right text-sm tabular-nums text-slate-600"><strong className="text-base text-slate-900">{value.count}</strong> · {formatHours(value.hours)} t.</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200" aria-label={`${percentage} procent af registreringerne`}>
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

export default function ReportsPage({ approver = null }) {
    const [children, setChildren] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [report, setReport] = useState(EMPTY_REPORT);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        let cancelled = false;
        Promise.all([childrenApi.getAll(), caregiversApi.getAll()])
            .then(([childData, caregiverData]) => {
                if (cancelled) return;
                setChildren(childData);
                setCaregivers(caregiverData);
            })
            .catch(loadError => {
                if (!cancelled) setError(loadError.message);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        reportsApi.getDashboard(activeParams(filters))
            .then(data => {
                if (!cancelled) setReport(data);
            })
            .catch(loadError => {
                if (!cancelled) setError(loadError.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [filters, approver?.id]);

    const pageCount = Math.max(1, Math.ceil(report.entries.length / PAGE_SIZE));
    const visibleEntries = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return report.entries.slice(start, start + PAGE_SIZE);
    }, [page, report.entries]);

    function submitFilters(event) {
        event.preventDefault();
        if (draftFilters.from_date && draftFilters.to_date && draftFilters.from_date > draftFilters.to_date) {
            setError('Fra-dato skal ligge før eller på til-dato.');
            return;
        }
        setError('');
        setPage(1);
        setFilters({ ...draftFilters });
    }

    function resetFilters() {
        setDraftFilters(EMPTY_FILTERS);
        setFilters(EMPTY_FILTERS);
        setPage(1);
        setError('');
    }

    async function downloadExcel() {
        setDownloading(true);
        setError('');
        try {
            await reportsApi.downloadExcel(activeParams(filters));
        } catch (downloadError) {
            setError(downloadError.message);
        } finally {
            setDownloading(false);
        }
    }

    const shownFrom = report.entries.length ? (page - 1) * PAGE_SIZE + 1 : 0;
    const shownTo = Math.min(page * PAGE_SIZE, report.entries.length);
    const updateDraftFilter = (field, value) => {
        setDraftFilters(current => ({ ...current, [field]: value }));
    };

    return (
        <div>
            <header className="page-heading !mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="eyebrow">Administration</div>
                    <h1>Rapportdashboard</h1>
                    <p>Filtrér registreringer på barn, barnepige, status og en selvvalgt periode. Kommentarer følger altid med.</p>
                </div>
                <button type="button" onClick={downloadExcel} disabled={downloading || loading || report.entries.length === 0} className="btn-primary shrink-0 px-5 font-bold">
                    <DownloadIcon />{downloading ? 'Opretter Excel…' : 'Hent som Excel'}
                </button>
            </header>

            <form onSubmit={submitFilters} className="surface mb-5 rounded-lg p-4" aria-label="Rapportfiltre">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(160px,.8fr)_minmax(150px,.75fr)_minmax(150px,.75fr)_auto] xl:items-end">
                    <label className="block">
                        <span className="form-label">Barn</span>
                        <select value={draftFilters.child_id} onChange={event => setDraftFilters(current => ({ ...current, child_id: event.target.value }))} className="field-control w-full rounded-md px-3">
                            <option value="">Alle børn</option>
                            {children.map(child => <option key={child.id} value={child.id}>{child.first_name} {child.last_name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="form-label">Barnepige</span>
                        <select value={draftFilters.caregiver_id} onChange={event => setDraftFilters(current => ({ ...current, caregiver_id: event.target.value }))} className="field-control w-full rounded-md px-3">
                            <option value="">Alle barnepiger</option>
                            {caregivers.map(caregiver => <option key={caregiver.id} value={caregiver.id}>{caregiver.first_name} {caregiver.last_name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="form-label">Status</span>
                        <select value={draftFilters.status} onChange={event => setDraftFilters(current => ({ ...current, status: event.target.value }))} className="field-control w-full rounded-md px-3">
                            <option value="">Alle statusser</option>
                            <option value="pending">Afventer godkendelse</option>
                            <option value="approved">Godkendt</option>
                            <option value="rejected">Afvist</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="form-label">Fra dato</span>
                        <input type="date" value={draftFilters.from_date} onInput={event => updateDraftFilter('from_date', event.currentTarget.value)} className="field-control w-full rounded-md px-3" />
                    </label>
                    <label className="block">
                        <span className="form-label">Til dato</span>
                        <input type="date" value={draftFilters.to_date} onInput={event => updateDraftFilter('to_date', event.currentTarget.value)} className="field-control w-full rounded-md px-3" />
                    </label>
                    <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
                        <button type="submit" className="btn-primary flex-1 px-4 text-sm font-bold xl:flex-none">Vis rapport</button>
                        <button type="button" onClick={resetFilters} className="btn-secondary flex-1 px-4 text-sm xl:flex-none">Nulstil</button>
                    </div>
                </div>
                {report.availableRange?.fromDate && (
                    <div className="mt-3 text-xs text-slate-500">Tilgængelige registreringer: {formatDate(report.availableRange.fromDate)} – {formatDate(report.availableRange.toDate)}</div>
                )}
            </form>

            {error && <div className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</div>}

            <div aria-live="polite">
                {loading ? (
                    <div className="surface rounded-lg py-16 text-center text-sm text-slate-600">Indlæser rapport…</div>
                ) : (
                    <>
                        <section className="metric-strip mb-5" aria-label="Rapportens nøgletal">
                            <div className="metric"><div className="metric-label">Registreringer</div><div className="metric-value">{report.summary.registrationCount}</div><div className="metric-note">I det valgte udsnit</div></div>
                            <div className="metric"><div className="metric-label">Timer i alt</div><div className="metric-value">{formatHours(report.summary.totalHours)}</div><div className="metric-note">Registrerede grundtimer</div></div>
                            <div className="metric"><div className="metric-label">Børn</div><div className="metric-value">{report.summary.childCount}</div><div className="metric-note">Unikke børn i rapporten</div></div>
                            <div className="metric"><div className="metric-label">Barnepiger</div><div className="metric-value">{report.summary.caregiverCount}</div><div className="metric-note">Unikke barnepiger i rapporten</div></div>
                        </section>

                        <div className="mb-5 grid gap-5 lg:grid-cols-2">
                            <section className="surface rounded-lg p-5" aria-labelledby="status-heading">
                                <h2 id="status-heading" className="text-lg font-bold">Statusfordeling</h2>
                                <div className="mt-4 space-y-4">
                                    <StatusSummary label="Afventer godkendelse" value={report.summary.byStatus.pending} total={report.summary.registrationCount} colorClass="bg-amber-500" />
                                    <StatusSummary label="Godkendt" value={report.summary.byStatus.approved} total={report.summary.registrationCount} colorClass="bg-emerald-700" />
                                    <StatusSummary label="Afvist" value={report.summary.byStatus.rejected} total={report.summary.registrationCount} colorClass="bg-red-700" />
                                </div>
                            </section>
                            <section className="surface rounded-lg p-5" aria-labelledby="hours-heading">
                                <h2 id="hours-heading" className="text-lg font-bold">Grundtimer og tillæg</h2>
                                <p className="mt-1 text-sm text-slate-500">Tillægstimer er en del af de samlede timer og lægges ikke oveni grundtimerne.</p>
                                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
                                    {[
                                        ['Normaltimer', report.summary.hours.normal_hours],
                                        ['Aftentillæg', report.summary.hours.evening_hours],
                                        ['Nattillæg', report.summary.hours.night_hours],
                                        ['Lørdagstillæg', report.summary.hours.saturday_hours],
                                        ['Søn-/helligdag', report.summary.hours.sunday_holiday_hours]
                                    ].map(([label, hours]) => (
                                        <div key={label} className="border-l-2 border-[#A6402C] pl-3">
                                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                                            <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatHours(hours)} <span className="text-sm font-semibold text-slate-500">t.</span></dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        </div>

                        <section className="surface overflow-hidden rounded-lg" aria-labelledby="entries-heading">
                            <header className="flex flex-col gap-1 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div><h2 id="entries-heading" className="text-lg font-bold">Registreringer i perioden</h2><p className="text-sm text-slate-500">Kommentarer vises uredigeret sammen med registreringen.</p></div>
                                <div className="text-sm text-slate-500">{report.generatedAt ? `Opdateret ${formatDateTime(report.generatedAt)}` : ''}</div>
                            </header>

                            {report.entries.length === 0 ? (
                                <div className="px-5 py-14 text-center"><h3 className="font-bold">Ingen registreringer matcher filtrene</h3><p className="mt-1 text-sm text-slate-500">Prøv et bredere datointerval eller nulstil et af filtrene.</p></div>
                            ) : (
                                <>
                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                                            <caption className="sr-only">Registreringer med dato, barn, barnepige, timer, status og kommentar</caption>
                                            <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                <tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Barn</th><th className="px-4 py-3">Barnepige</th><th className="px-4 py-3">Tidsrum</th><th className="px-4 py-3 text-right">Timer</th><th className="px-4 py-3">Status</th><th className="min-w-[280px] px-4 py-3">Kommentar</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-200">
                                                {visibleEntries.map(entry => (
                                                    <tr key={entry.id} className="align-top hover:bg-stone-50/70">
                                                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDate(entry.date)}</td>
                                                        <td className="px-4 py-3">{entry.child_name}</td>
                                                        <td className="px-4 py-3">{entry.caregiver_name}</td>
                                                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)}</td>
                                                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatHours(entry.total_hours)}</td>
                                                        <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                                                        <td className="whitespace-pre-wrap px-4 py-3 leading-relaxed text-slate-700">{entry.comment || <span className="text-slate-400">Ingen kommentar</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="divide-y divide-stone-200 md:hidden">
                                        {visibleEntries.map(entry => (
                                            <article key={entry.id} className="p-4">
                                                <div className="flex items-start justify-between gap-3"><div><div className="font-bold">{entry.child_name}</div><div className="mt-0.5 text-sm text-slate-600">{entry.caregiver_name}</div></div><div className="text-right"><div className="text-lg font-bold tabular-nums">{formatHours(entry.total_hours)} t.</div><div className="text-xs text-slate-500">{formatDate(entry.date)}</div></div></div>
                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm tabular-nums text-slate-600">{entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)}</span><StatusBadge status={entry.status} /></div>
                                                <div className="mt-3 border-l-2 border-[#A6402C] pl-3 text-sm leading-relaxed text-slate-700"><span className="font-bold">Kommentar:</span> {entry.comment || <span className="text-slate-400">Ingen kommentar</span>}</div>
                                            </article>
                                        ))}
                                    </div>

                                    <footer className="flex flex-col gap-3 border-t border-stone-200 px-5 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                                        <span>Viser {shownFrom}–{shownTo} af {report.entries.length} registreringer</span>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="btn-secondary min-h-9 px-3 text-sm disabled:opacity-40">Forrige</button>
                                            <span className="min-w-16 text-center font-semibold">{page} / {pageCount}</span>
                                            <button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="btn-secondary min-h-9 px-3 text-sm disabled:opacity-40">Næste</button>
                                        </div>
                                    </footer>
                                </>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
