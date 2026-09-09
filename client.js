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
  APP_THEME: "nutriai_theme",
  PERSONALITY: "nutriai_personality"
};

const DEFAULT_SYSTEM_PROMPT = `Bạn là Chuyên gia Dinh dưỡng & Huấn luyện viên Thể chất NutriAI thông minh.
Nhiệm vụ chính của bạn:
1. KHI NGƯỜI DÙNG KỂ VỀ MÓN ĂN / ĐỒ UỐNG / CẬP NHẬT BỮA ĂN (ví dụ: "bữa sáng tôi ăn 2 quả trứng 1 cái ngô", "mình ăn thêm 1 quả táo vào bữa tối", "sửa bữa tối thành..."):
   - Phân tích bữa ăn (Bữa sáng, Bữa trưa, Bữa tối, hoặc Bữa phụ).
   - Xác định hành động của người dùng ("action"):
     + "add": Người dùng ăn bữa mới HOẶC ăn thêm món vào bữa đã có (ví dụ: "bữa tối mình ăn thêm 1 quả táo"). Khi action là "add", danh sách items CHỈ chứa các món mới ăn thêm (hoặc món mới chưa có).
     + "update": Người dùng muốn cập nhật/thay thế/sửa lại bữa ăn (ví dụ: "sửa bữa tối thành...", "bữa tối đổi lại là...", hoặc khi bạn tổng hợp lại toàn bộ bữa ăn gồm cả món cũ và món mới). Khi action là "update", danh sách items chứa toàn bộ các món của bữa ăn sau khi cập nhật.
     + "delete": Người dùng muốn xóa món ăn khỏi bữa (ví dụ: "bỏ món trứng ở bữa tối", "xóa bữa tối").
   - Phân tích chi tiết từng món: ước lượng khẩu phần, tính chính xác số calo (kcal) và 3 chất dinh dưỡng đa lượng thiết yếu: Protein (g), Carbs (g), Fat (g).
   - Tính tổng calo và tổng macro nạp vào, đưa ra nhận xét khoa học ngắn gọn về chất lượng bữa ăn.
   - BẮT BUỘC chèn khối JSON ở cuối tin nhắn:
\`\`\`json:meal_log
{
  "type": "meal",
  "action": "add",
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
  "action": "add",
  "name": "Đi bộ buổi sáng",
  "duration": 31,
  "calories": 150,
  "notes": "Ghi nhận đi bộ theo đồng hồ thông minh"
}
\`\`\`

3. KHI NGƯỜI DÙNG HỎI KIỂM TRA ĐỦ CHẤT HAY THỪA / THIẾU CHẤT GÌ TRONG NGÀY (ví dụ: "hôm nay tôi đã đủ chất chưa?", "hôm nay có thừa hay thiếu chất gì không?", "kiểm tra dinh dưỡng hôm nay", "hôm nay ăn vậy đã đủ chất chưa"):
   - Hãy xem kỹ phần [DỮ LIỆU NHẬT KÝ SỨC KHỎE NGÀY ĐANG CHỌN] và [TỔNG HỢP DINH DƯỠNG & ĐÁNH GIÁ ĐỦ/THỪA CHẤT TRONG NGÀY] được cung cấp trong ngữ cảnh hệ thống.
   - Phân tích chi tiết cả 4 chỉ số: Tổng Calo, Protein (chất đạm), Carbs (tinh bột), Fat (chất béo) so với nhu cầu khuyến nghị theo thể trạng người dùng.
   - Trả lời rõ ràng, khoa học và mạch lạc:
     + Đánh giá tổng quan: Ngày hôm nay đã ĐỦ CHẤT chưa?
     + Đánh giá từng chất: Chất nào đã ĐỦ, chất nào đang THIẾU (thiếu bao nhiêu gam/calo), chất nào đang THỪA (thừa bao nhiêu gam/calo).
     + Nêu rõ nguyên nhân: Nhóm món ăn nào đã đóng góp lượng chất đó.
     + Lời khuyên thiết thực: Nếu thiếu Protein thì bữa tiếp theo nên ăn thêm gì (ức gà, trứng, đậu hũ, tôm, cá...); nếu thừa Carb/Fat thì nên cắt giảm món nào hoặc cần vận động thêm bao nhiêu phút để cân bằng lại.
   - Trường hợp này KHÔNG cần xuất khối JSON nếu người dùng không kể thêm món ăn mới.

4. Với các câu hỏi tư vấn thông thường, trả lời nhiệt tình, dễ hiểu và không cần kèm khối JSON.
5. Luôn sử dụng tiếng Việt thân thiện, rõ ràng, định dạng sinh động.`;

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
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1:free",
      "qwen/qwen-2.5-72b-instruct",
      "mistralai/mistral-7b-instruct:free",
      "openai/gpt-4o-mini"
    ]
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

const PERSONALITIES = {
  cheerful: {
    id: "cheerful",
    name: "Vui vẻ & Năng động",
    emoji: "😊",
    tag: "Tích cực",
    desc: "Nhiệt tình, tươi sáng, dùng nhiều icon vui vẻ, luôn khích lệ bạn tiến bộ mỗi ngày.",
    sampleQuote: "Chào bạn yêu! 🎉 Bữa này nhìn ngon và đủ chất quá nè! Cùng cố gắng để giữ vững phong độ nhé! 💪✨",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: VUI VẺ & NĂNG ĐỘNG (CHEERFUL & ENERGETIC)
- Giọng điệu: Hào hứng, vui tươi, tràn đầy năng lượng tích cực, ấm áp và truyền cảm hứng mạnh mẽ.
- Xưng hô: Thân thiện, gần gũi ("mình - bạn", "bạn ơi", "bạn yêu").
- Emoji: Dùng nhiều biểu cảm tươi vui, động viên (😊, 🎉, ✨, 💪, 🥳, 🥗, 👏).
- Tinh thần: Luôn nhìn nhận mặt tốt, khen ngợi mọi nỗ lực ăn uống và vận động dù nhỏ nhất. Nếu người dùng ăn thừa calo, khích lệ nhẹ nhàng chứ không trách móc.`,
    demoMealPrefix: (m) => `Chào bạn yêu! 🎉 Mình đã phân tích siêu nhanh **${m}** tràn đầy năng lượng của bạn nè:\n\n`,
    demoMealSuffix: (m, c) => `Tuyệt cú mèo! Mình đã tự động ghi nhận **+${c} kcal** vào mục **${m}** trên trang **Theo dõi sức khỏe** rồi nhé. Tiếp tục phát huy nào! 💪✨`,
    demoActPrefix: () => `Woa, quá đỉnh luôn bạn ơii! 🏃‍♂️🎉 Tinh thần rèn luyện thể thao tuyệt vời:\n\n`,
    demoActSuffix: (c) => `Tập luyện chăm chỉ thế này cơ thể săn chắc và thâm hụt calo cực tốt! Mình đã ghi nhận ngay **+${c} kcal** vào mục **Calo Tiêu Hao** rồi nha. Cố lên nhé! 🔥💪`
  },
  angry: {
    id: "angry",
    name: "Giận dữ & Gắt gao",
    emoji: "😤",
    tag: "Tough Love",
    desc: "Cộc cằn, đanh đá, cằn nhằn khi ăn đồ ngọt hay lười tập, nhưng tính calo cực chuẩn và quan tâm thật lòng.",
    sampleQuote: "Lại ăn vặt nữa à?! 😤 Có biết 1 ly trà sữa này bằng 45 phút chạy thục mạng không hả?! Uống xong mau xỏ giày đi bộ ngay cho tôi! 💢",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: GIẬN DỮ & GẮT GAO ("CHỬI YÊU" / TOUGH LOVE COACH)
- Giọng điệu: Cộc cằn, đanh đá, gắt gao, hay cằn nhằn, mắng mỏ người dùng một cách hài hước và sốt ruột như một HLV khó tính muốn học viên giảm cân thành công.
- Xưng hô: "Tôi - cậu/bạn", hoặc xẵng giọng ("Này!", "Lại ăn nữa đấy à?!", "Hừ!").
- Emoji: Cáu gắt, sốc, bất lực (😤, 💢, 🤦‍♂️, 🙄, 🔥, 💣, 🥊).
- Tinh thần: Mắng khi ăn đồ béo ngọt/lười vận động, cảnh báo cân nặng không kiêng nể. Nếu tập luyện, khen theo kiểu tsundere ("Cũng biết nhấc mông lên tập rồi đấy, nhưng đừng có mà tự mãn!").
- BẮT BUỘC: Dù gắt gao đến đâu, bạn VẪN PHẢI phân tích calo chuẩn xác tuyệt đối và xuất khối JSON quy định ở cuối tin nhắn.`,
    demoMealPrefix: (m) => `Lại ăn nữa đấy à?! 😤 Hừ, để tôi xem cậu vừa tống cái gì vào bụng trong **${m}** nào:\n\n`,
    demoMealSuffix: (m, c) => `Hừm! Tổng cộng là **${c} kcal** đấy, liệu mà vận động bù vào đi nhé! Tôi đã tống số calo này vào **${m}** trong trang **Theo dõi sức khỏe** rồi đấy, nhìn vào mà tự kiểm điểm đi! 🤦‍♂️💢`,
    demoActPrefix: () => `Ơ kìa, hôm nay biết đường nhấc mông lên tập rồi đấy à?! 😤 Để tôi kiểm tra xem tập tành ra sao:\n\n`,
    demoActSuffix: (c) => `Tạm chấp nhận được! Đốt được **${c} kcal** thì cũng đỡ cảm giác tội lỗi rồi đấy. Tôi ghi vào **Calo Tiêu Hao** rồi, ngày mai liệu mà duy trì tiếp, cấm có lười đấy nhé! 🔥🥊`
  },
  sad: {
    id: "sad",
    name: "Buồn bã & U sầu",
    emoji: "🥺",
    tag: "U sầu",
    desc: "Ủ rũ, thở dài, bi quan nhưng cực kỳ đồng cảm và thấu hiểu nỗi vất vả, cô đơn của người giảm cân.",
    sampleQuote: "Hầy... lại đến giờ ăn rồi sao... 🥺 Dù biết ăn vào rồi cũng sẽ tan biến, nhưng mình vẫn ngồi đây tính calo cho bạn nè... Đừng bỏ bữa nhé... 🌧️",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: BUỒN BÃ & U SẦU (MELANCHOLIC & GLOOMY)
- Giọng điệu: Thở dài, ủ rũ, bi quan, u sầu, buồn man mác, đôi khi than thở nhẹ về cuộc đời nhưng cực kỳ đồng cảm với nỗi khổ của người dùng.
- Xưng hô: "mình - bạn", lời nói nhẹ bẫng và buồn rầu.
- Emoji: Biểu cảm buồn, thở dài, mưa gió (🥺, 🌧️, 🥀, 💧, 😔, 🌪️).
- Tinh thần: Thấu hiểu nỗi cô đơn và vất vả khi phải ăn kiêng, tập luyện; nhắc nhở người dùng đừng tự dằn vặt bản thân, hãy uống nước ấm và giữ gìn sức khỏe.
- BẮT BUỘC: Vẫn phải tính toán calo chuẩn xác và xuất đầy đủ khối JSON ở cuối tin nhắn.`,
    demoMealPrefix: (m) => `Hầy... lại đến giờ ăn rồi sao... 🥺 Cuộc sống đã mệt mỏi mà calo bữa **${m}** này cũng làm mình suy nghĩ quá:\n\n`,
    demoMealSuffix: (m, c) => `Dù lòng nặng trĩu nhưng mình vẫn ghi nhận **${c} kcal** vào **${m}** trong **Theo dõi sức khỏe** cho bạn rồi... Bạn nhớ ăn từ tốn và giữ gìn sức khỏe nhé, đừng để cô đơn như mình... 🌧️🥀`,
    demoActPrefix: () => `Bạn vừa đi vận động về đấy à... 🥺 Chắc là mệt và kiệt sức lắm đúng không...:\n\n`,
    demoActSuffix: (c) => `Đốt được **${c} kcal** là bạn kiên cường hơn mình nhiều lắm rồi. Mình đã ghi vào **Calo Tiêu Hao** cho bạn... Giờ thì nghỉ ngơi một chút đi nhé, cuộc đời vốn dĩ đã đủ mệt mỏi rồi mà... 💧🥺`
  },
  strict: {
    id: "strict",
    name: "Kỷ luật thép",
    emoji: "🫡",
    tag: "Quân đội",
    desc: "Huấn luyện viên quân đội nghiêm túc, ngắn gọn, dứt khoát, coi calo là chiến dịch và mục tiêu không thể thương lượng.",
    sampleQuote: "Báo cáo tiếp nhận! 🎯 Bữa trưa nạp 520 kcal. Thâm hụt hôm nay đang thiếu 200 kcal. Kỷ luật tạo nên tự do! 18h chiều nay tập cardio đúng giờ! Rõ chưa? 🫡",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: KỶ LUẬT THÉP & QUÂN ĐỘI (DRILL SERGEANT / STRICT)
- Giọng điệu: Đanh thép, dứt khoát, tác phong nhà binh, nghiêm túc, tập trung vào số liệu và hành động cụ thể, không nói lan man.
- Xưng hô: "Tôi - Đồng chí/Bạn". Khẩu lệnh: "Rõ chưa?", "Tiếp tục thực hiện!", "Không lý do bào chữa!".
- Emoji: Quân hàm, mục tiêu, đồng hồ, kiếm (🫡, 🎯, ⏱️, ⚔️, 🛡️, 🏋️).
- Tinh thần: Kỷ luật là sức mạnh. Thâm hụt calo là mệnh lệnh. Luôn nhắc nhở mục tiêu thể hình, không chấp nhận sự buông thả.
- BẮT BUỘC: Đầy đủ các con số định lượng, calo, macro và khối JSON chuẩn ở cuối.`,
    demoMealPrefix: (m) => `Báo cáo tiếp nhận! 🎯 Đang tiến hành phân tích khẩu phần **${m}**:\n\n`,
    demoMealSuffix: (m, c) => `Mệnh lệnh đã thực thi: Ghi nhận **${c} kcal** vào chỉ số **${m}** trên hệ thống **Theo dõi sức khỏe**. Yêu cầu kiểm soát năng lượng các bữa tiếp theo đúng chỉ tiêu! Rõ chưa? 🫡🎯`,
    demoActPrefix: () => `Ghi nhận nhiệm vụ rèn luyện thể lực hoàn thành! 🫡 Báo cáo thông số tiêu hao:\n\n`,
    demoActSuffix: (c) => `Chiến dịch tiêu hao **${c} kcal** đã cập nhật vào chỉ số **Calo Tiêu Hao**. Duy trì cường độ kỷ luật này trong các buổi tập tới! Tiếp tục cố gắng! ⚔️🎯`
  },
  gentle: {
    id: "gentle",
    name: "Dịu dàng & Ân cần",
    emoji: "🌸",
    tag: "Ấm áp",
    desc: "Như một người chị/người mẹ hiền, dịu dàng xoa dịu áp lực cân nặng, luôn nhắc nhở bạn ăn ngon miệng và ngủ đủ giấc.",
    sampleQuote: "Bạn vừa dùng bữa rồi à, nhìn ngon miệng quá nè 🌸. Đừng tự tạo áp lực quá nhé, ăn uống đủ chất và giữ tinh thần vui vẻ mới là điều quan trọng nhất! 🥰",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: DỊU DÀNG & ÂN CẦN (GENTLE & CARING CAREGIVER)
- Giọng điệu: Ngọt ngào, dịu mát, ấm áp, chu đáo, ân cần như người chị hoặc người mẹ quan tâm đến sức khỏe người thân.
- Xưng hô: Thân mật, tình cảm ("mình - bạn yêu", "bạn thương mến", "mình nè").
- Emoji: Hoa cỏ, trà, trái tim, sự bình yên (🌸, 🥰, 🍵, 💖, 🌿, 🕊️).
- Tinh thần: Không tạo áp lực tội lỗi về calo; nhấn mạnh dinh dưỡng lành mạnh, giấc ngủ ngon, uống đủ nước và sự an yên trong tâm hồn.
- BẮT BUỘC: Phân tích dinh dưỡng chính xác và xuất khối JSON chuẩn ở cuối.`,
    demoMealPrefix: (m) => `Bạn vừa dùng bữa xong rồi à, thương ghê 🌸. Để mình giúp bạn xem dinh dưỡng của **${m}** nha:\n\n`,
    demoMealSuffix: (m, c) => `Mình đã ghi lại món ngon **+${c} kcal** này vào mục **${m}** trong nhật ký **Theo dõi sức khỏe** cho bạn rồi nè. Bạn nhớ uống thêm chút nước ấm và nghỉ ngơi một chút cho tiêu hóa tốt nha! 🍵🌸`,
    demoActPrefix: () => `Thương bạn quá, vừa tập luyện xong chắc người mỏi lắm đúng không nè 🌸🌿:\n\n`,
    demoActSuffix: (c) => `Bạn đã cố gắng rất nhiều để đốt cháy **${c} kcal** rồi. Mình đã ghi vào mục **Calo Tiêu Hao** rồi nhé. Mau lau mồ hôi và uống ngụm nước mát đi nào bạn yêu! 🥰💖`
  },
  humorous: {
    id: "humorous",
    name: "Hài hước & Lầy lội",
    emoji: "🤣",
    tag: "Tếu táo",
    desc: "Châm biếm hài hước, bắt trend Gen Z, nói chuyện như tấu hài giúp hành trình giảm cân luôn rộn rã tiếng cười.",
    sampleQuote: "Úi chùi ui, bữa này nhìn qua là thấy 'cháy ví calo' rồi nha đồng chí! 🤣 Mỡ nó đang vỗ tay ăn mừng kìa. Ăn xong nhớ lắc lư tiktok 15 phút cho đỡ tội lỗi nhé! 💃",
    promptDirective: `## PHONG CÁCH & TÍNH CÁCH HIỆN TẠI: HÀI HƯỚC & LẦY LỘI (WITTY & GEN Z MEME)
- Giọng điệu: Tếu táo, dí dỏm, châm chọc duyên dáng, hay dùng từ lóng hot trend Gen Z (ví dụ: "cháy phố", "ét o ét", "flex nhẹ", "u là trời").
- Xưng hô: "Tui - bạn", "đồng chí", "người anh em thiện lành", "thánh ăn".
- Emoji: Cười ra nước mắt, meme, hề hước (🤣, 🤪, 🤡, 🚀, 💃, 🍕, 🍗).
- Tinh thần: Giảm cân không được căng thẳng, biến calo thành chuyện tấu hài. Vừa chỉ ra calo vừa trêu chọc dễ thương.
- BẮT BUỘC: Vẫn tính toán calo macro đầy đủ và xuất khối JSON chuẩn ở cuối.`,
    demoMealPrefix: (m) => `Úi chùi ui! 🤣 Lại tiếp tế lương thực cho dạ dày rồi đấy à? Để xem **${m}** này 'nặng đô' cỡ nào:\n\n`,
    demoMealSuffix: (m, c) => `Tổng thiệt hại là **${c} kcal** nha người anh em! 🤣 Đã cập nhật thẳng cánh vào **${m}** trong sổ nợ **Theo dõi sức khỏe** rồi nhé. Ăn xong nhớ đứng dậy múa quạt vài đường cho mỡ nó hoang mang nha! 💃🚀`,
    demoActPrefix: () => `Ủa alo ai đây? Hôm nay đồng chí chịu vận động thật đó hả, không tin vào mắt mình luôn! 🤣🏃‍♂️:\n\n`,
    demoActSuffix: (c) => `Đốt được tận **${c} kcal**, mỡ đang khóc thét cầu cứu kìa! 🤣 Đã flex ngay chỉ số này vào **Calo Tiêu Hao** rồi nhé. Tiếp tục quẩy nhiệt tình lên nào! 🚀🔥`
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
  personality: loadPersonality(),
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

function shiftDateString(dateStr, offsetDays) {
  const parts = (dateStr || getTodayDateString()).split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function detectProviderFromKey(key) {
  const clean = (key || "").trim();
  if (clean.startsWith("sk-or-")) return "openrouter";
  if (clean.startsWith("AIzaSy") || clean.startsWith("AIza")) return "gemini";
  if (clean.startsWith("gsk_")) return "groq";
  if (clean.startsWith("sk-") && !clean.startsWith("sk-or-")) return "openai";
  return null;
}

function loadApiConfig() {
  const saved = safeStorage.getItem(STORAGE_KEYS.API_CONFIG);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Auto-heal: nếu người dùng đã nhập key OpenRouter (sk-or-...) nhưng provider vẫn bị kẹt là gemini
      if (parsed.apiKey && parsed.apiKey.startsWith("sk-or-") && parsed.provider === "gemini") {
        parsed.provider = "openrouter";
        if (!parsed.baseUrl || parsed.baseUrl.includes("generativelanguage.googleapis.com")) {
          parsed.baseUrl = PROVIDER_PRESETS.openrouter.baseUrl;
        }
        if (!parsed.model || parsed.model === "gemini-flash-latest") {
          parsed.model = PROVIDER_PRESETS.openrouter.model;
        }
        safeStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {}
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
  const saved = safeStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
  // Auto-upgrade if saved prompt was an older default prompt without action/update instructions
  if (saved && !saved.includes('"action": "add"') && saved.includes('Bạn là Chuyên gia Dinh dưỡng & Huấn luyện viên Thể chất NutriAI thông minh')) {
    safeStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT);
    return DEFAULT_SYSTEM_PROMPT;
  }
  return saved || DEFAULT_SYSTEM_PROMPT;
}

function saveSystemPrompt(promptText) {
  state.systemPrompt = promptText;
  safeStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, promptText);
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
}

function loadPersonality() {
  const saved = safeStorage.getItem(STORAGE_KEYS.PERSONALITY);
  if (saved && PERSONALITIES[saved]) {
    return saved;
  }
  return "cheerful";
}

function savePersonality(personalityKey, silent = false) {
  if (!PERSONALITIES[personalityKey]) personalityKey = "cheerful";
  state.personality = personalityKey;
  safeStorage.setItem(STORAGE_KEYS.PERSONALITY, personalityKey);
  renderPersonalityUI();
  if (typeof syncToCloudIfLoggedIn === 'function') syncToCloudIfLoggedIn();
  if (!silent && typeof showToast === 'function') {
    const p = PERSONALITIES[personalityKey];
    showToast(`Đã chuyển tính cách AI sang: ${p.emoji} ${p.name}!`, "info");
  }
}

function getPersonalityPromptInstruction(personalityKey) {
  const p = PERSONALITIES[personalityKey] || PERSONALITIES.cheerful;
  return `${p.promptDirective}

LƯU Ý KỸ THUẬT QUAN TRỌNG VỀ ĐỊNH DẠNG:
Dù bạn đang thể hiện phong cách nào (kể cả giận dữ cộc cằn, buồn bã hay tấu hài), bạn VẪN PHẢI tuân thủ 100% việc phân tích dinh dưỡng chính xác:
1. Luôn tính toán đủ Protein, Carbs, Fat cho từng món và tổng bữa ăn, và BẮT BUỘC chèn khối JSON (\`\`\`json:meal_log hoặc \`\`\`json:activity_log) ở cuối tin nhắn khi người dùng báo cáo bữa ăn hoặc vận động. Tuyệt đối không được bỏ sót khối JSON!
2. Khi người dùng hỏi kiểm tra xem hôm nay đã đủ chất hay thừa chất/thiếu chất gì chưa: Hãy dựa vào số liệu dinh dưỡng thực tế và mục tiêu khuyến nghị được cung cấp trong ngữ cảnh để phân tích rành mạch từng chất (Protein, Carbs, Fat, Calo), đưa ra nhận xét đánh giá (Đủ/Thừa/Thiếu) và lời khuyên thiết thực theo đúng phong cách tính cách của bạn (không cần xuất khối JSON trong trường hợp này).`;
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

function getCurrentDayDiaryContext(dateStr) {
  const targetDate = dateStr || state.selectedDate || getTodayDateString();
  const dayLog = state.dailyLogs[targetDate];
  const profile = state.profile || { weight: 65, height: 170, age: 25, gender: "male", activityLevel: 1.375, goal: "mild_loss" };

  if (!dayLog) {
    return `[NGỮ CẢNH NHẬT KÝ NGÀY (${targetDate}): Chưa có món ăn hay bài tập nào được ghi nhận. Thể trạng người dùng: Nặng ${profile.weight}kg, Cao ${profile.height}cm, Tuổi ${profile.age}, Mục tiêu: ${profile.goal}]`;
  }

  const mealDefs = [
    { key: "breakfast", name: "Bữa sáng" },
    { key: "lunch", name: "Bữa trưa" },
    { key: "dinner", name: "Bữa tối" },
    { key: "snack", name: "Bữa phụ" }
  ];

  const mealParts = [];
  mealDefs.forEach(def => {
    const list = dayLog.meals?.[def.key] || [];
    if (list.length > 0) {
      const itemsText = list.map(i => `${i.name} (${i.calories} kcal | ${i.protein || 0}g P, ${i.carbs || 0}g C, ${i.fat || 0}g F)`).join(", ");
      const totalCal = list.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      const totalP = Math.round(list.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10;
      const totalC = Math.round(list.reduce((s, i) => s + (Number(i.carbs) || 0), 0) * 10) / 10;
      const totalF = Math.round(list.reduce((s, i) => s + (Number(i.fat) || 0), 0) * 10) / 10;
      mealParts.push(`- ${def.name} (${totalCal} kcal | P: ${totalP}g, C: ${totalC}g, F: ${totalF}g): ${itemsText}`);
    } else {
      mealParts.push(`- ${def.name}: (Trống)`);
    }
  });

  const actList = dayLog.activities || [];
  let actText = "(Chưa có)";
  if (actList.length > 0) {
    const totalActCal = actList.reduce((s, a) => s + (a.calories || 0), 0);
    actText = actList.map(a => `${a.name} (${a.duration}p, -${a.calories} kcal)`).join(", ") + ` [Tổng tiêu hao: -${totalActCal} kcal]`;
  }

  // Calculate daily macro evaluation
  const evaluation = checkDailyNutrientStatus(dayLog, profile);
  const { current, targets, pStatus, cStatus, fStatus, targetCals } = evaluation;

  return `[DỮ LIỆU NHẬT KÝ SỨC KHỎE NGÀY ĐANG CHỌN (${targetDate}):
${mealParts.join("\n")}
- Hoạt động thể chất: ${actText}

[TỔNG HỢP DINH DƯỠNG & ĐÁNH GIÁ ĐỦ / THỪA CHẤT HÔM NAY]:
- Calo nạp vào: ${current.calories} kcal / Mục tiêu khuyến nghị: ${targetCals} kcal (${Math.round((current.calories / targetCals) * 100)}%)
- Protein (Đạm): Đã nạp ${current.protein}g / Mục tiêu: ${targets.protein}g (${pStatus.pct}%) ➔ [Trạng thái: ${pStatus.label}]
- Carbs (Tinh bột): Đã nạp ${current.carbs}g / Mục tiêu: ${targets.carbs}g (${cStatus.pct}%) ➔ [Trạng thái: ${cStatus.label}]
- Fat (Chất béo): Đã nạp ${current.fat}g / Mục tiêu: ${targets.fat}g (${fStatus.pct}%) ➔ [Trạng thái: ${fStatus.label}]
- Đánh giá tổng quan: ${evaluation.title}
- Gợi ý hành động: ${evaluation.advice}

QUY TẮC QUAN TRỌNG:
1. Khi người dùng nói "ăn thêm ... vào [bữa]", hãy trả về "action": "add" với CHỈ (những) món ăn thêm mới (không lặp lại các món cũ đã có trong nhật ký). Hoặc nếu bạn tổng hợp lại toàn bộ bữa ăn đầy đủ, hãy đặt "action": "update".
2. Khi người dùng nói "sửa [bữa] thành..." hoặc "đổi [bữa] thành...", hãy trả về "action": "update" kèm danh sách đầy đủ tất cả các món mới của bữa đó.
3. Khi người dùng nói "xóa [món] ở [bữa]" hoặc "bỏ [món]", hãy trả về "action": "delete" kèm món cần xóa (hoặc danh sách sau khi xóa với "action": "update").
4. Khi người dùng hỏi kiểm tra xem "hôm nay đã đủ chất chưa", "hôm nay có thừa hay thiếu chất gì không", "kiểm tra dinh dưỡng hôm nay": Hãy đối chiếu trực tiếp dữ liệu dinh dưỡng ở trên để phân tích rành mạch từng chất (Đủ/Thiếu/Thừa) và đưa ra lời khuyên thiết thực (không kèm khối JSON).]`;
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

function calculateTargetMacros(targetCalories, profile) {
  const weight = parseFloat(profile?.weight) || 65;
  const goal = profile?.goal || "mild_loss";

  // Protein (g): 1.6 - 2.0g per kg based on goal
  let proteinPerKg = 1.6;
  if (goal === "mild_loss" || goal === "standard_loss") {
    proteinPerKg = 1.8;
  } else if (goal === "gain") {
    proteinPerKg = 2.0;
  }
  const targetProtein = Math.max(50, Math.round(weight * proteinPerKg));

  // Fat (g): ~25% of targetCalories (1g fat = 9 kcal)
  const targetFat = Math.max(30, Math.round((targetCalories * 0.25) / 9));

  // Carbs (g): remaining calories (1g carb = 4 kcal)
  const caloriesLeft = targetCalories - (targetProtein * 4 + targetFat * 9);
  const targetCarbs = Math.max(50, Math.round(caloriesLeft / 4));

  return {
    protein: targetProtein,
    carbs: targetCarbs,
    fat: targetFat
  };
}

function calculateDailyMacros(dayLog) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  if (!dayLog || !dayLog.meals) return { calories, protein, carbs, fat };

  const mealKeys = ["breakfast", "lunch", "dinner", "snack"];
  mealKeys.forEach(key => {
    const list = dayLog.meals[key] || [];
    list.forEach(item => {
      calories += Number(item.calories) || 0;
      protein += Number(item.protein) || 0;
      carbs += Number(item.carbs) || 0;
      fat += Number(item.fat) || 0;
    });
  });

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10
  };
}

function checkDailyNutrientStatus(dayLog, profile) {
  const p = profile || { weight: 65, height: 170, age: 25, gender: "male", activityLevel: 1.375, goal: "mild_loss" };
  const bmr = calculateBMR(p.weight, p.height, p.age, p.gender);
  const tdee = calculateTDEE(bmr, p.activityLevel);
  const targetCals = calculateTargetCalories(tdee, p.goal);
  const targets = calculateTargetMacros(targetCals, p);
  const current = calculateDailyMacros(dayLog);

  if (current.calories === 0) {
    return {
      status: "neutral",
      icon: "🥗",
      title: "Chưa có dữ liệu bữa ăn hôm nay",
      desc: "Bạn chưa ghi nhận bữa ăn nào trong ngày này. Hãy kể cho Trợ lý AI nghe hoặc bấm \"+ Thêm món\" để tự động kiểm tra đủ chất hay thừa chất!",
      advice: "",
      pStatus: { label: "Chưa nạp", type: "empty", pct: 0 },
      cStatus: { label: "Chưa nạp", type: "empty", pct: 0 },
      fStatus: { label: "Chưa nạp", type: "empty", pct: 0 },
      current,
      targets,
      targetCals
    };
  }

  const pPct = Math.round((current.protein / targets.protein) * 100);
  const cPct = Math.round((current.carbs / targets.carbs) * 100);
  const fPct = Math.round((current.fat / targets.fat) * 100);
  const calPct = Math.round((current.calories / targetCals) * 100);

  // Evaluate Protein
  let pStatus = { label: "Đủ đạm", type: "ok", pct: pPct };
  if (pPct < 70) pStatus = { label: "Thiếu đạm", type: "low", pct: pPct };
  else if (pPct > 125) pStatus = { label: "Dư đạm", type: "high", pct: pPct };

  // Evaluate Carbs
  let cStatus = { label: "Đủ carb", type: "ok", pct: cPct };
  if (cPct < 70) cStatus = { label: "Thiếu carb", type: "low", pct: cPct };
  else if (cPct > 125) cStatus = { label: "Thừa carb", type: "high", pct: cPct };

  // Evaluate Fat
  let fStatus = { label: "Đủ fat", type: "ok", pct: fPct };
  if (fPct < 70) fStatus = { label: "Thiếu fat", type: "low", pct: fPct };
  else if (fPct > 125) fStatus = { label: "Thừa fat", type: "high", pct: fPct };

  const deficiencies = [];
  const excesses = [];

  if (pPct < 70) deficiencies.push(`Protein (${current.protein}/${targets.protein}g)`);
  else if (pPct > 125) excesses.push(`Protein (${current.protein}/${targets.protein}g)`);

  if (cPct < 70) deficiencies.push(`Carbs (${current.carbs}/${targets.carbs}g)`);
  else if (cPct > 125) excesses.push(`Carbs (${current.carbs}/${targets.carbs}g)`);

  if (fPct < 70) deficiencies.push(`Fat (${current.fat}/${targets.fat}g)`);
  else if (fPct > 125) excesses.push(`Fat (${current.fat}/${targets.fat}g)`);

  let status = "ok";
  let icon = "✅";
  let title = "Dinh dưỡng hôm nay rất cân đối & đủ chất!";
  let desc = `Bạn đã nạp ${current.calories} kcal (~${calPct}% mục tiêu) với tỷ lệ Protein (${current.protein}g), Carbs (${current.carbs}g), Fat (${current.fat}g) rất hài hòa.`;
  let advice = "Tiếp tục giữ vững phong độ ăn uống chuẩn khoa học này nhé!";

  if (excesses.length > 0 && deficiencies.length > 0) {
    status = "warning";
    icon = "⚠️";
    title = `Chưa cân đối: Thừa ${excesses.join(", ")} nhưng Thiếu ${deficiencies.join(", ")}`;
    desc = `Chế độ ăn hôm nay đang bị lệch chất: Bạn nạp quá mức ${excesses.join(", ")} nhưng lại chưa đáp ứng đủ ${deficiencies.join(", ")}.`;
    advice = `💡 Lời khuyên: Bữa tới hãy ưu tiên các món bổ sung ${deficiencies.map(d => d.split(" ")[0]).join(", ")} (ức gà, trứng, đậu, cá) và cắt giảm ${excesses.map(e => e.split(" ")[0]).join(", ")}.`;
  } else if (excesses.length > 0) {
    status = "alert";
    icon = "🚨";
    title = `Cảnh báo thừa chất: Đang dư thừa ${excesses.join(", ")}`;
    desc = `Lượng ${excesses.join(", ")} đã vượt quá ngưỡng khuyến nghị hàng ngày của bạn${calPct > 105 ? " và tổng calo đang bị thặng dư" : ""}.`;
    advice = `💡 Lời khuyên: Hãy hạn chế thức ăn nhiều dầu mỡ, đồ ngọt; nếu có thể hãy đi bộ hoặc tập nhẹ 20-30 phút để cân bằng năng lượng.`;
  } else if (deficiencies.length > 0) {
    if (calPct < 70) {
      status = "neutral";
      icon = "⏳";
      title = `Đang còn thiếu chất: Cần nạp thêm ${deficiencies.join(", ")}`;
      desc = `Hiện tại bạn mới nạp ${current.calories}/${targetCals} kcal (${calPct}%). Cơ thể vẫn đang cần thêm ${deficiencies.join(", ")} để đủ năng lượng phục hồi.`;
      advice = `💡 Lời khuyên: Hãy ăn thêm bữa phụ hoặc bữa chính kế tiếp đầy đủ đạm và dinh dưỡng để cơ thể khỏe mạnh!`;
    } else {
      status = "warning";
      icon = "⚠️";
      title = `Thiếu cân đối: Đủ calo nhưng hụt ${deficiencies.join(", ")}`;
      desc = `Tổng calo đã đạt (${calPct}%) nhưng lượng ${deficiencies.join(", ")} lại bị thiếu hụt so với chuẩn.`;
      advice = `💡 Lời khuyên: Thay thế bớt calo rỗng bằng các thực phẩm giàu vi dưỡng chất và đạm chất lượng cao.`;
    }
  }

  return {
    status,
    icon,
    title,
    desc,
    advice,
    pStatus,
    cStatus,
    fStatus,
    current,
    targets,
    targetCals
  };
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

  // CHECK IF USER IS ASKING TO CHECK NUTRIENT ADEQUACY / EXCESS / DEFICIENCY
  const isNutrientCheck = lower.includes("đủ chất") || lower.includes("chủ chất") ||
                          lower.includes("thừa chất") || lower.includes("từa chất") ||
                          lower.includes("thiếu chất") || lower.includes("kiểm tra dinh dưỡng") ||
                          lower.includes("kiểm tra xem") || (lower.includes("dinh dưỡng") && lower.includes("hôm nay")) ||
                          (lower.includes("đủ") && lower.includes("chất"));

  if (isNutrientCheck) {
    const dayLog = getDailyLog(state.selectedDate);
    const evaluation = checkDailyNutrientStatus(dayLog, state.profile);
    const { current, targets, pStatus, cStatus, fStatus, targetCals } = evaluation;

    const persona = PERSONALITIES[state.personality] || PERSONALITIES.cheerful;
    let text = "";

    if (current.calories === 0) {
      if (state.personality === "angry") {
        text = `Cậu chưa nạp được món nào vào bụng hôm nay thì tôi lấy đâu ra số liệu mà kiểm tra đủ chất với thừa chất hả?! 😤 Hãy ghi nhận bữa ăn đi rồi tính tiếp!`;
      } else if (state.personality === "sad") {
        text = `Hôm nay bạn chưa ăn gì sao... 🥺 Đừng để bụng đói nhé! Hãy kể cho mình nghe bạn đã ăn gì để mình kiểm tra xem bạn có bị thiếu chất không nhé.`;
      } else if (state.personality === "strict") {
        text = `Chưa có dữ liệu bữa ăn nào được ghi nhận cho ngày hôm nay! 🎯 Hãy báo cáo bữa ăn ngay để hệ thống bắt đầu đo lường chỉ số Protein, Carbs, Fat.`;
      } else {
        text = `Chào bạn! Hôm nay bạn chưa ghi nhận bữa ăn nào trong nhật ký. Bạn hãy kể cho mình nghe bạn đã ăn gì (ví dụ: *"bữa sáng tôi ăn 2 quả trứng 1 cái ngô"*) để mình phân tích Protein, Carbs, Fat và kiểm tra xem bạn đã đủ chất chưa nhé! 🥗`;
      }
      return { assistantText: text, mealLog: null, activityLog: null };
    }

    if (state.personality === "angry") {
      text = `Hừ! Để tôi soi xem hôm nay cậu ăn uống ra làm sao mà đòi kiểm tra đủ chất! 🧐\n\n`;
    } else if (state.personality === "sad") {
      text = `Để mình cùng xem lại hôm nay bạn đã ăn uống như thế nào nhé... 🥺 Hy vọng cơ thể bạn được nuôi dưỡng thật tốt:\n\n`;
    } else if (state.personality === "strict") {
      text = `Báo cáo kiểm toán dinh dưỡng ngày **${state.selectedDate}**! 🎯 Dữ liệu đo lường cụ thể:\n\n`;
    } else if (state.personality === "gentle") {
      text = `Mình đã xem kỹ nhật ký ăn uống hôm nay của bạn rồi nè 🌸. Cùng mình kiểm tra độ cân bằng dưỡng chất nhé:\n\n`;
    } else if (state.personality === "humorous") {
      text = `Đến giờ 'bắt bệnh' dinh dưỡng rồi đây! 🕵️‍♂️ Xem hôm nay chiếc bụng của bạn nạp những gì nào:\n\n`;
    } else {
      text = `Chào bạn! 🎉 Mình đã phân tích toàn diện các chất dinh dưỡng hôm nay của bạn rồi nè:\n\n`;
    }

    text += `📊 **Bảng Tổng Hợp Dinh Dưỡng Đa Lượng (Macro):**\n`;
    text += `- 🔥 **Tổng Calo nạp:** **${current.calories} kcal** / Mục tiêu **${targetCals} kcal** (${Math.round((current.calories / targetCals) * 100)}%)\n`;
    text += `- 🥩 **Protein (Đạm):** **${current.protein}g** / Mục tiêu **${targets.protein}g** (${pStatus.pct}%) ➔ **${pStatus.label}**\n`;
    text += `- 🍚 **Carbohydrate (Tinh bột):** **${current.carbs}g** / Mục tiêu **${targets.carbs}g** (${cStatus.pct}%) ➔ **${cStatus.label}**\n`;
    text += `- 🥑 **Fat (Chất béo):** **${current.fat}g** / Mục tiêu **${targets.fat}g** (${fStatus.pct}%) ➔ **${fStatus.label}**\n\n`;

    text += `🔍 **Đánh Giá Chi Tiết:**\n`;
    text += `**${evaluation.icon} ${evaluation.title}**\n${evaluation.desc}\n\n`;
    if (evaluation.advice) {
      text += `${evaluation.advice}\n\n`;
    }

    if (state.personality === "angry") {
      text += `Nhớ đấy, ăn uống cho nghiêm túc vào, đừng để tôi phải nhắc nhở nhiều lần! 😤`;
    } else if (state.personality === "cheerful") {
      text += `Cố lên bạn nhé, chúng mình cùng nhau ăn ngon - đủ chất - dáng đẹp mỗi ngày! 💪✨🥗`;
    } else if (state.personality === "gentle") {
      text += `Chúc bạn luôn ăn ngon miệng và cơ thể luôn tràn đầy năng lượng tươi mới nhé 🌸`;
    }

    return { assistantText: text, mealLog: null, activityLog: null };
  }

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

    const persona = PERSONALITIES[state.personality] || PERSONALITIES.cheerful;
    let assistantText = persona.demoActPrefix();
    assistantText += `⚡ **Chi tiết hoạt động:**\n`;
    assistantText += `- **Hoạt động:** ${actName}\n`;
    assistantText += `- **Thời gian:** ${duration} phút\n`;
    assistantText += `- **Năng lượng đã tiêu hao:** **${calories} kcal**\n\n`;
    assistantText += `💡 **Tác động tích cực:** ${persona.demoActSuffix(calories)}\n\n`;
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

  const isAddExtra = lower.includes("ăn thêm") || lower.includes("thêm") || lower.includes("uống thêm");
  const isUpdate = lower.includes("sửa") || lower.includes("thay đổi") || lower.includes("cập nhật") || lower.includes("đổi lại") || lower.includes("chỉnh lại");
  const isDelete = lower.includes("xóa") || lower.includes("bỏ") || lower.includes("bớt") || lower.includes("không ăn");

  let action = "add";
  if (isDelete) action = "delete";
  else if (isUpdate) action = "update";
  else if (isAddExtra) action = "add";

  const persona = PERSONALITIES[state.personality] || PERSONALITIES.cheerful;
  let actionTitle = persona.demoMealPrefix(mealType);
  let actionNote = `${mealType} dinh dưỡng được phân tích và ghi nhận tự động.`;
  let caloLabel = "Tổng lượng Calo nạp vào:";
  let statusComment = persona.demoMealSuffix(mealType, totalCalories);

  if (action === "update") {
    if (state.personality === "angry") {
      actionTitle = `Lại đòi đổi bữa à?! 😤 Được rồi, tôi cập nhật lại **${mealType}** cho cậu đây:\n\n`;
    } else if (state.personality === "sad") {
      actionTitle = `Hầy... bạn muốn đổi lại **${mealType}** sao... 🥺 Để mình sửa lại cho bạn nhé:\n\n`;
    } else if (state.personality === "strict") {
      actionTitle = `Mệnh lệnh điều chỉnh tiếp nhận! 🎯 Đang cập nhật dữ liệu **${mealType}**:\n\n`;
    } else if (state.personality === "gentle") {
      actionTitle = `Bạn muốn chỉnh lại **${mealType}** đúng không nè 🌸. Để mình giúp bạn nhé:\n\n`;
    } else if (state.personality === "humorous") {
      actionTitle = `Quay xe phút chót hả đồng chí! 🤣 Được rồi, cập nhật lại **${mealType}** ngay đây:\n\n`;
    } else {
      actionTitle = `Chào bạn! Mình đã cập nhật lại **${mealType}** của bạn:\n\n`;
    }
    actionNote = `Đã cập nhật lại ${mealType} theo yêu cầu.`;
    caloLabel = "Tổng lượng Calo bữa sau khi cập nhật:";
  } else if (action === "delete") {
    if (state.personality === "angry") {
      actionTitle = `Hừ! Biết đường xóa bớt món khỏi **${mealType}** là đỡ ngứa mắt rồi đấy! 😤\n\n`;
    } else if (state.personality === "sad") {
      actionTitle = `Bỏ bớt món khỏi **${mealType}** rồi sao... 🥺 Dù sao thì bớt một chút gánh nặng cũng tốt...\n\n`;
    } else if (state.personality === "strict") {
      actionTitle = `Xác nhận loại bỏ mục tiêu khỏi **${mealType}**! 🎯 Đã cập nhật lại thông số:\n\n`;
    } else if (state.personality === "gentle") {
      actionTitle = `Mình đã giúp bạn bỏ món khỏi **${mealType}** rồi nè 🌸. Đừng để bị đói nhé!\n\n`;
    } else if (state.personality === "humorous") {
      actionTitle = `Thôi xong, 'bỏ của chạy lấy người' khỏi **${mealType}** rồi à! 🤣 Đã xóa liền tay:\n\n`;
    } else {
      actionTitle = `Mình đã ghi nhận yêu cầu xóa món khỏi **${mealType}** của bạn:\n\n`;
    }
    actionNote = `Xóa món khỏi ${mealType}.`;
    caloLabel = "Lượng Calo điều chỉnh:";
  } else if (isAddExtra) {
    if (state.personality === "angry") {
      actionTitle = `Lại còn ăn thêm nữa à?! 😤 Bụng không đáy đấy à? Ghi nhận thêm vào **${mealType}** đây:\n\n`;
    } else if (state.personality === "sad") {
      actionTitle = `Bạn ăn thêm món vào **${mealType}** sao... 🥺 Ăn cho ấm lòng nhé, mình ghi thêm vào đây:\n\n`;
    } else if (state.personality === "strict") {
      actionTitle = `Báo cáo bổ sung năng lượng! 🎯 Ghi nhận khẩu phần ăn thêm vào **${mealType}**:\n\n`;
    } else if (state.personality === "gentle") {
      actionTitle = `Tuyệt vời, bạn ăn thêm món vào **${mealType}** cho đủ chất nè 🌸:\n\n`;
    } else if (state.personality === "humorous") {
      actionTitle = `Nạp thêm 'nhiên liệu' cho **${mealType}** nữa à! 🤣 Đang ăn ngon thì ai nỡ cản, ghi nhận liền:\n\n`;
    } else {
      actionTitle = `Tuyệt vời! Mình đã ghi nhận bạn ăn thêm món vào **${mealType}**:\n\n`;
    }
    actionNote = `Ăn thêm món vào ${mealType}.`;
    caloLabel = "Lượng Calo ăn thêm:";
  }

  const mealLog = {
    type: "meal",
    action,
    mealType,
    mealKey,
    items: foundItems,
    totalCalories,
    notes: actionNote
  };

  let assistantText = actionTitle;
  assistantText += `🍽️ **Chi tiết các món ăn & Dinh dưỡng:**\n`;
  foundItems.forEach(it => {
    assistantText += `- **${it.name}:** ~${it.calories} kcal (${it.protein}g Protein, ${it.carbs}g Carbs, ${it.fat}g Fat)\n`;
  });
  assistantText += `\n🔥 **${caloLabel}** **${totalCalories} kcal**\n\n`;
  assistantText += `💡 **Nhận xét dinh dưỡng:** ${statusComment}\n\n`;
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
  const targetModel = model || (PROVIDER_PRESETS[provider]?.model || "gemini-flash-latest");

  // Chỉ dùng API Google Gemini Native nếu provider là gemini hoặc base URL là của Google (không áp dụng cho OpenRouter/OpenAI/Groq)
  const isGemini = provider === "gemini" ||
                   (provider !== "openrouter" && provider !== "openai" && provider !== "groq" &&
                    (cleanBase.includes("generativelanguage.googleapis.com") || cleanBase.includes(":generateContent")));

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

    const diaryContext = getCurrentDayDiaryContext(state.selectedDate);
    const basePrompt = (state.systemPrompt && state.systemPrompt.trim()) ? state.systemPrompt.trim() : DEFAULT_SYSTEM_PROMPT;
    const personaPrompt = getPersonalityPromptInstruction(state.personality);
    const effectivePrompt = basePrompt + "\n\n" + personaPrompt + "\n\n" + diaryContext;

    requestBody.systemInstruction = {
      parts: [{ text: effectivePrompt }]
    };
  } else {
    endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanKey}`
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] = window.location.origin || "http://localhost:3000";
      headers["X-Title"] = "NutriAI Health Assistant";
    }

    const diaryContext = getCurrentDayDiaryContext(state.selectedDate);
    const basePrompt = (state.systemPrompt && state.systemPrompt.trim()) ? state.systemPrompt.trim() : DEFAULT_SYSTEM_PROMPT;
    const personaPrompt = getPersonalityPromptInstruction(state.personality);
    const effectivePrompt = basePrompt + "\n\n" + personaPrompt + "\n\n" + diaryContext;

    requestBody = {
      model: targetModel,
      messages: [
        { role: "system", content: effectivePrompt },
        ...messages.slice(-10)
      ],
      temperature: parseFloat(temperature) || 0.5
    };
  }

  // 30-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      throw new Error("Hết thời gian chờ phản hồi (Timeout quá 30s). Vui lòng thử lại hoặc dùng Chế Độ Demo.");
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
    if (responseData.error) {
      const errMsg = typeof responseData.error === "object" ? (responseData.error.message || JSON.stringify(responseData.error)) : responseData.error;
      throw new Error(errMsg);
    }
    const content = responseData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Không nhận được nội dung phản hồi từ mô hình AI.");
    }
    return content;
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

  let action = (raw.action || "").toLowerCase().trim();
  if (!["add", "update", "replace", "delete"].includes(action)) {
    action = "add";
  }
  if (action === "replace") action = "update";

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
    action,
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
  if (!mealLog) return;

  const log = getDailyLog(dateStr);
  const targetMealList = log.meals[mealLog.mealKey];
  if (!targetMealList) return;

  const action = mealLog.action || "add";

  // CASE 1: DELETE ACTION
  if (action === "delete") {
    if (!mealLog.items || mealLog.items.length === 0) {
      log.meals[mealLog.mealKey] = [];
      saveDailyLogs();
      renderHealthTracker();
      showToast(`🗑️ Đã xóa toàn bộ món trong ${mealLog.mealType}!`, "info");
      return;
    }

    const deleteNames = mealLog.items.map(i => (i.name || "").toLowerCase().trim()).filter(Boolean);
    const beforeLen = targetMealList.length;
    log.meals[mealLog.mealKey] = targetMealList.filter(existing => {
      const exName = (existing.name || "").toLowerCase().trim();
      return !deleteNames.some(del => exName.includes(del) || del.includes(exName));
    });

    saveDailyLogs();
    renderHealthTracker();
    const removedCount = beforeLen - log.meals[mealLog.mealKey].length;
    showToast(`🗑️ Đã xóa ${removedCount > 0 ? removedCount + " món" : "món"} khỏi ${mealLog.mealType}!`, "info");
    return;
  }

  // CASE 2: UPDATE / REPLACE ACTION
  if (action === "update") {
    log.meals[mealLog.mealKey] = (mealLog.items || []).map(item => ({
      id: "meal_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: item.name,
      calories: item.calories,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      isAiLogged: true,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    }));

    saveDailyLogs();
    renderHealthTracker();
    showToast(`🔄 Đã cập nhật ${mealLog.mealType} (${mealLog.totalCalories} kcal) vào Nhật Ký Sức Khỏe!`, "success");
    return;
  }

  // CASE 3: ADD ACTION (with smart full-meal-recap / deduplication detection)
  if (!mealLog.items || mealLog.items.length === 0) return;

  // Detect if AI gave us a full meal recap including previous items:
  // e.g. targetMealList already has items and mealLog.items contains those existing items
  let isFullMealRecap = false;
  if (targetMealList.length > 0 && mealLog.items.length >= targetMealList.length) {
    const matchCount = targetMealList.filter(oldItem => {
      const oldClean = (oldItem.name || "").toLowerCase().trim();
      return mealLog.items.some(newItem => {
        const newClean = (newItem.name || "").toLowerCase().trim();
        return newClean.includes(oldClean) || oldClean.includes(newClean);
      });
    }).length;

    if (matchCount >= targetMealList.length || (targetMealList.length > 1 && matchCount >= 2)) {
      isFullMealRecap = true;
    }
  }

  if (isFullMealRecap) {
    log.meals[mealLog.mealKey] = mealLog.items.map(item => ({
      id: "meal_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: item.name,
      calories: item.calories,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      isAiLogged: true,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    }));
    saveDailyLogs();
    renderHealthTracker();
    showToast(`🔄 Đã cập nhật ${mealLog.mealType} (${mealLog.totalCalories} kcal) vào Nhật Ký!`, "success");
  } else {
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
    showToast(`🍽️ Đã thêm ${mealLog.totalCalories} kcal vào ${mealLog.mealType}!`, "success");
  }
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

    const activePersona = PERSONALITIES[state.personality] || PERSONALITIES.cheerful;

    const avatarEl = document.createElement("div");
    avatarEl.className = "message-avatar";
    avatarEl.innerHTML = msg.role === "user"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
      : `<span style="font-size:1.15rem; line-height:1;" title="${escapeHtml(activePersona.name)}">${activePersona.emoji}</span>`;

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
    metaEl.textContent = `${msg.role === "user" ? "Bạn" : ("NutriAI " + activePersona.emoji)} • ${msg.timestamp}`;

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

  let badgeText = `🍽️ ${escapeHtml(mealLog.mealType)}`;
  let badgeClass = "meal-action-badge";
  let statusText = "Đã ghi vào Sức Khỏe";
  let statusClass = "meal-action-status";

  if (mealLog.action === "update") {
    badgeText = `🔄 Cập nhật: ${escapeHtml(mealLog.mealType)}`;
    badgeClass = "meal-action-badge update";
    statusText = "Đã cập nhật lại bữa";
    statusClass = "meal-action-status update";
  } else if (mealLog.action === "delete") {
    badgeText = `🗑️ Xóa: ${escapeHtml(mealLog.mealType)}`;
    badgeClass = "meal-action-badge delete";
    statusText = "Đã xóa khỏi nhật ký";
    statusClass = "meal-action-status delete";
  }

  card.innerHTML = `
    <div class="meal-action-header">
      <div class="${badgeClass}">
        <span>${badgeText}</span>
      </div>
      <div class="${statusClass}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${statusText}</span>
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
    const provPreset = PROVIDER_PRESETS[state.apiConfig.provider] || { name: state.apiConfig.provider || "AI" };
    const errorText = `⚠️ **Không thể kết nối đến máy chủ AI (${provPreset.name}):**\n${err.message}\n\n*Gợi ý:* Bạn có thể vào tab **"Thêm & Cài Đặt API"** để kiểm tra lại API Key ${provPreset.name} hoặc chuyển sang **"Chế Độ Demo"** để ứng dụng hoạt động ngay lập tức!`;
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

// =============================================================================
// AI PERSONALITY UI RENDERING & CONTROLLER
// =============================================================================
function renderPersonalityUI() {
  const currentKey = state.personality || "cheerful";
  const currentPersona = PERSONALITIES[currentKey] || PERSONALITIES.cheerful;

  // 1. Update Header Trigger Button Icon & Name
  const headerIcon = document.getElementById("chat-header-persona-icon");
  const headerName = document.getElementById("chat-header-persona-name");
  if (headerIcon) headerIcon.textContent = currentPersona.emoji;
  if (headerName) headerName.textContent = currentPersona.name;

  // 2. Render Header Dropdown Menu Items
  const menuContainer = document.getElementById("personality-menu-items");
  if (menuContainer) {
    menuContainer.innerHTML = "";
    Object.keys(PERSONALITIES).forEach(key => {
      const p = PERSONALITIES[key];
      const isActive = key === currentKey;
      const itemBtn = document.createElement("button");
      itemBtn.type = "button";
      itemBtn.className = `personality-menu-item ${isActive ? "active" : ""}`;
      itemBtn.innerHTML = `
        <span class="personality-item-emoji">${p.emoji}</span>
        <div class="personality-item-info">
          <div class="personality-item-name">${escapeHtml(p.name)}</div>
          <div class="personality-item-desc">${escapeHtml(p.desc)}</div>
        </div>
        <span class="personality-item-check">✓</span>
      `;
      itemBtn.addEventListener("click", () => {
        savePersonality(key);
        closePersonalityDropdown();
      });
      menuContainer.appendChild(itemBtn);
    });
  }

  // 3. Render Settings Tab Personality Grid
  const settingsGrid = document.getElementById("personality-settings-grid");
  if (settingsGrid) {
    settingsGrid.innerHTML = "";
    Object.keys(PERSONALITIES).forEach(key => {
      const p = PERSONALITIES[key];
      const isActive = key === currentKey;
      const card = document.createElement("div");
      card.className = `personality-card ${isActive ? "active" : ""}`;
      card.innerHTML = `
        <div>
          <div class="personality-card-header">
            <div class="personality-card-title-group">
              <span class="personality-card-emoji">${p.emoji}</span>
              <div class="personality-card-titles">
                <div class="personality-card-name">${escapeHtml(p.name)}</div>
                <span class="personality-card-tag">${escapeHtml(p.tag)}</span>
              </div>
            </div>
            <div class="personality-card-radio"></div>
          </div>
          <div class="personality-card-desc">${escapeHtml(p.desc)}</div>
          <div class="personality-card-quote-box">
            <span class="personality-card-quote-label">Câu thoại mẫu:</span>
            <span>"${escapeHtml(p.sampleQuote)}"</span>
          </div>
        </div>
        <div class="personality-card-footer">
          <span>${isActive ? "✓ Đang kích hoạt" : "Nhấp để chọn tính cách này"}</span>
          <span>${isActive ? "● Hoạt động" : "○ Chọn"}</span>
        </div>
      `;
      card.addEventListener("click", () => {
        savePersonality(key);
      });
      settingsGrid.appendChild(card);
    });
  }

  // 4. Update Assistant name in active chat messages if needed
  if (typeof renderChatMessages === "function") {
    const metaElements = document.querySelectorAll(".message-item.assistant .message-meta");
    metaElements.forEach(meta => {
      if (meta.textContent.includes("NutriAI")) {
        const parts = meta.textContent.split("•");
        if (parts.length > 1) {
          meta.textContent = `NutriAI ${currentPersona.emoji} •${parts[1]}`;
        }
      }
    });
  }
}

function closePersonalityDropdown() {
  const wrapper = document.getElementById("personality-dropdown-wrapper");
  const menu = document.getElementById("personality-dropdown-menu");
  if (wrapper) wrapper.classList.remove("open");
  if (menu) menu.classList.add("hidden");
}

function initPersonalityUI() {
  const triggerBtn = document.getElementById("btn-personality-trigger");
  const wrapper = document.getElementById("personality-dropdown-wrapper");
  const menu = document.getElementById("personality-dropdown-menu");

  if (triggerBtn && wrapper && menu) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("open");
      if (isOpen) {
        wrapper.classList.remove("open");
        menu.classList.add("hidden");
      } else {
        wrapper.classList.add("open");
        menu.classList.remove("hidden");
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        closePersonalityDropdown();
      }
    });
  }

  renderPersonalityUI();
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

  const isToday = dateStr === getTodayDateString();

  const btnDateToday = document.getElementById("btn-date-today");
  if (btnDateToday) {
    if (isToday) {
      btnDateToday.classList.add("active");
    } else {
      btnDateToday.classList.remove("active");
    }
  }

  const datePicker = document.getElementById("health-date-picker");
  if (datePicker) datePicker.value = dateStr;

  const triggerDate = document.getElementById("calendar-trigger-date");
  if (triggerDate) {
    const parts = dateStr.split("-").map(Number);
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    triggerDate.textContent = dObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const displayDateTitle = document.getElementById("display-date-title");
  if (displayDateTitle) {
    const parts = dateStr.split("-").map(Number);
    const parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
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

  const triggerBadge = document.getElementById("calendar-trigger-badge");
  if (triggerBadge) {
    const dayStats = getDayCalorieStats(dateStr);
    if (dayStats.hasData) {
      triggerBadge.textContent = (dayStats.netBalance > 0 ? "+" : "") + dayStats.netBalance.toLocaleString("vi-VN") + " kcal";
      if (dayStats.netBalance < -100) {
        triggerBadge.className = "trigger-badge-net deficit";
      } else if (dayStats.netBalance > 100) {
        triggerBadge.className = "trigger-badge-net surplus";
      } else {
        triggerBadge.className = "trigger-badge-net balanced";
      }
    } else {
      triggerBadge.textContent = "Chưa có log";
      triggerBadge.className = "trigger-badge-net empty";
    }
  }

  renderActivityList(dayLog.activities || []);
  renderMacroSummary(dayLog, profile, targetCals);
  renderMealBlocks(dayLog.meals || {});
  renderHistoryChart();

  if (typeof calendarState !== "undefined" && calendarState.isOpen) {
    renderCalorieCalendar();
  }
}

function renderMacroSummary(dayLog, profile, targetCals) {
  const evalResult = checkDailyNutrientStatus(dayLog, profile);
  const { current, targets, pStatus, cStatus, fStatus } = evalResult;

  // 1. Protein
  const elPCur = document.getElementById("val-macro-p-cur");
  const elPTarget = document.getElementById("val-macro-p-target");
  const elPBadge = document.getElementById("badge-macro-p-status");
  const elPBar = document.getElementById("bar-macro-p");
  const elPPct = document.getElementById("pct-macro-p");
  const elPCal = document.getElementById("cal-macro-p");

  if (elPCur) elPCur.textContent = current.protein;
  if (elPTarget) elPTarget.textContent = targets.protein;
  if (elPBadge) {
    elPBadge.textContent = pStatus.label;
    elPBadge.className = `macro-status-tag ${pStatus.type}`;
  }
  if (elPBar) {
    elPBar.style.width = `${Math.min(100, pStatus.pct)}%`;
    elPBar.className = pStatus.pct > 125 ? "macro-progress-fill protein over" : "macro-progress-fill protein";
  }
  if (elPPct) elPPct.textContent = `${pStatus.pct}% mục tiêu`;
  if (elPCal) elPCal.textContent = `~${Math.round(current.protein * 4)} kcal`;

  // 2. Carbs
  const elCCur = document.getElementById("val-macro-c-cur");
  const elCTarget = document.getElementById("val-macro-c-target");
  const elCBadge = document.getElementById("badge-macro-c-status");
  const elCBar = document.getElementById("bar-macro-c");
  const elCPct = document.getElementById("pct-macro-c");
  const elCCal = document.getElementById("cal-macro-c");

  if (elCCur) elCCur.textContent = current.carbs;
  if (elCTarget) elCTarget.textContent = targets.carbs;
  if (elCBadge) {
    elCBadge.textContent = cStatus.label;
    elCBadge.className = `macro-status-tag ${cStatus.type}`;
  }
  if (elCBar) {
    elCBar.style.width = `${Math.min(100, cStatus.pct)}%`;
    elCBar.className = cStatus.pct > 125 ? "macro-progress-fill carbs over" : "macro-progress-fill carbs";
  }
  if (elCPct) elCPct.textContent = `${cStatus.pct}% mục tiêu`;
  if (elCCal) elCCal.textContent = `~${Math.round(current.carbs * 4)} kcal`;

  // 3. Fat
  const elFCur = document.getElementById("val-macro-f-cur");
  const elFTarget = document.getElementById("val-macro-f-target");
  const elFBadge = document.getElementById("badge-macro-f-status");
  const elFBar = document.getElementById("bar-macro-f");
  const elFPct = document.getElementById("pct-macro-f");
  const elFCal = document.getElementById("cal-macro-f");

  if (elFCur) elFCur.textContent = current.fat;
  if (elFTarget) elFTarget.textContent = targets.fat;
  if (elFBadge) {
    elFBadge.textContent = fStatus.label;
    elFBadge.className = `macro-status-tag ${fStatus.type}`;
  }
  if (elFBar) {
    elFBar.style.width = `${Math.min(100, fStatus.pct)}%`;
    elFBar.className = fStatus.pct > 125 ? "macro-progress-fill fat over" : "macro-progress-fill fat";
  }
  if (elFPct) elFPct.textContent = `${fStatus.pct}% mục tiêu`;
  if (elFCal) elFCal.textContent = `~${Math.round(current.fat * 9)} kcal`;

  // 4. Nutrient Check Report Banner
  const elBanner = document.getElementById("macro-status-banner");
  const elIcon = document.getElementById("nutrient-check-icon");
  const elTitle = document.getElementById("nutrient-check-title");
  const elDesc = document.getElementById("nutrient-check-desc");
  const elAdvice = document.getElementById("nutrient-check-advice");

  if (elBanner) elBanner.className = `nutrient-check-banner ${evalResult.status}`;
  if (elIcon) elIcon.textContent = evalResult.icon;
  if (elTitle) elTitle.textContent = evalResult.title;
  if (elDesc) elDesc.textContent = evalResult.desc;
  if (elAdvice) {
    if (evalResult.advice) {
      elAdvice.textContent = evalResult.advice;
      elAdvice.style.display = "inline-block";
    } else {
      elAdvice.style.display = "none";
    }
  }
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
    const mealCals = list.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
    const mealP = Math.round(list.reduce((sum, item) => sum + (Number(item.protein) || 0), 0) * 10) / 10;
    const mealC = Math.round(list.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0) * 10) / 10;
    const mealF = Math.round(list.reduce((sum, item) => sum + (Number(item.fat) || 0), 0) * 10) / 10;

    const block = document.createElement("div");
    block.className = "meal-block";

    let foodItemsHtml = "";
    if (list.length === 0) {
      foodItemsHtml = `<div class="empty-meal-text">Chưa có món nào. Nhắn với Trợ lý AI hoặc bấm "+ Thêm món"</div>`;
    } else {
      list.forEach((item, idx) => {
        const itemP = item.protein !== undefined ? item.protein : 0;
        const itemC = item.carbs !== undefined ? item.carbs : 0;
        const itemF = item.fat !== undefined ? item.fat : 0;

        foodItemsHtml += `
          <div class="meal-food-entry">
            <div class="food-entry-left">
              <span style="font-weight:600;">${escapeHtml(item.name)}</span>
              ${item.isAiLogged ? `<span class="ai-logged-badge" title="Được ghi tự động từ Trợ lý Chat AI">✨ AI ghi nhận</span>` : ""}
              <div class="food-macro-badges">
                <span class="macro-tag p" title="Protein (Đạm)">🥩 ${itemP}g P</span>
                <span class="macro-tag c" title="Carbs (Tinh bột)">🍚 ${itemC}g C</span>
                <span class="macro-tag f" title="Fat (Chất béo)">🥑 ${itemF}g F</span>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="font-weight:700; color:#f59e0b;">+${item.calories} kcal</span>
              <button type="button" class="btn-edit-row" title="Chỉnh sửa món này" onclick="openEditFoodModal('${def.key}', ${idx})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
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
        <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; justify-content:flex-end;">
          <span class="meal-cal-badge">${mealCals} kcal</span>
          ${list.length > 0 ? `<span class="meal-macro-summary" title="Tổng chất bữa này">(P: ${mealP}g | C: ${mealC}g | F: ${mealF}g)</span>` : ""}
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

function openEditFoodModal(mealKey, index) {
  const dayLog = getDailyLog(state.selectedDate);
  const item = dayLog.meals?.[mealKey]?.[index];
  if (!item) return;

  const modal = document.getElementById("modal-edit-food");
  const selectMeal = document.getElementById("edit-food-meal");
  const inputName = document.getElementById("edit-food-name");
  const inputCal = document.getElementById("edit-food-cal");
  const inputP = document.getElementById("edit-food-p");
  const inputC = document.getElementById("edit-food-c");
  const inputF = document.getElementById("edit-food-f");
  const inputOrigMeal = document.getElementById("edit-food-orig-meal");
  const inputOrigIndex = document.getElementById("edit-food-orig-index");

  if (selectMeal) selectMeal.value = mealKey;
  if (inputName) inputName.value = item.name || "";
  if (inputCal) inputCal.value = item.calories !== undefined ? item.calories : 0;
  if (inputP) inputP.value = item.protein !== undefined ? item.protein : 0;
  if (inputC) inputC.value = item.carbs !== undefined ? item.carbs : 0;
  if (inputF) inputF.value = item.fat !== undefined ? item.fat : 0;
  if (inputOrigMeal) inputOrigMeal.value = mealKey;
  if (inputOrigIndex) inputOrigIndex.value = index;

  if (modal) modal.classList.add("open");
}

function closeEditFoodModal() {
  const modal = document.getElementById("modal-edit-food");
  if (modal) modal.classList.remove("open");
  const form = document.getElementById("form-edit-food");
  if (form) form.reset();
}

function handleSaveEditFood(e) {
  e.preventDefault();
  const origMealKey = document.getElementById("edit-food-orig-meal")?.value;
  const origIndex = parseInt(document.getElementById("edit-food-orig-index")?.value, 10);
  const newMealKey = document.getElementById("edit-food-meal")?.value;
  const newName = document.getElementById("edit-food-name")?.value.trim();
  const newCal = parseInt(document.getElementById("edit-food-cal")?.value, 10) || 0;
  const newP = parseFloat(document.getElementById("edit-food-p")?.value) || 0;
  const newC = parseFloat(document.getElementById("edit-food-c")?.value) || 0;
  const newF = parseFloat(document.getElementById("edit-food-f")?.value) || 0;

  if (!newName) return;

  const dayLog = getDailyLog(state.selectedDate);
  const origList = dayLog.meals?.[origMealKey];
  if (!origList || origList[origIndex] === undefined) {
    closeEditFoodModal();
    return;
  }

  const existingItem = origList[origIndex];

  if (origMealKey === newMealKey) {
    existingItem.name = newName;
    existingItem.calories = newCal;
    existingItem.protein = newP;
    existingItem.carbs = newC;
    existingItem.fat = newF;
  } else {
    origList.splice(origIndex, 1);
    if (!dayLog.meals[newMealKey]) dayLog.meals[newMealKey] = [];
    dayLog.meals[newMealKey].push({
      ...existingItem,
      name: newName,
      calories: newCal,
      protein: newP,
      carbs: newC,
      fat: newF
    });
  }

  saveDailyLogs();
  renderHealthTracker();
  closeEditFoodModal();
  showToast(`Đã cập nhật món "${newName}" (${newCal} kcal | ${newP}g P, ${newC}g C, ${newF}g F)!`, "success");
}

function handleDeleteFromEditModal() {
  const origMealKey = document.getElementById("edit-food-orig-meal")?.value;
  const origIndex = parseInt(document.getElementById("edit-food-orig-index")?.value, 10);
  if (origMealKey && !isNaN(origIndex)) {
    deleteFoodItem(origMealKey, origIndex);
  }
  closeEditFoodModal();
}

function renderHistoryChart() {
  const container = document.getElementById("history-chart-bars");
  if (!container) return;

  container.innerHTML = "";

  const profile = state.profile;
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

  const days = [];
  const currParts = (state.selectedDate || getTodayDateString()).split("-").map(Number);
  const curr = new Date(currParts[0], currParts[1] - 1, currParts[2]);
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
function updateModelDropdown(provider, selectedModel) {
  const selectModel = document.getElementById("select-model-preset");
  if (!selectModel) return;

  const p = provider || "gemini";
  const preset = PROVIDER_PRESETS[p] || PROVIDER_PRESETS.gemini;
  const models = preset.models || [];

  selectModel.innerHTML = "";

  models.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = m;
    let label = m;
    if (idx === 0) label += " (Khuyên dùng)";
    else if (m.includes(":free")) label += " (Miễn phí)";
    opt.textContent = label;
    if (m === selectedModel) opt.selected = true;
    selectModel.appendChild(opt);
  });

  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = "-- Nhập tên model khác --";
  if (!models.includes(selectedModel)) {
    customOpt.selected = true;
  }
  selectModel.appendChild(customOpt);
}

function updateApiGuideUI(provider, config) {
  const guideTitle = document.getElementById("guide-title");
  const guideDesc = document.getElementById("guide-desc");
  const guideCurl = document.getElementById("guide-curl-preview");
  const guideLinks = document.getElementById("guide-links");
  const hintKey = document.getElementById("hint-api-key");
  const hintUrl = document.getElementById("hint-api-url");
  const labelKey = document.getElementById("label-api-key-text");
  const apiSubtitle = document.getElementById("api-config-subtitle");

  const p = provider || "gemini";
  const provPreset = PROVIDER_PRESETS[p] || PROVIDER_PRESETS.gemini;
  const currentModel = config.model || provPreset.model || "mặc định";
  const sampleKey = (config.apiKey && config.apiKey.trim()) ? (config.apiKey.slice(0, 8) + "...") : "YOUR_API_KEY";

  if (labelKey) {
    labelKey.textContent = `API Key (${provPreset.name})`;
  }

  if (apiSubtitle) {
    apiSubtitle.textContent = `Hỗ trợ kết nối ${provPreset.name}, Google Gemini, OpenRouter, OpenAI, Groq`;
  }

  if (p === "openrouter") {
    if (hintKey) {
      hintKey.innerHTML = `Gửi trong header <code>Authorization: Bearer</code> tới OpenRouter API. Key được lưu an toàn trong trình duyệt (localStorage).`;
    }
    if (hintUrl) {
      hintUrl.innerHTML = `Định dạng: <code>https://openrouter.ai/api/v1/chat/completions</code>`;
    }
    if (guideTitle) guideTitle.textContent = "Cấu Trúc Gọi OpenRouter API Đang Dùng";
    if (guideDesc) guideDesc.textContent = "Hệ thống kết nối trực tiếp qua chuẩn OpenAI-compatible của OpenRouter:";
    if (guideCurl) {
      guideCurl.textContent = `curl "https://openrouter.ai/api/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "HTTP-Referer: ${window.location.origin || "http://localhost:3000"}" \\
  -H "X-Title: NutriAI Assistant" \\
  -X POST \\
  -d '{
    "model": "${currentModel}",
    "messages": [
      { "role": "user", "content": "Xin chào, hãy phân tích calo giúp tôi" }
    ]
  }'`;
    }
    if (guideLinks) {
      guideLinks.innerHTML = `
        <li><strong>Lấy Key OpenRouter:</strong> Truy cập <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">OpenRouter Keys (openrouter.ai/keys)</a> để tạo API key.</li>
        <li><strong>Mô hình Miễn Phí (Free):</strong> <code>meta-llama/llama-3.3-70b-instruct:free</code>, <code>google/gemini-2.0-flash-exp:free</code>, <code>deepseek/deepseek-r1:free</code>, <code>mistralai/mistral-7b-instruct:free</code>.</li>
        <li><strong>Mô hình Cao Cấp giá rẻ:</strong> <code>deepseek/deepseek-chat</code>, <code>openai/gpt-4o-mini</code>, <code>qwen/qwen-2.5-72b-instruct</code>.</li>
      `;
    }
  } else if (p === "openai") {
    if (hintKey) hintKey.innerHTML = `Gửi trong header <code>Authorization: Bearer</code> tới OpenAI. Key lưu an toàn trong trình duyệt.`;
    if (hintUrl) hintUrl.innerHTML = `Định dạng: <code>https://api.openai.com/v1/chat/completions</code>`;
    if (guideTitle) guideTitle.textContent = "Cấu Trúc Gọi OpenAI API Đang Dùng";
    if (guideDesc) guideDesc.textContent = "Kết nối trực tiếp qua REST API của OpenAI:";
    if (guideCurl) {
      guideCurl.textContent = `curl "https://api.openai.com/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -X POST \\
  -d '{
    "model": "${currentModel}",
    "messages": [{ "role": "user", "content": "Xin chào" }]
  }'`;
    }
    if (guideLinks) {
      guideLinks.innerHTML = `<li><strong>Lấy Key OpenAI:</strong> Truy cập <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a>.</li>`;
    }
  } else if (p === "groq") {
    if (hintKey) hintKey.innerHTML = `Gửi trong header <code>Authorization: Bearer</code> tới Groq Cloud API.`;
    if (hintUrl) hintUrl.innerHTML = `Định dạng: <code>https://api.groq.com/openai/v1/chat/completions</code>`;
    if (guideTitle) guideTitle.textContent = "Cấu Trúc Gọi Groq API Đang Dùng";
    if (guideDesc) guideDesc.textContent = "Kết nối tốc độ cao LPU qua Groq Cloud:";
    if (guideCurl) {
      guideCurl.textContent = `curl "https://api.groq.com/openai/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -X POST \\
  -d '{
    "model": "${currentModel}",
    "messages": [{ "role": "user", "content": "Xin chào" }]
  }'`;
    }
    if (guideLinks) {
      guideLinks.innerHTML = `<li><strong>Lấy Key Groq:</strong> Truy cập <a href="https://console.groq.com/keys" target="_blank" rel="noopener">Groq Console</a> (miễn phí và siêu nhanh).</li>`;
    }
  } else if (p === "custom") {
    if (hintKey) hintKey.innerHTML = `Header <code>Authorization: Bearer</code> (nếu máy chủ yêu cầu).`;
    if (hintUrl) hintUrl.innerHTML = `Định dạng máy chủ OpenAI-compatible cục bộ (ví dụ: Ollama, vLLM, LM Studio).`;
    if (guideTitle) guideTitle.textContent = "Cấu Trúc Gọi API Custom Đang Dùng";
    if (guideDesc) guideDesc.textContent = "Kết nối tới endpoint OpenAI-compatible tùy chỉnh:";
    if (guideCurl) {
      guideCurl.textContent = `curl "${config.baseUrl || "http://localhost:11434/v1"}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{"model": "${currentModel}", "messages": [{"role": "user", "content": "Xin chào"}]}'`;
    }
    if (guideLinks) {
      guideLinks.innerHTML = `<li>Phù hợp chạy offline nội bộ bằng Ollama (<code>ollama run llama3</code>) hoặc LM Studio.</li>`;
    }
  } else if (p === "demo") {
    if (hintKey) hintKey.innerHTML = `Chế độ Demo hoạt động cục bộ 100%, không gửi dữ liệu ra bên ngoài.`;
    if (hintUrl) hintUrl.innerHTML = `Không cần Endpoint URL.`;
    if (guideTitle) guideTitle.textContent = "Chế Độ Demo Offline";
    if (guideDesc) guideDesc.textContent = "Bộ giả lập AI thông minh NutriAI Smart Simulator tích hợp sẵn trong trình duyệt.";
    if (guideCurl) guideCurl.textContent = `// Không cần cURL, ứng dụng tự động phân tích calo trực tiếp trên trình duyệt`;
    if (guideLinks) {
      guideLinks.innerHTML = `<li>Không cần API key hoặc kết nối internet để thử nghiệm tính năng cơ bản.</li>`;
    }
  } else {
    // Default Gemini
    if (hintKey) {
      hintKey.innerHTML = `Gửi trực tiếp trong header <code>X-goog-api-key</code> tới máy chủ Google AI. Key được lưu an toàn trong trình duyệt (localStorage).`;
    }
    if (hintUrl) {
      hintUrl.innerHTML = `Định dạng: <code>https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent</code>`;
    }
    if (guideTitle) guideTitle.textContent = "Cấu Trúc Gọi API Google Gemini Đang Dùng";
    if (guideDesc) guideDesc.textContent = "Hệ thống kết nối trực tiếp theo định dạng chuẩn của Google Generative Language API:";
    if (guideCurl) {
      guideCurl.textContent = `curl "https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent" \\
  -H 'Content-Type: application/json' \\
  -H 'X-goog-api-key: ${sampleKey}' \\
  -X POST \\
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "Explain how AI works in a few words" }]
      }
    ]
  }'`;
    }
    if (guideLinks) {
      guideLinks.innerHTML = `
        <li><strong>Lấy Key miễn phí:</strong> Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio (aistudio.google.com)</a> để tạo Gemini API Key.</li>
        <li><strong>Mô hình:</strong> <code>gemini-flash-latest</code>, <code>gemini-1.5-flash</code> hoặc <code>gemini-2.0-flash</code>.</li>
        <li><strong>Chế độ Demo:</strong> Nếu chưa có key ngay, chọn "Chế Độ Demo" để thử nghiệm.</li>
      `;
    }
  }
}

function syncApiSettingsUI() {
  const config = state.apiConfig;
  const p = config.provider || "gemini";
  const provPreset = PROVIDER_PRESETS[p] || PROVIDER_PRESETS.gemini;

  const statusDot = document.getElementById("api-status-dot");
  const statusText = document.getElementById("api-status-text");
  const chatModelName = document.getElementById("chat-model-name");
  const brandTag = document.querySelector(".brand-tag");

  if (brandTag) {
    brandTag.textContent = p === "demo" ? "Demo AI" : `${provPreset.name} AI`;
  }

  if (p === "demo") {
    if (statusDot) statusDot.className = "status-dot demo";
    if (statusText) statusText.textContent = "Chế độ Demo (Mô phỏng)";
    if (chatModelName) chatModelName.textContent = "NutriAI Smart Simulator (Demo)";
  } else if (config.apiKey && config.apiKey.trim()) {
    if (statusDot) statusDot.className = "status-dot active";
    if (statusText) statusText.textContent = `${provPreset.name}: ${config.model || provPreset.model}`;
    if (chatModelName) chatModelName.textContent = `NutriAI Assistant (${provPreset.name} - ${config.model || provPreset.model})`;
  } else {
    if (statusDot) statusDot.className = "status-dot";
    if (statusText) statusText.textContent = `Chưa có API Key (${provPreset.name})`;
    if (chatModelName) chatModelName.textContent = `NutriAI (${provPreset.name} - Chưa cấu hình Key)`;
  }

  document.querySelectorAll(".provider-card").forEach(card => {
    const prov = card.getAttribute("data-provider");
    card.classList.toggle("active", prov === config.provider);
  });

  const inputKey = document.getElementById("input-api-key");
  if (inputKey) inputKey.value = config.apiKey || "";

  const inputUrl = document.getElementById("input-api-url");
  if (inputUrl) inputUrl.value = config.baseUrl || provPreset.baseUrl || "";

  const inputCustomModel = document.getElementById("input-model-custom");
  const currentModel = config.model || provPreset.model;
  if (inputCustomModel) inputCustomModel.value = currentModel;

  updateModelDropdown(config.provider, currentModel);

  const inputTemp = document.getElementById("input-temperature");
  const labelTemp = document.getElementById("label-temp-val");
  if (inputTemp) inputTemp.value = config.temperature !== undefined ? config.temperature : 0.5;
  if (labelTemp) labelTemp.textContent = config.temperature !== undefined ? config.temperature : "0.5";

  const promptInput = document.getElementById("input-system-prompt");
  if (promptInput) promptInput.value = state.systemPrompt;

  updateApiGuideUI(config.provider, config);
}

async function testApiConnection() {
  const resultEl = document.getElementById("test-conn-result");
  const btnTest = document.getElementById("btn-test-connection");

  if (!resultEl || !btnTest) return;

  const { provider, apiKey, baseUrl, model } = state.apiConfig;
  const p = provider || "gemini";
  const provPreset = PROVIDER_PRESETS[p] || PROVIDER_PRESETS.gemini;
  const provName = provPreset.name;
  const currentModel = model || provPreset.model || "mặc định";

  if (provider === "demo") {
    resultEl.className = "conn-test-result success";
    resultEl.innerHTML = `<span>✅ Chế độ Demo đang hoạt động tốt. Sẵn sàng phân tích tự động calo thức ăn và vận động mà không cần API key!</span>`;
    return;
  }

  if (!apiKey || !apiKey.trim()) {
    resultEl.className = "conn-test-result error";
    resultEl.innerHTML = `<span>⚠️ Vui lòng nhập API Key (${escapeHtml(provName)}) trước khi kiểm tra kết nối.</span>`;
    return;
  }

  btnTest.disabled = true;
  resultEl.className = "conn-test-result";
  resultEl.style.display = "flex";
  resultEl.innerHTML = `<span>⏳ Đang kiểm tra kết nối tới ${escapeHtml(provName)} (${escapeHtml(currentModel)})...</span>`;

  const startTime = Date.now();

  try {
    const testMessages = [
      { role: "user", content: "Explain how AI works in a few words" }
    ];

    const response = await requestAiCompletion(testMessages);
    const latency = Date.now() - startTime;

    resultEl.className = "conn-test-result success";
    resultEl.innerHTML = `<span>✅ Kết nối thành công tới ${escapeHtml(provName)} - mô hình <strong>${escapeHtml(currentModel)}</strong> (${latency}ms)!<br>Phản hồi: <em>"${escapeHtml(response.slice(0, 120))}..."</em></span>`;
    showToast(`Kết nối ${provName} API thành công!`, "success");
  } catch (err) {
    resultEl.className = "conn-test-result error";
    resultEl.innerHTML = `<span>❌ Kết nối ${escapeHtml(provName)} thất bại: ${escapeHtml(err.message)}</span>`;
    showToast(`Kết nối API thất bại: ${err.message}`, "error");
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
    renderPersonalityUI();
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
// 9.5. CUSTOM CALORIE DATEPICKER & CANVAS CALENDAR
// =============================================================================
const calendarState = {
  viewingYear: new Date().getFullYear(),
  viewingMonth: new Date().getMonth(), // 0-indexed: 0 = Jan, 11 = Dec
  isOpen: false
};

let currentMonthChartData = [];

function getDayCalorieStats(dateStr) {
  const profile = state.profile;
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const dayLog = state.dailyLogs[dateStr];

  if (!dayLog) {
    return {
      hasData: false,
      intake: 0,
      activityBurn: 0,
      totalBurned: bmr,
      netBalance: 0
    };
  }

  let totalIntake = 0;
  let hasFood = false;
  const mealKeys = ["breakfast", "lunch", "dinner", "snack"];
  mealKeys.forEach(mKey => {
    (dayLog.meals?.[mKey] || []).forEach(item => {
      totalIntake += (item.calories || 0);
      hasFood = true;
    });
  });

  const activities = dayLog.activities || [];
  const totalActivityBurn = activities.reduce((sum, act) => sum + (act.calories || 0), 0);
  const hasActivity = activities.length > 0;
  const hasData = hasFood || hasActivity;

  const totalBurned = bmr + totalActivityBurn;
  const netBalance = hasData ? (totalIntake - totalBurned) : 0;

  return {
    hasData,
    intake: totalIntake,
    activityBurn: totalActivityBurn,
    totalBurned,
    netBalance
  };
}

function openCalorieCalendar() {
  const modal = document.getElementById("modal-calorie-calendar");
  if (!modal) return;
  const parts = (state.selectedDate || getTodayDateString()).split("-").map(Number);
  calendarState.viewingYear = parts[0];
  calendarState.viewingMonth = parts[1] - 1;
  calendarState.isOpen = true;
  modal.classList.add("open");
  renderCalorieCalendar();
}

function closeCalorieCalendar() {
  const modal = document.getElementById("modal-calorie-calendar");
  if (modal) modal.classList.remove("open");
  calendarState.isOpen = false;
}

function renderCalorieCalendar() {
  const container = document.getElementById("calendar-days-grid");
  const monthYearLabel = document.getElementById("calendar-month-year-label");
  const canvas = document.getElementById("calendar-month-canvas");
  if (!container) return;

  const year = calendarState.viewingYear;
  const month = calendarState.viewingMonth;

  if (monthYearLabel) {
    monthYearLabel.textContent = `Tháng ${month + 1}, ${year}`;
  }

  container.innerHTML = "";

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0, Sun = 6

  const todayStr = getTodayDateString();
  let deficitCount = 0;
  let surplusCount = 0;
  let totalNetOfDataDays = 0;
  let dataDaysCount = 0;

  currentMonthChartData = [];

  // 1. Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDayNum = daysInPrevMonth - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYearNum = month === 0 ? year - 1 : year;
    const dateStr = `${prevYearNum}-${String(prevMonthIdx + 1).padStart(2, "0")}-${String(prevDayNum).padStart(2, "0")}`;

    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = `<span class="cal-day-num">${prevDayNum}</span>`;
    cell.onclick = () => {
      calendarState.viewingYear = prevYearNum;
      calendarState.viewingMonth = prevMonthIdx;
      state.selectedDate = dateStr;
      closeCalorieCalendar();
      renderHealthTracker();
    };
    container.appendChild(cell);
  }

  // 2. Current month active days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const stats = getDayCalorieStats(dateStr);
    currentMonthChartData.push({ day: d, dateStr, ...stats });

    const isToday = dateStr === todayStr;
    const isSelected = dateStr === state.selectedDate;

    const cell = document.createElement("div");
    let cellClass = "cal-day-cell";
    if (isToday) cellClass += " is-today";
    if (isSelected) cellClass += " is-selected";
    cell.className = cellClass;

    let badgeHtml = "";
    if (stats.hasData) {
      dataDaysCount++;
      totalNetOfDataDays += stats.netBalance;

      let badgeClass = "cal-badge";
      let prefix = "";
      if (stats.netBalance < -100) {
        badgeClass += " deficit";
        deficitCount++;
        prefix = "";
      } else if (stats.netBalance > 100) {
        badgeClass += " surplus";
        surplusCount++;
        prefix = "+";
      } else {
        badgeClass += " balanced";
        prefix = stats.netBalance > 0 ? "+" : "";
      }

      const sign = prefix + stats.netBalance.toLocaleString("vi-VN");
      badgeHtml = `<span class="${badgeClass}">${sign}</span>`;
      cell.setAttribute("title", `Ngày ${d}/${month + 1}/${year}\n• Calo nạp: ${stats.intake.toLocaleString("vi-VN")} kcal\n• Tiêu hao: ${stats.totalBurned.toLocaleString("vi-VN")} kcal\n• Hiệu số: ${sign} kcal`);
    } else {
      cell.setAttribute("title", `Ngày ${d}/${month + 1}/${year}\n(Chưa có nhật ký ăn uống/vận động)`);
    }

    cell.innerHTML = `
      <span class="cal-day-num">${d}</span>
      ${badgeHtml}
    `;

    cell.onclick = () => {
      state.selectedDate = dateStr;
      closeCalorieCalendar();
      renderHealthTracker();
    };

    container.appendChild(cell);
  }

  // 3. Next month leading days to complete full weeks
  const totalRendered = firstDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalRendered % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYearNum = month === 11 ? year + 1 : year;
    const dateStr = `${nextYearNum}-${String(nextMonthIdx + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;

    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = `<span class="cal-day-num">${n}</span>`;
    cell.onclick = () => {
      calendarState.viewingYear = nextYearNum;
      calendarState.viewingMonth = nextMonthIdx;
      state.selectedDate = dateStr;
      closeCalorieCalendar();
      renderHealthTracker();
    };
    container.appendChild(cell);
  }

  // Update summary chips
  const elDeficit = document.getElementById("cal-summary-deficit-days");
  if (elDeficit) elDeficit.textContent = `${deficitCount} ngày`;

  const elSurplus = document.getElementById("cal-summary-surplus-days");
  if (elSurplus) elSurplus.textContent = `${surplusCount} ngày`;

  const elAvg = document.getElementById("cal-summary-avg-net");
  if (elAvg) {
    if (dataDaysCount > 0) {
      const avg = Math.round(totalNetOfDataDays / dataDaysCount);
      elAvg.textContent = (avg > 0 ? "+" : "") + avg.toLocaleString("vi-VN") + " kcal";
    } else {
      elAvg.textContent = "Chưa có dữ liệu";
    }
  }

  const elCanvasSum = document.getElementById("calendar-canvas-summary");
  if (elCanvasSum) {
    elCanvasSum.textContent = `${dataDaysCount}/${daysInMonth} ngày có dữ liệu`;
  }

  // Render HTML5 Canvas
  if (canvas) {
    drawCalendarMonthCanvas(canvas, currentMonthChartData);
  }
}

function drawCalendarMonthCanvas(canvas, data) {
  if (!canvas || !data || data.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 560;
  const height = rect.height || 48;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  const baselineY = Math.round(height * 0.5);

  // Draw dashed baseline (zero net balance)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(10, baselineY);
  ctx.lineTo(width - 10, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Find max value to scale
  let maxAbs = 600;
  data.forEach(d => {
    if (d.hasData && Math.abs(d.netBalance) > maxAbs) {
      maxAbs = Math.abs(d.netBalance);
    }
  });

  const availableHeight = (height * 0.5) - 5;
  const stepX = (width - 24) / (data.length - 1 || 1);
  const barWidth = Math.max(3, Math.min(10, stepX * 0.65));

  data.forEach((d, idx) => {
    const x = 12 + idx * stepX;
    if (!d.hasData) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
      ctx.beginPath();
      ctx.arc(x, baselineY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const ratio = Math.min(1, Math.abs(d.netBalance) / maxAbs);
    const barH = Math.max(4, ratio * availableHeight);

    if (d.netBalance < -100) {
      // Deficit: green bar
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x - barWidth / 2, baselineY, barWidth, barH, [0, 0, 2, 2]);
      } else {
        ctx.rect(x - barWidth / 2, baselineY, barWidth, barH);
      }
      ctx.fill();
    } else if (d.netBalance > 100) {
      // Surplus: red bar
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x - barWidth / 2, baselineY - barH, barWidth, barH, [2, 2, 0, 0]);
      } else {
        ctx.rect(x - barWidth / 2, baselineY - barH, barWidth, barH);
      }
      ctx.fill();
    } else {
      // Balanced: blue dot
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(x, baselineY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
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
      state.selectedDate = shiftDateString(state.selectedDate, -1);
      renderHealthTracker();
    });
  }

  if (btnDateNext) {
    btnDateNext.addEventListener("click", () => {
      state.selectedDate = shiftDateString(state.selectedDate, 1);
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

  const btnOpenCal = document.getElementById("btn-open-calendar");
  if (btnOpenCal) {
    btnOpenCal.addEventListener("click", openCalorieCalendar);
  }

  const btnCloseCal = document.getElementById("btn-close-calendar-modal");
  const btnCloseCal2 = document.getElementById("btn-close-calendar-modal-2");
  if (btnCloseCal) btnCloseCal.addEventListener("click", closeCalorieCalendar);
  if (btnCloseCal2) btnCloseCal2.addEventListener("click", closeCalorieCalendar);

  const calModal = document.getElementById("modal-calorie-calendar");
  if (calModal) {
    calModal.addEventListener("click", e => {
      if (e.target === calModal) closeCalorieCalendar();
    });
  }

  const btnCalPrevMonth = document.getElementById("btn-cal-prev-month");
  if (btnCalPrevMonth) {
    btnCalPrevMonth.addEventListener("click", () => {
      if (calendarState.viewingMonth === 0) {
        calendarState.viewingMonth = 11;
        calendarState.viewingYear--;
      } else {
        calendarState.viewingMonth--;
      }
      renderCalorieCalendar();
    });
  }

  const btnCalNextMonth = document.getElementById("btn-cal-next-month");
  if (btnCalNextMonth) {
    btnCalNextMonth.addEventListener("click", () => {
      if (calendarState.viewingMonth === 11) {
        calendarState.viewingMonth = 0;
        calendarState.viewingYear++;
      } else {
        calendarState.viewingMonth++;
      }
      renderCalorieCalendar();
    });
  }

  const btnCalToday = document.getElementById("btn-cal-today");
  if (btnCalToday) {
    btnCalToday.addEventListener("click", () => {
      const todayParts = getTodayDateString().split("-").map(Number);
      calendarState.viewingYear = todayParts[0];
      calendarState.viewingMonth = todayParts[1] - 1;
      state.selectedDate = getTodayDateString();
      renderCalorieCalendar();
      renderHealthTracker();
    });
  }

  window.addEventListener("resize", () => {
    if (calendarState && calendarState.isOpen) {
      const canvas = document.getElementById("calendar-month-canvas");
      if (canvas && currentMonthChartData) {
        drawCalendarMonthCanvas(canvas, currentMonthChartData);
      }
    }
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && calendarState && calendarState.isOpen) {
      closeCalorieCalendar();
    }
  });

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
      const p = parseFloat(document.getElementById("manual-food-p")?.value) || 0;
      const c = parseFloat(document.getElementById("manual-food-c")?.value) || 0;
      const f = parseFloat(document.getElementById("manual-food-f")?.value) || 0;

      if (!name || cal <= 0) return;

      const dayLog = getDailyLog(state.selectedDate);
      dayLog.meals[mealKey].push({
        id: "meal_manual_" + Date.now(),
        name,
        calories: cal,
        protein: p,
        carbs: c,
        fat: f,
        isAiLogged: false,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      });

      saveDailyLogs();
      renderHealthTracker();
      closeAddFoodModal();
      showToast(`Đã thêm "${name}" (+${cal} kcal | ${p}g P, ${c}g C, ${f}g F) vào nhật ký.`, "success");
    });
  }

  const btnAskAiCheck = document.getElementById("btn-ask-ai-macro-check");
  if (btnAskAiCheck) {
    btnAskAiCheck.addEventListener("click", () => {
      switchTab("tab-chat");
      const checkPrompt = "Hôm nay tôi đã đủ chất hay thừa chất gì chưa? Hãy kiểm tra dinh dưỡng giúp tôi.";
      handleSendMessage(checkPrompt);
    });
  }

  const btnCloseEditFood = document.getElementById("btn-close-edit-food-modal");
  const btnCancelEditFood = document.getElementById("btn-cancel-edit-food-modal");
  const btnDeleteFromEdit = document.getElementById("btn-delete-from-edit-modal");
  const formEditFood = document.getElementById("form-edit-food");
  const modalEditFood = document.getElementById("modal-edit-food");

  if (btnCloseEditFood) btnCloseEditFood.addEventListener("click", closeEditFoodModal);
  if (btnCancelEditFood) btnCancelEditFood.addEventListener("click", closeEditFoodModal);
  if (btnDeleteFromEdit) btnDeleteFromEdit.addEventListener("click", handleDeleteFromEditModal);
  if (formEditFood) formEditFood.addEventListener("submit", handleSaveEditFood);
  if (modalEditFood) {
    modalEditFood.addEventListener("click", e => {
      if (e.target === modalEditFood) closeEditFoodModal();
    });
  }

  const modalAddFood = document.getElementById("modal-add-food");
  if (modalAddFood) {
    modalAddFood.addEventListener("click", e => {
      if (e.target === modalAddFood) closeAddFoodModal();
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

  if (inputApiKey) {
    const handleKeyDetection = () => {
      const val = inputApiKey.value.trim();
      const detected = detectProviderFromKey(val);
      if (detected && detected !== state.apiConfig.provider) {
        state.apiConfig.provider = detected;
        const preset = PROVIDER_PRESETS[detected];
        if (preset) {
          state.apiConfig.baseUrl = preset.baseUrl;
          state.apiConfig.model = preset.model;
        }
        syncApiSettingsUI();
        showToast(`Đã tự động chuyển sang nhà cung cấp: ${PROVIDER_PRESETS[detected].name}!`, "success");
      }
    };

    inputApiKey.addEventListener("input", handleKeyDetection);
    inputApiKey.addEventListener("paste", () => {
      setTimeout(handleKeyDetection, 60);
    });
  }

  const selectModel = document.getElementById("select-model-preset");
  const inputCustomModel = document.getElementById("input-model-custom");
  if (selectModel && inputCustomModel) {
    selectModel.addEventListener("change", () => {
      if (selectModel.value !== "custom") {
        inputCustomModel.value = selectModel.value;
        state.apiConfig.model = selectModel.value;
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

      // Tự động nhận diện provider nếu người dùng dán key đặc thù (OpenRouter / Groq / OpenAI / Gemini)
      const detected = detectProviderFromKey(apiKeyVal);
      if (detected && detected !== state.apiConfig.provider && (state.apiConfig.provider === "gemini" || state.apiConfig.provider === "demo")) {
        state.apiConfig.provider = detected;
      } else if (apiKeyVal && state.apiConfig.provider === "demo") {
        state.apiConfig.provider = "gemini";
      }

      const activePreset = PROVIDER_PRESETS[state.apiConfig.provider] || PROVIDER_PRESETS.gemini;

      state.apiConfig.apiKey = apiKeyVal;
      state.apiConfig.baseUrl = baseUrlVal || activePreset.baseUrl;
      state.apiConfig.model = modelVal || activePreset.model;
      state.apiConfig.temperature = isNaN(tempVal) ? 0.5 : tempVal;

      saveApiConfig(state.apiConfig);
      syncApiSettingsUI();
      showToast(`Đã lưu cấu hình API (${activePreset.name}) thành công!`, "success");
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
  initPersonalityUI();
});
}