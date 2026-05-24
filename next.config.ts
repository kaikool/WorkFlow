import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tree-shake các package nặng có nhiều named export — giảm bundle ~30-40% cho dashboard.
  // Áp dụng các package chính: icon (lucide-react), date helper (date-fns), calendar (react-day-picker).
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'react-day-picker',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co',       port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos',       port: '', pathname: '/**' },
    ],
  },
};

export default nextConfig;
