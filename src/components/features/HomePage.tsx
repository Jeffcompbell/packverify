import React from 'react';
import {
  Search,
  Settings,
  FileText,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  PlayCircle,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: 'analysis' | 'detection-config' | 'batch-report') => void;
  userQuota?: { quota: number; used: number };
}

interface DetectionBox {
  top: string;
  left: string;
  width: string;
  height: string;
}

interface CaseStudy {
  id: string;
  product: string;
  industry: string;
  beforeSrc: string;
  afterSrc: string;
  issueSummary: string;
  issueCount: number;
  tags: string[];
  improvementNote: string;
  boxes: DetectionBox[];
}

const caseStudies: CaseStudy[] = [
  {
    id: 'perfume-pack',
    product: '玻璃香水礼盒',
    industry: '美妆&香氛',
    beforeSrc: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=720&q=80',
    afterSrc: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=720&q=80',
    issueSummary: '瓶盖松动 / 标签错位 / 防伪码模糊',
    issueCount: 6,
    tags: ['封签残留', '标签歪斜', '批次号模糊'],
    improvementNote: '返修效率 +32%',
    boxes: [
      { top: '18%', left: '8%', width: '42%', height: '52%' },
      { top: '25%', left: '60%', width: '30%', height: '30%' }
    ]
  },
  {
    id: 'tea-box',
    product: '冷萃茶礼盒',
    industry: '食品饮料',
    beforeSrc: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=720&q=80',
    afterSrc: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=720&q=80',
    issueSummary: '封条气泡 / 边缘压痕 / 错贴批次',
    issueCount: 9,
    tags: ['封条起鼓', '角落破损', '日期打码偏移'],
    improvementNote: '客户投诉 -41%',
    boxes: [
      { top: '22%', left: '12%', width: '35%', height: '40%' },
      { top: '40%', left: '55%', width: '32%', height: '32%' },
      { top: '8%', left: '55%', width: '30%', height: '18%' }
    ]
  },
  {
    id: 'coffee-pouch',
    product: '精品咖啡软袋',
    industry: '新消费',
    beforeSrc: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=720&q=80',
    afterSrc: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=720&q=80',
    issueSummary: '热封不齐 / 色块漏印 / 扫码失败',
    issueCount: 4,
    tags: ['热封虚焊', '色块偏移', '二维码不可读'],
    improvementNote: '上线首检 8 min → 2 min',
    boxes: [
      { top: '12%', left: '60%', width: '26%', height: '30%' },
      { top: '42%', left: '20%', width: '52%', height: '45%' }
    ]
  },
  {
    id: 'electronics',
    product: '智能设备外箱',
    industry: '3C电子',
    beforeSrc: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=720&q=80',
    afterSrc: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=720&q=80',
    issueSummary: '装箱位移 / 防震泡棉缺口 / 条形码遮挡',
    issueCount: 7,
    tags: ['泡棉缺失', '条形码遮挡', '封箱胶带皱褶'],
    improvementNote: '返货率 < 0.3%',
    boxes: [
      { top: '30%', left: '8%', width: '40%', height: '36%' },
      { top: '32%', left: '56%', width: '30%', height: '32%' }
    ]
  }
];

const heroStats = [
  { label: '平均出具检测', value: '12 秒', desc: '端到端 AI 推理 + 云端 QIL 校验' },
  { label: '上线品牌', value: '180+ ', desc: '日化 / 食品 / 3C / 生鲜等行业' },
  { label: '历史检测图', value: '2.8M+', desc: '自学习缺陷库持续叠代' }
];

const workflowShortcuts = [
  {
    id: 'analysis',
    label: '单图检测',
    desc: '上传图片立即定位缺陷',
    icon: Search
  },
  {
    id: 'detection-config',
    label: '检测配置',
    desc: '管理模型、规则和标签集',
    icon: Settings
  },
  {
    id: 'batch-report',
    label: '批量报告',
    desc: '导出详细批量质检结果',
    icon: FileText
  },
  {
    id: 'help',
    label: '帮助与培训',
    desc: '快速熟悉 QA 流程',
    icon: HelpCircle
  }
];

const heightMap = {
  sm: 'h-32',
  md: 'h-44',
  lg: 'h-56'
} as const;

type ComparisonSize = keyof typeof heightMap;

const ComparisonImages: React.FC<{ study: CaseStudy; size?: ComparisonSize }> = ({ study, size = 'md' }) => {
  const heightClass = heightMap[size];
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <img
          src={study.beforeSrc}
          alt={`${study.product} 原图`}
          loading="lazy"
          className={`w-full object-cover ${heightClass}`}
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          原图
        </span>
      </figure>
      <figure className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-slate-100">
        <img
          src={study.afterSrc}
          alt={`${study.product} 检测结果`}
          loading="lazy"
          className={`w-full object-cover ${heightClass} saturate-125`}
        />
        <span className="absolute left-3 top-3 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
          检测结果
        </span>
        {study.boxes.map((box, index) => (
          <span
            key={`${study.id}-box-${index}`}
            className="absolute rounded-xl border-2 border-emerald-400/80 bg-emerald-200/10"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        ))}
      </figure>
    </div>
  );
};

const CaseStudyCard: React.FC<{ study: CaseStudy }> = ({ study }) => (
  <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{study.industry}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">{study.product}</h3>
        <p className="text-sm text-slate-500">{study.issueSummary}</p>
      </div>
      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
        <p className="text-xs text-emerald-600">风险点</p>
        <p className="text-xl font-semibold text-emerald-700">{study.issueCount}</p>
      </div>
    </div>
    <div className="mt-4">
      <ComparisonImages study={study} size="md" />
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {study.tags.map((tag) => (
        <span key={`${study.id}-${tag}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          {tag}
        </span>
      ))}
    </div>
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{study.improvementNote}</span>
      <span className="inline-flex items-center gap-1 text-emerald-600">
        查看报告
        <ArrowRight className="h-4 w-4" />
      </span>
    </div>
  </article>
);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, userQuota }) => {
  const [batchKeyword, setBatchKeyword] = React.useState('');

  const handleQuickStart = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNavigate('analysis');
  };

  const handleShortcut = (id: string) => {
    if (id === 'help') {
      if (typeof window !== 'undefined') {
        window.open('/docs', '_blank', 'noreferrer');
      }
      return;
    }
    onNavigate(id as 'analysis' | 'detection-config' | 'batch-report');
  };

  const remainingQuota = userQuota ? Math.max(0, userQuota.quota - userQuota.used) : null;

  return (
    <div className="flex-1 overflow-auto bg-slate-950/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_35px_120px_-60px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              智能包装质检 · 匿居的我们
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              减少冗长文字说明，让客户通过案例与交互直接看到质检实力
            </h1>
            <p className="mt-3 text-base text-slate-600">
              在首页直接粘贴批次或上传图片，AI 会在 10 秒内给出可视化缺陷定位。配合真实案例墙，帮助客户第一眼理解“匿居的我们”的质检能力。
            </p>

            <form onSubmit={handleQuickStart} className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">极速体验检测</label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={batchKeyword}
                    onChange={(event) => setBatchKeyword(event.target.value)}
                    placeholder="粘贴产品条码 / 批次 ID / 订单号"
                    className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                >
                  <ImageIcon className="h-4 w-4" />
                  开始检测
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-500">支持 JPG · PNG · HEIC · 批量 ZIP，或直接拖拽图片到任意位置。</div>
            </form>

            {remainingQuota !== null && (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">本月剩余额度</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{remainingQuota}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  总额度 {userQuota?.quota ?? '-'} · 已用 {userQuota?.used ?? '-'}
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[32px] border border-slate-900/10 bg-slate-900 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_45%)]" />
            <div className="relative flex h-full flex-col gap-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">实时示例</p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight">案例墙</h2>
                <p className="text-sm text-slate-300">将原图与检测后结果并排展示，减少文字说明，直接呈现“检测前 vs 检测后”感知。</p>
              </div>

              {caseStudies.slice(0, 2).map((study) => (
                <div key={`hero-${study.id}`} className="rounded-3xl bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{study.industry}</p>
                      <p className="font-semibold text-white">{study.product}</p>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {study.issueCount} 个问题
                    </div>
                  </div>
                  <div className="mt-3">
                    <ComparisonImages study={study} size="sm" />
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-xs text-emerald-200">
                    <Activity className="h-3.5 w-3.5" />
                    {study.improvementNote}
                  </p>
                </div>
              ))}

              <button
                onClick={() => onNavigate('batch-report')}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
              >
                <PlayCircle className="h-4 w-4" />
                查看更多成功案例
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_35px_120px_-70px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">客户真实案例</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">原图 / 检测后对比</h2>
              <p className="text-sm text-slate-500">构建可滑动案例墙，让访客无需阅读讲解就能理解“匿居的我们”提供的价值。</p>
            </div>
            <button
              onClick={() => onNavigate('analysis')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-900/10 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              浏览所有案例
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {caseStudies.map((study) => (
              <CaseStudyCard key={study.id} study={study} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowShortcuts.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => handleShortcut(card.id)}
                className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-900/30 hover:shadow-[0_25px_80px_-60px_rgba(15,23,42,0.6)]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl bg-slate-900/5 p-2">
                    <Icon className="h-5 w-5 text-slate-900" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">{card.label}</p>
                <p className="text-sm text-slate-500">{card.desc}</p>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
};
