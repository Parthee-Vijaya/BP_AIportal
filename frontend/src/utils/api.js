const API_BASE = '/api';

async function fetchApi(endpoint, options = {}) {
    const approverId = localStorage.getItem('demoApproverId');
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(approverId ? { 'X-Approver-Id': approverId } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Ukendt fejl' }));
        throw new Error(error.error || 'API fejl');
    }

    return response.json();
}

async function downloadApi(endpoint) {
    const approverId = localStorage.getItem('demoApproverId');
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: approverId ? { 'X-Approver-Id': approverId } : {}
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Kunne ikke hente filen' }));
        throw new Error(error.error || 'Kunne ikke hente filen');
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

// Children API
export const childrenApi = {
    getAll: () => fetchApi('/children'),
    getById: (id) => fetchApi(`/children/${id}`),
    create: (data) => fetchApi('/children', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchApi(`/children/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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

// Export API
export const exportApi = {
    timeEntries: (params = {}) => {
        const approverId = localStorage.getItem('demoApproverId');
        const queryString = new URLSearchParams({ ...params, ...(approverId ? { approver_id: approverId } : {}) }).toString();
        return `${API_BASE}/export/time-entries${queryString ? `?${queryString}` : ''}`;
    },
    children: () => {
        const approverId = localStorage.getItem('demoApproverId');
        return `${API_BASE}/export/children${approverId ? `?approver_id=${encodeURIComponent(approverId)}` : ''}`;
    }
};
