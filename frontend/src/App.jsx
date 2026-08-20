import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import PermissionRoute from './components/PermissionRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import ApprovalPage from './pages/admin/ApprovalPage';
import ApproversPage from './pages/admin/ApproversPage';
import ChildrenPage from './pages/admin/ChildrenPage';
import CaregiversPage from './pages/admin/CaregiversPage';
import HolidaysPage from './pages/admin/HolidaysPage';
import ReportsPage from './pages/admin/ReportsPage';
import CaregiverDashboard from './pages/caregiver/CaregiverDashboard';
import RegisterTime from './pages/caregiver/RegisterTime';
import MyTimeEntries from './pages/caregiver/MyTimeEntries';
import DemoRoleScreen from './components/DemoRoleScreen';
import { NoAccessScreen, NoRolesScreen } from './components/AccessScreens';
import { approversApi, caregiversApi, meApi } from './utils/api';
import { hasPermission } from './utils/permissions';
import { ALL_ROLE_KEYS, loadDemoRoles, saveDemoRoles, viewsForRoles } from './utils/demoRoles';

function roleFromPath(pathname) {
    if (pathname.startsWith('/barnepige')) return 'caregiver';
    if (pathname.startsWith('/administrator') || pathname.startsWith('/admin')) return 'administrator';
    return 'approver';
}

const HOME_PATHS = {
    approver: '/godkender/overblik',
    administrator: '/administrator/overblik',
    caregiver: '/barnepige'
};

export default function App() {
    const location = useLocation();
    const [userRole, setUserRole] = useState(() => roleFromPath(location.pathname));
    const [approvers, setApprovers] = useState([]);
    const [approverId, setApproverId] = useState(() => Number(localStorage.getItem('demoApproverId')) || null);
    // me: undefined = henter, null = kunne ikke hentes, ellers portal-identiteten
    const [me, setMe] = useState(undefined);
    const [demoRoles, setDemoRoles] = useState(() => loadDemoRoles());
    const [rolePickerOpen, setRolePickerOpen] = useState(false);
    // Barnepige-visningen agerer som en valgt demo-barnepige (indtil den rigtige
    // kobling mellem login og barnepige-stamdata findes).
    const [caregivers, setCaregivers] = useState([]);
    const [selectedCaregiverId, setSelectedCaregiverId] = useState(() => Number(localStorage.getItem('demoCaregiverId')) || null);

    async function loadApprovers() {
        const data = await approversApi.getAll();
        setApprovers(data);
    }

    useEffect(() => { loadApprovers().catch(console.error); }, []);
    useEffect(() => { meApi.get().then(setMe).catch(() => setMe(null)); }, []);
    useEffect(() => { caregiversApi.getAll().then(setCaregivers).catch(console.error); }, []);

    const caregiver = caregivers.find(item => item.id === selectedCaregiverId) || caregivers[0] || null;
    const caregiverId = caregiver?.id ?? 1;

    function changeCaregiver(id) {
        setSelectedCaregiverId(Number(id));
        localStorage.setItem('demoCaregiverId', String(id));
    }

    useEffect(() => {
        const routeRole = roleFromPath(location.pathname);
        if (routeRole !== userRole) setUserRole(routeRole);
    }, [location.pathname, userRole]);

    useEffect(() => {
        if (userRole === 'caregiver' || approvers.length === 0) return;
        const profileRole = userRole === 'administrator' ? 'administrator' : 'approver';
        const storageKey = userRole === 'administrator' ? 'demoAdministratorId' : 'demoGodkenderId';
        const savedId = Number(localStorage.getItem(storageKey));
        const selected = approvers.find(item => item.role === profileRole && item.id === savedId)
            || approvers.find(item => item.role === profileRole);
        if (selected && selected.id !== approverId) setApproverId(selected.id);
        if (selected) localStorage.setItem('demoApproverId', String(selected.id));
    }, [approvers, approverId, userRole]);

    function changeApprover(id) {
        setApproverId(Number(id));
        localStorage.setItem('demoApproverId', String(id));
        localStorage.setItem(userRole === 'administrator' ? 'demoAdministratorId' : 'demoGodkenderId', String(id));
    }

    const profileRole = userRole === 'administrator' ? 'administrator' : 'approver';
    const visibleApprovers = approvers.filter(item => item.role === profileRole);
    const approver = visibleApprovers.find(item => item.id === approverId) || visibleApprovers[0] || null;
    const can = permission => hasPermission(approver, permission);
    const guarded = (permission, component) => (
        <PermissionRoute allowed={can(permission)}>{component}</PermissionRoute>
    );

    // Demo-roller: indtil de rigtige AD/Entra-grupper findes, styrer valget på
    // demo-rolleskærmen hvilke visninger appen tilbyder.
    const roleKeys = demoRoles || [];
    const availableViews = viewsForRoles(roleKeys);

    if (rolePickerOpen || demoRoles === null) {
        return (
            <DemoRoleScreen
                me={me}
                initialRoles={demoRoles ?? ALL_ROLE_KEYS}
                onContinue={roles => {
                    saveDemoRoles(roles);
                    setDemoRoles(roles);
                    setRolePickerOpen(false);
                }}
            />
        );
    }
    if (!roleKeys.includes('access')) {
        return <NoAccessScreen onOpenRolePicker={() => setRolePickerOpen(true)} />;
    }
    if (availableViews.length === 0) {
        return <NoRolesScreen onOpenRolePicker={() => setRolePickerOpen(true)} />;
    }
    if (!availableViews.includes(roleFromPath(location.pathname))) {
        return <Navigate to={HOME_PATHS[availableViews[0]]} replace />;
    }

    return (
        <Layout
            userRole={userRole}
            onRoleChange={setUserRole}
            approvers={visibleApprovers}
            approver={approver}
            onApproverChange={changeApprover}
            availableRoles={availableViews}
            me={me}
            onOpenRolePicker={() => setRolePickerOpen(true)}
            caregivers={caregivers}
            caregiver={caregiver}
            onCaregiverChange={changeCaregiver}
        >
            <Routes>
                <Route path="/" element={<Navigate to={HOME_PATHS[userRole]} replace />} />

                <Route path="/godkender" element={<Navigate to="/godkender/overblik" replace />} />
                <Route path="/godkender/overblik" element={<AdminDashboard permissions={approver?.permissions || []} basePath="/godkender" roleLabel="Godkender" />} />
                <Route path="/godkender/godkendelse" element={<ApprovalPage approver={approver} permissions={approver?.permissions || []} roleLabel="Godkender" />} />
                <Route path="/godkender/rapporter" element={guarded('export_reports', <ReportsPage approver={approver} roleLabel="Godkender" />)} />
                <Route path="/godkender/boern" element={guarded('manage_grants', <ChildrenPage approver={approver} roleLabel="Godkender" canManageGrants canManageRecords={can('manage_children')} />)} />
                <Route path="/godkender/barnepiger" element={guarded('manage_caregivers', <CaregiversPage />)} />
                <Route path="/godkender/helligdage" element={guarded('manage_holidays', <HolidaysPage />)} />
                <Route path="/godkender/rettigheder" element={guarded('manage_permissions', <ApproversPage onProfilesChanged={loadApprovers} />)} />

                <Route path="/administrator" element={<Navigate to="/administrator/overblik" replace />} />
                <Route path="/administrator/overblik" element={<AdminDashboard permissions={approver?.permissions || []} basePath="/administrator" roleLabel="Administrator" />} />
                <Route path="/administrator/godkendelse" element={<ApprovalPage approver={approver} permissions={approver?.permissions || []} roleLabel="Administrator" />} />
                <Route path="/administrator/rapporter" element={guarded('export_reports', <ReportsPage approver={approver} roleLabel="Administrator" />)} />
                <Route path="/administrator/boern" element={guarded('manage_grants', <ChildrenPage approver={approver} roleLabel="Administrator" canManageGrants canManageRecords />)} />
                <Route path="/administrator/barnepiger" element={guarded('manage_caregivers', <CaregiversPage />)} />
                <Route path="/administrator/helligdage" element={guarded('manage_holidays', <HolidaysPage />)} />
                <Route path="/administrator/rettigheder" element={guarded('manage_permissions', <ApproversPage onProfilesChanged={loadApprovers} />)} />

                <Route path="/barnepige" element={<CaregiverDashboard caregiverId={caregiverId} userName={me?.name} />} />
                <Route path="/barnepige/registrer" element={<RegisterTime caregiverId={caregiverId} />} />
                <Route path="/barnepige/mine-timer" element={<MyTimeEntries caregiverId={caregiverId} />} />

                <Route path="/admin" element={<Navigate to="/administrator/overblik" replace />} />
                <Route path="/admin/godkendelse" element={<Navigate to="/administrator/godkendelse" replace />} />
                <Route path="/admin/boern" element={<Navigate to="/administrator/boern" replace />} />
                <Route path="/admin/barnepiger" element={<Navigate to="/administrator/barnepiger" replace />} />
                <Route path="/admin/helligdage" element={<Navigate to="/administrator/helligdage" replace />} />

                <Route path="*" element={<Navigate to={HOME_PATHS[userRole]} replace />} />
            </Routes>
        </Layout>
    );
}
