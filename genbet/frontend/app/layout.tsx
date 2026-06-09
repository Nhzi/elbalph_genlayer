import './globals.css';
import type { Metadata } from 'next';
import { GenLayerProvider } from '@/components/ClientProvider';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'GenBet — Bet at the Speed of GenLayer',
  description:
    'Sports + casino on GenLayer. AI-resolved sports markets, provably-fair casino — all settling on an AI-native L2.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <GenLayerProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 pb-24">{children}</main>
        </GenLayerProvider>
      </body>
    </html>
  );
}
