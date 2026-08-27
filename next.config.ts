import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages ship native bindings (.node) or heavy WASM that the
  // Turbopack bundler can't handle. Keep them as external requires so Node
  // loads them at runtime instead of bundling them.
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
};

export default nextConfig;
