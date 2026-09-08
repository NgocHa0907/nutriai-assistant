# NutriAI - Trợ Lý AI Đếm Calo & Theo Dõi Sức Khỏe Thông Minh (Google Gemini) 🥗📊

Ứng dụng web toàn diện tích hợp Trợ lý AI kết nối trực tiếp đến **Google Gemini API** (`gemini-flash-latest`) theo chuẩn của Google, tự động phân tích món ăn, đếm calo nạp vào, tính toán chỉ số BMR/TDEE/BMI và theo dõi năng lượng tiêu hao hàng ngày.

---

## ⚡ Kết Nối Chuẩn Google Generative Language API

Hệ thống kết nối trực tiếp theo định dạng curl của Google Gemini:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent" \
  -H 'Content-Type: application/json' \
  -H 'X-goog-api-key: YOUR_API_KEY' \
  -X POST \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "bữa sáng tôi ăn 2 quả trứng 1 cái ngô" }]
      }
    ]
  }'
```

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`
- **Header xác thực**: `X-goog-api-key: <KEY>`
- **Cấu trúc dữ liệu**: `contents[].parts[].text`
- **Mô hình khuyến nghị**: `gemini-flash-latest`, `gemini-1.5-flash`, `gemini-2.0-flash`
- **Hỗ trợ thêm**: OpenAI (`gpt-4o-mini`), Groq (`llama-3.3-70b-versatile`), OpenRouter và Chế độ Demo offline.

---

## 🌟 Tính Năng Chính

### 1. 💬 Trang Trợ Lý Chat AI
- **Tự động tính calo & ghi nhật ký**: Khi bạn nhắn: *"bữa sáng tôi ăn 2 quả trứng 1 cái ngô"*, trợ lý Gemini sẽ:
  - Phân tích chi tiết từng món: Trứng gà 2 quả (140 kcal), Bắp ngô 1 cái (120 kcal).
  - Tính tổng năng lượng nạp vào: **260 kcal**.
  - Đính kèm thẻ món ăn trực quan ngay trong tin nhắn chat.
  - **Tự động ghi nhận ngay vào mục Bữa Sáng trên Trang Theo Dõi Sức Khỏe**.
- **Tùy biến tính cách AI (AI Persona)**: Dễ dàng lựa chọn giữa 6 phong cách trò chuyện độc đáo (😊 Vui vẻ, 😤 Giận dữ / "Chửi yêu", 🥺 Buồn bã / U sầu, 🫡 Kỷ luật thép, 🌸 Dịu dàng, 🤣 Hài hước), đổi tính cách tức thì ngay trên thanh Chat hoặc trang Cài Đặt.
- **Gợi ý nhanh 1 chạm**: Các bữa ăn phổ biến (Phở bò, Bún bò Huế, Trà sữa, Ức gà...).
- **Xem & Tùy biến Prompt**: Cho phép xem và chỉnh sửa System Prompt chỉ dẫn AI.

### 2. 📊 Trang Theo Dõi Sức Khỏe
- **Tính BMR & TDEE (Mifflin-St Jeor)**:
  - Nhập Cân nặng (kg), Chiều cao (cm), Tuổi, Giới tính, Mức độ vận động.
  - Tự động tính chỉ số calo tiêu thụ cơ bản (**BMR**) và calo duy trì (**TDEE**).
  - Đo chỉ số **BMI** kèm vạch màu trực quan (Gầy, Chuẩn, Thừa cân, Béo phì).
- **Cân Bằng Năng Lượng (Calorie Balance)**:
  - `Hiệu số = Calo nạp vào - (BMR + Calo vận động)`.
  - Báo động trạng thái: **Thâm hụt calo** (đang giảm mỡ) hoặc **Thặng dư calo**.
- **Calo Tiêu Hao Vận Động**:
  - Gợi ý nhanh: Đi bộ, Chạy bộ, Gym, Đạp xe, Bơi lội, Dọn nhà...
  - Cho phép nhập bài tập tùy chỉnh.
- **Calo Nạp Vào (Bữa Ăn)**:
  - 4 bữa: Sáng, Trưa, Tối, Phụ.
  - Đồng bộ tự động từ Chat AI kèm nhãn `✨ AI ghi nhận`.
- **Biểu Đồ 7 Ngày Gần Nhất**:
  - Theo dõi calo nạp vào vs tiêu hao qua từng ngày.

### 3. ⚙️ Trang Thêm & Cài Đặt API
- Google Gemini được thiết lập làm nhà cung cấp mặc định với mô hình `gemini-flash-latest`.
- Nút **"Kiểm tra kết nối"** (Test Connection) đo thời gian phản hồi (latency).
- API Key được lưu trực tiếp và an toàn trong trình duyệt (`localStorage`).

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Chạy Server (Khuyên dùng)
```bash
node server.js
```
Mở trình duyệt truy cập: **`http://localhost:3000`**

### Cách 2: Mở trực tiếp file
Nhấp đúp chuột vào tệp **`index.html`** để mở ngay trên trình duyệt mà không cần cài đặt phần mềm nào.