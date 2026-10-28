import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'everyone. Market Radar',
  description: 'Internal market intelligence for everyone.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#000000' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
