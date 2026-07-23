const cron = require('node-cron')
const pool = require('../config/db')
const { queueEmail } = require('./emailService')

/**
 * Daily jobs that check for date-based triggers:
 * - Birthday
 * - Work Anniversary
 * - Joining Reminder
 * - Probation Completed
 */
function startCronJobs() {
  console.log('[Cron Service] Starting daily checks...')
  
  // Run every day at 00:00 (Midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron Service] Running daily email trigger checks...')
    try {
      // We will need to query the profile_data JSONB to find matches for today
      // For PostgreSQL, checking MM-DD inside JSON is a bit complex, so we'll fetch active users and process in JS for simplicity.
      
      const { rows: users } = await pool.query(`
        SELECT id, tenant_id, name, email, profile_data, status, created_at 
        FROM users 
        WHERE status IN ('active', 'probation', 'onboarding')
      `)

      const today = new Date()
      const currentMonth = today.getMonth()
      const currentDay = today.getDate()

      for (const user of users) {
        if (!user.profile_data) continue
        
        const { dob, joiningDate, probationEndDate } = user.profile_data

        // 1. Birthday Check
        if (dob) {
          const dobDate = new Date(dob)
          if (dobDate.getMonth() === currentMonth && dobDate.getDate() === currentDay) {
            queueEmail(user.tenant_id, user.id, user.email, 'Happy Birthday! 🎂', 'birthday', { name: user.name })
          }
        }

        // 2. Joining Reminder (e.g., 3 days before)
        if (joiningDate && user.status === 'onboarding') {
          const joinDate = new Date(joiningDate)
          const diffDays = Math.ceil((joinDate - today) / (1000 * 60 * 60 * 24))
          if (diffDays === 3) {
            queueEmail(user.tenant_id, user.id, user.email, 'Upcoming Joining Date Reminder', 'joining_reminder', { name: user.name, joiningDate })
          }
        }

        // 3. Work Anniversary Check (Years > 0)
        if (joiningDate && user.status === 'active') {
          const joinDate = new Date(joiningDate)
          if (joinDate.getMonth() === currentMonth && joinDate.getDate() === currentDay && joinDate.getFullYear() < today.getFullYear()) {
            const years = today.getFullYear() - joinDate.getFullYear()
            queueEmail(user.tenant_id, user.id, user.email, 'Happy Work Anniversary! 🎉', 'work_anniversary', { name: user.name, years })
          }
        }

        // 4. Probation Completed Check (Today)
        if (probationEndDate && user.status === 'probation') {
          const probDate = new Date(probationEndDate)
          if (probDate.getMonth() === currentMonth && probDate.getDate() === currentDay && probDate.getFullYear() === today.getFullYear()) {
            queueEmail(user.tenant_id, user.id, user.email, 'Probation Completed!', 'probation_completed', { name: user.name })
            // Note: actual status change to 'active' would need to be done by admin or automatically.
          }
        }
      }
    } catch (error) {
      console.error('[Cron Service] Daily checks failed:', error)
    }
  })
}

module.exports = {
  startCronJobs
}
