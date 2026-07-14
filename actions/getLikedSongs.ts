import { Song } from "@/types";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// we wana fetch the liked songs from the currently logged in user
const getLikedSongs = async (): Promise<Song[]> => {
  // 1. Thêm dòng này để await cookies
  const cookieStore = await cookies();

  // 2. Sửa lại cách truyền cookies vào supabase
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data } = await supabase
    .from('liked_songs')
    .select('*, songs(*)') // the liked songs table has relation with songs, so we wanna fetch the entire song.
    .eq('user_id', session?.user?.id)
    .order('created_at', { ascending: false })

  if (!data) return [];

  return data.map((item) => ({
    ...item.songs //we re actually spreading the relation that populated with the one song that'll be loading
  })) as any; // Thêm 'as any' ở đây nếu TypeScript gạch đỏ cảnh báo kiểu dữ liệu
};

export default getLikedSongs;