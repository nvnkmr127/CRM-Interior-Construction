/**
 * Lightweight Email Template Engine
 * In production, these can be replaced with pug/ejs/handlebars or external providers (SendGrid templates).
 */

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>CRM Notification</h2>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated message from your CRM system. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = {
  member_added: (data) => baseTemplate(`
    <h3>Hello ${data.name},</h3>
    <p>You have been added as a Team Member to the CRM.</p>
    <p>Your profile is currently <strong>Pending Approval</strong> by an administrator. You will receive another email once your account is activated.</p>
  `),

  approval_request: (data) => baseTemplate(`
    <h3>Action Required: New Employee Approval</h3>
    <p>A new employee, <strong>${data.employeeName}</strong>, has been added and requires your approval.</p>
    <p>Please log in to the admin dashboard to review their details.</p>
  `),

  approval_granted: (data) => baseTemplate(`
    <h3>Account Approved</h3>
    <p>Hi ${data.name},</p>
    <p>Great news! Your CRM account has been approved by the administrator.</p>
  `),

  approval_rejected: (data) => baseTemplate(`
    <h3>Account Application Update</h3>
    <p>Hi ${data.name},</p>
    <p>We regret to inform you that your recent application to access the CRM has been rejected.</p>
    <p>Reason: ${data.reason || 'Not specified by administrator'}</p>
  `),

  welcome_email: (data) => baseTemplate(`
    <h3>Welcome to the Team, ${data.name}!</h3>
    <p>We are thrilled to have you on board as a <strong>${data.role}</strong>.</p>
    <p>If you have any questions, please reach out to your manager.</p>
  `),

  create_password: (data) => baseTemplate(`
    <h3>Set Up Your Account</h3>
    <p>Hi ${data.name},</p>
    <p>Your account is ready. Please click the link below to set up your password:</p>
    <a href="${data.setupUrl}" class="btn">Create Password</a>
    <p>Your temporary login is: <strong>${data.email}</strong></p>
  `),

  password_changed: (data) => baseTemplate(`
    <h3>Password Changed Successfully</h3>
    <p>Hi ${data.name},</p>
    <p>Your CRM account password was recently changed.</p>
    <p>If you did not make this change, please contact IT support immediately.</p>
  `),

  first_login: (data) => baseTemplate(`
    <h3>First Login Alert</h3>
    <p>Hi ${data.name},</p>
    <p>Welcome! We noticed this is your first time logging into the system.</p>
    <p>We recommend taking a moment to review your profile and update your contact information.</p>
  `),

  role_changed: (data) => baseTemplate(`
    <h3>Role Updated</h3>
    <p>Hi ${data.name},</p>
    <p>Your role in the CRM has been updated to <strong>${data.newRole}</strong>.</p>
    <p>This may change the modules and features you have access to.</p>
  `),

  permission_updated: (data) => baseTemplate(`
    <h3>Permissions Updated</h3>
    <p>Hi ${data.name},</p>
    <p>Your access permissions have been recently modified by an administrator.</p>
    <p>Please log out and log back in for the changes to take full effect.</p>
  `),

  password_reset: (data) => baseTemplate(`
    <h3>Password Reset Request</h3>
    <p>Hi ${data.name},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <a href="${data.resetUrl}" class="btn">Reset Password</a>
    <p>If you did not request this, you can safely ignore this email.</p>
  `),

  account_locked: (data) => baseTemplate(`
    <h3>Account Locked</h3>
    <p>Hi ${data.name},</p>
    <p>Your account has been locked. This usually happens due to too many failed login attempts.</p>
    <p>Please contact your system administrator to regain access.</p>
  `),

  account_activated: (data) => baseTemplate(`
    <h3>Account Activated</h3>
    <p>Hi ${data.name},</p>
    <p>Your CRM account is now <strong>Active</strong>.</p>
    <p>You can now log in and access your workspace.</p>
  `),

  account_deactivated: (data) => baseTemplate(`
    <h3>Account Deactivated</h3>
    <p>Hi ${data.name},</p>
    <p>Your CRM account has been deactivated by an administrator.</p>
    <p>You no longer have access to the system.</p>
  `),

  joining_reminder: (data) => baseTemplate(`
    <h3>Upcoming Joining Date</h3>
    <p>Hi ${data.name},</p>
    <p>We're looking forward to your first day on <strong>${data.joiningDate}</strong>!</p>
    <p>Please remember to bring any required documents requested during onboarding.</p>
  `),

  probation_completed: (data) => baseTemplate(`
    <h3>Congratulations on completing your probation!</h3>
    <p>Hi ${data.name},</p>
    <p>Your probationary period has officially concluded. We are incredibly happy with your performance and are glad to have you fully integrated into the team!</p>
  `),

  birthday: (data) => baseTemplate(`
    <h3>Happy Birthday! 🎂</h3>
    <p>Hi ${data.name},</p>
    <p>Wishing you a fantastic birthday and a great year ahead from everyone on the team!</p>
  `),

  work_anniversary: (data) => baseTemplate(`
    <h3>Happy Work Anniversary! 🎉</h3>
    <p>Hi ${data.name},</p>
    <p>Congratulations on reaching <strong>${data.years} year(s)</strong> with us! Thank you for your continued dedication and hard work.</p>
  `),

  security_alerts: (data) => baseTemplate(`
    <h3 style="color: #dc2626;">Security Alert</h3>
    <p>Hi ${data.name},</p>
    <p>We detected a new login to your account from an unrecognized device or location.</p>
    <p><strong>Device:</strong> ${data.deviceInfo}</p>
    <p><strong>Time:</strong> ${data.time}</p>
    <p>If this was you, you can ignore this email. If this wasn't you, please reset your password immediately.</p>
  `)
};
