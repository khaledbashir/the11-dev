import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get stats from SOW master dashboard
    const sowCount = await query<any>('SELECT COUNT(*) as count FROM statements_of_work');
    const totalValue = await query<any>('SELECT SUM(total_investment) as total FROM statements_of_work WHERE total_investment IS NOT NULL');
    
    return NextResponse.json({
      totalSOWs: sowCount[0]?.count || 0,
      totalValue: totalValue[0]?.total || 0,
      masterDashboard: 'sow-master-dashboard'
    });
  } catch (error) {
    console.error('❌ Failed to fetch dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
