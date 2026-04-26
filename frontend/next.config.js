/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @dnd-kit calls React context APIs at module initialisation time.
      // Aliasing to false replaces them with empty modules in server chunks,
      // preventing "useContext null" errors during SSG static page generation.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@dnd-kit/core': false,
        '@dnd-kit/sortable': false,
        '@dnd-kit/modifiers': false,
        '@dnd-kit/utilities': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
