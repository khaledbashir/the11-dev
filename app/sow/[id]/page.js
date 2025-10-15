\"use client\";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle, MessageCircle, Download, Eye } from 'lucide-react';

const fetchSOW = async (id) => {
  const res = await fetch(`/api/sow/${id}`);
  if (!res.ok) throw new Error('Failed to fetch SOW');
  return res.json();
};

export default function SOWLandingPage() {
  const params = useParams();
  const [activeSection, setActiveSection] = useState(null);
  
  const { data: sow, isLoading, error } = useQuery({
    queryKey: ['sow', params.id],
    queryFn: () => fetchSOW(params.id),
  });

  if (isLoading) return <div className=\"flex items-center justify-center min-h-screen\"><span className=\"loading loading-spinner\"></span></div>;
  if (error) return <div className=\"flex items-center justify-center min-h-screen text-error\">Failed to load SOW</div>;

  return (
    <div className=\"min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800\">
      {/* Header with Social Garden Branding */}
      <header className=\"bg-white dark:bg-slate-800 shadow-sm border-b\">
        <div className=\"max-w-6xl mx-auto px-4 py-4 flex items-center justify-between\">
          <div className=\"flex items-center space-x-3\">
            <div className=\"w-10 h-10 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg flex items-center justify-center\">
              <span className=\"text-white font-bold text-lg\">SG</span>
            </div>
            <div>
              <h1 className=\"text-xl font-bold text-slate-900 dark:text-white\">Social Garden</h1>
              <p className=\"text-sm text-slate-600 dark:text-slate-300\">Client Portal</p>
            </div>
          </div>
          <div className=\"flex items-center space-x-4\">
            <button className=\"btn btn-ghost btn-sm\">Login</button>
            <button className=\"btn btn-primary btn-sm\">Sign Up</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className=\"py-16 px-4\">
        <div className=\"max-w-4xl mx-auto text-center\">
          <div className=\"bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 md:p-12\">
            <div className=\"mb-6\">
              <span className=\"inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200\">
                Statement of Work
              </span>
            </div>
            
            <h1 className=\"text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4\">
              {sow.projectTitle}
            </h1>
            
            <div className=\"flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-6 text-slate-600 dark:text-slate-300 mb-8\">
              <span>Client: <span className=\"font-semibold\">{sow.clientName}</span></span>
              <span>•</span>
              <span className=\"text-2xl font-bold text-primary-600 dark:text-primary-400\">
                ${sow.totalInvestment.toLocaleString()}
              </span>
            </div>

            <p className=\"text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto\">
              {sow.description}
            </p>

            {/* Action Buttons */}
            <div className=\"flex flex-col sm:flex-row justify-center gap-4\">
              <button className=\"btn btn-primary btn-lg gap-2\">
                <CheckCircle className=\"w-5 h-5\" />
                Accept & Sign
              </button>
              <button className=\"btn btn-ghost btn-lg gap-2\">
                <MessageCircle className=\"w-5 h-5\" />
                Request Changes
              </button>
              <button className=\"btn btn-ghost btn-lg gap-2\">
                <Download className=\"w-5 h-5\" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SOW Content Preview */}
      <section className=\"py-12 px-4 bg-white dark:bg-slate-800\">
        <div className=\"max-w-4xl mx-auto\">
          <h2 className=\"text-2xl font-bold text-slate-900 dark:text-white mb-8\">Project Overview</h2>
          
          <div className=\"grid md:grid-cols-2 gap-8\">
            <div className=\"space-y-6\">
              <div>
                <h3 className=\"font-semibold text-slate-900 dark:text-white mb-2\">Scope of Work</h3>
                <p className=\"text-slate-600 dark:text-slate-300 text-sm leading-relaxed\">
                  {sow.scope.substring(0, 200)}...
                </p>
              </div>
              
              <div>
                <h3 className=\"font-semibold text-slate-900 dark:text-white mb-2\">Timeline</h3>
                <p className=\"text-slate-600 dark:text-slate-300\">
                  {sow.timeline} weeks
                </p>
              </div>
            </div>
            
            <div className=\"space-y-6\">
              <div>
                <h3 className=\"font-semibold text-slate-900 dark:text-white mb-2\">Key Deliverables</h3>
                <ul className=\"space-y-1\">
                  {sow.deliverables.slice(0, 3).map((deliverable, index) => (
                    <li key={index} className=\"flex items-center text-slate-600 dark:text-slate-300 text-sm\">
                      <CheckCircle className=\"w-4 h-4 text-green-500 mr-2\" />
                      {deliverable}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className=\"font-semibold text-slate-900 dark:text-white mb-2\">Next Steps</h3>
                <p className=\"text-slate-600 dark:text-slate-300 text-sm\">
                  Once accepted, we'll schedule your kickoff meeting and begin project execution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Engagement Tracker */}
      <section className=\"py-8 px-4 bg-slate-50 dark:bg-slate-900\">
        <div className=\"max-w-4xl mx-auto text-center\">
          <div className=\"flex items-center justify-center space-x-4 text-slate-600 dark:text-slate-300\">
            <Eye className=\"w-4 h-4\" />
            <span className=\"text-sm\">
              {sow.viewCount} views • Expires in {sow.daysUntilExpiry} days
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
</contents>\""