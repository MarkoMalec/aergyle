/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
 * useful for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
    // Emits .next/standalone: the server plus only the node_modules it actually
    // traced. The deploy image is built from this (see Dockerfile).
    // NOTE: standalone makes `sharp` mandatory - without it next/image throws
    // and serves the untouched original instead of falling back to WASM.
    output: "standalone",
    images: {
        // Default is 60s, which throws away every optimized variant a minute
        // after it is built. Game art is versioned in the filename (-v1, -v2),
        // so it can be cached for a month and re-optimized essentially never.
        minimumCacheTTL: 2_592_000,
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
