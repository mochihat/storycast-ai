# 🎙️ StoryCast AI

<p align="center">
  <strong>Biến truyện chữ trên mạng thành Sách nói (Audiobook) chất lượng cao bằng giọng đọc AI tiếng Việt.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 🌟 Giới thiệu

**StoryCast AI** là giải pháp mã nguồn mở giúp tự động hóa quá trình chuyển đổi truyện chữ trực tuyến thành audiobook tiếng Việt. Ứng dụng tự động cào nội dung từng chương, làm sạch văn bản, chuyển thành giọng nói AI truyền cảm, tích hợp sẵn trình nghe nhạc trên nền web và cho phép xuất thành file sách nói chuẩn **.m4b** hoàn chỉnh.

Hoàn toàn **miễn phí**, không cần đăng ký tài khoản hay API Key của bên thứ ba!

---

## ✨ Tính năng nổi bật

- 🕷️ **Trích xuất thông minh (Smart Scraper):**
  - Chỉ cần dán link truyện (trang giới thiệu hoặc chương 1).
  - Tự động nhận diện nội dung chương bằng `@mozilla/readability` và `jsdom`.
  - Hỗ trợ cả website truyện chữ tiếng Việt (TruyenFull, Tangthuvien...) và tiếng Trung (69shu, Biquge...).
  - Tự động dò nút *"Chương sau"* (`下一章`), loại bỏ tạp âm, quảng cáo và ký tự chống copy.
- 🎙️ **Giọng đọc AI tự nhiên đa ngôn ngữ (Neural TTS):**
  - **Tự động nhận diện ngôn ngữ:** Tự động phát hiện tiếng Việt hoặc tiếng Trung dựa trên nội dung văn bản.
  - **Tiếng Việt:** Giọng đọc truyền cảm **Hoài My (`vi-VN-HoaiMyNeural`)**.
  - **Tiếng Trung:** Giọng đọc tiểu thuyết mượt mà **Xiaoxiao (`zh-CN-XiaoxiaoNeural`)**.
  - Hoàn toàn miễn phí, không giới hạn ký tự và không yêu cầu API Key.
  - Cơ chế chia đoạn thông minh (Paragraph/Sentence Chunking) hỗ trợ cả dấu ngắt câu Latin và CJK (`。！？；`).
- 🎧 **Trình nghe Web hiện đại (Built-in Web Player):**
  - Tự động nhớ chương và vị trí giây đang nghe.
  - Tự động chuyển tiếp chương tiếp theo khi nghe hết.
  - Tùy chỉnh tốc độ đọc linh hoạt (`0.75x` đến `2.0x`).
- 📦 **Xuất Audiobook hoàn chỉnh:**
  - Tải nhanh từng chương định dạng `.mp3`.
  - Đóng gói toàn bộ truyện thành **một file duy nhất `.m4b`** có mục lục chương (Chapters metadata), tương thích với Apple Books, Smart AudioBook Player, Voice,...
- ⚙️ **Hàng đợi chạy nền (Background Worker):**
  - Hàng đợi ngầm xử lý lần lượt từng chương, không gây đơ lag giao diện.
  - Quản lý trạng thái tiến trình thời gian thực.
- 🗄️ **Zero-Config Database:**
  - Sử dụng SQLite tích hợp sẵn trong Node.js (`node:sqlite`), không cần cài đặt thêm server cơ sở dữ liệu.

---

## 🛠️ Công nghệ sử dụng

| Lớp | Công nghệ / Thư viện |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| **Ngôn ngữ** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Giao diện** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI, React Icons |
| **Quản lý trạng thái** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Text-to-Speech** | [msedge-tts](https://github.com/schroffl/msedge-tts) |
| **Parser & Scraper** | `@mozilla/readability`, `jsdom` |
| **Cơ sở dữ liệu** | `node:sqlite` (Native SQLite trong Node.js) |
| **Xử lý Audio** | `ffmpeg` |

---

## 📋 Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính đã cài đặt:

1. **Node.js**: Phiên bản **`>= 22.13.0`** *(bắt buộc để sử dụng `node:sqlite`)*.
   ```bash
   node -v
   ```
2. **ffmpeg**: Cần thiết cho tính năng gộp file `.m4b`.
   - **Ubuntu/Debian:** `sudo apt install ffmpeg -y`
   - **macOS:** `brew install ffmpeg`
   - **Windows:** Cài đặt qua `winget install Gyan.FFmpeg` hoặc Chocolatey.

---

## 🚀 Cài đặt & Khởi chạy

### 1. Tải mã nguồn
```bash
git clone https://github.com/mochihat/storycast-ai.git
cd storycast-ai
```

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Chạy ở chế độ phát triển (Development)
```bash
npm run dev
```
Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)**

### 4. Build và chạy môi trường thực tế (Production - Khuyên dùng)
Để ứng dụng chạy mượt mà, tối ưu tài nguyên và ít tốn RAM:
```bash
npm run build
npm start
```

---

## 📖 Hướng dẫn sử dụng

1. **Thêm truyện:**
   - Dán URL chương 1 hoặc link trang chính của truyện (ví dụ: các nguồn truyện chữ phổ biến như `truyenfull`).
   - Nhập số lượng chương bạn muốn tạo audio.
2. **Theo dõi tiến độ:**
   - Worker chạy ngầm sẽ lần lượt cào chữ và chuyển đổi audio từng chương.
   - Trạng thái từng chương sẽ chuyển sang sẵn sàng ngay khi hoàn tất.
3. **Thưởng thức:**
   - Nghe trực tiếp trên thanh Player ở cuối trang.
   - Tải file `.mp3` từng chương hoặc bấm **Tải toàn bộ (.m4b)** để chuyển vào điện thoại nghe offline.

---

## 📂 Cấu trúc dự án

```text
storycast-ai/
├── app/                  # Next.js App Router (UI & API endpoints)
│   ├── api/              # API routes xử lý truyện, audio, tải file
│   └── page.tsx          # Trang dashboard chính
├── components/           # Các UI component (Player, BookCard, ChapterList...)
├── data/                 # Thư mục lưu trữ cục bộ (được gitignore)
│   ├── storycast.db      # Cơ sở dữ liệu SQLite
│   └── audio/            # File mp3 đã tạo theo từng ID truyện
├── lib/                  # Logic lõi của hệ thống
│   ├── book.ts           # Đóng gói và gắn metadata cho file m4b bằng ffmpeg
│   ├── db.ts             # Kết nối và thao tác với node:sqlite
│   ├── scraper.ts        # Trích xuất nội dung chương và xử lý chống copy
│   ├── tts.ts            # Kết nối Edge TTS và cắt văn bản thành chunks
│   └── worker.ts         # Hàng đợi (queue) xử lý ngầm
├── types.ts              # Định nghĩa TypeScript Types
└── public/               # Static assets
```

---

## 💾 Dữ liệu & Sao lưu

Mọi dữ liệu phát sinh trong quá trình sử dụng đều nằm gọn trong thư mục `data/`:
- `data/storycast.db`: Danh sách truyện, thông tin chương và nội dung text.
- `data/audio/<id_truyen>/`: Chứa các file audio `.mp3` từng chương.

> 💡 **Mẹo:**
> - Để **sao lưu:** Chỉ cần copy thư mục `data/`.
> - Để **reset sạch sẽ:** Dừng server và xóa thư mục `data/`.

---

## 🌐 Các trang truyện hỗ trợ

- Đã kiểm thử tối ưu: **TruyenFull**.
- Các trang truyện khác: StoryCast sử dụng thuật toán nhận diện nội dung thông minh (`Readability`) và tự tìm kiếm các liên kết *"Chương sau / Tiếp theo"*, do đó hầu hết các website truyện chữ cấu trúc HTML tiêu chuẩn đều hoạt động tốt.
- *Lưu ý:* Những trang yêu cầu đăng nhập tài khoản hoặc tải nội dung chậm bằng Client-side JavaScript phức tạp có thể sẽ không trích xuất được.

---

## ⚖️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)

- Dự án này được phát triển cho mục đích **học tập, nghiên cứu và phục vụ nhu cầu nghe cá nhân**.
- Vui lòng tôn trọng quyền tác giả, dịch giả và bản quyền của các website phát hành truyện.
- Giọng đọc sử dụng dịch vụ công cộng Microsoft Edge TTS; vui lòng tuân thủ các điều khoản dịch vụ của Microsoft.

---

## 📄 Giấy phép (License)

Dự án được phân phối dưới giấy phép **[MIT License](LICENSE)**.
