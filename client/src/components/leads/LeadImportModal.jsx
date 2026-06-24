import React, { useState, useRef } from 'react';
import { Modal, Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

const STANDARD_FIELDS = [
  { key: 'name', label: 'Lead Name', required: true, example: 'Rohan Sharma' },
  { key: 'email', label: 'Email', required: false, example: 'rohan@example.com' },
  { key: 'phone', label: 'Phone Number', required: false, example: '+91 9876543210' },
  { key: 'property_type', label: 'Property Type', required: false, example: 'Villa' },
  { key: 'scope', label: 'Project Scope', required: false, example: 'Full Home' },
  { key: 'locality', label: 'Locality/City', required: false, example: 'Indiranagar' },
  { key: 'budget_max', label: 'Budget (Max)', required: false, example: '2500000' },
  { key: 'source', label: 'Lead Source', required: false, example: 'Facebook Ads' },
];

export default function LeadImportModal({ isOpen, onClose, onImportSuccess }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1 = Upload, 2 = Mapping
  const [file, setFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parsedRows, setParsedRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [importStats, setImportStats] = useState(null);

  // Reset state when opened/closed
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setCsvContent('');
      setHeaders([]);
      setMapping({});
      setParsedRows([]);
      setTotalRows(0);
      setImportErrors([]);
      setImportStats(null);
    }
  }, [isOpen]);

  const parseCsvHeaders = (csvText) => {
    // Simple parser: get first line, split by comma, remove quotes
    const firstLine = csvText.split('\n')[0] || '';
    return firstLine.split(',').map(h => h.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
  };

  const autoMapHeaders = (csvHeaders) => {
    const initialMapping = {};
    STANDARD_FIELDS.forEach(field => {
      // Very basic case-insensitive match
      const matchedHeader = csvHeaders.find(h => h.toLowerCase().includes(field.key.replace('_', '')) || field.key.toLowerCase().includes(h.toLowerCase()));
      if (matchedHeader) {
        initialMapping[field.key] = matchedHeader;
      } else {
        initialMapping[field.key] = '';
      }
    });
    setMapping(initialMapping);
  };

  const parseCsvPreview = (csvText, csvHeaders) => {
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    const rows = [];
    const limit = Math.min(lines.length, 11); // up to 10 rows
    for (let i = 1; i < limit; i++) {
      const values = lines[i].split(',').map(v => v.replace(/^["']|["']$/g, '').trim());
      const rowObj = {};
      csvHeaders.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });
      rows.push(rowObj);
    }
    return { rows, totalParsed: lines.length - 1 };
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported currently.');
      return;
    }

    setFile(selectedFile);
    try {
      const text = await selectedFile.text();
      setCsvContent(text);
      const extractedHeaders = parseCsvHeaders(text);
      setHeaders(extractedHeaders);
      autoMapHeaders(extractedHeaders);
      
      const { rows, totalParsed } = parseCsvPreview(text, extractedHeaders);
      setParsedRows(rows);
      setTotalRows(totalParsed);
      
      setStep(2);
    } catch (err) {
      toast.error('Failed to read file');
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      // Simulate an event object for handleFileSelect
      handleFileSelect({ target: { files: [droppedFile] } });
    }
  };

  const handleSubmit = async () => {
    // Check required fields
    const missingRequired = STANDARD_FIELDS.filter(f => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map(m => m.label).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, we would send the mapping config + csv text to the backend.
      // For this implementation, we'll send it to /leads/import
      const payload = {
        csv: csvContent,
        mapping: mapping,
        editedRows: parsedRows // Optional: backend could use edited rows instead of raw csv
      };
      
      const res = await api.post('/leads/import', payload);
      if (res.data?.success) {
        const { created = 0, skipped = 0, errors = [] } = res.data.data || {};
        setImportStats({ created, skipped });

        if (created > 0) onImportSuccess?.();

        if (skipped > 0 && errors.length > 0) {
          setImportErrors(errors);
          setStep(3);
        } else {
          toast.success(`Imported ${created} leads successfully.`);
          onClose();
        }
      } else {
        toast.error('Import failed to process');
      }
    } catch (err) {
      toast.error('Error during import');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Leads"
      size="2xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          {step !== 3 && <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>}
          {step === 2 && (
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Importing...' : 'Start Import'}
            </Button>
          )}
          {step === 3 && (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      }
    >
      {step === 1 ? (
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Upload your Excel or CSV file to import leads. We'll help you map the columns to CRM fields in the next step.
          </p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer bg-white"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900">Drag & drop your CSV file here</p>
            <p className="text-xs text-gray-500 mt-1">or click to browse from your computer</p>
          </div>
          
          <div className="mt-4 bg-[#f8f7f5] border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                Recommended columns in your file
              </h4>
              <span className="text-xs text-gray-500">Columns can be mapped in the next step (header names are flexible)</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {STANDARD_FIELDS.map((field, idx) => (
                <span key={field.key} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef4ff] text-[#1c4ed8] text-xs font-medium border border-[#dbeafe]">
                  <span className="text-blue-400 font-bold">{idx + 1}.</span> {field.label}
                </span>
              ))}
            </div>

            <div className="bg-[#f1efe9] border border-gray-200 rounded-md p-3 overflow-x-auto">
              <div className="text-gray-500 font-bold tracking-widest mb-2 uppercase text-[10px]">Example Row</div>
              <div className="flex gap-2 min-w-max">
                {STANDARD_FIELDS.map((field) => (
                  <span key={field.key} className="px-3 py-1.5 bg-white border border-gray-200 rounded text-gray-700 font-mono text-xs shadow-sm">
                    {field.example}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>Currently only .csv files are supported.</span>
            </div>
            <a 
              href="data:text/csv;charset=utf-8,Lead Name,Email,Phone Number,Property Type,Project Scope,Locality/City,Budget (Max),Lead Source%0ARohan Sharma,rohan@example.com,+91 9876543210,Villa,Full Home,Indiranagar,2500000,Facebook Ads%0AAnita Desai,anita.d@example.com,+91 9123456789,Flat,Modular Kitchen,Whitefield,1200000,Referral" 
              download="lead_import_template.csv"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download template: CSV
            </a>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Parsed Records Preview ({totalRows > 10 ? 'Showing first 10 rows' : `${totalRows} rows`})</h3>
              <p className="text-sm text-gray-500">Map columns and fix any highlighted missing data directly in the grid before importing.</p>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono border">{file?.name}</span>
               <Button variant="outline" onClick={() => setStep(1)} size="sm">Upload Different File</Button>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-x-auto flex-1 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#fcfbf9] border-b text-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 font-semibold text-xs uppercase tracking-wider text-center w-12 border-r bg-[#fcfbf9]">Status</th>
                  {STANDARD_FIELDS.map(field => (
                    <th key={field.key} className="px-3 py-3 min-w-[180px] border-r align-top bg-[#fcfbf9]">
                      <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="block w-full rounded border-gray-300 text-xs py-1.5 px-2 focus:border-blue-500 focus:ring-blue-500 font-normal bg-white shadow-sm"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row, rowIndex) => {
                  const isValid = STANDARD_FIELDS.filter(f => f.required).every(f => {
                    const mappedHeader = mapping[f.key];
                    return mappedHeader && row[mappedHeader]?.trim();
                  });

                  return (
                    <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 border-r text-center align-middle">
                        {isValid ? (
                          <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </td>
                      {STANDARD_FIELDS.map(field => {
                        const mappedHeader = mapping[field.key];
                        const value = mappedHeader ? row[mappedHeader] : '';
                        const isError = field.required && !value;

                        return (
                          <td key={field.key} className="px-2 py-2 border-r align-middle">
                            <input 
                              type="text" 
                              value={value || ''} 
                              onChange={(e) => {
                                if (!mappedHeader) return;
                                const newRows = [...parsedRows];
                                newRows[rowIndex] = { ...newRows[rowIndex], [mappedHeader]: e.target.value };
                                setParsedRows(newRows);
                              }}
                              disabled={!mappedHeader}
                              className={`w-full text-xs p-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${!mappedHeader ? 'bg-gray-50 border-transparent text-gray-400 cursor-not-allowed' : isError ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300' : 'border-gray-200 bg-white text-gray-900'}`}
                              placeholder={mappedHeader ? '' : 'Ignored'}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between items-center mt-3 text-xs text-gray-500 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
              Red highlighted cells represent missing required data fields.
            </div>
            <div className="font-medium text-gray-700">Total parsed rows: {totalRows}</div>
          </div>
        </div>
      ) : step === 3 ? (
        <div className="p-4 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-1">Import Partially Successful</h3>
            <p className="text-sm">Successfully imported {importStats?.created} leads, but {importStats?.skipped} rows failed validation.</p>
          </div>
          
          <div className="bg-white border rounded-lg overflow-hidden flex-1 shadow-sm mt-4 max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#fcfbf9] border-b text-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 font-semibold text-xs text-gray-700 border-r w-20">Row</th>
                  <th className="px-4 py-2 font-semibold text-xs text-gray-700">Error Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importErrors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-red-50">
                    <td className="px-4 py-2 text-sm text-gray-600 border-r font-mono">Row {err.row}</td>
                    <td className="px-4 py-2 text-sm text-red-600">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
