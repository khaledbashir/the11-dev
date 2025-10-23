import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [API] /api/dashboard/stats - Fetching dashboard stats');
    
    // Get stats from SOW master dashboard (using correct table name: sows)
    const sowCount = await query<any>('SELECT COUNT(*) as count FROM sows');
    console.log('✅ [API] SOW count result:', sowCount);
    
    const totalValue = await query<any>('SELECT SUM(total_investment) as total FROM sows WHERE total_investment IS NOT NULL');
    console.log('✅ [API] Total value result:', totalValue);
    
    const result = {
      totalSOWs: sowCount[0]?.count || 0,
      totalValue: totalValue[0]?.total || 0,
      masterDashboard: 'sow-master-dashboard',
      recentActivity: [],
      topClients: [],
      popularServices: [],
      activeSOWs: 0,
      thisMonthSOWs: 0
    };
    
    console.log('✅ [API] Dashboard stats response:', result);
    
    // Add cache-control headers to prevent caching
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error: any) {
    console.error('❌ [API] Dashboard stats error:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      stack: error.stack
    });
    
    // Return empty dashboard with error status instead of 500
    return NextResponse.json({
      error: 'Failed to fetch dashboard stats',
      message: error.message,
      totalSOWs: 0,
      totalValue: 0,
      recentActivity: [],
      topClients: [],
      popularServices: [],
      activeSOWs: 0,
      thisMonthSOWs: 0,
      isEmpty: true,
      status: 'error'
    }, { status: 200 }); // Return 200 so dashboard can still load with empty state
  }
}
