/**
 * Server-side extensions for generateHTML
 * Minimal set that works in Node.js SSR environment
 */

import StarterKit from "@tiptap/starter-kit";

// Use only StarterKit for server-side rendering
// It includes: Document, Paragraph, Text, Bold, Italic, Strike, Code, etc.
export const serverExtensions = [
  StarterKit,
];
