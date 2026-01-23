/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@trustroots/nr-common"],

  // Enable static export for GitHub Pages
  output: "export",

  // Generate trailing slashes for GitHub Pages compatibility
  trailingSlash: true,

  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
