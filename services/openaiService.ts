import OpenAI from 'openai';
import { DiagnosisIssue, DiffResult, SourceField, DiagnosisResult } from "../types";

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

const getClient = () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found. Please set VITE_OPENAI_API_KEY");
    } else {
        console.log("API Key found (length):", apiKey.length);
    }
    return new OpenAI({
        apiKey: apiKey || 'dummy', // Prevent crash if key missing, will fail on request
        baseURL: "https://zenmux.ai/api/v1",
        dangerouslyAllowBrowser: true // Required for client-side usage
    });
};

// 从环境变量获取模型ID，默认为 gpt-5.1（最新最强模型）
let currentModelId = import.meta.env.VITE_OPENAI_MODEL || "openai/gpt-5.1";

export const getModelId = () => currentModelId;

export const setModelId = (modelId: string) => {
    currentModelId = modelId;
    console.log("Model changed to:", currentModelId);
};

// 可用的模型列表 - zenmux.ai 代理已测试验证
// 注意：模型ID需要使用 openai/ 前缀
export const AVAILABLE_MODELS = [
    // GPT-5.1 (2025年最新，已验证可用)
    { id: "openai/gpt-5.1", name: "GPT-5.1", description: "最新旗舰模型（推荐）" },
    // GPT-4.1 系列 (已验证可用)
    { id: "openai/gpt-4.1", name: "GPT-4.1", description: "百万上下文，长文本专家" },
    // GPT-4o 系列 (已验证可用)
    { id: "openai/gpt-4o", name: "GPT-4o", description: "多模态模型，稳定可靠" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "快速轻量版" },
];

// Step 1: Initial image analysis - GPT vision first pass
export const initialImageAnalysis = async (base64Image: string, mimeType: string): Promise<{ description: string; initialIssues: any[]; observedText: string }> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Step 1: Initial vision analysis with model:", modelId);

        const prompt = `你是资深印前QC专员，专门检查包装印刷品的文字错误。请仔细分析这张包装设计图片。

## 任务
1. 描述图片内容
2. 识别图片上的所有语言（英文、法文、中文、西班牙文等）
3. 逐字逐句列出你看到的所有文字（按语言分组）
4. 检查并标记文字错误

## 多语言检查
包装通常包含多种语言，请按各语言标准检查：
- **英文**：拼写、语法、空格
- **法文**：拼写、重音符号（é, è, ê, à, ç）
- **中文**：错别字、漏字
- **西班牙文**：拼写、重音符号

## 必须检查的错误
- 拼写错误（按各语言标准）
- 括号不配对
- 标点错误
- 空格缺失

## 不要报告
- 设计风格、布局
- 颜色、字体选择

## 输出JSON
{
  "description": "一句话描述图片",
  "observedText": "按语言分组列出所有文字，格式：[English] xxx [Français] xxx [中文] xxx",
  "initialIssues": [
    {
      "type": "content",
      "text": "[语言] 具体错误",
      "original": "原文",
      "location": "位置",
      "confidence": "high/medium/low"
    }
  ]
}

只关注文字错误，不评论设计。请返回json格式。`;

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
        if (!text) return { description: '', initialIssues: [], observedText: '' };

        const parsed = JSON.parse(text);
        return {
            description: parsed.description || '',
            initialIssues: parsed.initialIssues || [],
            observedText: parsed.observedText || ''
        };
    } catch (error) {
        console.error("Initial analysis failed:", error);
        throw error;
    }
};

// Step 2: OCR text extraction - 高精度模式
export const ocrExtractText = async (base64Image: string, mimeType: string): Promise<string> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Step 2: OCR text extraction with model:", modelId);

        const prompt = `你是专业OCR系统，请**极度精确**地提取图片中的所有文字。

## 最高优先级：准确性
- 如果某个字/词看不清楚，用 [?] 标记，例如：ingred[?]ents
- 绝对不要猜测或补全任何内容
- 宁可标记不确定，也不要输出错误内容

## 提取要求
1. 提取所有可见文字（标题、正文、小字、警告语）
2. 保持原样，不修正任何内容
3. 模糊/不清晰的部分用 [?] 标记

## 特殊字符处理
- 容易混淆的字符要仔细辨认：
  - l (小写L) vs I (大写i) vs 1 (数字1)
  - O (字母O) vs 0 (数字0)
  - rn vs m
- 如果不确定，用 [l/I/1] 这样的格式标记

## 输出格式
按从上到下、从左到右顺序输出。
每个独立文本块换行。
只输出提取的文字，不要任何解释。`;

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
            ]
        });

        return response.choices[0].message.content || '';
    } catch (error) {
        console.error("OCR extraction failed:", error);
        throw error;
    }
};

// Step 3: Final verification - combine initial analysis + OCR for definitive conclusions
export const finalVerification = async (
    initialAnalysis: { description: string; initialIssues: any[]; observedText: string },
    ocrText: string,
    base64Image: string,
    mimeType: string
): Promise<DiagnosisResult> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Step 3: Final verification with model:", modelId);

        const prompt = `你是资深印前QC终审专员。你的任务是**极度谨慎地**检查印刷品文字错误。

## 第一轮分析结果（视觉）
描述：${initialAnalysis.description}
观察文字：${initialAnalysis.observedText}
初步问题：${JSON.stringify(initialAnalysis.initialIssues, null, 2)}

## 第二轮分析结果（OCR）
${ocrText}

## ⚠️ 极其重要的验证规则

### 误报风险说明
GPT Vision 和 OCR 都可能出现识别错误，特别是：
- 小字体文字容易漏读字母
- 相似字符容易混淆（l/I/1, O/0, rn/m）
- 模糊区域容易误读

### 验证流程
1. **对比两轮结果**：如果 Vision 和 OCR 结果不一致，说明识别不可靠，**不要报告**
2. **检查 [?] 标记**：OCR 中标记为不确定的内容，**绝对不要作为错误报告**
3. **常见词检查**：如果一个"错误"看起来像是常见英文词被误读（如 intimate, ingredients, preservatives），**不要报告**
4. **多次出现验证**：如果同一个词在图片上多次出现，检查是否一致

### 只报告这些确定性错误
- 明显的拼写错误（两轮分析都确认的）
- 明显的括号不配对
- 明显的标点问题

### 绝对不要报告
- 任何只在一轮分析中发现的"错误"
- OCR 中带 [?] 标记附近的内容
- 可能是识别问题而非真正错误的内容
- 常见单词的"变体"（很可能是误读）

## 输出json格式
{
  "description": "图片内容描述",
  "issues": [
    {
      "type": "content",
      "language": "English/Français/中文",
      "original": "完整句子（20-50字），用 **双星号** 标记错误词",
      "problem": "简洁说明：xxx 应为 yyy",
      "suggestion": "正确写法",
      "severity": "high",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}

**最高原则：宁可漏报10个真错误，也不要误报1个正确内容！**
如果没有100%确定的错误，返回空 issues 数组。`;

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
        if (!text) return { description: initialAnalysis.description, issues: [] };

        const parsed = JSON.parse(text);
        const description = parsed.description || initialAnalysis.description;
        const data = parsed.issues || [];

        const issues = Array.isArray(data) ? data.map((item: any, idx: number) => ({
            ...item,
            id: `diag-${idx}-${Date.now()}`,
            box_2d: item.box_2d && item.box_2d.length === 4 ? {
                ymin: item.box_2d[0],
                xmin: item.box_2d[1],
                ymax: item.box_2d[2],
                xmax: item.box_2d[3]
            } : undefined
        })) : [];

        return { description, issues };
    } catch (error) {
        console.error("Final verification failed:", error);
        throw error;
    }
};

// Main diagnosis function - three-step process for maximum accuracy
export const diagnoseImage = async (
    base64Image: string,
    mimeType: string,
    onStepChange?: (step: number) => void
): Promise<DiagnosisResult> => {
    try {
        console.log("Starting three-step analysis (Vision → OCR → Verification)...");

        // Step 1: Initial vision analysis
        onStepChange?.(1);
        const initialAnalysis = await initialImageAnalysis(base64Image, mimeType);
        console.log("Step 1 complete. Description:", initialAnalysis.description);
        console.log("Initial issues found:", initialAnalysis.initialIssues.length);

        // Step 2: OCR text extraction
        onStepChange?.(2);
        const ocrText = await ocrExtractText(base64Image, mimeType);
        console.log("Step 2 complete. OCR text length:", ocrText.length);
        console.log("=== OCR提取的文字 ===\n", ocrText, "\n=== END ===");

        // Step 3: Final verification combining both results
        onStepChange?.(3);
        const result = await finalVerification(initialAnalysis, ocrText, base64Image, mimeType);
        console.log("Step 3 complete. Final issues:", result.issues.length);

        return result;
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
        const parsed = JSON.parse(text);
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
        const parsed = JSON.parse(text);
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
                                url: `data:image/jpeg;base64,${base64Image}`, // TODO: Should pass mimeType here too if possible, but jpeg usually works for most
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

        const parsed = JSON.parse(text);
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
