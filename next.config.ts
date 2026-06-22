import path from 'node:path';
import type {NextConfig} from 'next';

const projectRoot = import.meta.dirname;
const workspaceRoot = path.join(projectRoot, '..');

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  outputFileTracingRoot: workspaceRoot,
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/google-genai',
    '@genkit-ai/next',
    '@genkit-ai/ai',
    '@genkit-ai/core',
  ],
  turbopack: {
    root: projectRoot,
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.join(projectRoot, 'node_modules'),
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
