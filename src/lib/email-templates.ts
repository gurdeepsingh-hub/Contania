/**
 * Email templates for tenant-related notifications
 */

// Base responsive email template wrapper
const getEmailTemplate = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Contania</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      padding: 0;
      margin: 0;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-container {
      padding: 20px;
    }
    @media only screen and (min-width: 600px) {
      .email-container {
        padding: 40px;
      }
    }
    .header {
      background-color: #1a1a1a;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }
    .content {
      padding: 20px 0;
    }
    @media only screen and (min-width: 600px) {
      .content {
        padding: 30px 0;
      }
    }
    .content h2 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    @media only screen and (max-width: 600px) {
      .content h2 {
        font-size: 20px;
      }
    }
    .content h3 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #1a1a1a;
    }
    @media only screen and (max-width: 600px) {
      .content h3 {
        font-size: 16px;
      }
    }
    .content p {
      margin-bottom: 12px;
      font-size: 16px;
      line-height: 1.6;
    }
    @media only screen and (max-width: 600px) {
      .content p {
        font-size: 14px;
      }
    }
    .content ul {
      margin: 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
      font-size: 16px;
    }
    @media only screen and (max-width: 600px) {
      .content li {
        font-size: 14px;
      }
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #007bff;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    @media only screen and (max-width: 600px) {
      .info-box {
        padding: 12px;
        margin: 16px 0;
      }
    }
    .credentials-box {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 16px;
      margin: 20px 0;
    }
    @media only screen and (max-width: 600px) {
      .credentials-box {
        padding: 12px;
        margin: 16px 0;
      }
    }
    .credentials-box p {
      margin-bottom: 8px;
    }
    .credentials-box strong {
      display: inline-block;
      min-width: 100px;
      font-weight: 600;
    }
    @media only screen and (max-width: 600px) {
      .credentials-box strong {
        min-width: 80px;
        font-size: 13px;
      }
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #007bff;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      margin: 16px 0;
      text-align: center;
    }
    @media only screen and (max-width: 600px) {
      .button {
        display: block;
        padding: 14px 24px;
        margin: 20px 0;
      }
    }
    .button:hover {
      background-color: #0056b3;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
    }
    @media only screen and (max-width: 600px) {
      .footer {
        padding: 16px;
        font-size: 12px;
      }
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      color: #856404;
    }
    .success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      color: #155724;
    }
    .error {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <h1>Contania</h1>
    </div>
    <div class="email-container">
      <div class="content">
        ${content}
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from Contania. Please do not reply to this email.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} Contania. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`

export function getTenantRequestNotificationEmail(tenant: {
  companyName: string
  email: string
  phone?: string | null
  createdAt: string
}) {
  const content = `
    <h2>New Tenant Registration</h2>
    <p>A new tenant has submitted a registration request:</p>
    <div class="info-box">
      <ul style="list-style: none; padding-left: 0;">
        <li style="margin-bottom: 12px;"><strong>Company Name:</strong> ${tenant.companyName}</li>
        <li style="margin-bottom: 12px;"><strong>Email:</strong> ${tenant.email}</li>
        ${tenant.phone ? `<li style="margin-bottom: 12px;"><strong>Phone:</strong> ${tenant.phone}</li>` : ''}
        <li><strong>Submitted:</strong> ${new Date(tenant.createdAt).toLocaleString()}</li>
      </ul>
    </div>
    <p>Please review and approve/reject this tenant request in the admin dashboard.</p>
    <p style="margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/super-admin" class="button">View Dashboard</a>
    </p>
  `
  return {
    subject: `New Tenant Registration: ${tenant.companyName}`,
    html: getEmailTemplate(content),
  }
}

export function getTenantApprovalEmail(tenant: {
  companyName: string
  email: string
  subdomain: string
  loginEmail: string
  loginPassword: string
}) {
  const domain = process.env.DEFAULT_HOST || 'containa.io'
  const loginUrl = `https://${tenant.subdomain}.${domain}`

  const content = `
    <h2>Welcome to Contania!</h2>
    <p>Your tenant account for <strong>${tenant.companyName}</strong> has been approved.</p>
    
    <div class="info-box success">
      <h3 style="margin-top: 0;">Your Access Details</h3>
      <p style="margin-bottom: 8px;"><strong>Subdomain:</strong> ${tenant.subdomain}</p>
      <p style="margin-bottom: 0;"><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #007bff; word-break: break-all;">${loginUrl}</a></p>
    </div>
    
    <div class="credentials-box">
      <h3 style="margin-top: 0; margin-bottom: 12px;">Login Credentials</h3>
      <p style="margin-bottom: 8px;"><strong>Email:</strong> ${tenant.loginEmail}</p>
      <p style="margin-bottom: 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${tenant.loginPassword}</code></p>
    </div>
    
    <div class="info-box warning">
      <p style="margin: 0;"><strong>⚠️ Security Notice:</strong> Please change your password after first login for security.</p>
    </div>
    
    <p>You can now access your tenant dashboard and start using the platform.</p>
    
    <p style="margin-top: 20px;">
      <a href="${loginUrl}" class="button">Access Your Dashboard</a>
    </p>
    
    <p style="margin-top: 24px;">If you have any questions, please contact support.</p>
  `
  return {
    subject: `Your Tenant Account Has Been Approved - ${tenant.companyName}`,
    html: getEmailTemplate(content),
  }
}

export function getTenantRejectionEmail(tenant: {
  companyName: string
  email: string
  reason?: string
}) {
  const content = `
    <h2>Registration Update</h2>
    <p>Thank you for your interest in Contania.</p>
    <p>Unfortunately, your tenant registration for <strong>${tenant.companyName}</strong> has not been approved at this time.</p>
    
    ${
      tenant.reason
        ? `
      <div class="info-box error">
        <p style="margin: 0;"><strong>Reason:</strong> ${tenant.reason}</p>
      </div>
    `
        : ''
    }
    
    <p>If you believe this is an error or would like to resubmit your application, please contact our support team.</p>
    
    <p style="margin-top: 20px;">Thank you for your understanding.</p>
  `
  return {
    subject: `Tenant Registration Update - ${tenant.companyName}`,
    html: getEmailTemplate(content),
  }
}

export function getTenantUserWelcomeEmail(user: {
  fullName: string
  email: string
  password: string
  companyName: string
  subdomain: string
  userGroup?: string
}) {
  const domain = process.env.DEFAULT_HOST || 'containa.io'
  const loginUrl = `https://${user.subdomain}.${domain}`

  const content = `
    <h2>Welcome to Contania, ${user.fullName}!</h2>
    <p>You have been added as a user to <strong>${user.companyName}</strong> on the Contania platform.</p>
    
    ${
      user.userGroup
        ? `
      <div class="info-box">
        <p style="margin: 0;"><strong>Your Role:</strong> ${user.userGroup}</p>
      </div>
    `
        : ''
    }
    
    <div class="credentials-box">
      <h3 style="margin-top: 0; margin-bottom: 12px;">Your Login Credentials</h3>
      <p style="margin-bottom: 8px;"><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #007bff; word-break: break-all;">${loginUrl}</a></p>
      <p style="margin-bottom: 8px;"><strong>Email:</strong> ${user.email}</p>
      <p style="margin-bottom: 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${user.password}</code></p>
    </div>
    
    <div class="info-box warning">
      <p style="margin: 0;"><strong>⚠️ Security Notice:</strong> Please change your password after first login for security.</p>
    </div>
    
    <p>You can now access the tenant dashboard and start using the platform.</p>
    
    <p style="margin-top: 20px;">
      <a href="${loginUrl}" class="button">Access Dashboard</a>
    </p>
    
    <p style="margin-top: 24px;">If you have any questions, please contact your administrator.</p>
  `
  return {
    subject: `Welcome to ${user.companyName} - Your Contania Account`,
    html: getEmailTemplate(content),
  }
}

export function getTenantRevertEmail(tenant: {
  companyName: string
  email: string
  editLink: string
  reason?: string
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fullEditLink = tenant.editLink.startsWith('http')
    ? tenant.editLink
    : `${baseUrl}${tenant.editLink}`

  const content = `
    <h2>Action Required: Correction Needed</h2>
    <p>Dear ${tenant.companyName},</p>
    
    <p>We have reviewed your tenant registration request and need you to make some corrections before we can proceed with approval.</p>
    
    ${
      tenant.reason
        ? `
      <div class="info-box error">
        <h3 style="margin-top: 0; margin-bottom: 8px;">Corrections Required:</h3>
        <p style="margin: 0;">${tenant.reason}</p>
      </div>
    `
        : ''
    }
    
    <h3>Next Steps</h3>
    <p>Please click the button below to edit your tenant registration details:</p>
    
    <p style="margin-top: 20px;">
      <a href="${fullEditLink}" class="button">Edit Registration Details</a>
    </p>
    
    <p style="margin-top: 16px; word-break: break-all;">
      <strong>Or copy this link:</strong><br>
      <a href="${fullEditLink}" style="color: #007bff; word-break: break-all;">${fullEditLink}</a>
    </p>
    
    <div class="info-box warning">
      <p style="margin: 0;"><strong>⚠️ Important:</strong> This link will expire in 7 days. Please complete the corrections as soon as possible.</p>
    </div>
    
    <p>After you submit the corrected information, we will review your application again.</p>
    
    <p style="margin-top: 24px;">If you have any questions, please contact our support team.</p>
    
    <p>Thank you for your cooperation.</p>
  `
  return {
    subject: `Action Required: Please Correct Your Tenant Registration - ${tenant.companyName}`,
    html: getEmailTemplate(content),
  }
}
