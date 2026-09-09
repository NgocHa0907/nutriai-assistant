const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

// Simple proxy helper for AI APIs (Google Gemini, OpenAI, OpenRouter, Groq)
function handleAiProxy(req, res) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const targetUrl = payload.targetUrl;
      const customHeaders = payload.headers || {};
      const requestData = JSON.stringify(payload.data || {});

      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing targetUrl parameter" }));
      }

      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const transport = isHttps ? https : http;

      // Clean headers
      const forwardedHeaders = { ...customHeaders };
      delete forwardedHeaders["host"];
      delete forwardedHeaders["Host"];
      delete forwardedHeaders["content-length"];
      delete forwardedHeaders["Content-Length"];

      forwardedHeaders["Content-Length"] = Buffer.byteLength(requestData);

      const proxyReqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: forwardedHeaders,
        timeout: 60000
      };

      const proxyReq = transport.request(proxyReqOptions, proxyRes => {
        let responseBody = "";
        proxyRes.on("data", chunk => {
          responseBody += chunk;
        });

        proxyRes.on("end", () => {
          res.writeHead(proxyRes.statusCode || 200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-goog-api-key, HTTP-Referer, X-Title"
          });
          res.end(responseBody);
        });
      });

      proxyReq.on("error", err => {
        console.error("Proxy error:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Lỗi kết nối máy chủ AI: " + err.message }));
      });

      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        res.writeHead(504, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Hết thời gian chờ phản hồi từ máy chủ AI (Timeout)" }));
      });

      proxyReq.write(requestData);
      proxyReq.end();
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Dữ liệu yêu cầu không hợp lệ: " + err.message }));
    }
  });
}

const server = http.createServer((req, res) => {
  // Enable CORS including X-goog-api-key, OpenRouter headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-goog-api-key, HTTP-Referer, X-Title");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle AI proxy API
  if (pathname === "/api/ai-proxy" && req.method === "POST") {
    return handleAiProxy(req, res);
  }

  // Health check
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
  }

  // Serve static files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") {
    safePath = "/index.html";
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
  if (err || !stats.isFile()) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    return res.end("404 - Không tìm thấy tệp");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (readErr, content) => {
    if (readErr) {
      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("500 - Lỗi đọc tệp");
    }

    res.writeHead(200, {
      "Content-Type": contentType
    });

    res.end(content);
  });
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 NutriAI - Trợ lý Calo & Sức Khỏe đang hoạt động tại:`);
    console.log(`👉 http://localhost:${portToTry}`);
    console.log(`======================================================\n`);
  });

  server.on("error", err => {
    if (err.code === "EADDRINUSE") {
      console.log(`Cổng ${portToTry} đang bận, thử cổng ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error("Lỗi khởi động máy chủ:", err);
    }
  });
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = (req, res) => {
  server.emit("request", req, res);
};