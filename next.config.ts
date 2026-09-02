import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // This is a standalone website, not an agent workspace.
  agentRules: false,
};

export default config;
