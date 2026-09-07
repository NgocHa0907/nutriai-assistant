const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  },
  setItem: (key, val) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {}
  }
};
// Guard against server-side execution
if (typeof window === "undefined") {
  if (typeof module !== "undefined") {
    module.exports = (req, res) => {
      if (res) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain");
        res.end("NutriAI Client Script");
      }
    };
  }
}
/**
 * NutriAI - Trợ Lý Calo & Theo Dõi Sức Khỏe Thông Minh
 * Client Application Logic
 */

// =============================================================================
// 1. CONSTANTS & STORAGE KEYS
// =============================================================================
const STORAGE_KEYS = {
  API_CONFIG: "nutriai_api_config",
  SYSTEM_PROMPT: "nutriai_system_prompt",
  CHAT_MESSAGES: "nutriai_chat_messages",
  USER_PROFILE: "nutriai_user_profile",
  DAILY_LOGS: "nutriai_daily_logs",
  APP_THEME: "nutriai_theme"
};

const DEFAULT_SYSTEM_PROMPT = `Bạn là Chuyên gia Dinh dưỡng & Huấn luyện viên Thể chất NutriAI thông minh.
Nhiệm vụ chính của bạn:
1. KHI NGƯỜI DÙNG KỂ VỀ MÓN ĂN / ĐỒ UỐNG (Nạp calo vào, ví dụ: "bữa sáng tôi ăn 2 quả trứng 1 cái ngô"):
   - Phân tích bữa ăn (Bữa sáng, Bữa trưa, Bữa tối, hoặc Bữa phụ).
   - Phân tích chi tiết từng món: ước lượng khẩu phần, tính số calo (kcal) và chất dinh dưỡng (Protein, Carbs, Fat).
   - Tính tổng calo nạp vào và đưa ra nhận xét khoa học ngắn gọn.
   - BẮT BUỘC chèn khối JSON ở cuối tin nhắn:
\`\`\`json:meal_log
{
  "type": "meal",
  "mealType": "Bữa sáng",
  "items": [
    {"name": "Trứng gà (2 quả)", "calories": 140, "protein": 12, "carbs": 1, "fat": 10},
    {"name": "Bắp ngô luộc (1 bắp)", "calories": 120, "protein": 4, "carbs": 25, "fat": 2}
  ],
  "totalCalories": 260,
  "notes": "Bữa sáng giàu protein và tinh bột hấp thu chậm"
}
\`\`\`

2. KHI NGƯỜI DÙNG KỂ VỀ HOẠT ĐỘNG THỂ CHẤT / BÀI TẬP / TIÊU HAO CALO (ví dụ: "sáng tôi đi bộ 31p, đồng hồ đo đếm tôi đã tiêu hao 150 calo"):
   - Xác định tên hoạt động (Đi bộ, Chạy bộ, Tập Gym, Đạp xe, Bơi lội...).
   - Xác định thời lượng (phút) và lượng calo tiêu hao (kcal).
   - Khen ngợi, động viên tích cực và phân tích tác dụng tới sự thâm hụt calo trong ngày.
   - BẮT BUỘC chèn khối JSON ở cuối tin nhắn:
\`\`\`json:activity_log
{
  "type": "activity",
  "name": "Đi bộ buổi sáng",
  "duration": 31,
  "calories": 150,
  "notes": "Ghi nhận đi bộ theo đồng hồ thông minh"
}
\`\`\`

3. Với các câu hỏi tư vấn thông thường, trả lời nhiệt tình, dễ hiểu và không cần kèm khối JSON.
4. Luôn sử dụng tiếng Việt thân thiện, rõ ràng, định dạng sinh động.`;

const PROVIDER_PRESETS = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-flash-latest",
    models: ["gemini-flash-latest", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    models: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free", "deepseek/deepseek-chat"]
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
  },
  custom: {
    name: "Tùy Chỉnh",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
    models: ["llama3", "mistral", "qwen2.5"]
  },
  demo: {
    name: "Chế Độ Demo",
    baseUrl: "",
    model: "NutriAI Smart Simulator",
    models: ["NutriAI Smart Simulator"]
  }
};

// =============================================================================
// 2. STATE MANAGEMENT
// =============================================================================
let state = {
  currentTab: "tab-chat",
  selectedDate: getTodayDateString(),
  apiConfig: loadApiConfig(),
  systemPrompt: loadSystemPrompt(),
  chatMessages: loadChatMessages(),
  profile: loadUserProfile(),
  dailyLogs: loadDailyLogs(),
  isGenerating: false
};

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadApiConfig() {
  const saved = safeStorage.getItem(STORAGE_KEYS.API_CONFIG);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return {
    provider: "gemini",
    apiKey: "",
    baseUrl: PROVIDER_PRESETS.gemini.baseUrl,
    model: "gemini-flash-latest",
    temperature: 0.5
  };
}

function saveApiConfig(config) {
  state.apiConfig = config;
  safeStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

function loadSystemPrompt() {
  return safeStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;
}

function saveSystemPrompt(promptText) {
  state.systemPrompt = promptText;
  safeStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, promptText);
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

function loadUserProfile() {
  const saved = safeStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return {
    gender: "male",
    age: 25,
    height: 170,
    weight: 65,
    activityLevel: 1.375,
    goal: "mild_loss"
  };
}

function saveUserProfile(profile) {
  state.profile = profile;
  safeStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

function loadDailyLogs() {
  const saved = safeStorage.getItem(STORAGE_KEYS.DAILY_LOGS);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return {};
}

function saveDailyLogs() {
  safeStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(state.dailyLogs));
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

function getDailyLog(dateStr) {
  if (!state.dailyLogs[dateStr]) {
    state.dailyLogs[dateStr] = {
      meals: {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: []
      },
      activities: []
    };
  }
  return state.dailyLogs[dateStr];
}

function loadChatMessages() {
  const saved = safeStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Clean up any temporary typing messages that might have been saved
      const cleaned = parsed.filter(m => !m.isTyping && !String(m.content).includes("typing-indicator"));
      if (cleaned.length > 0) return cleaned;
    } catch (e) {}
  }
  return [
    {
      id: "init_msg",
      role: "assistant",
      content: "Xin chào bạn! Tôi là **NutriAI** - Trợ lý Dinh Dưỡng & Theo Dõi Sức Khỏe của bạn 🥗🏃‍♂️.\n\nBạn có thể kể cho tôi nghe:\n- **Món bạn đã ăn:** ví dụ *\"bữa sáng tôi ăn 2 quả trứng 1 cái ngô\"*\n- **Hoạt động bạn đã làm:** ví dụ *\"sáng tôi đi bộ 31p, đồng hồ đo đếm tôi đã tiêu hao 150 calo\"*\n\nTôi sẽ tự động phân tích và ghi nhận tức thì vào trang **Theo dõi sức khỏe** cho bạn!",
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      mealLog: null,
      activityLog: null,
      isTyping: false
    }
  ];
}

function saveChatMessages() {
  // Only save non-typing messages
  const toSave = state.chatMessages.filter(m => !m.isTyping && !String(m.content).includes("typing-indicator"));
  safeStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(toSave));
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

// =============================================================================
// 3. HEALTH & NUTRITION FORMULAS (BMR, TDEE, BMI)
// =============================================================================
function calculateBMR(weight, height, age, gender) {
  if (gender === "male") {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

function calculateTDEE(bmr, activityLevel) {
  return Math.round(bmr * parseFloat(activityLevel));
}

function calculateBMI(weight, height) {
  const heightM = height / 100;
  if (heightM <= 0) return 0;
  return parseFloat((weight / (heightM * heightM)).toFixed(1));
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Gầy (Thiếu cân)", color: "#38bdf8", pos: 15 };
  if (bmi < 25.0) return { label: "Bình thường (Chuẩn)", color: "#10b981", pos: 42 };
  if (bmi < 30.0) return { label: "Thừa cân (Tiền béo phì)", color: "#f59e0b", pos: 72 };
  return { label: "Béo phì", color: "#ef4444", pos: 92 };
}

function calculateTargetCalories(tdee, goal) {
  switch (goal) {
    case "maintain": return tdee;
    case "mild_loss": return Math.max(1200, tdee - 300);
    case "standard_loss": return Math.max(1200, tdee - 500);
    case "gain": return tdee + 400;
    default: return tdee;
  }
}

// =============================================================================
// 4. SMART ANALYZER (Handles Meals & Physical Activities)
// =============================================================================
const FOOD_DATABASE = [
  { keywords: ["trứng", "trung", "egg"], name: "Trứng gà", unit: "quả", cals: 70, p: 6, c: 0.5, f: 5 },
  { keywords: ["ngô", "ngo", "bắp", "bap", "corn"], name: "Bắp ngô luộc", unit: "bắp", cals: 120, p: 4, c: 25, f: 2 },
  { keywords: ["phở bò", "pho bo"], name: "Phở bò tái", unit: "tô", cals: 450, p: 25, c: 55, f: 12 },
  { keywords: ["phở gà", "pho ga"], name: "Phở gà", unit: "tô", cals: 400, p: 24, c: 54, f: 10 },
  { keywords: ["bún bò", "bun bo"], name: "Bún bò Huế", unit: "tô", cals: 550, p: 28, c: 65, f: 18 },
  { keywords: ["bún chả", "bun cha"], name: "Bún chả", unit: "phần", cals: 520, p: 26, c: 60, f: 18 },
  { keywords: ["bánh mì", "banh mi"], name: "Bánh mì kẹp thịt", unit: "ổ", cals: 400, p: 16, c: 45, f: 16 },
  { keywords: ["cơm tấm", "com tam"], name: "Cơm tấm sườn", unit: "đĩa", cals: 650, p: 30, c: 80, f: 22 },
  { keywords: ["cơm", "com"], name: "Cơm trắng", unit: "chén", cals: 200, p: 4, c: 45, f: 0.5 },
  { keywords: ["ức gà", "uc ga", "thịt gà"], name: "Ức gà áp chảo (150g)", unit: "phần", cals: 240, p: 45, c: 0, f: 5 },
  { keywords: ["thịt bò", "thit bo"], name: "Thịt bò nạc (100g)", unit: "phần", cals: 250, p: 26, c: 0, f: 15 },
  { keywords: ["súp lơ", "sup lo", "bông cải"], name: "Súp lơ luộc", unit: "đĩa", cals: 45, p: 3, c: 8, f: 0.5 },
  { keywords: ["rau", "rau luoc", "salad"], name: "Rau luộc / Salad", unit: "đĩa", cals: 40, p: 2, c: 7, f: 0.5 },
  { keywords: ["trà sữa", "tra sua", "milk tea"], name: "Trà sữa trân châu", unit: "ly", cals: 350, p: 3, c: 58, f: 12 },
  { keywords: ["cà phê sữa", "cafe sua"], name: "Cà phê sữa đá", unit: "ly", cals: 180, p: 3, c: 28, f: 6 },
  { keywords: ["cà phê đen", "cafe den", "americano"], name: "Cà phê đen đá", unit: "ly", cals: 15, p: 0.5, c: 2, f: 0 },
  { keywords: ["chuối", "chuoi", "banana"], name: "Chuối chín", unit: "quả", cals: 105, p: 1.3, c: 27, f: 0.3 },
  { keywords: ["táo", "tao", "apple"], name: "Táo tây", unit: "quả", cals: 80, p: 0.5, c: 21, f: 0.3 },
  { keywords: ["sữa chua", "sua chua", "yogurt"], name: "Sữa chua ít đường", unit: "hộp", cals: 90, p: 4, c: 12, f: 2.5 }
];

function smartAnalyzeNutrition(userText) {
  const lower = userText.toLowerCase();

  // CHECK IF USER IS REPORTING PHYSICAL ACTIVITY / CALORIES BURNED
  const isActivity = lower.includes("đi bộ") || lower.includes("chạy bộ") || lower.includes("đạp xe") ||
                     lower.includes("tập gym") || lower.includes("gym") || lower.includes("bơi") ||
                     lower.includes("tiêu hao") || lower.includes("đồng hồ") || lower.includes("đốt");

  if (isActivity) {
    let actName = "Đi bộ";
    if (lower.includes("chạy bộ")) actName = "Chạy bộ";
    else if (lower.includes("đạp xe")) actName = "Đạp xe";
    else if (lower.includes("gym") || lower.includes("kháng lực")) actName = "Tập Gym";
    else if (lower.includes("bơi")) actName = "Bơi lội";
    else if (lower.includes("nhảy dây")) actName = "Nhảy dây";
    else if (lower.includes("yoga")) actName = "Tập Yoga";

    if (lower.includes("sáng")) actName += " buổi sáng";
    else if (lower.includes("tối")) actName += " buổi tối";
    else if (lower.includes("chiều")) actName += " buổi chiều";

    // Extract minutes
    let duration = 30;
    const timeMatch = lower.match(/(\d+)\s*(phút|p|phut)/);
    if (timeMatch) duration = parseInt(timeMatch[1], 10);

    // Extract calories burned
    let calories = 150;
    const calMatch = lower.match(/(\d+)\s*(calo|kcal|cal)/);
    if (calMatch) calories = parseInt(calMatch[1], 10);

    const activityLog = {
      type: "activity",
      name: actName,
      duration,
      calories,
      notes: `Ghi nhận hoạt động theo chia sẻ của người dùng.`
    };

    let assistantText = `Tuyệt vời quá! 🏃‍♂️ Mình đã ghi nhận hoạt động thể chất của bạn:\n\n`;
    assistantText += `⚡ **Chi tiết hoạt động:**\n`;
    assistantText += `- **Hoạt động:** ${actName}\n`;
    assistantText += `- **Thời gian:** ${duration} phút\n`;
    assistantText += `- **Năng lượng đã tiêu hao:** **${calories} kcal**\n\n`;
    assistantText += `💡 **Tác động tích cực:** Hoạt động thể chất này giúp tăng lượng tiêu hao tổng trong ngày, kích hoạt trao đổi chất và hỗ trợ rất tốt cho tim mạch. Mình đã tự động ghi nhận **+${calories} kcal** vào mục **Calo Tiêu Hao Hoạt Động** trên trang **Theo dõi sức khỏe** rồi nhé!\n\n`;
    assistantText += "```json:activity_log\n" + JSON.stringify(activityLog, null, 2) + "\n```";

    return { assistantText, mealLog: null, activityLog };
  }

  // OTHERWISE HANDLE FOOD / MEAL INTAKE
  let mealType = "Bữa sáng";
  let mealKey = "breakfast";

  if (lower.includes("trưa") || lower.includes("trua")) {
    mealType = "Bữa trưa";
    mealKey = "lunch";
  } else if (lower.includes("tối") || lower.includes("toi") || lower.includes("chiều tối")) {
    mealType = "Bữa tối";
    mealKey = "dinner";
  } else if (lower.includes("phụ") || lower.includes("phu") || lower.includes("vặt") || lower.includes("chiều") || lower.includes("uống")) {
    mealType = "Bữa phụ";
    mealKey = "snack";
  } else if (lower.includes("sáng") || lower.includes("sang")) {
    mealType = "Bữa sáng";
    mealKey = "breakfast";
  }

  let foundItems = [];

  if (lower.includes("trứng") && (lower.includes("ngô") || lower.includes("bắp"))) {
    let eggCount = 2;
    let cornCount = 1;

    const eggMatch = lower.match(/(\d+)\s*(quả|trái)?\s*trứng/);
    if (eggMatch) eggCount = parseInt(eggMatch[1], 10);

    const cornMatch = lower.match(/(\d+)\s*(cái|bắp|quả)?\s*(ngô|bắp)/);
    if (cornMatch) cornCount = parseInt(cornMatch[1], 10);

    foundItems.push({
      name: `Trứng gà (${eggCount} quả)`,
      calories: 70 * eggCount,
      protein: 6 * eggCount,
      carbs: 0.5 * eggCount,
      fat: 5 * eggCount
    });

    foundItems.push({
      name: `Bắp ngô luộc (${cornCount} bắp)`,
      calories: 120 * cornCount,
      protein: 4 * cornCount,
      carbs: 25 * cornCount,
      fat: 2 * cornCount
    });
  } else {
    for (const food of FOOD_DATABASE) {
      for (const kw of food.keywords) {
        if (lower.includes(kw)) {
          const regex = new RegExp(`(\\d+)\\s*(quả|bắp|cái|tô|bát|ổ|chén|ly|phần|đĩa)?\\s*${kw}`, "i");
          const m = lower.match(regex);
          const qty = m ? parseInt(m[1], 10) : 1;

          foundItems.push({
            name: `${food.name} (${qty} ${food.unit})`,
            calories: food.cals * qty,
            protein: Math.round(food.p * qty),
            carbs: Math.round(food.c * qty),
            fat: Math.round(food.f * qty)
          });
          break;
        }
      }
    }
  }

  if (foundItems.length === 0) {
    foundItems.push({
      name: userText.slice(0, 30),
      calories: 250,
      protein: 10,
      carbs: 30,
      fat: 8
    });
  }

  const totalCalories = foundItems.reduce((sum, item) => sum + item.calories, 0);

  const mealLog = {
    type: "meal",
    mealType,
    mealKey,
    items: foundItems,
    totalCalories,
    notes: `${mealType} dinh dưỡng được phân tích và ghi nhận tự động.`
  };

  let assistantText = `Chào bạn! Mình đã phân tích **${mealType}** của bạn:\n\n`;
  assistantText += `🍽️ **Chi tiết các món ăn & Dinh dưỡng:**\n`;
  foundItems.forEach(it => {
    assistantText += `- **${it.name}:** ~${it.calories} kcal (${it.protein}g Protein, ${it.carbs}g Carbs, ${it.fat}g Fat)\n`;
  });
  assistantText += `\n🔥 **Tổng lượng Calo nạp vào:** **${totalCalories} kcal**\n\n`;
  assistantText += `💡 **Nhận xét dinh dưỡng:** Đây là bữa ăn cân đối. Mình đã tự động ghi nhận số calo này vào mục **${mealType}** trong trang **Theo dõi sức khỏe** cho bạn rồi nhé!\n\n`;
  assistantText += "```json:meal_log\n" + JSON.stringify(mealLog, null, 2) + "\n```";

  return { assistantText, mealLog, activityLog: null };
}
// =============================================================================
// 5. AI API CLIENT (GOOGLE GEMINI NATIVE & OPENAI COMPATIBLE)
// =============================================================================
async function requestAiCompletion(messages) {
  const { provider, apiKey, baseUrl, model, temperature } = state.apiConfig;

  // Fallback to offline smart engine if in Demo mode or no API key
  if (provider === "demo" || !apiKey || !apiKey.trim()) {
    await new Promise(r => setTimeout(r, 650));
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = lastUserMsg ? lastUserMsg.content : "";
    const result = smartAnalyzeNutrition(userText);
    return result.assistantText;
  }

  const cleanKey = apiKey.trim();
  const cleanBase = (baseUrl || "").replace(/\/+$/, "");
  const targetModel = model || "gemini-flash-latest";

  const isGemini = provider === "gemini" ||
                   cleanBase.includes("generativelanguage.googleapis.com") ||
                   cleanBase.includes(":generateContent") ||
                   targetModel.toLowerCase().startsWith("gemini");

  let endpoint = "";
  let headers = {};
  let requestBody = {};

  if (isGemini) {
    // Exact Google Generative Language API endpoint
    if (cleanBase.includes(":generateContent")) {
      endpoint = cleanBase;
    } else if (cleanBase.includes("/models")) {
      endpoint = `${cleanBase}/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    } else {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    }

    headers = {
      "Content-Type": "application/json",
      "X-goog-api-key": cleanKey
    };

    const geminiContents = [];
    const recent = messages.slice(-10);

    for (const msg of recent) {
      let cleanContent = msg.content
        .replace(/```(?:json:meal_log|json:activity_log|json)?\s*[\s\S]*?```/g, "")
        .trim();
      if (!cleanContent) cleanContent = msg.content;
      geminiContents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: cleanContent }]
      });
    }

    if (geminiContents.length === 0) {
      geminiContents.push({
        role: "user",
        parts: [{ text: "Xin chào" }]
      });
    }

    requestBody = {
      contents: geminiContents,
      generationConfig: {
        temperature: parseFloat(temperature) || 0.5
      }
    };

    if (state.systemPrompt && state.systemPrompt.trim()) {
      requestBody.systemInstruction = {
        parts: [{ text: state.systemPrompt.trim() }]
      };
    }
  } else {
    endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanKey}`
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] = window.location.href;
      headers["X-Title"] = "NutriAI Health Assistant";
    }

    requestBody = {
      model: targetModel,
      messages: [
        { role: "system", content: state.systemPrompt },
        ...messages.slice(-10)
      ],
      temperature: parseFloat(temperature) || 0.5
    };
  }

  // 18-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  let responseData = null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Lỗi máy chủ (${response.status}): `;
      try {
        const errJson = JSON.parse(errText);
        errMsg += errJson.error?.message || errJson.message || errText;
      } catch (e) {
        errMsg += errText;
      }
      throw new Error(errMsg);
    }

    responseData = await response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error("Hết thời gian chờ phản hồi (Timeout quá 18s). Vui lòng thử lại hoặc dùng Chế Độ Demo.");
    }

    // Attempt local Node proxy fallback on browser CORS failure
    if (err.name === "TypeError" || err.message.includes("Failed to fetch") || err.message.includes("CORS")) {
      try {
        console.warn("Chuyển hướng yêu cầu qua Proxy máy chủ nội bộ...");
        const proxyRes = await fetch("/api/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: endpoint,
            headers,
            data: requestBody
          })
        });

        if (proxyRes.ok) {
          responseData = await proxyRes.json();
        } else {
          const proxyErr = await proxyRes.json();
          throw new Error(proxyErr.error || "Không thể kết nối qua máy chủ proxy.");
        }
      } catch (proxyErr) {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (isGemini) {
    const candidate = responseData.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      if (responseData.error) {
        throw new Error(responseData.error.message || JSON.stringify(responseData.error));
      }
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("Phản hồi bị từ chối do chính sách an toàn của Google Gemini.");
      }
      throw new Error("Không nhận được nội dung trả về từ Gemini API.");
    }
    return text;
  } else {
    return responseData.choices?.[0]?.message?.content || "Không nhận được phản hồi từ mô hình AI.";
  }
}

// -----------------------------------------------------------------------------
// EXTRACTORS: MEAL & ACTIVITY LOGS
// -----------------------------------------------------------------------------
function extractMealLog(responseText) {
  if (!responseText) return null;

  const blockRegex = /```(?:json:meal_log|json)?\s*([\s\S]*?)\s*```/i;
  const match = responseText.match(blockRegex);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === "meal" || parsed.mealType) {
        return normalizeMealLog(parsed);
      }
    } catch (e) {}
  }

  const jsonRegex = /\{[\s\S]*?"mealType"[\s\S]*?"totalCalories"[\s\S]*?\}/;
  const rawMatch = responseText.match(jsonRegex);
  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[0]);
      return normalizeMealLog(parsed);
    } catch (e) {}
  }

  return null;
}

function normalizeMealLog(raw) {
  let mealKey = "breakfast";
  const mType = (raw.mealType || "").toLowerCase();
  if (mType.includes("trưa") || mType.includes("trua")) mealKey = "lunch";
  else if (mType.includes("tối") || mType.includes("toi")) mealKey = "dinner";
  else if (mType.includes("phụ") || mType.includes("phu") || mType.includes("vặt") || mType.includes("snack")) mealKey = "snack";
  else mealKey = "breakfast";

  const items = Array.isArray(raw.items) ? raw.items.map(it => ({
    name: it.name || "Món ăn",
    calories: parseInt(it.calories || it.cals || 0, 10),
    protein: it.protein || 0,
    carbs: it.carbs || 0,
    fat: it.fat || 0
  })) : [];

  const totalCalories = raw.totalCalories ? parseInt(raw.totalCalories, 10) : items.reduce((s, i) => s + i.calories, 0);

  return {
    type: "meal",
    mealType: raw.mealType || "Bữa ăn",
    mealKey,
    items,
    totalCalories,
    notes: raw.notes || ""
  };
}

function extractActivityLog(responseText) {
  if (!responseText) return null;

  const blockRegex = /```(?:json:activity_log|json)?\s*([\s\S]*?)\s*```/i;
  const match = responseText.match(blockRegex);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === "activity" || (parsed.name && parsed.calories && parsed.duration !== undefined)) {
        return {
          type: "activity",
          name: parsed.name || "Hoạt động thể chất",
          duration: parseInt(parsed.duration || 30, 10),
          calories: parseInt(parsed.calories || 150, 10),
          notes: parsed.notes || ""
        };
      }
    } catch (e) {}
  }

  return null;
}

function autoLogMealToHealthTracker(mealLog, dateStr) {
  if (!mealLog || !mealLog.items || mealLog.items.length === 0) return;

  const log = getDailyLog(dateStr);
  const targetMealList = log.meals[mealLog.mealKey];

  mealLog.items.forEach(item => {
    targetMealList.push({
      id: "meal_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: item.name,
      calories: item.calories,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      isAiLogged: true,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    });
  });

  saveDailyLogs();
  renderHealthTracker();
  showToast(`🍽️ Đã tự động thêm ${mealLog.totalCalories} kcal (${mealLog.mealType}) vào Nhật Ký Sức Khỏe!`, "success");
}

function autoLogActivityToHealthTracker(actLog, dateStr) {
  if (!actLog || !actLog.calories) return;

  const log = getDailyLog(dateStr);
  log.activities.push({
    id: "act_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    name: actLog.name,
    duration: actLog.duration,
    calories: actLog.calories,
    time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  });

  saveDailyLogs();
  renderHealthTracker();
  showToast(`🏃‍♂️ Đã tự động ghi nhận: ${actLog.name} (+${actLog.calories} kcal) vào Calo Tiêu Hao!`, "success");
}

// =============================================================================
// 6. CHAT UI RENDERING & MESSAGING
// =============================================================================
function renderChatMessages() {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  container.innerHTML = "";

  state.chatMessages.forEach(msg => {
    const itemEl = document.createElement("div");
    itemEl.className = `message-item ${msg.role}`;

    const avatarEl = document.createElement("div");
    avatarEl.className = "message-avatar";
    avatarEl.innerHTML = msg.role === "user"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v8"></path><path d="m4.93 10.93 1.41 1.41"></path><path d="M2 18h2"></path><path d="M20 18h2"></path><path d="m19.07 10.93-1.41 1.41"></path><path d="M22 22H2"></path><path d="m16 6-4 4-4-4"></path><path d="M16 18a4 4 0 0 0-8 0"></path></svg>`;

    const bubbleEl = document.createElement("div");
    bubbleEl.className = "message-bubble";

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    // KEY FIX: If message is in typing state, render animated bouncing dots (never escape it as text!)
    if (msg.isTyping) {
      contentEl.innerHTML = `
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      `;
    } else {
      let cleanText = (msg.content || "")
        .replace(/```(?:json:meal_log|json:activity_log|json)?\s*[\s\S]*?```/g, "")
        .trim();
      contentEl.innerHTML = formatMarkdown(cleanText);

      // Render Meal Action Card if present
      if (msg.mealLog) {
        contentEl.appendChild(createMealActionCard(msg.mealLog));
      }

      // Render Activity Action Card if present
      if (msg.activityLog) {
        contentEl.appendChild(createActivityActionCard(msg.activityLog));
      }
    }

    const metaEl = document.createElement("div");
    metaEl.className = "message-meta";
    metaEl.textContent = `${msg.role === "user" ? "Bạn" : "NutriAI"} • ${msg.timestamp}`;

    bubbleEl.appendChild(contentEl);
    bubbleEl.appendChild(metaEl);

    itemEl.appendChild(avatarEl);
    itemEl.appendChild(bubbleEl);
    container.appendChild(itemEl);
  });

  scrollChatToBottom();
}

function createMealActionCard(mealLog) {
  const card = document.createElement("div");
  card.className = "meal-action-card";

  let itemsRows = "";
  mealLog.items.forEach(it => {
    itemsRows += `
      <tr>
        <td><strong>${escapeHtml(it.name)}</strong></td>
        <td style="text-align:right; font-weight:700; color:#f59e0b;">+${it.calories} kcal</td>
      </tr>
    `;
  });

  card.innerHTML = `
    <div class="meal-action-header">
      <div class="meal-action-badge">
        <span>🍽️ ${escapeHtml(mealLog.mealType)}</span>
      </div>
      <div class="meal-action-status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Đã ghi vào Sức Khỏe</span>
      </div>
    </div>

    <table class="meal-items-table">
      <thead>
        <tr>
          <th>Món ăn / Khẩu phần</th>
          <th style="text-align:right;">Calo</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="meal-action-footer">
      <div class="total-calories-tag">
        Tổng cộng: <span>${mealLog.totalCalories} kcal</span>
      </div>
      <button type="button" class="btn-view-tracker" onclick="switchTab('tab-health')">
        <span>Xem trong Sức Khỏe</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;

  return card;
}

function createActivityActionCard(activityLog) {
  const card = document.createElement("div");
  card.className = "activity-action-card";

  card.innerHTML = `
    <div class="meal-action-header">
      <div class="activity-action-badge">
        <span>🏃‍♂️ Hoạt Động Thể Chất</span>
      </div>
      <div class="meal-action-status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Đã ghi vào Tiêu Hao</span>
      </div>
    </div>

    <div class="activity-action-desc">
      <div>
        <strong>${escapeHtml(activityLog.name)}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">Thời gian: ${activityLog.duration} phút</div>
      </div>
      <div style="font-size:1.1rem; font-weight:800; color:#0ea5e9;">
        +${activityLog.calories} kcal
      </div>
    </div>

    <div class="meal-action-footer">
      <span style="font-size:0.78rem; color:var(--text-muted);">Calo tiêu hao đã được cộng vào tổng ngày</span>
      <button type="button" class="btn-view-tracker" onclick="switchTab('tab-health')">
        <span>Xem trong Sức Khỏe</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;

  return card;
}

function scrollChatToBottom() {
  const container = document.getElementById("chat-messages");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

async function handleSendMessage(text) {
  if (!text || !text.trim() || state.isGenerating) return;

  const userText = text.trim();
  const timeNow = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  // 1. Add User Message
  const userMsg = {
    id: "msg_" + Date.now(),
    role: "user",
    content: userText,
    timestamp: timeNow,
    mealLog: null,
    activityLog: null,
    isTyping: false
  };
  state.chatMessages.push(userMsg);
  saveChatMessages();
  renderChatMessages();

  // Reset input field
  const inputEl = document.getElementById("chat-input");
  if (inputEl) {
    inputEl.value = "";
    inputEl.style.height = "auto";
  }

  // 2. Add Typing Placeholder (FLAGGED with isTyping: true, empty content)
  state.isGenerating = true;
  updateSendButtonState();

  const tempAssistantId = "temp_" + Date.now();
  const tempMsg = {
    id: tempAssistantId,
    role: "assistant",
    content: "",
    timestamp: timeNow,
    mealLog: null,
    activityLog: null,
    isTyping: true // <--- CLEAN BOOLEAN FLAG
  };
  state.chatMessages.push(tempMsg);
  renderChatMessages();

  try {
    const apiMessages = state.chatMessages
      .filter(m => m.id !== tempAssistantId && !m.isTyping)
      .map(m => ({ role: m.role, content: m.content }));

    const responseText = await requestAiCompletion(apiMessages);

    // Extract potential meal or activity logs
    const mealLog = extractMealLog(responseText);
    const activityLog = extractActivityLog(responseText);

    if (mealLog) {
      autoLogMealToHealthTracker(mealLog, state.selectedDate);
    }
    if (activityLog) {
      autoLogActivityToHealthTracker(activityLog, state.selectedDate);
    }

    const finalMsg = {
      id: "asst_" + Date.now(),
      role: "assistant",
      content: responseText,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      mealLog,
      activityLog,
      isTyping: false
    };

    const idx = state.chatMessages.findIndex(m => m.id === tempAssistantId);
    if (idx !== -1) {
      state.chatMessages[idx] = finalMsg;
    } else {
      state.chatMessages.push(finalMsg);
    }
  } catch (err) {
    console.error("Lỗi AI Chat:", err);
    const errIdx = state.chatMessages.findIndex(m => m.id === tempAssistantId);
    const errorText = `⚠️ **Không thể kết nối đến máy chủ AI:**\n${err.message}\n\n*Gợi ý:* Bạn có thể vào tab **"Thêm & Cài Đặt API"** để kiểm tra lại API Key Google Gemini hoặc chuyển sang **"Chế Độ Demo"** để ứng dụng hoạt động ngay lập tức!`;
    const errorMsg = {
      id: "err_" + Date.now(),
      role: "assistant",
      content: errorText,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      mealLog: null,
      activityLog: null,
      isTyping: false
    };

    if (errIdx !== -1) {
      state.chatMessages[errIdx] = errorMsg;
    } else {
      state.chatMessages.push(errorMsg);
    }
    showToast("Lỗi kết nối AI: " + err.message, "error");
  } finally {
    state.isGenerating = false;
    // Remove any leftover typing item
    state.chatMessages = state.chatMessages.filter(m => !m.isTyping);
    updateSendButtonState();
    saveChatMessages();
    renderChatMessages();
  }
}

function updateSendButtonState() {
  const btn = document.getElementById("btn-send-message");
  if (btn) {
    btn.disabled = state.isGenerating;
  }
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^\s*-\s+(.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
  html = html.replace(/\n\n+/g, "<br><br>");
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// =============================================================================
// 7. HEALTH TRACKER CALCULATIONS & RENDERING
// =============================================================================
function renderHealthTracker() {
  const profile = state.profile;
  const dateStr = state.selectedDate;
  const dayLog = getDailyLog(dateStr);

  const datePicker = document.getElementById("health-date-picker");
  if (datePicker) datePicker.value = dateStr;

  const displayDateTitle = document.getElementById("display-date-title");
  if (displayDateTitle) {
    const isToday = dateStr === getTodayDateString();
    const parsedDate = new Date(dateStr + "T00:00:00");
    const dateFormatted = parsedDate.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    displayDateTitle.textContent = isToday ? `Hôm nay, ${parsedDate.toLocaleDateString("vi-VN")}` : dateFormatted;
  }

  const badgeEnergyDate = document.getElementById("badge-energy-date");
  if (badgeEnergyDate) badgeEnergyDate.textContent = dateStr;

  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const targetCals = calculateTargetCalories(tdee, profile.goal);
  const bmi = calculateBMI(profile.weight, profile.height);
  const bmiInfo = getBmiCategory(bmi);

  const elBmr = document.getElementById("val-bmr");
  if (elBmr) elBmr.textContent = bmr.toLocaleString("vi-VN");

  const elTdee = document.getElementById("val-tdee");
  if (elTdee) elTdee.textContent = tdee.toLocaleString("vi-VN");

  const elTarget = document.getElementById("val-target-calories");
  if (elTarget) elTarget.textContent = targetCals.toLocaleString("vi-VN");

  const elBmi = document.getElementById("val-bmi");
  if (elBmi) {
    elBmi.textContent = bmi;
    elBmi.style.color = bmiInfo.color;
  }

  const elBmiCat = document.getElementById("val-bmi-category");
  if (elBmiCat) {
    elBmiCat.textContent = bmiInfo.label;
    elBmiCat.style.color = bmiInfo.color;
  }

  const elBmiPointer = document.getElementById("bmi-pointer");
  if (elBmiPointer) {
    elBmiPointer.style.left = `${bmiInfo.pos}%`;
    elBmiPointer.style.borderColor = bmiInfo.color;
  }

  let totalIntake = 0;
  const mealKeys = ["breakfast", "lunch", "dinner", "snack"];
  mealKeys.forEach(mKey => {
    (dayLog.meals[mKey] || []).forEach(item => {
      totalIntake += (item.calories || 0);
    });
  });

  let totalActivityBurn = (dayLog.activities || []).reduce((sum, act) => sum + (act.calories || 0), 0);
  let totalBurned = bmr + totalActivityBurn;
  let netBalance = totalIntake - totalBurned;

  const statIntake = document.getElementById("stat-intake-total");
  if (statIntake) statIntake.textContent = totalIntake.toLocaleString("vi-VN");

  const statBurn = document.getElementById("stat-burn-total");
  if (statBurn) statBurn.textContent = totalBurned.toLocaleString("vi-VN");

  const statNet = document.getElementById("stat-net-total");
  const statNetDesc = document.getElementById("stat-net-desc");
  if (statNet && statNetDesc) {
    statNet.textContent = (netBalance > 0 ? "+" : "") + netBalance.toLocaleString("vi-VN");
    if (netBalance < -100) {
      statNet.className = "hero-stat-value net deficit";
      statNetDesc.textContent = "Thâm hụt calo (Tốt để giảm cân)";
    } else if (netBalance > 100) {
      statNet.className = "hero-stat-value net surplus";
      statNetDesc.textContent = "Thặng dư calo (Tăng cân)";
    } else {
      statNet.className = "hero-stat-value net";
      statNetDesc.textContent = "Cân bằng năng lượng";
    }
  }

  const elBurnBmr = document.getElementById("val-burn-bmr");
  if (elBurnBmr) elBurnBmr.textContent = bmr.toLocaleString("vi-VN");

  const elBurnExercise = document.getElementById("val-burn-exercise");
  if (elBurnExercise) elBurnExercise.textContent = totalActivityBurn.toLocaleString("vi-VN");

  const badgeTotalActivity = document.getElementById("badge-total-activity-burn");
  if (badgeTotalActivity) badgeTotalActivity.textContent = totalActivityBurn.toLocaleString("vi-VN");

  const progressVal = document.getElementById("progress-text-val");
  if (progressVal) progressVal.textContent = totalIntake.toLocaleString("vi-VN");

  const progressTarget = document.getElementById("progress-text-target");
  if (progressTarget) progressTarget.textContent = targetCals.toLocaleString("vi-VN");

  const progressBar = document.getElementById("intake-progress-bar");
  if (progressBar) {
    const pct = targetCals > 0 ? Math.min(100, Math.round((totalIntake / targetCals) * 100)) : 0;
    progressBar.style.width = `${pct}%`;
    progressBar.className = totalIntake > targetCals ? "progress-bar-fill over" : "progress-bar-fill";
  }

  const alertBanner = document.getElementById("balance-alert-banner");
  const alertText = document.getElementById("balance-alert-text");
  if (alertBanner && alertText) {
    if (netBalance <= -300) {
      alertBanner.className = "balance-status-alert deficit";
      alertText.textContent = `Tuyệt vời! Bạn đang thâm hụt ${Math.abs(netBalance)} kcal hôm nay, cơ thể đang đốt mỡ hiệu quả.`;
    } else if (netBalance > 300) {
      alertBanner.className = "balance-status-alert surplus";
      alertText.textContent = `Chú ý: Bạn đang dư thừa ${netBalance} kcal hôm nay. Có thể vận động thêm 30p để cân bằng!`;
    } else {
      alertBanner.className = "balance-status-alert balanced";
      alertText.textContent = `Mức năng lượng hiện tại khá cân bằng (Hiệu số: ${netBalance} kcal).`;
    }
  }

  renderActivityList(dayLog.activities || []);
  renderMealBlocks(dayLog.meals || {});
  renderHistoryChart();
}

function renderActivityList(activities) {
  const container = document.getElementById("activity-items-list");
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `<div class="empty-meal-text">Chưa ghi nhận hoạt động thể chất nào trong ngày này. Hãy bấm gợi ý hoặc thêm bên trên!</div>`;
    return;
  }

  container.innerHTML = "";
  activities.forEach((act, idx) => {
    const itemEl = document.createElement("div");
    itemEl.className = "activity-item";
    itemEl.innerHTML = `
      <div class="activity-item-info">
        <span style="font-size: 1.1rem;">🏃‍♂️</span>
        <div>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(act.name)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${act.duration || 30} phút • ${act.time || ""}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <span class="activity-badge-burn">+${act.calories} kcal</span>
        <button type="button" class="btn-delete-row" title="Xóa" onclick="deleteActivity(${idx})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
    container.appendChild(itemEl);
  });
}

function deleteActivity(index) {
  const dayLog = getDailyLog(state.selectedDate);
  if (dayLog.activities && dayLog.activities[index] !== undefined) {
    dayLog.activities.splice(index, 1);
    saveDailyLogs();
    renderHealthTracker();
    showToast("Đã xóa hoạt động thể chất.", "info");
  }
}

function renderMealBlocks(meals) {
  const container = document.getElementById("meals-blocks-container");
  if (!container) return;

  const mealDefs = [
    { key: "breakfast", name: "Bữa Sáng", icon: "🍳" },
    { key: "lunch", name: "Bữa Trưa", icon: "🍜" },
    { key: "dinner", name: "Bữa Tối", icon: "🍲" },
    { key: "snack", name: "Bữa Phụ / Ăn Vặt", icon: "🧋" }
  ];

  container.innerHTML = "";

  mealDefs.forEach(def => {
    const list = meals[def.key] || [];
    const mealCals = list.reduce((sum, item) => sum + (item.calories || 0), 0);

    const block = document.createElement("div");
    block.className = "meal-block";

    let foodItemsHtml = "";
    if (list.length === 0) {
      foodItemsHtml = `<div class="empty-meal-text">Chưa có món nào. Nhắn với Trợ lý AI hoặc bấm "+ Thêm món"</div>`;
    } else {
      list.forEach((item, idx) => {
        foodItemsHtml += `
          <div class="meal-food-entry">
            <div class="food-entry-left">
              <span style="font-weight:600;">${escapeHtml(item.name)}</span>
              ${item.isAiLogged ? `<span class="ai-logged-badge" title="Được ghi tự động từ Trợ lý Chat AI">✨ AI ghi nhận</span>` : ""}
            </div>
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="font-weight:700; color:#f59e0b;">+${item.calories} kcal</span>
              <button type="button" class="btn-delete-row" title="Xóa món này" onclick="deleteFoodItem('${def.key}', ${idx})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        `;
      });
    }

    block.innerHTML = `
      <div class="meal-block-header">
        <div class="meal-title-wrap">
          <span>${def.icon}</span>
          <span class="meal-name">${def.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="meal-cal-badge">${mealCals} kcal</span>
          <button type="button" class="btn-subtle" style="padding:2px 6px; font-size:0.75rem;" onclick="openAddFoodModalForMeal('${def.key}')" title="Thêm món cho ${def.name}">+ Thêm</button>
        </div>
      </div>
      <div class="meal-items-list">
        ${foodItemsHtml}
      </div>
    `;

    container.appendChild(block);
  });
}

function deleteFoodItem(mealKey, index) {
  const dayLog = getDailyLog(state.selectedDate);
  if (dayLog.meals && dayLog.meals[mealKey] && dayLog.meals[mealKey][index] !== undefined) {
    dayLog.meals[mealKey].splice(index, 1);
    saveDailyLogs();
    renderHealthTracker();
    showToast("Đã xóa món ăn khỏi nhật ký.", "info");
  }
}

function renderHistoryChart() {
  const container = document.getElementById("history-chart-bars");
  if (!container) return;

  container.innerHTML = "";

  const profile = state.profile;
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

  const days = [];
  const curr = new Date(state.selectedDate + "T00:00:00");
  for (let i = 6; i >= 0; i--) {
    const d = new Date(curr);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dStr = `${yyyy}-${mm}-${dd}`;
    days.push({
      dateStr: dStr,
      label: `${dd}/${mm}`,
      isCurrent: dStr === state.selectedDate
    });
  }

  let maxCal = 2500;
  const dayStats = days.map(day => {
    const log = state.dailyLogs[day.dateStr] || { meals: {}, activities: [] };
    let intake = 0;
    ["breakfast", "lunch", "dinner", "snack"].forEach(k => {
      (log.meals[k] || []).forEach(it => intake += (it.calories || 0));
    });
    const actBurn = (log.activities || []).reduce((s, a) => s + (a.calories || 0), 0);
    const totalBurn = bmr + actBurn;

    if (intake > maxCal) maxCal = intake;
    if (totalBurn > maxCal) maxCal = totalBurn;

    return { ...day, intake, totalBurn };
  });

  dayStats.forEach(stat => {
    const intakeHeight = Math.max(4, Math.round((stat.intake / maxCal) * 110));
    const burnHeight = Math.max(4, Math.round((stat.totalBurn / maxCal) * 110));

    const col = document.createElement("div");
    col.className = "bar-col";
    col.style.cursor = "pointer";
    col.title = `${stat.dateStr}: Nạp ${stat.intake} kcal | Tiêu hao ${stat.totalBurn} kcal (Bấm để xem ngày này)`;
    col.onclick = () => {
      state.selectedDate = stat.dateStr;
      renderHealthTracker();
    };

    col.innerHTML = `
      <div class="bar-dual">
        <div class="bar-stick intake" style="height: ${intakeHeight}px;" title="Nạp: ${stat.intake} kcal"></div>
        <div class="bar-stick burn" style="height: ${burnHeight}px;" title="Tiêu hao: ${stat.totalBurn} kcal"></div>
      </div>
      <div class="bar-col-label" style="${stat.isCurrent ? 'font-weight:700; color:var(--accent-primary);' : ''}">${stat.label}</div>
    `;

    container.appendChild(col);
  });
}
// =============================================================================
// 8. API SETTINGS & VERIFICATION
// =============================================================================
function syncApiSettingsUI() {
  const config = state.apiConfig;

  const statusDot = document.getElementById("api-status-dot");
  const statusText = document.getElementById("api-status-text");
  const chatModelName = document.getElementById("chat-model-name");

  if (config.provider === "demo") {
    if (statusDot) statusDot.className = "status-dot demo";
    if (statusText) statusText.textContent = "Chế độ Demo (Mô phỏng)";
    if (chatModelName) chatModelName.textContent = "NutriAI Smart Simulator (Demo)";
  } else if (config.apiKey && config.apiKey.trim()) {
    if (statusDot) statusDot.className = "status-dot active";
    if (statusText) statusText.textContent = `Gemini: ${config.model || "gemini-flash-latest"}`;
    if (chatModelName) chatModelName.textContent = `NutriAI Assistant (${config.model || "gemini-flash-latest"})`;
  } else {
    if (statusDot) statusDot.className = "status-dot";
    if (statusText) statusText.textContent = "Chưa có API Key";
    if (chatModelName) chatModelName.textContent = "NutriAI (Chưa cấu hình API Key)";
  }

  document.querySelectorAll(".provider-card").forEach(card => {
    const prov = card.getAttribute("data-provider");
    card.classList.toggle("active", prov === config.provider);
  });

  const inputKey = document.getElementById("input-api-key");
  if (inputKey) inputKey.value = config.apiKey || "";

  const inputUrl = document.getElementById("input-api-url");
  if (inputUrl) inputUrl.value = config.baseUrl || PROVIDER_PRESETS.gemini.baseUrl;

  const selectModel = document.getElementById("select-model-preset");
  const inputCustomModel = document.getElementById("input-model-custom");

  if (inputCustomModel) inputCustomModel.value = config.model || "gemini-flash-latest";
  if (selectModel) {
    let found = false;
    for (let opt of selectModel.options) {
      if (opt.value === config.model) {
        selectModel.value = config.model;
        found = true;
        break;
      }
    }
    if (!found) selectModel.value = "custom";
  }

  const inputTemp = document.getElementById("input-temperature");
  const labelTemp = document.getElementById("label-temp-val");
  if (inputTemp) inputTemp.value = config.temperature !== undefined ? config.temperature : 0.5;
  if (labelTemp) labelTemp.textContent = config.temperature !== undefined ? config.temperature : "0.5";

  const promptInput = document.getElementById("input-system-prompt");
  if (promptInput) promptInput.value = state.systemPrompt;
}

async function testApiConnection() {
  const resultEl = document.getElementById("test-conn-result");
  const btnTest = document.getElementById("btn-test-connection");

  if (!resultEl || !btnTest) return;

  const { provider, apiKey, baseUrl, model } = state.apiConfig;

  if (provider === "demo") {
    resultEl.className = "conn-test-result success";
    resultEl.innerHTML = `<span>✅ Chế độ Demo đang hoạt động tốt. Sẵn sàng phân tích tự động calo thức ăn và vận động mà không cần API key!</span>`;
    return;
  }

  if (!apiKey || !apiKey.trim()) {
    resultEl.className = "conn-test-result error";
    resultEl.innerHTML = `<span>⚠️ Vui lòng nhập API Key trước khi kiểm tra kết nối.</span>`;
    return;
  }

  btnTest.disabled = true;
  resultEl.className = "conn-test-result";
  resultEl.style.display = "flex";
  resultEl.innerHTML = `<span>⏳ Đang kiểm tra kết nối tới Google Gemini (${escapeHtml(model || "gemini-flash-latest")})...</span>`;

  const startTime = Date.now();

  try {
    const testMessages = [
      { role: "user", content: "Explain how AI works in a few words" }
    ];

    const response = await requestAiCompletion(testMessages);
    const latency = Date.now() - startTime;

    resultEl.className = "conn-test-result success";
    resultEl.innerHTML = `<span>✅ Kết nối thành công tới mô hình <strong>${escapeHtml(model || "gemini-flash-latest")}</strong> (${latency}ms)!<br>Phản hồi từ Gemini: <em>"${escapeHtml(response.slice(0, 100))}..."</em></span>`;
    showToast("Kết nối Gemini API thành công!", "success");
  } catch (err) {
    resultEl.className = "conn-test-result error";
    resultEl.innerHTML = `<span>❌ Kết nối thất bại: ${escapeHtml(err.message)}</span>`;
    showToast("Kết nối API thất bại: " + err.message, "error");
  } finally {
    btnTest.disabled = false;
  }
}

// =============================================================================
// 9. MODALS & UI HELPERS
// =============================================================================
function switchTab(targetTabId) {
  state.currentTab = targetTabId;

  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === targetTabId);
  });

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === targetTabId);
  });

  if (targetTabId === "tab-health") {
    renderHealthTracker();
  } else if (targetTabId === "tab-chat") {
    scrollChatToBottom();
  } else if (targetTabId === "tab-api") {
    syncApiSettingsUI();
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-message ${type}`;

  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  else if (type === "error") icon = "⚠️";

  toast.innerHTML = `
    <span style="font-size:1.1rem;">${icon}</span>
    <div style="flex:1;">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

function openAddFoodModalForMeal(mealKey) {
  const modal = document.getElementById("modal-add-food");
  const selectMeal = document.getElementById("manual-food-meal");
  if (selectMeal) selectMeal.value = mealKey;
  if (modal) modal.classList.add("open");
}

function closeAddFoodModal() {
  const modal = document.getElementById("modal-add-food");
  if (modal) modal.classList.remove("open");
  const form = document.getElementById("form-manual-food");
  if (form) form.reset();
}

function openPromptViewModal() {
  const modal = document.getElementById("modal-view-prompt");
  const pre = document.getElementById("prompt-preview-code");
  if (pre) pre.textContent = state.systemPrompt;
  if (modal) modal.classList.add("open");
}

function closePromptViewModal() {
  const modal = document.getElementById("modal-view-prompt");
  if (modal) modal.classList.remove("open");
}

// =============================================================================
// 10. INITIALIZATION & EVENT LISTENERS
// =============================================================================
if (typeof document !== "undefined") { document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = safeStorage.getItem(STORAGE_KEYS.APP_THEME) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.onclick = () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      safeStorage.setItem(STORAGE_KEYS.APP_THEME, next);
    };
  }

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", e => {
      e.preventDefault();
      handleSendMessage(chatInput.value);
    });

    chatInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(chatInput.value);
      }
    });

    chatInput.addEventListener("input", () => {
      chatInput.style.height = "auto";
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 140)}px`;
    });
  }

  document.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) handleSendMessage(prompt);
    });
  });

  const btnClearChat = document.getElementById("btn-clear-chat");
  if (btnClearChat) {
    btnClearChat.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không?")) {
        state.chatMessages = loadChatMessages().slice(0, 1);
        saveChatMessages();
        renderChatMessages();
        showToast("Đã làm mới cuộc trò chuyện.", "info");
      }
    });
  }

  const btnViewPrompt = document.getElementById("btn-view-prompt");
  if (btnViewPrompt) {
    btnViewPrompt.addEventListener("click", openPromptViewModal);
  }

  const btnDatePrev = document.getElementById("btn-date-prev");
  const btnDateNext = document.getElementById("btn-date-next");
  const btnDateToday = document.getElementById("btn-date-today");
  const datePicker = document.getElementById("health-date-picker");

  if (btnDatePrev) {
    btnDatePrev.addEventListener("click", () => {
      const d = new Date(state.selectedDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      state.selectedDate = d.toISOString().split("T")[0];
      renderHealthTracker();
    });
  }

  if (btnDateNext) {
    btnDateNext.addEventListener("click", () => {
      const d = new Date(state.selectedDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      state.selectedDate = d.toISOString().split("T")[0];
      renderHealthTracker();
    });
  }

  if (btnDateToday) {
    btnDateToday.addEventListener("click", () => {
      state.selectedDate = getTodayDateString();
      renderHealthTracker();
    });
  }

  if (datePicker) {
    datePicker.addEventListener("change", e => {
      if (e.target.value) {
        state.selectedDate = e.target.value;
        renderHealthTracker();
      }
    });
  }

  const btnSaveProfile = document.getElementById("btn-save-profile");
  if (btnSaveProfile) {
    const p = state.profile;
    document.getElementById("user-gender").value = p.gender;
    document.getElementById("user-age").value = p.age;
    document.getElementById("user-height").value = p.height;
    document.getElementById("user-weight").value = p.weight;
    document.getElementById("user-activity-level").value = p.activityLevel;
    document.getElementById("user-goal").value = p.goal;

    const saveAction = () => {
      state.profile = {
        gender: document.getElementById("user-gender").value,
        age: parseInt(document.getElementById("user-age").value, 10) || 25,
        height: parseFloat(document.getElementById("user-height").value) || 170,
        weight: parseFloat(document.getElementById("user-weight").value) || 65,
        activityLevel: parseFloat(document.getElementById("user-activity-level").value) || 1.375,
        goal: document.getElementById("user-goal").value
      };
      saveUserProfile(state.profile);
      renderHealthTracker();
      showToast("Đã cập nhật chỉ số thể chất & BMR thành công!", "success");
    };

    btnSaveProfile.addEventListener("click", saveAction);
    ["user-gender", "user-age", "user-height", "user-weight", "user-activity-level", "user-goal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", saveAction);
    });
  }

  document.querySelectorAll(".quick-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-act-name");
      const time = parseInt(btn.getAttribute("data-act-time"), 10) || 30;
      const cal = parseInt(btn.getAttribute("data-act-cal"), 10) || 200;

      const dayLog = getDailyLog(state.selectedDate);
      dayLog.activities.push({
        id: "act_" + Date.now(),
        name,
        duration: time,
        calories: cal,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      });
      saveDailyLogs();
      renderHealthTracker();
      showToast(`Đã thêm hoạt động: ${name} (+${cal} kcal)`, "success");
    });
  });

  const formAddActivity = document.getElementById("form-add-activity");
  if (formAddActivity) {
    formAddActivity.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("act-input-name").value.trim();
      const time = parseInt(document.getElementById("act-input-time").value, 10) || 30;
      const cal = parseInt(document.getElementById("act-input-cal").value, 10) || 0;

      if (!name || cal <= 0) return;

      const dayLog = getDailyLog(state.selectedDate);
      dayLog.activities.push({
        id: "act_" + Date.now(),
        name,
        duration: time,
        calories: cal,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      });

      saveDailyLogs();
      renderHealthTracker();
      formAddActivity.reset();
      showToast(`Đã ghi nhận: ${name} (+${cal} kcal)`, "success");
    });
  }

  const btnOpenAddFood = document.getElementById("btn-open-add-food-modal");
  const btnCloseAddFood = document.getElementById("btn-close-food-modal");
  const btnCancelAddFood = document.getElementById("btn-cancel-food-modal");
  const formManualFood = document.getElementById("form-manual-food");

  if (btnOpenAddFood) btnOpenAddFood.addEventListener("click", () => openAddFoodModalForMeal("breakfast"));
  if (btnCloseAddFood) btnCloseAddFood.addEventListener("click", closeAddFoodModal);
  if (btnCancelAddFood) btnCancelAddFood.addEventListener("click", closeAddFoodModal);

  if (formManualFood) {
    formManualFood.addEventListener("submit", e => {
      e.preventDefault();
      const mealKey = document.getElementById("manual-food-meal").value;
      const name = document.getElementById("manual-food-name").value.trim();
      const cal = parseInt(document.getElementById("manual-food-cal").value, 10) || 0;

      if (!name || cal <= 0) return;

      const dayLog = getDailyLog(state.selectedDate);
      dayLog.meals[mealKey].push({
        id: "meal_manual_" + Date.now(),
        name,
        calories: cal,
        protein: 0,
        carbs: 0,
        fat: 0,
        isAiLogged: false,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      });

      saveDailyLogs();
      renderHealthTracker();
      closeAddFoodModal();
      showToast(`Đã thêm "${name}" (+${cal} kcal) vào nhật ký.`, "success");
    });
  }

  const btnClosePrompt1 = document.getElementById("btn-close-prompt-modal");
  const btnClosePrompt2 = document.getElementById("btn-close-prompt-modal-2");
  const btnGotoApi = document.getElementById("btn-goto-api-tab");

  if (btnClosePrompt1) btnClosePrompt1.addEventListener("click", closePromptViewModal);
  if (btnClosePrompt2) btnClosePrompt2.addEventListener("click", closePromptViewModal);
  if (btnGotoApi) {
    btnGotoApi.addEventListener("click", () => {
      closePromptViewModal();
      switchTab("tab-api");
    });
  }

  document.querySelectorAll(".provider-card").forEach(card => {
    card.addEventListener("click", () => {
      const prov = card.getAttribute("data-provider");
      state.apiConfig.provider = prov;

      const preset = PROVIDER_PRESETS[prov];
      if (preset) {
        if (prov !== "custom" && preset.baseUrl) {
          state.apiConfig.baseUrl = preset.baseUrl;
        }
        if (preset.model) {
          state.apiConfig.model = preset.model;
        }
      }

      saveApiConfig(state.apiConfig);
      syncApiSettingsUI();
      showToast(`Đã chọn nhà cung cấp: ${preset ? preset.name : prov}`, "info");
    });
  });

  const btnToggleEye = document.getElementById("btn-toggle-key-vis");
  const inputApiKey = document.getElementById("input-api-key");
  if (btnToggleEye && inputApiKey) {
    btnToggleEye.addEventListener("click", () => {
      inputApiKey.type = inputApiKey.type === "password" ? "text" : "password";
    });
  }

  const selectModel = document.getElementById("select-model-preset");
  const inputCustomModel = document.getElementById("input-model-custom");
  if (selectModel && inputCustomModel) {
    selectModel.addEventListener("change", () => {
      if (selectModel.value !== "custom") {
        inputCustomModel.value = selectModel.value;
      }
    });
  }

  const inputTemp = document.getElementById("input-temperature");
  const labelTemp = document.getElementById("label-temp-val");
  if (inputTemp && labelTemp) {
    inputTemp.addEventListener("input", () => {
      labelTemp.textContent = inputTemp.value;
    });
  }

  const formApiSettings = document.getElementById("form-api-settings");
  if (formApiSettings) {
    formApiSettings.addEventListener("submit", e => {
      e.preventDefault();
      const apiKeyVal = document.getElementById("input-api-key").value.trim();
      const baseUrlVal = document.getElementById("input-api-url").value.trim();
      const modelVal = document.getElementById("input-model-custom").value.trim();
      const tempVal = parseFloat(document.getElementById("input-temperature").value);

      state.apiConfig.apiKey = apiKeyVal;
      state.apiConfig.baseUrl = baseUrlVal;
      state.apiConfig.model = modelVal || "gemini-flash-latest";
      state.apiConfig.temperature = tempVal;

      if (apiKeyVal && state.apiConfig.provider === "demo") {
        state.apiConfig.provider = "gemini";
      }

      saveApiConfig(state.apiConfig);
      syncApiSettingsUI();
      showToast("Đã lưu cấu hình API thành công!", "success");
    });
  }

  const btnClearKey = document.getElementById("btn-clear-api-key");
  if (btnClearKey) {
    btnClearKey.addEventListener("click", () => {
      state.apiConfig.apiKey = "";
      state.apiConfig.provider = "demo";
      saveApiConfig(state.apiConfig);
      syncApiSettingsUI();
      showToast("Đã xóa API Key. Đã chuyển về Chế Độ Demo.", "info");
    });
  }

  const btnTestConn = document.getElementById("btn-test-connection");
  if (btnTestConn) {
    btnTestConn.addEventListener("click", testApiConnection);
  }

  const btnSavePrompt = document.getElementById("btn-save-prompt");
  const inputSystemPrompt = document.getElementById("input-system-prompt");
  if (btnSavePrompt && inputSystemPrompt) {
    btnSavePrompt.addEventListener("click", () => {
      const newPrompt = inputSystemPrompt.value.trim();
      if (!newPrompt) {
        showToast("Prompt không được để trống!", "error");
        return;
      }
      saveSystemPrompt(newPrompt);
      showToast("Đã lưu Prompt hệ thống mới!", "success");
    });
  }

  const btnResetPrompt = document.getElementById("btn-reset-prompt");
  if (btnResetPrompt && inputSystemPrompt) {
    btnResetPrompt.addEventListener("click", () => {
      if (confirm("Bạn có muốn khôi phục lại Prompt hệ thống mặc định chuẩn không?")) {
        saveSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        inputSystemPrompt.value = DEFAULT_SYSTEM_PROMPT;
        showToast("Đã khôi phục Prompt chuẩn thành công!", "success");
      }
    });
  }

  syncApiSettingsUI();
  renderChatMessages();
  renderHealthTracker();
});
}