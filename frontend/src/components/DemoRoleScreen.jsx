import { useState } from 'react';
import { ENTRA_ROLE_DEFS, viewsForRoles } from '../utils/demoRoles';

// Midlertidig demo-skærm: indtil de fire AD/Entra-grupper findes, vælger man
// her hvilke roller man vil teste appen med. Valget gemmes kun i egen browser.

function initialsOf(name) {
    if (!name) return '?';
    const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '?';
}

const VIEW_LABELS = {
    administrator: 'Administrator',
    approver: 'Godkender',
    caregiver: 'Barnepige'
};

function selectionSummary(roleKeys) {
    if (!roleKeys.includes('access')) {
        return 'Uden rolle 1 lander du på "ingen adgang"-siden.';
    }
    const views = viewsForRoles(roleKeys);
    if (views.length === 0) {
        return 'Adgang til appen, men ingen visninger — du lander på en tom "ingen roller"-side.';
    }
    return `Du får ${views.length === 1 ? 'visningen' : 'visningerne'}: ${views.map(view => VIEW_LABELS[view]).join(', ')}.`;
}

function IdentityCard({ me }) {
    if (me === undefined) {
        return (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Henter login-oplysninger…</p>
            </section>
        );
    }
    if (me === null) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <p className="text-sm text-amber-900">Kunne ikke hente login-oplysninger fra portalen.</p>
            </section>
        );
    }
    const knownRoles = ENTRA_ROLE_DEFS.filter(def => me.entraRoles?.[def.key] === true);
    return (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="eyebrow">Logget ind som</p>
            <div className="mt-3 flex items-start gap-4">
                <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-kalundborg-700 text-lg font-bold text-white">
                    {initialsOf(me.name)}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{me.name || 'Ukendt navn'}</p>
                    <p className="truncate text-sm text-slate-600">{me.upn}</p>
                    {me.oid && <p className="mt-1 truncate text-xs text-slate-400">Bruger-id: {me.oid}</p>}
                </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2">
                <div>
                    <dt className="font-semibold text-slate-700">Login</dt>
                    <dd className="text-slate-600">
                        {me.authEnabled ? 'AI-portalens Entra ID-login' : 'Slået fra i dette miljø (udvikler-identitet)'}
                    </dd>
                </div>
                <div>
                    <dt className="font-semibold text-slate-700">Roller fra Entra ID</dt>
                    <dd className="text-slate-600">
                        {me.rolesConfigured
                            ? (knownRoles.length > 0 ? knownRoles.map(def => def.label).join(', ') : 'Ingen af de fire roller')
                            : 'Grupperne er ikke oprettet endnu — vælg roller nedenfor'}
                    </dd>
                </div>
                <div className="sm:col-span-2">
                    <dt className="font-semibold text-slate-700">AD-grupper i login ({me.groups?.length || 0})</dt>
                    <dd className="text-slate-600">
                        {me.groupOverage && (
                            <span className="mb-1 block text-amber-700">
                                Bemærk: brugeren er i så mange grupper, at Entra udelod listen fra login-billetten.
                            </span>
                        )}
                        {me.groups?.length > 0 ? (
                            <span className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                                {me.groups.map(group => (
                                    <span key={group} className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{group}</span>
                                ))}
                            </span>
                        ) : (
                            !me.groupOverage && 'Ingen gruppe-id\'er i login-billetten'
                        )}
                    </dd>
                </div>
            </dl>
        </section>
    );
}

export default function DemoRoleScreen({ me, initialRoles, onContinue }) {
    const [selected, setSelected] = useState(() => new Set(initialRoles));

    function toggle(key) {
        setSelected(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const roleKeys = [...selected];

    return (
        <div className="min-h-screen bg-stone-100">
            <header className="brand-header text-white">
                <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
                    <p className="text-[15px] font-bold leading-tight">Kalundborg Kommune</p>
                    <p className="text-sm text-white/80">Barnepige Timeregistrering</p>
                </div>
            </header>

            <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
                <div>
                    <span className="inline-block rounded-md bg-kalundborg-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">Demo</span>
                    <h1 className="mt-2 text-2xl font-bold text-slate-900">Vælg roller til test</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        De fire roller bliver til rigtige AD-grupper om få dage. Indtil da kan du her vælge
                        en vilkårlig kombination og se, hvad appen viser med netop de roller. Valget gemmes
                        kun i din egen browser.
                    </p>
                </div>

                <IdentityCard me={me} />

                <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="eyebrow">Roller</p>
                    <div className="mt-3 space-y-2">
                        {ENTRA_ROLE_DEFS.map(def => (
                            <label
                                key={def.key}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected.has(def.key) ? 'border-kalundborg-700 bg-kalundborg-50' : 'border-stone-200 hover:border-stone-300'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(def.key)}
                                    onChange={() => toggle(def.key)}
                                    className="mt-1 h-4 w-4 accent-[#B54A32]"
                                />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-slate-700">{def.number}</span>
                                        <span className="font-semibold text-slate-900">{def.label}</span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-slate-400">{def.groupName}</span>
                                    <span className="mt-0.5 block text-sm text-slate-600">{def.effect}</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-slate-700">{selectionSummary(roleKeys)}</p>
                        <button type="button" onClick={() => onContinue(roleKeys)} className="btn-primary shrink-0">
                            Fortsæt
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
