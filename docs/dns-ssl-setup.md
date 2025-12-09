# DNS and SSL Setup Guide for Containa.io

This guide walks you through setting up wildcard DNS and SSL certificates for Containa.io on EC2.

## Prerequisites

- Domain `containa.io` purchased from Porkbun
- EC2 instance running Ubuntu/Debian
- EC2 public IP address
- SSH access to EC2 instance

## Step 1: Configure DNS in Porkbun

1. Log in to your Porkbun account
2. Navigate to **DNS** settings for `containa.io`
3. Add the following DNS records:

### Required DNS Records

| Type | Host | Answer               | TTL |
| ---- | ---- | -------------------- | --- |
| A    | @    | `YOUR_EC2_PUBLIC_IP` | 300 |
| A    | \*   | `YOUR_EC2_PUBLIC_IP` | 300 |

**Important Notes:**

- Replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 instance public IP
- The `@` record is for the main domain (`containa.io`)
- The `*` record is the wildcard that enables all subdomains (`*.containa.io`)
- TTL of 300 seconds (5 minutes) is recommended for faster propagation

### Example Configuration

If your EC2 IP is `54.123.45.67`, your DNS records should look like:

```
Type: A
Host: @
Answer: 54.123.45.67
TTL: 300

Type: A
Host: *
Answer: 54.123.45.67
TTL: 300
```

### Verify DNS Propagation

After adding the records, verify they're working:

```bash
# Check main domain
dig containa.io +short

# Check wildcard (should return same IP)
dig test.containa.io +short
dig anything.containa.io +short
```

Both commands should return your EC2 public IP address.

## Step 2: Setup EC2 Instance

### Option A: Using the Setup Script (Recommended)

1. Copy the setup script to your EC2 instance:

   ```bash
   scp scripts/setup-ec2.sh nginx.conf user@your-ec2-ip:/home/user/
   ```

2. SSH into your EC2 instance:

   ```bash
   ssh user@your-ec2-ip
   ```

3. Make the script executable and run it:

   ```bash
   chmod +x setup-ec2.sh
   sudo ./setup-ec2.sh
   ```

4. Follow the prompts:
   - Enter your email for Let's Encrypt notifications
   - Choose whether to set up SSL certificate immediately

### Option B: Manual Setup

#### 2.1 Install Required Packages

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

#### 2.2 Configure Nginx

1. Copy the Nginx configuration:

   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/containa
   ```

2. Enable the site:

   ```bash
   sudo ln -s /etc/nginx/sites-available/containa /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   ```

3. Test the configuration:

   ```bash
   sudo nginx -t
   ```

4. Reload Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

## Step 3: Obtain SSL Certificate

### Option A: Wildcard Certificate (Recommended)

A wildcard certificate covers both `containa.io` and `*.containa.io` (all subdomains).

#### Using DNS Challenge (Manual DNS TXT Records)

1. Run certbot with DNS challenge:

   ```bash
   sudo certbot certonly --manual --preferred-challenges dns \
     -d containa.io \
     -d *.containa.io \
     --email your-email@example.com \
     --agree-tos
   ```

2. When prompted, add the DNS TXT record to Porkbun:
   - Certbot will show you a TXT record like: `_acme-challenge.containa.io`
   - Add this TXT record in Porkbun DNS settings
   - Wait for DNS propagation (can take a few minutes)
   - Press Enter to continue

3. Certbot will verify and issue the certificate

#### Using HTTP Challenge (Simpler, but requires domain to point to EC2 first)

```bash
sudo certbot --nginx -d containa.io -d *.containa.io \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

**Note:** HTTP challenge works best if your DNS is already configured and pointing to EC2.

### Option B: Individual Certificates (Not Recommended)

If you prefer individual certificates for each subdomain, you'll need to:

1. Create DNS records for each subdomain manually
2. Obtain certificates individually
3. This defeats the purpose of wildcard DNS

## Step 4: Configure Auto-Renewal

Let's Encrypt certificates expire every 90 days. Set up auto-renewal:

```bash
# Enable certbot timer
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check status
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

Certbot will automatically renew certificates before they expire.

## Step 5: Verify Setup

### Test Main Domain

```bash
curl -I https://containa.io
```

Should return `200 OK` with SSL certificate.

### Test Wildcard Subdomain

```bash
curl -I https://test.containa.io
```

Should also return `200 OK` with the same SSL certificate.

### Check SSL Certificate

```bash
openssl s_client -connect containa.io:443 -servername containa.io < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Subject Alternative Name"
```

Should show both `containa.io` and `*.containa.io` in the Subject Alternative Name.

## Step 6: Environment Variables

Update your application `.env` file:

```env
# Domain Configuration
DEFAULT_HOST=containa.io

# EC2 Configuration (for reference/documentation)
EC2_PUBLIC_IP=your-ec2-public-ip

# Let's Encrypt Email (for reference)
LETSENCRYPT_EMAIL=your-email@example.com
```

## Troubleshooting

### DNS Not Resolving

1. **Check DNS propagation:**

   ```bash
   dig containa.io +short
   dig test.containa.io +short
   ```

2. **Wait for propagation:** DNS changes can take up to 48 hours, but usually propagate within minutes to hours.

3. **Clear DNS cache:**
   ```bash
   # On your local machine
   sudo dscacheutil -flushcache  # macOS
   ipconfig /flushdns            # Windows
   sudo systemd-resolve --flush-caches  # Linux
   ```

### SSL Certificate Issues

1. **Certificate not found:**
   - Verify certificate exists: `sudo ls -la /etc/letsencrypt/live/containa.io/`
   - Check Nginx config paths match certificate location

2. **Certificate expired:**
   - Renew manually: `sudo certbot renew`
   - Reload Nginx: `sudo systemctl reload nginx`

3. **Wildcard certificate not working:**
   - Verify certificate includes wildcard: `sudo openssl x509 -in /etc/letsencrypt/live/containa.io/fullchain.pem -text -noout | grep DNS`
   - Should show `*.containa.io` in the list

### Nginx Issues

1. **Configuration test fails:**

   ```bash
   sudo nginx -t
   ```

   Fix any errors shown in the output.

2. **Nginx not starting:**

   ```bash
   sudo systemctl status nginx
   sudo journalctl -u nginx -n 50
   ```

3. **502 Bad Gateway:**
   - Check if Next.js app is running on port 3000
   - Verify upstream configuration in Nginx config

### Subdomain Not Working

1. **Check middleware logs:**
   - Look for tenant validation errors
   - Verify tenant exists and is approved in database

2. **Test subdomain directly:**

   ```bash
   curl -H "Host: test.containa.io" http://localhost:3000
   ```

3. **Check Nginx access logs:**
   ```bash
   sudo tail -f /var/log/nginx/access.log
   ```

## Security Best Practices

1. **Keep certificates updated:** Auto-renewal is configured, but monitor it
2. **Monitor Nginx logs:** Check for suspicious activity
3. **Rate limiting:** Already configured in Nginx and middleware
4. **Security headers:** Configured in Nginx (X-Frame-Options, CSP, etc.)
5. **Regular updates:** Keep Nginx and Certbot updated

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Porkbun DNS Documentation](https://porkbun.com/knowledge-base/article/how-do-i-use-porkbuns-dns-interface)

## Support

If you encounter issues:

1. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Check application logs
3. Verify DNS propagation: `dig containa.io`
4. Test SSL certificate: `openssl s_client -connect containa.io:443`
