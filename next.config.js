/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image configuration
  images: {
    domains: ["localhost"],
  },
  // CORS headers for API routes
  async headers() {
    return [
      {
        source: "/api/swagger.json",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value:
              process.env.FRONTEND_URL ||
              (process.env.NODE_ENV === "development"
                ? "http://localhost:5173"
                : "http://173.249.47.147"),
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
