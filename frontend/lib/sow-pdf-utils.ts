/**
 * Utility functions for preparing SOW data for the new PDF export
 */

import { SOWData } from '@/components/sow/types';

/**
 * Prepare SOW data from the current document for the new PDF export
 */
export function prepareSOWForNewPDF(currentDoc: any): SOWData | null {
  if (!currentDoc) return null;

  try {
    // Simple scope from document content
    const scope = {
      id: 1,
      title: currentDoc.title || 'Project Scope',
      description: currentDoc.description || 'Comprehensive project delivery',
      items: [],
      deliverables: [],
      assumptions: [],
    };

    // Prepare SOW data
    const sowData: SOWData = {
      company: {
        name: 'Social Garden',
      },
      clientName: currentDoc.clientName || 'Client',
      projectTitle: currentDoc.title || 'Statement of Work',
      projectSubtitle: 'PROFESSIONAL SERVICES',
      projectOverview: currentDoc.description || 'Comprehensive project delivery',
      budgetNotes: 'Payment terms: Net 30 days from invoice date',
      scopes: [scope],
      currency: 'AUD',
      gstApplicable: true,
      generatedDate: new Date().toLocaleDateString(),
    };

    return sowData;
  } catch (error) {
    console.error('Error preparing SOW for new PDF:', error);
    return null;
  }
}
