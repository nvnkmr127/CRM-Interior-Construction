const pool = require('../pool');
const { seedDefaultStages } = require('./defaultLeadStages');
const { hashPassword } = require('../../services/auth/password');

async function reseed() {
  try {
    const { rows:[tenant] } = await pool.query("SELECT id FROM tenants WHERE slug='demo'");
    if (!tenant) throw new Error('Demo tenant not found');
    const tenantId = tenant.id;

    console.log('Clearing old leads and stages...');
    await pool.query('DELETE FROM leads WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM lead_stages WHERE tenant_id = $1', [tenantId]);

    console.log('Seeding new stages...');
    await seedDefaultStages(tenantId);

    console.log('Running demo data script...');
    // Quick inline of demo data to ensure sequential execution and access
    // 1. Get/create roles
    const { rows:roles } = await pool.query("SELECT id,name FROM roles WHERE tenant_id=$1", [tenantId]);
    const roleMap = Object.fromEntries(roles.map(r=>[r.name,r.id]));

    // 2. Create team members
    const pwHash = await hashPassword('Demo@123');
    const users = [
      { name:'Priya Sharma',  email:'priya@demo.com',  role:'Project Manager' },
      { name:'Rahul Mehta',   email:'rahul@demo.com',  role:'Designer' },
      { name:'Ananya Reddy',  email:'ananya@demo.com', role:'Sales' },
    ];
    const userIds = {};
    for (const u of users) {
      const { rows:[existing] } = await pool.query("SELECT id FROM users WHERE email=$1 AND tenant_id=$2", [u.email,tenantId]);
      if (existing) { userIds[u.email] = existing.id; continue; }
      const { rows:[created] } = await pool.query(
        'INSERT INTO users (tenant_id,name,email,password_hash,role_id,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [tenantId, u.name, u.email, pwHash, roleMap[u.role]||roleMap['superadmin'], 'active']
      );
      userIds[u.email] = created.id;
    }

    // 3. Get stages
    const { rows:stages } = await pool.query("SELECT id,name FROM lead_stages WHERE tenant_id=$1 ORDER BY sort_order", [tenantId]);
    const stageMap = Object.fromEntries(stages.map(s=>[s.name,s.id]));

    // 4. Create leads (5 per stage)
    const leadData = [
      { name:'Rajesh Sharma',  phone:'9876543210', source:'referral',  stage:'Discovery Call',          score:75 },
      { name:'Meena Gupta',    phone:'9876543211', source:'facebook',  stage:'Site Visit Scheduling',   score:60 },
      { name:'Arun Kapoor',    phone:'9876543212', source:'indimart',  stage:'Lead Capture',            score:35 },
      { name:'Sunita Verma',   phone:'9876543213', source:'website',   stage:'Quotation',               score:80 },
      { name:'Vikram Nair',    phone:'9876543214', source:'referral',  stage:'Closing',                 score:90 },
      { name:'Deepa Iyer',     phone:'9876543215', source:'facebook',  stage:'First Contact',           score:45 },
      { name:'Kiran Reddy',    phone:'9876543216', source:'direct',    stage:'AI Budgeting',            score:65 },
      { name:'Ramesh Patel',   phone:'9876543217', source:'indimart',  stage:'AI Qualification',        score:20 },
      { name:'Anita Joshi',    phone:'9876543218', source:'referral',  stage:'Site Visit Conducted',    score:70 },
      { name:'Suresh Kumar',   phone:'9876543219', source:'website',   stage:'Negotiation',             score:30 },
    ];
    for (const l of leadData) {
      await pool.query(
        'INSERT INTO leads (tenant_id,name,phone,source,stage_id,score,assignee_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT DO NOTHING',
        [tenantId, l.name, l.phone, l.source, stageMap[l.stage]||stages[0]?.id, l.score, userIds['ananya@demo.com']]
      );
    }
    console.log('✓ Reseeded correctly');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reseed();
