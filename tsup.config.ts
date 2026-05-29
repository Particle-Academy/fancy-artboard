import { defineConfig } from "tsup";

export default defineConfig({
  // `screens` is a separate entry so the optional fancy-screens peer never
  // enters the base (`.`) import graph (lesson from fancy-inertia#1).
  entry: ["src/index.ts", "src/screens.ts", "src/styles.css"],
  format: ["esm", "cjs"],
  dts: { entry: ["src/index.ts", "src/screens.ts"] },
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@particle-academy/react-fancy",
    "@particle-academy/fancy-screens",
  ],
  treeshake: true,
});
