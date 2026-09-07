const https = require("https");
const http = require("http");

/**
 * Parse request body.
 * Vercel có thể đã parse req.body sẵn,
 * nhưng khi chạy local hoặc trong một số trường hợp
 * body vẫn cần đọc thủ công.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Vercel đã parse body
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "string") {
        try {
          return resolve(JSON.parse(req.body));
        } catch (error) {
          return reject(new Error("Request body không phải JSON hợp lệ"));
        }
      }

      return resolve(req.body);
    }

    // Đọc body thủ công
    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        reject(new Error("Request body không phải JSON hợp lệ"));
      }
    });

    req.on("error", error => {
      reject(error);
    });
  });
}

/**
 * Vercel Serverless Function
 */
module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-goog-api-key"
  );

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Chỉ hỗ trợ phương thức POST"
    });
  }

  try {
    const payload = await parseBody(req);

    const targetUrl = payload.targetUrl;
    const customHeaders = payload.headers || {};
    const requestData = JSON.stringify(payload.data || {});

    // Kiểm tra targetUrl
    if (!targetUrl) {
      return res.status(400).json({
        error: "Thiếu tham số targetUrl"
      });
    }

    // Parse URL
    let parsedUrl;

    try {
      parsedUrl = new URL(targetUrl);
    } catch (error) {
      return res.status(400).json({
        error: "targetUrl không hợp lệ"
      });
    }

    // Chỉ cho phép HTTP/HTTPS
    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return res.status(400).json({
        error: "targetUrl chỉ hỗ trợ HTTP hoặc HTTPS"
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
    if (!forwardedHeaders["Content-Type"] &&
        !forwardedHeaders["content-type"]) {
      forwardedHeaders["Content-Type"] = "application/json";
    }

    // Tính Content-Length mới
    forwardedHeaders["Content-Length"] =
      Buffer.byteLength(requestData);

    // Request options
    const proxyReqOptions = {
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

    // Gửi request tới AI API
    const proxyReq = transport.request(
      proxyReqOptions,
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

          return res.end(responseBody);
        });
      }
    );

    // Lỗi kết nối
    proxyReq.on("error", error => {
      console.error(
        "AI Proxy error:",
        error.message
      );

      if (!res.headersSent) {
        return res.status(502).json({
          error:
            "Lỗi kết nối tới AI API: " +
            error.message
        });
      }
    });

    // Timeout
    proxyReq.on("timeout", () => {
      console.error("AI Proxy timeout");

      proxyReq.destroy();

      if (!res.headersSent) {
        return res.status(504).json({
          error:
            "Hết thời gian chờ phản hồi từ AI API (Timeout)"
        });
      }
    });

    // Gửi body
    proxyReq.write(requestData);
    proxyReq.end();

  } catch (error) {
    console.error(
      "AI Proxy request error:",
      error.message
    );

    if (!res.headersSent) {
      return res.status(400).json({
        error:
          "Dữ liệu yêu cầu không hợp lệ: " +
          error.message
      });
    }
  }
};