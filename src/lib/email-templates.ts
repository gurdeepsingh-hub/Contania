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

