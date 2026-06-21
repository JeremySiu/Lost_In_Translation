/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-html-parser'],
  },
}
module.exports = nextConfig
