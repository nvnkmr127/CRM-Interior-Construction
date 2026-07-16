import { useAuth } from '../../store/authContext';
import SalesExecutiveDashboard from './roles/SalesExecutiveDashboard';
import SalesManagerDashboard from './roles/SalesManagerDashboard';
import CEODashboard from './roles/CEODashboard';
import DesignerDashboard from './roles/DesignerDashboard';
import OperationsDashboard from './roles/OperationsDashboard';
import MarketingDashboard from './roles/MarketingDashboard';
import EstimationDashboard from './roles/EstimationDashboard';
import CustomerSuccessDashboard from './roles/CustomerSuccessDashboard';
import AdminDashboard from './roles/AdminDashboard';
import { UniversalAIPanel } from '../../components/dashboard/widgets/UniversalAIPanel';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Default to Sales Executive if no role is matched
  const role = user?.role || 'sales_executive';

  const renderDashboard = () => {
    switch (role) {
      case 'sales_manager':
        return <SalesManagerDashboard />;
      case 'ceo':
      case 'founder':
        return <CEODashboard />;
      case 'designer':
        return <DesignerDashboard />;
      case 'operations':
        return <OperationsDashboard />;
      case 'marketing':
        return <MarketingDashboard />;
      case 'estimation':
        return <EstimationDashboard />;
      case 'customer_success':
        return <CustomerSuccessDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'sales_executive':
      default:
        return <SalesExecutiveDashboard />;
    }
  };

  return (
    <>
      {renderDashboard()}
      <UniversalAIPanel />
    </>
  );
}
