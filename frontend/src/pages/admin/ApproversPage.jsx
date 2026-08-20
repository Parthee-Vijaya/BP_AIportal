import { useEffect, useState } from 'react';
import { approversApi } from '../../utils/api';
import {
    APPROVER_BASE_PERMISSIONS,
    OPTIONAL_APPROVER_PERMISSIONS,
    PERMISSIONS,
    ROLES
} from '../../utils/permissions';

const emptyForm = { name: '', email: '', role: 'approver', assigned_permissions: [] };

function RoleBadge({ role }) {
    const isAdministrator = role === 'administrator';
    return (
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${isAdministrator ? 'border-[#A6402C] bg-[#f7ebe7] text-[#823322]' : 'border-stone-300 bg-stone-50 text-slate-700'}`}>
            {ROLES[role] || role}
        </span>
    );
}

function FixedAccess({ role }) {
    const permissions = role === 'administrator'
        ? Object.keys(PERMISSIONS)
        : APPROVER_BASE_PERMISSIONS;
    return (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Fast adgang via rollen</div>
            <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold">Overblik</span>
                <span className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold">Godkend og afvis</span>
                {permissions.map(permission => (
                    <span key={permission} className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold">{PERMISSIONS[permission]}</span>
                ))}
            </div>
        </div>
    );
}

function OptionalPermissions({ values, onChange, disabled = false }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {OPTIONAL_APPROVER_PERMISSIONS.map(permission => (
                <label key={permission} className={`flex min-h-12 items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm ${disabled ? 'bg-stone-50 text-slate-400' : 'bg-white'}`}>
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={values.includes(permission)}
                        onChange={() => onChange(values.includes(permission)
                            ? values.filter(item => item !== permission)
                            : [...values, permission])}
                    />
                    {PERMISSIONS[permission]}
                </label>
            ))}
        </div>
    );
}

export default function ApproversPage({ onProfilesChanged }) {
    const [approvers, setApprovers] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [newProfile, setNewProfile] = useState(emptyForm);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        const data = await approversApi.getAll();
        const sorted = [...data].sort((a, b) => (
            a.role === b.role ? a.name.localeCompare(b.name, 'da') : a.role === 'administrator' ? -1 : 1
        ));
        setApprovers(sorted);
        setDrafts(Object.fromEntries(sorted.map(item => [item.id, {
            role: item.role,
            assigned_permissions: [...(item.assigned_permissions || [])]
        }])));
    }

    async function save(profile) {
        try {
            await approversApi.update(profile.id, drafts[profile.id]);
            setMessage(`Rolle og rettigheder er gemt for ${profile.name}`);
            await load();
            await onProfilesChanged?.();
        } catch (error) { setMessage(error.message); }
    }

    async function create() {
        try {
            await approversApi.create(newProfile);
            setNewProfile(emptyForm);
            setMessage('Profilen er oprettet');
            await load();
            await onProfilesChanged?.();
        } catch (error) { setMessage(error.message); }
    }

    return (
        <div className="space-y-5">
            <header className="page-heading">
                <div className="eyebrow">Administrator</div>
                <h1>Roller og rettigheder</h1>
                <p className="mt-1 text-sm text-gray-600">Godkendere har altid rapporter og bevillingsstyring. Administratorer har fuld adgang; her kan du også give en godkender udvalgte ekstra administrative rettigheder.</p>
                {message && <div className="mt-3 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-slate-800" role="status">{message}</div>}
            </header>

            <div className="space-y-4">
                {approvers.map(profile => {
                    const draft = drafts[profile.id] || { role: profile.role, assigned_permissions: [] };
                    const isAdministrator = draft.role === 'administrator';
                    return (
                        <section key={profile.id} className="surface rounded-lg border-l-[3px] border-l-[#A6402C] p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div><h2 className="text-lg font-bold text-gray-900">{profile.name}</h2><p className="text-sm text-gray-500">{profile.email}</p></div>
                                <div className="flex items-center gap-2">
                                    <RoleBadge role={draft.role} />
                                    <label className="sr-only" htmlFor={`role-${profile.id}`}>Rolle for {profile.name}</label>
                                    <select
                                        id={`role-${profile.id}`}
                                        value={draft.role}
                                        onChange={event => setDrafts(current => ({
                                            ...current,
                                            [profile.id]: { ...draft, role: event.target.value, assigned_permissions: [] }
                                        }))}
                                        className="field-control rounded-md px-3 text-sm"
                                    >
                                        <option value="approver">Godkender</option>
                                        <option value="administrator">Administrator</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4"><FixedAccess role={draft.role} /></div>
                            <div className="mt-4">
                                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ekstra rettigheder til godkender</div>
                                <OptionalPermissions
                                    disabled={isAdministrator}
                                    values={draft.assigned_permissions.filter(permission => OPTIONAL_APPROVER_PERMISSIONS.includes(permission))}
                                    onChange={permissions => setDrafts(current => ({
                                        ...current,
                                        [profile.id]: { ...draft, assigned_permissions: permissions }
                                    }))}
                                />
                                {isAdministrator && <p className="mt-2 text-xs text-slate-500">Administratorrollen indeholder allerede alle rettigheder.</p>}
                            </div>
                            <button type="button" onClick={() => save(profile)} className="btn-kalundborg mt-4 rounded-lg px-4 py-2 text-sm font-semibold">Gem rolle og rettigheder</button>
                        </section>
                    );
                })}
            </div>

            <section className="surface rounded-lg border-dashed p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><h2 className="text-lg font-bold text-gray-900">Opret ny profil</h2><p className="mt-1 text-sm text-slate-500">Vælg rollen først. Ekstra rettigheder er kun relevante for godkendere.</p></div>
                    <div>
                        <label htmlFor="new-profile-role" className="mb-1 block text-xs font-bold text-slate-600">Rolle</label>
                        <select id="new-profile-role" value={newProfile.role} onChange={event => setNewProfile({ ...newProfile, role: event.target.value, assigned_permissions: [] })} className="field-control rounded-md px-3 text-sm">
                            <option value="approver">Godkender</option>
                            <option value="administrator">Administrator</option>
                        </select>
                    </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input aria-label="Navn på ny profil" placeholder="Navn" value={newProfile.name} onChange={event => setNewProfile({ ...newProfile, name: event.target.value })} className="field-control rounded-lg px-3 py-2" />
                    <input aria-label="E-mail på ny profil" type="email" placeholder="E-mail" value={newProfile.email} onChange={event => setNewProfile({ ...newProfile, email: event.target.value })} className="field-control rounded-lg px-3 py-2" />
                </div>
                <div className="mt-4"><FixedAccess role={newProfile.role} /></div>
                {newProfile.role === 'approver' && (
                    <div className="mt-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Valgfrie ekstra rettigheder</div>
                        <OptionalPermissions values={newProfile.assigned_permissions} onChange={permissions => setNewProfile({ ...newProfile, assigned_permissions: permissions })} />
                    </div>
                )}
                <button type="button" onClick={create} className="btn-kalundborg mt-4 rounded-lg px-4 py-2 text-sm font-semibold">Opret profil</button>
            </section>
        </div>
    );
}
