\"use client\";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className=\"min-h-screen gradient-bg flex items-center justify-center px-4\">
      <div className=\"max-w-md w-full text-center\">
        <div className=\"bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8\">
          <div className=\"w-16 h-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-6\">
            <span className=\"text-white text-2xl font-bold\">SG</span>
          </div>
          
          <h1 className=\"text-3xl font-bold text-slate-900 dark:text-white mb-4\">
            Social Garden Client Portal
          </h1>
          
          <p className=\"text-slate-600 dark:text-slate-300 mb-8\">
            Experience premium client collaboration with our beautiful, intuitive portal.
          </p>

          <Link href=\"/sow/abc123\" className=\"btn btn-primary gap-2 mx-auto\">
            View Demo SOW
            <ArrowRight className=\"w-4 h-4\" />
          </Link>
        </div>
      </div>
    </div>
  );
}
</contents>\""