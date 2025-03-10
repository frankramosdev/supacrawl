import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PlausibleProvider from 'next-plausible'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SupaCrawl",
  description: "A powerful web scraping tool that simplifies crawling pages for LLMs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PlausibleProvider 
          domain="supacrawl.com"
          trackFileDownloads={true}
          hash={true}
          trackOutboundLinks={true}
          pageviewProps={true}
          revenue={true}
          taggedEvents={true}
        >
          {children}
        </PlausibleProvider>
      </body>
    </html>
  );
} 