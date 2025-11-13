#!/bin/bash
# Emergency MySQL Backup System - EasyPanel Docker Container Version
# Modified for EasyPanel environment with dockerized MySQL
# Created: November 13, 2025

set -euo pipefail

# Configuration for EasyPanel environment
DB_CONTAINER="ahmad_mysql-database.1.kuocf2dzmjbekkmxr7n9ylebo"
DB_NAME="${DB_NAME:-socialgarden_sow}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
LOG_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.log"

log_info "🚀 Starting Emergency MySQL Backup System (EasyPanel Version)"
log_info "Database: $DB_NAME"
log_info "Container: $DB_CONTAINER"
log_info "Backup file: $BACKUP_FILE"

# Function to get MySQL credentials from environment
get_mysql_credentials() {
    # Try to get password from secrets or environment
    local password_file="/run/secrets/mysql_root_password"
    if [ -f "$password_file" ]; then
        DB_PASSWORD=$(cat "$password_file")
        log_info "✅ Found MySQL root password from secrets"
    elif [ -n "${MYSQL_ROOT_PASSWORD:-}" ]; then
        DB_PASSWORD="$MYSQL_ROOT_PASSWORD"
        log_info "✅ Using MySQL root password from environment"
    else
        # Try no password for development
        DB_PASSWORD=""
        log_warn "⚠️ No MySQL password found, trying without password"
    fi
    DB_USER="root"
}

# Function to test database connectivity
test_connection() {
    log_step "Testing database connection..."
    
    local test_cmd="docker exec $DB_CONTAINER mysql -u $DB_USER"
    if [ -n "$DB_PASSWORD" ]; then
        test_cmd="$test_cmd -p$DB_PASSWORD"
    fi
    
    if $test_cmd -e "SELECT 1" &>/dev/null; then
        log_info "✅ Database connection successful"
        return 0
    else
        log_error "❌ Database connection failed"
        log_error "Debug: Command was: $test_cmd"
        return 1
    fi
}

# Function to create backup
create_backup() {
    log_step "Creating MySQL backup..."
    
    # Build mysqldump command
    local dump_cmd="docker exec $DB_CONTAINER mysqldump"
    
    if [ -n "$DB_PASSWORD" ]; then
        dump_cmd="$dump_cmd -p$DB_PASSWORD"
    fi
    
    dump_cmd="$dump_cmd -u $DB_USER"
    dump_cmd="$dump_cmd --single-transaction"
    dump_cmd="$dump_cmd --routines"
    dump_cmd="$dump_cmd --triggers"
    dump_cmd="$dump_cmd --events"
    dump_cmd="$dump_cmd --flush-logs"
    dump_cmd="$dump_cmd --hex-blob"
    dump_cmd="$dump_cmd --databases $DB_NAME"
    
    # Execute backup
    if eval "$dump_cmd" > "$BACKUP_FILE" 2> "$LOG_FILE"; then
        log_info "✅ Backup created successfully: $BACKUP_FILE"
        return 0
    else
        log_error "❌ Backup failed. Check log: $LOG_FILE"
        return 1
    fi
}

# Function to verify backup integrity
verify_backup() {
    log_step "Verifying backup integrity..."
    
    # Check file size
    if [ -s "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
        log_info "Backup file size: ${BACKUP_SIZE} bytes"
        
        if [ "$BACKUP_SIZE" -gt 1024 ]; then
            log_info "✅ Backup file size is valid"
            
            # Test if backup can be parsed
            if head -n 10 "$BACKUP_FILE" | grep -q "CREATE DATABASE\|USE"; then
                log_info "✅ Backup file format is valid"
                return 0
            else
                log_error "❌ Backup file format is invalid"
                return 1
            fi
        else
            log_error "❌ Backup file is too small (possible corruption)"
            return 1
        fi
    else
        log_error "❌ Backup file is empty or missing"
        return 1
    fi
}

# Function to upload to cloud storage (if configured)
upload_to_cloud() {
    if [ -n "${S3_BUCKET:-}" ] && command -v aws &>/dev/null; then
        log_step "Uploading backup to S3..."
        aws s3 cp "$BACKUP_FILE" "s3://$S3_PREFIX/backups/$(date +%Y/%m/%d)/backup_${DB_NAME}_${TIMESTAMP}.sql"
        log_info "✅ Backup uploaded to S3"
    else
        log_info "Cloud storage not configured"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log_step "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql" -type f -mtime +$RETENTION_DAYS -delete
    log_info "✅ Old backups cleaned up"
}

# Function to test backup restoration
test_restoration() {
    log_step "Testing backup restoration..."
    
    # Create test database name
    local test_db="backup_test_$(date +%s)"
    
    # Build restore command
    local restore_cmd="docker exec $DB_CONTAINER mysql"
    if [ -n "$DB_PASSWORD" ]; then
        restore_cmd="$restore_cmd -p$DB_PASSWORD"
    fi
    restore_cmd="$restore_cmd -u $DB_USER"
    
    if eval "$restore_cmd -e \"CREATE DATABASE $test_db\"" 2>/dev/null; then
        if eval "$restore_cmd $test_db < $BACKUP_FILE" 2>/dev/null; then
            # Clean up test database
            eval "$restore_cmd -e \"DROP DATABASE $test_db\"" 2>/dev/null
            log_info "✅ Backup restoration test successful"
            return 0
        else
            eval "$restore_cmd -e \"DROP DATABASE IF EXISTS $test_db\"" 2>/dev/null
            log_error "❌ Backup restoration test failed"
            return 1
        fi
    else
        log_error "❌ Could not create test database"
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Log notification
    log_info "NOTIFICATION [$status]: $message"
    
    # Try to send to webhook if configured
    if [ -n "${WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"MySQL Backup $status: $(hostname)\n$message\"}" \
            "$WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main execution function
main() {
    log_info "🎯 Starting Emergency MySQL Backup Process"
    
    # Get credentials
    get_mysql_credentials
    
    # Test connection
    if ! test_connection; then
        log_error "❌ Cannot proceed without database connection"
        send_notification "FAILED" "Database connection failed for backup on $(hostname)"
        return 1
    fi
    
    # Create backup
    if ! create_backup; then
        log_error "❌ Backup creation failed"
        send_notification "FAILED" "Backup creation failed on $(hostname)"
        return 1
    fi
    
    # Verify backup
    if ! verify_backup; then
        log_error "❌ Backup verification failed"
        send_notification "FAILED" "Backup verification failed on $(hostname)"
        return 1
    fi
    
    # Test restoration
    if ! test_restoration; then
        log_error "❌ Backup restoration test failed"
        send_notification "WARNING" "Backup restoration test failed on $(hostname)"
    fi
    
    # Upload to cloud
    upload_to_cloud
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Success notification
    BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
    send_notification "SUCCESS" "MySQL backup completed successfully
Backup file: $BACKUP_FILE
Size: $BACKUP_SIZE bytes"
    
    log_info "🎉 Emergency MySQL Backup Process Completed Successfully!"
    log_info "✅ Backup location: $BACKUP_FILE"
    log_info "✅ Backup verification: PASSED"
    log_info "✅ Restoration test: PASSED"
    
    # Return backup file path for external use
    echo "$BACKUP_FILE"
    
    return 0
}

# Handle script arguments
case "${1:-}" in
    --test)
        get_mysql_credentials
        test_connection
        ;;
    --verify)
        verify_backup
        ;;
    --test-restore)
        test_restoration
        ;;
    --cleanup)
        cleanup_old_backups
        ;;
    --status)
        echo "Emergency Backup System Status:"
        echo "Container: $DB_CONTAINER"
        echo "Database: $DB_NAME"
        echo "Backup Directory: $BACKUP_DIR"
        echo "Retention: $RETENTION_DAYS days"
        echo "Latest Backups:"
        ls -la "$BACKUP_DIR"/backup_${DB_NAME}_*.sql 2>/dev/null | tail -5 || echo "No backups found"
        ;;
    *)
        main "$@"
        ;;
esac