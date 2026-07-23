const pool = require('../config/db')
const nodemailer = require('nodemailer')
const templates = require('../utils/emailTemplates')

// Initialize Ethereal Transporter
let transporter = null;
nodemailer.createTestAccount().then(account => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });
  console.log('[Email] Ethereal SMTP configured for testing.');
}).catch(err => {
  console.error('[Email] Failed to create Ethereal account', err);
});

/**
 * Queue an email to be sent asynchronously.
 */
async function queueEmail(tenantId, userId, toEmail, subject, templateName, templateData) {
  try {
    await pool.query(
      `INSERT INTO email_queue (tenant_id, user_id, recipient_email, subject, template_name, template_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, userId, toEmail, subject, templateName, JSON.stringify(templateData)]
    )
    console.log(`[Email Queue] Queued '${templateName}' for ${toEmail}`)
  } catch (error) {
    console.error(`[Email Queue] Failed to queue email:`, error)
  }
}

/**
 * Process a single email job.
 */
async function processEmailJob(job) {
  try {
    let htmlContent = '';
    
    // Check for DB override
    if (job.template_name === 'test_override' && job.template_data.htmlOverride) {
      htmlContent = job.template_data.htmlOverride;
    } else {
      const { rows } = await pool.query(
        'SELECT html_content FROM email_templates WHERE tenant_id=$1 AND template_key=$2 LIMIT 1',
        [job.tenant_id, job.template_name]
      );
      
      if (rows.length > 0) {
        htmlContent = rows[0].html_content;
      } else {
        htmlContent = templates[job.template_name] 
          ? templates[job.template_name](job.template_data)
          : `<p>Missing template: ${job.template_name}</p>`;
      }
    }

    // Replace variables if using DB or test string (hardcoded templates already do it via string templates)
    if ((job.template_name === 'test_override' || htmlContent !== templates[job.template_name]?.(job.template_data)) && job.template_data) {
      Object.keys(job.template_data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        htmlContent = htmlContent.replace(regex, job.template_data[key]);
      });
    }

    if (!transporter) {
      throw new Error("Transporter not initialized yet");
    }

    const info = await transporter.sendMail({
      from: '"CRM System" <no-reply@crm.local>',
      to: job.recipient_email,
      subject: job.subject,
      html: htmlContent
    })
    
    console.log(`\n=== 📧 EMAIL SENT to ${job.recipient_email} ===\nSubject: ${job.subject}\nTemplate: ${job.template_name}`)
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}\n===================================`)

    await pool.query(
      `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [job.id]
    )
  } catch (error) {
    const nextRetryCount = job.retry_count + 1
    const status = nextRetryCount >= 5 ? 'failed' : 'pending'
    const backoffMinutes = Math.pow(2, nextRetryCount) // 2, 4, 8, 16 mins
    
    await pool.query(
      `UPDATE email_queue 
       SET status = $1, error_message = $2, retry_count = $3, 
           next_retry_at = NOW() + interval '${backoffMinutes} minutes' 
       WHERE id = $4`,
      [status, error.message, nextRetryCount, job.id]
    )
    console.error(`[Email Queue] Failed to send email to ${job.recipient_email} (Retry ${nextRetryCount})`)
  }
}

/**
 * Background worker to poll the email_queue table.
 */
let workerInterval = null

function startWorker() {
  if (workerInterval) return
  console.log('[Email Queue] Worker started.')
  
  workerInterval = setInterval(async () => {
    try {
      // Fetch up to 10 pending emails that are due
      const { rows } = await pool.query(`
        SELECT * FROM email_queue 
        WHERE status = 'pending' AND next_retry_at <= NOW()
        ORDER BY created_at ASC
        LIMIT 10
      `)
      
      for (const job of rows) {
        await processEmailJob(job)
      }
    } catch (error) {
      console.error('[Email Queue] Worker error:', error)
    }
  }, 10000) // Poll every 10 seconds
}

function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
    console.log('[Email Queue] Worker stopped.')
  }
}

module.exports = {
  queueEmail,
  startWorker,
  stopWorker
}
