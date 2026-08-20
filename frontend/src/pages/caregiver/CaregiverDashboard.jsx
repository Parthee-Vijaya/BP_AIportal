import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GrantStatusBadge from '../../components/GrantStatusBadge';
import { caregiversApi } from '../../utils/api';
import { formatDate, formatHours, padMaNumber, translateGrantType, translateWeekday } from '../../utils/helpers';

const ArrowIcon = () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);

export default function CaregiverDashboard({ caregiverId = 1, userName }) {
    const [caregiver, setCaregiver] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        caregiversApi.getById(caregiverId)
            .then(setCaregiver)
            .catch(error => console.error('Fejl ved indlæsning:', error))
            .finally(() => setLoading(false));
    }, [caregiverId]);

    if (loading) return <div className="py-16 text-center text-sm text-slate-600">Indlæser dit overblik…</div>;
    if (!caregiver) return <div className="surface rounded-lg p-10 text-center"><h1 className="text-xl font-bold">Barnepige ikke fundet</h1><p className="mt-2 text-slate-600">Kontakt din administrator.</p></div>;

    const children = caregiver.children || [];
    const activeGrants = children.filter(child => Number(child.grantSummary?.usedHours) > 0).length;
    const extraHours = children.reduce((sum, child) => sum + Number(child.grantSummary?.allExtraRemainingHours ?? child.grantSummary?.extraRemainingHours ?? 0), 0);

    return (
        <div>
            <header className="page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="eyebrow">Barnepige · Demo-profil: {caregiver.first_name} {caregiver.last_name} · MA {padMaNumber(caregiver.ma_number)}</div>
                    <h1>Hej {(userName || caregiver.first_name).split(' ')[0]}</h1>
                    <p>Her kan du registrere timer og følge dine bevillinger.</p>
                </div>
                <Link to="/barnepige/registrer" className="btn-primary px-5">Registrer timer</Link>
            </header>

            <section className="metric-strip mb-7" aria-label="Hurtigt overblik">
                <div className="metric"><div className="metric-label">Tilknyttede børn</div><div className="metric-value">{children.length}</div><div className="metric-note">Aktive arbejdsrelationer</div></div>
                <div className="metric"><div className="metric-label">Bevillinger i brug</div><div className="metric-value">{activeGrants}</div><div className="metric-note">Med registrerede timer</div></div>
                <div className="metric"><div className="metric-label">Ekstratimer tilbage</div><div className="metric-value">{formatHours(extraHours)}</div><div className="metric-note">På tværs af bevillinger</div></div>
                <div className="metric"><div className="metric-label">Næste handling</div><Link to="/barnepige/mine-timer" className="inline-flex items-center gap-2 pt-1 font-bold text-[#823322]">Se status <ArrowIcon /></Link><div className="metric-note">Følg dine indsendelser</div></div>
            </section>

            <div className="mb-4 flex items-end justify-between gap-4">
                <div><h2 className="text-xl font-bold">Dine børn og bevillinger</h2><p className="mt-1 text-sm text-slate-600">Vælg et barn for at starte en registrering.</p></div>
            </div>

            {children.length === 0 ? (
                <div className="surface rounded-lg p-10 text-center"><h2 className="text-lg font-bold">Ingen børn tilknyttet</h2><p className="mt-2 text-slate-600">Kontakt din leder for at blive tilknyttet.</p></div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {children.map(child => (
                        <article key={child.id} className="surface overflow-hidden rounded-lg border-l-[3px] border-l-[#A6402C]">
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold">{child.first_name} {child.last_name}</h3>
                                    </div>
                                    <span className="rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-xs font-bold text-slate-700">{child.has_frame_grant ? 'Rammebevilling' : translateGrantType(child.grant_type)}</span>
                                </div>

                                {child.grantSummary && (
                                    <div className="mt-5 border-t border-stone-200 pt-4">
                                        {child.grantSummary.grantType === 'specific_weekdays' ? (
                                            <div className="space-y-3">
                                                {Object.entries(child.grantSummary.weekdays || {}).map(([day, data]) => (
                                                    <div key={day}><div className="mb-1 text-xs font-bold text-slate-600">{translateWeekday(day)}</div><GrantStatusBadge used={data.usedHours} total={data.effectiveGrantHours ?? data.grantHours} /></div>
                                                ))}
                                            </div>
                                        ) : <GrantStatusBadge used={child.grantSummary.usedHours} total={child.grantSummary.effectiveGrantHours ?? child.grantSummary.grantHours} />}

                                        {Number(child.grantSummary.allExtraGrantHours ?? child.grantSummary.extraGrantHours) > 0 && (
                                            <section className="mt-4 border-t border-[#A6402C] pt-3" aria-label="Ekstra bevilling">
                                                <div className="mb-2 text-sm font-bold">Ekstra bevilling</div>
                                                <div className="grid grid-cols-3 gap-3 text-sm">
                                                    <div><span className="block text-xs text-slate-500">Tildelt</span><strong>{formatHours(child.grantSummary.allExtraGrantHours ?? child.grantSummary.extraGrantHours)} t.</strong></div>
                                                    <div><span className="block text-xs text-slate-500">Brugt</span><strong>{formatHours(child.grantSummary.allExtraUsedHours ?? child.grantSummary.extraUsedHours)} t.</strong></div>
                                                    <div><span className="block text-xs text-slate-500">Tilbage</span><strong>{formatHours(child.grantSummary.allExtraRemainingHours ?? child.grantSummary.extraRemainingHours)} t.</strong></div>
                                                </div>
                                            </section>
                                        )}

                                        {child.grantSummary.periodStart && <p className="mt-4 text-xs text-slate-500">Periode: {formatDate(child.grantSummary.periodStart)} – {formatDate(child.grantSummary.periodEnd)}</p>}
                                    </div>
                                )}
                            </div>
                            <Link to={`/barnepige/registrer?child=${child.id}`} className="flex min-h-12 items-center justify-between border-t border-stone-200 px-5 text-sm font-bold text-[#823322] hover:bg-[#f7ebe7]">
                                Registrer timer for {child.first_name}<ArrowIcon />
                            </Link>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
