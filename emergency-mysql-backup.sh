#!/bin/bash
# Emergency MySQL Backup System
# Deploy within 24 hours to prevent data loss
# Created: November 13, 2025

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-ahmad-mysql-database}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-sg_sow_user}"
DB_PASSWORD="${DB_PASSWORD:-SG_sow_2025_SecurePass!}"
DB_NAME="${DB_NAME:-socialgarden_sow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-socialgarden-db-backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
LOG_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.log"

log_info "Starting MySQL backup process..."
log_info "Database: $DB_NAME"
log_info "Host: $DB_HOST:$DB_PORT"
log_info "Backup file: $BACKUP_FILE"

# Function to test database connectivity
test_connection() {
    log_info "Testing database connection..."
    if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
        log_info "✅ Database connection successful"
        return 0
    else
        log_error "❌ Database connection failed"
        return 1
    fi
}

# Function to create backup
create_backup() {
    log_info "Creating MySQL backup..."
    
    # Create backup with proper options
    mysqldump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --flush-logs \
        --hex-blob \
        --compress \
        --databases "$DB_NAME" > "$BACKUP_FILE" 2> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_info "✅ Backup created successfully: $BACKUP_FILE"
        return 0
    else
        log_error "❌ Backup failed. Check log: $LOG_FILE"
        return 1
    fi
}

# Function to verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Check file size (should be > 1KB)
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

# Function to upload backup to S3 (if configured)
upload_to_s3() {
    if [ -n "${S3_BUCKET:-}" ] && command -v aws &>/dev/null; then
        log_info "Uploading backup to S3: s3://$S3_BUCKET/"
        
        # Create S3 key with date structure
        S3_KEY="backups/$(date +%Y/%m/%d)/backup_${DB_NAME}_${TIMESTAMP}.sql"
        
        if aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$S3_KEY" --storage-class STANDARD_IA; then
            log_info "✅ Backup uploaded to S3 successfully"
            
            # Set appropriate S3 bucket lifecycle (if bucket policy allows)
            aws s3api put-object-tagging \
                --bucket "$S3_BUCKET" \
                --key "$S3_KEY" \
                --tagging 'TagSet=[{Key=backup-type,Value=mysql-full},{Key=retention-days,Value='$RETENTION_DAYS'}]' 2>/dev/null || true
            
            return 0
        else
            log_warn "⚠️ S3 upload failed (continuing with local backup)"
            return 1
        fi
    else
        log_info "S3 not configured or AWS CLI not available, skipping upload"
        return 0
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Clean local backups
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.log" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Clean S3 backups (if configured)
    if [ -n "${S3_BUCKET:-}" ] && command -v aws &>/dev/null; then
        cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "backups/" \
            --query "Contents[?LastModified<='$cutoff_date'][].Key" \
            --output text 2>/dev/null | tr '\t' '\n' | while read -r key; do
            [ -n "$key" ] && aws s3 rm "s3://$S3_BUCKET/$key" 2>/dev/null || true
        done
    fi
    
    log_info "✅ Old backups cleaned up"
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (configure with your SMTP settings)
    if command -v mail &>/dev/null && [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        echo "$message" | mail -s "[MySQL Backup] $status - $(hostname)" "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
    
    # Slack webhook notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"MySQL Backup $status: $(hostname)\n$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main execution
main() {
    log_info "🚀 Starting emergency MySQL backup process"
    
    # Test connection
    if ! test_connection; then
        log_error "❌ Cannot proceed without database connection"
        send_notification "FAILED" "Database connection failed for backup on $(hostname)"
        exit 1
    fi
    
    # Create backup
    if ! create_backup; then
        log_error "❌ Backup creation failed"
        send_notification "FAILED" "Backup creation failed on $(hostname). Check logs: $LOG_FILE"
        exit 1
    fi
    
    # Verify backup
    if ! verify_backup; then
        log_error "❌ Backup verification failed"
        send_notification "FAILED" "Backup verification failed on $(hostname)"
        exit 1
    fi
    
    # Upload to S3
    upload_to_s3
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Success notification
    send_notification "SUCCESS" "MySQL backup completed successfully on $(hostname)
Backup file: $BACKUP_FILE
Size: $(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null) bytes"
    
    log_info "🎉 MySQL backup process completed successfully!"
    log_info "Backup location: $BACKUP_FILE"
    log_info "Backup verification: PASSED"
    
    # Return backup file path for cron integration
    echo "$BACKUP_FILE"
}

# Handle script arguments
case "${1:-}" in
    --test)
        test_connection
        ;;
    --verify)
        verify_backup
        ;;
    --cleanup)
        cleanup_old_backups
        ;;
    *)
        main "$@"
        ;;
esac