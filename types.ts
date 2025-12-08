
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

export interface ImageSpec {
  key: string;
  value: string;
  category: string;
}

export interface ImageItem {
  id: string;
  src: string;
  base64: string;
  file: File;
  description?: string; // 图片内容描述
  ocrText?: string;     // OCR 提取的原文（新增）
  specs: ImageSpec[];   // 图片提取的参数
  issues: DiagnosisIssue[];
  deterministicIssues?: DeterministicCheck[]; // 确定性问题（新增）
  diffs: DiffResult[];
}

// 诊断结果包含描述
export interface DiagnosisResult {
  description: string;
  ocrText: string;      // OCR 原文（新增）
  issues: DiagnosisIssue[];
  deterministicIssues: DeterministicCheck[]; // 确定性问题（新增）
}
