import { calculateGrantPercentage, formatHours, getGrantStatusColor } from '../utils/helpers';

const WarningIcon = () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const STATUS = {
    green: { text: 'text-emerald-800', bar: 'bg-emerald-700', label: 'Inden for bevilling' },
    yellow: { text: 'text-amber-800', bar: 'bg-amber-600', label: 'Tæt på grænsen' },
    red: { text: 'text-red-800', bar: 'bg-red-700', label: 'Bevilling opbrugt' }
};

export default function GrantStatusBadge({ used, total, showBar = true }) {
    const percentage = calculateGrantPercentage(used, total);
    const status = STATUS[getGrantStatusColor(percentage)];

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className={`inline-flex items-center gap-1.5 font-bold ${status.text}`}>
                    {percentage >= 100 && <WarningIcon />}
                    {status.label}
                </span>
                <span className="font-semibold text-slate-800">{formatHours(used)} / {formatHours(total)} t.</span>
            </div>
            {showBar && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label="Forbrugt bevilling" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}>
                    <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${Math.min(100, percentage)}%` }} />
                </div>
            )}
        </div>
    );
}
