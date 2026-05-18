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
 statusBarStyle: 'default',
 title: 'WorkFlow CN Hoàng Mai',
 },
 icons: {
 apple: '/logo.png',
 }
};

export const viewport: Viewport = {
 themeColor: '#1e40af',
 width: 'device-width',
 initialScale: 1,
 maximumScale: 1,
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html lang="vi">
 <head>
 <link rel="preconnect" href="https://fonts.googleapis.com" />
 <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
 <meta name="apple-mobile-web-app-capable" content="yes" />
 <meta name="apple-mobile-web-app-status-bar-style" content="default" />
 </head>
 <body className="font-body antialiased min-h-screen bg-background">
 {children}
 <Toaster />
 <PWANotificationHandler />
 </body>
 </html>
 );
}
