import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LeadAnalyticsPage.module.css'
import { Select, Avatar, Badge, DataTable } from '../../components/ui'
import usePageTitle from '../../hooks/usePageTitle'
import useBreadcrumbs from '../../hooks/useBreadcrumbs'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PIE_COLOURS = ['#E8935A','#2D6A4F','#1A3A5C','#8B2020','#4A2040','#D97706']

export default function LeadAnalyticsPage() {
  usePageTitle('Lead Analytics')
  useBreadcrumbs([{label:'Analytics'},{label:'Leads'}])
  const navigate = useNavigate()

  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    setLoading(true)
    // Mock Fetch
    setTimeout(() => {
      setData({
        kpis: {
          total: { val: 145, trend: 12 },
          won: { val: 42, trend: 5 },
          convRate: { val: '28.9%', trend: 2.1 },
          avgScore: { val: 76, trend: -3 }
        },
        weeklyData: [
          { week: 'Week 1', created: 30, won: 8 },
          { week: 'Week 2', created: 35, won: 10 },
          { week: 'Week 3', created: 40, won: 12 },
          { week: 'Week 4', created: 40, won: 12 }
        ],
        funnelData: [
          { stage: 'New', count: 145, color: '#3B82F6' },
          { stage: 'Contacted', count: 110, color: '#8B5CF6' },
          { stage: 'Site Visit', count: 85, color: '#D946EF' },
          { stage: 'Quotation', count: 60, color: '#F59E0B' },
          { stage: 'Negotiation', count: 50, color: '#E8935A' },
          { stage: 'Won', count: 42, color: '#10B981' }
        ],
        sourceData: [
          { name: 'Facebook Ads', count: 65 },
          { name: 'Google Search', count: 45 },
          { name: 'Referral', count: 20 },
          { name: 'Walk-in', count: 10 },
          { name: 'Other', count: 5 }
        ],
        teamData: [
          { id: '1', user: { name: 'Priya Sharma' }, assigned: 60, won: 22, convRate: 36.6, avgScore: 82, lastActivity: '2 mins ago' },
          { id: '2', user: { name: 'Rahul Desai' }, assigned: 55, won: 15, convRate: 27.2, avgScore: 71, lastActivity: '1 hr ago' },
          { id: '3', user: { name: 'Amit Kumar' }, assigned: 30, won: 5, convRate: 16.6, avgScore: 65, lastActivity: '3 hrs ago' },
        ]
      })
      setLoading(false)
    }, 800)
  }, [dateRange])

  const renderTrend = (val) => {
    if (val > 0) return <span className={`${styles.kpiTrend} ${styles.trendUp}`}>↑ {val}% vs last period</span>
    if (val < 0) return <span className={`${styles.kpiTrend} ${styles.trendDown}`}>↓ {Math.abs(val)}% vs last period</span>
    return <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>— No change</span>
  }

  const renderConvRate = (val) => {
    let color = 'var(--color-danger)'
    if (val >= 30) color = 'var(--color-success)'
    else if (val >= 15) color = 'var(--color-warning)'
    return <span style={{color, fontWeight:600}}>{val}%</span>
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Lead Analytics</h1>
            <div className={styles.desc}>Track pipeline health and conversion metrics.</div>
          </div>
        </div>
        <div className={styles.kpiStrip}>
          <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
          <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
          <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
          <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        </div>
        <div className={styles.grid}>
          <div className={`${styles.skeleton} ${styles.skeletonChart} ${styles.fullWidth}`} />
          <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
          <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
        </div>
      </div>
    )
  }

  if (!data) return (
    <div className={styles.page}>
      <div className={styles.emptyState}>
        <div style={{fontSize: 48, marginBottom: 16}}>📉</div>
        <h2 style={{fontSize:'var(--text-xl)', color:'var(--color-text)', marginBottom:8}}>Not enough data for this period.</h2>
        <p>Lead analytics appear after at least 7 days of activity.</p>
      </div>
    </div>
  )

  const maxFunnelCount = Math.max(...data.funnelData.map(d => d.count))
  const totalSourceCount = data.sourceData.reduce((acc, d) => acc + d.count, 0)

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Lead Analytics</h1>
          <div className={styles.desc}>Track pipeline health and conversion metrics.</div>
        </div>
        <div>
          <Select 
            options={[
              {value:'7d',label:'Last 7 days'}, 
              {value:'30d',label:'Last 30 days'}, 
              {value:'90d',label:'Last 90 days'}, 
              {value:'year',label:'This Year'}, 
              {value:'custom',label:'Custom'}
            ]}
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Leads</div>
          <div className={styles.kpiValue}>{data.kpis.total.val}</div>
          {renderTrend(data.kpis.total.trend)}
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Won This Period</div>
          <div className={styles.kpiValue}>{data.kpis.won.val}</div>
          {renderTrend(data.kpis.won.trend)}
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Conversion Rate</div>
          <div className={styles.kpiValue}>{data.kpis.convRate.val}</div>
          {renderTrend(data.kpis.convRate.trend)}
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Avg Lead Score</div>
          <div className={styles.kpiValue}>{data.kpis.avgScore.val}</div>
          {renderTrend(data.kpis.avgScore.trend)}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.cardHeader}>Leads Over Time</div>
          <div style={{width:'100%', height:240}}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyData} margin={{top:10, right:30, left:0, bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="week" tick={{fontSize:12,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:12,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,boxShadow:'var(--shadow-md)'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize:12, paddingTop:16}} />
                <Area type="monotone" dataKey="created" stroke="#E8935A" fill="rgba(232,147,90,0.15)" strokeWidth={2} name="Leads Created" />
                <Area type="monotone" dataKey="won" stroke="#059669" fill="rgba(5,150,105,0.15)" strokeWidth={2} name="Won" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Pipeline Funnel</div>
          <div className={styles.funnelList}>
            {data.funnelData.map((d, i) => (
              <div key={i} className={styles.funnelRow} onClick={() => navigate(`/leads?stage=${d.stage}`)}>
                <div className={styles.funnelLabel}>{d.stage}</div>
                <div className={styles.funnelBarBg}>
                  <div className={styles.funnelBarFill} style={{width: `${(d.count / maxFunnelCount) * 100}%`, background: d.color}} />
                </div>
                <div className={styles.funnelCount}>{d.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Source Breakdown</div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
            <PieChart width={200} height={200}>
              <Pie data={data.sourceData} cx={100} cy={100} innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="count" stroke="none">
                {data.sourceData.map((entry, i) => <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,boxShadow:'var(--shadow-md)'}} />
            </PieChart>
          </div>
          <div className={styles.legend}>
            {data.sourceData.map((d, i) => (
              <div key={i} className={styles.legendRow}>
                <div className={styles.legendLabel}>
                  <div className={styles.legendDot} style={{background: PIE_COLOURS[i % PIE_COLOURS.length]}} />
                  {d.name}
                </div>
                <div>
                  <span className={styles.legendValue}>{d.count}</span>
                  <span className={styles.legendPercent}>({((d.count / totalSourceCount) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>Team Performance</div>
        <DataTable
          columns={[
            { id: 'user', label: 'Team Member', render: (row) => (
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <Avatar name={row.user.name} size="sm" />
                <span style={{fontWeight:500, color:'var(--color-text)'}}>{row.user.name}</span>
              </div>
            )},
            { id: 'assigned', label: 'Leads Assigned' },
            { id: 'won', label: 'Won' },
            { id: 'convRate', label: 'Conv. Rate', render: (row) => renderConvRate(row.convRate) },
            { id: 'avgScore', label: 'Avg Score', render: (row) => <Badge variant={row.avgScore > 80 ? 'success' : row.avgScore > 50 ? 'warning' : 'danger'}>{row.avgScore}</Badge> },
            { id: 'lastActivity', label: 'Last Activity' }
          ]}
          data={data.teamData.sort((a, b) => b.convRate - a.convRate)}
          keyField="id"
        />
      </div>
    </div>
  )
}
