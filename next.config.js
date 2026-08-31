/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // undici is required at runtime rather than bundled: it ships WASM (llhttp)
  // and node: internals that are safest left to Node's own resolver.
  serverExternalPackages: ['undici'],
};

module.exports = nextConfig;
