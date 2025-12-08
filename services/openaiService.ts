import OpenAI from 'openai';
import { DiagnosisIssue, DiffResult, SourceField, DiagnosisResult, DeterministicCheck } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data url prefix (e.g. "data:image/jpeg;base64,")
            const base64 = base64String.split(",")[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// 模型配置 - 支持不同的 baseURL
interface ModelConfig {
    id: string;
    name: string;
    description: string;
    baseURL: string;
}

// 可用的模型列表 - 统一使用 /api/v1 端点
export const AVAILABLE_MODELS: ModelConfig[] = [
    // Gemini 系列（推荐）
    {
        id: "google/gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        description: "最新预览版，多模态最强",
        baseURL: "https://zenmux.ai/api/v1"
    },
    {
        id: "google/gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "稳定版（推荐）",
        baseURL: "https://zenmux.ai/api/v1"
    },
    {
        id: "google/gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "快速版，性价比高",
        baseURL: "https://zenmux.ai/api/v1"
    },
    // OpenAI 系列（备选）
    {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "OpenAI 多模态",
        baseURL: "https://zenmux.ai/api/v1"
    },
    {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "快速轻量版",
        baseURL: "https://zenmux.ai/api/v1"
    },
];

// 默认使用 Gemini 2.5 Pro
let currentModelId = import.meta.env.VITE_OPENAI_MODEL || "google/gemini-2.5-pro";

export const getModelId = () => currentModelId;

export const setModelId = (modelId: string) => {
    currentModelId = modelId;
    console.log("Model changed to:", currentModelId);
};

// 根据模型 ID 获取对应的 client
const getClient = () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found. Please set VITE_OPENAI_API_KEY");
    }

    // 统一使用 /api/v1 端点
    const baseURL = "https://zenmux.ai/api/v1";
    console.log(`Using model: ${currentModelId}, baseURL: ${baseURL}`);

    return new OpenAI({
        apiKey: apiKey || 'dummy',
        baseURL,
        dangerouslyAllowBrowser: true
    });
};

// 解析 JSON，处理 Gemini 返回的 markdown 包裹格式
const parseJSON = (text: string): any => {
    // 先尝试直接解析
    try {
        return JSON.parse(text);
    } catch (e) {
        // 如果失败，尝试提取 ```json ... ``` 中的内容
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
        }
        // 再尝试找第一个 { 到最后一个 } 之间的内容
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            return JSON.parse(braceMatch[0]);
        }
        throw new Error('Failed to parse JSON from response');
    }
};

// ============================================
// 确定性规则检查（不依赖 GPT，100% 准确）
// ============================================
export const runDeterministicChecks = (text: string): DeterministicCheck[] => {
    const issues: DeterministicCheck[] = [];
    let idCounter = 0;

    // 1. 括号配对检查
    const brackets = [
        { open: '(', close: ')', name: '圆括号' },
        { open: '[', close: ']', name: '方括号' },
        { open: '{', close: '}', name: '花括号' },
        { open: '（', close: '）', name: '中文圆括号' },
        { open: '【', close: '】', name: '中文方括号' },
    ];

    for (const bracket of brackets) {
        const openCount = (text.match(new RegExp('\\' + bracket.open, 'g')) || []).length;
        const closeCount = (text.match(new RegExp('\\' + bracket.close, 'g')) || []).length;

        if (openCount !== closeCount) {
            // 找到不配对的位置
            let stack: number[] = [];
            let unmatchedPositions: { pos: number; char: string }[] = [];

            for (let i = 0; i < text.length; i++) {
                if (text[i] === bracket.open) {
                    stack.push(i);
                } else if (text[i] === bracket.close) {
                    if (stack.length > 0) {
                        stack.pop();
                    } else {
                        unmatchedPositions.push({ pos: i, char: bracket.close });
                    }
                }
            }
            // 剩余的开括号也是不配对的
            stack.forEach(pos => unmatchedPositions.push({ pos, char: bracket.open }));

            for (const unmatched of unmatchedPositions) {
                // 获取上下文
                const start = Math.max(0, unmatched.pos - 20);
                const end = Math.min(text.length, unmatched.pos + 20);
                const context = text.substring(start, end);

                issues.push({
                    id: `det-${idCounter++}-${Date.now()}`,
                    type: 'bracket_mismatch',
                    description: `${bracket.name}不配对：发现 "${unmatched.char}" 缺少匹配`,
                    location: `...${context}...`,
                    severity: 'high'
                });
            }
        }
    }

    // 2. 常见编码问题检查
    const encodingPatterns = [
        { pattern: /\ufffd/g, name: '替换字符（乱码）' },
        { pattern: /[\x00-\x08\x0b\x0c\x0e-\x1f]/g, name: '控制字符' },
    ];

    for (const enc of encodingPatterns) {
        const matches = text.match(enc.pattern);
        if (matches && matches.length > 0) {
            issues.push({
                id: `det-${idCounter++}-${Date.now()}`,
                type: 'encoding_error',
                description: `发现${enc.name}，共 ${matches.length} 处`,
                location: '文本中存在异常字符',
                severity: 'high'
            });
        }
    }

    return issues;
};

// ============================================
// 单步分析：OCR + 问题检测（合并原来的三步）
// ============================================
export const analyzeImageSinglePass = async (
    base64Image: string,
    mimeType: string
): Promise<{ description: string; ocrText: string; issues: DiagnosisIssue[] }> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Single-pass analysis with model:", modelId);

        const prompt = `你是资深印前QC专员，请分析这张包装设计图片。

## 任务（按顺序执行）

### 1. OCR 提取（最重要）
- 提取图片上**所有可见文字**
- 按从上到下、从左到右顺序
- 保持原样，**绝对不要修正任何内容**
- 模糊/不清晰的部分用 [?] 标记
- 包括：标题、正文、成分表、警告语、小字等

### 2. 问题检测（极其谨慎）
只报告你 **100% 确定** 的错误：
- 明显的拼写错误（必须是确定的，不是猜测）
- 括号/引号不配对
- 明显的标点问题

## ⚠️ 极其重要的原则

### 必须遵守
- **宁可漏报10个真错误，也不要误报1个正确内容**
- 如果不确定，**不要报告**
- 外语词汇（法语、西语、德语等）有特殊拼写，不要随意判断

### 绝对不要报告
- 品牌名、产品名（可能是故意的创意拼写）
- 外语专有名词
- 你不确定的任何内容
- 设计风格、布局、颜色问题

## 输出 JSON 格式
{
  "description": "一句话描述图片内容",
  "ocrText": "提取的全部文字，每个文本块换行，保持原样",
  "issues": [
    {
      "original": "包含错误的原文（20-50字），用 **双星号** 标记错误词",
      "problem": "简述问题：xxx 应为 yyy",
      "suggestion": "正确写法",
      "severity": "high/medium/low",
      "confidence": "certain/likely/possible",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}

如果没有100%确定的错误，返回空 issues 数组。这是完全正常的。`;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) {
            return { description: '', ocrText: '', issues: [] };
        }

        const parsed = parseJSON(text);

        // 处理 issues，添加 id 和格式化 box_2d
        const issues: DiagnosisIssue[] = Array.isArray(parsed.issues)
            ? parsed.issues.map((item: any, idx: number) => ({
                id: `issue-${idx}-${Date.now()}`,
                type: 'content' as const,
                original: item.original || '',
                problem: item.problem || '',
                suggestion: item.suggestion || '',
                severity: item.severity || 'medium',
                confidence: item.confidence || 'possible',
                box_2d: item.box_2d && item.box_2d.length === 4 ? {
                    ymin: item.box_2d[0],
                    xmin: item.box_2d[1],
                    ymax: item.box_2d[2],
                    xmax: item.box_2d[3]
                } : undefined
            }))
            : [];

        return {
            description: parsed.description || '',
            ocrText: parsed.ocrText || '',
            issues
        };
    } catch (error) {
        console.error("Single-pass analysis failed:", error);
        throw error;
    }
};

// Main diagnosis function - 简化为两步：AI分析 + 本地规则检查
export const diagnoseImage = async (
    base64Image: string,
    mimeType: string,
    onStepChange?: (step: number) => void
): Promise<DiagnosisResult> => {
    try {
        console.log("Starting analysis (AI → Rules)...");

        // Step 1: AI 单步分析（OCR + 问题检测）
        onStepChange?.(1);
        const aiResult = await analyzeImageSinglePass(base64Image, mimeType);
        console.log("AI analysis complete. Description:", aiResult.description);
        console.log("OCR text length:", aiResult.ocrText.length);
        console.log("AI issues found:", aiResult.issues.length);
        console.log("=== OCR提取的文字 ===\n", aiResult.ocrText, "\n=== END ===");

        // Step 2: 本地确定性规则检查（100% 准确）
        onStepChange?.(2);
        const deterministicIssues = runDeterministicChecks(aiResult.ocrText);
        console.log("Deterministic checks found:", deterministicIssues.length, "issues");

        return {
            description: aiResult.description,
            ocrText: aiResult.ocrText,
            issues: aiResult.issues,
            deterministicIssues
        };
    } catch (error) {
        console.error("Diagnosis failed:", error);
        throw error;
    }
};

export const parseSourceText = async (sourceText: string): Promise<SourceField[]> => {
    try {
        const client = getClient();
        const modelId = getModelId();

        const prompt = `
      任务：将以下包装源文本解析为结构化的键值对。
      识别类别：'content'（营销文案）、'compliance'（成分、警告）、'specs'（重量、尺寸）。

      输入文本：
      "${sourceText.substring(0, 5000)}"

      返回JSON对象，包含一个'fields'键，其值为对象数组，每个对象包含：key（项目名称，中文）、value（值）、category（分类）。

      **重要：key字段使用中文描述！**
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];
        const parsed = parseJSON(text);
        return parsed.fields || [];

    } catch (error) {
        console.error("Parsing failed:", error);
        throw error;
    }
};

// 从图片中提取产品规格信息
export const extractProductSpecs = async (base64Image: string, mimeType: string): Promise<SourceField[]> => {
    try {
        const client = getClient();
        const modelId = getModelId();

        const prompt = `
      任务：从这张包装图片中提取所有可见的产品信息，生成产品规格表。

      请提取以下类型的信息：
      - content（内容）：产品名称、品牌、描述、卖点、口号等
      - compliance（合规）：成分表、营养成分、警告语、生产日期、保质期、生产商、条形码等
      - specs（规格）：净含量、重量、尺寸、规格型号等

      返回JSON对象，包含一个'fields'键，其值为对象数组：
      {
        "fields": [
          { "key": "产品名称", "value": "xxx", "category": "content" },
          { "key": "净含量", "value": "500g", "category": "specs" },
          { "key": "配料", "value": "xxx, xxx, xxx", "category": "compliance" }
        ]
      }

      **重要：**
      1. key字段使用中文描述
      2. value保持图片上的原文
      3. 尽可能提取完整信息
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];
        const parsed = parseJSON(text);
        return parsed.fields || [];

    } catch (error) {
        console.error("Extract specs failed:", error);
        throw error;
    }
};

export const performSmartDiff = async (
    base64Image: string,
    sourceFields: SourceField[]
): Promise<DiffResult[]> => {
    try {
        const client = getClient();
        const modelId = getModelId();

        const sourceJson = JSON.stringify(sourceFields);

        const prompt = `
      任务：将包装图片上可见的文本与提供的源数据进行比对。

      源数据：${sourceJson}

      匹配规则：
      1. 严格匹配：成分、条形码（必须完全一致）。
      2. 语义匹配：描述、警告（意思必须一致）。
      3. 逻辑匹配：净重（如0.5kg与500g匹配）。

      对于源数据中的每个字段，判断它是否存在于图片上以及是否匹配。
      如果是'error'状态，用中文解释原因。
      估算文本在图片上的位置box_2d [ymin, xmin, ymax, xmax]（0-1000）。

      输出JSON格式：
      {
        "diffs": [
          { "field": "产品名称", "sourceValue": "...", "imageValue": "...", "status": "match", "matchType": "strict", "box_2d": [...], "reason": "（如有差异，用中文说明原因）" }
        ]
      }

      **重要：field和reason字段必须使用中文！**
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];

        const parsed = parseJSON(text);
        const data = parsed.diffs || parsed;

        if (!Array.isArray(data)) return [];

        return data.map((item: any, idx: number) => ({
            ...item,
            id: `diff-${idx}-${Date.now()}`,
            box_2d: item.box_2d && item.box_2d.length === 4 ? {
                ymin: item.box_2d[0],
                xmin: item.box_2d[1],
                ymax: item.box_2d[2],
                xmax: item.box_2d[3]
            } : undefined
        }));

    } catch (error) {
        console.error("Diff failed", error);
        throw error;
    }
};
