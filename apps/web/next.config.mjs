/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small runtime image for the Docker deploy
  reactStrictMode: true,
  transpilePackages: ["@sector/shared"], // the plan table is shared TypeScript source
};

export default nextConfig;
