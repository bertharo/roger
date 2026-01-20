/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress url.parse() deprecation warning from dependencies
  // This will be fixed when dependencies update to use WHATWG URL API
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Suppress the deprecation warning in server-side code
      process.removeAllListeners('warning');
      process.on('warning', (warning) => {
        if (warning.name === 'DeprecationWarning' && warning.message.includes('url.parse()')) {
          // Suppress this specific warning
          return;
        }
        // Log other warnings normally
        console.warn(warning.name, warning.message);
      });
    }
    return config;
  },
}

module.exports = nextConfig
