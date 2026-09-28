import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.TAURI_DEV_HOST;

/**
 * Chặn đóng gói bản phát hành trỏ về backend local.
 *
 * `.env` (đã gitignore) dùng cho dev chứa VITE_API_URL=http://localhost:3000, và Vite
 * nạp `.env` CẢ KHI build production. Nên nếu đóng gói ngay trên máy dev thì app phát
 * hành sẽ gọi localhost:3000 và chết với mọi người dùng — lỗi rất khó phát hiện vì trên
 * máy dev nó vẫn chạy đúng. CI không có `.env` nên tự động dùng URL Render.
 */
function assertProductionApiUrl(mode: string) {
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiUrl = (env.VITE_API_URL || "").trim();
  const forcesLocal = env.VITE_USE_LOCAL_BACKEND === "true";

  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(apiUrl) || forcesLocal) {
    throw new Error(
      [
        "",
        "╔════════════════════════════════════════════════════════════════════════╗",
        "║  DỪNG BUILD: app sẽ trỏ về backend LOCAL, không phải Render.            ║",
        "╚════════════════════════════════════════════════════════════════════════╝",
        `  VITE_API_URL           = ${apiUrl || "(trống)"}`,
        `  VITE_USE_LOCAL_BACKEND = ${env.VITE_USE_LOCAL_BACKEND || "(trống)"}`,
        "",
        "  Nếu đây là bản phát hành: tạm đổi tên .env (mv .env .env.dev) rồi build lại,",
        "  hoặc build qua GitHub Actions bằng cách push tag (CI không có .env nên tự",
        "  dùng https://photo-picker-backend.onrender.com).",
        "",
        "  Nếu bạn CỐ Ý muốn bản build trỏ về local để test: đặt",
        "  MVD_ALLOW_LOCAL_BUILD=1 trước lệnh build.",
        "",
      ].join("\n"),
    );
  }
}

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  if (command === "build" && process.env.MVD_ALLOW_LOCAL_BUILD !== "1") {
    assertProductionApiUrl(mode);
  }

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
