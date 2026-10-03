/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small runtime image for the Docker deploy
  reactStrictMode: true,
};

export default nextConfig;
