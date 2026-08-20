import { translateStatus } from '../utils/helpers';

const StatusIcon = ({ status }) => {
    const path = status === 'pending'
        ? 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        : status === 'approved'
            ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';

    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
        </svg>
    );
};

export default function StatusBadge({ status }) {
    const statusClasses = {
        pending: 'status-pending',
        approved: 'status-approved',
        rejected: 'status-rejected'
    };

    return (
        <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${statusClasses[status] || ''}`}>
            <StatusIcon status={status} />
            <span>{translateStatus(status)}</span>
        </span>
    );
}
