import React, { useState, useEffect } from 'react';
import { Button, Badge, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './BudgetTab.module.css';
import {
  getBudgetSummary,
  updateBudgetAllocation,
  getExpenses,
  addExpense,
  deleteExpense
} from '../../api/projects';

export default function BudgetTab({ projectId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ categories: [], totals: { budgeted: 0, committed: 0, actual: 0, variance: 0 } });
  const [expenses, setExpenses] = useState([]);
  
  // Budget Allocation state
  const [allocCategory, setAllocCategory] = useState('material');
  const [allocAmount, setAllocAmount] = useState('');
  const [submittingAlloc, setSubmittingAlloc] = useState(false);

  // Expense Logger state
  const [expCategory, setExpCategory] = useState('material');
  const [expType, setExpType] = useState('actual');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingExp, setSubmittingExp] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchBudgetData();
    }
  }, [projectId]);

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
      const [summaryRes, expensesRes] = await Promise.all([
        getBudgetSummary(projectId),
        getExpenses(projectId)
      ]);

      if (summaryRes.data?.success) {
        setSummary(summaryRes.data.data);
      }
      if (expensesRes.data?.success) {
        setExpenses(expensesRes.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load budget and expense details.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAllocation = async (e) => {
    e.preventDefault();
    if (!allocAmount || isNaN(Number(allocAmount)) || Number(allocAmount) < 0) {
      return toast.error('Please enter a valid non-negative budgeted amount.');
    }

    setSubmittingAlloc(true);
    try {
      const res = await updateBudgetAllocation(projectId, {
        category: allocCategory,
        budgetedCost: Number(allocAmount)
      });

      if (res.data?.success) {
        toast.success(`Budget for ${allocCategory} updated successfully.`);
        setAllocAmount('');
        // Refresh summary
        const summaryRes = await getBudgetSummary(projectId);
        if (summaryRes.data?.success) {
          setSummary(summaryRes.data.data);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update budget allocation.');
    } finally {
      setSubmittingAlloc(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expDescription.trim()) return toast.error('Description is required.');
    if (!expAmount || isNaN(Number(expAmount)) || Number(expAmount) <= 0) {
      return toast.error('Please enter a valid positive amount.');
    }

    setSubmittingExp(true);
    try {
      const res = await addExpense(projectId, {
        category: expCategory,
        type: expType,
        description: expDescription.trim(),
        amount: Number(expAmount),
        incurredDate: expDate
      });

      if (res.data?.success) {
        toast.success(expType === 'committed' ? 'Committed cost logged.' : 'Actual expense logged.');
        setExpDescription('');
        setExpAmount('');
        // Refresh all data
        const [summaryRes, expensesRes] = await Promise.all([
          getBudgetSummary(projectId),
          getExpenses(projectId)
        ]);

        if (summaryRes.data?.success) setSummary(summaryRes.data.data);
        if (expensesRes.data?.success) setExpenses(expensesRes.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log cost item.');
    } finally {
      setSubmittingExp(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this cost record?')) return;

    try {
      const res = await deleteExpense(projectId, expenseId);
      if (res.data?.success) {
        toast.success('Cost record deleted.');
        // Refresh all data
        const [summaryRes, expensesRes] = await Promise.all([
          getBudgetSummary(projectId),
          getExpenses(projectId)
        ]);

        if (summaryRes.data?.success) setSummary(summaryRes.data.data);
        if (expensesRes.data?.success) setExpenses(expensesRes.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete cost record.');
    }
  };

  const formatCurrency = (val) => {
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getProgressWidths = (budgeted, committed, actual) => {
    if (budgeted <= 0) return { committedWidth: '0%', actualWidth: '0%', isOver: (committed + actual > 0) };
    const maxVal = Math.max(budgeted, committed + actual);
    const committedWidth = `${(committed / maxVal) * 100}%`;
    const actualWidth = `${(actual / maxVal) * 100}%`;
    return {
      committedWidth,
      actualWidth,
      isOver: (committed + actual > budgeted)
    };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading budget analytics...</p>
      </div>
    );
  }

  const totals = summary.totals || { budgeted: 0, committed: 0, actual: 0, variance: 0 };

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardTitle}>Project Budget Dashboard</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Track and monitor budgeted, committed, and actual project expenditures.
          </p>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className={styles.summaryGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Budgeted</span>
          <span className={styles.statValue}>{formatCurrency(totals.budgeted)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Committed</span>
          <span className={styles.statValue}>{formatCurrency(totals.committed)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Actual Cost</span>
          <span className={styles.statValue}>{formatCurrency(totals.actual)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Net Budget Variance</span>
          <span className={`${styles.statValue} ${totals.variance >= 0 ? styles.statVariancePositive : styles.statVarianceNegative}`}>
            {formatCurrency(totals.variance)}
          </span>
        </div>
      </div>

      {/* TWO COLUMN MAIN LAYOUT */}
      <div className={styles.mainLayout}>
        {/* LEFT COLUMN: Visual Category Progress Bars */}
        <div className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <span>Category Budget Utilization</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.categoryList}>
              {summary.categories.map((c) => {
                const { committedWidth, actualWidth, isOver } = getProgressWidths(c.budgeted, c.committed, c.actual);
                return (
                  <div key={c.category} className={styles.categoryItem}>
                    <div className={styles.categoryMeta}>
                      <span className={styles.categoryName}>{c.category}</span>
                      <span className={styles.categoryStats}>
                        Usage:{' '}
                        <strong>
                          {c.budgeted > 0 
                            ? `${Math.round(((c.committed + c.actual) / c.budgeted) * 100)}%` 
                            : c.committed + c.actual > 0 ? '100%+' : '0%'}
                        </strong>
                      </span>
                    </div>

                    <div className={styles.progressBarContainer}>
                      <div 
                        className={`${styles.progressBarActual} ${isOver ? styles.progressBarOver : ''}`} 
                        style={{ width: actualWidth }} 
                        title={`Actual Cost: ${formatCurrency(c.actual)}`}
                      />
                      <div 
                        className={`${styles.progressBarCommitted} ${isOver ? styles.progressBarOver : ''}`} 
                        style={{ width: committedWidth }} 
                        title={`Committed Cost: ${formatCurrency(c.committed)}`}
                      />
                    </div>

                    <div className={styles.categoryValuesGrid}>
                      <div className={styles.valueBlock}>
                        <span className={styles.valueLabel}>Budgeted</span>
                        <span className={styles.valueAmount}>{formatCurrency(c.budgeted)}</span>
                      </div>
                      <div className={styles.valueBlock}>
                        <span className={styles.valueLabel}>Committed</span>
                        <span className={styles.valueAmount}>{formatCurrency(c.committed)}</span>
                      </div>
                      <div className={styles.valueBlock}>
                        <span className={styles.valueLabel}>Actual</span>
                        <span className={styles.valueAmount}>{formatCurrency(c.actual)}</span>
                      </div>
                      <div className={styles.valueBlock}>
                        <span className={styles.valueLabel}>Variance</span>
                        <span className={`${styles.valueAmount} ${c.variance >= 0 ? styles.statVariancePositive : styles.statVarianceNegative}`}>
                          {formatCurrency(c.variance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Configuration Forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Allocation Setup */}
          <div className={styles.cardSection}>
            <div className={styles.cardHeader}>
              <span>Set Budget Allocation</span>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleUpdateAllocation} className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Cost Category</label>
                  <select
                    className={styles.selectField}
                    value={allocCategory}
                    onChange={(e) => setAllocCategory(e.target.value)}
                  >
                    <option value="labour">Labour</option>
                    <option value="material">Material</option>
                    <option value="vendor">Vendor</option>
                    <option value="overhead">Overhead</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Budgeted Amount (₹)</label>
                  <input
                    type="number"
                    className={styles.inputField}
                    placeholder="Enter planned budget"
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={submittingAlloc}
                  className={styles.btnSubmit}
                >
                  {submittingAlloc ? 'Updating...' : 'Set Budget'}
                </Button>
              </form>
            </div>
          </div>

          {/* Expense Logger */}
          <div className={styles.cardSection}>
            <div className={styles.cardHeader}>
              <span>Log Budget Transaction</span>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleAddExpense} className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select
                    className={styles.selectField}
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                  >
                    <option value="labour">Labour</option>
                    <option value="material">Material</option>
                    <option value="vendor">Vendor</option>
                    <option value="overhead">Overhead</option>
                  </select>
                </div>
                <div className={styles.flexRow}>
                  <div className={styles.formGroup}>
                    <label>Cost Type</label>
                    <select
                      className={styles.selectField}
                      value={expType}
                      onChange={(e) => setExpType(e.target.value)}
                    >
                      <option value="actual">Actual Incurred</option>
                      <option value="committed">Committed (PO)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      className={styles.inputField}
                      placeholder="Amount"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="e.g. Paid weekly labor wage"
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Transaction Date</label>
                  <input
                    type="date"
                    className={styles.inputField}
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={submittingExp}
                  className={styles.btnSubmit}
                >
                  {submittingExp ? 'Logging...' : 'Log Cost Item'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* COST TRANSACTION LOG HISTORY */}
      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <span>Transaction Cost Log History</span>
        </div>
        <div className={styles.cardBody} style={{ padding: 0 }}>
          {expenses.length === 0 ? (
            <div className={styles.emptyState}>No cost transactions logged for this project yet.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Cost Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.incurred_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={styles.badgeCategory}>{exp.category}</span>
                      </td>
                      <td>
                        <span className={exp.type === 'committed' ? styles.badgeCommitted : styles.badgeActual}>
                          {exp.type === 'committed' ? 'Committed' : 'Actual'}
                        </span>
                      </td>
                      <td>{exp.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(exp.amount)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className={styles.actionBtnDelete}
                          onClick={() => handleDeleteExpense(exp.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
