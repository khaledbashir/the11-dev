import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/user/preferences
 * Fetch all preferences for the authenticated user
 * 
 * Headers:
 *   x-user-id: User identifier (required)
 * 
 * Returns:
 *   { preferences: { [key: string]: any } }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    
    console.log('📥 [USER PREFERENCES] Fetching preferences for user:', userId);

    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?',
        [userId]
      );

      // Transform array of rows into key-value object
      const preferences: { [key: string]: any } = {};
      (rows as any[]).forEach((row: any) => {
        try {
          // Parse JSON values
          preferences[row.preference_key] = JSON.parse(row.preference_value);
        } catch {
          // If not valid JSON, store as-is
          preferences[row.preference_key] = row.preference_value;
        }
      });

      console.log('✅ [USER PREFERENCES] Loaded', Object.keys(preferences).length, 'preferences');

      return NextResponse.json({ 
        preferences,
        userId 
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('❌ [USER PREFERENCES] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 * Update one or more user preferences
 * 
 * Headers:
 *   x-user-id: User identifier (required)
 * 
 * Body:
 *   { [key: string]: any } - Key-value pairs of preferences to update
 * 
 * Returns:
 *   { success: true, updated: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const body = await request.json();

    console.log('💾 [USER PREFERENCES] Updating preferences for user:', userId, Object.keys(body));

    const connection = await db.getConnection();
    try {
      let updated = 0;

      // Update each preference
      for (const [key, value] of Object.entries(body)) {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        
        await connection.execute(
          `INSERT INTO user_preferences (user_id, preference_key, preference_value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE preference_value = ?, updated_at = NOW()`,
          [userId, key, jsonValue, jsonValue]
        );
        
        updated++;
      }

      console.log('✅ [USER PREFERENCES] Updated', updated, 'preferences');

      return NextResponse.json({ 
        success: true, 
        updated,
        userId 
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('❌ [USER PREFERENCES] Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/preferences
 * Delete specific user preferences
 * 
 * Headers:
 *   x-user-id: User identifier (required)
 * 
 * Body:
 *   { keys: string[] } - Array of preference keys to delete
 * 
 * Returns:
 *   { success: true, deleted: number }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const body = await request.json();
    const { keys } = body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'keys array is required' },
        { status: 400 }
      );
    }

    console.log('🗑️ [USER PREFERENCES] Deleting preferences for user:', userId, keys);

    const connection = await db.getConnection();
    try {
      const placeholders = keys.map(() => '?').join(',');
      const [result] = await connection.execute(
        `DELETE FROM user_preferences WHERE user_id = ? AND preference_key IN (${placeholders})`,
        [userId, ...keys]
      );

      const deleted = (result as any).affectedRows || 0;

      console.log('✅ [USER PREFERENCES] Deleted', deleted, 'preferences');

      return NextResponse.json({ 
        success: true, 
        deleted,
        userId 
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('❌ [USER PREFERENCES] Error deleting preferences:', error);
    return NextResponse.json(
      { error: 'Failed to delete preferences', message: error.message },
      { status: 500 }
    );
  }
}
