import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { PWANotificationHandler } from "@/components/pwa-notification-handler";

export const metadata: Metadata = {
 title: 'WorkFlow - CN Hoàng Mai',
 description: 'Hệ thống điều hành và quản trị mục tiêu ngân hàng cao cấp.',
 manifest: '/manifest.json',
 appleWebApp: {
 capable: true,
 statusBarStyle: 'black-translucent',
 title: 'WorkFlow CN Hoàng Mai',
 },
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  }
};

export const viewport: Viewport = {
 // Theo HIG/WCAG 1.4.4: KHÔNG khoá pinch-zoom của người dùng
 width: 'device-width',
 initialScale: 1,
 // Cho phép user thu phóng tới 5x để hỗ trợ thị lực kém
 maximumScale: 5,
 userScalable: true,
 // Theme color theo dark/light mode
 themeColor: [
   { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
   { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
 ],
 viewportFit: 'cover', // Cho safe-area trải dài notch
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html lang="vi" className="force-light" suppressHydrationWarning>
 <head>
 <meta name="apple-mobile-web-app-capable" content="yes" />
 <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
 <meta name="format-detection" content="telephone=no" />
 </head>
 <body className="font-body antialiased min-h-screen bg-background">
 {children}
 <Toaster />
 <PWANotificationHandler />
 </body>
 </html>
 );
}
