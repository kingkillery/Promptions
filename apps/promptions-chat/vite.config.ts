import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: "/chat/",
    server: {
        port: 3003,
    },
    define: {
        "process.env": {},
    },
});
