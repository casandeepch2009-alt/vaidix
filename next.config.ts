import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this project — avoids walking up the drive,
  // which is especially important on slow filesystems / paths with spaces.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
