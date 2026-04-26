/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    // Required for static export — Next.js Image Optimization API is not available
    unoptimized: true,
  },
};

module.exports = nextConfig;
