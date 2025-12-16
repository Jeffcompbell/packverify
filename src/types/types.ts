
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

// Updated to match the 8-point checklist
export type IssueType =
  | 'file_setting'   // 1. File settings/Layout
  | 'font'           // 2. Fonts/Copyright
  | 'image_quality'  // 3. Image Quality/Embeds
  | 'color'          // 4. Color settings (Rich Black)
  | 'bleed'          // 5. Bleed/Margins
  | 'content'        // 6. Content/Proofreading
  | 'annotation'     // 7. Annotations/Die-lines
  | 'format'         // 8. Output Format
  | 'compliance';    // Extra: Ads law/Regulations

// 置信度级别
export type ConfidenceLevel = 'certain' | 'likely' | 'possible';

export interface DiagnosisIssue {
  id: string;
  type: IssueType;
  text?: string;  // 旧格式兼容
  original?: string;  // 新格式：问题原文（简短）
  problem?: string;   // 新格式：具体问题描述
  suggestion: string;
  location_desc?: string;
  severity: 'high' | 'medium' | 'low';
  confidence?: ConfidenceLevel; // 置信度
  box_2d?: BoundingBox; // Normalized 0-1000
}

// 确定性检查结果（括号配对等）
export interface DeterministicCheck {
  id: string;
  type: 'bracket_mismatch' | 'encoding_error' | 'format_error';
  description: string;
  location: string; // 在 OCR 文本中的位置描述
  severity: 'high' | 'medium';
}

// 词库命中结果
export interface LexiconIssue {
  id: string;
  type: 'lexicon';
  original: string;      // 命中的原文
  problem: string;       // 风险原因
  suggestion: string;    // 修改建议
  severity: 'high' | 'medium' | 'low';
  confidence: 'certain'; // 词库命中是确定性的
  context: string;       // 上下文
  ruleHits: Array<{
    type: 'lexicon';
    id: string;          // 规则 ID
    source?: string;     // 来源（如 FDA 21 CFR）
    sourceUrl?: string;  // 来源链接
  }>;
}

export interface SourceField {
  key: string;
  value: string;
  category: 'content' | 'compliance' | 'specs';
}

export interface DiffResult {
  id: string;
  field: string;
  sourceValue: string;
  imageValue: string | null;
  status: 'match' | 'error' | 'warning';
  matchType: 'strict' | 'semantic' | 'logic';
  reason?: string;
  box_2d?: BoundingBox;
}

export type WorkflowStep = 'upload' | 'diagnose' | 'source_input' | 'compare';

export interface ViewLayers {
  diagnosis: boolean;
  diff: boolean;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export type MarketType = 'general' | 'US' | 'EU' | 'CA' | 'CN';

export const MARKET_LABELS: Record<MarketType, string> = {
  general: '通用',
  US: '美国',
  EU: '欧盟',
  CA: '加拿大',
  CN: '中国'
};

export const MARKET_LIST: MarketType[] = ['US', 'EU', 'CA', 'CN', 'general'];

export interface ImageSpec {
  key: string;
  value: string;
  category: string;
}

export type IndustryType =
  | 'cosmetics'
  | 'food'
  | 'pharma'
  | 'supplement'
  | 'medical_device'
  | 'infant'
  | 'household'
  | 'general';

export const INDUSTRY_LABELS: Record<IndustryType, string> = {
  cosmetics: '化妆品',
  food: '食品',
  pharma: '药品',
  supplement: '保健品',
  medical_device: '医疗器械',
  infant: '婴幼儿配方',
  household: '家清消杀',
  general: '通用'
};

export const INDUSTRY_LIST: IndustryType[] = [
  'cosmetics',
  'food',
  'pharma',
  'supplement',
  'medical_device',
  'infant',
  'household',
  'general'
];

// 图片分析状态
export type ImageStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface ImageItem {
  id: string;
  src: string;
  base64: string;
  file: File;
  description?: string; // 图片内容描述
  ocrText?: string;     // OCR 提取的原文（所有模型共用）
  specs: ImageSpec[];   // 图片提取的参数（所有模型共用）
  // 多模型支持：按模型 ID 存储检测结果
  issuesByModel: {
    [modelId: string]: {
      issues: DiagnosisIssue[];
      deterministicIssues: DeterministicCheck[];
      lexiconIssues?: LexiconIssue[];
    }
  };
  // 向后兼容（可选）
  issues?: DiagnosisIssue[];
  deterministicIssues?: DeterministicCheck[];
  diffs: DiffResult[];
  industry?: IndustryType; // 行业类型
  markets?: MarketType[]; // 出口市场
  rotation?: number; // 旋转角度
  status?: ImageStatus; // 分析状态
  analyzingStartedAt?: number; // 分析开始时间戳（毫秒）
  analysisDuration?: number; // 分析耗时（毫秒）
  errorMessage?: string; // 错误信息
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: Date;
}

// 诊断结果包含描述
export interface DiagnosisResult {
  description: string;
  ocrText: string;      // OCR 原文
  issues: DiagnosisIssue[];
  deterministicIssues: DeterministicCheck[]; // 确定性问题
  lexiconIssues?: LexiconIssue[];  // 词库命中问题
  specs: SourceField[]; // 产品规格（从单次 AI 调用中提取）
  tokenUsage?: TokenUsage; // Token 使用统计
  truncated?: boolean;  // 输出是否被截断
}
