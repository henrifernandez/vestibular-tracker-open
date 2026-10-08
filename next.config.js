const dev = process.env.NODE_ENV !== "production";

// Content Security Policy básica. O Next (Pages Router) injeta scripts e estilos inline, por isso
// 'unsafe-inline'; em desenvolvimento o React precisa de 'unsafe-eval'. Fontes são servidas pelo
// próprio app (next/font), então não há origem externa liberada.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O navegador precisa saber se é a demonstração (banner e botões desativados).
  env: { NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "" },
  async headers() {
    return [
      {
        // fora de /_next: o Next serve manifestos do dev com MIME que o nosniff bloquearia
        source: "/((?!_next/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
