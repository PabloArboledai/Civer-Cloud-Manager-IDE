// vite.renderer.config.mts
import { defineConfig, loadEnv } from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/@tailwindcss/vite/dist/index.mjs";
import { tanstackRouter } from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import path from "path";
import { codeInspectorPlugin } from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/code-inspector-plugin/dist/index.mjs";
import { sentryVitePlugin } from "file:///C:/Users/Afrodita/Desktop/DraculaboAntigravityManager/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
var vite_renderer_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN;
  const shouldEnableSentry = mode === "production" && Boolean(sentryAuthToken);
  return {
    plugins: [
      ...shouldEnableSentry ? [
        sentryVitePlugin({
          org: process.env.SENTRY_ORG || env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT || env.SENTRY_PROJECT,
          authToken: sentryAuthToken,
          release: {
            name: `${process.env.npm_package_name}@${process.env.npm_package_version}`
          },
          // Electron loads files from app://, so we need to normalize paths for Source Map matching
          sourcemaps: {
            // Rewrite the source paths to strip the Electron app:// protocol
            rewriteSources: (source) => {
              return source.replace(/^app:\/\/\//, "~/");
            }
          }
        })
      ] : [],
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true
      }),
      tailwindcss(),
      react({
        babel: {
          plugins: ["babel-plugin-react-compiler"]
        }
      }),
      codeInspectorPlugin({ bundler: "vite" })
    ],
    optimizeDeps: {
      entries: ["index.html"]
    },
    define: {
      "process.env.SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN || env.SENTRY_DSN)
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@": path.resolve(process.cwd(), "./src")
      }
    }
  };
});
export {
  vite_renderer_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5yZW5kZXJlci5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWZyb2RpdGFcXFxcRGVza3RvcFxcXFxEcmFjdWxhYm9BbnRpZ3Jhdml0eU1hbmFnZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFmcm9kaXRhXFxcXERlc2t0b3BcXFxcRHJhY3VsYWJvQW50aWdyYXZpdHlNYW5hZ2VyXFxcXHZpdGUucmVuZGVyZXIuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQWZyb2RpdGEvRGVza3RvcC9EcmFjdWxhYm9BbnRpZ3Jhdml0eU1hbmFnZXIvdml0ZS5yZW5kZXJlci5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSc7XHJcbmltcG9ydCB7IHRhbnN0YWNrUm91dGVyIH0gZnJvbSAnQHRhbnN0YWNrL3JvdXRlci1wbHVnaW4vdml0ZSc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBjb2RlSW5zcGVjdG9yUGx1Z2luIH0gZnJvbSAnY29kZS1pbnNwZWN0b3ItcGx1Z2luJztcclxuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gJ0BzZW50cnkvdml0ZS1wbHVnaW4nO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xyXG4gIGNvbnN0IHNlbnRyeUF1dGhUb2tlbiA9IHByb2Nlc3MuZW52LlNFTlRSWV9BVVRIX1RPS0VOIHx8IGVudi5TRU5UUllfQVVUSF9UT0tFTjtcclxuICBjb25zdCBzaG91bGRFbmFibGVTZW50cnkgPSBtb2RlID09PSAncHJvZHVjdGlvbicgJiYgQm9vbGVhbihzZW50cnlBdXRoVG9rZW4pO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAuLi4oc2hvdWxkRW5hYmxlU2VudHJ5XHJcbiAgICAgICAgPyBbXHJcbiAgICAgICAgICAgIHNlbnRyeVZpdGVQbHVnaW4oe1xyXG4gICAgICAgICAgICAgIG9yZzogcHJvY2Vzcy5lbnYuU0VOVFJZX09SRyB8fCBlbnYuU0VOVFJZX09SRyxcclxuICAgICAgICAgICAgICBwcm9qZWN0OiBwcm9jZXNzLmVudi5TRU5UUllfUFJPSkVDVCB8fCBlbnYuU0VOVFJZX1BST0pFQ1QsXHJcbiAgICAgICAgICAgICAgYXV0aFRva2VuOiBzZW50cnlBdXRoVG9rZW4sXHJcbiAgICAgICAgICAgICAgcmVsZWFzZToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogYCR7cHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfbmFtZX1AJHtwcm9jZXNzLmVudi5ucG1fcGFja2FnZV92ZXJzaW9ufWAsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAvLyBFbGVjdHJvbiBsb2FkcyBmaWxlcyBmcm9tIGFwcDovLywgc28gd2UgbmVlZCB0byBub3JtYWxpemUgcGF0aHMgZm9yIFNvdXJjZSBNYXAgbWF0Y2hpbmdcclxuICAgICAgICAgICAgICBzb3VyY2VtYXBzOiB7XHJcbiAgICAgICAgICAgICAgICAvLyBSZXdyaXRlIHRoZSBzb3VyY2UgcGF0aHMgdG8gc3RyaXAgdGhlIEVsZWN0cm9uIGFwcDovLyBwcm90b2NvbFxyXG4gICAgICAgICAgICAgICAgcmV3cml0ZVNvdXJjZXM6IChzb3VyY2UpID0+IHtcclxuICAgICAgICAgICAgICAgICAgLy8gVHJhbnNmb3JtOiBhcHA6Ly8vLnZpdGUvcmVuZGVyZXIvbWFpbl93aW5kb3cvYXNzZXRzL2luZGV4LmpzXHJcbiAgICAgICAgICAgICAgICAgIC8vIEludG86ICAgICAgfi8udml0ZS9yZW5kZXJlci9tYWluX3dpbmRvdy9hc3NldHMvaW5kZXguanNcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHNvdXJjZS5yZXBsYWNlKC9eYXBwOlxcL1xcL1xcLy8sICd+LycpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICBdXHJcbiAgICAgICAgOiBbXSksXHJcbiAgICAgIHRhbnN0YWNrUm91dGVyKHtcclxuICAgICAgICB0YXJnZXQ6ICdyZWFjdCcsXHJcbiAgICAgICAgYXV0b0NvZGVTcGxpdHRpbmc6IHRydWUsXHJcbiAgICAgIH0pLFxyXG4gICAgICB0YWlsd2luZGNzcygpLFxyXG4gICAgICByZWFjdCh7XHJcbiAgICAgICAgYmFiZWw6IHtcclxuICAgICAgICAgIHBsdWdpbnM6IFsnYmFiZWwtcGx1Z2luLXJlYWN0LWNvbXBpbGVyJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSksXHJcbiAgICAgIGNvZGVJbnNwZWN0b3JQbHVnaW4oeyBidW5kbGVyOiAndml0ZScgfSksXHJcbiAgICBdLFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGVudHJpZXM6IFsnaW5kZXguaHRtbCddLFxyXG4gICAgfSxcclxuICAgIGRlZmluZToge1xyXG4gICAgICAncHJvY2Vzcy5lbnYuU0VOVFJZX0RTTic6IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52LlNFTlRSWV9EU04gfHwgZW52LlNFTlRSWV9EU04pLFxyXG4gICAgfSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgcHJlc2VydmVTeW1saW5rczogdHJ1ZSxcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnLi9zcmMnKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1csU0FBUyxjQUFjLGVBQWU7QUFDclosT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sVUFBVTtBQUNqQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHdCQUF3QjtBQUVqQyxJQUFPLCtCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxrQkFBa0IsUUFBUSxJQUFJLHFCQUFxQixJQUFJO0FBQzdELFFBQU0scUJBQXFCLFNBQVMsZ0JBQWdCLFFBQVEsZUFBZTtBQUUzRSxTQUFPO0FBQUEsSUFDTCxTQUFTO0FBQUEsTUFDUCxHQUFJLHFCQUNBO0FBQUEsUUFDRSxpQkFBaUI7QUFBQSxVQUNmLEtBQUssUUFBUSxJQUFJLGNBQWMsSUFBSTtBQUFBLFVBQ25DLFNBQVMsUUFBUSxJQUFJLGtCQUFrQixJQUFJO0FBQUEsVUFDM0MsV0FBVztBQUFBLFVBQ1gsU0FBUztBQUFBLFlBQ1AsTUFBTSxHQUFHLFFBQVEsSUFBSSxnQkFBZ0IsSUFBSSxRQUFRLElBQUksbUJBQW1CO0FBQUEsVUFDMUU7QUFBQTtBQUFBLFVBRUEsWUFBWTtBQUFBO0FBQUEsWUFFVixnQkFBZ0IsQ0FBQyxXQUFXO0FBRzFCLHFCQUFPLE9BQU8sUUFBUSxlQUFlLElBQUk7QUFBQSxZQUMzQztBQUFBLFVBQ0Y7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNMLElBQ0UsQ0FBQztBQUFBLE1BQ0wsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFFBQ1IsbUJBQW1CO0FBQUEsTUFDckIsQ0FBQztBQUFBLE1BQ0QsWUFBWTtBQUFBLE1BQ1osTUFBTTtBQUFBLFFBQ0osT0FBTztBQUFBLFVBQ0wsU0FBUyxDQUFDLDZCQUE2QjtBQUFBLFFBQ3pDO0FBQUEsTUFDRixDQUFDO0FBQUEsTUFDRCxvQkFBb0IsRUFBRSxTQUFTLE9BQU8sQ0FBQztBQUFBLElBQ3pDO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWixTQUFTLENBQUMsWUFBWTtBQUFBLElBQ3hCO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTiwwQkFBMEIsS0FBSyxVQUFVLFFBQVEsSUFBSSxjQUFjLElBQUksVUFBVTtBQUFBLElBQ25GO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxrQkFBa0I7QUFBQSxNQUNsQixPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxRQUFRLElBQUksR0FBRyxPQUFPO0FBQUEsTUFDMUM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
