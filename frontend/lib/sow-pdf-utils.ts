/**
 * Utility functions for preparing SOW data for the new PDF export
 */

import { SOWData } from '@/components/sow/types';
import { extractPricingFromContent } from './export-utils';

/**
 * Prepare SOW data from the current document for the new PDF export
 */
export function prepareSOWForNewPDF(currentDoc: any): SOWData | null {
  if (!currentDoc) return null;

  try {
    // Extract pricing data from TipTap content
    const pricingData = extractPricingFromContent(currentDoc.content);
    
    // Build scopes from pricing data
    const scopes = pricingData.scopes.map((scope: any, index: number) => ({
      id: index + 1,
      title: scope.title || `Scope ${index + 1}`,
      description: scope.description || '',
      items: scope.items.map((item: any) => ({
        description: item.task || item.description || '',
        role: item.role || '',
        hours: parseFloat(item.hours || 0),
        cost: parseFloat(item.total || 0),
      })),
      deliverables: scope.deliverables || [],
      assumptions: scope.assumptions || [],
    }));

    // Prepare SOW data
    const sowData: SOWData = {
      projectTitle: currentDoc.title || 'Statement of Work',
      clientName: currentDoc.clientName || 'Client',
      projectDate: new Date().toLocaleDateString(),
      company: {
        name: 'Social Garden',
        address: 'Melbourne, Australia',
        phone: '+61 (0) 3 9999 9999',
        email: 'hello@socialgarden.com.au',
        website: 'www.socialgarden.com.au',
      },
      client: {
        name: currentDoc.clientName || 'Client',
        contactPerson: '',
        email: currentDoc.clientEmail || '',
        phone: '',
      },
      scopes,
      terms: [
        'Payment terms: Net 30 days from invoice date',
        'All work to be completed within agreed timelines',
        'Client to provide timely feedback and approvals',
        'Any scope changes will be quoted separately',
      ],
      validity: '30 days from date of issue',
      notes: 'This Statement of Work is valid for 30 days. Please contact us if you have any questions.',
    };

    return sowData;
  } catch (error) {
    console.error('Error preparing SOW for new PDF:', error);
    return null;
  }
}
