import path from 'node:path';
import type {NextConfig} from 'next';

const monorepoRoot = path.join(import.meta.dirname, '../..');

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.join(monorepoRoot, 'node_modules'),
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
  async redirects() {
    return [
      {
        source: '/companies/:companyId/users',
        destination: '/companies/:companyId/members',
        permanent: true,
      },
      {
        source: '/users',
        destination: '/companies',
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
