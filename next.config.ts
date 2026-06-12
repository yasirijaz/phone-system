import path from 'node:path';
import type {NextConfig} from 'next';

const monorepoRoot = path.join(import.meta.dirname, '../..');
const reactPath = path.join(monorepoRoot, 'node_modules/react');
const reactDomPath = path.join(monorepoRoot, 'node_modules/react-dom');

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    resolveAlias: {
      react: reactPath,
      'react-dom': reactDomPath,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: reactPath,
      'react-dom': reactDomPath,
    };
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
