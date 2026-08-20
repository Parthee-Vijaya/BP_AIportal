import { useEffect, useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import { timeEntriesApi } from '../../utils/api';
import { formatDate, formatHours } from '../../utils/helpers';

const Icon = ({ type }) => {
    const path = type === 'pending'
        ? 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        : type === 'approved'
            ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
    return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} /></svg>;
};

const TABS = [
    { id: 'pending', label: 'Afventer' },
    { id: 'approved', label: 'Godkendt' },
    { id: 'rejected', label: 'Afvist' }
];

const BREAKDOWN = [
    ['Normal', 'normal_hours'],
    ['Aften', 'evening_hours'],
    ['Nat', 'night_hours'],
    ['Lørdag', 'saturday_hours'],
    ['Søn/helligdag', 'sunday_holiday_hours']
];

export default function MyTimeEntries({ caregiverId = 1 }) {
    const [entries, setEntries] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [grantFilter, setGrantFilter] = useState('all');

    useEffect(() => {
        setLoading(true);
        timeEntriesApi.getAll({ caregiver_id: caregiverId, status: activeTab })
            .then(setEntries)
            .catch(error => console.error('Fejl ved indlæsning:', error))
            .finally(() => setLoading(false));
    }, [activeTab, caregiverId]);

    const displayedEntries = entries.filter(entry => {
        const query = searchQuery.trim().toLowerCase();
        const haystack = `${entry.child_first_name} ${entry.child_last_name}`.toLowerCase();
        return (!query || haystack.includes(query)) && (grantFilter === 'all' || entry.grant_source === grantFilter);
    });
    const totalHours = displayedEntries.reduce((sum, entry) => sum + Number(entry.total_hours || 0), 0);

    return (
        <div>
            <header className="page-heading">
                <div className="eyebrow">Barnepige</div>
                <h1>Mine timer</h1>
                <p>Se dine indberettede timer, beregningen og den aktuelle status.</p>
            </header>

            <section className="surface overflow-hidden rounded-lg">
                <div className="flex overflow-x-auto border-b border-stone-200" role="tablist" aria-label="Registreringsstatus">
                    {TABS.map(tab => (
                        <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex min-h-14 min-w-fit flex-1 items-center justify-center gap-2 px-5 text-sm font-bold ${activeTab === tab.id ? 'text-[#823322]' : 'text-slate-500 hover:bg-stone-50 hover:text-slate-800'}`}>
                            <Icon type={tab.id} />{tab.label}
                            {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#A6402C]" />}
                        </button>
                    ))}
                </div>

                <div className="grid gap-3 border-b border-stone-200 bg-[#fbfaf8] p-4 sm:grid-cols-[1fr_220px_auto] sm:items-center">
                    <div><label htmlFor="entry-search" className="sr-only">Søg efter barn</label><input id="entry-search" type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Søg navn" className="glass-input w-full rounded-md px-3 text-sm" /></div>
                    <div><label htmlFor="entry-grant-filter" className="sr-only">Filtrer efter bevilling</label><select id="entry-grant-filter" value={grantFilter} onChange={event => setGrantFilter(event.target.value)} className="glass-input w-full rounded-md px-3 text-sm"><option value="all">Alle bevillinger</option><option value="normal">Normal bevilling</option><option value="frame">Rammebevilling</option></select></div>
                    <div className="text-sm text-slate-600"><strong className="text-slate-900">{displayedEntries.length}</strong> registreringer · <strong className="text-slate-900">{formatHours(totalHours)}</strong> timer</div>
                </div>

                {loading ? <div className="p-12 text-center text-sm text-slate-600">Indlæser registreringer…</div> : displayedEntries.length === 0 ? (
                    <div className="p-12 text-center"><h2 className="text-lg font-bold">Ingen registreringer</h2><p className="mt-1 text-sm text-slate-500">Der er ingen registreringer med denne status og filtrering.</p></div>
                ) : (
                    <div className="divide-y divide-stone-200">
                        {displayedEntries.map(entry => (
                            <article key={entry.id} className="p-4 sm:p-5">
                                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-base font-bold">{entry.child_first_name} {entry.child_last_name}</h2></div>
                                        <p className="mt-1 text-sm text-slate-600">{formatDate(entry.date)} · {entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)} · {entry.grant_source === 'frame' ? 'Rammebevilling' : 'Normal bevilling'}</p>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end"><StatusBadge status={entry.status} /><strong className="text-xl">{formatHours(entry.total_hours)} timer</strong></div>
                                </div>

                                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-200 pt-3 text-xs">
                                    {BREAKDOWN.filter(([, key]) => Number(entry[key]) > 0).map(([label, key]) => <div key={key}><dt className="inline text-slate-500">{label}: </dt><dd className="inline font-bold text-slate-800">{formatHours(entry[key])}</dd></div>)}
                                </dl>

                                {entry.comment && <div className="mt-3 border-l-2 border-stone-300 pl-3 text-sm text-slate-700"><span className="font-bold">Din kommentar:</span> {entry.comment}</div>}
                                {entry.status === 'rejected' && entry.rejection_reason && (
                                    <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><div className="flex items-center gap-2 font-bold"><Icon type="rejected" />Årsag til afvisning</div><p className="mt-1">{entry.rejection_reason}</p><p className="mt-2 text-xs">Afvist af {entry.reviewed_by} · Opret en ny registrering, hvis timerne skal indsendes igen.</p></div>
                                )}
                                {entry.status === 'approved' && (
                                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"><Icon type="approved" /><strong>Godkendt af {entry.reviewed_by}</strong>{entry.payroll_date && <span>· Data sendt {new Date(entry.payroll_date).toLocaleString('da-DK')}</span>}</div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
