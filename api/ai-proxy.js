const https = require("https");
const http = require("http");

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  // Vercel có thể parse body sẵn
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }

    return req.body;
  }

  // Fallback đọc raw body
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      if (!data) {
        return resolve({});
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-goog-api-key"
  );

  // OPTIONS
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // Chỉ POST
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Chỉ hỗ trợ phương thức POST"
    });
  }

  try {
    const payload = await parseBody(req);

    const targetUrl = payload.targetUrl;
    const customHeaders = payload.headers || {};
    const requestData = JSON.stringify(payload.data || {});

    if (!targetUrl) {
      return sendJson(res, 400, {
        error: "Thiếu tham số targetUrl"
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return sendJson(res, 400, {
        error: "targetUrl không hợp lệ"
      });
    }

    // Chỉ cho phép HTTP / HTTPS
    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return sendJson(res, 400, {
        error: "Chỉ hỗ trợ HTTP và HTTPS"
      });
    }

    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    // Copy headers
    const forwardedHeaders = {
      ...customHeaders
    };

    // Không forward các header nguy hiểm / không hợp lệ
    delete forwardedHeaders.host;
    delete forwardedHeaders.Host;

    delete forwardedHeaders["content-length"];
    delete forwardedHeaders["Content-Length"];

    // Đảm bảo Content-Type
    if (!forwardedHeaders["Content-Type"]) {
      forwardedHeaders["Content-Type"] = "application/json";
    }

    forwardedHeaders["Content-Length"] =
      Buffer.byteLength(requestData);

    const options = {
      hostname: parsedUrl.hostname,
      port:
        parsedUrl.port ||
        (isHttps ? 443 : 80),

      path:
        parsedUrl.pathname +
        parsedUrl.search,

      method: "POST",

      headers: forwardedHeaders,

      timeout: 25000
    };

    const proxyReq = transport.request(
      options,
      proxyRes => {
        let responseBody = "";

        proxyRes.on("data", chunk => {
          responseBody += chunk;
        });

        proxyRes.on("end", () => {
          res.statusCode =
            proxyRes.statusCode || 200;

          res.setHeader(
            "Content-Type",
            proxyRes.headers["content-type"] ||
              "application/json; charset=utf-8"
          );

          res.end(responseBody);
        });
      }
    );

    proxyReq.on("error", error => {
      console.error(
        "AI proxy error:",
        error
      );

      if (!res.headersSent) {
        sendJson(res, 502, {
          error:
            "Lỗi kết nối tới AI API: " +
            error.message
        });
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();

      if (!res.headersSent) {
        sendJson(res, 504, {
          error:
            "Hết thời gian chờ phản hồi từ AI API"
        });
      }
    });

    proxyReq.write(requestData);
    proxyReq.end();

  } catch (error) {
    console.error(
      "AI proxy exception:",
      error
    );

    if (!res.headersSent) {
      sendJson(res, 500, {
        error:
          "Lỗi server: " +
          error.message
      });
    }
  }
};