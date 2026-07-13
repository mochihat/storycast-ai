"use client";

import { TbPlaylist } from "react-icons/tb"; // Sửa lại chữ P viết hoa
import { AiOutlinePlus } from "react-icons/ai";

const Library = () => {
    const onClick = () => {
        // Handle click event here
    };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
            <div className="inline-flex items-center gap-x-2">
                {/* Thêm size cho icon để nó hiển thị rõ ràng */}
                <TbPlaylist className="text-neutral-400" size={26} />
                <p className="text-neutral-400 font-medium text-md">
                    Library
                </p>
            </div>
            <AiOutlinePlus
                onClick={onClick}
                className="text-neutral-400 hover:text-white cursor-pointer transition"
                size={20}
            />
      </div>
      <div
        className="
            flex 
            flex-col
            gap-y-2
            mt-4
            px-3
        "
      >
        List of Stories
      </div>
    </div>
  );
}

export default Library;