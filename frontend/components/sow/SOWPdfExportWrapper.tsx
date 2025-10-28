import React, { useState } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import SOWPdfExport from './SOWPdfExport';
import { SOWData, SOWPdfExportWrapperProps } from './types';

/**
 * Wrapper component for the SOW PDF Export
 * Provides both download and preview functionality
 */
const SOWPdfExportWrapper: React.FC<SOWPdfExportWrapperProps> = ({
  sowData,
  fileName = 'Statement-of-Work.pdf',
}) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="sow-pdf-export-wrapper">
      <div className="flex gap-4 mb-4">
        {/* Download Button */}
        <PDFDownloadLink
          document={<SOWPdfExport sowData={sowData} />}
          fileName={fileName}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
        >
          {({ blob, url, loading, error }) =>
            loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download SOW PDF
              </>
            )
          }
        </PDFDownloadLink>

        {/* Preview Toggle Button */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium inline-flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          {showPreview ? 'Hide Preview' : 'Preview PDF'}
        </button>
      </div>

      {/* PDF Preview */}
      {showPreview && (
        <div className="w-full h-[800px] border border-gray-300 rounded-lg overflow-hidden">
          <PDFViewer width="100%" height="100%">
            <SOWPdfExport sowData={sowData} />
          </PDFViewer>
        </div>
      )}
    </div>
  );
};

export default SOWPdfExportWrapper;
