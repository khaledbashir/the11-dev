\"use server\";

// Mock SOW data - replace with your database logic
const mockSOW = {
  id: 'abc123',
  projectTitle: 'Premium Website Development',
  clientName: 'Acme Corp',
  totalInvestment: 15000,
  description: 'A comprehensive website development project including design, development, and content strategy to elevate your digital presence.',
  scope: 'Full website redesign including user experience optimization, responsive design implementation, and content management system integration. This project will transform your current website into a modern, user-friendly platform that converts visitors into customers.',
  timeline: 8,
  deliverables: [
    'Custom website design with 5 unique page templates',
    'Responsive development for all devices',
    'Content management system integration',
    'SEO optimization and performance tuning',
    'Training and documentation'
  ],
  viewCount: 12,
  daysUntilExpiry: 15
};

export async function GET(request, { params }) {
  try {
    // In a real implementation, you'd fetch from your database here
    if (params.id === 'abc123') {
      return new Response(JSON.stringify(mockSOW), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'SOW not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch SOW' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
</contents>\""