import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  FiKey,
  FiActivity,
  FiBook,
  FiTerminal,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiEdit3,
  FiCopy,
  FiCheck,
  FiPlay,
  FiPause,
  FiSearch,
  FiDownload,
  FiShield,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiCode,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiChevronDown,
  FiChevronRight,
  FiSend,
  FiPrinter
} from 'react-icons/fi';

import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useConfirm } from '../../store/confirmContext';
import { Modal, Button, Badge, EmptyState, Pagination, Spinner } from '../../components/ui';
import styles from './ApiIntegrationPage.module.css';

// Permission Categories & Scopes Definition
const PERMISSION_CATEGORIES = [
  {
    category: 'Leads Management',
    scopes: [
      { id: 'Leads Read', label: 'Leads Read', desc: 'Query and view all leads and pipelines' },
      { id: 'Leads Write', label: 'Leads Write', desc: 'Create, update, and manage lead records' }
    ]
  },
  {
    category: 'Customers & Contacts',
    scopes: [
      { id: 'Customers Read', label: 'Customers Read', desc: 'Read customer profiles and history' },
      { id: 'Customers Write', label: 'Customers Write', desc: 'Create and update client records' }
    ]
  },
  {
    category: 'Projects & Quotations',
    scopes: [
      { id: 'Projects Read', label: 'Projects Read', desc: 'View projects, scopes, and milestones' },
      { id: 'Projects Write', label: 'Projects Write', desc: 'Create and update project data' }
    ]
  },
  {
    category: 'Invoicing & Payments',
    scopes: [
      { id: 'Invoices Read', label: 'Invoices Read', desc: 'View generated invoices & schedules' },
      { id: 'Invoices Write', label: 'Invoices Write', desc: 'Create and edit billing items' },
      { id: 'Payments Read', label: 'Payments Read', desc: 'Read payment logs and milestones' }
    ]
  },
  {
    category: 'Tasks & Operations',
    scopes: [
      { id: 'Tasks Read', label: 'Tasks Read', desc: 'View internal project tasks and checklists' },
      { id: 'Tasks Write', label: 'Tasks Write', desc: 'Create and complete assigned tasks' }
    ]
  }
];

const ALL_AVAILABLE_SCOPES = PERMISSION_CATEGORIES.flatMap(c => c.scopes.map(s => s.id));

export default function ApiIntegrationPage() {
  const { confirm } = useConfirm();
  const toast = useToast();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('tokens'); // 'tokens' | 'logs' | 'docs' | 'tester'

  // Data states
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    last_request_at: null
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-polling state
  const [autoRefresh, setAutoRefresh] = useState('off'); // 'off' | '15s' | '30s' | '60s'

  // Search & Filter for Tokens
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenStatusFilter, setTokenStatusFilter] = useState('all');
  const [tokenPage, setTokenPage] = useState(1);
  const tokensPerPage = 8;

  // Search & Filter for Logs
  const [logSearch, setLogSearch] = useState('');
  const [logMethodFilter, setLogMethodFilter] = useState('all');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 12;

  // Modals state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });
  const [isSavingToken, setIsSavingToken] = useState(false);

  // Secret Reveal Modal
  const [secretModal, setSecretModal] = useState({ isOpen: false, secret: '', isMasked: true });
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);

  // Log Inspection Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Export Menu Dropdown
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Documentation Interactive States
  const [docLang, setDocLang] = useState('curl'); // 'curl' | 'js' | 'node' | 'python'
  const [selectedDocToken, setSelectedDocToken] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState({ 'leads-list': true, 'leads-create': false });

  // API Tester / Playground State
  const [testerToken, setTesterToken] = useState('');
  const [testerMethod, setTesterMethod] = useState('GET');
  const [testerEndpoint, setTesterEndpoint] = useState('/api/v1/leads');
  const [testerBody, setTesterBody] = useState('{\n  "name": "Sample Client Project",\n  "phone": "+1 555-0199",\n  "email": "client@example.com",\n  "budget": 25000\n}');
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerResponse, setTesterResponse] = useState(null);
  const [testerDuration, setTesterDuration] = useState(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-Refresh Polling Effect
  useEffect(() => {
    if (autoRefresh === 'off') return;
    const ms = autoRefresh === '15s' ? 15000 : autoRefresh === '30s' ? 30000 : 60000;
    const timer = setInterval(() => {
      fetchData(true);
    }, ms);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [keysRes, statsRes] = await Promise.all([
        api.get('/developer/tokens', { withCredentials: true }),
        api.get('/developer/tokens/dashboard', { withCredentials: true })
      ]);

      const tokensList = Array.isArray(keysRes.data?.data) ? keysRes.data.data : [];
      setTokens(tokensList);

      if (statsRes.data?.data) {
        if (statsRes.data.data.stats) {
          setStats(statsRes.data.data.stats);
        }
        if (Array.isArray(statsRes.data.data.recentLogs)) {
          setRecentLogs(statsRes.data.data.recentLogs);
        }
      }

      // Preselect first active token for tester and docs if available
      const firstActive = tokensList.find(t => t.status === 'active');
      if (firstActive && !testerToken) {
        setTesterToken(firstActive.id);
        setSelectedDocToken(firstActive.id);
      }
    } catch (error) {
      if (!silent) {
        toast.error('Failed to load API integration data');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Token Management Handlers
  const handleOpenTokenModal = (token = null) => {
    if (token) {
      setEditingToken(token);
      setFormData({
        name: token.name || '',
        description: token.description || '',
        permissions: Array.isArray(token.permissions) ? token.permissions : []
      });
    } else {
      setEditingToken(null);
      setFormData({
        name: '',
        description: '',
        permissions: ['Leads Read', 'Projects Read', 'Customers Read']
      });
    }
    setIsTokenModalOpen(true);
  };

  const handleToggleScope = (scopeId) => {
    setFormData(prev => {
      const exists = prev.permissions.includes(scopeId);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(p => p !== scopeId)
          : [...prev.permissions, scopeId]
      };
    });
  };

  const handleSelectAllScopes = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [...ALL_AVAILABLE_SCOPES]
    }));
  };

  const handleClearAllScopes = () => {
    setFormData(prev => ({
      ...prev,
      permissions: []
    }));
  };

  const handleSaveToken = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Token name is required');
      return;
    }

    try {
      setIsSavingToken(true);
      if (editingToken) {
        await api.put(`/developer/tokens/${editingToken.id}`, formData, { withCredentials: true });
        toast.success('API Token updated successfully');
      } else {
        const res = await api.post('/developer/tokens', formData, { withCredentials: true });
        toast.success('API Token generated successfully');
        const rawKey = res.data?.data?.rawSecret;
        if (rawKey) {
          setSecretModal({ isOpen: true, secret: rawKey, isMasked: false });
          setHasCopiedSecret(false);
        }
      }
      setIsTokenModalOpen(false);
      fetchData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save API Token');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleToggleStatus = async (token) => {
    const newStatus = token.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/developer/tokens/${token.id}`, { status: newStatus }, { withCredentials: true });
      toast.success(`Token ${newStatus === 'active' ? 'activated' : 'paused'}`);
      fetchData(true);
    } catch (error) {
      toast.error('Failed to update token status');
    }
  };

  const handleRegenerateToken = async (token) => {
    const isConfirmed = await confirm(
      `Are you sure you want to regenerate "${token.name}"? Any external application or service currently using this key will immediately be disconnected until updated.`
    );
    if (!isConfirmed) return;

    try {
      const res = await api.post(`/developer/tokens/${token.id}/regenerate`, {}, { withCredentials: true });
      toast.success('API Token secret regenerated successfully');
      const rawKey = res.data?.data?.rawSecret;
      if (rawKey) {
        setSecretModal({ isOpen: true, secret: rawKey, isMasked: false });
        setHasCopiedSecret(false);
      }
      fetchData(true);
    } catch (error) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleDeleteToken = async (token) => {
    const isConfirmed = await confirm(
      `Are you sure you want to permanently delete "${token.name}"? This action cannot be reversed.`
    );
    if (!isConfirmed) return;

    try {
      await api.delete(`/developer/tokens/${token.id}`, { withCredentials: true });
      toast.success('API Token removed');
      fetchData(true);
    } catch (error) {
      toast.error('Failed to delete API Token');
    }
  };

  const copyToClipboard = (text, label = 'Copied to clipboard') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  // Export Utilities
  const handleExportCSV = () => {
    setExportMenuOpen(false);
    const headers = ['Name', 'Description', 'Permissions', 'Status', 'Last Used', 'Created At'];
    const rows = filteredTokens.map(token => [
      token.name || 'Unnamed Key',
      token.description || '',
      (token.permissions || []).join('; '),
      token.status || 'inactive',
      token.last_used_at ? new Date(token.last_used_at).toISOString() : 'Never',
      new Date(token.created_at).toISOString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api_tokens_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('API tokens exported to CSV');
  };

  const handleExportExcel = () => {
    setExportMenuOpen(false);
    const data = filteredTokens.map(token => ({
      'Token Name': token.name || 'Unnamed Key',
      'Description': token.description || '',
      'Permissions / Scopes': (token.permissions || []).join(', '),
      'Status': token.status || 'inactive',
      'Last Used': token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never',
      'Created Date': new Date(token.created_at).toLocaleString()
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'API Tokens');
    XLSX.writeFile(workbook, `api_tokens_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('API tokens exported to Excel');
  };

  const handleExportPDF = () => {
    setExportMenuOpen(false);
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CRM API Tokens & Integration Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const headers = [['Name', 'Description', 'Permissions', 'Status', 'Last Used', 'Created']];
    const rows = filteredTokens.map(token => [
      token.name || 'Unnamed Key',
      token.description || '-',
      (token.permissions || []).join(', ') || 'None',
      token.status || 'inactive',
      token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never',
      new Date(token.created_at).toLocaleDateString()
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [232, 147, 90] }
    });

    doc.save(`api_tokens_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('API tokens report exported to PDF');
  };

  // Filtered Lists & Pagination
  const filteredTokens = useMemo(() => {
    return tokens.filter(token => {
      const matchesSearch =
        (token.name || '').toLowerCase().includes(tokenSearch.toLowerCase()) ||
        (token.description || '').toLowerCase().includes(tokenSearch.toLowerCase()) ||
        (token.permissions || []).some(p => p.toLowerCase().includes(tokenSearch.toLowerCase()));

      const matchesStatus =
        tokenStatusFilter === 'all' || token.status === tokenStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tokens, tokenSearch, tokenStatusFilter]);

  const paginatedTokens = useMemo(() => {
    const start = (tokenPage - 1) * tokensPerPage;
    return filteredTokens.slice(start, start + tokensPerPage);
  }, [filteredTokens, tokenPage]);

  const filteredLogs = useMemo(() => {
    return recentLogs.filter(log => {
      const matchesSearch =
        (log.endpoint || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.key_name || '').toLowerCase().includes(logSearch.toLowerCase());

      const matchesMethod =
        logMethodFilter === 'all' || (log.method || '').toUpperCase() === logMethodFilter.toUpperCase();

      let matchesStatus = true;
      if (logStatusFilter === '2xx') matchesStatus = log.status_code >= 200 && log.status_code < 300;
      else if (logStatusFilter === '4xx') matchesStatus = log.status_code >= 400 && log.status_code < 500;
      else if (logStatusFilter === '5xx') matchesStatus = log.status_code >= 500;

      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [recentLogs, logSearch, logMethodFilter, logStatusFilter]);

  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logsPerPage;
    return filteredLogs.slice(start, start + logsPerPage);
  }, [filteredLogs, logPage]);

  // Calculations for Stats Card
  const totalCalls = stats?.total_requests !== undefined ? Number(stats.total_requests) : 0;
  const successfulCalls = stats?.successful_requests !== undefined ? Number(stats.successful_requests) : 0;
  const failedCalls = stats?.failed_requests !== undefined ? Number(stats.failed_requests) : 0;
  const successRate = totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(1) + '%' : '100%';
  const activeKeysCount = tokens.filter(t => t.status === 'active').length;

  // Interactive API Tester Runner
  const handleExecuteApiTest = async () => {
    setTesterLoading(true);
    setTesterResponse(null);
    const startTime = performance.now();

    try {
      let parsedBody = null;
      if (['POST', 'PUT', 'PATCH'].includes(testerMethod) && testerBody.trim()) {
        try {
          parsedBody = JSON.parse(testerBody);
        } catch (err) {
          toast.error('Invalid JSON formatted in Request Body');
          setTesterLoading(false);
          return;
        }
      }

      const res = await api.request({
        url: testerEndpoint,
        method: testerMethod,
        data: parsedBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const duration = Math.round(performance.now() - startTime);
      setTesterDuration(duration);
      setTesterResponse({
        status: res.status,
        statusText: res.statusText || 'OK',
        headers: res.headers,
        data: res.data
      });
      toast.success(`Request completed in ${duration}ms`);
      fetchData(true);
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      setTesterDuration(duration);
      setTesterResponse({
        status: err.response?.status || 500,
        statusText: err.response?.statusText || 'Error',
        headers: err.response?.headers || {},
        data: err.response?.data || { error: err.message }
      });
      toast.error(`Request failed with status ${err.response?.status || 500}`);
      fetchData(true);
    } finally {
      setTesterLoading(false);
    }
  };

  const handlePreloadTemplate = (type) => {
    if (type === 'lead') {
      setTesterMethod('POST');
      setTesterEndpoint('/api/v1/leads');
      setTesterBody(JSON.stringify({
        name: 'John Doe',
        phone: '+1 415-555-2671',
        email: 'john.doe@example.com',
        source: 'Website Form',
        stage: 'New Lead',
        budget: 45000,
        notes: 'Interested in complete 3BHK interior renovation'
      }, null, 2));
    } else if (type === 'project') {
      setTesterMethod('GET');
      setTesterEndpoint('/api/v1/projects');
      setTesterBody('');
    } else if (type === 'task') {
      setTesterMethod('POST');
      setTesterEndpoint('/api/v1/tasks');
      setTesterBody(JSON.stringify({
        title: 'Complete 3D Kitchen Rendering',
        priority: 'high',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        status: 'pending'
      }, null, 2));
    }
  };

  // Code Snippet Generator
  const getBaseUrl = () => {
    return `${window.location.origin}/api/v1`;
  };

  const activeTokenObj = tokens.find(t => t.id === selectedDocToken) || tokens.find(t => t.status === 'active') || { id: 'YOUR_API_KEY' };
  const sampleTokenSecret = 'sk_live_' + (activeTokenObj.id ? activeTokenObj.id.replace(/-/g, '') : 'example_key_secret');

  const getCodeSnippet = (endpoint = '/leads', method = 'GET', body = null) => {
    const fullUrl = `${getBaseUrl()}${endpoint}`;
    if (docLang === 'curl') {
      let cmd = `curl -X ${method} "${fullUrl}" \\\n  -H "Authorization: Bearer ${sampleTokenSecret}" \\\n  -H "Content-Type: application/json"`;
      if (body) {
        cmd += ` \\\n  -d '${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}'`;
      }
      return cmd;
    }

    if (docLang === 'js') {
      return `const response = await fetch("${fullUrl}", {\n  method: "${method}",\n  headers: {\n    "Authorization": "Bearer ${sampleTokenSecret}",\n    "Content-Type": "application/json"\n  }${body ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 4).replace(/\n/g, '\n  ')})` : ''}\n});\nconst result = await response.json();\nconsole.log(result);`;
    }

    if (docLang === 'node') {
      return `const axios = require('axios');\n\nconst response = await axios({\n  method: '${method.toLowerCase()}',\n  url: '${fullUrl}',\n  headers: {\n    'Authorization': 'Bearer ${sampleTokenSecret}',\n    'Content-Type': 'application/json'\n  }${body ? `,\n  data: ${JSON.stringify(body, null, 4).replace(/\n/g, '\n  ')}` : ''}\n});\n\nconsole.log(response.data);`;
    }

    if (docLang === 'python') {
      return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Authorization": "Bearer ${sampleTokenSecret}",\n    "Content-Type": "application/json"\n}\n${body ? `payload = ${JSON.stringify(body, null, 4).replace(/true/g, 'True').replace(/false/g, 'False')}\n\nresponse = requests.${method.toLowerCase()}(url, json=payload, headers=headers)` : `response = requests.${method.toLowerCase()}(url, headers=headers)`}\nprint(response.json())`;
    }

    return '';
  };

  if (isLoading && tokens.length === 0) {
    return (
      <div className={styles.pageContainer}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '16px' }}>
          <Spinner size="lg" />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Loading API Platform & Credentials...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* ─── Header Section ─────────────────────────────────── */}
      <div className={styles.headerWrapper}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.breadcrumb}>
            <span>Developer Suite</span>
            <span>/</span>
            <span className={styles.breadcrumbCurrent}>API & Integrations</span>
          </div>
          <h1 className={styles.title}>API & Developer Platform</h1>
          <p className={styles.subtitle}>
            Manage secure API credentials, monitor live traffic logs, test REST endpoints, and explore developer documentation.
          </p>
        </div>

        <div className={styles.headerActions}>
          {/* Polling Selector */}
          <div className={styles.pollingSelector}>
            <span className={styles.liveIndicator} />
            <span>Auto Refresh:</span>
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.value)}
              className={styles.pollingSelect}
            >
              <option value="off">Off</option>
              <option value="15s">15s</option>
              <option value="30s">30s</option>
              <option value="60s">1m</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className={styles.btnSecondary}
            onClick={() => fetchData(false)}
            title="Refresh All Data"
            disabled={isRefreshing}
          >
            <FiRefreshCw className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export Dropdown */}
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              className={styles.btnSecondary}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="Export API Credentials"
            >
              <FiDownload />
              <span>Export</span>
              <FiChevronDown />
            </button>
            {exportMenuOpen && (
              <div className={styles.exportDropdownMenu}>
                <button className={styles.exportItem} onClick={handleExportCSV}>
                  <FiCode />
                  <span>Export as CSV</span>
                </button>
                <button className={styles.exportItem} onClick={handleExportExcel}>
                  <FiExternalLink />
                  <span>Export as Excel (.xlsx)</span>
                </button>
                <button className={styles.exportItem} onClick={handleExportPDF}>
                  <FiDownload />
                  <span>Export as PDF Report</span>
                </button>
                <div className={styles.exportDivider} />
                <button
                  className={styles.exportItem}
                  onClick={() => {
                    setExportMenuOpen(false);
                    window.print();
                  }}
                >
                  <FiPrinter />
                  <span>Print Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Generate Token CTA */}
          <button className={styles.btnPrimary} onClick={() => handleOpenTokenModal()}>
            <FiPlus />
            <span>Generate API Token</span>
          </button>
        </div>
      </div>

      {/* ─── Metric & KPI Cards Ribbon ──────────────────────── */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardTotal}`}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Requests</span>
            <span className={styles.statValue}>{totalCalls.toLocaleString()}</span>
            <span className={styles.statSubtext}>Lifetime API volume</span>
          </div>
          <div className={`${styles.statIconWrap} ${styles.iconBlue}`}>
            <FiActivity />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Success Rate</span>
            <span className={styles.statValue} style={{ color: 'var(--color-success)' }}>{successRate}</span>
            <span className={styles.statSubtext}>{successfulCalls.toLocaleString()} successful calls</span>
          </div>
          <div className={`${styles.statIconWrap} ${styles.iconGreen}`}>
            <FiCheckCircle />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardError}`}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Failed Calls</span>
            <span className={styles.statValue} style={{ color: failedCalls > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
              {failedCalls.toLocaleString()}
            </span>
            <span className={styles.statSubtext}>4xx / 5xx error responses</span>
          </div>
          <div className={`${styles.statIconWrap} ${styles.iconRed}`}>
            <FiAlertCircle />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardKeys}`}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Keys</span>
            <span className={styles.statValue}>
              {activeKeysCount} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {tokens.length}</span>
            </span>
            <span className={styles.statSubtext}>
              {stats.last_request_at ? `Last used ${new Date(stats.last_request_at).toLocaleDateString()}` : 'Ready for integration'}
            </span>
          </div>
          <div className={`${styles.statIconWrap} ${styles.iconOrange}`}>
            <FiKey />
          </div>
        </div>
      </div>

      {/* ─── Modern Tab Navigation ──────────────────────────── */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabItem} ${activeTab === 'tokens' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          <FiKey />
          <span>API Keys</span>
          <span className={styles.tabBadge}>{tokens.length}</span>
        </button>

        <button
          className={`${styles.tabItem} ${activeTab === 'logs' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <FiActivity />
          <span>Live Traffic Logs</span>
          <span className={styles.tabBadge}>{recentLogs.length}</span>
        </button>

        <button
          className={`${styles.tabItem} ${activeTab === 'docs' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          <FiBook />
          <span>API Reference & Docs</span>
        </button>

        <button
          className={`${styles.tabItem} ${activeTab === 'tester' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('tester')}
        >
          <FiTerminal />
          <span>API Console & Playground</span>
        </button>
      </div>

      {/* ─── TAB 1: API KEYS MANAGEMENT ─────────────────────── */}
      {activeTab === 'tokens' && (
        <div className={styles.tabContentWrapper}>
          <div className={styles.tableCard}>
            {/* Table Filter Toolbar */}
            <div className={styles.toolbarHeader}>
              <div className={styles.toolbarLeft}>
                <div className={styles.searchBox}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by token name, description, scopes..."
                    value={tokenSearch}
                    onChange={(e) => {
                      setTokenSearch(e.target.value);
                      setTokenPage(1);
                    }}
                    className={styles.searchInput}
                  />
                </div>

                <select
                  value={tokenStatusFilter}
                  onChange={(e) => {
                    setTokenStatusFilter(e.target.value);
                    setTokenPage(1);
                  }}
                  className={styles.filterSelect}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Paused / Inactive</option>
                </select>
              </div>

              <div className={styles.toolbarRight}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Showing {paginatedTokens.length} of {filteredTokens.length} tokens
                </span>
              </div>
            </div>

            {/* Tokens Table */}
            {filteredTokens.length === 0 ? (
              <div style={{ padding: '48px 24px' }}>
                <EmptyState
                  icon={<FiKey size={36} color="var(--color-accent)" />}
                  title={tokens.length === 0 ? 'No API Keys Created Yet' : 'No Matching API Keys Found'}
                  description={
                    tokens.length === 0
                      ? 'Generate your first API key to connect third-party applications, webhooks, or mobile clients to this CRM.'
                      : 'No API keys match your current filter and search criteria.'
                  }
                  action={
                    tokens.length === 0
                      ? { label: '+ Generate First API Token', onClick: () => handleOpenTokenModal() }
                      : { label: 'Clear Filters', onClick: () => { setTokenSearch(''); setTokenStatusFilter('all'); } }
                  }
                />
              </div>
            ) : (
              <div className={styles.tableResponsive}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Token Name</th>
                      <th>Description</th>
                      <th>Permissions & Scopes</th>
                      <th>Status</th>
                      <th>Last Used</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTokens.map(token => (
                      <tr key={token.id} className={styles.tableRow}>
                        <td>
                          <div className={styles.tokenNameGroup}>
                            <span className={styles.tokenNameText}>{token.name || 'Unnamed API Key'}</span>
                            <span className={styles.tokenIdText}>ID: {token.id ? token.id.substring(0, 14) + '...' : '—'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.tokenDescText} title={token.description || 'No description provided'}>
                            {token.description || '—'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.scopesWrapper}>
                            {(!token.permissions || token.permissions.length === 0) ? (
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Full Read Access</span>
                            ) : (
                              <>
                                {token.permissions.slice(0, 2).map((perm, idx) => (
                                  <span key={idx} className={styles.scopePill}>
                                    {perm}
                                  </span>
                                ))}
                                {token.permissions.length > 2 && (
                                  <span className={styles.scopePill} title={token.permissions.slice(2).join(', ')}>
                                    +{token.permissions.length - 2} more
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusPill} ${token.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: token.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)'
                            }} />
                            {token.status || 'inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                            <FiClock style={{ color: 'var(--color-text-muted)' }} />
                            <span>{token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                          {new Date(token.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className={styles.actionButtonGroup} style={{ justifyContent: 'flex-end' }}>
                            <button
                              className={styles.iconBtn}
                              onClick={() => handleOpenTokenModal(token)}
                              title="Edit Token Details"
                            >
                              <FiEdit3 />
                            </button>
                            <button
                              className={styles.iconBtn}
                              onClick={() => handleToggleStatus(token)}
                              title={token.status === 'active' ? 'Pause / Disable Key' : 'Activate Key'}
                            >
                              {token.status === 'active' ? <FiPause /> : <FiPlay />}
                            </button>
                            <button
                              className={styles.iconBtn}
                              onClick={() => handleRegenerateToken(token)}
                              title="Regenerate Secret Key"
                            >
                              <FiRefreshCw />
                            </button>
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              onClick={() => handleDeleteToken(token)}
                              title="Delete API Token"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Pagination */}
            {filteredTokens.length > tokensPerPage && (
              <div className={styles.tableFooter}>
                <span>
                  Showing {(tokenPage - 1) * tokensPerPage + 1} to {Math.min(tokenPage * tokensPerPage, filteredTokens.length)} of {filteredTokens.length} tokens
                </span>
                <Pagination
                  currentPage={tokenPage}
                  totalItems={filteredTokens.length}
                  itemsPerPage={tokensPerPage}
                  onPageChange={setTokenPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LIVE TRAFFIC LOGS ────────────────────────── */}
      {activeTab === 'logs' && (
        <div className={styles.tabContentWrapper}>
          <div className={styles.tableCard}>
            {/* Filter Toolbar */}
            <div className={styles.toolbarHeader}>
              <div className={styles.toolbarLeft}>
                <div className={styles.searchBox}>
                  <FiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by endpoint path or key name..."
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    className={styles.searchInput}
                  />
                </div>

                <select
                  value={logMethodFilter}
                  onChange={(e) => {
                    setLogMethodFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className={styles.filterSelect}
                >
                  <option value="all">All Methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>

                <select
                  value={logStatusFilter}
                  onChange={(e) => {
                    setLogStatusFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className={styles.filterSelect}
                >
                  <option value="all">All HTTP Statuses</option>
                  <option value="2xx">2xx Success</option>
                  <option value="4xx">4xx Client Errors</option>
                  <option value="5xx">5xx Server Errors</option>
                </select>
              </div>

              <div className={styles.toolbarRight}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {filteredLogs.length} total activity logs captured
                </span>
              </div>
            </div>

            {/* Logs Table */}
            {filteredLogs.length === 0 ? (
              <div style={{ padding: '48px 24px' }}>
                <EmptyState
                  icon={<FiActivity size={36} color="var(--color-accent)" />}
                  title="No API Request Logs Found"
                  description="When external applications send API requests with your keys, real-time telemetry will appear here."
                  action={{
                    label: 'Run a Test Request',
                    onClick: () => setActiveTab('tester')
                  }}
                />
              </div>
            ) : (
              <div className={styles.tableResponsive}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Token Name</th>
                      <th>Method</th>
                      <th>Endpoint Route</th>
                      <th>Status Code</th>
                      <th>Latency</th>
                      <th>Client IP</th>
                      <th style={{ textAlign: 'right' }}>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map(log => {
                      const method = (log.method || 'GET').toUpperCase();
                      let methodStyle = styles.methodGet;
                      if (method === 'POST') methodStyle = styles.methodPost;
                      else if (method === 'PUT') methodStyle = styles.methodPut;
                      else if (method === 'DELETE') methodStyle = styles.methodDelete;
                      else if (method === 'PATCH') methodStyle = styles.methodPatch;

                      let statusClass = styles.status2xx;
                      if (log.status_code >= 400 && log.status_code < 500) statusClass = styles.status4xx;
                      else if (log.status_code >= 500) statusClass = styles.status5xx;

                      return (
                        <tr key={log.id || Math.random()} className={styles.tableRow}>
                          <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td>
                            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                              {log.key_name || 'System / Direct'}
                            </strong>
                          </td>
                          <td>
                            <span className={`${styles.methodBadge} ${methodStyle}`}>{method}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className={styles.endpointText}>{log.endpoint}</span>
                              <button
                                className={styles.iconBtn}
                                style={{ width: 22, height: 22, fontSize: 10 }}
                                onClick={() => copyToClipboard(log.endpoint, 'Endpoint path copied')}
                                title="Copy endpoint"
                              >
                                <FiCopy />
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.statusCodeBadge} ${statusClass}`}>
                              {log.status_code}
                            </span>
                          </td>
                          <td>
                            <span className={styles.latencyPill}>
                              {log.execution_time_ms !== undefined ? `${log.execution_time_ms} ms` : '—'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {log.ip_address || '127.0.0.1'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLog(log)}
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Logs Pagination */}
            {filteredLogs.length > logsPerPage && (
              <div className={styles.tableFooter}>
                <span>
                  Showing {(logPage - 1) * logsPerPage + 1} to {Math.min(logPage * logsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
                </span>
                <Pagination
                  currentPage={logPage}
                  totalItems={filteredLogs.length}
                  itemsPerPage={logsPerPage}
                  onPageChange={setLogPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: API REFERENCE & DOCUMENTATION ───────────── */}
      {activeTab === 'docs' && (
        <div className={styles.docSection}>
          {/* Base URL & Authentication Banner */}
          <div className={styles.infoBanner}>
            <div className={styles.infoBannerLeft}>
              <div className={`${styles.statIconWrap} ${styles.iconOrange}`}>
                <FiShield />
              </div>
              <div className={styles.infoBannerText}>
                <h3>REST API Authentication</h3>
                <p>
                  Include your secret key in the <code>Authorization</code> header using the Bearer scheme for all API requests.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className={styles.baseUrlBox}>
                <span style={{ color: 'var(--color-text-muted)' }}>Base URL:</span>
                <strong>{getBaseUrl()}</strong>
                <button
                  className={styles.iconBtn}
                  style={{ width: 26, height: 26, marginLeft: 4 }}
                  onClick={() => copyToClipboard(getBaseUrl(), 'Base URL copied')}
                  title="Copy Base URL"
                >
                  <FiCopy />
                </button>
              </div>

              {tokens.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    Active Key:
                  </span>
                  <select
                    value={selectedDocToken}
                    onChange={(e) => setSelectedDocToken(e.target.value)}
                    className={styles.filterSelect}
                    style={{ height: 32, fontSize: 'var(--text-xs)' }}
                  >
                    {tokens.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Quickstart Code Snippet */}
          <div className={styles.codeSnippetBlock}>
            <div className={styles.codeSnippetHeader}>
              <div className={styles.codeLangTabs}>
                <button
                  className={`${styles.codeLangTab} ${docLang === 'curl' ? styles.codeLangTabActive : ''}`}
                  onClick={() => setDocLang('curl')}
                >
                  cURL
                </button>
                <button
                  className={`${styles.codeLangTab} ${docLang === 'js' ? styles.codeLangTabActive : ''}`}
                  onClick={() => setDocLang('js')}
                >
                  JavaScript (Fetch)
                </button>
                <button
                  className={`${styles.codeLangTab} ${docLang === 'node' ? styles.codeLangTabActive : ''}`}
                  onClick={() => setDocLang('node')}
                >
                  Node.js (Axios)
                </button>
                <button
                  className={`${styles.codeLangTab} ${docLang === 'python' ? styles.codeLangTabActive : ''}`}
                  onClick={() => setDocLang('python')}
                >
                  Python (Requests)
                </button>
              </div>

              <button
                className={styles.btnSecondary}
                style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                onClick={() => copyToClipboard(getCodeSnippet('/leads', 'GET'), 'Code snippet copied!')}
              >
                <FiCopy />
                <span>Copy Snippet</span>
              </button>
            </div>
            <pre className={styles.codePre}>
              <code>{getCodeSnippet('/leads', 'GET')}</code>
            </pre>
          </div>

          {/* Endpoints Directory */}
          <div>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
              Core CRM REST Endpoints
            </h3>

            <div className={styles.endpointCardsGrid}>
              {/* Endpoint 1: GET /leads */}
              <div className={styles.endpointCard}>
                <div
                  className={styles.endpointCardHeader}
                  onClick={() => setExpandedEndpoints(p => ({ ...p, 'leads-list': !p['leads-list'] }))}
                >
                  <div className={styles.endpointRouteGroup}>
                    <span className={`${styles.methodBadge} ${styles.methodGet}`}>GET</span>
                    <span className={styles.endpointText}>/api/v1/leads</span>
                    <span className={styles.endpointTitle}>List all leads and opportunities</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.scopePill}>Requires: Leads Read</span>
                    {expandedEndpoints['leads-list'] ? <FiChevronDown /> : <FiChevronRight />}
                  </div>
                </div>

                {expandedEndpoints['leads-list'] && (
                  <div className={styles.endpointDetailsBody}>
                    <div>
                      <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                        Query Parameters
                      </h4>
                      <table className={styles.paramTable}>
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Type</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><code>stage</code></td>
                            <td>string</td>
                            <td>Filter leads by stage (e.g. <code>New Lead</code>, <code>Qualified</code>, <code>Proposal Sent</code>)</td>
                          </tr>
                          <tr>
                            <td><code>limit</code></td>
                            <td>integer</td>
                            <td>Maximum records returned per page (default: <code>50</code>, max: <code>200</code>)</td>
                          </tr>
                          <tr>
                            <td><code>page</code></td>
                            <td>integer</td>
                            <td>Page index for pagination (default: <code>1</code>)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                        Sample Response (200 OK)
                      </h4>
                      <pre className={styles.responseCodeBlock}>
                        <code>{JSON.stringify({
                          success: true,
                          data: [
                            {
                              id: 'lead_89a12c4e',
                              name: 'Sarah Jenkins',
                              phone: '+1 415-555-0182',
                              email: 'sarah.j@example.com',
                              budget: 35000,
                              stage: 'Site Visit Scheduled',
                              source: 'Interior Design Portal',
                              created_at: '2026-08-15T10:30:00.000Z'
                            }
                          ],
                          meta: {
                            total: 1,
                            page: 1,
                            limit: 50
                          }
                        }, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Endpoint 2: POST /leads */}
              <div className={styles.endpointCard}>
                <div
                  className={styles.endpointCardHeader}
                  onClick={() => setExpandedEndpoints(p => ({ ...p, 'leads-create': !p['leads-create'] }))}
                >
                  <div className={styles.endpointRouteGroup}>
                    <span className={`${styles.methodBadge} ${styles.methodPost}`}>POST</span>
                    <span className={styles.endpointText}>/api/v1/leads</span>
                    <span className={styles.endpointTitle}>Create a new client lead</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.scopePill}>Requires: Leads Write</span>
                    {expandedEndpoints['leads-create'] ? <FiChevronDown /> : <FiChevronRight />}
                  </div>
                </div>

                {expandedEndpoints['leads-create'] && (
                  <div className={styles.endpointDetailsBody}>
                    <div>
                      <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                        Request Body (JSON)
                      </h4>
                      <pre className={styles.responseCodeBlock}>
                        <code>{JSON.stringify({
                          name: 'Michael Chen',
                          phone: '+1 415-555-8910',
                          email: 'm.chen@example.com',
                          budget: 50000,
                          source: 'Web Inquiry Form',
                          notes: 'Looking for modular kitchen & living room turnkey package'
                        }, null, 2)}</code>
                      </pre>
                    </div>

                    <div>
                      <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                        Sample Response (201 Created)
                      </h4>
                      <pre className={styles.responseCodeBlock}>
                        <code>{JSON.stringify({
                          success: true,
                          data: {
                            id: 'lead_992b11cd',
                            name: 'Michael Chen',
                            stage: 'New Lead',
                            created_at: new Date().toISOString()
                          }
                        }, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Endpoint 3: GET /projects */}
              <div className={styles.endpointCard}>
                <div
                  className={styles.endpointCardHeader}
                  onClick={() => setExpandedEndpoints(p => ({ ...p, 'projects-list': !p['projects-list'] }))}
                >
                  <div className={styles.endpointRouteGroup}>
                    <span className={`${styles.methodBadge} ${styles.methodGet}`}>GET</span>
                    <span className={styles.endpointText}>/api/v1/projects</span>
                    <span className={styles.endpointTitle}>Fetch interior & construction projects</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.scopePill}>Requires: Projects Read</span>
                    {expandedEndpoints['projects-list'] ? <FiChevronDown /> : <FiChevronRight />}
                  </div>
                </div>

                {expandedEndpoints['projects-list'] && (
                  <div className={styles.endpointDetailsBody}>
                    <pre className={styles.responseCodeBlock}>
                      <code>{JSON.stringify({
                        success: true,
                        data: [
                          {
                            id: 'proj_448ad1',
                            name: 'Skyline Penthouse Residence',
                            status: 'In Progress',
                            budget: 120000,
                            progress_percentage: 65,
                            start_date: '2026-06-01',
                            estimated_handover: '2026-10-30'
                          }
                        ]
                      }, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 4: POST /tasks */}
              <div className={styles.endpointCard}>
                <div
                  className={styles.endpointCardHeader}
                  onClick={() => setExpandedEndpoints(p => ({ ...p, 'tasks-create': !p['tasks-create'] }))}
                >
                  <div className={styles.endpointRouteGroup}>
                    <span className={`${styles.methodBadge} ${styles.methodPost}`}>POST</span>
                    <span className={styles.endpointText}>/api/v1/tasks</span>
                    <span className={styles.endpointTitle}>Dispatch a project task or milestone</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.scopePill}>Requires: Tasks Write</span>
                    {expandedEndpoints['tasks-create'] ? <FiChevronDown /> : <FiChevronRight />}
                  </div>
                </div>

                {expandedEndpoints['tasks-create'] && (
                  <div className={styles.endpointDetailsBody}>
                    <pre className={styles.responseCodeBlock}>
                      <code>{JSON.stringify({
                        title: 'Procure Italian Marble Slabs',
                        priority: 'high',
                        due_date: '2026-09-15',
                        status: 'pending'
                      }, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: API PLAYGROUND & TEST CONSOLE ────────────── */}
      {activeTab === 'tester' && (
        <div className={styles.testerGrid}>
          {/* Request Panel */}
          <div className={styles.testerPanel}>
            <div className={styles.testerPanelHeader}>
              <h3 className={styles.testerPanelTitle}>
                <FiTerminal />
                <span>API Request Builder</span>
              </h3>

              <div style={{ display: 'flex', gap: '6px' }}>
                <Button size="sm" variant="ghost" onClick={() => handlePreloadTemplate('lead')}>
                  + Lead Template
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handlePreloadTemplate('project')}>
                  + Project Template
                </Button>
              </div>
            </div>

            {/* Token Selector */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Select Authentication Token</label>
              <select
                value={testerToken}
                onChange={(e) => setTesterToken(e.target.value)}
                className={styles.formSelect}
              >
                {tokens.length === 0 ? (
                  <option value="">No API keys available</option>
                ) : (
                  tokens.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status}) — ID: {t.id.substring(0, 8)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Method & Endpoint */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Endpoint & HTTP Method</label>
              <div className={styles.httpInputRow}>
                <select
                  value={testerMethod}
                  onChange={(e) => setTesterMethod(e.target.value)}
                  className={`${styles.formSelect} ${styles.methodSelector}`}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>

                <input
                  type="text"
                  value={testerEndpoint}
                  onChange={(e) => setTesterEndpoint(e.target.value)}
                  placeholder="/api/v1/leads"
                  className={styles.formInput}
                />
              </div>
            </div>

            {/* Request Body (for POST, PUT) */}
            {['POST', 'PUT', 'PATCH'].includes(testerMethod) && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Request Payload (JSON)</label>
                <textarea
                  rows={8}
                  value={testerBody}
                  onChange={(e) => setTesterBody(e.target.value)}
                  className={`${styles.formTextarea} ${styles.formTextareaMono}`}
                  placeholder={'{\n  "key": "value"\n}'}
                />
              </div>
            )}

            {/* Submit Action */}
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
              <Button
                variant="primary"
                onClick={handleExecuteApiTest}
                isLoading={testerLoading}
                leftIcon={<FiSend />}
                style={{ width: '100%' }}
              >
                {testerLoading ? 'Executing Request...' : 'Send API Request'}
              </Button>
            </div>
          </div>

          {/* Response Inspector Panel */}
          <div className={styles.testerPanel}>
            <div className={styles.testerPanelHeader}>
              <h3 className={styles.testerPanelTitle}>
                <FiCode />
                <span>Response Inspector</span>
              </h3>

              {testerResponse && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(JSON.stringify(testerResponse.data, null, 2), 'Response JSON copied')}
                >
                  <FiCopy />
                  <span>Copy JSON</span>
                </Button>
              )}
            </div>

            {testerLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', minHeight: 300 }}>
                <Spinner size="md" />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Awaiting server response...
                </span>
              </div>
            ) : !testerResponse ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', minHeight: 300, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <FiTerminal size={40} />
                <strong style={{ color: 'var(--color-text)' }}>No Request Sent Yet</strong>
                <p style={{ fontSize: 'var(--text-sm)', maxWidth: 280 }}>
                  Select an endpoint and click Send API Request to test your API key in real-time.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flex: 1 }}>
                <div className={styles.responseMetaBar}>
                  <Badge
                    variant={testerResponse.status >= 200 && testerResponse.status < 300 ? 'success' : 'danger'}
                    size="md"
                  >
                    {testerResponse.status} {testerResponse.statusText}
                  </Badge>

                  {testerDuration !== null && (
                    <span>
                      Latency: <strong style={{ color: 'var(--color-text)' }}>{testerDuration} ms</strong>
                    </span>
                  )}
                </div>

                <pre className={styles.responseCodeBlock} style={{ flex: 1, minHeight: 280 }}>
                  <code>{JSON.stringify(testerResponse.data, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: CREATE / EDIT API KEY ─────────────────── */}
      <Modal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        title={editingToken ? 'Edit API Token' : 'Generate New API Token'}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <Button variant="ghost" onClick={() => setIsTokenModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveToken}
              isLoading={isSavingToken}
            >
              {editingToken ? 'Save Changes' : 'Generate Token'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveToken} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Token Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Zapier Lead Sync, Mobile App iOS, Analytics Pipeline"
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description (Optional)</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what system or partner is using this API key..."
              className={styles.formTextarea}
            />
          </div>

          <div className={styles.formGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.formLabel}>Permissions & Access Scopes</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllScopes}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <span style={{ color: 'var(--color-border-strong)' }}>|</span>
                <button
                  type="button"
                  onClick={handleClearAllScopes}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {PERMISSION_CATEGORIES.map(cat => (
              <div key={cat.category} className={styles.permissionsCategorySection}>
                <div className={styles.permissionsCategoryTitle}>
                  <span>{cat.category}</span>
                </div>
                <div className={styles.permissionsCategoryGrid}>
                  {cat.scopes.map(scope => {
                    const isChecked = formData.permissions.includes(scope.id);
                    return (
                      <div
                        key={scope.id}
                        className={`${styles.checkboxCard} ${isChecked ? styles.checkboxCardActive : ''}`}
                        onClick={() => handleToggleScope(scope.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: 'var(--text-xs)' }}>{scope.label}</strong>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{scope.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 2: SECRET KEY REVEAL MODAL ────────────────── */}
      <Modal
        isOpen={secretModal.isOpen}
        onClose={() => setSecretModal({ isOpen: false, secret: '', isMasked: true })}
        title="Your Secret API Key"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <Button
              variant="primary"
              onClick={() => setSecretModal({ isOpen: false, secret: '', isMasked: true })}
            >
              I Have Securely Saved This Key
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className={styles.secretWarningBox}>
            <FiShield style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Security Notice:</strong> Please copy this secret key now. For your protection, you will not be able to view it again after closing this dialog.
            </div>
          </div>

          <div className={styles.secretDisplayBox}>
            <span className={styles.secretText}>
              {secretModal.isMasked ? '••••••••••••••••••••••••••••••••••••••••••••' : secretModal.secret}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className={styles.iconBtn}
                onClick={() => setSecretModal(prev => ({ ...prev, isMasked: !prev.isMasked }))}
                title={secretModal.isMasked ? 'Reveal Key' : 'Mask Key'}
              >
                {secretModal.isMasked ? <FiEye /> : <FiEyeOff />}
              </button>

              <Button
                size="sm"
                variant="primary"
                leftIcon={hasCopiedSecret ? <FiCheck /> : <FiCopy />}
                onClick={() => {
                  copyToClipboard(secretModal.secret, 'Secret API key copied to clipboard');
                  setHasCopiedSecret(true);
                }}
              >
                {hasCopiedSecret ? 'Copied' : 'Copy Key'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 3: LOG INSPECTION MODAL ───────────────────── */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="API Traffic Log Inspection"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <Button variant="ghost" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  TIMESTAMP
                </span>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  TOKEN NAME
                </span>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {selectedLog.key_name || 'System / Direct Token'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  HTTP METHOD & STATUS
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span className={`${styles.methodBadge} ${selectedLog.method === 'POST' ? styles.methodPost : styles.methodGet}`}>
                    {selectedLog.method}
                  </span>
                  <Badge variant={selectedLog.status_code < 400 ? 'success' : 'danger'}>
                    {selectedLog.status_code}
                  </Badge>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  EXECUTION LATENCY
                </span>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                  {selectedLog.execution_time_ms} ms
                </p>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Request Endpoint</label>
              <div className={styles.endpointText} style={{ padding: '8px 12px', fontSize: 'var(--text-sm)' }}>
                {selectedLog.endpoint}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Client IP Address</label>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                {selectedLog.ip_address || '127.0.0.1'}
              </p>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
