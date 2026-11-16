import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: true,
  target: "node22",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  external: [
    "@octokit/rest",
    "zod",
    "nanoid",
    "p-limit",
    "node:sqlite",
    "node:fs",
    "node:path",
  ],
});