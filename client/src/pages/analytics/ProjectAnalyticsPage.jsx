import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './ProjectAnalyticsPage.module.css'
import { Select, Badge, DataTable, Avatar } from '../../components/ui'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const STATUS_COLORS = {
  active: '#2563EB',
  on_hold: '#D97706',
  completed: '#059669',
  cancelled: '#6B7280'
}

export default function ProjectAnalyticsPage() {
  usePageTitle('Project Analytics')
  useBreadcrumbs([{label:'Analytics'},{label:'Projects'}])

  const [dateRange, setDateRange] = useState('year')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    setLoading(true)
    // Mock Fetch
    setTimeout(() => {
      setData({
        kpis: {
          active: 24,
          completed: 12,
          revenue: 14500000, // 1.45 Cr
          avgDuration: 115 // days
        },
        revenueData: [
          { month: 'Jan', planned: 2000000, collected: 1800000, target: 2500000 },
          { month: 'Feb', planned: 2500000, collected: 2500000, target: 2500000 },
          { month: 'Mar', planned: 3000000, collected: 2100000, target: 2500000 },
          { month: 'Apr', planned: 1500000, collected: 1500000, target: 2500000 },
          { month: 'May', planned: 4000000, collected: 3800000, target: 3500000 },
          { month: 'Jun', planned: 3500000, collected: 2800000, target: 3500000 }
        ],
        statusData: [
          { name: 'Active', count: 24, id: 'active' },
          { name: 'On Hold', count: 4, id: 'on_hold' },
          { name: 'Completed', count: 12, id: 'completed' },
          { name: 'Cancelled', count: 2, id: 'cancelled' }
        ],
        taskData: [
          { id: '1', name: 'Sharma Residence 3BHK', pct: 92 },
          { id: '2', name: 'Reddy Villa Renovation', pct: 85 },
          { id: '3', name: 'TechCorp Office Fit-out', pct: 60 },
          { id: '4', name: 'Banjara Hills Apartment', pct: 45 },
          { id: '5', name: 'Kitchen Remodel - Gupta', pct: 30 },
          { id: '6', name: 'Jubilee Hills 4BHK', pct: 15 }
        ],
        delayedProjects: [
          { id: '101', name: 'TechCorp Office Fit-out', client: 'TechCorp Ltd', pm: { name: 'Priya Sharma' }, targetDate: '2026-06-01', overdue: 14, phase: 'Execution' },
          { id: '102', name: 'Banjara Hills Apartment', client: 'Anil Kumar', pm: { name: 'Rahul Desai' }, targetDate: '2026-06-10', overdue: 5, phase: 'Design' }
        ]
      })
      setLoading(false)
    }, 800)
  }, [dateRange])

  const formatRupees = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`
    return `₹${val}`
  }

  const getTaskBarColor = (pct) => {
    if (pct < 50) return '#DC2626' // Crimson
    if (pct < 80) return '#D97706' // Amber
    return '#059669' // Emerald
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Project Analytics</h1>
            <div className={styles.desc}>Monitor project health, delivery, and revenue.</div>
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

  const totalProjects = data.statusData.reduce((acc, d) => acc + d.count, 0)

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Project Analytics</h1>
          <div className={styles.desc}>Monitor project health, delivery, and revenue.</div>
        </div>
        <div>
          <Select 
            options={[
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
          <div className={styles.kpiLabel}>Active Projects</div>
          <div className={styles.kpiValue}>{data.kpis.active}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Completed This Period</div>
          <div className={styles.kpiValue}>{data.kpis.completed}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Revenue Collected</div>
          <div className={styles.kpiValue}>{formatRupees(data.kpis.revenue)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Avg Project Duration</div>
          <div className={styles.kpiValue}>{data.kpis.avgDuration} <span style={{fontSize:14, fontWeight:500, color:'var(--color-text-secondary)'}}>days</span></div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.cardHeader}>Monthly Revenue</div>
          <div style={{width:'100%', height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.revenueData} margin={{top:20, right:30, left:20, bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{fontSize:12,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatRupees} tick={{fontSize:12,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => formatRupees(value)} 
                  contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,boxShadow:'var(--shadow-md)'}} 
                />
                <Legend wrapperStyle={{paddingTop:20}} />
                <Bar dataKey="planned" fill="var(--color-border-strong)" name="Planned" radius={[4,4,0,0]} barSize={30} />
                <Bar dataKey="collected" fill="#E8935A" name="Collected" radius={[4,4,0,0]} barSize={30} />
                <Line type="monotone" dataKey="target" stroke="#059669" strokeDasharray="5 5" name="Target" strokeWidth={2} dot={{r: 4}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Project Status</div>
          <div className={styles.donutContainer}>
            <PieChart width={220} height={220}>
              <Pie data={data.statusData} cx={110} cy={110} innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="count" stroke="none">
                {data.statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.id]} />)}
              </Pie>
              <Tooltip contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,boxShadow:'var(--shadow-md)'}} />
            </PieChart>
            <div className={styles.donutCenterText}>
              <div className={styles.donutCenterVal}>{totalProjects}</div>
              <div className={styles.donutCenterLabel}>Total</div>
            </div>
          </div>
          <div className={styles.legend}>
            {data.statusData.map((d, i) => (
              <div key={i} className={styles.legendItem}>
                <div className={styles.legendDot} style={{background: STATUS_COLORS[d.id]}} />
                {d.name} ({d.count})
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Task Completion Rate (Active)</div>
          <div className={styles.taskList}>
            {data.taskData.sort((a,b) => a.pct - b.pct).slice(0, 8).map((task) => (
              <div key={task.id} className={styles.taskRow}>
                <div className={styles.taskName} title={task.name}>{task.name}</div>
                <div className={styles.taskBarBg}>
                  <div className={styles.taskBarFill} style={{width: `${task.pct}%`, background: getTaskBarColor(task.pct)}} />
                </div>
                <div className={styles.taskPct}>{task.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>Delayed Projects</div>
        {data.delayedProjects.length === 0 ? (
          <div style={{color:'var(--color-success)', padding: '32px 0', textAlign: 'center'}}>✓ No delayed projects. All on track!</div>
        ) : (
          <DataTable
            columns={[
              { id: 'name', label: 'Project' },
              { id: 'client', label: 'Client' },
              { id: 'pm', label: 'PM', render: (row) => (
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <Avatar name={row.pm.name} size="xs" />
                  <span>{row.pm.name}</span>
                </div>
              )},
              { id: 'targetDate', label: 'Target Date', render: (row) => new Date(row.targetDate).toLocaleDateString() },
              { id: 'overdue', label: 'Days Overdue', render: (row) => <Badge variant="danger">{row.overdue} days</Badge> },
              { id: 'phase', label: 'Current Phase' },
              { id: 'actions', label: 'Actions', render: (row) => <Link to={`/projects/${row.id}`} style={{color:'var(--color-accent)', textDecoration:'none', fontWeight:500, fontSize:14}}>View Project →</Link> }
            ]}
            data={data.delayedProjects.sort((a, b) => b.overdue - a.overdue)}
            keyField="id"
          />
        )}
      </div>
    </div>
  )
}
