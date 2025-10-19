import "@/styles/globals.css";
import "@/styles/prosemirror.css";
import 'katex/dist/katex.min.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Providers from "./providers";

// Load Jakarta Sans font
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const title = "Social Garden - SOW Generator";
const description =
  "Professional Statement of Work generator powered by AI. Create comprehensive SOWs for marketing automation and CRM projects.";

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/images/logo-light.png', type: 'image/png' }
    ],
    apple: '/images/logo-light.png',
  },
  openGraph: {
    title,
    description,
    images: ['/images/logo-light.png'],
  },
  twitter: {
    title,
    description,
    card: "summary_large_image",
    images: ['/images/logo-light.png'],
  },
  metadataBase: new URL("https://socialgarden.com.au"),
};

export const viewport: Viewport = {
  themeColor: "#0e2e33",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={jakartaSans.variable}>
      <body className={jakartaSans.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
