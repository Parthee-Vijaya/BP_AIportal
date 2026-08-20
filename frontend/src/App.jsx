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
import { approversApi } from './utils/api';
import { hasPermission } from './utils/permissions';

function roleFromPath(pathname) {
    return pathname.startsWith('/barnepige') ? 'caregiver' : 'approver';
}

const HOME_PATHS = {
    approver: '/godkender/overblik',
    caregiver: '/barnepige'
};

export default function App() {
    const location = useLocation();
    const [userRole, setUserRole] = useState(() => roleFromPath(location.pathname));
    const [approvers, setApprovers] = useState([]);
    const [approverId, setApproverId] = useState(() => Number(localStorage.getItem('demoApproverId')) || null);
    const caregiverId = 1;

    async function loadApprovers() {
        const data = await approversApi.getAll();
        setApprovers(data);
        const selected = data.find(item => item.id === approverId)
            || data.find(item => item.permissions.includes('manage_permissions'))
            || data[0];
        if (selected) {
            setApproverId(selected.id);
            localStorage.setItem('demoApproverId', String(selected.id));
        }
    }

    useEffect(() => { loadApprovers().catch(console.error); }, []);

    useEffect(() => {
        const routeRole = roleFromPath(location.pathname);
        if (routeRole !== userRole) setUserRole(routeRole);
    }, [location.pathname, userRole]);

    function changeApprover(id) {
        setApproverId(Number(id));
        localStorage.setItem('demoApproverId', String(id));
    }

    const approver = approvers.find(item => item.id === approverId) || null;
    const can = permission => hasPermission(approver, permission);
    const guarded = (permission, component) => (
        <PermissionRoute allowed={can(permission)}>{component}</PermissionRoute>
    );

    return (
        <Layout
            userRole={userRole}
            onRoleChange={setUserRole}
            approvers={approvers}
            approver={approver}
            onApproverChange={changeApprover}
        >
            <Routes>
                <Route path="/" element={<Navigate to={HOME_PATHS[userRole]} replace />} />

                <Route path="/godkender" element={<Navigate to="/godkender/overblik" replace />} />
                <Route path="/godkender/overblik" element={<AdminDashboard permissions={approver?.permissions || []} />} />
                <Route path="/godkender/godkendelse" element={<ApprovalPage approver={approver} permissions={approver?.permissions || []} />} />
                <Route path="/godkender/rapporter" element={guarded('export_reports', <ReportsPage approver={approver} />)} />
                <Route path="/godkender/boern" element={guarded('manage_children', <ChildrenPage approver={approver} />)} />
                <Route path="/godkender/barnepiger" element={guarded('manage_caregivers', <CaregiversPage />)} />
                <Route path="/godkender/helligdage" element={guarded('manage_holidays', <HolidaysPage />)} />
                <Route path="/godkender/rettigheder" element={guarded('manage_permissions', <ApproversPage onProfilesChanged={loadApprovers} />)} />

                <Route path="/barnepige" element={<CaregiverDashboard caregiverId={caregiverId} />} />
                <Route path="/barnepige/registrer" element={<RegisterTime caregiverId={caregiverId} />} />
                <Route path="/barnepige/mine-timer" element={<MyTimeEntries caregiverId={caregiverId} />} />

                <Route path="/admin" element={<Navigate to="/godkender/overblik" replace />} />
                <Route path="/admin/godkendelse" element={<Navigate to="/godkender/godkendelse" replace />} />
                <Route path="/admin/boern" element={<Navigate to="/godkender/boern" replace />} />
                <Route path="/admin/barnepiger" element={<Navigate to="/godkender/barnepiger" replace />} />
                <Route path="/admin/helligdage" element={<Navigate to="/godkender/helligdage" replace />} />

                <Route path="*" element={<Navigate to={HOME_PATHS[userRole]} replace />} />
            </Routes>
        </Layout>
    );
}
