import { useState, useEffect } from 'react';
import { getCSATAnalyticsReport } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import styles from './CSATReportPage.module.css';

export default function CSATReportPage() {
  usePageTitle('Client Satisfaction (CSAT)');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Client Satisfaction' }]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSegmentTab, setActiveSegmentTab] = useState('trends'); // 'trends' | 'type' | 'team' | 'city'
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'pm' | 'designer'

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
    return <div className={stars.length ? styles.starsWrapper : styles.noStars}>{stars} <span className={styles.ratingNum}>{rating.toFixed(1)}</span></div>;
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
    
    let matchesRole = true;
    if (roleFilter === 'pm') {
      matchesRole = !!f.pmName;
    } else if (roleFilter === 'designer') {
      matchesRole = !!f.designerName;
    }
    
    return matchesSearch && matchesScore && matchesRole;
  });

  // KPI Calculations
  const totalFeedbacks = feedbacks.length || 1;
  const positiveFeedbacks = feedbacks.filter(f => f.score >= 4).length;
  const positiveRate = ((positiveFeedbacks / totalFeedbacks) * 100).toFixed(0);
  const withComments = feedbacks.filter(f => f.comments && f.comments.trim().length > 0).length;
  const commentsRate = ((withComments / totalFeedbacks) * 100).toFixed(0);

  // Calculate percentages for distribution bars
  const totalDistribution = Object.values(summary.distribution || {}).reduce((a, b) => a + b, 0) || 1;

  // Custom tooltips for Recharts
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const labelName = dataPoint.month || dataPoint.projectType || dataPoint.city || dataPoint.name;
      return (
        <div className={styles.chartTooltip}>
          <div className={styles.tooltipTitle}>{labelName}</div>
          <div className={styles.tooltipValue}>
            <span>CSAT Rating:</span>
            <strong>{dataPoint.avgScore.toFixed(2)} ★</strong>
          </div>
          <div className={styles.tooltipSub}>
            Based on {dataPoint.count} surveys
          </div>
        </div>
      );
    }
    return null;
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh CSAT
        </button>
      </div>

      {/* Search and Filters at the Top */}
      <div className={styles.controlsRow} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search comments, clients, or projects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
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

          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Role:</span>
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Roles</option>
              <option value="pm">Has Project Manager</option>
              <option value="designer">Has Designer</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Overall CSAT</span>
            <span className={styles.kpiIcon} style={{ color: 'var(--color-accent)' }}>★</span>
          </div>
          <div className={styles.kpiValue}>{(summary.avgScore || 0).toFixed(2)} <span className={styles.kpiValueMax}>/ 5</span></div>
          <div className={styles.kpiStars}>{renderStars(summary.avgScore || 0)}</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Responses</span>
            <span className={styles.kpiIcon} style={{ color: 'var(--color-info)' }}>🗎</span>
          </div>
          <div className={styles.kpiValue}>{summary.totalSurveys || 0}</div>
          <div className={styles.kpiSub}>Completed client surveys</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Positive Sentiment</span>
            <span className={styles.kpiIcon} style={{ color: 'var(--color-success)' }}>🗠</span>
          </div>
          <div className={styles.kpiValue}>{positiveRate}%</div>
          <div className={styles.kpiSub}>Ratings scoring 4 or 5 stars</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Response Comments</span>
            <span className={styles.kpiIcon} style={{ color: 'var(--color-warning)' }}>💬</span>
          </div>
          <div className={styles.kpiValue}>{commentsRate}%</div>
          <div className={styles.kpiSub}>Written feedback provided</div>
        </div>
      </div>

      {/* Main Grid: Distribution & Segment Chart */}
      <div className={styles.mainGrid}>
        {/* Rating Distribution */}
        <div className={styles.distributionCard}>
          <h3 className={styles.cardTitle}>Rating Distribution</h3>
          <p className={styles.cardSub}>Spread of score counts across all surveys</p>
          <div className={styles.distList}>
            {[5, 4, 3, 2, 1].map(score => {
              const count = (summary.distribution || {})[score] || 0;
              const pct = (count / totalDistribution) * 100;
              let barColor = 'var(--color-success)';
              if (score === 3) barColor = 'var(--color-warning)';
              if (score <= 2) barColor = 'var(--color-danger)';
              
              return (
                <div key={score} className={styles.distRow}>
                  <span className={styles.distStars}>{score} ★</span>
                  <div className={styles.distBarBg}>
                    <div 
                      className={styles.distBarFill} 
                      style={{ width: `${pct}%`, background: barColor }}
                    ></div>
                  </div>
                  <span className={styles.distCount}>{count} <small>({pct.toFixed(0)}%)</small></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts & Breakdowns Card */}
        <div className={styles.segmentCard}>
          <div className={styles.segmentCardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Analytical Breakdown</h3>
              <p className={styles.cardSub}>Explore client satisfaction across different segments</p>
            </div>
            <div className={styles.segmentTabs}>
              <button 
                className={`${styles.segmentTabBtn} ${activeSegmentTab === 'trends' ? styles.segmentTabActive : ''}`}
                onClick={() => setActiveSegmentTab('trends')}
              >
                Trends
              </button>
              <button 
                className={`${styles.segmentTabBtn} ${activeSegmentTab === 'type' ? styles.segmentTabActive : ''}`}
                onClick={() => setActiveSegmentTab('type')}
              >
                Project Type
              </button>
              <button 
                className={`${styles.segmentTabBtn} ${activeSegmentTab === 'city' ? styles.segmentTabActive : ''}`}
                onClick={() => setActiveSegmentTab('city')}
              >
                City
              </button>
              <button 
                className={`${styles.segmentTabBtn} ${activeSegmentTab === 'team' ? styles.segmentTabActive : ''}`}
                onClick={() => setActiveSegmentTab('team')}
              >
                Team Members
              </button>
            </div>
          </div>

          <div className={styles.chartContainer}>
            {activeSegmentTab === 'trends' && (
              trends.length === 0 ? (
                <div className={styles.emptySegments}>No trend data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCSAT" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <YAxis domain={[1, 5]} stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area type="monotone" dataKey="avgScore" name="CSAT" stroke="var(--color-accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCSAT)" />
                  </AreaChart>
                </ResponsiveContainer>
              )
            )}

            {activeSegmentTab === 'type' && (
              byProjectType.length === 0 ? (
                <div className={styles.emptySegments}>No project type data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byProjectType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="projectType" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 5]} stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="avgScore" fill="#aa3bff" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}

            {activeSegmentTab === 'city' && (
              byCity.length === 0 ? (
                <div className={styles.emptySegments}>No city data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byCity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="city" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 5]} stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="avgScore" fill="var(--color-info)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}

            {activeSegmentTab === 'team' && (
              byTeamMember.length === 0 ? (
                <div className={styles.emptySegments}>No team member scorecard data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byTeamMember} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 5]} stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="avgScore" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>
      </div>


      {/* Client Feedback List Header */}
      <div className={styles.sectionHeader} style={{ marginTop: '0' }}>
        <h3 className={styles.sectionTitle}>Client Survey History</h3>
      </div>

      {/* Feedback Feed Block */}
      {filteredFeedbacks.length === 0 ? (
        <EmptyState 
          title="No client feedback matches filter criteria" 
          description="Adjust your rating filter, role filter, or search terms."
        />
      ) : (
        <div className={styles.feedbackGrid}>
          {filteredFeedbacks.map(f => (
            <div key={f.id} className={styles.feedbackCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h4 className={styles.projectTitle}>{f.projectName}</h4>
                  <span className={styles.clientName}>Client: {f.clientName}</span>
                </div>
                <div className={styles.ratingSection}>
                  <div className={styles.badgeLabel}>Rating: {f.score}★</div>
                  {renderStars(f.score)}
                  <span className={styles.feedbackDate}>{formatDate(f.createdAt)}</span>
                </div>
              </div>
              
              {f.comments ? (
                <div className={styles.commentsText}>"{f.comments}"</div>
              ) : (
                <div className={styles.noCommentsText}>No comments provided by client.</div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.footerItem}><strong>PM:</strong> {f.pmName || 'Unassigned'}</span>
                <span className={styles.footerItem}><strong>Designer:</strong> {f.designerName || 'Unassigned'}</span>
                <span className={styles.footerItem}><strong>Category:</strong> {f.referenceType}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
