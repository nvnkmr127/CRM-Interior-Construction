/* eslint-disable react-hooks/immutability, no-useless-assignment, no-unused-vars */
import { useState, useEffect } from 'react';
import { getCSATAnalyticsReport } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './CSATReportPage.module.css';

export default function CSATReportPage() {
  usePageTitle('Client Satisfaction');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Client Satisfaction' }]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSegmentTab, setActiveSegmentTab] = useState('trends'); // 'trends' | 'type' | 'team' | 'city'
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getCSATAnalyticsReport();
      setData(res || null);
    } catch (error) {
      console.error('Failed to load CSAT report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading CSAT analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState 
        title="Failed to load CSAT report" 
        description="There was an error loading the client satisfaction survey data."
      />
    );
  }

  const { summary = {}, trends = [], byProjectType = [], byTeamMember = [], byCity = [], feedbacks = [] } = data;

  const renderStars = (rating) => {
    if (!rating || rating === 0) return <span className={styles.noStars}>No ratings</span>;
    const stars = [];
    const floor = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= floor) {
        stars.push(<span key={i} className={styles.starFilled}>★</span>);
      } else if (i - rating < 1) {
        stars.push(<span key={i} className={styles.starHalf}>★</span>);
      } else {
        stars.push(<span key={i} className={styles.starEmpty}>★</span>);
      }
    }
    return <div className={styles.starsWrapper}>{stars} <span className={styles.ratingNum}>({rating.toFixed(1)})</span></div>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filter raw feedbacks list
  const filteredFeedbacks = feedbacks.filter(f => {
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch = 
      f.projectName?.toLowerCase().includes(term) ||
      f.clientName?.toLowerCase().includes(term) ||
      (f.comments && f.comments.toLowerCase().includes(term));
      
    const matchesScore = scoreFilter === 'all' || f.score === parseInt(scoreFilter, 10);
    return matchesSearch && matchesScore;
  });

  // Calculate percentages for distribution bars
  const totalDistribution = Object.values(summary.distribution || {}).reduce((a, b) => a + b, 0) || 1;

  // Max value for trends/projects bar chart
  let activeSegmentsList = [];
  if (activeSegmentTab === 'trends') activeSegmentsList = trends;
  else if (activeSegmentTab === 'type') activeSegmentsList = byProjectType;
  else if (activeSegmentTab === 'city') activeSegmentsList = byCity;
  else activeSegmentsList = byTeamMember;

  const maxVal = activeSegmentsList.reduce((max, s) => s.avgScore > max ? s.avgScore : max, 0) || 5;

  const getScoreColorClass = (score) => {
    if (score >= 4.5) return styles.goodScore;
    if (score >= 3.5) return styles.avgScore;
    return styles.poorScore;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Client Satisfaction (CSAT) Report</h1>
          <div className={styles.desc}>
            Monitor customer survey ratings, feedback trends, project breakdowns, and team satisfaction scores.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport}>
          🔄 Refresh CSAT
        </button>
      </div>

      {/* Overview Block */}
      <div className={styles.overviewGrid}>
        {/* Score Card */}
        <div className={styles.scoreCard}>
          <span className={styles.scoreTitle}>Overall CSAT Score</span>
          <span className={styles.scoreNumber}>{(summary.avgScore || 0).toFixed(2)}</span>
          <div className={styles.scoreStars}>
            {renderStars(summary.avgScore || 0)}
          </div>
          <span className={styles.scoreCount}>Based on {summary.totalSurveys || 0} client responses</span>
        </div>

        {/* Distribution Bars */}
        <div className={styles.distributionCard}>
          <h4 className={styles.distTitle}>Rating Distribution</h4>
          <div className={styles.distList}>
            {[5, 4, 3, 2, 1].map(score => {
              const count = (summary.distribution || {})[score] || 0;
              const pct = (count / totalDistribution) * 100;
              return (
                <div key={score} className={styles.distRow}>
                  <span className={styles.distStars}>{score} ★</span>
                  <div className={styles.distBarBg}>
                    <div 
                      className={styles.distBarFill} 
                      style={{ width: `${pct}%`, background: score >= 4 ? '#10b981' : score >= 3 ? '#fbbf24' : '#ef4444' }}
                    ></div>
                  </div>
                  <span className={styles.distCount}>{count} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Segment Breakdown Tab Header */}
      <div className={styles.segmentCard}>
        <div className={styles.segmentTabs}>
          <button 
            className={`${styles.segmentTabBtn} ${activeSegmentTab === 'trends' ? styles.segmentTabActive : ''}`}
            onClick={() => setActiveSegmentTab('trends')}
          >
            CSAT Trends by Month
          </button>
          <button 
            className={`${styles.segmentTabBtn} ${activeSegmentTab === 'type' ? styles.segmentTabActive : ''}`}
            onClick={() => setActiveSegmentTab('type')}
          >
            By Project Type
          </button>
          <button 
            className={`${styles.segmentTabBtn} ${activeSegmentTab === 'city' ? styles.segmentTabActive : ''}`}
            onClick={() => setActiveSegmentTab('city')}
          >
            By City
          </button>
          <button 
            className={`${styles.segmentTabBtn} ${activeSegmentTab === 'team' ? styles.segmentTabActive : ''}`}
            onClick={() => setActiveSegmentTab('team')}
          >
            Team Member Scorecard
          </button>
        </div>

        {activeSegmentsList.length === 0 ? (
          <div className={styles.emptySegments}>No classification data available.</div>
        ) : (
          <div className={styles.chartContainer}>
            <div className={styles.barList}>
              {activeSegmentsList.map((s, index) => {
                const labelName = s.month || s.projectType || s.city || s.name;
                const scorePct = (s.avgScore / 5) * 100; // score out of 5

                return (
                  <div key={index} className={styles.barCol}>
                    <div className={styles.barStack}>
                      <div 
                        className={`${styles.barFill} ${getScoreColorClass(s.avgScore)}`}
                        style={{ height: `${scorePct}%` }}
                      >
                        <span className={styles.tooltip}>
                          <strong>{labelName}</strong><br />
                          CSAT: {s.avgScore.toFixed(1)} / 5.0<br />
                          ({s.count} surveys)
                        </span>
                      </div>
                    </div>
                    <span className={styles.periodLabel}>{labelName}</span>
                    {s.roleName && <span className={styles.roleSub}>{s.roleName}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ledger Filtering Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search feedback comments, clients, or projects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterBox}>
          <span className={styles.filterLabel}>Score:</span>
          <select 
            value={scoreFilter} 
            onChange={(e) => setScoreFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars (Excellent)</option>
            <option value="4">4 Stars (Good)</option>
            <option value="3">3 Stars (Average)</option>
            <option value="2">2 Stars (Poor)</option>
            <option value="1">1 Star (Dissatisfied)</option>
          </select>
        </div>
      </div>

      {/* Feedback Feed Block */}
      {filteredFeedbacks.length === 0 ? (
        <EmptyState 
          title="No client feedback matches filter criteria" 
          description="Adjust your rating filter or search terms."
        />
      ) : (
        <div className={styles.feedbackList}>
          {filteredFeedbacks.map(f => (
            <div key={f.id} className={styles.feedbackCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h4 className={styles.projectTitle}>{f.projectName}</h4>
                  <span className={styles.clientName}>Client: {f.clientName}</span>
                </div>
                <div className={styles.ratingSection}>
                  <div className={styles.badgeLabel}>Score: {f.score} / 5</div>
                  {renderStars(f.score)}
                  <span className={styles.feedbackDate}>{formatDate(f.createdAt)}</span>
                </div>
              </div>
              
              {f.comments ? (
                <p className={styles.commentsText}>"{f.comments}"</p>
              ) : (
                <p className={styles.noCommentsText}>No comments provided by client.</p>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.footerItem}><strong>PM:</strong> {f.pmName || 'Unassigned'}</span>
                <span className={styles.footerItem}><strong>Designer:</strong> {f.designerName || 'Unassigned'}</span>
                <span className={styles.footerItem}><strong>Trigger:</strong> {f.referenceType}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
