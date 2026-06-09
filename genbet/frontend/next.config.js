/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  experimental: { typedRoutes: false },
};

module.exports = nextConfig;
