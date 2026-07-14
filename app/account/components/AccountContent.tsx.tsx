"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useUser } from "@/hooks/useUser";

const AccountContent = () => {
  const router = useRouter();
  
  // Chỉ lấy isLoading và user để kiểm tra đăng nhập, bỏ qua subscription
  const { isLoading, user } = useUser();

  // Nếu đã load xong mà không có user (chưa đăng nhập) -> Đuổi về trang chủ
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, router, user]);

  return (
    <div className="mb-7 px-6">
      <div className="flex flex-col gap-y-4">
        <p className="text-neutral-400 text-lg">
          Tài khoản của bạn đang hoạt động bình thường. 
          <br/>
          (Tính năng gói đăng ký Premium hiện đang được tắt do không sử dụng Stripe).
        </p>
      </div>
    </div>
  );
};

export default AccountContent;