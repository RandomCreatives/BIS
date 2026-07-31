import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

function configuredSupabaseOrigins(): string[] {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return [];

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:') return [];
    const websocketOrigin = `wss://${url.host}`;
    return [url.origin, websocketOrigin];
  } catch {
    return [];
  }
}

const supabaseOrigins = configuredSupabaseOrigins();
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigins.filter((origin) => origin.startsWith('https:')).join(' ')}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins.join(' ')}${isDevelopment ? ' http://localhost:* ws://localhost:*' : ''}`,
  "worker-src 'self' blob:",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
]
  .join('; ')
  .replace(/\s+/g, ' ')
  .trim();

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  },
  ...(!isDevelopment
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
