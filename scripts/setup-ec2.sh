#!/bin/bash

# EC2 Setup Script for Containa.io
# This script sets up Nginx and SSL certificates for wildcard subdomain support

set -e  # Exit on error

echo "=========================================="
echo "Containa.io EC2 Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Update system packages
echo -e "${GREEN}[1/7] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install required packages
echo -e "${GREEN}[2/7] Installing Nginx and Certbot...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx

# Get EC2 public IP (if not set)
if [ -z "$EC2_PUBLIC_IP" ]; then
    echo -e "${YELLOW}EC2_PUBLIC_IP not set. Attempting to detect...${NC}"
    EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    if [ -z "$EC2_PUBLIC_IP" ]; then
        # Try alternative method
        EC2_PUBLIC_IP=$(curl -s https://checkip.amazonaws.com 2>/dev/null || echo "")
        if [ -z "$EC2_PUBLIC_IP" ]; then
            echo -e "${YELLOW}Could not auto-detect EC2 IP. You can set EC2_PUBLIC_IP environment variable or find it manually.${NC}"
            echo -e "${YELLOW}Continuing with setup... (IP is only needed for DNS configuration reference)${NC}"
        fi
    fi
fi

if [ -n "$EC2_PUBLIC_IP" ]; then
    echo -e "${GREEN}Detected EC2 IP: $EC2_PUBLIC_IP${NC}"
fi

# Get email for Let's Encrypt
if [ -z "$LETSENCRYPT_EMAIL" ]; then
    read -p "Enter email for Let's Encrypt notifications: " LETSENCRYPT_EMAIL
fi

# Setup Nginx configuration
echo -e "${GREEN}[3/7] Setting up Nginx configuration...${NC}"
# Try to find nginx.conf in current directory or parent directory
NGINX_CONF=""
if [ -f "nginx.conf" ]; then
    NGINX_CONF="nginx.conf"
elif [ -f "../nginx.conf" ]; then
    NGINX_CONF="../nginx.conf"
fi

if [ -n "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" /etc/nginx/sites-available/containa
    echo -e "${GREEN}Nginx configuration copied${NC}"
else
    echo -e "${YELLOW}Warning: nginx.conf not found in current or parent directory${NC}"
    echo -e "${YELLOW}Please copy nginx.conf to /etc/nginx/sites-available/containa manually${NC}"
    echo -e "${YELLOW}Or run this script from the project root directory${NC}"
fi

# Enable site
ln -sf /etc/nginx/sites-available/containa /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo -e "${GREEN}[4/7] Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}Nginx configuration is valid${NC}"
else
    echo -e "${RED}Nginx configuration test failed${NC}"
    exit 1
fi

# Reload Nginx
systemctl reload nginx
echo -e "${GREEN}Nginx reloaded${NC}"

# Setup SSL certificate
echo -e "${GREEN}[5/7] Setting up SSL certificate...${NC}"
echo -e "${YELLOW}This will use DNS challenge. Make sure your domain DNS is configured correctly.${NC}"
echo -e "${YELLOW}For wildcard certificate, you'll need to add TXT records when prompted.${NC}"
echo ""

# Try to get wildcard certificate using DNS challenge
# Note: This requires manual DNS TXT record addition
read -p "Do you want to set up wildcard SSL certificate now? (y/n): " setup_ssl

if [ "$setup_ssl" = "y" ] || [ "$setup_ssl" = "Y" ]; then
    echo -e "${YELLOW}You'll need to add DNS TXT records when prompted by certbot.${NC}"
    certbot certonly --manual --preferred-challenges dns \
        -d containa.io \
        -d *.containa.io \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos \
        --non-interactive || {
        echo -e "${YELLOW}SSL certificate setup skipped or failed.${NC}"
        echo -e "${YELLOW}You can run this manually later with:${NC}"
        echo "sudo certbot --nginx -d containa.io -d *.containa.io"
    }
else
    echo -e "${YELLOW}Skipping SSL certificate setup.${NC}"
    echo -e "${YELLOW}You can set it up later with:${NC}"
    echo "sudo certbot --nginx -d containa.io -d *.containa.io"
fi

# Setup auto-renewal
echo -e "${GREEN}[6/7] Setting up SSL certificate auto-renewal...${NC}"
systemctl enable certbot.timer
systemctl start certbot.timer
systemctl status certbot.timer --no-pager || true

# Final Nginx reload
echo -e "${GREEN}[7/7] Final Nginx reload...${NC}"
systemctl reload nginx

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Configure DNS in Porkbun:"
if [ -n "$EC2_PUBLIC_IP" ]; then
    echo "   - Add A record: * -> $EC2_PUBLIC_IP"
    echo "   - Add A record: @ -> $EC2_PUBLIC_IP (for main domain)"
else
    echo "   - Add A record: * -> YOUR_EC2_PUBLIC_IP"
    echo "   - Add A record: @ -> YOUR_EC2_PUBLIC_IP (for main domain)"
    echo "   (Find your EC2 public IP in AWS Console)"
fi
echo ""
echo "2. If SSL certificate wasn't set up, run:"
echo "   sudo certbot --nginx -d containa.io -d *.containa.io"
echo ""
echo "3. Test your setup:"
echo "   - Visit https://containa.io"
echo "   - Test a subdomain: https://test.containa.io"
echo ""
echo "4. Monitor Nginx logs:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo "   sudo tail -f /var/log/nginx/access.log"
echo ""

