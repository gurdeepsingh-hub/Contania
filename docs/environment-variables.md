# Environment Variables

This document lists all environment variables used in the Containa application.

## Required Variables

### Domain Configuration

```env
# Default domain for subdomain generation
# Used when constructing subdomain URLs
DEFAULT_HOST=containa.io
```

### Database

```env
# PostgreSQL connection string
DATABASE_URI=postgres://user:password@host:port/database
```

### Payload CMS

```env
# Secret key for Payload CMS (generate a random string)
PAYLOAD_SECRET=your-secret-key-here
```

## Optional Variables

### Application URLs

```env
# Public application URL (used in email templates)
NEXT_PUBLIC_APP_URL=https://containa.io
NEXT_PUBLIC_SERVER_URL=https://containa.io
```

### Email Configuration

```env
# Email sender address
EMAIL_FROM=noreply@containa.io
EMAIL_FROM_NAME=Containa

# SMTP configuration (if using custom SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

### EC2 Deployment (Documentation Only)

These variables are for reference/documentation purposes and don't need to be set in the application:

```env
# EC2 public IP (for DNS configuration reference)
EC2_PUBLIC_IP=your-ec2-public-ip

# Let's Encrypt email (for SSL certificate setup)
LETSENCRYPT_EMAIL=admin@containa.io
```

## Production Setup

For production deployment on EC2:

1. Set `DEFAULT_HOST=containa.io` in your `.env` file
2. Ensure `DATABASE_URI` points to your production database
3. Set a strong `PAYLOAD_SECRET` (use a random string generator)
4. Configure email settings if sending emails
5. Set `NEXT_PUBLIC_APP_URL` to your production domain

## Example .env File

```env
# Domain
DEFAULT_HOST=containa.io

# Database
DATABASE_URI=postgres://admin_containa:password@containa.ctesssq8oy6x.ap-southeast-2.rds.amazonaws.com/containa

# Payload
PAYLOAD_SECRET=your-random-secret-key-here-minimum-32-characters

# Application URLs
NEXT_PUBLIC_APP_URL=https://containa.io
NEXT_PUBLIC_SERVER_URL=https://containa.io

# Email
EMAIL_FROM=noreply@containa.io
```

## Security Notes

- Never commit `.env` files to version control
- Use strong, random values for `PAYLOAD_SECRET`
- Keep database credentials secure
- Rotate secrets regularly in production
