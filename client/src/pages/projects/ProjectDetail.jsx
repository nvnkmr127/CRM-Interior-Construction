import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge } from '../../components/ui';
import styles from './ProjectDetail.module.css';
import { getProject, deleteProject, updateProject, archiveProject } from '../../api/projects';
import ProjectForm from '../../components/projects/ProjectForm';
import ReopenProjectModal from '../../components/projects/ReopenProjectModal';

// Lazy load tabs
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const GanttChart = React.lazy(() => import('../../components/projects/GanttChart'));
const TaskKanban = React.lazy(() => import('../../components/tasks/TaskKanban'));
const DocumentPanel = React.lazy(() => import('../../components/projects/DocumentPanel'));
const DrawingRegisterTab = React.lazy(() => import('../../components/projects/DrawingRegisterTab'));
const PaymentsTab = React.lazy(() => import('./PaymentsTab'));
const SnagsDashboard = React.lazy(() => import('./SnagsDashboard'));
const HandoverChecklist = React.lazy(() => import('./HandoverChecklist'));
const WarrantiesTab = React.lazy(() => import('./WarrantiesTab'));
const AmcsTab = React.lazy(() => import('./AmcsTab'));
const ProjectClosureTab = React.lazy(() => import('./ProjectClosureTab'));
const ProjectRetrospectiveTab = React.lazy(() => import('./ProjectRetrospectiveTab'));

const DesignRequirements = React.lazy(() => import('../../components/projects/DesignRequirements'));
const DesignAssetsTab = React.lazy(() => import('../../components/projects/DesignAssetsTab'));
const DesignReviewsTab = React.lazy(() => import('../../components/projects/DesignReviewsTab'));
const MaterialPalettesTab = React.lazy(() => import('../../components/projects/MaterialPalettesTab'));
const ChangeOrdersTab = React.lazy(() => import('../../components/projects/ChangeOrdersTab'));
const BOQVarianceTab = React.lazy(() => import('../../components/projects/BOQVarianceTab'));
const ProjectQuotationsTab = React.lazy(() => import('../../components/projects/ProjectQuotationsTab'));
const BudgetTab = React.lazy(() => import('../../components/projects/BudgetTab'));
const PurchaseOrdersTab = React.lazy(() => import('../../components/projects/PurchaseOrdersTab'));
const MaterialDeliveriesTab = React.lazy(() => import('../../components/projects/MaterialDeliveriesTab'));
const VendorPaymentsTab = React.lazy(() => import('../../components/projects/VendorPaymentsTab'));
const MaterialSubstitutionsTab = React.lazy(() => import('../../components/projects/MaterialSubstitutionsTab'));
const FactoryProductionTab = React.lazy(() => import('../../components/projects/FactoryProductionTab'));
const WorkActivitiesTab = React.lazy(() => import('../../components/projects/WorkActivitiesTab'));
const DailySiteReportsTab = React.lazy(() => import('../../components/projects/DailySiteReportsTab'));
const WeeklyReportsTab = React.lazy(() => import('../../components/projects/WeeklyReportsTab'));
const RoomProgressTab = React.lazy(() => import('../../components/projects/RoomProgressTab'));
const HandoverHistoryTab = React.lazy(() => import('../../components/projects/HandoverHistoryTab'));
const MeetingNotesTab = React.lazy(() => import('../../components/projects/MeetingNotesTab'));
const SiteVisitsTab = React.lazy(() => import('../../components/projects/SiteVisitsTab'));
const DelayNotificationsTab = React.lazy(() => import('../../components/projects/DelayNotificationsTab'));
const PunchListTab = React.lazy(() => import('../../components/projects/PunchListTab'));
import HandoverModal from '../../components/projects/HandoverModal';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatValue(val) {
  if (!val) return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return val;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function daysRemaining(targetDate) {
  if (!targetDate) return null;
  const diff = Math.ceil((new Date(targetDate) - Date.now()) / 86400000);
  return diff;
}

function OverviewTab({ project, onRefresh }) {
  const days = daysRemaining(project.target_date);
  const [handoverState, setHandoverState] = useState({
    isOpen: false,
    role: 'pm',
    currentResourceId: '',
    currentResourceName: ''
  });

  // custom_fields may hold advance_amount, payment_terms, etc from conversion form
  const cf = project.custom_fields || {};

  const fields = [
    { label: 'Project Type',    value: project.project_type ? project.project_type.replace(/_/g, ' ') : '—' },
    { label: 'Site Address',    value: project.site_address || '—' },
    { label: 'Flat / Unit No',  value: project.flat_number || '—' },
    { label: 'Floor',           value: project.floor || '—' },
    { label: 'Building Name',   value: project.building_name || '—' },
    { label: 'Street',          value: project.street || '—' },
    { label: 'Landmark',        value: project.landmark || '—' },
    { label: 'City',            value: project.city || '—' },
    { label: 'Pincode',         value: project.pincode || '—' },
    { label: 'GPS Coordinates', value: project.latitude && project.longitude ? `${project.latitude}, ${project.longitude}` : '—' },
    { label: 'Builder Name',    value: project.builder_name || '—' },
    { label: 'Society Name',    value: project.society_name || '—' },
    { label: 'RERA ID',         value: project.rera_id || '—' },
    { label: 'Builder NOC',     value: project.noc_status ? project.noc_status.replace(/_/g, ' ') : '—' },
    { label: 'Occupancy Cert.', value: project.occupancy_certificate_status ? project.occupancy_certificate_status.replace(/_/g, ' ') : '—' },
    { label: 'Property Handover Date', value: formatDate(project.property_handover_date) },
    { label: 'Carpet Area',     value: project.carpet_area ? `${project.carpet_area} sq ft` : '—' },
    { label: 'Built-up Area',   value: project.built_up_area ? `${project.built_up_area} sq ft` : '—' },
    { label: 'Number of Rooms', value: project.number_of_rooms || '—' },
    { label: 'Project Category', value: project.project_category ? project.project_category.replace(/_/g, ' ') : '—' },
    { label: 'Sub-Category',    value: project.project_sub_category ? project.project_sub_category.replace(/_/g, ' ') : '—' },
    { label: 'Ownership Type',  value: project.property_type ? project.property_type.replace(/_/g, ' ') : '—' },
    { label: 'Property Age',    value: project.property_age ? project.property_age.replace(/_/g, ' ') : '—' },
    { label: 'Renovation Scope', value: project.renovation_scope ? project.renovation_scope.replace(/_/g, ' ') : '—' },
    { label: 'Market Segment',  value: project.segment ? project.segment.replace(/_/g, ' ') : '—' },
    { label: 'Start Date',      value: formatDate(project.start_date) },
    { label: 'Target Date',     value: formatDate(project.target_date) },
    { label: 'Base Contract Value (Original Scope)', value: formatValue(project.stats?.originalScopeTotal || project.contract_value) },
    { label: 'Scope Additions (Change Orders)', value: formatValue(project.stats?.additionsTotal || 0) },
    { label: 'Scope Reductions (Change Orders)', value: formatValue(project.stats?.reductionsTotal || 0) },
    { label: 'Net Contract Value', value: formatValue(project.stats?.netContractValue || project.contract_value) },
    { label: 'Status',          value: project.status ? project.status.replace(/_/g, ' ') : '—' },
    { label: 'Client Phone',    value: project.client_phone || '—' },
    { label: 'Client Email',    value: project.client_email || '—' },
    { label: 'Booking Amount',  value: project.booking_amount ? formatValue(project.booking_amount) : (cf.advance_amount ? formatValue(cf.advance_amount) : '—') },
    { label: 'Payment Terms',   value: project.payment_terms ? project.payment_terms.replace(/_/g, ' – ') : (cf.payment_terms ? cf.payment_terms.replace(/_/g, ' – ') : '—') },
    { label: 'Agreement Signed By', value: project.agreement_signed_by || '—' },
    { label: 'Agreement Signed Date', value: formatDate(project.agreement_signed_at) },
    { label: 'Signature Method', value: project.agreement_signature_method ? project.agreement_signature_method.replace(/_/g, ' ') : '—' },
    { label: 'Allowed Design Revisions', value: project.allowed_design_revisions !== undefined && project.allowed_design_revisions !== null ? project.allowed_design_revisions : 3 },
    { label: 'Current Design Revisions', value: project.current_design_revisions !== undefined && project.current_design_revisions !== null ? project.current_design_revisions : 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Timeline summary */}
      {days !== null && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: days < 0 ? 'var(--color-danger-bg)' : days <= 14 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
          color: days < 0 ? 'var(--color-danger)' : days <= 14 ? 'var(--color-warning)' : 'var(--color-success)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
        }}>
          {days < 0
            ? `Project is overdue by ${Math.abs(days)} days`
            : days === 0
            ? 'Due today'
            : `${days} days remaining until target date`}
        </div>
      )}

      {/* Key details grid */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Project Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: i < fields.length - 2 ? '1px solid var(--color-border)' : 'none',
              borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', textTransform: 'capitalize' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Team
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {[
            { role: 'Project Manager', name: project.pm_name, key: 'pm', id: project.pm_id },
            { role: 'Designer', name: project.designer_name, key: 'designer', id: project.designer_id },
            ...(project.site_team || []).map(member => ({
              role: `${member.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${member.vendor_name ? `(${member.vendor_name})` : ''}`,
              name: member.name,
              isSiteTeam: true
            }))
          ].filter(m => m.name).map((member, idx, arr) => (
            <div key={`${member.role}-${idx}`} style={{ 
              padding: '14px 20px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              flex: '1 1 220px', 
              borderRight: idx === arr.length - 1 ? 'none' : '1px solid var(--color-border)',
              borderBottom: '1px solid var(--color-border)'
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: member.isSiteTeam ? 'var(--color-success, #22c55e)' : 'var(--color-accent, #3b82f6)', 
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0,
              }}>
                {(member.name || '?').charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {member.name}
                  {member.key && (
                    <button
                      onClick={() => setHandoverState({
                        isOpen: true,
                        role: member.key,
                        currentResourceId: member.id,
                        currentResourceName: member.name
                      })}
                      style={{
                        background: 'var(--color-accent-bg, #eff6ff)',
                        border: 'none',
                        color: 'var(--color-accent, #3b82f6)',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                      title={`Replace ${member.role}`}
                    >
                      Replace
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{member.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Conversion Checklist — only shown for converted leads */}
      {project.lead_id && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Pre-Conversion Checklist
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {[
              { key: 'booking_received',      label: 'Booking amount received' },
              { key: 'floor_plan',            label: 'Floor plan attached' },
              { key: 'scope_finalized',       label: 'Scope finalized' },
              { key: 'contract_signed',       label: 'Signed contract attached' },
              { key: 'site_address_confirmed',label: 'Site address confirmed' },
            ].map((item, i) => {
              const checked = cf[item.key] === true || cf[item.key] === 'true';
              return (
                <div key={item.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none',
                  borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: checked ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    color: checked ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {checked ? '✓' : '✗'}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: checked ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stakeholders & Contacts */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Project Stakeholders & Contacts
        </div>
        {project.contacts && project.contacts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {project.contacts.map((contact, i) => (
              <div key={contact.id || i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < project.contacts.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-accent-bg, #eff6ff)', color: 'var(--color-accent, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 'var(--text-xs)',
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{contact.name}</span>
                      <span style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        background: 'var(--color-accent-bg, #eff6ff)',
                        color: 'var(--color-accent, #3b82f6)',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {contact.role ? contact.role.replace(/_/g, ' ') : 'Stakeholder'}
                      </span>
                      <span style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        background: 'var(--color-success-bg, #f0fdf4)',
                        color: 'var(--color-success, #22c55e)',
                        fontWeight: 600
                      }}>
                        {contact.decision_authority || 'Influencer'}
                      </span>
                    </div>
                    {contact.relationship_notes && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        📝 {contact.relationship_notes}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {contact.phone && <div>📞 {contact.phone}</div>}
                  {contact.email && <div>✉️ {contact.email}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No additional stakeholders recorded for this project. Click "Edit" to add contacts.
          </div>
        )}
      </div>

      {/* Site Measurements & Room Dimensions */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Site Measurements & Room Dimensions
        </div>
        {project.measurements && project.measurements.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-hover, #f8fafc)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Room Name</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Dimensions (L x W x H)</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Computed Area</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {project.measurements.map((room, i) => (
                  <tr key={room.id || i} style={{ borderBottom: i < project.measurements.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--color-text)' }}>{room.room_name}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)' }}>
                      {room.length} x {room.width} x {room.height} <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{room.unit}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {room.area} <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 400 }}>sq {room.unit}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{room.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No room-wise site measurements recorded for this project.
          </div>
        )}
      </div>

      {/* Project Vendors */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Project Vendors Engagement
        </div>
        {project.vendors && project.vendors.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-hover, #f8fafc)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Vendor Name</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Scope of Work</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Agreed Rate/Value</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Payment Terms</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {project.vendors.map((vendor, i) => (
                  <tr key={vendor.id || i} style={{ borderBottom: i < project.vendors.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--color-text)' }}>{vendor.vendor_name}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)' }}>{vendor.scope_of_work || '—'}</td>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--color-text)' }}>
                      ₹{Number(vendor.agreed_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)' }}>{vendor.payment_terms || '—'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        background: vendor.status === 'active' ? 'var(--color-success-bg, #f0fdf4)' : (vendor.status === 'completed' ? 'var(--color-accent-bg, #eff6ff)' : 'var(--color-warning-bg, #fef3c7)'),
                        color: vendor.status === 'active' ? 'var(--color-success, #22c55e)' : (vendor.status === 'completed' ? 'var(--color-accent, #3b82f6)' : 'var(--color-warning, #d97706)')
                      }}>
                        {vendor.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No vendors engaged for this project. Click "Edit" to add vendor commitments.
          </div>
        )}
      </div>

      {/* External Consultants Assigned */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          External Consultants Assigned
        </div>
        {project.consultants && project.consultants.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {project.consultants.map((consultant, i) => (
              <div key={consultant.id || i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < project.consultants.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-warning-bg, #fffbeb)', color: 'var(--color-warning, #d97706)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 'var(--text-xs)',
                  }}>
                    📐
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{consultant.name}</span>
                      <span style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        background: 'var(--color-accent-bg, #eff6ff)',
                        color: 'var(--color-accent, #3b82f6)',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {consultant.role ? consultant.role.replace(/_/g, ' ') : 'Consultant'}
                      </span>
                      {consultant.firm && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Firm: {consultant.firm}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {consultant.phone && <div>📞 {consultant.phone}</div>}
                  {consultant.email && <div>✉️ {consultant.email}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No external consultants assigned to this project. Click "Edit" to assign consultants.
          </div>
        )}
      </div>

      {/* Notes */}
      {project.notes && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Notes</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{project.notes}</div>
        </div>
      )}

      {project && (
        <HandoverModal
          projectId={project.id}
          role={handoverState.role}
          currentResourceId={handoverState.currentResourceId}
          currentResourceName={handoverState.currentResourceName}
          isOpen={handoverState.isOpen}
          onClose={() => setHandoverState(prev => ({ ...prev, isOpen: false }))}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}


export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    if (window.confirm('Are you sure you want to formally archive this project? The data will remain accessible for reference.')) {
      try {
        setArchiving(true);
        await archiveProject(projectId);
        reloadProject();
      } catch (e) {
        console.error('Failed to archive project', e);
        alert('Failed to archive project.');
      } finally {
        setArchiving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        navigate('/projects');
      } catch (e) {
        console.error('Failed to delete project', e);
      }
    }
  };

  const handleLockScope = async () => {
    if (window.confirm('Are you sure you want to lock the design scope? Once locked, execution can proceed.')) {
      try {
        await updateProject(projectId, { is_scope_locked: true });
        setProject(prev => ({ ...prev, is_scope_locked: true }));
      } catch (e) {
        console.error('Failed to lock scope', e);
        alert('Failed to lock scope. Please ensure all conditions are met.');
      }
    }
  };

  const tabs = ['Overview', 'Meeting Notes', 'Site Visits', 'Delay Notifications', 'Handovers', 'Design Brief', 'Design Assets', 'Design Reviews', 'Material Palettes', 'Quotations & BOQ', 'Change Orders', 'BOQ Variance', 'Budget', 'Purchase Orders', 'Material Deliveries', 'Vendor Payments', 'Substitutions', 'Factory Production', 'Phases', 'Gantt Chart', 'Work Activities', 'Room Progress', 'Tasks', 'Daily Site Reports', 'Weekly Reports', 'Documents', 'Drawing Register', 'Payments', 'Snags', 'Punch List', 'Handover', 'Warranties', 'AMCs', 'Project Closure', 'Retrospective'];

  const reloadProject = () => {
    if (!projectId) return;
    getProject(projectId)
      .then(res => setProject(res.data?.data || res.data || null))
      .catch(() => setProject(null));
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProject(projectId)
      .then(res => setProject(res.data?.data || res.data || null))
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview': return project ? <OverviewTab project={project} onRefresh={reloadProject} /> : null;
      case 'Meeting Notes': return <MeetingNotesTab projectId={projectId} />;
      case 'Site Visits': return <SiteVisitsTab projectId={projectId} />;
      case 'Delay Notifications': return <DelayNotificationsTab projectId={projectId} />;
      case 'Handovers': return <HandoverHistoryTab projectId={projectId} />;
      case 'Design Brief': return <DesignRequirements projectId={projectId} />;
      case 'Design Assets': return <DesignAssetsTab projectId={projectId} />;
      case 'Design Reviews': return <DesignReviewsTab projectId={projectId} />;
      case 'Material Palettes': return <MaterialPalettesTab projectId={projectId} />;
      case 'Quotations & BOQ': return <ProjectQuotationsTab projectId={projectId} />;
      case 'Change Orders': return <ChangeOrdersTab projectId={projectId} />;
      case 'BOQ Variance': return <BOQVarianceTab projectId={projectId} />;
      case 'Budget': return <BudgetTab projectId={projectId} />;
      case 'Purchase Orders': return <PurchaseOrdersTab projectId={projectId} />;
      case 'Material Deliveries': return <MaterialDeliveriesTab projectId={projectId} />;
      case 'Vendor Payments': return <VendorPaymentsTab projectId={projectId} />;
      case 'Substitutions': return <MaterialSubstitutionsTab projectId={projectId} />;
      case 'Factory Production': return <FactoryProductionTab projectId={projectId} />;
      case 'Phases': return <PhaseTimeline projectId={projectId} />;
      case 'Gantt Chart': return <GanttChart projectId={projectId} project={project} />;
      case 'Work Activities': return <WorkActivitiesTab projectId={projectId} project={project} />;
      case 'Room Progress': return <RoomProgressTab projectId={projectId} />;
      case 'Tasks': return <TaskKanban projectId={projectId} />;
      case 'Daily Site Reports': return <DailySiteReportsTab projectId={projectId} />;
      case 'Weekly Reports': return <WeeklyReportsTab projectId={projectId} />;
      case 'Documents': return <DocumentPanel projectId={projectId} />;
      case 'Drawing Register': return <DrawingRegisterTab projectId={projectId} />;
      case 'Payments': return <PaymentsTab projectId={projectId} />;
      case 'Snags': return <SnagsDashboard projectId={projectId} />;
      case 'Handover': return <HandoverChecklist projectId={projectId} />;
      case 'Punch List': return <PunchListTab projectId={projectId} />;
      case 'Warranties': return <WarrantiesTab projectId={projectId} />;
      case 'AMCs': return <AmcsTab projectId={projectId} />;
      case 'Project Closure': return <ProjectClosureTab projectId={projectId} projectStatus={project.status} onProjectUpdated={reloadProject} />;
      case 'Retrospective': return <ProjectRetrospectiveTab projectId={projectId} projectStatus={project.status} />;
      default: return <div>{activeTab} Content (Coming Soon)</div>;
    }
  };

  const days = project ? daysRemaining(project.target_date) : null;

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Loading project…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-danger)' }}>
          Project not found.{' '}
          <button onClick={() => navigate('/projects')} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const taskDone  = project.stats?.completedTasks ?? 0;
  const taskTotal = project.stats?.totalTasks     ?? 0;
  const currentPhase = project.phases?.find(p => p.status !== 'completed')?.name
    || project.phases?.[project.phases.length - 1]?.name
    || '—';

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/projects">Projects</a> &gt; <span>{project.name}</span>
      </div>

      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <div className={styles.projName}>
              {project.name}{' '}
              <Badge variant={project.status === 'active' ? 'info' : project.status === 'completed' ? 'success' : 'warning'} dot>
                {project.status || 'Unknown'}
              </Badge>{' '}
              {project.is_scope_locked ? (
                <Badge variant="success">🔒 Scope Locked</Badge>
              ) : (
                <Badge variant="warning">🔓 Scope Unlocked</Badge>
              )}
            </div>
            <div className={styles.clientName}>{project.client_name || '—'}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.value}>{formatValue(project.contract_value)}</div>
            {!project.is_scope_locked && project.status === 'active' && (
              <Button size="sm" onClick={handleLockScope}>Lock Scope</Button>
            )}
            {(project.status === 'completed' || project.status === 'cancelled') && (
              <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving...' : 'Archive'}
              </Button>
            )}
            {(project.status === 'completed' || project.status === 'cancelled' || project.status === 'archived') && (
              <Button variant="primary" size="sm" onClick={() => setIsReopenModalOpen(true)}>
                Reopen Project
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            <Button variant="outline" size="sm" style={{color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}} onClick={handleDelete}>Delete</Button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          {project.pm_name && (
            <div className={styles.metaItem}>
              <div className={styles.avatar}>{project.pm_name.charAt(0)}</div> PM: {project.pm_name}
            </div>
          )}
          {project.designer_name && (
            <div className={styles.metaItem}>
              <div className={styles.avatar}>{project.designer_name.charAt(0)}</div> Designer: {project.designer_name}
            </div>
          )}
          {(project.start_date || project.target_date) && (
            <div className={styles.metaItem}>📅 {formatDate(project.start_date)} → {formatDate(project.target_date)}</div>
          )}
          {project.site_address && (
            <div className={styles.metaItem} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              📍 {project.site_address}
              {project.latitude && project.longitude && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: 'var(--color-primary-bg, #e0f2fe)',
                    color: 'var(--color-primary, #0284c7)',
                    textDecoration: 'none'
                  }}
                  title="Navigate on Google Maps"
                >
                  🗺️ Navigate
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Task Progress</span>
          <span className={styles.statValue}>
            {taskDone}/{taskTotal}
            {taskTotal > 0 && (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {' '}({Math.round((taskDone / taskTotal) * 100)}%)
              </span>
            )}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Current Phase</span>
          <span className={styles.statValue}>{currentPhase}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Days Remaining</span>
          <span className={days !== null && days < 0 ? `${styles.statValue} ${styles.statDanger}` : styles.statValue}>
            {days === null ? '—' : days < 0 ? `Overdue ${Math.abs(days)} days` : `${days} days`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Payment Collected</span>
          <span className={styles.statValue}>
            {formatValue(project.stats?.collectedPayment)}
            {' of '}
            {formatValue(project.stats?.netContractValue || project.contract_value)}
          </span>
        </div>
      </div>

      {/* Project Financial Summary Dashboard Panel */}
      <div className={styles.financialPanel}>
        <div className={styles.financialPanelHeader}>Financial Overview</div>
        <div className={styles.financialGrid}>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Contract Value (Net)</span>
            <span className={styles.financialValue}>
              {formatValue(project.stats?.netContractValue || project.contract_value)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Billed (Net)</span>
            <span className={styles.financialValue}>
              {formatValue(project.stats?.netBilled !== undefined ? project.stats.netBilled : project.stats?.totalPayment)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Collected (Net)</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-success, #22c55e)' }}>
              {formatValue(project.stats?.netCollections !== undefined ? project.stats.netCollections : project.stats?.collectedPayment)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Outstanding Balance</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-accent, #3b82f6)' }}>
              {formatValue(project.stats?.outstandingBalance !== undefined ? project.stats.outstandingBalance : (project.stats?.totalPayment - project.stats?.collectedPayment))}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Overdue Amount</span>
            <span className={`${styles.financialValue} ${project.stats?.overduePayments > 0 ? styles.financialDanger : ''}`}>
              {formatValue(project.stats?.overduePayments || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Pending Invoices</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-info, #0ea5e9)' }}>
              {formatValue(project.stats?.pendingInvoices || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Total Cost</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-danger, #ef4444)' }}>
              {formatValue(project.stats?.totalActualCost || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Gross Profit</span>
            <span className={styles.financialValue} style={{ color: (project.stats?.grossProfit || 0) >= 0 ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
              {formatValue(project.stats?.grossProfit !== undefined ? project.stats.grossProfit : (project.stats?.netContractValue || project.contract_value))}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Gross Margin</span>
            <span className={styles.financialValue} style={{ color: (project.stats?.grossMarginPct || 0) >= 20 ? 'var(--color-success, #22c55e)' : (project.stats?.grossMarginPct || 0) >= 0 ? 'var(--color-warning, #eab308)' : 'var(--color-danger, #ef4444)' }}>
              {project.stats?.grossMarginPct !== undefined ? `${project.stats.grossMarginPct}%` : '100%'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>}>
          {renderTabContent()}
        </Suspense>
      </div>

      {isEditing && (
        <ProjectForm 
          project={project} 
          onClose={() => setIsEditing(false)} 
          onSave={(updatedProject) => {
            setProject({...project, ...updatedProject});
            setIsEditing(false);
          }} 
        />
      )}

      {isReopenModalOpen && (
        <ReopenProjectModal
          projectId={project.id}
          currentStartDate={project.start_date}
          currentTargetDate={project.target_date}
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}
    </div>
  );
}
