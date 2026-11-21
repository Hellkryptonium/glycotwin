/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_BASE_URL;
    const hosted = ['production', 'preview'].includes(process.env.VERCEL_ENV);
    if (hosted && !target) throw new Error('Set API_PROXY_TARGET for this Vercel environment before building.');
    const upstream = new URL(target ?? 'http://127.0.0.1:5050/api/v1');
    if (hosted && (upstream.protocol !== 'https:' || upstream.username || upstream.password || upstream.search || upstream.hash)) {
      throw new Error('API_PROXY_TARGET must be an HTTPS API base URL without credentials, query parameters, or a fragment.');
    }
    if (upstream.hostname === 'localhost') upstream.hostname = '127.0.0.1';
    return [{ source: '/backend/:path*', destination: `${upstream.href.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
