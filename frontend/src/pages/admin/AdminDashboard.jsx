import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { caregiversApi, childrenApi, timeEntriesApi } from '../../utils/api';
import { formatDate, formatHours } from '../../utils/helpers';

const ArrowIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

export default function AdminDashboard({ permissions = [] }) {
    const canManageChildren = permissions.includes('manage_children');
    const canManageCaregivers = permissions.includes('manage_caregivers');
    const canExportReports = permissions.includes('export_reports');
    const [stats, setStats] = useState({ pendingCount: 0, pendingHours: 0, exceededCount: 0, approvedToday: 0, childrenCount: 0, caregiversCount: 0 });
    const [recentPending, setRecentPending] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [entries, children, caregivers] = await Promise.all([timeEntriesApi.getAll(), childrenApi.getAll(), caregiversApi.getAll()]);
                const pending = entries.filter(entry => entry.status === 'pending');
                const today = new Date().toISOString().split('T')[0];
                setStats({
                    pendingCount: pending.length,
                    pendingHours: pending.reduce((sum, entry) => sum + Number(entry.total_hours || 0), 0),
                    exceededCount: pending.filter(entry => entry.grant_exceeded || entry.grantExceeded || entry.grant_status?.exceeded).length,
                    approvedToday: entries.filter(entry => entry.status === 'approved' && entry.reviewed_at?.startsWith(today)).length,
                    childrenCount: children.length,
                    caregiversCount: caregivers.length
                });
                setRecentPending(pending.slice(0, 7));
            } catch (error) {
                console.error('Fejl ved indlæsning:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) return <div className="py-16 text-center text-sm text-slate-600">Indlæser overblik…</div>;

    return (
        <div>
            <header className="page-heading !mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><div className="eyebrow">Godkender</div><h1>Overblik</h1><p>Samlet status for indberettede timer og dagens godkendelsesarbejde.</p></div>
                <Link to="/godkender/godkendelse" className="btn-primary px-5">Gå til godkendelse</Link>
            </header>

            <section className="metric-strip mb-5" aria-label="Nøgletal">
                <div className="metric"><div className="metric-label">Afventer godkendelse</div><div className="metric-value">{stats.pendingCount}</div><div className="metric-note">Registreringer klar til behandling</div></div>
                <div className="metric"><div className="metric-label">Timer til godkendelse</div><div className="metric-value">{formatHours(stats.pendingHours)}</div><div className="metric-note">Samlet i den åbne kø</div></div>
                <div className="metric"><div className="metric-label">Kræver opmærksomhed</div><div className="metric-value">{stats.exceededCount}</div><div className="metric-note">Markeret med bevillingsadvarsel</div></div>
                <div className="metric"><div className="metric-label">Godkendt i dag</div><div className="metric-value">{stats.approvedToday}</div><div className="metric-note">Afsluttede registreringer</div></div>
            </section>

            {(canExportReports || canManageChildren || canManageCaregivers) && (
                <nav className="surface mb-5 flex flex-col overflow-hidden rounded-lg sm:flex-row" aria-label="Administration og stamdata">
                    {canExportReports && <Link to="/godkender/rapporter" className="flex min-h-14 flex-1 items-center justify-between border-b border-stone-200 px-4 text-sm font-bold text-[#823322] sm:border-b-0 sm:border-r"><span>Rapportdashboard <span className="ml-2 font-normal text-slate-500">Excel og filtrering</span></span><ArrowIcon /></Link>}
                    {canManageChildren && <Link to="/godkender/boern" className="flex min-h-14 flex-1 items-center justify-between border-b border-stone-200 px-4 text-sm font-bold text-[#823322] sm:border-b-0 sm:border-r"><span>Børn og bevillinger <span className="ml-2 font-normal text-slate-500">{stats.childrenCount} børn</span></span><ArrowIcon /></Link>}
                    {canManageCaregivers && <Link to="/godkender/barnepiger" className="flex min-h-14 flex-1 items-center justify-between px-4 text-sm font-bold text-[#823322]"><span>Barnepiger <span className="ml-2 font-normal text-slate-500">{stats.caregiversCount} personer</span></span><ArrowIcon /></Link>}
                </nav>
            )}

            <div>
                <section className="surface min-w-0 overflow-hidden rounded-lg">
                    <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5"><div><h2 className="text-lg font-bold">Seneste afventende</h2><p className="mt-0.5 text-sm text-slate-500">De nyeste registreringer i køen</p></div><Link to="/godkender/godkendelse" className="inline-flex items-center gap-2 text-sm font-bold text-[#823322]">Se alle <ArrowIcon /></Link></header>
                    {recentPending.length === 0 ? <div className="p-10 text-center"><h3 className="font-bold">Ingen afventende registreringer</h3><p className="mt-1 text-sm text-slate-500">Alle registreringer er behandlet.</p></div> : (
                        <div className="divide-y divide-stone-200">
                            <div className="hidden grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(200px,1.15fr)_80px] gap-5 bg-stone-50 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                                <div>Barnepige</div>
                                <div>Barn</div>
                                <div>Dato og tidsrum</div>
                                <div className="text-right">Timer</div>
                            </div>
                            {recentPending.map(entry => (
                                <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(200px,1.15fr)_80px] sm:gap-5">
                                    <div className="font-bold">{entry.caregiver_first_name} {entry.caregiver_last_name}</div>
                                    <div className="text-sm text-slate-700">{entry.child_first_name} {entry.child_last_name}</div>
                                    <div className="col-start-1 text-xs text-slate-500 sm:col-auto sm:text-sm">{formatDate(entry.date)} · {entry.start_time?.slice(0,5)}–{entry.end_time?.slice(0,5)}</div>
                                    <div className="row-span-2 row-start-1 text-right text-lg font-bold tabular-nums sm:row-auto">{formatHours(entry.total_hours)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}
