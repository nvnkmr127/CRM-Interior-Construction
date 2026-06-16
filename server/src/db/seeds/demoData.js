const { pool } = require('../pool')
const { hashPassword } = require('../../services/auth/password')

async function seedDemoData() {
  console.log('Seeding demo data...')

  // Get demo tenant
  const { rows:[tenant] } = await pool.query("SELECT id FROM tenants WHERE slug='demo'")
  if (!tenant) { console.error('Demo tenant not found. Run migrations first.'); process.exit(1) }
  const tenantId = tenant.id

  // 1. Get/create roles
  const { rows:roles } = await pool.query("SELECT id,name FROM roles WHERE tenant_id=$1", [tenantId])
  const roleMap = Object.fromEntries(roles.map(r=>[r.name,r.id]))

  // 2. Create team members
  const pwHash = await hashPassword('Demo@123')
  const users = [
    { name:'Priya Sharma',  email:'priya@demo.com',  role:'Project Manager' },
    { name:'Rahul Mehta',   email:'rahul@demo.com',  role:'Designer' },
    { name:'Ananya Reddy',  email:'ananya@demo.com', role:'Sales' },
  ]
  const userIds = {}
  for (const u of users) {
    const { rows:[existing] } = await pool.query("SELECT id FROM users WHERE email=$1 AND tenant_id=$2", [u.email,tenantId])
    if (existing) { userIds[u.email] = existing.id; continue }
    const { rows:[created] } = await pool.query(
      'INSERT INTO users (tenant_id,name,email,password_hash,role_id,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [tenantId, u.name, u.email, pwHash, roleMap[u.role]||roleMap['superadmin'], 'active']
    )
    userIds[u.email] = created.id
  }
  console.log('✓ Team members created')

  // 3. Get stages
  const { rows:stages } = await pool.query("SELECT id,name FROM lead_stages WHERE tenant_id=$1 ORDER BY sort_order", [tenantId])
  const stageMap = Object.fromEntries(stages.map(s=>[s.name,s.id]))

  // 4. Create leads (5 per stage)
  const leadData = [
    { name:'Rajesh Sharma',  phone:'9876543210', source:'referral',  stage:'Qualified',          score:75 },
    { name:'Meena Gupta',    phone:'9876543211', source:'facebook',  stage:'Site Visit Scheduled',score:60 },
    { name:'Arun Kapoor',    phone:'9876543212', source:'indimart',  stage:'New',                score:35 },
    { name:'Sunita Verma',   phone:'9876543213', source:'website',   stage:'Proposal Sent',      score:80 },
    { name:'Vikram Nair',    phone:'9876543214', source:'referral',  stage:'Won',                score:90 },
    { name:'Deepa Iyer',     phone:'9876543215', source:'facebook',  stage:'Contacted',          score:45 },
    { name:'Kiran Reddy',    phone:'9876543216', source:'direct',    stage:'Qualified',          score:65 },
    { name:'Ramesh Patel',   phone:'9876543217', source:'indimart',  stage:'New',                score:20 },
    { name:'Anita Joshi',    phone:'9876543218', source:'referral',  stage:'Site Visit Scheduled',score:70 },
    { name:'Suresh Kumar',   phone:'9876543219', source:'website',   stage:'Lost',               score:30 },
  ]
  for (const l of leadData) {
    await pool.query(
      'INSERT INTO leads (tenant_id,name,phone,source,stage_id,score,assignee_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT DO NOTHING',
      [tenantId, l.name, l.phone, l.source, stageMap[l.stage]||stages[0]?.id, l.score, userIds['ananya@demo.com']]
    )
  }
  console.log('✓ Leads created')

  // 5. Create projects
  const projects = [
    { name:'Sharma 3BHK — Banjara Hills', client:'Rajesh Sharma', phone:'9876543210', type:'Full Interior', value:850000, pm:'priya@demo.com' },
    { name:'Gupta Modular Kitchen — Jubilee Hills', client:'Meena Gupta', phone:'9876543211', type:'Modular Kitchen', value:185000, pm:'priya@demo.com' },
    { name:'TechCorp Office — Hitech City', client:'TechCorp Ltd', phone:'9988776655', type:'Commercial', value:2200000, pm:'rahul@demo.com' },
    { name:'Kapoor Villa — Gachibowli', client:'Arun Kapoor', phone:'9876543212', type:'Full Interior', value:1200000, pm:'priya@demo.com' },
  ]
  const projectIds = []
  for (const p of projects) {
    const { rows:[proj] } = await pool.query(
      `INSERT INTO projects (tenant_id,name,client_name,client_phone,project_type,contract_value,pm_id,designer_id,status,start_date,target_date,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',NOW(),NOW()+INTERVAL '90 days',$7)
       ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId, p.name, p.client, p.phone, p.type, p.value, userIds[p.pm], userIds['rahul@demo.com']]
    )
    if (proj) projectIds.push(proj.id)
  }
  console.log('✓ Projects created')

  // 6. Create portal user for first project
  if (projectIds[0]) {
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id,project_id,name,phone) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [tenantId, projectIds[0], 'Rajesh Sharma', '9876543210']
    )
    console.log('✓ Portal user created: 9876543210 / project:', projects[0].name)
  }

  console.log('')
  console.log('=== DEMO DATA SEEDED SUCCESSFULLY ===')
  console.log('Login: admin@demo.com / Admin@123')
  console.log('Team:  priya@demo.com, rahul@demo.com, ananya@demo.com / Demo@123')
  console.log('Portal: phone 9876543210, slug demo, OTP in server console')
  console.log('=====================================')
  await pool.end()
}

seedDemoData().catch(e => { console.error(e); process.exit(1) })
