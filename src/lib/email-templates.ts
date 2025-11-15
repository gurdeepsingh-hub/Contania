/**
 * Email templates for tenant-related notifications
 */

export function getTenantRequestNotificationEmail(tenant: {
  companyName: string
  email: string
  phone?: string | null
  createdAt: string
}) {
  return {
    subject: `New Tenant Registration: ${tenant.companyName}`,
    html: `
      <h2>New Tenant Registration</h2>
      <p>A new tenant has submitted a registration request:</p>
      <ul>
        <li><strong>Company Name:</strong> ${tenant.companyName}</li>
        <li><strong>Email:</strong> ${tenant.email}</li>
        ${tenant.phone ? `<li><strong>Phone:</strong> ${tenant.phone}</li>` : ''}
        <li><strong>Submitted:</strong> ${new Date(tenant.createdAt).toLocaleString()}</li>
      </ul>
      <p>Please review and approve/reject this tenant request in the admin dashboard.</p>
    `,
  }
}

export function getTenantApprovalEmail(tenant: {
  companyName: string
  email: string
  subdomain: string
  loginEmail: string
  loginPassword: string
}) {
  return {
    subject: `Your Tenant Account Has Been Approved - ${tenant.companyName}`,
    html: `
      <h2>Welcome to Contania!</h2>
      <p>Your tenant account for <strong>${tenant.companyName}</strong> has been approved.</p>
      
      <h3>Your Access Details</h3>
      <p><strong>Subdomain:</strong> ${tenant.subdomain}</p>
      <p><strong>Login URL:</strong> https://${tenant.subdomain}</p>
      
      <h3>Login Credentials</h3>
      <p><strong>Email:</strong> ${tenant.loginEmail}</p>
      <p><strong>Password:</strong> ${tenant.loginPassword}</p>
      
      <p><em>Please change your password after first login for security.</em></p>
      
      <p>You can now access your tenant dashboard and start using the platform.</p>
      
      <p>If you have any questions, please contact support.</p>
    `,
  }
}

export function getTenantRejectionEmail(tenant: {
  companyName: string
  email: string
  reason?: string
}) {
  return {
    subject: `Tenant Registration Update - ${tenant.companyName}`,
    html: `
      <h2>Registration Update</h2>
      <p>Thank you for your interest in Contania.</p>
      <p>Unfortunately, your tenant registration for <strong>${tenant.companyName}</strong> has not been approved at this time.</p>
      
      ${tenant.reason ? `<p><strong>Reason:</strong> ${tenant.reason}</p>` : ''}
      
      <p>If you believe this is an error or would like to resubmit your application, please contact our support team.</p>
      
      <p>Thank you for your understanding.</p>
    `,
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
  return {
    subject: `Welcome to ${user.companyName} - Your Contania Account`,
    html: `
      <h2>Welcome to Contania, ${user.fullName}!</h2>
      <p>You have been added as a user to <strong>${user.companyName}</strong> on the Contania platform.</p>
      
      ${user.userGroup ? `<p><strong>Your Role:</strong> ${user.userGroup}</p>` : ''}
      
      <h3>Your Login Credentials</h3>
      <p><strong>Login URL:</strong> https://${user.subdomain}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Password:</strong> ${user.password}</p>
      
      <p><em>Please change your password after first login for security.</em></p>
      
      <p>You can now access the tenant dashboard and start using the platform.</p>
      
      <p>If you have any questions, please contact your administrator.</p>
    `,
  }
}

export function getTenantRevertEmail(tenant: {
  companyName: string
  email: string
  editLink: string
  reason?: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fullEditLink = editLink.startsWith('http') ? editLink : `${baseUrl}${editLink}`
  
  return {
    subject: `Action Required: Please Correct Your Tenant Registration - ${tenant.companyName}`,
    html: `
      <h2>Action Required: Correction Needed</h2>
      <p>Dear ${tenant.companyName},</p>
      
      <p>We have reviewed your tenant registration request and need you to make some corrections before we can proceed with approval.</p>
      
      ${tenant.reason ? `
        <h3>Corrections Required:</h3>
        <p>${tenant.reason}</p>
      ` : ''}
      
      <h3>Next Steps</h3>
      <p>Please click the link below to edit your tenant registration details:</p>
      <p><a href="${fullEditLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Edit Registration Details</a></p>
      
      <p><strong>Edit Link:</strong> <a href="${fullEditLink}">${fullEditLink}</a></p>
      
      <p><em>Note: This link will expire in 7 days. Please complete the corrections as soon as possible.</em></p>
      
      <p>After you submit the corrected information, we will review your application again.</p>
      
      <p>If you have any questions, please contact our support team.</p>
      
      <p>Thank you for your cooperation.</p>
    `,
  }
}

