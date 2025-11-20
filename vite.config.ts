import fs from "fs";
import path from "path";
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

const mediaRoot = path.resolve(__dirname, "media");
const audioDir = path.join(mediaRoot, "audio");
const visualDir = path.join(mediaRoot, "media");

const imageExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"]);
const videoExt = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi"]);
const audioExt = new Set([".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a", ".webm"]);

const mimeByExt: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
};

const ensureDirs = () => {
  [mediaRoot, audioDir, visualDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const listMedia = () => {
  ensureDirs();
  const visuals = fs
    .readdirSync(visualDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const ext = path.extname(entry.name).toLowerCase();
      const type = imageExt.has(ext) ? "image" : videoExt.has(ext) ? "video" : null;
      return type
        ? {
            name: entry.name,
            url: `/media/media/${encodeURIComponent(entry.name)}`,
            type,
          }
        : null;
    })
    .filter(Boolean);

  const audio = fs
    .readdirSync(audioDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const ext = path.extname(entry.name).toLowerCase();
      return audioExt.has(ext)
        ? {
            name: entry.name,
            url: `/media/audio/${encodeURIComponent(entry.name)}`,
            type: "audio",
          }
        : null;
    })
    .filter(Boolean);

  return { visuals, audio };
};

const serveMediaPlugin = (): Plugin => {
  const serve = (req: any, res: any, next: any) => {
    const url: string = req.url || "";
    if (url.startsWith("/media/")) {
      const filePath = path.join(mediaRoot, url.replace("/media/", ""));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = mimeByExt[ext] || "application/octet-stream";
        res.setHeader("Content-Type", mime);
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    next();
  };

  const library = (req: any, res: any, next: any) => {
    if (req.url === "/api/library") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(listMedia()));
      return;
    }
    next();
  };

  const attach = (app: any) => {
    app.use(library);
    app.use(serve);
  };

  return {
    name: "local-media-loader",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
};

export default defineConfig({
  plugins: [react(), serveMediaPlugin()],
  server: {
    host: true,
    strictPort: false,
  },
  preview: {
    host: true,
  },
});
