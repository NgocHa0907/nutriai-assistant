const https = require("https");
const http = require("http");

function parseBody(req) {
  return new Promise(resolve => {
    if (req.body) {
      if (typeof req.body === "string") {
        try {
          return resolve(JSON.parse(req.body));
        } catch (e) {
          return resolve({});
        }
      }
      return resolve(req.body);
    }
    let data = "";
    req.on("data", chunk => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-goog-api-key");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Chỉ hỗ trợ phương thức POST" }));
  }

  try {
    const payload = await parseBody(req);
    const targetUrl = payload.targetUrl;
    const customHeaders = payload.headers || {};
    const requestData = JSON.stringify(payload.data || {});

    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Thiếu tham số targetUrl" }));
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
      timeout: 25000
    };

    const proxyReq = transport.request(proxyReqOptions, proxyRes => {
      let responseBody = "";
      proxyRes.on("data", chunk => {
        responseBody += chunk;
      });

      proxyRes.on("end", () => {
        res.statusCode = proxyRes.statusCode || 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(responseBody);
      });
    });

    proxyReq.on("error", err => {
      console.error("Proxy error:", err.message);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Lỗi kết nối tới AI API: " + err.message }));
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      res.statusCode = 504;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Hết thời gian chờ phản hồi từ AI API (Timeout)" }));
    });

    proxyReq.write(requestData);
    proxyReq.end();
  } catch (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Dữ liệu yêu cầu không hợp lệ: " + err.message }));
  }
};