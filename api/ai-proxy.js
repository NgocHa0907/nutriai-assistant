const https = require("https");
const http = require("http");

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-goog-api-key");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  try {
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    } else if (!payload || typeof payload !== "object") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
      }
      try {
        payload = JSON.parse(raw);
      } catch (e) {
        payload = {};
      }
    }

    const targetUrl = payload.targetUrl;
    const customHeaders = payload.headers || {};
    const requestData = JSON.stringify(payload.data || {});

    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Missing targetUrl parameter" }));
    }

    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

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
      timeout: 30000
    };

    const proxyReq = transport.request(proxyReqOptions, proxyRes => {
      let responseBody = "";
      proxyRes.on("data", chunk => {
        responseBody += chunk;
      });

      proxyRes.on("end", () => {
        res.statusCode = proxyRes.statusCode || 200;
        res.setHeader("Content-Type", "application/json");
        res.end(responseBody);
      });
    });

    proxyReq.on("error", err => {
      console.error("Proxy error:", err.message);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Lỗi kết nối máy chủ AI: " + err.message }));
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      res.statusCode = 504;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Hết thời gian chờ phản hồi từ máy chủ AI (Timeout)" }));
    });

    proxyReq.write(requestData);
    proxyReq.end();
  } catch (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Dữ liệu yêu cầu không hợp lệ: " + err.message }));
  }
};