import React, { useState, useRef } from 'react';
import { Modal, Button } from '../../components/ui';
import styles from './ImportRolesModal.module.css';
import * as XLSX from 'xlsx';
import api from '../../store/api';
import { toast } from 'react-hot-toast';

export default function ImportRolesModal({ isOpen, onClose, roles = [], schemaActions = [], onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedRoles, setParsedRoles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let rawData = [];
        
        if (file.name.endsWith('.json')) {
          rawData = JSON.parse(e.target.result);
          if (!Array.isArray(rawData)) {
            rawData = [rawData];
          }
        } else {
          // Parse CSV or Excel
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rawData = XLSX.utils.sheet_to_json(worksheet);
          
          // Map flat headers back to nested objects
          rawData = rawData.map(row => {
            return {
              name: row.Name || row.name,
              description: row.Description || row.description || '',
              permissions: row.Permissions ? row.Permissions.split(',').map(s => s.trim()) : [],
              data_scopes: row.DataScopes ? JSON.parse(row.DataScopes) : {},
              enabled_modules: row.EnabledModules ? row.EnabledModules.split(',').map(s => s.trim()) : [],
              field_permissions: row.FieldPermissions ? JSON.parse(row.FieldPermissions) : {},
              page_permissions: row.PagePermissions ? JSON.parse(row.PagePermissions) : {},
              security_policies: row.SecurityPolicies ? JSON.parse(row.SecurityPolicies) : {}
            };
          });
        }
        
        validateData(rawData);
      } catch (err) {
        console.error("Parse error:", err);
        toast.error('Failed to parse file. Ensure it is valid JSON, CSV, or Excel.');
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const validateData = (data) => {
    const existingNames = new Set(roles.map(r => r.name.toLowerCase()));
    const validActions = new Set();
    schemaActions.forEach(mod => {
      mod.actions.forEach(act => {
        validActions.add(`${mod.id}:${act.id}`);
      });
    });

    const validatedData = data.map(role => {
      const errors = [];
      
      if (!role.name) {
        errors.push("Missing Role Name");
      } else if (existingNames.has(role.name.toLowerCase())) {
        errors.push("Duplicate name (already exists in system)");
      }
      
      if (!Array.isArray(role.permissions)) {
        errors.push("Permissions must be an array");
      } else {
        const unknownPerms = role.permissions.filter(p => !validActions.has(p) && p !== '*');
        if (unknownPerms.length > 0) {
          errors.push(`Contains ${unknownPerms.length} unknown permissions (e.g. ${unknownPerms[0]})`);
        }
      }

      return {
        ...role,
        isValid: errors.length === 0,
        errors
      };
    });

    setParsedRoles(validatedData);
    setIsValidated(true);
  };

  const handleImport = async () => {
    const rolesToImport = parsedRoles.filter(r => r.isValid).map(r => ({
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      data_scopes: r.data_scopes || {},
      field_permissions: r.field_permissions || {},
      enabled_modules: r.enabled_modules || [],
      page_permissions: r.page_permissions || {},
      security_policies: r.security_policies || {}
    }));

    if (rolesToImport.length === 0) {
      toast.error('No valid roles to import');
      return;
    }

    setIsUploading(true);
    try {
      const response = await api.post('/roles/bulk-import', { roles: rolesToImport });
      if (response.data.success) {
        toast.success(`Successfully imported ${rolesToImport.length} role(s)`);
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        toast.error(response.data.message || 'Import failed');
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err.response?.data?.error?.message || 'Failed to import roles');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRoles([]);
    setIsValidated(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Roles" maxWidth="800px">
      <div className={styles.container}>
        {!file ? (
          <div className={styles.uploadArea} onClick={() => fileInputRef.current?.click()}>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".json,.csv,.xlsx"
              onChange={handleFileChange}
            />
            <div className={styles.uploadIcon}>📁</div>
            <h3 className={styles.uploadTitle}>Click to upload file</h3>
            <p className={styles.uploadDesc}>Supports JSON, CSV, and Excel (.xlsx)</p>
          </div>
        ) : (
          <div className={styles.previewArea}>
            <div className={styles.previewHeader}>
              <h4>Preview Import ({parsedRoles.length} roles found)</h4>
              <Button variant="secondary" onClick={() => {
                setFile(null);
                setParsedRoles([]);
                setIsValidated(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}>Choose Different File</Button>
            </div>
            
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Role Name</th>
                    <th>Permissions</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRoles.map((role, idx) => (
                    <tr key={idx} className={role.isValid ? styles.rowValid : styles.rowInvalid}>
                      <td>
                        {role.isValid ? <span className={styles.badgeValid}>Valid</span> : <span className={styles.badgeInvalid}>Invalid</span>}
                      </td>
                      <td>{role.name || 'N/A'}</td>
                      <td>{Array.isArray(role.permissions) ? role.permissions.length : 0} items</td>
                      <td className={styles.errorText}>
                        {role.errors.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.actions}>
              <p className={styles.summaryText}>
                {parsedRoles.filter(r => r.isValid).length} valid role(s) ready to import.
                {parsedRoles.some(r => !r.isValid) && ' Invalid roles will be skipped.'}
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                <Button 
                  variant="primary" 
                  onClick={handleImport} 
                  disabled={isUploading || parsedRoles.filter(r => r.isValid).length === 0}
                >
                  {isUploading ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
