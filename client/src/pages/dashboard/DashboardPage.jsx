import { lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { UniversalAIPanel } from '../../components/dashboard/widgets/UniversalAIPanel';

const SalesExecutiveDashboard = lazy(() => import('./roles/SalesExecutiveDashboard'));
const CEODashboard = lazy(() => import('./roles/CEODashboard'));
const OperationsDashboard = lazy(() => import('./roles/OperationsDashboard'));
const AdminDashboard = lazy(() => import('./roles/AdminDashboard'));
export default function DashboardPage() {
  const { user } = useAuth();
  const { tab } = useParams();

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().replace(/[\s_-]+/g, '');
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isAdmin = 
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName.includes('admin') ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  const checkPermission = (perm) => {
    if (isAdmin) return true;
    if (perms.includes('*') || perms.includes('*:*')) return true;
    const [mod] = perm.split(':');
    return perms.includes(perm) || perms.includes(`${mod}:*`);
  };

  const renderDashboard = () => {
    switch (tab) {
      case 'sales':
        if (!checkPermission('dashboards:view_sales_dashboard') && !isAdmin) {
          if (checkPermission('dashboards:view_project_dashboard')) return <OperationsDashboard />;
          if (checkPermission('dashboards:view_management_dashboard')) return <CEODashboard />;
          return <SalesExecutiveDashboard />;
        }
        return <SalesExecutiveDashboard />;
      case 'project':
        if (!checkPermission('dashboards:view_project_dashboard') && !isAdmin) {
          return <OperationsDashboard />;
        }
        return <OperationsDashboard />;
      case 'finance':
        return <div className="p-8"><h2>Finance Dashboard</h2><p>Coming Soon</p></div>;
      case 'factory':
        return <div className="p-8"><h2>Factory Dashboard</h2><p>Coming Soon</p></div>;
      case 'warehouse':
        return <div className="p-8"><h2>Warehouse Dashboard</h2><p>Coming Soon</p></div>;
      case 'management':
        return <CEODashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      {renderDashboard()}
      <UniversalAIPanel />
    </Suspense>
  );
}
