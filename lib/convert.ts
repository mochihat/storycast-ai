import "server-only";

import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./db";

// QuickTranslator-style "convert": longest-match lookup in the community VietPhrase dictionaries, with names in
// Hán Việt. Works offline once the dictionaries are downloaded (about 60 MB, on first use, into data/dict).

// Pinned to one commit each so a dictionary update can't change results under us.
const VIETPHRASE_BASE =
  "https://raw.githubusercontent.com/ducbui0/tong-hop-tu-dien/55229f723da73a187322f9bf45da443fceca25dc/tu_dien";
const DICT_URLS = {
  names: `${VIETPHRASE_BASE}/2_name/Name.txt`,
  pronouns: `${VIETPHRASE_BASE}/4_pronouns/Pronouns.txt`,
  vietphrase: `${VIETPHRASE_BASE}/1_vp/VietPhrase.txt`,
  phienAm: `${VIETPHRASE_BASE}/3_phienam/ChinesePhienAmWords.txt`,
  // VietPhrase is written in simplified Chinese, so traditional text (common on PO18) is simplified first.
  simplified:
    "https://raw.githubusercontent.com/BYVoid/OpenCC/bcf847cf3fbd79c74779567f9a491ea8ab878183/data/dictionary/TSCharacters.txt",
};
const DICT_DIR = path.join(DATA_DIR, "dict");

// Longer keys exist, but almost none are useful and every extra length slows the lookup down.
const MAX_KEY = 12;

interface Dictionaries {
  names: Map<string, string>;
  // Pronouns.txt and VietPhrase.txt merged, pronouns first.
  phrases: Map<string, string>;
  phienAm: Map<string, string>;
  // Traditional → simplified, one character at a time.
  simplified: Map<string, string>;
}

const g = globalThis as unknown as { storycastDicts?: Promise<Dictionaries> };

async function dictFile(name: keyof typeof DICT_URLS): Promise<string> {
  const file = path.join(DICT_DIR, path.basename(new URL(DICT_URLS[name]).pathname));
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DICT_DIR, { recursive: true });
    const res = await fetch(DICT_URLS[name], { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`Không tải được từ điển ${name} (lỗi ${res.status})`);
    // Write to a temp file first so an interrupted download is not mistaken for a complete one.
    fs.writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
    fs.renameSync(`${file}.part`, file);
  }
  return fs.readFileSync(file, "utf8");
}

// Lines look like "夕阳=trời chiều/mặt trời chiều/ánh tà"; the first meaning is the preferred one.
function parse(text: string, into = new Map<string, string>()) {
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    // Keys starting with whitespace or control characters are leftovers from broken merges.
    if (eq <= 0 || eq > MAX_KEY * 2 || /^[\s\x00-\x1f]/.test(line)) continue;
    const key = line.slice(0, eq);
    if (key.length > MAX_KEY || into.has(key)) continue;
    into.set(key, line.slice(eq + 1).split(/[/|]/)[0].trim());
  }
  return into;
}

// OpenCC lines look like "從\t从 從"; the first value is the usual simplified form.
function parseOpenCC(text: string) {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (line.startsWith("#")) continue;
    const [from, to] = line.split("\t");
    if (from && to) map.set(from, to.split(" ")[0]);
  }
  return map;
}

async function loadDictionaries(): Promise<Dictionaries> {
  const [names, pronouns, vietphrase, phienAm, simplified] = await Promise.all([
    dictFile("names"),
    dictFile("pronouns"),
    dictFile("vietphrase"),
    dictFile("phienAm"),
    dictFile("simplified"),
  ]);
  return {
    names: parse(names),
    phrases: parse(vietphrase, parse(pronouns)),
    phienAm: parse(phienAm),
    simplified: parseOpenCC(simplified),
  };
}

function dictionaries(): Promise<Dictionaries> {
  g.storycastDicts ??= loadDictionaries().catch((err) => {
    g.storycastDicts = undefined; // let the next chapter try the download again
    throw err;
  });
  return g.storycastDicts;
}

const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// ---------- names that are not in Name.txt ----------

const SURNAMES = new Set([
  ..."王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤常温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳翟殷詹申欧耿关兰焦俞左柳甘祝包宁尚符舒阮柯纪梅童凌毕单季裴霍涂成苗谷盛曲翁冉骆蓝路游辛靳管柴蒙鲍华喻祁蒲房滕屈饶解牟艾尤阳时穆农司卓古吉缪简车项连芦麦褚娄窦戚岑景党宫费卜冷晏席卫米柏宗瞿桂全佟应臧闵苟邬边卞姬师和仇栾隋商刁沙荣巫寇桑郎甄丛仲虞敖巩明佘池查麻苑迟邝封"
    .split(""),
  ..."張劉陳楊黃趙吳郭羅鄭謝韓馮鄧蕭葉蘇呂盧鍾譚陸賈韋鄒孫許潘蔣顧龔錢溫顏聶魯詹歐關蘭紀單塗駱藍靳鮑饒繆婁竇岑黨衛閔欒隋鄺".split(""),
]);
const COMPOUND_SURNAMES = [
  "欧阳", "司马", "上官", "诸葛", "东方", "慕容", "令狐", "皇甫", "南宫", "宇文", "长孙", "公孙", "独孤", "夏侯",
  "轩辕", "端木", "西门", "百里", "歐陽", "司馬", "諸葛", "東方", "長孫", "獨孤", "軒轅", "西門",
];
// Characters that follow a surname in ordinary sentences far more often than inside a given name.
const NOT_IN_NAMES = new Set(
  "的了是在不也和就都把被对让给向着过很没要会能看想道问说笑点头手里上下中来去这那他她它们我你有个一二三四五六七八九十从到为与及或而但却又再还已之其此些么吗呢吧啊呀哦嗯么家人们子先生小姐总老师哥姐弟妹叔姨爷奶爸妈夫妻".split(
    ""
  )
);

function startsWithSurname(word: string): boolean {
  return SURNAMES.has(word[0]) || COMPOUND_SURNAMES.some((surname) => word.startsWith(surname));
}

function hanViet(word: string, dict: Dictionaries): string {
  return [...word]
    .map((ch) => dict.phienAm.get(ch) || dict.phrases.get(ch) || ch)
    .map((syllable) => syllable.charAt(0).toUpperCase() + syllable.slice(1))
    .join(" ");
}

// Finds "surname + 1–2 characters" that repeat through the chapter and are not dictionary words: those are
// almost always character names, which should read as Hán Việt ("Lâm Thiển"), not be translated word by word.
function detectNames(text: string, dict: Dictionaries): Map<string, string> {
  const counts = new Map<string, number>();
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const two = chars[i] + (chars[i + 1] ?? "");
    const surnameLength = COMPOUND_SURNAMES.includes(two) ? 2 : SURNAMES.has(chars[i]) ? 1 : 0;
    if (!surnameLength) continue;
    for (const given of [1, 2]) {
      const parts = chars.slice(i, i + surnameLength + given);
      if (parts.length < surnameLength + given) break;
      const rest = parts.slice(surnameLength);
      if (!rest.every((ch) => CJK.test(ch) && !NOT_IN_NAMES.has(ch))) break;
      const word = parts.join("");
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const found = new Map<string, string>();
  for (const [word, n] of counts) {
    if (n < 3 || dict.names.has(word) || dict.phrases.has(word)) continue;
    // "白色衬" is the word "白色" (white) plus one more character, not a person called Bạch Sắc Sấn.
    if (word.length > 2 && dict.phrases.has(word.slice(0, -1))) continue;
    // "林浅" and "林浅说" both repeat; keep the longer one only when it is (nearly) always the full form.
    const longer = [...counts].find(([w, m]) => w.length === word.length + 1 && w.startsWith(word) && m >= n * 0.8);
    if (longer && !dict.phrases.has(longer[0])) continue;
    found.set(word, hanViet(word, dict));
  }
  return found;
}

// ---------- conversion ----------

// Chinese punctuation → Vietnamese, and how it attaches to its neighbours.
const PUNCT: Record<string, { text: string; type: "open" | "close" | "word" }> = {
  "，": { text: ",", type: "close" },
  "。": { text: ".", type: "close" },
  "！": { text: "!", type: "close" },
  "？": { text: "?", type: "close" },
  "：": { text: ":", type: "close" },
  "；": { text: ";", type: "close" },
  "、": { text: ",", type: "close" },
  "）": { text: ")", type: "close" },
  "」": { text: "\"", type: "close" },
  "』": { text: "\"", type: "close" },
  "”": { text: "\"", type: "close" },
  "’": { text: "'", type: "close" },
  "》": { text: "\"", type: "close" },
  "】": { text: "]", type: "close" },
  "…": { text: "...", type: "close" },
  "（": { text: "(", type: "open" },
  "「": { text: "\"", type: "open" },
  "『": { text: "\"", type: "open" },
  "“": { text: "\"", type: "open" },
  "‘": { text: "'", type: "open" },
  "《": { text: "\"", type: "open" },
  "【": { text: "[", type: "open" },
  "—": { text: "—", type: "word" },
  "～": { text: "~", type: "close" },
  "·": { text: "", type: "word" },
  "・": { text: "", type: "word" },
};

function convertLine(line: string, dict: Dictionaries, found: Map<string, string>): string {
  const chars = [...line];
  let out = "";
  let prev: "open" | "close" | "word" | null = null;
  const emit = (text: string, type: "open" | "close" | "word") => {
    // Dictionary entries sometimes carry their own punctuation ("第1章" → "Chương 1:") before "：".
    if (!text || (type === "close" && out.endsWith(text))) return;
    const glue = !out || out.endsWith(" ") || prev === "open" || type === "close";
    out += (glue ? "" : " ") + text;
    prev = type;
  };

  for (let i = 0; i < chars.length; ) {
    const ch = chars[i];
    if (PUNCT[ch]) {
      // "……" and "——" collapse into one mark.
      while (chars[i] === ch && (ch === "…" || ch === "—")) i++;
      if (chars[i] === ch) i++;
      emit(PUNCT[ch].text, PUNCT[ch].type);
      continue;
    }
    if (!CJK.test(ch)) {
      let j = i;
      while (j < chars.length && !CJK.test(chars[j]) && !PUNCT[chars[j]]) j++;
      const raw = chars.slice(i, j).join("").replace(/\s+/g, " ");
      if (raw.trim()) emit(raw.trim(), "word");
      else if (raw && out && prev !== "open") out += " ";
      i = j;
      continue;
    }
    // Longest match wins; on equal length a name beats an ordinary phrase.
    let matched = false;
    for (let len = Math.min(MAX_KEY, chars.length - i); len >= 1; len--) {
      const key = chars.slice(i, i + len).join("");
      const phrase = dict.phrases.get(key);
      let name = found.get(key) ?? dict.names.get(key);
      // Name.txt also lists plenty of ordinary words ("深蓝" → "Thâm Lam"). When VietPhrase knows the word
      // too, only treat it as a name if it starts with a surname ("江涛" → "Giang Đào").
      if (name !== undefined && phrase !== undefined && !found.has(key) && !startsWithSurname(key)) name = undefined;
      const meaning = name ?? phrase;
      if (meaning === undefined) continue;
      emit(meaning, "word");
      i += len;
      matched = true;
      break;
    }
    if (!matched) {
      emit(dict.phienAm.get(ch) ?? ch, "word");
      i++;
    }
  }
  // Sentence case: capitalise the start of the line and every sentence.
  return out
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/(^["'([]?|[.!?]\s+["'([]?)(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

export async function convertToVietnamese(text: string): Promise<string> {
  const dict = await dictionaries();
  const simplified = [...text].map((ch) => dict.simplified.get(ch) ?? ch).join("");
  const found = detectNames(simplified, dict);
  return simplified
    .split("\n")
    .map((line) => convertLine(line, dict, found))
    .filter(Boolean)
    .join("\n");
}

// Converts many short snippets at once (the text pieces of a web page). Names are detected across all of them
// together, so a name that repeats over the page is recognised even if each snippet mentions it once.
export async function convertSnippets(snippets: string[]): Promise<string[]> {
  const dict = await dictionaries();
  const simplified = snippets.map((text) => [...text].map((ch) => dict.simplified.get(ch) ?? ch).join(""));
  const found = detectNames(simplified.join("\n"), dict);
  return simplified.map((text) =>
    text
      .split("\n")
      .map((line) => convertLine(line, dict, found))
      .join("\n")
  );
}
