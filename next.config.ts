import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
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
