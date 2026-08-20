import { loadDataSource } from './demoRoles';

// API'et bor under samme base som appen (fx /barnepige-app/api bag portalen).
const API_BASE = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/api`;

// 401 = ikke logget ind i AI-portalen. Send browseren gennem portalens
// stille Entra-login og tilbage hertil. sessionStorage-vagten forhindrer
// et redirect-loop hvis login-flowet fejler.
function redirectToPortalLogin() {
    const key = 'bpPortalLoginRedirectAt';
    const last = Number(sessionStorage.getItem(key)) || 0;
    if (Date.now() - last < 15000) return;
    sessionStorage.setItem(key, String(Date.now()));
    const returnTo = window.location.pathname + window.location.search;
    window.location.assign(`/api/auth/entra/start?returnTo=${encodeURIComponent(returnTo)}`);
}

async function handleErrorResponse(response, fallbackMessage) {
    if (response.status === 401) {
        redirectToPortalLogin();
        throw new Error('Du skal være logget ind i AI-portalen');
    }
    const error = await response.json().catch(() => ({ error: fallbackMessage }));
    throw new Error(error.error || fallbackMessage);
}

async function fetchApi(endpoint, options = {}) {
    const approverId = localStorage.getItem('demoApproverId');
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-Data-Source': loadDataSource(),
            ...(approverId ? { 'X-Approver-Id': approverId } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        await handleErrorResponse(response, 'Ukendt fejl');
    }

    return response.json();
}

async function downloadApi(endpoint) {
    const approverId = localStorage.getItem('demoApproverId');
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'X-Data-Source': loadDataSource(),
            ...(approverId ? { 'X-Approver-Id': approverId } : {})
        }
    });
    if (!response.ok) {
        await handleErrorResponse(response, 'Kunne ikke hente filen');
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'timeregistreringer.xlsx';
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return filename;
}

// Hvem er logget ind (portal-identitet + Entra-roller)
export const meApi = {
    get: () => fetchApi('/me')
};

// Children API
export const childrenApi = {
    getAll: () => fetchApi('/children'),
    getById: (id) => fetchApi(`/children/${id}`),
    create: (data) => fetchApi('/children', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/children/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateGrant: (id, data) => fetchApi(`/children/${id}/grant`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchApi(`/children/${id}`, { method: 'DELETE' })
};

export const approversApi = {
    getAll: () => fetchApi('/approvers'),
    getPermissions: () => fetchApi('/approvers/permissions'),
    create: (data) => fetchApi('/approvers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/approvers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

// Caregivers API
export const caregiversApi = {
    getAll: () => fetchApi('/caregivers'),
    getById: (id) => fetchApi(`/caregivers/${id}`),
    create: (data) => fetchApi('/caregivers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/caregivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchApi(`/caregivers/${id}`, { method: 'DELETE' })
};

// Time Entries API
export const timeEntriesApi = {
    getAll: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return fetchApi(`/time-entries${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => fetchApi(`/time-entries/${id}`),
    getAudit: (id) => fetchApi(`/time-entries/${id}/audit`),
    create: (data) => fetchApi('/time-entries', { method: 'POST', body: JSON.stringify(data) }),
    preview: (data) => fetchApi('/time-entries/preview', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id, reviewedBy) => fetchApi(`/time-entries/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ reviewed_by: reviewedBy })
    }),
    reject: (id, reviewedBy, reason) => fetchApi(`/time-entries/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reviewed_by: reviewedBy, rejection_reason: reason })
    }),
    markPayroll: (id, payrollDate = null, registeredBy = null) => fetchApi(`/time-entries/${id}/payroll`, {
        method: 'PUT',
        body: JSON.stringify({
            ...(payrollDate != null ? { payroll_date: payrollDate } : {}),
            ...(registeredBy ? { registered_by: registeredBy } : {})
        })
    }),
    batchApprove: (ids, reviewedBy) => fetchApi('/time-entries/batch-approve', {
        method: 'POST',
        body: JSON.stringify({ ids, reviewed_by: reviewedBy })
    })
};

// Extra grants API
export const extraGrantsApi = {
    getAll: (childId = null) => fetchApi(`/extra-grants${childId ? `?child_id=${childId}` : ''}`),
    getById: (id) => fetchApi(`/extra-grants/${id}`),
    create: (data) => fetchApi('/extra-grants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/extra-grants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchApi(`/extra-grants/${id}`, { method: 'DELETE' })
};

// Settings API
export const settingsApi = {
    getMonthInterval: () => fetchApi('/settings/month-interval'),
    getMonthIntervalHistory: () => fetchApi('/settings/month-interval/history'),
    updateMonthInterval: (startDay, endDay) => fetchApi('/settings/month-interval', {
        method: 'PUT',
        body: JSON.stringify({ start_day: startDay, end_day: endDay })
    })
};

// Holidays API
export const holidaysApi = {
    getAll: () => fetchApi('/holidays'),
    getKalendarium: (year) => fetchApi(`/holidays/kalendarium/${year}`),
    create: (data) => fetchApi('/holidays', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchApi(`/holidays/${id}`, { method: 'DELETE' })
};

export const reportsApi = {
    getDashboard: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return fetchApi(`/reports${queryString ? `?${queryString}` : ''}`);
    },
    downloadExcel: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return downloadApi(`/reports/excel${queryString ? `?${queryString}` : ''}`);
    }
};

// Export API — bruges som direkte download-links, så datakilden sendes som
// query-parameter i stedet for header.
export const exportApi = {
    timeEntries: (params = {}) => {
        const approverId = localStorage.getItem('demoApproverId');
        const queryString = new URLSearchParams({
            ...params,
            data_source: loadDataSource(),
            ...(approverId ? { approver_id: approverId } : {})
        }).toString();
        return `${API_BASE}/export/time-entries?${queryString}`;
    },
    children: () => {
        const approverId = localStorage.getItem('demoApproverId');
        const queryString = new URLSearchParams({
            data_source: loadDataSource(),
            ...(approverId ? { approver_id: approverId } : {})
        }).toString();
        return `${API_BASE}/export/children?${queryString}`;
    }
};
