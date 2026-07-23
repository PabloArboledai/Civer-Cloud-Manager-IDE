import daisyui from "daisyui";
import containerQueries from "@tailwindcss/container-queries";

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {},
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#5b7ff1",         // Azul suave (no quema)
                    "primary-content": "#ffffff",
                    "secondary": "#7c8fa6",        // Gris azulado suave
                    "secondary-content": "#ffffff",
                    "accent": "#2da58e",            // Verde teal suave
                    "accent-content": "#ffffff",
                    "neutral": "#3d4a5c",           // Texto principal
                    "neutral-content": "#f7f4ef",
                    "base-100": "#faf8f5",          // Fondo principal: crema muy suave
                    "base-200": "#f2ede6",          // Cards: crema calida
                    "base-300": "#e8e0d5",          // Bordes: crema oscura
                    "base-content": "#3d4a5c",      // Texto sobre fondo: gris azulado oscuro
                    "info": "#4a9ebb",
                    "info-content": "#ffffff",
                    "success": "#2da58e",
                    "success-content": "#ffffff",
                    "warning": "#c9963a",
                    "warning-content": "#ffffff",
                    "error": "#d95e5e",
                    "error-content": "#ffffff",
                },
            },
            {
                dark: {
                    "primary": "#3b82f6",
                    "secondary": "#94a3b8",
                    "accent": "#10b981",
                    "neutral": "#1f2937",
                    "base-100": "#0f172a", // Slate-900
                    "base-200": "#1e293b", // Slate-800
                    "base-300": "#334155", // Slate-700
                    "info": "#0ea5e9",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
        ],
        darkTheme: "dark",
    },
}
