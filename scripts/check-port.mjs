// StoryCast always runs on port 3000. Two servers on one database would both run the background worker, so
// instead of letting Next.js drift to 3001 we stop here and say what is holding the port.
import net from "node:net";

const PORT = 3000;

const server = net.createServer();
server.once("error", (err) => {
  if (err.code !== "EADDRINUSE") throw err;
  console.error(`
  ✖ Cổng ${PORT} đang bị chiếm, có thể là một StoryCast khác vẫn đang chạy.

  Tắt nó đi rồi chạy lại:
    • Nếu nó đang chạy trong một cửa sổ Terminal khác: bấm Ctrl+C ở cửa sổ đó.
    • Nếu không tìm thấy: chạy  fuser -k ${PORT}/tcp   (Linux)  hoặc  lsof -ti :${PORT} | xargs kill   (macOS)
`);
  process.exit(1);
});
server.listen(PORT, () => server.close());
