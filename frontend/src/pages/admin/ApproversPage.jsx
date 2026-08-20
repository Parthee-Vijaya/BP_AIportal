import { useEffect, useState } from 'react';
import { approversApi } from '../../utils/api';
import { PERMISSIONS } from '../../utils/permissions';

const emptyForm = { name: '', email: '', permissions: [] };

export default function ApproversPage({ onProfilesChanged }) {
    const [approvers, setApprovers] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [newApprover, setNewApprover] = useState(emptyForm);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        const data = await approversApi.getAll();
        setApprovers(data);
        setDrafts(Object.fromEntries(data.map(item => [item.id, [...item.permissions]])));
    }

    function toggle(list, permission) {
        return list.includes(permission) ? list.filter(item => item !== permission) : [...list, permission];
    }

    async function save(approver) {
        try {
            await approversApi.update(approver.id, { permissions: drafts[approver.id] });
            setMessage(`Rettigheder gemt for ${approver.name}`);
            await load();
            await onProfilesChanged?.();
        } catch (error) { setMessage(error.message); }
    }

    async function create() {
        try {
            await approversApi.create(newApprover);
            setNewApprover(emptyForm);
            setMessage('Godkender oprettet');
            await load();
            await onProfilesChanged?.();
        } catch (error) { setMessage(error.message); }
    }

    return (
        <div className="space-y-5">
            <div className="page-heading">
                <div className="eyebrow">Administration</div>
                <h1>Godkendere og rettigheder</h1>
                <p className="mt-1 text-sm text-gray-600">Alle godkendere kan se overblik og godkende eller afvise timer. Her tildeles kun de ekstra administrative rettigheder.</p>
                {message && <div className="mt-3 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-slate-800" role="status">{message}</div>}
            </div>

            <div className="space-y-4">
                {approvers.map(approver => (
                    <section key={approver.id} className="surface rounded-lg border-l-[3px] border-l-[#A6402C] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div><h3 className="font-bold text-gray-900">{approver.name}</h3><p className="text-sm text-gray-500">{approver.email}</p></div>
                            <div className="flex gap-2 text-xs"><span className="rounded-md border border-stone-300 px-2 py-1 font-semibold">Overblik</span><span className="rounded-md border border-stone-300 px-2 py-1 font-semibold">Godkend/afvis</span></div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(PERMISSIONS).map(([permission, label]) => (
                                <label key={permission} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                                    <input type="checkbox" checked={drafts[approver.id]?.includes(permission) || false} onChange={() => setDrafts(current => ({ ...current, [approver.id]: toggle(current[approver.id] || [], permission) }))} />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <button type="button" onClick={() => save(approver)} className="btn-kalundborg mt-4 rounded-lg px-4 py-2 text-sm font-semibold">Gem rettigheder</button>
                    </section>
                ))}
            </div>

            <section className="surface rounded-lg border-dashed p-5">
                <h3 className="font-bold text-gray-900">Opret ny godkender</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input aria-label="Navn på ny godkender" placeholder="Navn" value={newApprover.name} onChange={e => setNewApprover({ ...newApprover, name: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" />
                    <input aria-label="E-mail på ny godkender" type="email" placeholder="E-mail" value={newApprover.email} onChange={e => setNewApprover({ ...newApprover, email: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(PERMISSIONS).map(([permission, label]) => (
                        <label key={permission} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm"><input type="checkbox" checked={newApprover.permissions.includes(permission)} onChange={() => setNewApprover({ ...newApprover, permissions: toggle(newApprover.permissions, permission) })} />{label}</label>
                    ))}
                </div>
                <button type="button" onClick={create} className="btn-kalundborg mt-4 rounded-lg px-4 py-2 text-sm font-semibold">Opret godkender</button>
            </section>
        </div>
    );
}
