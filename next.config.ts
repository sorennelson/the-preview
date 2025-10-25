import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

module.exports = {
  async rewrites() {
    return [
      {
        source: '/files/:path*',
        destination: 'http://localhost:8000/files/:path*', // proxy to FastAPI
      },
    ]
  },
}

export default nextConfig;
