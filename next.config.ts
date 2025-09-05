import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
  trailingSlash: true, // Helps with routing in Electron
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Use relative paths in production for Electron, but not during build
  assetPrefix: process.env.ELECTRON_BUILD === 'true' ? './' : '',
};

export default nextConfig;
