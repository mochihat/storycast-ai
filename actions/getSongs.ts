import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { Song } from "@/types";

const getSongs = async (): Promise<Song[]> => {
  // 1. Thêm await cookies() để lấy chính xác object chứa cookie
  const cookieStore = await cookies(); 
  
  // 2. Truyền dưới dạng function trả về cookieStore
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log(error.message);
  }

  return (data as any) || [];
};

export default getSongs;