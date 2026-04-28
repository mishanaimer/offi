/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
    outputFileTracingIncludes: {
      "/api/documents/**/*": ["./src/lib/contract-generator/templates/**/*"],
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
