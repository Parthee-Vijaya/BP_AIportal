import { useState } from 'react';
import { ENTRA_ROLE_DEFS, viewsForRoles } from '../utils/demoRoles';
import { initialsOf } from '../utils/helpers';

// Midlertidig demo-skærm: indtil de fire AD/Entra-grupper findes, vælger man
// her hvilke roller man vil teste appen med. Bevidst lille og "værktøjsagtig",
// så den ikke ligner en del af selve appen. Valget gemmes kun i egen browser.

const VIEW_LABELS = {
    administrator: 'Administrator',
    approver: 'Godkender',
    caregiver: 'Barnepige'
};

function selectionSummary(roleKeys) {
    if (!roleKeys.includes('access')) {
        return 'Uden rolle 1 → "ingen adgang"-siden.';
    }
    const views = viewsForRoles(roleKeys);
    if (views.length === 0) {
        return 'Kun adgang → "ingen roller"-siden.';
    }
    return `Giver: ${views.map(view => VIEW_LABELS[view]).join(' + ')}.`;
}

function rolesStatusLine(me) {
    if (!me.rolesConfigured) return 'de fire Barnepige-grupper findes ikke i Entra endnu';
    const have = ENTRA_ROLE_DEFS.filter(def => me.entraRoles?.[def.key] === true);
    return have.length > 0
        ? `har ${have.length} af de fire Barnepige-roller: ${have.map(def => def.label).join(', ')}`
        : 'har ingen af de fire Barnepige-roller';
}

function IdentityRow({ me }) {
    if (me === undefined) return <p className="text-xs text-slate-500">Henter login-oplysninger…</p>;
    if (me === null) return <p className="text-xs text-amber-700">Kunne ikke hente login-oplysninger.</p>;
    return (
        <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg p-1.5 -m-1.5 hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kalundborg-700 text-xs font-bold text-white">
                    {initialsOf(me.name)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{me.name || 'Ukendt navn'}</span>
                    <span className="block truncate text-xs text-slate-500">
                        {me.groups?.length || 0} AD-grupper · {rolesStatusLine(me)}
                    </span>
                </span>
                <span className="text-xs text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
            </summary>
            <div className="mt-2 space-y-1.5 rounded-lg bg-stone-100 p-2.5 text-xs text-slate-600">
                <p><span className="font-semibold">E-mail:</span> {me.upn}</p>
                {me.oid && <p><span className="font-semibold">Bruger-id:</span> <span className="font-mono">{me.oid}</span></p>}
                <p><span className="font-semibold">Login:</span> {me.authEnabled ? 'AI-portalens Entra ID-login' : 'slået fra i dette miljø (udvikler-identitet)'}</p>
                {me.groupOverage && (
                    <p className="text-amber-700">Brugeren er i så mange grupper, at Entra udelod listen fra login-billetten.</p>
                )}
                {me.groups?.length > 0 && (
                    <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto pt-0.5">
                        {me.groups.map(group => (
                            <span key={group} className="rounded bg-white px-1 py-0.5 font-mono text-[10px] text-slate-500">{group}</span>
                        ))}
                    </div>
                )}
            </div>
        </details>
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
        <div className="flex min-h-screen items-center justify-center bg-stone-200/70 px-4 py-8">
            <div className="w-full max-w-sm rounded-xl border-2 border-dashed border-amber-400 bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between">
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-950">Demo</span>
                    <span className="text-[10px] text-slate-400">Barnepige Timeregistrering · test</span>
                </div>

                <div className="mt-3">
                    <IdentityRow me={me} />
                </div>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Test med roller</p>
                <div className="mt-1.5 space-y-1">
                    {ENTRA_ROLE_DEFS.map(def => (
                        <label
                            key={def.key}
                            title={def.groupName}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${selected.has(def.key) ? 'border-kalundborg-600 bg-kalundborg-50' : 'border-stone-200 hover:border-stone-300'}`}
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(def.key)}
                                onChange={() => toggle(def.key)}
                                className="h-3.5 w-3.5 accent-[#B54A32]"
                            />
                            <span className="w-3 text-center text-[10px] font-bold text-slate-400">{def.number}</span>
                            <span className="font-medium text-slate-800">{def.label}</span>
                            <span className="ml-auto truncate pl-2 text-[10px] text-slate-400">{def.hint}</span>
                        </label>
                    ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                    <p className="text-xs text-slate-500">{selectionSummary(roleKeys)}</p>
                    <button type="button" onClick={() => onContinue(roleKeys)} className="btn-primary shrink-0 !px-3 !py-1.5 !text-sm">
                        Fortsæt
                    </button>
                </div>
            </div>
        </div>
    );
}
