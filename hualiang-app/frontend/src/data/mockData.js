export const members = [
  {
    id: 1,
    name: '王美玲',
    company: '美麗花藝工作室',
    industry: '美業/醫美',
    title: '創辦人',
    location: '台北市',
    phone: '0912-345-678',
    lineId: 'beautywang',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
    description: '專精婚禮花藝設計與企業活動佈置，提供客製化花禮服務',
    tags: ['花藝', '婚禮佈置', '企業活動'],
    hearts: 28
  },
  {
    id: 2,
    name: '陳雅芳',
    company: '芳療養生館',
    industry: '健康/保健',
    title: '館長',
    location: '新北市',
    phone: '0923-456-789',
    lineId: 'yafangspa',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
    description: '提供專業經絡按摩、精油芳療，致力於身心靈平衡養生',
    tags: ['按摩', '芳療', '養生'],
    hearts: 35
  },
  {
    id: 3,
    name: '李淑華',
    company: '華信會計師事務所',
    industry: '設計/行銷',
    title: '執業會計師',
    location: '台北市',
    phone: '0934-567-890',
    lineId: 'shuhuaacc',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=shuhua&backgroundColor=b6e3f4',
    description: '專營中小企業記帳、稅務申報、財務規劃諮詢服務',
    tags: ['會計', '稅務', '財務規劃'],
    hearts: 42
  },
  {
    id: 4,
    name: '張小菁',
    company: '菁品烘焙坊',
    industry: '餐飲/食品',
    title: '主理人',
    location: '桃園市',
    phone: '0945-678-901',
    lineId: 'jingbakery',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jing&backgroundColor=ffd5dc',
    description: '手工法式甜點、客製化蛋糕，使用天然食材無添加',
    tags: ['甜點', '蛋糕', '烘焙'],
    hearts: 31
  },
  {
    id: 5,
    name: '林靜怡',
    company: '怡家室內設計',
    industry: '不動產',
    title: '設計總監',
    location: '台中市',
    phone: '0956-789-012',
    lineId: 'jingyidesign',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jingyi&backgroundColor=d1f4e0',
    description: '住宅與商業空間設計，從規劃到施工一條龍服務',
    tags: ['室內設計', '裝修', '空間規劃'],
    hearts: 38
  },
  {
    id: 6,
    name: '黃美鳳',
    company: '鳳凰行銷顧問',
    industry: '設計/行銷',
    title: '總經理',
    location: '高雄市',
    phone: '0967-890-123',
    lineId: 'meifengmkt',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meifeng&backgroundColor=ffe4c4',
    description: '品牌行銷策略、社群經營、廣告投放，協助企業數位轉型',
    tags: ['行銷', '品牌', '社群經營'],
    hearts: 45
  },
  {
    id: 7,
    name: '吳秀琴',
    company: '琴韻美容SPA',
    industry: '美業/醫美',
    title: '院長',
    location: '台南市',
    phone: '0978-901-234',
    lineId: 'xiuqinspa',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiuqin&backgroundColor=e2e8f0',
    description: '臉部護理、身體SPA、醫美諮詢，20年專業經驗',
    tags: ['美容', 'SPA', '醫美'],
    hearts: 52
  },
  {
    id: 8,
    name: '鄭玉梅',
    company: '玉梅健康食品',
    industry: '健康/保健',
    title: '創辦人',
    location: '台北市',
    phone: '0989-012-345',
    lineId: 'yumeihealth',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yumei&backgroundColor=feebc8',
    description: '進口保健食品、營養補充品，提供專業健康諮詢',
    tags: ['保健食品', '營養品', '健康諮詢'],
    hearts: 29
  }
];

export const industryTags = ['全部', '美業/醫美', '餐飲/食品', '不動產', '設計/行銷', '健康/保健', '其他'];
export const regionTags = ['全部', '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'];

export const upcomingEvents = [
  {
    id: 1,
    title: '3月例會 - 會姐交流茶會',
    date: '2025年3月25日',
    time: '14:00 - 17:00',
    location: '台北市信義區松高路123號5樓',
    description: '本月主題「數位轉型與商機拓展」，邀請黃美鳳會姐分享行銷經驗',
    speaker: '黃美鳳 總經理',
    registered: 28,
    capacity: 50,
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=400&fit=crop',
    type: '例會'
  },
  {
    id: 2,
    title: '4月春遊 - 陽明山賞花一日遊',
    date: '2025年4月12日',
    time: '08:00 - 18:00',
    location: '台北市陽明山國家公園',
    description: '春季賞花趣！竹子湖海芋季，一起出遊增進情誼',
    speaker: null,
    registered: 15,
    capacity: 30,
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&h=400&fit=crop',
    type: '活動'
  }
];

export const pastEvents = [
  {
    id: 3,
    title: '2月慶生會',
    date: '2025年2月20日',
    location: '晶華酒店',
    participants: 45,
    photos: 32,
    type: '慶生會'
  },
  {
    id: 4,
    title: '1月例會 - 新年新希望',
    date: '2025年1月23日',
    location: '分會會館',
    participants: 38,
    photos: 24,
    type: '例會'
  }
];

export const latestNews = [
  {
    id: 1,
    title: '華亮分會榮獲年度優秀分會獎',
    date: '2025年3月15日',
    type: '公告',
    important: true,
    summary: '感謝全體會姐的努力，華亮分會榮獲總會評選為年度優秀分會！'
  },
  {
    id: 2,
    title: '新會員入會歡迎儀式',
    date: '2025年3月10日',
    type: '活動',
    important: false,
    summary: '本月有3位新會姐加入，歡迎大家多多交流！'
  },
  {
    id: 3,
    title: '會費繳交通知',
    date: '2025年3月1日',
    type: '公告',
    important: true,
    summary: '請於3月31日前完成第二季會費繳交，謝謝配合。'
  }
];

export const redCards = [
  {
    id: 1,
    type: 'red',
    author: '王美玲',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
    title: '尋找婚禮場地合作',
    description: '需要可以配合花藝佈置的婚禮場地，希望有戶外空間，歡迎推薦！',
    industry: '不動產',
    urgency: '急',
    date: '2025-03-18',
    hearts: 5,
    shares: 3
  }
];

export const greenCards = [
  {
    id: 4,
    type: 'green',
    author: '陳雅芳',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
    title: '會姐專屬 - 全身舒壓療程',
    description: '原價$2,800，會姐特惠價$1,680，含精油按摩+熱石療法。',
    industry: '健康/保健',
    originalPrice: 2800,
    discountPrice: 1680,
    discount: 40,
    deadline: '2025-04-15T23:59:59',
    hearts: 15,
    shares: 12
  }
];

export const lifePosts = [
  {
    id: 1,
    author: '王美玲',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
    content: '今天完成的婚禮花藝佈置，新人非常滿意！💐',
    images: ['https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&h=800&fit=crop'],
    date: '2025-03-17',
    likes: 28,
    month: '2025年3月'
  },
  {
    id: 2,
    author: '陳雅芳',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
    content: '2月慶生會的美好回憶，大家笑得好開心！🎂',
    images: [
      'https://images.unsplash.com/photo-1530103862676-de3c9da59af7?w=600&h=400&fit=crop'
    ],
    date: '2025-02-21',
    likes: 45,
    month: '2025年2月'
  }
];

export const monthGroups = ['全部', '2025年3月', '2025年2月', '2025年1月', '2024年12月'];
