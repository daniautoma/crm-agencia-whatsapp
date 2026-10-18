/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@whiskeysockets/baileys',
      'pino',
      'ws',
      'qrcode',
      'bcryptjs',
    ],
  },
};

export default nextConfig;
