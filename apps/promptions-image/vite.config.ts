import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: "/image/",
    server: {
        port: 3004,
    },
    define: {
        "process.env": {},
    },
});
