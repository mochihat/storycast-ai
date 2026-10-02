# StoryCast AI

Biến truyện chữ trên mạng thành **truyện audio** đọc bằng giọng nữ AI tiếng Việt.

1. Dán link truyện (link chương 1, hoặc link trang giới thiệu truyện).
2. Chọn số chương muốn tạo.
3. StoryCast tự lấy chữ từng chương, đi theo nút “Chương sau”, rồi đọc bằng giọng **Hoài My** (Microsoft Edge TTS, miễn phí).
4. Nghe ngay trên web (tự nhớ chỗ đang nghe, chỉnh tốc độ 0.75x–2x, tự chuyển chương), tải từng chương `.mp3`,
   hoặc tải **cả quyển** thành một file `.m4b` có mục lục chương (mở được bằng các app nghe sách nói).

## Chạy trên máy

Cần **Node.js 22.13 trở lên** (dùng SQLite có sẵn trong Node) và **ffmpeg** (chỉ để ghép cả quyển).

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

Để chạy ổn định hơn (nhanh hơn, ít tốn RAM):

```bash
npm run build
npm start
```

## Dữ liệu lưu ở đâu

Mọi thứ nằm trong thư mục `data/` (không đưa lên git):

- `data/storycast.db`: danh sách truyện, chữ của từng chương
- `data/audio/<id truyện>/`: file mp3 của từng chương

Muốn sao lưu thì chép thư mục `data/`. Muốn xóa sạch thì xóa thư mục đó.

## Trang truyện hỗ trợ

Đã thử với **truyenfull**. Các trang khác dùng cách nhận diện chung (tìm khung nội dung chương và nút “Chương sau”),
nên phần lớn trang truyện chữ thông thường đều dùng được. Trang nào cần đăng nhập, hoặc tải chữ bằng JavaScript sau
khi mở trang, thì có thể không lấy được.

Hãy chỉ dùng cho việc nghe cá nhân và tôn trọng bản quyền của tác giả và trang truyện.

## Cấu trúc code

- `lib/scraper.ts`: tải trang, lấy chữ chương, tìm link chương sau, sửa chữ bị làm sai để chống sao chép
- `lib/tts.ts`: chia chữ thành đoạn rồi đọc bằng Edge TTS, ghép thành một file mp3
- `lib/worker.ts`: hàng đợi chạy nền, lần lượt lấy chữ và đọc từng chương
- `lib/book.ts`: ghép các chương thành file `.m4b` có mục lục (dùng ffmpeg)
- `lib/db.ts`: SQLite (`node:sqlite`)
- `app/api/*`: API cho giao diện
- `app/`, `components/`: giao diện (Next.js 16, Tailwind CSS 4)
