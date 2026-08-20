import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { caregiversApi, timeEntriesApi } from '../../utils/api';
import { formatDate, formatHours, padMaNumber } from '../../utils/helpers';

const WarningIcon = () => (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const CheckIcon = () => (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const EmptyIcon = () => (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);

const ALLOWANCE_ROWS = [
    ['Normaltimer', 'normal_hours'],
    ['Aftentillæg', 'evening_hours'],
    ['Nattillæg', 'night_hours'],
    ['Lørdagstillæg', 'saturday_hours'],
    ['Søn-/helligdag', 'sunday_holiday_hours']
];

export default function RegisterTime({ caregiverId = 1 }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedChildId = searchParams.get('child');
    const previewRequest = useRef(0);
    const [caregiver, setCaregiver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [mobileReview, setMobileReview] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState('');
    const [previewing, setPreviewing] = useState(false);
    const [selectedChild, setSelectedChild] = useState(null);
    const [formData, setFormData] = useState({
        child_id: preselectedChildId || '',
        date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
        comment: '',
        use_frame_grant: null
    });

    useEffect(() => {
        async function loadCaregiver() {
            try {
                const data = await caregiversApi.getById(caregiverId);
                setCaregiver(data);
                const preselected = data.children?.find(child => child.id === Number(preselectedChildId));
                if (preselected) {
                    setSelectedChild(preselected);
                    setFormData(current => ({
                        ...current,
                        child_id: String(preselected.id),
                        use_frame_grant: preselected.has_frame_grant ? null : false
                    }));
                }
            } catch (error) {
                console.error('Fejl:', error);
            } finally {
                setLoading(false);
            }
        }
        loadCaregiver();
    }, [caregiverId, preselectedChildId]);

    useEffect(() => {
        async function loadPreview() {
            if (!formData.child_id || !formData.date || !formData.start_time || !formData.end_time || typeof formData.use_frame_grant !== 'boolean') {
                setPreview(null);
                setPreviewError('');
                return;
            }

            const requestId = ++previewRequest.current;
            try {
                setPreviewError('');
                setPreviewing(true);
                const result = await timeEntriesApi.preview({
                    child_id: Number(formData.child_id),
                    date: formData.date,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    use_frame_grant: formData.use_frame_grant
                });
                if (requestId === previewRequest.current) setPreview(result);
            } catch (error) {
                console.error('Preview fejl:', error);
                if (requestId === previewRequest.current) {
                    setPreview(null);
                    setPreviewError(error.message);
                }
            } finally {
                if (requestId === previewRequest.current) setPreviewing(false);
            }
        }
        loadPreview();
    }, [formData.child_id, formData.date, formData.start_time, formData.end_time, formData.use_frame_grant]);

    function updateForm(key, value) {
        setPreview(null);
        setPreviewError('');
        setFormData(current => ({ ...current, [key]: value }));
    }

    function selectChild(childId) {
        const child = caregiver.children.find(item => item.id === Number(childId));
        setPreview(null);
        setPreviewError('');
        setSelectedChild(child || null);
        setFormData(current => ({
            ...current,
            child_id: childId,
            use_frame_grant: child?.has_frame_grant ? null : false
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!formData.child_id) return window.alert('Vælg venligst et barn');
        if (typeof formData.use_frame_grant !== 'boolean') return window.alert('Vælg hvilken bevilling registreringen skal trækkes fra');
        if (formData.date > new Date().toISOString().split('T')[0]) return window.alert('Du kan ikke registrere timer for fremtidige datoer');

        setSubmitting(true);
        try {
            await timeEntriesApi.create({
                caregiver_id: caregiverId,
                child_id: Number(formData.child_id),
                date: formData.date,
                start_time: formData.start_time,
                end_time: formData.end_time,
                comment: formData.comment,
                use_frame_grant: formData.use_frame_grant,
                submitted_by: caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : 'Barnepige (demo)'
            });
            window.alert('Registrering oprettet!');
            navigate('/barnepige/mine-timer');
        } catch (error) {
            window.alert(`Fejl: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    async function calculateAndReview() {
        if (!formData.child_id || !formData.date || !formData.start_time || !formData.end_time || typeof formData.use_frame_grant !== 'boolean') return;
        setPreviewing(true);
        setPreviewError('');
        try {
            const result = await timeEntriesApi.preview({
                child_id: Number(formData.child_id),
                date: formData.date,
                start_time: formData.start_time,
                end_time: formData.end_time,
                use_frame_grant: formData.use_frame_grant
            });
            setPreview(result);
            if (!result.grantStatus?.error) {
                setMobileReview(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            setPreview(null);
            setPreviewError(error.message);
        } finally {
            setPreviewing(false);
        }
    }

    if (loading) return <div className="py-16 text-center text-sm text-slate-600">Indlæser registrering…</div>;

    if (!caregiver?.children?.length) {
        return (
            <section className="surface mx-auto max-w-xl rounded-lg p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-slate-500"><EmptyIcon /></div>
                <h1 className="text-xl font-bold">Ingen børn tilknyttet</h1>
                <p className="mt-2 text-slate-600">Du kan ikke registrere timer, før du er tilknyttet et barn.</p>
            </section>
        );
    }

    const normalGrantAvailable = selectedChild?.grant_type === 'specific_weekdays'
        ? Object.values(selectedChild.grant_weekdays || {}).some(hours => Number(hours) > 0)
        : Number(selectedChild?.grant_hours || 0) > 0;
    const grantStatus = preview?.grantStatus;
    const grantError = grantStatus?.error;
    const grantExceeded = grantStatus?.exceeded;
    const grantLimit = grantStatus?.effectiveGrantHours ?? grantStatus?.grantHours ?? 0;
    const projected = grantStatus?.totalAfterNew ?? 0;
    const progress = grantLimit > 0 ? Math.min(100, Math.max(0, (projected / grantLimit) * 100)) : 0;
    const canReview = Boolean(preview && !previewError && !grantError);
    const canCalculate = Boolean(formData.child_id && formData.date && formData.start_time && formData.end_time && typeof formData.use_frame_grant === 'boolean');
    const selectedGrantLabel = formData.use_frame_grant ? 'Rammebevilling' : 'Normal bevilling';

    return (
        <div className={mobileReview ? 'mobile-review-active' : ''}>
            <header className="page-heading mobile-review-form">
                <div className="eyebrow">Barnepige</div>
                <h1>Registrer timer</h1>
                <p>Indtast dine arbejdstider og kontrollér beregningen før indsendelse.</p>
            </header>
            <header className="page-heading mobile-review-summary mobile-only">
                <div>
                    <div className="eyebrow">Trin 2 af 2</div>
                    <h1>Kontrollér registrering</h1>
                    <p>Beregningen sker automatisk. Når du indsender, får registreringen status “Afventer godkendelse”.</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="form-workspace">
                <div className="form-workspace-grid">
                    <section className="form-section mobile-review-form" aria-label="Registreringsoplysninger">
                        <div>
                            <label htmlFor="register-child" className="form-label">Barn <span className="required">*</span></label>
                            <select id="register-child" value={formData.child_id} onChange={event => selectChild(event.target.value)} className="glass-input w-full rounded-md px-3" required>
                                <option value="">Vælg barn…</option>
                                {caregiver.children.map(child => <option key={child.id} value={child.id}>{child.first_name} {child.last_name}</option>)}
                            </select>
                        </div>

                        {selectedChild && (
                            <details className="relation-strip mt-3 p-3" open>
                                <summary className="cursor-pointer text-sm font-bold text-slate-800">Arbejdsrelation</summary>
                                <div className="mt-3 grid gap-2 border-t border-stone-200 pt-3 text-sm sm:grid-cols-2">
                                    <div><span className="text-slate-500">Barnepige:</span> <strong>{caregiver.first_name} {caregiver.last_name}</strong></div>
                                    <div><span className="text-slate-500">MA-nr.:</span> <strong className="font-mono">{padMaNumber(caregiver.ma_number)}</strong></div>
                                    <div><span className="text-slate-500">Barn:</span> <strong>{selectedChild.first_name} {selectedChild.last_name}</strong></div>
                                </div>
                            </details>
                        )}

                        {selectedChild && (
                            <fieldset className="mt-5">
                                <legend className="form-label">Vælg bevilling <span className="required">*</span></legend>
                                <p className="mb-3 text-xs text-slate-500">Timerne trækkes fra den pulje, du vælger her.</p>
                                <div className={`grid gap-3 ${selectedChild.has_frame_grant ? 'sm:grid-cols-2' : ''}`}>
                                    <label className={`grant-choice ${formData.use_frame_grant === false ? 'is-selected' : ''} ${normalGrantAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}>
                                        <input type="radio" name="grant_type" checked={formData.use_frame_grant === false} onChange={() => updateForm('use_frame_grant', false)} disabled={!normalGrantAvailable} className="text-[#A6402C] focus:ring-[#A6402C]" />
                                        <span><strong className="block text-sm">Normal bevilling</strong><span className="text-xs text-slate-500">{selectedChild.grant_hours || 0} timer pr. periode</span></span>
                                    </label>
                                    {selectedChild.has_frame_grant && (
                                        <label className={`grant-choice cursor-pointer ${formData.use_frame_grant === true ? 'is-selected' : ''}`}>
                                            <input type="radio" name="grant_type" checked={formData.use_frame_grant === true} onChange={() => updateForm('use_frame_grant', true)} className="text-[#A6402C] focus:ring-[#A6402C]" />
                                            <span><strong className="block text-sm">Rammebevilling</strong><span className="text-xs text-slate-500">{selectedChild.frame_hours || 0} timer pr. år</span></span>
                                        </label>
                                    )}
                                </div>
                                {typeof formData.use_frame_grant !== 'boolean' && <p className="mt-2 text-xs font-semibold text-amber-800">Vælg en bevilling for at fortsætte.</p>}
                            </fieldset>
                        )}

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label htmlFor="register-date" className="form-label">Dato <span className="required">*</span></label>
                                <input id="register-date" type="date" value={formData.date} onChange={event => updateForm('date', event.target.value)} max={new Date().toISOString().split('T')[0]} className="glass-input w-full rounded-md px-3" required />
                            </div>
                            <div>
                                <label htmlFor="register-start" className="form-label">Starttid <span className="required">*</span></label>
                                <input id="register-start" type="time" value={formData.start_time} onChange={event => updateForm('start_time', event.target.value)} className="glass-input w-full rounded-md px-3" required />
                            </div>
                            <div>
                                <label htmlFor="register-end" className="form-label">Sluttid <span className="required">*</span></label>
                                <input id="register-end" type="time" value={formData.end_time} onChange={event => updateForm('end_time', event.target.value)} className="glass-input w-full rounded-md px-3" required />
                            </div>
                        </div>

                        <div className="mt-5">
                            <label htmlFor="register-comment" className="form-label">Kommentar <span className="font-normal text-slate-500">(valgfri)</span></label>
                            <textarea id="register-comment" value={formData.comment} onChange={event => updateForm('comment', event.target.value)} className="glass-input min-h-24 w-full resize-y rounded-md p-3" maxLength={250} placeholder="Skriv kun oplysninger, som godkenderen har brug for" />
                            <div className="mt-1 text-right text-xs text-slate-500">{formData.comment.length} / 250</div>
                        </div>

                        {previewError && <div className="mt-4 flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800"><WarningIcon />Beregningen kunne ikke gennemføres: {previewError}</div>}
                    </section>

                    <aside className="form-section mobile-review-summary bg-[#fbfaf8]" aria-label="Beregning og bevilling">
                        <div className="calculation-panel p-4">
                            <h2 className="mb-3 text-base font-bold">Beregnet timefordeling</h2>
                            {preview ? ALLOWANCE_ROWS.map(([label, key]) => (
                                <div className="calculation-row" key={key}><span>{label}</span><strong>{formatHours(preview.allowances[key])}</strong></div>
                            )) : <p className="py-6 text-sm text-slate-500">Udfyld barn, bevilling, dato og tider for at se beregningen.</p>}
                            {preview && <div className="calculation-row total"><span>Total</span><strong>{formatHours(preview.allowances.total_hours)} timer</strong></div>}
                        </div>

                        {grantStatus && (
                            <div className={`calculation-panel mt-4 p-4 ${grantError || grantExceeded ? 'border-red-300' : ''}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-base font-bold">{selectedGrantLabel}</h2>
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${grantError || grantExceeded ? 'text-red-800' : 'text-emerald-800'}`}>
                                        {grantError || grantExceeded ? <WarningIcon /> : <CheckIcon />}
                                        {grantError ? 'Kan ikke beregnes' : grantExceeded ? 'Overskrider bevilling' : 'Inden for bevilling'}
                                    </span>
                                </div>

                                {grantError ? <p className="mt-3 text-sm text-red-800">{grantError}</p> : (
                                    <>
                                        <div className="mt-4 grant-progress" aria-label={`${Math.round(progress)} procent af bevillingen brugt efter registrering`}><span style={{ width: `${progress}%` }} /></div>
                                        <div className="mt-3 space-y-1.5 text-sm">
                                            <div className="flex justify-between gap-4"><span className="text-slate-600">Inden registrering</span><strong>{formatHours(grantStatus.usedHours)} / {formatHours(grantLimit)} t.</strong></div>
                                            <div className="flex justify-between gap-4"><span className="text-slate-600">Efter registrering</span><strong>{formatHours(projected)} / {formatHours(grantLimit)} t.</strong></div>
                                            <div className={`flex justify-between gap-4 border-t border-stone-200 pt-2 font-bold ${grantExceeded ? 'text-red-800' : 'text-[#823322]'}`}>
                                                <span>{grantExceeded ? 'Overskredet med' : 'Tilbage efter registrering'}</span>
                                                <strong>{formatHours(grantExceeded ? grantStatus.exceededBy : grantStatus.projectedRemainingHours)} t.</strong>
                                            </div>
                                        </div>

                                        {Number(grantStatus.extraGrantHours) > 0 && (
                                            <section className="mt-4 border-t border-[#A6402C] pt-3" aria-labelledby="extra-grant-heading">
                                                <h3 id="extra-grant-heading" className="mb-3 text-sm font-bold">Ekstra bevilling</h3>
                                                <div className="extra-grant-grid">
                                                    <div><span className="block text-xs text-slate-500">Tildelt</span><strong>{formatHours(grantStatus.extraGrantHours)} t.</strong></div>
                                                    <div><span className="block text-xs text-slate-500">Brugt</span><strong>{formatHours(grantStatus.projectedExtraUsedHours)} t.</strong></div>
                                                    <div><span className="block text-xs text-slate-500">Tilbage</span><strong>{formatHours(grantStatus.projectedExtraRemainingHours)} t.</strong></div>
                                                </div>
                                            </section>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {preview && selectedChild && (
                            <div className="calculation-panel mt-4 p-4">
                                <h2 className="text-sm font-bold">Registrering</h2>
                                <p className="mt-2 text-sm text-slate-700">{selectedChild.first_name} {selectedChild.last_name} · {formatDate(formData.date)} · {formData.start_time}–{formData.end_time}</p>
                                <p className="mt-1 text-xs text-slate-500">{selectedGrantLabel} · {formatHours(preview.allowances.total_hours)} timer</p>
                            </div>
                        )}
                    </aside>
                </div>

                <div className="sticky-actions flex flex-col gap-3 p-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => mobileReview ? setMobileReview(false) : navigate('/barnepige')} className="mobile-back btn-secondary px-6">{mobileReview ? 'Tilbage' : 'Annuller'}</button>
                    <button type="button" disabled={!canCalculate || previewing} onClick={calculateAndReview} className="btn-primary mobile-only w-full px-6">{previewing ? 'Beregner…' : 'Beregn og kontrollér'}</button>
                    <button type="submit" disabled={submitting || !canReview} className="mobile-submit btn-primary w-full px-6 md:w-auto">
                        {submitting ? 'Indsender…' : 'Indsend registrering'}
                    </button>
                </div>
            </form>
        </div>
    );
}
