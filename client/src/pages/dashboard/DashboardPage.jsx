import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import SalesExecutiveDashboard from './roles/SalesExecutiveDashboard';
import CEODashboard from './roles/CEODashboard';
import OperationsDashboard from './roles/OperationsDashboard';
import AdminDashboard from './roles/AdminDashboard';
import { UniversalAIPanel } from '../../components/dashboard/widgets/UniversalAIPanel';

export default function DashboardPage() {
  const { user } = useAuth();
  const { tab } = useParams();

  const isAdmin = 
    user?.role === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'super admin' || 
    (user?.role?.permissions && user.role.permissions.includes('*'));

  const checkPermission = (perm) => {
    if (isAdmin) return true;
    if (user?.role?.permissions?.includes('*')) return true;
    const [mod] = perm.split(':');
    return user?.role?.permissions?.includes(perm) || user?.role?.permissions?.includes(`${mod}:*`);
  };

  const renderDashboard = () => {
    switch (tab) {
      case 'sales':
        if (!checkPermission('dashboards:view_sales_dashboard')) return <Navigate to="/forbidden" />;
        return <SalesExecutiveDashboard />;
      case 'project':
        if (!checkPermission('dashboards:view_project_dashboard')) return <Navigate to="/forbidden" />;
        return <OperationsDashboard />;
      case 'finance':
        if (!checkPermission('dashboards:view_finance_dashboard')) return <Navigate to="/forbidden" />;
        return <div className="p-8"><h2>Finance Dashboard</h2><p>Coming Soon</p></div>;
      case 'factory':
        if (!checkPermission('dashboards:view_factory_dashboard')) return <Navigate to="/forbidden" />;
        return <div className="p-8"><h2>Factory Dashboard</h2><p>Coming Soon</p></div>;
      case 'warehouse':
        if (!checkPermission('dashboards:view_warehouse_dashboard')) return <Navigate to="/forbidden" />;
        return <div className="p-8"><h2>Warehouse Dashboard</h2><p>Coming Soon</p></div>;
      case 'management':
        if (!checkPermission('dashboards:view_management_dashboard')) return <Navigate to="/forbidden" />;
        return <CEODashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <>
      {renderDashboard()}
      <UniversalAIPanel />
    </>
  );
}
