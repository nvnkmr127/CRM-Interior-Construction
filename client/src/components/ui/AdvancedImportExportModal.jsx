import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Modal, Button, Badge } from './index';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

const AdvancedImportExportModal = ({ isOpen, onClose, onSuccess, dataToExport = [] }) => {
  const [activeTab, setActiveTab] = useState('import'); // 'import' or 'export'
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Transform keys to expected backend keys if needed
        const formattedData = data.map(row => ({
          name: row.Name || row.name,
          email: row.Email || row.email,
        }));

        // Call backend for validation
        const res = await api.post('/users/bulk/import-preview', { users: formattedData });
        const result = res.data?.data || res.data;
        setPreviewData(result);
        setIsLoading(false);
      };
      reader.readAsBinaryString(selectedFile);
    } catch (err) {
      toast.error('Failed to parse file');
      setIsLoading(false);
    }
    // reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ Name: 'John Doe', Email: 'john@example.com' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  const handleCommitImport = async () => {
    if (!previewData || previewData.validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setIsLoading(true);
    try {
      const usersToImport = previewData.validRows.map(r => r.rowData);
      const res = await api.post('/users/bulk/import', { users: usersToImport });
      const count = res.data?.data?.created || 0;
      toast.success(`Successfully imported ${count} users`);
      setImportSummary({ count, skipped: previewData.invalidRows.length });
      setPreviewData(null);
      setFile(null);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed. Transaction rolled back.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!previewData || previewData.invalidRows.length === 0) return;
    const errorData = previewData.invalidRows.map(r => ({ ...r.rowData, Error_Reason: r.error }));
    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'import_errors.xlsx');
  };

  const handleExportCSV = () => {
    if (dataToExport.length === 0) return toast.error('No data to export');
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'export.csv';
    link.click();
  };

  const handleExportExcel = () => {
    if (dataToExport.length === 0) return toast.error('No data to export');
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'export.xlsx');
  };

  const handleExportPDF = () => {
    if (dataToExport.length === 0) return toast.error('No data to export');
    const doc = new jsPDF();
    const columns = Object.keys(dataToExport[0]).map(key => ({ header: key, dataKey: key }));
    doc.autoTable({
      columns,
      body: dataToExport,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save('export.pdf');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Advanced Data Transfer">
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div 
          onClick={() => setActiveTab('import')}
          style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'import' ? 600 : 400, color: activeTab === 'import' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'import' ? '2px solid var(--color-primary)' : '2px solid transparent' }}
        >
          Import Data
        </div>
        <div 
          onClick={() => setActiveTab('export')}
          style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'export' ? 600 : 400, color: activeTab === 'export' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'export' ? '2px solid var(--color-primary)' : '2px solid transparent' }}
        >
          Export Data
        </div>
      </div>

      {activeTab === 'import' && (
        <div>
          {importSummary ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>Import Summary</h3>
              <p>Successfully imported <strong>{importSummary.count}</strong> users.</p>
              {importSummary.skipped > 0 && <p style={{ color: 'var(--color-error)' }}>Skipped {importSummary.skipped} invalid rows.</p>}
              <Button style={{ marginTop: '24px' }} onClick={() => { setImportSummary(null); onClose(); }}>Close</Button>
            </div>
          ) : !previewData ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed var(--color-border)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '8px' }}>Upload File</h4>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '14px' }}>Supports .csv and .xlsx files.</p>
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                style={{ display: 'none' }} 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <Button onClick={() => fileInputRef.current?.click()} isLoading={isLoading}>Select File</Button>
                <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Import Preview</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    {previewData.validRows.length} valid rows, {previewData.invalidRows.length} errors
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="ghost" onClick={() => setPreviewData(null)}>Cancel</Button>
                  <Button 
                    variant="primary" 
                    onClick={handleCommitImport} 
                    isLoading={isLoading}
                    disabled={previewData.validRows.length === 0}
                  >
                    Commit {previewData.validRows.length} Rows
                  </Button>
                </div>
              </div>

              {previewData.invalidRows.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{previewData.invalidRows.length} Issues Found (These will be skipped):</strong>
                    <Button variant="outline" size="small" onClick={downloadErrorReport} style={{ padding: '4px 8px', fontSize: '12px' }}>Download Error Report</Button>
                  </div>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {previewData.invalidRows.slice(0, 5).map((err, i) => (
                      <li key={i}>Row {err.rowIndex + 1} ({err.rowData.name || err.rowData.email || 'Unknown'}): {err.error}</li>
                    ))}
                    {previewData.invalidRows.length > 5 && <li>...and {previewData.invalidRows.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.invalidRows.map((row, i) => (
                      <tr key={`inv-${i}`} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: '#fff0f0' }}>
                        <td style={{ padding: '8px' }}><Badge variant="error">Invalid</Badge></td>
                        <td style={{ padding: '8px' }}>{row.rowData.name || row.rowData.Name || '-'}</td>
                        <td style={{ padding: '8px' }}>{row.rowData.email || row.rowData.Email || '-'}</td>
                      </tr>
                    ))}
                    {previewData.validRows.map((row, i) => (
                      <tr key={`val-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px' }}><Badge variant="success">Valid</Badge></td>
                        <td style={{ padding: '8px' }}>{row.rowData.name}</td>
                        <td style={{ padding: '8px' }}>{row.rowData.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'export' && (
        <div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            Export {dataToExport.length} selected record(s).
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={handleExportCSV} style={{ flex: 1 }}>Export as CSV</Button>
            <Button onClick={handleExportExcel} style={{ flex: 1, backgroundColor: '#217346', color: 'white', border: 'none' }}>Export as Excel</Button>
            <Button onClick={handleExportPDF} style={{ flex: 1, backgroundColor: '#F40F02', color: 'white', border: 'none' }}>Export as PDF</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AdvancedImportExportModal;
