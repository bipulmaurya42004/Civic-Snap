import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "ais-dev-mgquzh23zx7qrjdh3ldgyj-682354278713.asia-east1.run.app",
    "ais-pre-mgquzh23zx7qrjdh3ldgyj-682354278713.asia-east1.run.app",
    "*.asia-east1.run.app",
    "*.run.app",
    "localhost",
    "127.0.0.1",
  ],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
