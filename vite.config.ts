import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// APP_URL is the public HTTPS address BigCommerce calls (a tunnel in development).
const host = new URL(process.env.APP_URL || "http://localhost").hostname;

export default defineConfig({
  server: {
    // The tunnel's host, plus any Cloudflare quick tunnel (its address changes on every start).
    allowedHosts: [host, ".trycloudflare.com"],
    port: Number(process.env.PORT || 3000),
    hmr: host === "localhost" ? undefined : { protocol: "wss", host, clientPort: 443 },
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [reactRouter(), tsconfigPaths()],
  build: {
    assetsInlineLimit: 0,
  },
}) satisfies UserConfig;
