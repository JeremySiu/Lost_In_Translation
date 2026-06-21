/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['genius-lyrics', 'undici'],
  },
}
module.exports = nextConfig
