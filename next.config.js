/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
 * useful for Docker builds.
 */
await import("./src/env.js");

const isDev = process.env.NODE_ENV !== "production";

// The realtime daemon lives on its own origin in dev (ws://host:3001) and
// behind /ws in production; it is known at build time like every NEXT_PUBLIC_ value.
const realtimeOrigin = (() => {
    try {
        return process.env.NEXT_PUBLIC_REALTIME_WS_URL
            ? new URL(process.env.NEXT_PUBLIC_REALTIME_WS_URL).origin
            : "";
    } catch {
        return "";
    }
})();

// Next injects inline scripts, so script-src needs 'unsafe-inline'; the policy
// still stops framing (clickjacking), plugins, <base> hijacks, and forms or
// connections to other sites.
const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${realtimeOrigin ? ` ${realtimeOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://discord.com",
    "object-src 'none'",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    // Browsers ignore this over plain http, so it is safe in dev too.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import("next").NextConfig} */
const config = {
    // Emits .next/standalone: the server plus only the node_modules it actually
    // traced. The deploy image is built from this (see Dockerfile).
    // NOTE: standalone makes `sharp` mandatory - without it next/image throws
    // and serves the untouched original instead of falling back to WASM.
    output: "standalone",
    poweredByHeader: false,
    images: {
        // Default is 60s, which throws away every optimized variant a minute
        // after it is built. Game art is versioned in the filename (-v1, -v2),
        // so it can be cached for a month and re-optimized essentially never.
        minimumCacheTTL: 2_592_000,
        // Only this site's own files, without query strings, at the one
        // quality next/image asks for. Anything wider lets anyone fill the
        // optimizer's disk cache with variants nobody uses (Next 14 gets no
        // fix for that), so each image has a small, fixed set of variants.
        localPatterns: [{ pathname: "/**", search: "" }],
        qualities: [75],
    },
    async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
    },
    reactStrictMode: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true
    }
};

export default config;
