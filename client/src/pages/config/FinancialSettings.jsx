/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './FinancialSettings.module.css';

export default function FinancialSettings() {
  const [settings, setSettings] = useState({
    finance_invoice_threshold: 100000,
    finance_payment_threshold: 100000,
    finance_discount_threshold: 50000,
    finance_credit_threshold: 50000
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/config/tenant-settings');
      const data = res.data?.data || {};
      setSettings({
        finance_invoice_threshold: data.finance_invoice_threshold !== undefined ? data.finance_invoice_threshold : 100000,
        finance_payment_threshold: data.finance_payment_threshold !== undefined ? data.finance_payment_threshold : 100000,
        finance_discount_threshold: data.finance_discount_threshold !== undefined ? data.finance_discount_threshold : 50000,
        finance_credit_threshold: data.finance_credit_threshold !== undefined ? data.finance_credit_threshold : 50000
      });
    } catch (err) {
      toast.error('Failed to load financial settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value === '' ? '' : Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/config/tenant-settings', settings);
      toast.success('Financial approval thresholds updated successfully!');
    } catch (err) {
      toast.error('Failed to update financial settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading financial settings...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financial Threshold Settings</h1>
          <p className={styles.subtitle}>Configure the monetary thresholds above which financial operations require formal manager approval.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.card}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="finance_invoice_threshold" className={styles.label}>
              Invoice Generation Threshold (INR)
            </label>
            <input
              type="number"
              id="finance_invoice_threshold"
              name="finance_invoice_threshold"
              value={settings.finance_invoice_threshold}
              onChange={handleInputChange}
              required
              className={styles.input}
              placeholder="e.g. 100000"
            />
            <span className={styles.hint}>Invoices with total amounts exceeding this value will go to pending approvals.</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="finance_payment_threshold" className={styles.label}>
              Payment Milestone Update/Receive Threshold (INR)
            </label>
            <input
              type="number"
              id="finance_payment_threshold"
              name="finance_payment_threshold"
              value={settings.finance_payment_threshold}
              onChange={handleInputChange}
              required
              className={styles.input}
              placeholder="e.g. 100000"
            />
            <span className={styles.hint}>Creating milestones or recording payments received exceeding this value will require approval.</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="finance_discount_threshold" className={styles.label}>
              Quotation Discount Threshold (INR)
            </label>
            <input
              type="number"
              id="finance_discount_threshold"
              name="finance_discount_threshold"
              value={settings.finance_discount_threshold}
              onChange={handleInputChange}
              required
              className={styles.input}
              placeholder="e.g. 50000"
            />
            <span className={styles.hint}>Flat discount amounts on project quotations exceeding this limit will require approval.</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="finance_credit_threshold" className={styles.label}>
              Credit Note & Refund Threshold (INR)
            </label>
            <input
              type="number"
              id="finance_credit_threshold"
              name="finance_credit_threshold"
              value={settings.finance_credit_threshold}
              onChange={handleInputChange}
              required
              className={styles.input}
              placeholder="e.g. 50000"
            />
            <span className={styles.hint}>Issuing credit notes or customer refunds exceeding this amount will require approval.</span>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="submit" disabled={saving} className={styles.saveButton}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
