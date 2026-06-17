# MemoWords - 默默背单词

轻量级智能背单词 Web 应用，基于艾宾浩斯遗忘曲线（SM-2 算法）驱动的间隔重复学习系统。

## 特性

- **SM-2 算法调度**：智能复习间隔，基于反馈动态调整
- **离线优先**：IndexedDB 本地主存，无网络也能学习
- **云端同步**：Supabase 备份 + 跨设备同步
- **Web Speech API 发音**：浏览器内置 TTS，零额外依赖
- **内置词库**：四级高频核心、六级高频核心、雅思核心词汇
- **自定义词库**：支持 CSV / JSON 格式导入
- **学习统计**：Chart.js 可视化每日学习量和正确率趋势
- **响应式布局**：桌面 / 平板 / 手机均可使用（Tailwind CSS）
- **PWA 支持**：可安装到桌面，离线使用

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| UI 样式 | Tailwind CSS |
| 本地存储 | IndexedDB (Dexie.js) |
| 云端服务 | Supabase (Auth + PostgreSQL) |
| 图表 | Chart.js + vue-chartjs |
| 发音 | Web Speech API |

## 快速开始

### 前置条件

- Node.js >= 18
- Supabase 项目（可选，离线模式下无需）

### 安装

```bash
cd memowords
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env`，填入你的 Supabase 项目信息：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> 如果不配置 Supabase，应用将以纯离线模式运行。

### 开发

```bash
npm run dev
```

访问 `http://localhost:5173`

### 构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到任意静态托管（Vercel / Netlify / GitHub Pages）。

## 目录结构

```
memowords/
├── public/
│   ├── favicon.svg
│   ├── manifest.json
│   └── wordbooks/                # 内置词库 JSON
│       ├── cet4-core.json        # 四级高频核心
│       ├── cet6-core.json        # 六级高频核心
│       └── ielts-core.json       # 雅思核心词汇
├── src/
│   ├── algorithms/
│   │   └── sm2.ts                # SM-2 间隔重复算法
│   ├── components/
│   │   ├── AppLayout.vue         # 全局响应式布局
│   │   ├── WordCard.vue          # 单词卡片（CSS 3D 翻转）
│   │   ├── FeedbackButtons.vue   # 三按钮反馈组件
│   │   ├── ProgressBar.vue       # 学习进度条
│   │   └── StatsChart.vue        # Chart.js 统计图表
│   ├── composables/
│   │   ├── usePronunciation.ts   # Web Speech API 封装
│   │   ├── useSync.ts            # 同步引擎
│   │   └── uuid.ts               # UUID 工具
│   ├── db/
│   │   └── index.ts              # Dexie.js 数据库定义
│   ├── pages/
│   │   ├── LoginPage.vue         # 登录/注册
│   │   ├── DashboardPage.vue     # 首页仪表盘
│   │   ├── LearnPage.vue         # 背词主界面
│   │   ├── WordbooksPage.vue     # 词库管理
│   │   ├── StatsPage.vue         # 学习统计
│   │   └── SettingsPage.vue      # 应用设置
│   ├── router/
│   │   └── index.ts              # 路由配置 + 守卫
│   ├── stores/
│   │   ├── authStore.ts          # 认证状态
│   │   ├── learnStore.ts         # 学习队列 + SM-2
│   │   ├── wordbookStore.ts      # 词库管理
│   │   ├── statsStore.ts         # 统计管理
│   │   └── syncStore.ts          # 同步状态
│   ├── supabase/
│   │   └── client.ts             # Supabase 客户端
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   ├── App.vue
│   ├── main.ts
│   └── style.css                 # Tailwind 入口
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 学习流程

1. **选择词库** → 在词库管理页选择要学习的词库
2. **开始学习** → 点击"开始学习"进入背词界面
3. **卡片翻转** → 看到单词后点击翻转查看释义和例句
4. **给出反馈** → 根据掌握程度选择「认识」「模糊」「忘记」
5. **算法调度** → SM-2 算法根据反馈自动安排下次复习时间
6. **学习小结** → 完成后展示本次学习统计
7. **每日复习** → 第二天到期的单词自动进入复习队列

## 词库导入

支持 CSV 和 JSON 两种格式：

### CSV 格式
```csv
word,phonetic,meaning,example,example_cn
abandon,/əˈbændən/,v.放弃；抛弃,He abandoned the plan.,他放弃了这个计划。
```

### JSON 格式
```json
{
  "name": "我的词库",
  "description": "自定义词库",
  "words": [
    {
      "word": "abandon",
      "phonetic": "/əˈbændən/",
      "meaning": "v.放弃；抛弃",
      "example": "He abandoned the plan.",
      "example_cn": "他放弃了这个计划。"
    }
  ]
}
```

## License

MIT
