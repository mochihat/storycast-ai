import "./globals.css";
import { Be_Vietnam_Pro } from "next/font/google";

import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import ToasterProvider from "@/providers/ToasterProvider";

const font = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"] });

export const metadata = {
  title: "StoryCast",
  description: "Biến truyện chữ thành truyện audio với giọng đọc AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${font.className} h-full`}>
        <ToasterProvider />
        {/* pb leaves room for the fixed player bar */}
        <div className="h-full pb-[88px] md:pb-[76px]">
          <Sidebar>{children}</Sidebar>
        </div>
        <Player />
      </body>
    </html>
  );
}
