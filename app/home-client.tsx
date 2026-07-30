"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "./lib/supabase";

export type Category =
  | "latest"
  | "popular"
  | "bedding"
  | "korea"
  | "japan"
  | "other";

type KoreaType =
  | "plush"
  | "pajamas"
  | "fashion"
  | "snacks"
  | "beauty"
  | "dutyFree"
  | "socks";

type Product = {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  code: string;
  deadline: string;
  arrival: string;
  colors?: string;
  sizes?: string;
  status: "現貨" | "預購" | "連線中" | "已收單";
  country: "KOREA" | "JAPAN" | "SELECT";
  image: string;
  images?: string[];
  categories: Category[];
  beddingType?: "cool" | "allSeason" | "pillow";
  koreaType?: KoreaType;
  details: string;
  specs: string;
};

type StoredProduct = {
  id: string;
  name: string;
  price: string;
  original_price: string | null;
  code: string;
  deadline: string | null;
  arrival: string | null;
  colors: string | null;
  sizes: string | null;
  status: string;
  country: string;
  image_urls: string[] | null;
  categories: string[] | null;
  bedding_type: string | null;
  korea_type: string | null;
  details: string | null;
  specs: string | null;
};

export const lineCommunityUrl =
  "https://line.me/ti/g2/lUAnqWttOWPLdDN3QfAQj679jtjV_pLZY2FQyw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default";
export const lineOfficialUrl = "https://lin.ee/PtrITqc";
const instagramUrl = "https://www.instagram.com/wobuy174_/";
const mapUrl =
  "https://www.google.com/maps/search/?api=1&query=%E5%98%89%E7%BE%A9%E7%B8%A3%E6%9C%B4%E5%AD%90%E5%B8%82%E9%96%8B%E5%85%83%E8%B7%AF174%E8%99%9F";
export const roundedFontFamily =
  'ui-rounded, "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "PingFang TC", "Microsoft JhengHei", sans-serif';

const desktopPageSizeQuery = "(min-width: 1024px)";

function subscribeToPageSizeChange(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(desktopPageSizeQuery);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getPageSizeSnapshot() {
  return window.matchMedia(desktopPageSizeQuery).matches ? 18 : 15;
}

const categories: { id: Category; label: string }[] = [
  { id: "latest", label: "所有商品" },
  { id: "popular", label: "熱門商品" },
  { id: "bedding", label: "韓國棉被" },
  { id: "korea", label: "韓國選品" },
  { id: "japan", label: "日本選品" },
  { id: "other", label: "其他選品" },
];

export const products: Product[] = [
  {
    id: "cool-cloud",
    name: "韓國冰感雲朵涼被",
    price: "NT$ 1,280",
    code: "KB-174",
    deadline: "07/20",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "bedding"],
    beddingType: "cool",
    details: "親膚涼感布料搭配輕盈蓬鬆的觸感，夏天也能舒服入睡。",
    specs: "尺寸與花色請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "bear-quilt",
    name: "韓國小熊刺繡四季被",
    price: "NT$ 1,680",
    code: "KB-092",
    deadline: "07/20",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "bedding"],
    beddingType: "allSeason",
    details: "一件能陪你度過四季的柔軟寢具，簡約小熊刺繡增添療癒感。",
    specs: "尺寸與花色請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "sleep-pillow",
    name: "抗蟎秒睡枕",
    price: "NT$ 890",
    code: "KB-301",
    deadline: "07/20",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "bedding"],
    beddingType: "pillow",
    details: "為日常睡眠準備的一顆蓬鬆好枕頭，舒適支撐、簡單好搭。",
    specs: "實際庫存請先透過 LINE@ 官方帳號確認。",
  },
  {
    id: "heart-pouch",
    name: "韓國愛心收納化妝包",
    price: "NT$ 420",
    code: "KR-108",
    deadline: "07/18",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "korea"],
    koreaType: "fashion",
    details: "剛剛好的隨身尺寸，收納彩妝、充電線或小物都很適合。",
    specs: "顏色選擇及尺寸請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "mug-set",
    name: "日系奶油色隨行杯",
    price: "NT$ 590",
    code: "JP-042",
    deadline: "07/18",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "JAPAN",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "japan"],
    details: "乾淨柔和的奶油色調，為每天的咖啡與喝水時光加一點儀式感。",
    specs: "容量與顏色請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "soft-keyring",
    name: "韓國毛絨小熊吊飾",
    price: "NT$ 350",
    code: "KR-221",
    deadline: "07/18",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "korea"],
    koreaType: "plush",
    details: "小小一個卻很有存在感，掛在包包或鑰匙上都很可愛。",
    specs: "實際庫存與款式請先透過 LINE@ 官方帳號確認。",
  },
  {
    id: "stationery-kit",
    name: "日系日常書寫組",
    price: "NT$ 480",
    code: "JP-119",
    deadline: "07/21",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "JAPAN",
    image:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "japan"],
    details: "把寫字這件小事，變成每天都期待打開的一段安靜時光。",
    specs: "內容物與款式請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "fabric-basket",
    name: "手工感布面收納籃",
    price: "NT$ 750",
    code: "SE-017",
    deadline: "07/22",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "SELECT",
    image:
      "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "other"],
    details: "把桌面與生活整理得更剛好，簡單擺著也很好看。",
    specs: "尺寸與材質請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "mini-lamp",
    name: "暖光蘑菇小夜燈",
    price: "NT$ 680",
    code: "SE-031",
    deadline: "07/22",
    arrival: "依商品頁或客服通知",
    status: "已收單",
    country: "SELECT",
    image:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85",
    categories: ["popular", "other"],
    details: "留一盞溫柔的光給夜晚，讓房間多一點安心和氛圍。",
    specs: "本檔商品已收單，可私訊詢問下一檔或後續到貨資訊。",
  },
  {
    id: "room-slippers",
    name: "韓國字母絨感室內拖",
    price: "NT$ 390",
    code: "KR-246",
    deadline: "07/23",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1562183241-b937e95585b6?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "korea"],
    koreaType: "fashion",
    details: "柔軟輕盈的日常室內拖，簡單一穿就能讓居家時光更舒服。",
    specs: "尺寸與顏色請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "check-mirror",
    name: "韓國格紋隨身化妝鏡",
    price: "NT$ 290",
    code: "KR-265",
    deadline: "07/23",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "korea"],
    koreaType: "beauty",
    details: "小巧好收納的隨身鏡，補妝或放進包包裡都剛剛好。",
    specs: "款式與實際庫存請先透過 LINE@ 官方帳號確認。",
  },
  {
    id: "plate-set",
    name: "日本霧面點心小盤組",
    price: "NT$ 520",
    code: "JP-138",
    deadline: "07/24",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "JAPAN",
    image:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "japan"],
    details: "為水果、甜點和日常小食準備的一點細緻，隨手擺盤也很好看。",
    specs: "內容物與款式請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "folding-bag",
    name: "韓國輕量折疊購物袋",
    price: "NT$ 360",
    code: "KR-279",
    deadline: "07/24",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "korea"],
    koreaType: "fashion",
    details: "輕輕折起來放進包包，臨時購物或帶便當都派得上用場。",
    specs: "實際庫存與花色請先透過 LINE@ 官方帳號確認。",
  },
  {
    id: "fragrance-capsule",
    name: "韓國香氛洗衣膠囊",
    price: "NT$ 450",
    code: "KR-314",
    deadline: "07/25",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "korea"],
    koreaType: "beauty",
    details: "替每天的衣物留下一點舒服乾淨的香氣，洗衣時光也變得療癒。",
    specs: "香味與內容量請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "ribbon-socks",
    name: "韓國蝴蝶結棉襪組",
    price: "NT$ 330",
    code: "KR-330",
    deadline: "07/25",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "popular", "korea"],
    koreaType: "socks",
    details: "低調的蝴蝶結細節，替日常穿搭多放一點剛好的可愛。",
    specs: "尺寸與顏色請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "clear-box",
    name: "日本透明桌面收納盒",
    price: "NT$ 560",
    code: "JP-152",
    deadline: "07/26",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "JAPAN",
    image:
      "https://images.unsplash.com/photo-1593240105674-e9f5b3ce1a5d?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "japan"],
    details: "把桌面小物好好收起來，讓每天使用的空間更清爽。",
    specs: "尺寸與內容物請以商品照片及 LINE@ 客服確認為準。",
  },
  {
    id: "animal-coaster",
    name: "療癒動物刺繡杯墊",
    price: "NT$ 260",
    code: "SE-048",
    deadline: "07/26",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "SELECT",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
    categories: ["latest", "other"],
    details: "一杯咖啡、一個杯墊，就能讓桌上的小角落多一點好心情。",
    specs: "實際庫存與款式請先透過 LINE@ 官方帳號確認。",
  },
  {
    id: "bunny-plush",
    name: "正版兔兔絨毛玩偶",
    price: "NT$ 620",
    code: "KR-348",
    deadline: "07/27",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1560961911-ba7ef651a56c?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "plush",
    details: "圓滾滾的療癒小夥伴，適合放在床邊、書桌或當作送禮小心意。",
    specs: "正版款式與實際到貨批次，請以 LINE@ 客服確認為準。",
  },
  {
    id: "cotton-pajamas",
    name: "正韓純棉條紋睡衣組",
    price: "NT$ 1,080",
    code: "KR-352",
    deadline: "07/27",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "pajamas",
    details: "柔軟純棉搭配寬鬆剪裁，為放鬆的居家時光準備一套舒服選擇。",
    specs: "尺寸、顏色與庫存請截圖後向 LINE@ 確認。",
  },
  {
    id: "logo-cap",
    name: "韓國刺繡字母棒球帽",
    price: "NT$ 690",
    code: "KR-357",
    deadline: "07/28",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "fashion",
    details: "簡約刺繡字母點綴，日常休閒穿搭隨手一戴就很有型。",
    specs: "可選顏色與帽圍請以商品照片及客服回覆為準。",
  },
  {
    id: "butter-cookies",
    name: "韓國奶油夾心餅乾禮盒",
    price: "NT$ 260",
    code: "KR-361",
    deadline: "07/28",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "snacks",
    details: "酥香餅乾配上濃郁夾心，下午茶或送朋友都很剛好。",
    specs: "食品效期與實際口味請以 LINE@ 客服確認內容為準。",
  },
  {
    id: "soothing-mask",
    name: "韓國積雪草舒緩面膜組",
    price: "NT$ 390",
    code: "KR-366",
    deadline: "07/29",
    arrival: "依商品頁或客服通知",
    status: "連線中",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "beauty",
    details: "為忙碌肌膚準備的舒緩保養時光，清爽服貼、日常好使用。",
    specs: "成分與效期資訊請以實際到貨商品標示為準。",
  },
  {
    id: "duty-free-set",
    name: "韓國免稅精選保養組",
    price: "NT$ 1,280",
    code: "KR-372",
    deadline: "07/29",
    arrival: "依商品頁或客服通知",
    status: "預購",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "dutyFree",
    details: "人氣保養一次收齊，適合為自己補貨或準備貼心禮物。",
    specs: "內容組合與可供應狀況，請以客服確認為準。",
  },
  {
    id: "daily-socks",
    name: "正韓純棉素色短襪組",
    price: "NT$ 320",
    code: "KR-379",
    deadline: "07/30",
    arrival: "依商品頁或客服通知",
    status: "現貨",
    country: "KOREA",
    image:
      "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=900&q=85",
    categories: ["korea"],
    koreaType: "socks",
    details: "舒適純棉與百搭配色，日常上班、上課或休閒穿搭都適合。",
    specs: "顏色、尺寸與現貨數量請以 LINE@ 回覆為準。",
  },
];

const statusStyles = {
  現貨: "bg-[#7D2F35] text-[#F5F5F5]",
  預購: "bg-[#EEECE9] text-[#605B51]",
  連線中: "bg-[#E4E0DA] text-[#605B51]",
  已收單: "bg-[#D9D6D0] text-[#605B51]",
};

const categoryTitles: Record<Category, string> = {
  latest: "所有商品",
  popular: "熱門商品",
  bedding: "韓國棉被",
  korea: "韓國選品",
  japan: "日本選品",
  other: "其他選品",
};

const koreaTypes: { id: KoreaType; label: string }[] = [
  { id: "plush", label: "正版玩偶" },
  { id: "pajamas", label: "正韓睡衣" },
  { id: "fashion", label: "時尚潮牌" },
  { id: "snacks", label: "零食糖果" },
  { id: "beauty", label: "藥局美妝" },
  { id: "dutyFree", label: "免稅精選" },
  { id: "socks", label: "純棉襪子" },
];

function storedProductToProduct(product: StoredProduct): Product {
  const status = ["現貨", "預購", "連線中", "已收單"].includes(product.status)
    ? (product.status as Product["status"])
    : "預購";
  const country = ["KOREA", "JAPAN", "SELECT"].includes(product.country)
    ? (product.country as Product["country"])
    : "SELECT";
  const categoriesFromDatabase = (product.categories ?? []).filter((category) =>
    ["popular", "bedding", "korea", "japan", "other"].includes(category),
  ) as Category[];

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    originalPrice: product.original_price ?? undefined,
    code: product.code,
    deadline: product.deadline ?? "請洽 LINE@",
    arrival: product.arrival ?? "依商品頁或客服通知",
    colors: product.colors ?? "請洽 LINE@",
    sizes: product.sizes ?? "請洽 LINE@",
    status,
    country,
    image: product.image_urls?.[0] ?? "",
    images: product.image_urls?.filter(Boolean).slice(0, 3) ?? [],
    categories: categoriesFromDatabase,
    beddingType: ["cool", "allSeason", "pillow"].includes(product.bedding_type ?? "")
      ? (product.bedding_type as Product["beddingType"])
      : undefined,
    koreaType: koreaTypes.some((type) => type.id === product.korea_type)
      ? (product.korea_type as KoreaType)
      : undefined,
    details: product.details ?? "商品介紹請洽 LINE@ 官方帳號確認。",
    specs: product.specs ?? "尺寸、花色與供貨狀況請以客服確認為準。",
  };
}

function formatPrice(price: string) {
  return price.replace(/^NT\$\s*/i, "").trim();
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      style={{ width: "1rem", height: "1rem", flex: "0 0 auto" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" style={{ width: "1.25rem", height: "1.25rem", flex: "0 0 auto" }} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export function ProductCatalog({
  initialCategory = "latest",
  showAllCategory = true,
}: {
  initialCategory?: Category;
  showAllCategory?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>(initialCategory);
  const [activeBeddingType, setActiveBeddingType] = useState<
    "all" | "cool" | "allSeason" | "pillow"
  >("all");
  const [activeKoreaType, setActiveKoreaType] = useState<"all" | KoreaType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const [remoteCatalogLoaded, setRemoteCatalogLoaded] = useState(false);
  const pageSize = useSyncExternalStore(
    subscribeToPageSizeChange,
    getPageSizeSnapshot,
    () => 15,
  );
  const galleryRef = useRef<HTMLDivElement>(null);
  const visibleCategories = showAllCategory
    ? categories
    : categories.filter((category) => category.id !== "latest");

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase
      .from("products")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setCatalogProducts((data as StoredProduct[]).map(storedProductToProduct));
          setRemoteCatalogLoaded(true);
        }
      });
  }, []);

  const filteredProducts = catalogProducts.filter((product) => {
    const matchesCategory =
      activeCategory === "latest" || product.categories.includes(activeCategory);
    const matchesBedding =
      activeCategory !== "bedding" ||
      activeBeddingType === "all" ||
      product.beddingType === activeBeddingType;
    const matchesKorea =
      activeCategory !== "korea" ||
      activeKoreaType === "all" ||
      product.koreaType === activeKoreaType;

    return matchesCategory && matchesBedding && matchesKorea;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const visibleProducts = filteredProducts.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const galleryImages = selectedProduct
    ? (selectedProduct.images?.length ? selectedProduct.images : [selectedProduct.image]).slice(0, 3)
    : [];

  const scrollToProducts = () => {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectCategory = (category: Category) => {
    setActiveCategory(category);
    setActiveBeddingType("all");
    setActiveKoreaType("all");
    setCurrentPage(1);
    scrollToProducts();
  };

  const selectPage = (page: number) => {
    setCurrentPage(page);
    scrollToProducts();
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
  };

  const slideGallery = (direction: -1 | 1) => {
    galleryRef.current?.scrollBy({
      left: galleryRef.current.clientWidth * direction,
      behavior: "smooth",
    });
  };

  return (
    <>
      <section id="products" className="scroll-mt-24 px-5 pb-20 pt-0 sm:px-8 sm:pb-28 lg:px-12 lg:pb-[65px]">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex items-center justify-between border-b border-[#D9D6D0] py-3.5 sm:py-4">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#605B51]/70">SHOP BY CATEGORY</p>
            <p className="text-[11px] tracking-[0.06em] text-[#605B51]/60 sm:text-xs">日韓小物・限量連線・現貨商品</p>
          </div>
          <div className="scrollbar-none -mx-5 flex overflow-x-auto border-y border-[#D9D6D0] px-5 sm:mx-0 sm:px-0">
            {visibleCategories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <button
                  aria-pressed={isActive}
                  className={`shrink-0 border-b-2 px-4 py-4 text-sm tracking-[0.06em] transition-colors sm:px-6 ${
                    isActive
                      ? "border-[#605B51] font-semibold text-[#605B51]"
                      : "border-transparent text-[#605B51]/65 hover:text-[#605B51]"
                  }`}
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          {activeCategory === "bedding" && (
            <div className="flex flex-wrap gap-2 border-b border-[#D9D6D0] py-4">
              {[
                { id: "all", label: "全部" },
                { id: "cool", label: "涼感被" },
                { id: "allSeason", label: "四季被" },
                { id: "pillow", label: "秒睡枕" },
              ].map((item) => (
                <button
                  className={`rounded-full px-3.5 py-2 text-xs transition-colors ${
                    activeBeddingType === item.id
                      ? "bg-[#605B51] text-[#F5F5F5]"
                      : "bg-[#EAE8E4] text-[#605B51] hover:bg-[#D9D6D0]"
                  }`}
                  key={item.id}
                  onClick={() => {
                    setActiveBeddingType(item.id as typeof activeBeddingType);
                    setCurrentPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {activeCategory === "korea" && (
            <div className="flex flex-wrap gap-2 border-b border-[#D9D6D0] py-4">
              <button
                className={`rounded-full px-3.5 py-2 text-xs transition-colors ${
                  activeKoreaType === "all"
                    ? "bg-[#605B51] text-[#F5F5F5]"
                    : "bg-[#EAE8E4] text-[#605B51] hover:bg-[#D9D6D0]"
                }`}
                onClick={() => {
                  setActiveKoreaType("all");
                  setCurrentPage(1);
                }}
              >
                全部
              </button>
              {koreaTypes.map((item) => (
                <button
                  className={`rounded-full px-3.5 py-2 text-xs transition-colors ${
                    activeKoreaType === item.id
                      ? "bg-[#605B51] text-[#F5F5F5]"
                      : "bg-[#EAE8E4] text-[#605B51] hover:bg-[#D9D6D0]"
                  }`}
                  key={item.id}
                  onClick={() => {
                    setActiveKoreaType(item.id);
                    setCurrentPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pb-5 pt-7 sm:pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">{categoryTitles[activeCategory]}</h2>
            <span className="text-xs tracking-[0.08em] text-[#605B51]/65">{filteredProducts.length} ITEMS</span>
          </div>

          <div id="products-grid" className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-10 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5">
            {visibleProducts.map((product) => (
              <button
                aria-label={`查看 ${product.name} 商品資訊`}
                className="group min-w-0 text-left"
                key={product.id}
                onClick={() => openProduct(product)}
              >
                <div
                  className="relative aspect-square overflow-hidden rounded-[3px] bg-[#EAE8E4] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.015]"
                  style={{ backgroundImage: `url(${product.image})` }}
                >
                  <span className={`absolute left-1.5 top-1.5 rounded-full font-semibold tracking-[0.08em] sm:left-2 sm:top-2 ${product.status === "現貨" ? "px-2 py-1.5 text-[9px] sm:px-2.5 sm:py-1.5 sm:text-[11px]" : "px-1.5 py-1 text-[8px] sm:px-2 sm:text-[10px]"} ${statusStyles[product.status]}`}>
                    {product.status}
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#F5F5F5]/85 px-1.5 py-1 text-[7px] font-medium tracking-[0.12em] text-[#605B51] backdrop-blur sm:bottom-2 sm:right-2 sm:px-2 sm:text-[9px]">
                    {product.country}
                  </span>
                </div>
                <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[12px] font-semibold leading-5 tracking-[-0.015em] text-[#605B51] sm:mt-3 sm:text-sm sm:leading-6">
                  {product.name}
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-5 tracking-[-0.02em] text-[#A81515] sm:text-sm">NT$ {formatPrice(product.price)}</p>
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 && remoteCatalogLoaded && isSupabaseConfigured && (
            <p className="border-y border-[#D9D6D0] py-14 text-center text-sm leading-7 text-[#605B51]/65">
              目前尚無已發布商品，請稍後再回來看看。
            </p>
          )}

          {totalPages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-2" aria-label="商品分頁">
              <button
                aria-label="上一頁"
                className="rounded-full border border-[#D9D6D0] px-4 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#605B51]"
                disabled={activePage === 1}
                onClick={() => selectPage(activePage - 1)}
              >
                上一頁
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  aria-current={activePage === page ? "page" : undefined}
                  className={`h-9 w-9 rounded-full text-xs transition-colors ${
                    activePage === page
                      ? "bg-[#605B51] text-[#F5F5F5]"
                      : "bg-[#EAE8E4] text-[#605B51] hover:bg-[#D9D6D0]"
                  }`}
                  key={page}
                  onClick={() => selectPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                aria-label="下一頁"
                className="rounded-full border border-[#D9D6D0] px-4 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#605B51]"
                disabled={activePage === totalPages}
                onClick={() => selectPage(activePage + 1)}
              >
                下一頁
              </button>
            </nav>
          )}
        </div>
      </section>

      <a
        className="fixed bottom-3 left-3 right-3 z-20 flex items-center justify-center gap-2 rounded-full bg-[#605B51] px-5 py-3.5 text-sm font-medium tracking-[0.06em] text-[#F5F5F5] shadow-lg shadow-[#605B51]/20 md:hidden"
        href={lineOfficialUrl}
        target="_blank"
        rel="noreferrer"
      >
        截圖商品，前往 LINE@ 詢價／下單 <Arrow className="h-4 w-4" />
      </a>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#605B51]/45 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedProduct.name} 商品資訊`}>
          <button className="absolute inset-0 cursor-default" aria-label="關閉商品資訊" onClick={() => setSelectedProduct(null)} />
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[16px] bg-[#FAF7F0] sm:max-w-4xl sm:rounded-[12px]">
            <button className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#FAF7F0]/90 text-[#605B51] shadow-sm" aria-label="關閉商品資訊" onClick={() => setSelectedProduct(null)}>
              <CloseIcon />
            </button>
            <div className="grid md:grid-cols-2">
              <div className="relative min-h-72 overflow-hidden bg-[#EAE8E4] md:min-h-[520px]">
                <div
                  className="scrollbar-none absolute inset-0 flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
                  onScroll={(event) => {
                    const width = event.currentTarget.clientWidth;
                    if (width) setActiveImageIndex(Math.round(event.currentTarget.scrollLeft / width));
                  }}
                  ref={galleryRef}
                >
                  {galleryImages.map((image, index) => (
                    <div
                      aria-label={`${selectedProduct.name} 第 ${index + 1} 張圖片`}
                      className="h-full min-w-full snap-center bg-cover bg-center"
                      key={`${selectedProduct.id}-${image}-${index}`}
                      role="img"
                      style={{ backgroundImage: `url(${image})` }}
                    />
                  ))}
                </div>
                {galleryImages.length > 1 && (
                  <>
                    <button
                      aria-label="上一張商品圖片"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#F5F5F5]/85 text-lg text-[#605B51] shadow-sm backdrop-blur"
                      disabled={activeImageIndex === 0}
                      onClick={() => slideGallery(-1)}
                    >
                      ‹
                    </button>
                    <button
                      aria-label="下一張商品圖片"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#F5F5F5]/85 text-lg text-[#605B51] shadow-sm backdrop-blur"
                      disabled={activeImageIndex === galleryImages.length - 1}
                      onClick={() => slideGallery(1)}
                    >
                      ›
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-[#605B51]/35 px-2.5 py-1.5 backdrop-blur">
                      {galleryImages.map((image, index) => (
                        <span className={`h-1.5 w-1.5 rounded-full ${activeImageIndex === index ? "bg-[#F5F5F5]" : "bg-[#F5F5F5]/45"}`} key={`${image}-dot`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="p-7 sm:p-10">
                <div className="flex items-center justify-between gap-4">
                  <span className={`rounded-full px-3 py-2 text-[15px] font-semibold leading-none tracking-[0.06em] ${statusStyles[selectedProduct.status]}`}>{selectedProduct.status}</span>
                  <span className="text-[10px] font-medium tracking-[0.14em] text-[#605B51]/65">{selectedProduct.country}</span>
                </div>
                <h2 className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">{selectedProduct.name}</h2>
                <div className="mt-3">
                  <span className="text-lg font-bold text-[#C94A45]">優惠價 NT$ {formatPrice(selectedProduct.price)}<span className="ml-1 align-baseline text-[11px] font-medium">起</span></span>
                </div>
                <dl className="mt-8 divide-y divide-[#D9D6D0] border-y border-[#D9D6D0] text-sm">
                  <div className="grid grid-cols-[88px_1fr] gap-4 py-3.5"><dt className="text-[#605B51]/65">商品編號</dt><dd>{selectedProduct.code}</dd></div>
                  <div className="grid grid-cols-[88px_1fr] gap-4 py-3.5"><dt className="text-[#605B51]/65">收單時間</dt><dd>{selectedProduct.deadline}</dd></div>
                  <div className="grid grid-cols-[88px_1fr] gap-4 py-3.5"><dt className="text-[#605B51]/65">預計到貨</dt><dd>{selectedProduct.arrival}</dd></div>
                  <div className="grid grid-cols-[88px_1fr] gap-4 py-3.5"><dt className="text-[#605B51]/65">顏色</dt><dd className="whitespace-pre-line">{selectedProduct.colors}</dd></div>
                  <div className="grid grid-cols-[88px_1fr] gap-4 py-3.5"><dt className="text-[#605B51]/65">尺寸</dt><dd className="whitespace-pre-line">{selectedProduct.sizes}</dd></div>
                </dl>
                <div className="mt-7">
                  <h3 className="text-[15px] font-extrabold">商品介紹</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#605B51]">{selectedProduct.details}</p>
                  <p className="mt-3 whitespace-pre-line text-xs leading-6 text-[#605B51]/65">{selectedProduct.specs}</p>
                </div>
                <div className="mt-8 border-t border-[#D9D6D0] pt-6">
                  <p className="text-sm leading-6 text-[#605B51]">想詢價或下單嗎？請截圖此商品後，傳送至 LINE@ 官方帳號。</p>
                  <a className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#605B51] px-5 py-3.5 text-sm font-medium tracking-[0.04em] text-[#F5F5F5] transition-colors hover:bg-[#766F63]" href={lineOfficialUrl} target="_blank" rel="noreferrer">
                    截圖商品，前往 LINE@ 詢價／下單 <Arrow className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="overflow-x-clip bg-[#FAF7F0] text-[#605B51]" style={{ fontFamily: roundedFontFamily }}>
      <div className="bg-[#605B51] px-4 py-2 text-center text-[11px] tracking-[0.08em] text-[#F5F5F5] sm:text-xs">
        新品與連線資訊，優先發布於 LINE 社群
        <a
          className="ml-3 border-b border-[#F5F5F5]/70 pb-0.5 font-semibold tracking-[0.1em] transition-opacity hover:opacity-70"
          href={lineCommunityUrl}
          target="_blank"
          rel="noreferrer"
        >
          加入社群 ↗
        </a>
      </div>

      <header className="sticky top-0 z-30 border-b border-[#D9D6D0]/90 bg-[#FAF7F0]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#products" className="group leading-none" aria-label="回到商品列表">
            <span className="block text-base font-semibold tracking-[0.13em] sm:text-lg">信男代購</span>
            <span className="mt-1 block text-[9px] font-medium tracking-[0.22em] text-[#605B51]/70 transition-colors group-hover:text-[#605B51]">
              WOBUY174_
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-xs tracking-[0.08em] text-[#605B51]/80 lg:flex" aria-label="主要導覽">
            <a className="transition-colors hover:text-[#605B51]" href="/products">
              所有商品
            </a>
          </nav>

          <div className="flex items-center gap-3 text-xs font-medium tracking-[0.06em] sm:gap-4">
            <a
              className="hidden border-b border-[#605B51] pb-1 text-[#605B51] sm:inline"
              href={lineCommunityUrl}
              target="_blank"
              rel="noreferrer"
            >
              LINE 社群
            </a>
            <a
              className="rounded-full bg-[#605B51] px-3.5 py-2.5 text-[11px] text-[#F5F5F5] transition-colors hover:bg-[#766F63] sm:px-4"
              href={lineOfficialUrl}
              target="_blank"
              rel="noreferrer"
            >
              LINE@ 詢價
            </a>
          </div>
        </div>
      </header>

      <ProductCatalog showAllCategory={false} />

      <section className="border-y border-[#D9D6D0] px-5 py-5 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.24em] text-[#605B51]/70">ORDER WITH LINE@</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">詢價與下單方式</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#605B51] sm:text-base">
              看到喜歡的商品後，截圖傳給我們；庫存、規格與後續安排，我們會在 LINE@ 協助你確認。
            </p>
            <a
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#605B51] px-6 py-3.5 text-sm font-medium tracking-[0.06em] text-[#F5F5F5] transition-transform hover:-translate-y-0.5 hover:bg-[#766F63]"
              href={lineOfficialUrl}
              target="_blank"
              rel="noreferrer"
            >
              前往 LINE@ 官方帳號 <Arrow className="h-4 w-4" />
            </a>
          </div>
          <ol className="border-t border-[#D9D6D0]">
            {[
              ["01", "選好商品", "瀏覽商品頁，確認想詢問的商品。"],
              ["02", "截圖商品資訊", "請保留商品圖片、名稱或商品編號。"],
              ["03", "傳送至 LINE@", "將截圖傳送至 LINE@ 官方帳號詢價或下單。"],
              ["04", "確認訂單資訊", "客服將協助確認庫存、商品規格與後續安排。"],
            ].map(([number, title, description]) => (
              <li className="grid grid-cols-[42px_1fr] gap-x-4 border-b border-[#D9D6D0] py-4 sm:grid-cols-[56px_1fr_auto] sm:items-center sm:gap-x-6 2xl:grid-cols-[56px_380px_minmax(0,1fr)]" key={number}>
                <span className="text-xs font-medium tracking-[0.12em] text-[#605B51]/65">{number}</span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="col-start-2 mt-1 text-sm leading-5 text-[#605B51] sm:col-start-auto sm:mt-0 sm:max-w-[16rem] 2xl:max-w-none 2xl:whitespace-nowrap">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="min-h-[380px] border-t border-[#D9D6D0] bg-[#F0ECE3] px-5 pb-16 pt-8 sm:px-8 sm:pb-12 md:min-h-0 lg:px-12">
        <div className="mx-auto grid max-w-[1500px] gap-7 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-lg font-semibold tracking-[0.1em]">信男代購</p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.22em] text-[#605B51]/65">WOBUY174_</p>
            <p className="mt-4 text-sm tracking-[0.05em] text-[#605B51]">日韓代購｜正品直送｜實體店面｜安心放心</p>
            <p className="mt-4 max-w-xl text-xs leading-6 text-[#605B51]/65">
              商品顏色可能因螢幕顯示略有差異；海外商品之規格、供貨與到貨狀況，以實際商品及客服確認內容為準。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-[#605B51] md:content-start md:text-right">
            <a className="hover:text-[#766F63]" href={lineCommunityUrl} target="_blank" rel="noreferrer">LINE 社群</a>
            <a className="hover:text-[#766F63]" href={lineOfficialUrl} target="_blank" rel="noreferrer">LINE@ @514zpkwa</a>
            <a className="hover:text-[#766F63]" href={instagramUrl} target="_blank" rel="noreferrer">Instagram @wobuy174_</a>
            <a className="hover:text-[#766F63]" href={mapUrl} target="_blank" rel="noreferrer">嘉義實體店面</a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-[1500px] text-[10px] tracking-[0.16em] text-[#605B51]/55">© 信男代購 WOBUY174_</p>
      </footer>
    </main>
  );
}
