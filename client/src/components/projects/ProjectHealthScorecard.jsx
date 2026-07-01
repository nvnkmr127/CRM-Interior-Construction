import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from './ProjectHealthScorecard.module.css';
import api from '../../../utils/api'; // Assuming standard api wrapper

const ProjectHealthScorecard = () => {
  const { id: projectId } = useParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/health`);
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching health reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const res = await api.post(`/projects/${projectId}/health/generate`);
      if (res.data.success) {
        setReports([res.data.data, ...reports]);
      }
    } catch (err) {
      console.error('Error generating health report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const getScoreClass = (score) => {
    if (score === 'Good') return styles.scoreGood;
    if (score === 'Fair') return styles.scoreFair;
    if (score === 'Poor') return styles.scorePoor;
    return styles.scoreNeutral;
  };

  if (loading) {
    return <div className={styles.loading}>Loading Health Scorecard...</div>;
  }

  const latestReport = reports[0];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Project Health Scorecard</h2>
        <button 
          className={styles.generateBtn} 
          onClick={handleGenerateReport} 
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate New Report'}
        </button>
      </div>

      {latestReport ? (
        <div className={styles.scorecard}>
          <div className={styles.scoreCardItem}>
            <h3>Overall Health</h3>
            <div className={`${styles.scoreBadge} ${getScoreClass(latestReport.overall_health)}`}>
              {latestReport.overall_health}
            </div>
          </div>
          <div className={styles.scoreCardItem}>
            <h3>Schedule</h3>
            <div className={`${styles.scoreBadge} ${getScoreClass(latestReport.schedule_score)}`}>
              {latestReport.schedule_score}
            </div>
          </div>
          <div className={styles.scoreCardItem}>
            <h3>Financial</h3>
            <div className={`${styles.scoreBadge} ${getScoreClass(latestReport.financial_score)}`}>
              {latestReport.financial_score}
            </div>
          </div>
          <div className={styles.scoreCardItem}>
            <h3>Quality (QC)</h3>
            <div className={`${styles.scoreBadge} ${getScoreClass(latestReport.qc_score)}`}>
              {latestReport.qc_score}
            </div>
          </div>
          <div className={styles.scoreCardItem}>
            <h3>Client</h3>
            <div className={`${styles.scoreBadge} ${getScoreClass(latestReport.client_score)}`}>
              {latestReport.client_score}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.noData}>No health reports generated yet.</div>
      )}

      {reports.length > 0 && (
        <div className={styles.historySection}>
          <h3>History</h3>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Overall</th>
                <th>Schedule</th>
                <th>Financial</th>
                <th>QC</th>
                <th>Client</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.report_date).toLocaleDateString()}</td>
                  <td><span className={`${styles.dot} ${getScoreClass(report.overall_health)}`}></span> {report.overall_health}</td>
                  <td><span className={`${styles.dot} ${getScoreClass(report.schedule_score)}`}></span> {report.schedule_score}</td>
                  <td><span className={`${styles.dot} ${getScoreClass(report.financial_score)}`}></span> {report.financial_score}</td>
                  <td><span className={`${styles.dot} ${getScoreClass(report.qc_score)}`}></span> {report.qc_score}</td>
                  <td><span className={`${styles.dot} ${getScoreClass(report.client_score)}`}></span> {report.client_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectHealthScorecard;
