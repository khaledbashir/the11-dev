#!/bin/bash
# Enterprise Database Security Hardening Script
# Implements enterprise-grade security measures for MySQL database
# Created: November 13, 2025

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-ahmad-mysql-database}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-socialgarden_sow}"

# Security configuration
SSL_CERT_PATH="/etc/mysql/ssl/client-cert.pem"
SSL_KEY_PATH="/etc/mysql/ssl/client-key.pem"
SSL_CA_PATH="/etc/mysql/ssl/ca-cert.pem"
AUDIT_LOG_PATH="/var/log/mysql/audit.log"
LOG_RETENTION_DAYS=90

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Generate secure passwords
generate_secure_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Test database connection
test_connection() {
    log_step "Testing database connection..."
    
    if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
        log_info "✅ Database connection successful"
        return 0
    else
        log_error "❌ Database connection failed"
        return 1
    fi
}

# Create SSL certificates
create_ssl_certificates() {
    log_step "Creating SSL certificates for encrypted connections..."
    
    # Create SSL directory
    mkdir -p /etc/mysql/ssl
    cd /etc/mysql/ssl
    
    # Generate CA certificate
    openssl genrsa -out ca-key.pem 2048
    openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days 3650 \
        -subj "/C=AU/ST=NSW/L=Sydney/O=Social Garden/CN=Social Garden CA"
    
    # Generate server certificate
    openssl genrsa -out server-key.pem 2048
    openssl req -new -key server-key.pem -out server-req.pem \
        -subj "/C=AU/ST=NSW/L=Sydney/O=Social Garden/CN=$DB_HOST"
    openssl x509 -req -in server-req.pem -CA ca-cert.pem -CAkey ca-key.pem -out server-cert.pem -days 3650
    
    # Generate client certificate
    openssl genrsa -out client-key.pem 2048
    openssl req -new -key client-key.pem -out client-req.pem \
        -subj "/C=AU/ST=NSW/L=Sydney/O=Social Garden/CN=Social Garden Client"
    openssl x509 -req -in client-req.pem -CA ca-cert.pem -CAkey ca-key.pem -out client-cert.pem -days 3650
    
    # Set proper permissions
    chmod 600 *.pem
    chmod 644 ca-cert.pem server-cert.pem client-cert.pem
    
    log_info "✅ SSL certificates created successfully"
}

# Secure MySQL installation
secure_mysql_installation() {
    log_step "Securing MySQL installation..."
    
    # Remove anonymous users
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;
EOF

    log_info "✅ MySQL installation secured"
}

# Create application-specific database users
create_application_users() {
    log_step "Creating application-specific database users..."
    
    # Application read/write user
    APP_READWRITE_PASSWORD=$(generate_secure_password)
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE USER IF NOT EXISTS 'app_readwrite'@'%' IDENTIFIED BY '$APP_READWRITE_PASSWORD' REQUIRE SSL;
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.* TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sows TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sow_activities TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sow_comments TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sow_acceptances TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sow_rejections TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.ai_conversations TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.service_catalog TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.sow_recommendations TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.folders TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.dashboard_conversations TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.dashboard_messages TO 'app_readwrite'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.user_preferences TO 'app_readwrite'@'%';
FLUSH PRIVILEGES;
EOF

    # Application read-only user
    APP_READONLY_PASSWORD=$(generate_secure_password)
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE USER IF NOT EXISTS 'app_readonly'@'%' IDENTIFIED BY '$APP_READONLY_PASSWORD' REQUIRE SSL;
GRANT SELECT ON $DB_NAME.* TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sows TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sow_activities TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sow_comments TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sow_acceptances TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sow_rejections TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.ai_conversations TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.service_catalog TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.sow_recommendations TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.folders TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.dashboard_conversations TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.dashboard_messages TO 'app_readonly'@'%';
GRANT SELECT ON $DB_NAME.user_preferences TO 'app_readonly'@'%';
FLUSH PRIVILEGES;
EOF

    # Backup user with restricted privileges
    BACKUP_PASSWORD=$(generate_secure_password)
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE USER IF NOT EXISTS 'backup_user'@'localhost' IDENTIFIED BY '$BACKUP_PASSWORD' REQUIRE SSL;
GRANT SELECT, RELOAD, LOCK TABLES, REPLICATION CLIENT ON *.* TO 'backup_user'@'localhost';
FLUSH PRIVILEGES;
EOF

    log_info "✅ Application users created with granular permissions"
    log_warn "⚠️ Store these passwords securely:"
    echo "APP_READWRITE_PASSWORD=$APP_READWRITE_PASSWORD"
    echo "APP_READONLY_PASSWORD=$APP_READONLY_PASSWORD" 
    echo "BACKUP_PASSWORD=$BACKUP_PASSWORD"
}

# Configure MySQL security settings
configure_security_settings() {
    log_step "Configuring MySQL security settings..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
-- Disable remote root access
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Set password policy
SET GLOBAL validate_password.policy = STRONG;
SET GLOBAL validate_password.length = 12;

-- Enable SSL requirements
ALTER USER 'app_readwrite'@'%' REQUIRE SSL;
ALTER USER 'app_readonly'@'%' REQUIRE SSL;

-- Set connection timeout
SET GLOBAL interactive_timeout = 28800;
SET GLOBAL wait_timeout = 28800;

-- Enable audit logging
INSTALL PLUGIN audit_log SONAME 'audit_log.so';
SET GLOBAL audit_log_policy = ALL;

-- Set binary logging for point-in-time recovery
SET GLOBAL log_bin = 'mysql-bin';
SET GLOBAL binlog_format = ROW;
SET GLOBAL binlog_row_image = FULL;

-- Enable slow query log
SET GLOBAL slow_query_log = 1;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL long_query_time = 2;

-- Set max connections
SET GLOBAL max_connections = 1000;
SET GLOBAL max_connect_errors = 100;

FLUSH PRIVILEGES;
EOF

    log_info "✅ Security settings configured"
}

# Configure firewall rules
configure_firewall() {
    log_step "Configuring firewall rules for database access..."
    
    # Allow database port from specific IPs only
    ALLOWED_IPS="${ALLOWED_IPS:-127.0.0.1,::1}"
    
    # Reset and configure UFW
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow MySQL from specific IPs only
    for ip in $(echo "$ALLOWED_IPS" | tr ',' ' '); do
        if [[ $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ $ip == "::1" ]]; then
            ufw allow from "$ip" to any port 3306
            log_info "✅ Allowed MySQL access from $ip"
        fi
    done
    
    # Enable firewall
    ufw --force enable
    
    log_info "✅ Firewall configured"
}

# Enable and configure audit logging
setup_audit_logging() {
    log_step "Setting up audit logging for security compliance..."
    
    # Create audit log directory
    mkdir -p /var/log/mysql
    chown mysql:mysql /var/log/mysql
    
    # Configure audit log rotation
    cat > /etc/logrotate.d/mysql-audit <<EOF
/var/log/mysql/audit.log {
    daily
    rotate $LOG_RETENTION_DAYS
    compress
    delaycompress
    notifempty
    create 644 mysql mysql
    postrotate
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "FLUSH LOGS;"
    endscript
}
EOF

    log_info "✅ Audit logging configured"
}

# Create database monitoring user
create_monitoring_user() {
    log_step "Creating database monitoring user..."
    
    MONITOR_PASSWORD=$(generate_secure_password)
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE USER IF NOT EXISTS 'monitoring_user'@'%' IDENTIFIED BY '$MONITOR_PASSWORD' REQUIRE SSL;
GRANT PROCESS, SHOW DATABASES, SHOW VIEW, RELOAD, REPLICATION CLIENT ON *.* TO 'monitoring_user'@'%';
GRANT SELECT ON performance_schema.* TO 'monitoring_user'@'%';
GRANT SELECT ON information_schema.* TO 'monitoring_user'@'%';
FLUSH PRIVILEGES;
EOF

    log_info "✅ Monitoring user created"
    log_warn "⚠️ MONITOR_PASSWORD=$MONITOR_PASSWORD"
}

# Configure MySQL server settings
configure_mysql_server_settings() {
    log_step "Configuring MySQL server settings for security..."
    
    # Create MySQL configuration file
    cat > /etc/mysql/conf.d/security.cnf <<EOF
[mysqld]
# Security Settings
local-infile=0
skip-show-database
sql_mode=STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO

# Connection Security
max_connections=1000
max_connect_errors=100
bind-address=127.0.0.1

# SSL Configuration
ssl-ca=/etc/mysql/ssl/ca-cert.pem
ssl-cert=/etc/mysql/ssl/server-cert.pem
ssl-key=/etc/mysql/ssl/server-key.pem
require_secure_transport=ON

# Binary Logging for Recovery
log-bin=mysql-bin
binlog-format=ROW
expire_logs_days=7
max_binlog_size=100M
sync_binlog=1
innodb_flush_log_at_trx_commit=1

# Performance and Security
innodb_buffer_pool_size=1G
innodb_log_file_size=256M
innodb_flush_method=O_DIRECT
innodb_file_per_table=1

# Query Security
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2
log_queries_not_using_indexes=1

# Audit Logging
audit_log_policy=ALL
audit_log_file=/var/log/mysql/audit.log

# Network Security
max_allowed_packet=64M
interactive_timeout=28800
wait_timeout=28800

# MyISAM Security
skip-external-locking

# Network Timeouts
net_read_timeout=30
net_write_timeout=60
net_buffer_length=16K

# MySQL Error Log
log_error=/var/log/mysql/error.log

[client]
ssl-ca=/etc/mysql/ssl/ca-cert.pem
ssl-cert=/etc/mysql/ssl/client-cert.pem
ssl-key=/etc/mysql/ssl/client-key.pem
ssl-verify-server-cert=ON
EOF

    log_info "✅ MySQL server settings configured"
}

# Create environment file with secure credentials
create_secure_env_file() {
    log_step "Creating secure environment configuration file..."
    
    cat > /opt/socialgarden/database-secure.env <<EOF
# Secure Database Configuration
# Generated: $(date)
# WARNING: This file contains sensitive information

DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME

# Application Users (Use these in your application)
DB_READWRITE_USER=app_readwrite
DB_READWRITE_PASSWORD=$APP_READWRITE_PASSWORD

DB_READONLY_USER=app_readonly
DB_READONLY_PASSWORD=$APP_READONLY_PASSWORD

# Backup User (Use for automated backups)
DB_BACKUP_USER=backup_user
DB_BACKUP_PASSWORD=$BACKUP_PASSWORD

# Monitoring User (Use for monitoring systems)
DB_MONITOR_USER=monitoring_user
DB_MONITOR_PASSWORD=$MONITOR_PASSWORD

# SSL Configuration
DB_SSL_ENABLED=true
DB_SSL_CA_PATH=$SSL_CA_PATH
DB_SSL_CERT_PATH=$SSL_CERT_PATH
DB_SSL_KEY_PATH=$SSL_KEY_PATH

# Security Settings
DB_REQUIRE_SSL=true
DB_MAX_CONNECTIONS=1000
DB_CONNECTION_TIMEOUT=30

# Monitoring
DB_SLOW_QUERY_LOG_ENABLED=true
DB_AUDIT_LOG_ENABLED=true
DB_LOG_RETENTION_DAYS=$LOG_RETENTION_DAYS
EOF

    # Set restrictive permissions
    chmod 600 /opt/socialgarden/database-secure.env
    chown root:root /opt/socialgarden/database-secure.env
    
    log_info "✅ Secure environment file created: /opt/socialgarden/database-secure.env"
}

# Generate monitoring scripts
create_monitoring_scripts() {
    log_step "Creating database monitoring scripts..."
    
    mkdir -p /opt/socialgarden/scripts
    
    # Database health check script
    cat > /opt/socialgarden/scripts/db-health-check.sh <<'EOF'
#!/bin/bash
# Database Health Check Script
# Monitors MySQL database health and alerts on issues

DB_HOST="${DB_HOST:-ahmad-mysql-database}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_MONITOR_USER:-monitoring_user}"
DB_PASSWORD="${DB_MONITOR_PASSWORD:-}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@socialgarden.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
send_alert() {
    local message="$1"
    local severity="$2"
    
    echo "$(date): [$severity] $message" >> /var/log/db-health.log
    
    # Send email alert if configured
    if command -v mail &>/dev/null; then
        echo "$message" | mail -s "Database Health Alert - $severity" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Health checks
check_connection() {
    if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
        echo -e "${GREEN}[OK]${NC} Database connection: Healthy"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} Database connection: Failed"
        send_alert "Database connection failed" "CRITICAL"
        return 1
    fi
}

check_replication() {
    local replication_status=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW SLAVE STATUS\G" 2>/dev/null | grep "Seconds_Behind_Master" | awk '{print $2}')
    
    if [ -n "$replication_status" ]; then
        if [ "$replication_status" -lt 300 ]; then  # Less than 5 minutes behind
            echo -e "${GREEN}[OK]${NC} Replication lag: ${replication_status}s"
        else
            echo -e "${YELLOW}[WARN]${NC} Replication lag: ${replication_status}s"
            send_alert "Replication lag is high: ${replication_status}s" "WARNING"
        fi
    else
        echo -e "${YELLOW}[INFO]${NC} Replication: Not configured"
    fi
}

check_disk_space() {
    local disk_usage=$(df /var/lib/mysql | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt 80 ]; then
        echo -e "${GREEN}[OK]${NC} Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        echo -e "${YELLOW}[WARN]${NC} Disk usage: ${disk_usage}%"
        send_alert "Disk usage is high: ${disk_usage}%" "WARNING"
    else
        echo -e "${RED}[FAIL]${NC} Disk usage: ${disk_usage}%"
        send_alert "Disk usage is critical: ${disk_usage}%" "CRITICAL"
    fi
}

check_slow_queries() {
    local slow_count=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW GLOBAL STATUS LIKE 'Slow_queries'" | tail -1 | awk '{print $2}')
    
    if [ "$slow_count" -gt 100 ]; then
        echo -e "${YELLOW}[WARN]${NC} Slow queries: $slow_count"
        send_alert "High number of slow queries detected: $slow_count" "WARNING"
    else
        echo -e "${GREEN}[OK]${NC} Slow queries: $slow_count"
    fi
}

# Main execution
main() {
    echo "Database Health Check - $(date)"
    echo "================================"
    
    check_connection
    check_replication
    check_disk_space
    check_slow_queries
    
    echo "================================"
}

main "$@"
EOF

    chmod +x /opt/socialgarden/scripts/db-health-check.sh
    
    # Database backup verification script
    cat > /opt/socialgarden/scripts/db-backup-verify.sh <<'EOF'
#!/bin/bash
# Database Backup Verification Script
# Verifies backup integrity and sends alerts

DB_HOST="${DB_HOST:-ahmad-mysql-database}"
DB_PORT="${DB_PORT:-3306}"
BACKUP_USER="${DB_BACKUP_USER:-backup_user}"
BACKUP_PASSWORD="${DB_BACKUP_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@socialgarden.com}"

verify_latest_backup() {
    local latest_backup=$(find "$BACKUP_DIR" -name "backup_*.sql" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -z "$latest_backup" ]; then
        echo "ERROR: No backups found in $BACKUP_DIR"
        return 1
    fi
    
    echo "Verifying backup: $(basename "$latest_backup")"
    
    # Check file size
    local size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null)
    if [ "$size" -lt 1024 ]; then
        echo "ERROR: Backup file too small ($size bytes)"
        return 1
    fi
    
    # Verify backup integrity
    if head -n 10 "$latest_backup" | grep -q "CREATE DATABASE\|USE"; then
        echo "✅ Backup file format is valid"
    else
        echo "ERROR: Backup file format is invalid"
        return 1
    fi
    
    # Test restore to temporary database
    local test_db="backup_test_$(date +%s)"
    if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$BACKUP_USER" -p"$BACKUP_PASSWORD" -e "CREATE DATABASE $test_db" 2>/dev/null; then
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$BACKUP_USER" -p"$BACKUP_PASSWORD" "$test_db" < "$latest_backup" 2>/dev/null; then
            echo "✅ Backup restoration test successful"
            mysql -h "$DB_HOST" -P "$DB_PORT" -u "$BACKUP_USER" -p"$BACKUP_PASSWORD" -e "DROP DATABASE $test_db" 2>/dev/null
        else
            echo "ERROR: Backup restoration test failed"
            mysql -h "$DB_HOST" -P "$DB_PORT" -u "$BACKUP_USER" -p"$BACKUP_PASSWORD" -e "DROP DATABASE IF EXISTS $test_db" 2>/dev/null
            return 1
        fi
    else
        echo "ERROR: Could not create test database"
        return 1
    fi
    
    return 0
}

main() {
    echo "Database Backup Verification - $(date)"
    echo "====================================="
    
    if verify_latest_backup; then
        echo "✅ Backup verification PASSED"
        exit 0
    else
        echo "❌ Backup verification FAILED"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x /opt/socialgarden/scripts/db-backup-verify.sh
    
    log_info "✅ Monitoring scripts created in /opt/socialgarden/scripts/"
}

# Create cron jobs for automation
setup_cron_jobs() {
    log_step "Setting up automated monitoring and maintenance..."
    
    # Add cron jobs (runs as root)
    cat > /etc/cron.d/socialgarden-database <<EOF
# Database monitoring and maintenance
# Generated: $(date)

# Health check every 5 minutes
*/5 * * * * root /opt/socialgarden/scripts/db-health-check.sh >> /var/log/db-health.log 2>&1

# Backup verification daily at 2 AM
0 2 * * * root /opt/socialgarden/scripts/db-backup-verify.sh

# Weekly backup (daily at 1 AM)
0 1 * * * root /opt/socialgarden/emergency-mysql-backup.sh

# Monthly security audit
0 3 1 * * root /opt/socialgarden/scripts/db-security-audit.sh

# Log rotation daily at midnight
0 0 * * * root /usr/sbin/logrotate /etc/logrotate.conf
EOF

    # Restart cron to load new jobs
    systemctl restart cron || service cron restart
    
    log_info "✅ Cron jobs configured for automated monitoring"
}

# Final security checklist
print_security_checklist() {
    echo ""
    echo "==============================================="
    echo "🔒 DATABASE SECURITY HARDENING COMPLETE"
    echo "==============================================="
    echo ""
    echo "✅ SSL certificates created and configured"
    echo "✅ Application users created with granular permissions"
    echo "✅ MySQL security settings hardened"
    echo "✅ Firewall rules configured"
    echo "✅ Audit logging enabled"
    echo "✅ Monitoring and backup scripts created"
    echo "✅ Automated cron jobs configured"
    echo ""
    echo "🔐 SECURITY CHECKLIST:"
    echo "  □ Store secure password file in safe location"
    echo "  □ Update application configuration to use new users"
    echo "  □ Configure SSL in application code"
    echo "  □ Test all connections with new users"
    echo "  □ Update monitoring systems with monitoring user"
    echo "  □ Review and update firewall rules as needed"
    echo ""
    echo "📁 IMPORTANT FILES:"
    echo "  Secure env: /opt/socialgarden/database-secure.env"
    echo "  Health check: /opt/socialgarden/scripts/db-health-check.sh"
    echo "  Backup verify: /opt/socialgarden/scripts/db-backup-verify.sh"
    echo "  MySQL config: /etc/mysql/conf.d/security.cnf"
    echo ""
    echo "🔄 NEXT STEPS:"
    echo "  1. Update your application to use app_readwrite user"
    echo "  2. Test SSL connections to database"
    echo "  3. Configure backup verification alerts"
    echo "  4. Review audit logs regularly"
    echo "  5. Update firewall rules for production IPs"
    echo ""
    echo "==============================================="
}

# Main execution
main() {
    log_info "🚀 Starting Enterprise Database Security Hardening"
    
    check_root
    
    # Test database connection first
    if ! test_connection; then
        log_error "❌ Cannot proceed without database connection"
        exit 1
    fi
    
    # Create secure directory
    mkdir -p /opt/socialgarden
    
    # Run security hardening steps
    create_ssl_certificates
    secure_mysql_installation
    create_application_users
    configure_security_settings
    configure_firewall
    setup_audit_logging
    create_monitoring_user
    configure_mysql_server_settings
    create_secure_env_file
    create_monitoring_scripts
    setup_cron_jobs
    
    print_security_checklist
    
    log_info "🎉 Database security hardening completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --test-connection)
        test_connection
        ;;
    --create-ssl)
        create_ssl_certificates
        ;;
    --create-users)
        create_application_users
        ;;
    *)
        main "$@"
        ;;
esac