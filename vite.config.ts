import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { seoPages } from "./src/data/seoPages";
import { buildSeoSchemas } from "./src/data/seoSchema";

const cataloguePath = path.resolve(__dirname, "src/data/serviceCatalogue.json");
const htmlEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const buildSitemap = () => {
  const pages = seoPages.filter((page) => page.indexable !== false).map((page) => `
  <url><loc>https://cyrechtech.com${page.path}</loc><lastmod>${page.lastModified}</lastmod><changefreq>${page.changeFrequency}</changefreq><priority>${page.priority.toFixed(1)}</priority></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages}
  <url><loc>https://cyrechtech.com/ai-catalogue.json</loc><lastmod>2026-10-23</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`;
};

const publicSeoAssets = () => ({
  name: "public-seo-assets",
  configureServer(server: {
    middlewares: {
      use: (
        handler: (
          request: { url?: string },
          response: { setHeader: (name: string, value: string) => void; end: (body: string) => void },
          next: () => void,
        ) => void,
      ) => void;
    };
  }) {
    server.middlewares.use((request, response, next) => {
      const requestPath = request.url?.split("?")[0];
      if (requestPath !== "/ai-catalogue.json" && requestPath !== "/sitemap.xml") {
        next();
        return;
      }
      response.setHeader(
        "Content-Type",
        requestPath === "/sitemap.xml" ? "application/xml; charset=utf-8" : "application/json; charset=utf-8",
      );
      response.setHeader("Cache-Control", "public, max-age=3600");
      response.end(requestPath === "/sitemap.xml" ? buildSitemap() : readFileSync(cataloguePath, "utf8"));
    });
  },
  generateBundle(this: {
    emitFile: (asset: { type: "asset"; fileName: string; source: string }) => void;
  }) {
    this.emitFile({
      type: "asset",
      fileName: "ai-catalogue.json",
      source: readFileSync(cataloguePath, "utf8"),
    });
  },
  writeBundle(this: { error: (message: string) => void }, outputOptions: { dir?: string }) {
    const outputDirectory = path.resolve(outputOptions.dir ?? "dist");
    const indexPath = path.join(outputDirectory, "index.html");
    let baseHtml: string;
    try {
      baseHtml = readFileSync(indexPath, "utf8");
      writeFileSync(path.join(outputDirectory, "sitemap.xml"), buildSitemap());
    } catch (error) {
      this.error(`Could not generate route metadata pages from ${indexPath}: ${String(error)}`);
      return;
    }
    for (const page of seoPages) {
      const escapedPath = page.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const html = baseHtml
        .replace(/<title>[^<]*<\/title>/, `<title>${htmlEscape(page.title)}</title>`)
        .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${htmlEscape(page.description)}" />`)
        .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${page.indexable === false ? "noindex, nofollow" : "index, follow"}" />`)
        .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="https://cyrechtech.com${page.path}" />`)
        .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${htmlEscape(page.title)}" />`)
        .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${htmlEscape(page.description)}" />`)
        .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="https://cyrechtech.com${page.path}" />`)
        .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${htmlEscape(page.title)}" />`)
        .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${htmlEscape(page.description)}" />`)
        .replace("</head>", `<script id="seo-structured-data" type="application/ld+json">${JSON.stringify(buildSeoSchemas(page.path))}</script></head>`);
      const routeDirectory = path.join(outputDirectory, escapedPath.slice(1));
      mkdirSync(routeDirectory, { recursive: true });
      writeFileSync(path.join(routeDirectory, "index.html"), html);
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    publicSeoAssets(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
