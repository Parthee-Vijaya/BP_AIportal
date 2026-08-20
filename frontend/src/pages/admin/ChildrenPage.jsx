import { useState, useEffect } from 'react';
import { childrenApi, caregiversApi, extraGrantsApi } from '../../utils/api';
import { translateGrantType, translateWeekday, formatDate, formatDateTime, formatHours, padMaNumber } from '../../utils/helpers';
import DialogShell from '../../components/DialogShell';

const PlusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);
const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);
const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);
const UserIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);
const CloseIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

function getGrantView(child) {
    const summary = child.grantSummary || {};
    if (child.grant_type === 'specific_weekdays') {
        const weekdays = Object.values(summary.weekdays || {});
        const baseGranted = weekdays.reduce((sum, day) => sum + Number(day.grantHours || 0), 0);
        const baseUsed = weekdays.reduce((sum, day) => sum + Number(Math.min(day.usedHours || 0, day.grantHours || 0)), 0);
        const extraGranted = weekdays.reduce((sum, day) => sum + Number(day.extraGrantHours || 0), 0);
        const extraUsed = weekdays.reduce((sum, day) => sum + Number(day.extraUsedHours || 0), 0);
        const granted = baseGranted + extraGranted;
        const used = weekdays.reduce((sum, day) => sum + Number(day.usedHours || 0), 0);
        return {
            granted,
            used,
            remaining: Math.max(0, granted - used),
            baseGranted,
            baseUsed,
            baseRemaining: Math.max(0, baseGranted - baseUsed),
            extraGranted,
            extraUsed,
            extraRemaining: Math.max(0, extraGranted - extraUsed),
            activeExtraGrants: summary.extraGrants || [],
            exceeded: weekdays.some(day => day.exceeded),
            periodStart: summary.periodStart,
            periodEnd: summary.periodEnd,
            label: 'Pr. ugedag',
            source: 'normal'
        };
    }

    const baseGranted = Number(summary.baseGrantHours ?? summary.grantHours ?? 0);
    const baseUsed = Number(summary.baseUsedHours ?? Math.min(summary.usedHours || 0, baseGranted));
    const extraGranted = Number(summary.extraGrantHours || 0);
    const extraUsed = Number(summary.extraUsedHours || 0);
    return {
        granted: Number(summary.effectiveGrantHours ?? (baseGranted + extraGranted)),
        used: Number(summary.usedHours || 0),
        remaining: Number(summary.remainingHours || 0),
        baseGranted,
        baseUsed,
        baseRemaining: Number(summary.baseRemainingHours ?? Math.max(0, baseGranted - baseUsed)),
        extraGranted,
        extraUsed,
        extraRemaining: Number(summary.extraRemainingHours ?? Math.max(0, extraGranted - extraUsed)),
        activeExtraGrants: summary.extraGrants || [],
        exceeded: Boolean(summary.exceeded),
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        label: child.has_frame_grant ? 'År' : translateGrantType(child.grant_type),
        source: child.has_frame_grant ? 'frame' : 'normal'
    };
}

function getExtraGrantPeriod(child, source) {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    if (source === 'frame') {
        return {
            fromDate: child.grantSummary?.periodStart || `${today.getFullYear()}-01-01`,
            toDate: child.grantSummary?.periodEnd || `${today.getFullYear()}-12-31`
        };
    }

    if (child.grant_type === 'specific_weekdays') {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const configured = child.grant_weekdays || {};
        for (let offset = 0; offset < 7; offset += 1) {
            const candidate = new Date(today);
            candidate.setDate(today.getDate() + offset);
            if (Number(configured[weekdays[candidate.getDay()]]) > 0) {
                const date = candidate.toISOString().split('T')[0];
                return { fromDate: date, toDate: date };
            }
        }
        return { fromDate: todayString, toDate: todayString };
    }

    const summary = child.has_frame_grant ? child.grantSummary?.normalGrantSummary : child.grantSummary;
    return {
        fromDate: summary?.periodStart || todayString,
        toDate: summary?.periodEnd || todayString
    };
}

function GrantNumbers({ granted, used, remaining, warning = false }) {
    return (
        <dl className="grant-number-grid">
            <div><dt className="grant-usage-label">Tildelt</dt><dd className="grant-usage-value">{formatHours(granted)} <span>t.</span></dd></div>
            <div><dt className="grant-usage-label">Brugt</dt><dd className="grant-usage-value">{formatHours(used)} <span>t.</span></dd></div>
            <div><dt className="grant-usage-label">Tilbage</dt><dd className={`grant-usage-value ${warning ? 'text-[#A6402C]' : ''}`}>{formatHours(remaining)} <span>t.</span></dd></div>
        </dl>
    );
}

function BaseGrantUsage({ grant }) {
    const hasWarning = grant.baseGranted > 0 && grant.baseRemaining / grant.baseGranted <= 0.2;
    return (
        <div className="grant-usage">
            <GrantNumbers granted={grant.baseGranted} used={grant.baseUsed} remaining={grant.baseRemaining} warning={hasWarning} />
            <div className="mt-2 text-xs text-slate-500">Uden ekstratimer</div>
        </div>
    );
}

function getExtraGrantStatus(extraGrant, today) {
    if (today < extraGrant.from_date) return { label: 'Kommende', className: 'extra-period-upcoming' };
    if (today > extraGrant.to_date) return { label: 'Udløbet', className: 'extra-period-expired' };
    return { label: 'Aktiv', className: 'extra-period-active' };
}

function ExtraGrantList({ child, grant }) {
    const today = new Date().toISOString().split('T')[0];
    const extraGrants = (child.extraGrants || []).filter(item => item.grant_source === grant.source);
    const activeUsage = new Map((grant.activeExtraGrants || []).map(item => [item.id, item]));

    if (extraGrants.length === 0) {
        return <div className="text-sm text-slate-400">Ingen ekstrabevilling</div>;
    }

    return (
        <div className="extra-grant-list space-y-2">
            {extraGrants.map(extraGrant => {
                const status = getExtraGrantStatus(extraGrant, today);
                const usage = activeUsage.get(extraGrant.id);
                return (
                    <div key={extraGrant.id} className={`extra-period-card ${status.className}`}>
                        <div className="flex items-start justify-between gap-2">
                            <strong className="text-sm text-[#823322]">+{formatHours(extraGrant.hours)} t.</strong>
                            <span className="extra-period-status">{status.label}</span>
                        </div>
                        <div className="mt-1 font-semibold text-slate-700">{formatDate(extraGrant.from_date)} – {formatDate(extraGrant.to_date)}</div>
                        <div className="mt-1 text-xs text-slate-500">{extraGrant.grant_source === 'frame' ? 'Rammebevilling' : 'Normal bevilling'} · givet {formatDate(extraGrant.granted_at || extraGrant.created_at)}</div>
                        {usage && <div className="mt-1 text-xs text-slate-600">{formatHours(usage.usedHours)} t. brugt · {formatHours(usage.remainingHours)} t. tilbage</div>}
                    </div>
                );
            })}
        </div>
    );
}

function TotalGrantUsage({ grant }) {
    const percentage = grant.granted > 0 ? Math.min(100, (grant.used / grant.granted) * 100) : 0;
    const hasWarning = grant.exceeded || (grant.granted > 0 && grant.remaining / grant.granted <= 0.2);

    return (
        <div className="grant-usage">
            <GrantNumbers granted={grant.granted} used={grant.used} remaining={grant.remaining} warning={hasWarning} />
            <div className="grant-progress mt-2" aria-label={`${Math.round(percentage)} procent af bevillingen er brugt`}>
                <span className={grant.exceeded ? '!bg-[#A6402C]' : hasWarning ? '!bg-[#B8781D]' : '!bg-slate-700'} style={{ width: `${percentage}%` }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{formatHours(grant.baseGranted)} grund + {formatHours(grant.extraGranted)} ekstra</div>
        </div>
    );
}

function ExtraGrantPreview({ child, form }) {
    const source = form.grant_source || (child.has_frame_grant ? 'frame' : 'normal');
    const summary = source === 'normal' && child.has_frame_grant
        ? child.grantSummary?.normalGrantSummary
        : child.grantSummary;
    const selectedDate = form.from_date || '';
    const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const selectedWeekday = selectedDate
        ? weekdayNames[new Date(`${selectedDate}T00:00:00Z`).getUTCDay()]
        : null;
    const baseHours = child.grant_type === 'specific_weekdays' && source === 'normal'
        ? Number(child.grant_weekdays?.[selectedWeekday] || 0)
        : Number(summary?.baseGrantHours ?? summary?.grantHours ?? 0);
    const currentExtraHours = (child.extraGrants || [])
        .filter(grant => grant.grant_source === source
            && selectedDate
            && grant.from_date <= selectedDate
            && grant.to_date >= selectedDate)
        .reduce((sum, grant) => sum + Number(grant.hours || 0), 0);
    const newExtraHours = Number(String(form.hours || '0').replace(',', '.')) || 0;
    const extraAfter = currentExtraHours + newExtraHours;

    return (
        <div className="sm:col-span-2 rounded-md border border-[#C87866] bg-white p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#823322]">Bevilling efter tildeling</div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[11px] text-slate-500">Grundbevilling</div><div className="font-bold">{formatHours(baseHours)} t.</div></div>
                <div className="border-x border-stone-200"><div className="text-[11px] text-slate-500">Ekstra i perioden</div><div className="font-bold text-[#823322]">+{formatHours(extraAfter)} t.</div><div className="text-[10px] text-slate-500">Heraf ny +{formatHours(newExtraHours)}</div></div>
                <div><div className="text-[11px] text-slate-500">Samlet rådighed</div><div className="font-bold">{formatHours(baseHours + extraAfter)} t.</div></div>
            </div>
            <div className="mt-2 border-t border-stone-200 pt-2 text-center text-xs text-slate-600">Ekstrabevillingen gælder {form.from_date ? formatDate(form.from_date) : '–'} – {form.to_date ? formatDate(form.to_date) : '–'}</div>
        </div>
    );
}

export default function ChildrenPage({ readOnly = false, canManageRecords = !readOnly, canManageGrants = !readOnly, approver = null, roleLabel = 'Administration' }) {
    const [children, setChildren] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editModal, setEditModal] = useState({ open: false, child: null, mode: 'full' });
    const [formData, setFormData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [grantFilter, setGrantFilter] = useState('all');
    const [caregiverSearch, setCaregiverSearch] = useState('');
    const [extraModal, setExtraModal] = useState({ open: false, child: null });
    const [extraGrants, setExtraGrants] = useState([]);
    const [extraForm, setExtraForm] = useState({});

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [childrenData, caregiversData] = await Promise.all([
                childrenApi.getAll(), caregiversApi.getAll()
            ]);
            setChildren(childrenData);
            setCaregivers(caregiversData);
        } catch (error) {
            console.error('Fejl ved indlæsning:', error);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setFormData({
            first_name: '', last_name: '', birth_date: '',
            grant_type: 'week', grant_hours: 0, grant_weekdays: {},
            has_frame_grant: false, frame_hours: 0, caregiver_ids: []
        });
        setCaregiverSearch('');
        setEditModal({ open: true, child: null, mode: 'full' });
    }

    function openEditModal(child, mode = 'full') {
        setFormData({
            first_name: child.first_name, last_name: child.last_name,
            birth_date: child.birth_date || '', grant_type: child.grant_type,
            grant_hours: child.grant_hours || 0, grant_weekdays: child.grant_weekdays || {},
            has_frame_grant: !!child.has_frame_grant, frame_hours: child.frame_hours || 0,
            caregiver_ids: child.caregivers?.map(c => c.id) || []
        });
        setCaregiverSearch('');
        setEditModal({ open: true, child, mode });
    }

    async function handleSave() {
        try {
            if (editModal.child && editModal.mode === 'grant') { await childrenApi.updateGrant(editModal.child.id, formData); }
            else if (editModal.child) { await childrenApi.update(editModal.child.id, formData); }
            else { await childrenApi.create(formData); }
            setEditModal({ open: false, child: null, mode: 'full' });
            loadData();
        } catch (error) { alert('Fejl ved gem: ' + error.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Er du sikker på at du vil slette dette barn?')) return;
        try { await childrenApi.delete(id); loadData(); }
        catch (error) { alert('Fejl ved sletning: ' + error.message); }
    }

    async function openExtraGrantModal(child) {
        const source = child.has_frame_grant ? 'frame' : 'normal';
        const period = getExtraGrantPeriod(child, source);
        setExtraForm({
            hours: '',
            grant_source: source,
            from_date: period.fromDate,
            to_date: period.toDate,
            granted_by: approver?.name || 'Godkender (demo)',
            comment: ''
        });
        setExtraModal({ open: true, child });
        try {
            setExtraGrants(await extraGrantsApi.getAll(child.id));
        } catch (error) {
            alert('Fejl ved hentning af ekstrabevillinger: ' + error.message);
        }
    }

    async function handleCreateExtraGrant() {
        try {
            await extraGrantsApi.create({
                ...extraForm,
                child_id: extraModal.child.id,
                hours: Number(String(extraForm.hours).replace(',', '.'))
            });
            const [grants, child] = await Promise.all([
                extraGrantsApi.getAll(extraModal.child.id),
                childrenApi.getById(extraModal.child.id)
            ]);
            setExtraGrants(grants);
            setExtraModal({ open: true, child });
            setExtraForm(current => ({ ...current, hours: '', comment: '' }));
            await loadData();
        } catch (error) {
            alert('Fejl ved oprettelse: ' + error.message);
        }
    }

    async function handleDeleteExtraGrant(id) {
        if (!confirm('Slet denne ekstrabevilling?')) return;
        try {
            await extraGrantsApi.delete(id);
            const [grants, child] = await Promise.all([
                extraGrantsApi.getAll(extraModal.child.id),
                childrenApi.getById(extraModal.child.id)
            ]);
            setExtraGrants(grants);
            setExtraModal({ open: true, child });
            await loadData();
        } catch (error) {
            alert('Fejl ved sletning: ' + error.message);
        }
    }

    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const filteredChildren = children.filter(child => {
        const query = searchQuery.trim().toLowerCase();
        if (query && !`${child.first_name} ${child.last_name} ${child.caregivers?.map(c => c.name).join(' ')}`.toLowerCase().includes(query)) return false;
        const summary = getGrantView(child);
        if (grantFilter === 'frame' && !child.has_frame_grant) return false;
        if (grantFilter === 'normal' && child.has_frame_grant) return false;
        if (grantFilter === 'extra' && !(child.extraGrants?.length > 0)) return false;
        if (grantFilter === 'attention' && !summary.exceeded && !(summary.granted > 0 && summary.remaining / summary.granted <= 0.2)) return false;
        return true;
    });

    const grantStats = children.reduce((stats, child) => {
        const grant = getGrantView(child);
        stats.frame += child.has_frame_grant ? 1 : 0;
        stats.extra += child.extraGrants?.length > 0 ? 1 : 0;
        stats.attention += grant.exceeded || (grant.granted > 0 && grant.remaining / grant.granted <= 0.2) ? 1 : 0;
        return stats;
    }, { frame: 0, extra: 0, attention: 0 });

    const sortedCaregivers = [...caregivers].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'da')
    );
    const filteredModalCaregivers = sortedCaregivers.filter(cg => {
        if (!caregiverSearch) return true;
        const q = caregiverSearch.toLowerCase();
        const name = `${cg.first_name} ${cg.last_name}`.toLowerCase();
        return name.includes(q) || padMaNumber(cg.ma_number || '').includes(q);
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="page-heading !mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="eyebrow">{roleLabel}</div>
                        <h1>Børn og bevillinger</h1>
                        <p>Se tildelte, brugte og resterende timer – og administrér bevillinger.</p>
                    </div>
                    {canManageRecords && <button onClick={openCreateModal} className="btn-kalundborg mobile-full gap-1.5 px-4 py-2 text-sm font-semibold"><PlusIcon />Opret barn</button>}
                </div>
            </div>

            <section className="surface overflow-hidden rounded-lg" aria-label="Bevillingsoversigt">
                <div className="children-summary-grid">
                    <div><div className="grant-usage-label">Børn i alt</div><div className="children-summary-value">{children.length}</div></div>
                    <div><div className="grant-usage-label">Rammebevilling</div><div className="children-summary-value">{grantStats.frame}</div></div>
                    <div><div className="grant-usage-label">Med ekstra timer</div><div className="children-summary-value">{grantStats.extra}</div></div>
                    <div><div className="grant-usage-label">Kræver opmærksomhed</div><div className="children-summary-value text-[#A6402C]">{grantStats.attention}</div></div>
                </div>
                <div className="grid gap-3 border-t border-stone-200 p-3 lg:grid-cols-[minmax(240px,1fr)_220px_auto] lg:items-center">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><SearchIcon /></div>
                        <input type="text" aria-label="Søg efter barn eller barnepige" placeholder="Søg barn eller barnepige" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="field-control w-full rounded-md py-2 pl-9 pr-4 text-sm" />
                    </div>
                    <select aria-label="Filtrer efter bevilling" value={grantFilter} onChange={(e) => setGrantFilter(e.target.value)} className="field-control w-full rounded-md px-3 text-sm">
                        <option value="all">Alle bevillinger</option>
                        <option value="normal">Normal bevilling</option>
                        <option value="frame">Rammebevilling</option>
                        <option value="extra">Med ekstra timer</option>
                        <option value="attention">Kræver opmærksomhed</option>
                    </select>
                    <div className="text-sm text-slate-500 lg:text-right">Viser <strong className="text-slate-800">{filteredChildren.length}</strong> af {children.length}</div>
                </div>
            </section>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#B54A32]"></div>
                </div>
            ) : (
                <div className="surface overflow-x-auto rounded-lg">
                    <table className="responsive-table children-grant-table">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Barn</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Bevilling og periode</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Grundbevilling</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Ekstrabevilling og gyldighed</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Samlet i perioden</th>
                                <th className="children-caregiver-column px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Tilknyttede barnepiger</th>
                                {(canManageGrants || canManageRecords) && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200">Handlinger</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredChildren.map((child) => {
                                const grant = getGrantView(child);
                                return (
                                <tr key={child.id} className="hover:bg-gray-50 transition-colors">
                                    <td data-label="Barn" className="px-4 py-3.5">
                                        <span className="font-bold text-sm text-gray-900">{child.first_name} {child.last_name}</span>
                                        <div className="mt-1 text-xs text-gray-500">Født {child.birth_date ? formatDate(child.birth_date) : '–'}</div>
                                        <div className="children-caregiver-compact mt-2 text-xs text-slate-500">
                                            {child.caregivers?.length ? child.caregivers.map(caregiver => caregiver.name).join(', ') : 'Ingen barnepige tilknyttet'}
                                        </div>
                                    </td>
                                    <td data-label="Bevilling og periode" className="px-4 py-3.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="grant-type-badge">{grant.label}</span>
                                            {!!child.has_frame_grant && <span className="frame-grant-badge">Rammebevilling</span>}
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">{grant.periodStart && grant.periodEnd ? `${formatDate(grant.periodStart)} – ${formatDate(grant.periodEnd)}` : 'Aktuel periode'}</div>
                                    </td>
                                    <td data-label="Grundbevilling" className="px-4 py-3.5"><BaseGrantUsage grant={grant} /></td>
                                    <td data-label="Ekstrabevilling" className="px-4 py-3.5"><ExtraGrantList child={child} grant={grant} /></td>
                                    <td data-label="Samlet i perioden" className="px-4 py-3.5"><TotalGrantUsage grant={grant} /></td>
                                    <td data-label="Barnepiger" className="children-caregiver-column px-4 py-3 text-sm text-gray-600">
                                        {child.caregivers?.length ? <div className="flex flex-wrap gap-1.5">{child.caregivers.map(c => <span key={c.id} className="caregiver-chip">{c.name}</span>)}</div> : <span className="text-gray-400 italic">Ingen tilknyttet</span>}
                                    </td>
                                    {(canManageGrants || canManageRecords) && (
                                        <td data-label="Handlinger" className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {canManageGrants && <button onClick={() => openExtraGrantModal(child)} className="approval-action-secondary whitespace-nowrap" aria-label={`Administrer ekstrabevilling for ${child.first_name} ${child.last_name}`}>
                                                    + Ekstra
                                                </button>}
                                                <button onClick={() => openEditModal(child, canManageRecords ? 'full' : 'grant')} className="min-h-10 min-w-10 p-2 text-gray-500 hover:text-[#B54A32] hover:bg-gray-100 rounded-lg transition-all" aria-label={`${canManageRecords ? 'Rediger barn' : 'Rediger bevilling for'} ${child.first_name} ${child.last_name}`}>
                                                    <EditIcon />
                                                </button>
                                                {canManageRecords && <button onClick={() => handleDelete(child.id)} className="min-h-10 min-w-10 p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" aria-label={`Arkivér ${child.first_name} ${child.last_name}`}>
                                                    <TrashIcon />
                                                </button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {children.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4 text-gray-400"><UserIcon /></div>
                            <h3 className="text-sm font-semibold text-gray-900">Ingen børn oprettet</h3>
                            <p className="text-xs text-gray-500 mt-1">Opret et barn for at komme i gang</p>
                        </div>
                    )}
                    {filteredChildren.length === 0 && children.length > 0 && (
                        <div className="p-12 text-center">
                            <h3 className="text-sm font-semibold text-gray-900">Ingen resultater</h3>
                            <p className="text-xs text-gray-500 mt-1">Prøv at søge efter noget andet</p>
                        </div>
                    )}
                </div>
            )}

            {/* Edit/Create Modal */}
            {editModal.open && (
                <DialogShell onClose={() => setEditModal({ open: false, child: null, mode: 'full' })} labelledBy="child-dialog-title" maxWidth="max-w-lg">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#B54A32] to-[#9a3f2b] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#B54A32]/30">
                                    <UserIcon />
                                </div>
                                <h3 id="child-dialog-title" className="text-lg font-bold text-gray-900">
                                    {editModal.mode === 'grant' ? 'Rediger grund- og rammebevilling' : editModal.child ? 'Rediger barn' : 'Opret barn'}
                                </h3>
                            </div>
                            <button type="button" aria-label="Luk dialog" onClick={() => setEditModal({ open: false, child: null, mode: 'full' })} className="min-h-11 min-w-11 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                            {editModal.mode !== 'grant' && <>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="child-first-name" className="block text-xs font-semibold text-gray-700 mb-1">Fornavn *</label>
                                    <input id="child-first-name" required type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="glass-input w-full rounded-lg px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="child-last-name" className="block text-xs font-semibold text-gray-700 mb-1">Efternavn *</label>
                                    <input id="child-last-name" required type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="glass-input w-full rounded-lg px-3 py-2 text-sm" />
                                </div>
                            </div>

                            <div>
                                    <label htmlFor="child-birth-date" className="block text-xs font-semibold text-gray-700 mb-1">Fødselsdato</label>
                                    <input id="child-birth-date" type="date" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} className="glass-input w-full rounded-lg px-3 py-2 text-sm" />
                            </div>

                            <div>
                                <p className="block text-xs font-semibold text-gray-700 mb-1">Tilknyt barnepiger · {formData.caregiver_ids?.length || 0} valgt</p>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="p-2 bg-gray-50 border-b border-gray-200">
                                        <input type="text" placeholder="Søg barnepige (navn eller MA-nr)..." value={caregiverSearch} onChange={(e) => setCaregiverSearch(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20" />
                                    </div>
                                    <div className="max-h-36 overflow-y-auto p-1.5">
                                        {filteredModalCaregivers.map((cg) => (
                                            <label key={cg.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-gray-50 rounded-md cursor-pointer text-sm">
                                                <input type="checkbox" checked={formData.caregiver_ids?.includes(cg.id)} onChange={(e) => {
                                                    const ids = formData.caregiver_ids || [];
                                                    setFormData({ ...formData, caregiver_ids: e.target.checked ? [...ids, cg.id] : ids.filter(i => i !== cg.id) });
                                                }} className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]" />
                                                <span className="text-gray-700">{cg.first_name} {cg.last_name}</span>
                                                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{padMaNumber(cg.ma_number)}</span>
                                            </label>
                                        ))}
                                        {filteredModalCaregivers.length === 0 && caregivers.length > 0 && (
                                            <div className="text-gray-400 text-xs py-2 text-center">Ingen match</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>}

                            {/* Bevilling */}
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <label htmlFor="child-grant-type" className="block text-xs font-semibold text-gray-700 mb-1">Bevillingstype</label>
                                <select id="child-grant-type" value={formData.grant_type} onChange={(e) => setFormData({ ...formData, grant_type: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20 mb-2">
                                    <option value="week">Uge</option>
                                    <option value="month">Måned</option>
                                    <option value="quarter">Kvartal</option>
                                    <option value="half_year">Halvår</option>
                                    <option value="year">År</option>
                                    <option value="specific_weekdays">Specifikke ugedage</option>
                                </select>

                                {formData.grant_type === 'specific_weekdays' ? (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Timer pr. ugedag</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {weekdays.map((day) => (
                                                <div key={day} className="flex items-center gap-2 p-1.5 bg-white rounded-md border border-gray-200">
                                                    <input type="checkbox" checked={(formData.grant_weekdays?.[day] || 0) > 0} onChange={(e) => {
                                                        const wd = { ...formData.grant_weekdays };
                                                        wd[day] = e.target.checked ? (wd[day] || 2) : 0;
                                                        setFormData({ ...formData, grant_weekdays: wd });
                                                    }} className="rounded border-gray-300 text-[#B54A32] focus:ring-[#B54A32]" />
                                                    <span className="w-12 text-xs font-medium text-gray-700">{translateWeekday(day)}</span>
                                                    <input type="text" inputMode="decimal" value={formData.grant_weekdays?.[day] || ''} onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
                                                            const wd = { ...formData.grant_weekdays };
                                                            wd[day] = value;
                                                            setFormData({ ...formData, grant_weekdays: wd });
                                                        }
                                                    }} onBlur={(e) => {
                                                        const wd = { ...formData.grant_weekdays };
                                                        wd[day] = parseFloat(e.target.value.replace(',', '.')) || 0;
                                                        setFormData({ ...formData, grant_weekdays: wd });
                                                    }} placeholder="0" className="w-14 rounded-md px-2 py-1 text-xs border border-gray-300" />
                                                    <span className="text-[10px] text-gray-400">t</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="child-grant-hours" className="block text-xs font-semibold text-gray-700 mb-1">Timer pr. {translateGrantType(formData.grant_type).toLowerCase()}</label>
                                        <input id="child-grant-hours" type="text" inputMode="decimal" value={formData.grant_hours} onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) setFormData({ ...formData, grant_hours: value });
                                        }} onBlur={(e) => setFormData({ ...formData, grant_hours: parseFloat(e.target.value.replace(',', '.')) || 0 })} placeholder="0" className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#B54A32]/20" />
                                    </div>
                                )}
                            </div>

                            {/* Rammebevilling */}
                            <div className={`p-3 rounded-lg border ${formData.has_frame_grant ? 'border-[#A6402C] bg-[#f7ebe7]' : 'bg-gray-50 border-gray-200'}`}>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={formData.has_frame_grant} onChange={(e) => setFormData({ ...formData, has_frame_grant: e.target.checked })} className="rounded border-gray-300 text-[#A6402C] focus:ring-[#A6402C]" />
                                    <div>
                                        <span className="text-xs font-semibold text-gray-700">Selvstændig rammebevilling</span>
                                        <p className="text-[10px] text-gray-500">Separat årlig pulje, som vælges aktivt ved registrering</p>
                                    </div>
                                </label>
                                {formData.has_frame_grant && (
                                    <div className="mt-2">
                                        <label htmlFor="child-frame-hours" className="block text-xs font-semibold text-gray-700 mb-1">Timer pr. år</label>
                                        <input id="child-frame-hours" type="text" inputMode="decimal" value={formData.frame_hours} onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || /^[0-9]*[.,]?[0-9]*$/.test(value)) setFormData({ ...formData, frame_hours: value });
                                        }} onBlur={(e) => setFormData({ ...formData, frame_hours: parseFloat(e.target.value.replace(',', '.')) || 0 })} placeholder="0" className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-[#A6402C]/20" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-200">
                            <button type="button" onClick={handleSave} className="btn-kalundborg flex-1 rounded-lg px-4 py-2.5 font-semibold text-sm">Gem</button>
                            <button type="button" onClick={() => setEditModal({ open: false, child: null, mode: 'full' })} className="min-h-11 flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all">Annuller</button>
                        </div>
                </DialogShell>
            )}

            {extraModal.open && extraModal.child && (
                <DialogShell onClose={() => setExtraModal({ open: false, child: null })} labelledBy="extra-grant-dialog-title" maxWidth="max-w-2xl">
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                            <h3 id="extra-grant-dialog-title" className="text-lg font-bold text-gray-900">Tildel ekstra bevilling</h3>
                            <p className="mt-1 text-sm text-gray-600">{extraModal.child.first_name} {extraModal.child.last_name} · lægges oven på den valgte bevilling</p>
                        </div>
                        <button type="button" aria-label="Luk dialog" onClick={() => setExtraModal({ open: false, child: null })} className="min-h-11 min-w-11 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><CloseIcon /></button>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-stone-300 bg-stone-50 p-4 sm:grid-cols-2">
                        {!!extraModal.child.has_frame_grant && (
                            <div className="sm:col-span-2">
                                <label htmlFor="extra-source" className="block text-xs font-semibold text-gray-700 mb-1">Læg timerne på *</label>
                                <select id="extra-source" value={extraForm.grant_source || 'frame'} onChange={(e) => {
                                    const nextSource = e.target.value;
                                    const period = getExtraGrantPeriod(extraModal.child, nextSource);
                                    setExtraForm({
                                        ...extraForm,
                                        grant_source: nextSource,
                                        from_date: period.fromDate,
                                        to_date: period.toDate
                                    });
                                }} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                                    <option value="frame">Rammebevilling</option>
                                    <option value="normal">Normal bevilling</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="extra-hours" className="block text-xs font-semibold text-gray-700 mb-1">Ekstra timer *</label>
                            <input id="extra-hours" type="text" inputMode="decimal" value={extraForm.hours || ''} onChange={(e) => setExtraForm({ ...extraForm, hours: e.target.value })} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Fx 10" />
                        </div>
                        <div>
                            <label htmlFor="extra-granted-by" className="block text-xs font-semibold text-gray-700 mb-1">Tildelt af *</label>
                            <input id="extra-granted-by" value={extraForm.granted_by || ''} readOnly className="w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-gray-700" />
                        </div>
                        <div>
                            <label htmlFor="extra-from" className="block text-xs font-semibold text-gray-700 mb-1">Gyldig fra *</label>
                            <input id="extra-from" type="date" value={extraForm.from_date || ''} onChange={(e) => setExtraForm({ ...extraForm, from_date: e.target.value, ...(extraModal.child.grant_type === 'specific_weekdays' ? { to_date: e.target.value } : {}) })} readOnly={extraModal.child.grant_type !== 'specific_weekdays'} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm read-only:bg-stone-100" />
                        </div>
                        <div>
                            <label htmlFor="extra-to" className="block text-xs font-semibold text-gray-700 mb-1">Gyldig til *</label>
                            <input id="extra-to" type="date" value={extraForm.to_date || ''} readOnly className="w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="extra-comment" className="block text-xs font-semibold text-gray-700 mb-1">Begrundelse</label>
                            <textarea id="extra-comment" rows="2" value={extraForm.comment || ''} onChange={(e) => setExtraForm({ ...extraForm, comment: e.target.value })} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Hvorfor gives ekstratimerne?" />
                        </div>
                        <ExtraGrantPreview child={extraModal.child} form={extraForm} />
                        <button type="button" onClick={handleCreateExtraGrant} className="btn-kalundborg rounded-lg px-4 py-2.5 text-sm font-semibold sm:col-span-2">Tildel ekstratimer</button>
                    </div>

                    <div className="mt-5"><div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Aktive ekstrabevillinger i dag</div><div className="grid grid-cols-3 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-center">
                        <div><div className="text-[11px] text-gray-500">Tildelt ekstra</div><div className="font-bold text-slate-900">{formatHours(extraModal.child.grantSummary?.allExtraGrantHours ?? extraModal.child.grantSummary?.extraGrantHours)} t.</div></div>
                        <div><div className="text-[11px] text-gray-500">Brugt ekstra</div><div className="font-bold text-slate-900">{formatHours(extraModal.child.grantSummary?.allExtraUsedHours ?? extraModal.child.grantSummary?.extraUsedHours)} t.</div></div>
                        <div><div className="text-[11px] text-gray-500">Ekstra tilbage</div><div className="font-bold text-[#823322]">{formatHours(extraModal.child.grantSummary?.allExtraRemainingHours ?? extraModal.child.grantSummary?.extraRemainingHours)} t.</div></div>
                    </div></div>

                    <div className="mt-5 space-y-3 max-h-64 overflow-y-auto">
                        {extraGrants.map(grant => {
                            const usage = [...(extraModal.child.grantSummary?.extraGrants || []), ...(extraModal.child.grantSummary?.normalGrantSummary?.extraGrants || [])].find(item => item.id === grant.id);
                            return (
                                <div key={grant.id} className="rounded-xl border border-gray-200 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-gray-900">{formatHours(grant.hours)} ekstra timer</div>
                                            <div className="mt-1 text-xs font-semibold text-[#823322]">{grant.grant_source === 'frame' ? 'Rammebevilling' : 'Normal bevilling'}</div>
                                            <div className="mt-1 text-xs text-gray-600">Gyldig {formatDate(grant.from_date)} – {formatDate(grant.to_date)}</div>
                                            <div className="text-xs text-gray-600">Tildelt {formatDateTime(grant.granted_at || grant.created_at)} af {grant.granted_by || 'Godkender'}</div>
                                            {grant.comment && <div className="mt-1 text-xs text-gray-500">{grant.comment}</div>}
                                        </div>
                                        <button type="button" onClick={() => handleDeleteExtraGrant(grant.id)} className="min-h-10 min-w-10 p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Slet ekstrabevilling"><TrashIcon /></button>
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-gray-700">
                                        {usage ? `Brugt ${formatHours(usage.usedHours)} · tilbage ${formatHours(usage.remainingHours)} timer` : 'Ikke aktiv i den aktuelle opgørelsesdato'}
                                    </div>
                                </div>
                            );
                        })}
                        {extraGrants.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Der er endnu ikke givet ekstratimer.</p>}
                    </div>
                </DialogShell>
            )}
        </div>
    );
}
