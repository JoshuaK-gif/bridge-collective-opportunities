#!/bin/bash
# Postfix setup for Bridge Collective Opportunities VPS (Ubuntu 24.04)
# Run this on the VPS host (not inside Docker) as root or with sudo.
#
# Prerequisites:
# - Domain: bridgecollectiveopport.org (update if different)
# - DNS: Add A record for your VPS IP, then SPF record:
#     bridgecollectiveopport.org.  TXT  "v=spf1 mx ~all"
# - OCI: Port 25 is blocked by default. Open a support ticket at
#   https://support.oracle.com to request outbound port 25 unblocking.
#   Alternatively, use port 587 (submission) which is usually open.

set -euo pipefail

DOMAIN="${1:-bridgecollectiveopport.org}"
ADMIN_EMAIL="${2:-admin@$DOMAIN}"

echo "=== Installing Postfix ==="
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y postfix postfix-policyd-spf-python opendkim opendkim-tools

# Configure Postfix for Internet Site
debconf-set-selections <<< "postfix postfix/mailname string $DOMAIN"
debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"

echo "=== Configuring Postfix ==="
postconf -e "myhostname = $DOMAIN"
postconf -e "mydomain = $DOMAIN"
postconf -e "myorigin = \$mydomain"
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = ipv4"
postconf -e "mynetworks = 127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16"
postconf -e "home_mailbox = Maildir/"
postconf -e "smtpd_banner = \$myhostname ESMTP"

# Allow Docker containers to relay
postconf -e "smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination"

# Enable STARTTLS on submission port (587)
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem"
postconf -e "smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key"
postconf -e "smtp_tls_security_level = may"

# Enable submission port in master.cf
if ! grep -q "^submission" /etc/postfix/master.cf; then
  cat >> /etc/postfix/master.cf << EOF

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
EOF
fi

# Install SASL auth (for secure submission from remote)
DEBIAN_FRONTEND=noninteractive apt-get install -y sasl2-bin
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_sasl_type = cyrus"
postconf -e "smtpd_sasl_authenticated_header = no"
# Use sasldb for simple user/pass auth
echo "admin@$DOMAIN" | saslpasswd2 -c -p -u "$DOMAIN" -f /etc/sasldb2 admin
chmod 640 /etc/sasldb2
chown postfix:postfix /etc/sasldb2

echo "=== Setting up DKIM ==="
mkdir -p /etc/opendkim/keys/$DOMAIN
opendkim-genkey -D /etc/opendkim/keys/$DOMAIN/ -d $DOMAIN -s default
chown -R opendkim:opendkim /etc/opendkim/keys/$DOMAIN

cat > /etc/opendkim.conf << EOF
AutoRestart             Yes
AutoRestartRate         10/1h
UMask                   002
Syslog                  Yes
SyslogSuccess           Yes
LogWhy                  Yes
Canonicalization        relaxed/simple
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable
Mode                    sv
PidFile                 /var/run/opendkim/opendkim.pid
SignatureAlgorithm      rsa-sha256
UserID                  opendkim:opendkim
Socket                  inet:12301@localhost
EOF

echo "127.0.0.1" > /etc/opendkim/TrustedHosts
echo "localhost" >> /etc/opendkim/TrustedHosts
echo "$DOMAIN" >> /etc/opendkim/TrustedHosts

echo "default._domainkey.$DOMAIN $DOMAIN:default:/etc/opendkim/keys/$DOMAIN/default.private" > /etc/opendkim/KeyTable
echo "*@$DOMAIN default._domainkey.$DOMAIN" > /etc/opendkim/SigningTable

# Integrate OpenDKIM with Postfix
postconf -e "milter_protocol = 2"
postconf -e "milter_default_action = accept"
postconf -e "smtpd_milters = inet:localhost:12301"
postconf -e "non_smtpd_milters = inet:localhost:12301"

echo "=== Restarting services ==="
systemctl restart postfix
systemctl enable postfix
systemctl restart opendkim
systemctl enable opendkim

echo "=== UFW: allow SMTP ports ==="
ufw allow 25/tcp comment 'SMTP'
ufw allow 587/tcp comment 'SMTP Submission'

echo ""
echo "=== DONE ==="
echo ""
echo "Next steps:"
echo ""
echo "1. Add this DNS TXT record for SPF:"
echo "   $DOMAIN.  TXT  \"v=spf1 mx ~all\""
echo ""
echo "2. Add this DNS TXT record for DKIM (paste into your DNS provider):"
cat /etc/opendkim/keys/$DOMAIN/default.txt
echo ""
echo "3. Set a PTR (reverse DNS) record for your VPS IP to point to $DOMAIN"
echo ""
echo "4. Test with:"
echo "   echo 'Test from Postfix' | mail -s 'Postfix Test' $ADMIN_EMAIL"
echo ""
echo "5. In the app admin panel (Site Settings > SMTP), configure:"
echo "   Host: $(hostname -I | awk '{print $1}')"
echo "   Port: 587"
echo "   User: admin@$DOMAIN"
echo "   Pass: (leave blank - the app connects from the Docker network)"
echo "   From Name: Bridge Collective Opportunities"
echo "   From Email: noreply@$DOMAIN"
echo ""
echo "NOTE: If OCI blocks port 25, submit a support ticket at:"
echo "  https://support.oracle.com"
echo "  Request: 'Outbound port 25 unblocking for SMTP delivery'"
echo "  Include your VPS public IP."
