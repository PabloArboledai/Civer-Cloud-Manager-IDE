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
  const shouldEnableRouteCodeSplitting = mode === "production";
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
        autoCodeSplitting: shouldEnableRouteCodeSplitting
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5yZW5kZXJlci5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWZyb2RpdGFcXFxcRGVza3RvcFxcXFxEcmFjdWxhYm9BbnRpZ3Jhdml0eU1hbmFnZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFmcm9kaXRhXFxcXERlc2t0b3BcXFxcRHJhY3VsYWJvQW50aWdyYXZpdHlNYW5hZ2VyXFxcXHZpdGUucmVuZGVyZXIuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQWZyb2RpdGEvRGVza3RvcC9EcmFjdWxhYm9BbnRpZ3Jhdml0eU1hbmFnZXIvdml0ZS5yZW5kZXJlci5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSc7XHJcbmltcG9ydCB7IHRhbnN0YWNrUm91dGVyIH0gZnJvbSAnQHRhbnN0YWNrL3JvdXRlci1wbHVnaW4vdml0ZSc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBjb2RlSW5zcGVjdG9yUGx1Z2luIH0gZnJvbSAnY29kZS1pbnNwZWN0b3ItcGx1Z2luJztcclxuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gJ0BzZW50cnkvdml0ZS1wbHVnaW4nO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xyXG4gIGNvbnN0IHNlbnRyeUF1dGhUb2tlbiA9IHByb2Nlc3MuZW52LlNFTlRSWV9BVVRIX1RPS0VOIHx8IGVudi5TRU5UUllfQVVUSF9UT0tFTjtcclxuICBjb25zdCBzaG91bGRFbmFibGVTZW50cnkgPSBtb2RlID09PSAncHJvZHVjdGlvbicgJiYgQm9vbGVhbihzZW50cnlBdXRoVG9rZW4pO1xyXG4gIGNvbnN0IHNob3VsZEVuYWJsZVJvdXRlQ29kZVNwbGl0dGluZyA9IG1vZGUgPT09ICdwcm9kdWN0aW9uJztcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgLi4uKHNob3VsZEVuYWJsZVNlbnRyeVxyXG4gICAgICAgID8gW1xyXG4gICAgICAgICAgICBzZW50cnlWaXRlUGx1Z2luKHtcclxuICAgICAgICAgICAgICBvcmc6IHByb2Nlc3MuZW52LlNFTlRSWV9PUkcgfHwgZW52LlNFTlRSWV9PUkcsXHJcbiAgICAgICAgICAgICAgcHJvamVjdDogcHJvY2Vzcy5lbnYuU0VOVFJZX1BST0pFQ1QgfHwgZW52LlNFTlRSWV9QUk9KRUNULFxyXG4gICAgICAgICAgICAgIGF1dGhUb2tlbjogc2VudHJ5QXV0aFRva2VuLFxyXG4gICAgICAgICAgICAgIHJlbGVhc2U6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IGAke3Byb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX25hbWV9QCR7cHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbn1gLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgLy8gRWxlY3Ryb24gbG9hZHMgZmlsZXMgZnJvbSBhcHA6Ly8sIHNvIHdlIG5lZWQgdG8gbm9ybWFsaXplIHBhdGhzIGZvciBTb3VyY2UgTWFwIG1hdGNoaW5nXHJcbiAgICAgICAgICAgICAgc291cmNlbWFwczoge1xyXG4gICAgICAgICAgICAgICAgLy8gUmV3cml0ZSB0aGUgc291cmNlIHBhdGhzIHRvIHN0cmlwIHRoZSBFbGVjdHJvbiBhcHA6Ly8gcHJvdG9jb2xcclxuICAgICAgICAgICAgICAgIHJld3JpdGVTb3VyY2VzOiAoc291cmNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIFRyYW5zZm9ybTogYXBwOi8vLy52aXRlL3JlbmRlcmVyL21haW5fd2luZG93L2Fzc2V0cy9pbmRleC5qc1xyXG4gICAgICAgICAgICAgICAgICAvLyBJbnRvOiAgICAgIH4vLnZpdGUvcmVuZGVyZXIvbWFpbl93aW5kb3cvYXNzZXRzL2luZGV4LmpzXHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBzb3VyY2UucmVwbGFjZSgvXmFwcDpcXC9cXC9cXC8vLCAnfi8nKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgOiBbXSksXHJcbiAgICAgIHRhbnN0YWNrUm91dGVyKHtcclxuICAgICAgICB0YXJnZXQ6ICdyZWFjdCcsXHJcbiAgICAgICAgYXV0b0NvZGVTcGxpdHRpbmc6IHNob3VsZEVuYWJsZVJvdXRlQ29kZVNwbGl0dGluZyxcclxuICAgICAgfSksXHJcbiAgICAgIHRhaWx3aW5kY3NzKCksXHJcbiAgICAgIHJlYWN0KHtcclxuICAgICAgICBiYWJlbDoge1xyXG4gICAgICAgICAgcGx1Z2luczogWydiYWJlbC1wbHVnaW4tcmVhY3QtY29tcGlsZXInXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KSxcclxuICAgICAgY29kZUluc3BlY3RvclBsdWdpbih7IGJ1bmRsZXI6ICd2aXRlJyB9KSxcclxuICAgIF0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgZW50cmllczogWydpbmRleC5odG1sJ10sXHJcbiAgICB9LFxyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgICdwcm9jZXNzLmVudi5TRU5UUllfRFNOJzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuU0VOVFJZX0RTTiB8fCBlbnYuU0VOVFJZX0RTTiksXHJcbiAgICB9LFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzOiB0cnVlLFxyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuL3NyYycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9O1xyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErVyxTQUFTLGNBQWMsZUFBZTtBQUNyWixPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsU0FBUyxzQkFBc0I7QUFDL0IsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXdCO0FBRWpDLElBQU8sK0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxRQUFNLGtCQUFrQixRQUFRLElBQUkscUJBQXFCLElBQUk7QUFDN0QsUUFBTSxxQkFBcUIsU0FBUyxnQkFBZ0IsUUFBUSxlQUFlO0FBQzNFLFFBQU0saUNBQWlDLFNBQVM7QUFFaEQsU0FBTztBQUFBLElBQ0wsU0FBUztBQUFBLE1BQ1AsR0FBSSxxQkFDQTtBQUFBLFFBQ0UsaUJBQWlCO0FBQUEsVUFDZixLQUFLLFFBQVEsSUFBSSxjQUFjLElBQUk7QUFBQSxVQUNuQyxTQUFTLFFBQVEsSUFBSSxrQkFBa0IsSUFBSTtBQUFBLFVBQzNDLFdBQVc7QUFBQSxVQUNYLFNBQVM7QUFBQSxZQUNQLE1BQU0sR0FBRyxRQUFRLElBQUksZ0JBQWdCLElBQUksUUFBUSxJQUFJLG1CQUFtQjtBQUFBLFVBQzFFO0FBQUE7QUFBQSxVQUVBLFlBQVk7QUFBQTtBQUFBLFlBRVYsZ0JBQWdCLENBQUMsV0FBVztBQUcxQixxQkFBTyxPQUFPLFFBQVEsZUFBZSxJQUFJO0FBQUEsWUFDM0M7QUFBQSxVQUNGO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDSCxJQUNBLENBQUM7QUFBQSxNQUNMLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxRQUNSLG1CQUFtQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxNQUNELFlBQVk7QUFBQSxNQUNaLE1BQU07QUFBQSxRQUNKLE9BQU87QUFBQSxVQUNMLFNBQVMsQ0FBQyw2QkFBNkI7QUFBQSxRQUN6QztBQUFBLE1BQ0YsQ0FBQztBQUFBLE1BQ0Qsb0JBQW9CLEVBQUUsU0FBUyxPQUFPLENBQUM7QUFBQSxJQUN6QztBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1osU0FBUyxDQUFDLFlBQVk7QUFBQSxJQUN4QjtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sMEJBQTBCLEtBQUssVUFBVSxRQUFRLElBQUksY0FBYyxJQUFJLFVBQVU7QUFBQSxJQUNuRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1Asa0JBQWtCO0FBQUEsTUFDbEIsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsUUFBUSxJQUFJLEdBQUcsT0FBTztBQUFBLE1BQzFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
