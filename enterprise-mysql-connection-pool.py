#!/usr/bin/env python3
"""
Enterprise MySQL Connection Pool Manager
Replaces direct MySQL connections with secure, pooled connections
Created: November 13, 2025
"""

import os
import asyncio
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from contextlib import asynccontextmanager
import aiomysql
from cryptography.fernet import Fernet
import ssl

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DatabaseConfig:
    """Secure database configuration with encryption support"""
    host: str
    port: int
    user: str
    password: str
    database: str
    min_connections: int = 5
    max_connections: int = 20
    connection_timeout: int = 30
    idle_timeout: int = 300
    enable_ssl: bool = True
    ssl_ca_path: Optional[str] = None
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None

class EncryptedConfig:
    """Handle encrypted configuration values"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        self.fernet = None
        if encryption_key:
            self.fernet = Fernet(encryption_key.encode())
    
    def decrypt(self, encrypted_value: str) -> str:
        """Decrypt encrypted configuration value"""
        if self.fernet and encrypted_value.startswith('encrypted:'):
            encrypted_data = encrypted_value[10:]  # Remove 'encrypted:' prefix
            return self.fernet.decrypt(encrypted_data.encode()).decode()
        return encrypted_value

class EnterpriseMySQLPool:
    """Enterprise-grade MySQL connection pool with failover and monitoring"""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.pools: Dict[str, aiomysql.Pool] = {}
        self.encryption = EncryptedConfig()
        self.ssl_context = self._create_ssl_context() if config.enable_ssl else None
        self.health_check_interval = 30
        self._health_check_task = None
        self.connection_stats = {
            'total_connections': 0,
            'active_connections': 0,
            'failed_connections': 0,
            'query_count': 0,
            'error_count': 0,
            'avg_response_time': 0.0
        }
    
    def _create_ssl_context(self) -> ssl.SSLContext:
        """Create SSL context for encrypted connections"""
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        if self.config.ssl_ca_path:
            context.load_verify_locations(self.config.ssl_ca_path)
        
        if self.config.ssl_cert_path and self.config.ssl_key_path:
            context.load_cert_chain(self.config.ssl_cert_path, self.config.ssl_key_path)
        
        return context
    
    async def initialize_pools(self):
        """Initialize connection pools for all database hosts"""
        try:
            # Primary pool
            self.pools['primary'] = await self._create_pool(
                self.config.host, 
                self.config.port, 
                self.config.database
            )
            logger.info("✅ Primary database pool initialized")
            
            # Try to create read replica pools if available
            read_hosts = os.getenv('DB_READ_HOSTS', '').split(',')
            for i, host in enumerate(read_hosts):
                if host.strip():
                    try:
                        pool_name = f'replica_{i+1}'
                        self.pools[pool_name] = await self._create_pool(
                            host.strip(),
                            self.config.port,
                            self.config.database
                        )
                        logger.info(f"✅ Read replica pool {pool_name} initialized")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to initialize read replica {pool_name}: {e}")
            
            # Start health monitoring
            self._health_check_task = asyncio.create_task(self._health_monitor())
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize connection pools: {e}")
            raise
    
    async def _create_pool(self, host: str, port: int, database: str) -> aiomysql.Pool:
        """Create a connection pool for a specific host"""
        try:
            # Decrypt password if encrypted
            password = self.encryption.decrypt(self.config.password)
            
            pool = await aiomysql.create_pool(
                host=host,
                port=port,
                user=self.config.user,
                password=password,
                db=database,
                minsize=self.config.min_connections,
                maxsize=self.config.max_connections,
                pool_recycle=self.config.idle_timeout,
                connect_timeout=self.config.connection_timeout,
                echo=False,  # Set to True for SQL debugging
                ssl=self.ssl_context,
                autocommit=True
            )
            
            # Test connection
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
                    await cur.fetchone()
            
            logger.info(f"✅ Connection pool created for {host}:{port}")
            return pool
            
        except Exception as e:
            logger.error(f"❌ Failed to create connection pool for {host}:{port} - {e}")
            raise
    
    @asynccontextmanager
    async def get_connection(self, pool_type: str = 'primary', read_only: bool = False):
        """Get a connection from the appropriate pool with automatic failover"""
        start_time = asyncio.get_event_loop().time()
        pool_name = pool_type
        
        # Select appropriate pool based on read/write mode
        if read_only:
            if pool_type == 'primary':
                pool_name = self._get_read_pool()
            else:
                pool_name = pool_type
        
        # Try primary pool first, then failover
        pools_to_try = [pool_name] + [p for p in self.pools.keys() if p != pool_name]
        
        last_error = None
        for current_pool in pools_to_try:
            if current_pool not in self.pools:
                continue
            
            try:
                pool = self.pools[current_pool]
                self.connection_stats['total_connections'] += 1
                
                async with pool.acquire() as conn:
                    async with conn.cursor(aiomysql.DictCursor) as cur:
                        self.connection_stats['active_connections'] += 1
                        yield cur
                        
                # Record successful connection
                end_time = asyncio.get_event_loop().time()
                response_time = end_time - start_time
                self._update_response_time(response_time)
                self.connection_stats['query_count'] += 1
                
                return
                
            except Exception as e:
                last_error = e
                self.connection_stats['failed_connections'] += 1
                self.connection_stats['error_count'] += 1
                logger.error(f"❌ Connection failed for pool {current_pool}: {e}")
                
                # Mark failed pool as unhealthy
                await self._mark_pool_unhealthy(current_pool)
                
                continue
        
        # All pools failed
        logger.error("❌ All connection pools failed")
        raise last_error or Exception("No database connection available")
    
    def _get_read_pool(self) -> str:
        """Get the best read pool (load balanced)"""
        read_pools = [p for p in self.pools.keys() if p.startswith('replica_')]
        if read_pools:
            # Simple round-robin selection
            import random
            return random.choice(read_pools)
        return 'primary'
    
    async def _mark_pool_unhealthy(self, pool_name: str):
        """Mark a pool as unhealthy and attempt to recreate it"""
        try:
            logger.warning(f"⚠️ Marking pool {pool_name} as unhealthy")
            
            # Close the unhealthy pool
            if pool_name in self.pools:
                self.pools[pool_name].close()
                await self.pools[pool_name].wait_closed()
                del self.pools[pool_name]
            
            # Attempt to recreate after delay
            asyncio.create_task(self._recreate_pool(pool_name))
            
        except Exception as e:
            logger.error(f"❌ Error handling unhealthy pool {pool_name}: {e}")
    
    async def _recreate_pool(self, pool_name: str, delay: int = 30):
        """Recreate a failed connection pool"""
        await asyncio.sleep(delay)
        
        try:
            if pool_name.startswith('replica_'):
                read_hosts = os.getenv('DB_READ_HOSTS', '').split(',')
                try:
                    replica_index = int(pool_name.split('_')[1]) - 1
                    if 0 <= replica_index < len(read_hosts):
                        host = read_hosts[replica_index].strip()
                        if host:
                            self.pools[pool_name] = await self._create_pool(
                                host, self.config.port, self.config.database
                            )
                            logger.info(f"✅ Successfully recreated pool {pool_name}")
                except (ValueError, IndexError):
                    pass
            elif pool_name == 'primary':
                self.pools[pool_name] = await self._create_pool(
                    self.config.host, self.config.port, self.config.database
                )
                logger.info(f"✅ Successfully recreated primary pool")
                
        except Exception as e:
            logger.error(f"❌ Failed to recreate pool {pool_name}: {e}")
            # Try again later
            asyncio.create_task(self._recreate_pool(pool_name, delay * 2))
    
    async def _health_monitor(self):
        """Monitor connection pool health and performance"""
        while True:
            try:
                # Test all pools
                for pool_name, pool in self.pools.items():
                    try:
                        async with pool.acquire() as conn:
                            async with conn.cursor() as cur:
                                await cur.execute("SELECT 1")
                                await cur.fetchone()
                        # Reset failure count on success
                        if hasattr(pool, '_failures'):
                            pool._failures = 0
                    except Exception as e:
                        logger.warning(f"⚠️ Health check failed for pool {pool_name}: {e}")
                        
                # Log statistics
                await self._log_health_stats()
                
                await asyncio.sleep(self.health_check_interval)
                
            except Exception as e:
                logger.error(f"❌ Health monitor error: {e}")
                await asyncio.sleep(self.health_check_interval)
    
    async def _log_health_stats(self):
        """Log connection pool statistics"""
        stats = self.connection_stats.copy()
        stats['available_pools'] = len(self.pools)
        
        logger.info(f"📊 Connection Stats: {stats}")
        
        # Check for concerning patterns
        if stats['failed_connections'] > 10:
            logger.warning(f"⚠️ High connection failure rate: {stats['failed_connections']}")
        
        if stats['error_count'] > 50:
            logger.warning(f"⚠️ High query error rate: {stats['error_count']}")
    
    def _update_response_time(self, response_time: float):
        """Update average response time"""
        current_avg = self.connection_stats['avg_response_time']
        count = self.connection_stats['query_count']
        
        if count == 1:
            self.connection_stats['avg_response_time'] = response_time
        else:
            # Calculate running average
            self.connection_stats['avg_response_time'] = (
                (current_avg * (count - 1) + response_time) / count
            )
    
    async def execute_query(self, query: str, params: Optional[tuple] = None, 
                          read_only: bool = False, pool_type: str = 'primary') -> List[Dict[str, Any]]:
        """Execute a query with automatic connection management"""
        try:
            async with self.get_connection(pool_type, read_only) as cursor:
                await cursor.execute(query, params)
                if cursor.rowcount > 0:
                    return await cursor.fetchall()
                return []
        except Exception as e:
            logger.error(f"❌ Query execution failed: {e}")
            raise
    
    async def execute_transaction(self, queries: List[tuple]) -> bool:
        """Execute multiple queries as a transaction"""
        try:
            async with self.get_connection('primary') as cursor:
                # Begin transaction
                await cursor.execute("START TRANSACTION")
                
                try:
                    for query, params in queries:
                        await cursor.execute(query, params)
                    
                    # Commit transaction
                    await cursor.execute("COMMIT")
                    logger.info("✅ Transaction completed successfully")
                    return True
                    
                except Exception as e:
                    # Rollback on error
                    await cursor.execute("ROLLBACK")
                    logger.error(f"❌ Transaction rolled back: {e}")
                    raise
                    
        except Exception as e:
            logger.error(f"❌ Transaction execution failed: {e}")
            return False
    
    async def close_all_pools(self):
        """Close all connection pools"""
        if self._health_check_task:
            self._health_check_task.cancel()
        
        for pool_name, pool in self.pools.items():
            pool.close()
            await pool.wait_closed()
            logger.info(f"🔌 Closed pool: {pool_name}")
        
        self.pools.clear()
    
    async def get_pool_status(self) -> Dict[str, Any]:
        """Get detailed pool status information"""
        pool_info = {}
        
        for pool_name, pool in self.pools.items():
            pool_info[pool_name] = {
                'pool_size': pool.size,
                'pool_freesize': pool.freesize,
                'pool_maxsize': pool.maxsize,
                'pool_minsize': pool.minsize
            }
        
        return {
            'pools': pool_info,
            'statistics': self.connection_stats,
            'config': {
                'host': self.config.host,
                'port': self.config.port,
                'database': self.config.database,
                'enable_ssl': self.config.enable_ssl
            }
        }

# Global connection pool instance
db_pool: Optional[EnterpriseMySQLPool] = None

async def initialize_database_pool():
    """Initialize the global database connection pool"""
    global db_pool
    
    config = DatabaseConfig(
        host=os.getenv('DB_HOST', 'ahmad-mysql-database'),
        port=int(os.getenv('DB_PORT', '3306')),
        user=os.getenv('DB_USER', 'sg_sow_user'),
        password=os.getenv('DB_PASSWORD', 'SG_sow_2025_SecurePass!'),
        database=os.getenv('DB_NAME', 'socialgarden_sow'),
        min_connections=5,
        max_connections=20,
        connection_timeout=30,
        idle_timeout=300,
        enable_ssl=os.getenv('DB_SSL_ENABLED', 'true').lower() == 'true',
        ssl_ca_path=os.getenv('DB_SSL_CA_PATH'),
        ssl_cert_path=os.getenv('DB_SSL_CERT_PATH'),
        ssl_key_path=os.getenv('DB_SSL_KEY_PATH')
    )
    
    db_pool = EnterpriseMySQLPool(config)
    await db_pool.initialize_pools()
    
    logger.info("✅ Enterprise MySQL connection pool initialized")
    return db_pool

async def get_db_pool() -> EnterpriseMySQLPool:
    """Get the global database connection pool"""
    if db_pool is None:
        await initialize_database_pool()
    return db_pool

# Context managers for easy usage
@asynccontextmanager
async def get_db_connection(read_only: bool = False, pool_type: str = 'primary'):
    """Get a database connection using the global pool"""
    pool = await get_db_pool()
    async with pool.get_connection(pool_type, read_only) as cursor:
        yield cursor

# Decorator for automatic transaction handling
def transactional(read_only: bool = False, pool_type: str = 'primary'):
    """Decorator for automatic transaction handling"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            pool = await get_db_pool()
            try:
                async with pool.get_connection(pool_type, read_only) as cursor:
                    # Add cursor to function arguments
                    result = await func(cursor, *args, **kwargs)
                    return result
            except Exception as e:
                logger.error(f"❌ Transactional function failed: {e}")
                raise
        return wrapper
    return decorator

# Example usage
if __name__ == "__main__":
    async def example_usage():
        """Example of how to use the connection pool"""
        
        # Initialize pool
        await initialize_database_pool()
        
        # Simple query
        result = await db_pool.execute_query("SELECT * FROM sows LIMIT 5")
        print(f"Found {len(result)} SOWs")
        
        # Transaction example
        queries = [
            ("UPDATE sows SET updated_at = NOW() WHERE id = %s", ("sow-123",)),
            ("INSERT INTO sow_activities (sow_id, event_type, metadata) VALUES (%s, %s, %s)", 
             ("sow-123", "updated", "{}"))
        ]
        success = await db_pool.execute_transaction(queries)
        
        # Get pool status
        status = await db_pool.get_pool_status()
        print(f"Pool status: {status}")
        
        # Cleanup
        await db_pool.close_all_pools()
    
    # Run example
    asyncio.run(example_usage())