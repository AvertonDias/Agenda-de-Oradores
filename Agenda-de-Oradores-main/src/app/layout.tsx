import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MainLayout } from '@/components/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';

export const metadata: Metadata = {
  title: 'Agenda de Oradores',
  description: 'Aplicativo para agendamento de discursos públicos.',
  icons: {
    icon: [
      { url: '/Ico.jpeg', type: 'image/jpeg' },
      { url: '/Ico.jpeg', rel: 'icon', type: 'image/jpeg' },
      { url: '/Ico.jpeg', rel: 'shortcut icon', type: 'image/jpeg' }
    ],
    apple: [
      { url: '/Ico.jpeg', sizes: '180x180', type: 'image/jpeg' }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agenda de Oradores',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#22c55e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <FirebaseClientProvider>
          <MainLayout>{children}</MainLayout>
          <PWAInstallPrompt />
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
