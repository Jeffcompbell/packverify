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

        const prompt = `你是资深印前QC专员，专门检查包装印刷品。请仔细分析这张包装设计图片。

## 任务
1. 描述图片内容
2. 列出你看到的所有文字内容（包括产品名、品牌、成分、日期、条码等）
3. 初步标记可能存在的问题

## 重点检查
- 英文单词是否缺少空格（如"HelloWorld"应为"Hello World"）
- 中文是否有错别字
- 标点符号是否正确
- 排版是否有问题

## 输出JSON
{
  "description": "一句话描述图片（产品类型、品牌）",
  "observedText": "按位置顺序列出图片中所有可见文字，用换行分隔",
  "initialIssues": [
    {
      "type": "content",
      "text": "可能的问题描述",
      "location": "问题在图片中的大致位置",
      "confidence": "high/medium/low"
    }
  ]
}

注意：这是第一轮分析，后续会用OCR复核。请尽可能准确识别文字和标记疑点。`;

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

// Step 2: OCR text extraction
export const ocrExtractText = async (base64Image: string, mimeType: string): Promise<string> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Step 2: OCR text extraction with model:", modelId);

        const prompt = `请作为OCR系统，精确提取这张图片中的所有文字。

要求：
1. 逐字逐词提取，保持原始格式
2. 包括所有可见文字：标题、正文、小字、条形码数字
3. 保留空格和标点符号的原始状态
4. 如果看到"HelloWorld"没有空格，就输出"HelloWorld"（不要自动加空格）
5. 按从上到下、从左到右的顺序输出

只输出提取的文字，不要任何解释或标注。`;

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

        const prompt = `你是资深印前QC终审专员。请基于两轮分析结果，给出最终结论。

## 第一轮：视觉分析结果
描述：${initialAnalysis.description}
观察到的文字：
${initialAnalysis.observedText}

初步发现的问题：
${JSON.stringify(initialAnalysis.initialIssues, null, 2)}

## 第二轮：OCR精确提取的文字
${ocrText}

## 你的任务
1. 对比两轮结果，确认哪些问题是真实存在的
2. 检查OCR文字中是否有第一轮遗漏的问题
3. 重点关注：
   - 英文单词间缺少空格（如"HelloWorld"应为"Hello World"）
   - 中文错别字
   - 中英文标点混用
   - 排版对齐问题

## 输出最终确认的问题
返回JSON格式：
{
  "description": "图片描述",
  "issues": [
    {
      "type": "content",
      "text": "确认的问题，引用原文",
      "suggestion": "修改建议",
      "severity": "high/medium/low",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}

规则：
- 只报告两轮分析都确认的问题，减少误报
- text必须引用OCR提取的原文
- 没有确认问题就返回空数组
- severity: high=严重影响印刷质量, medium=建议修改, low=轻微问题`;

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
export const diagnoseImage = async (base64Image: string, mimeType: string): Promise<DiagnosisResult> => {
    try {
        console.log("Starting three-step analysis (Vision → OCR → Verification)...");

        // Step 1: Initial vision analysis
        const initialAnalysis = await initialImageAnalysis(base64Image, mimeType);
        console.log("Step 1 complete. Description:", initialAnalysis.description);
        console.log("Initial issues found:", initialAnalysis.initialIssues.length);

        // Step 2: OCR text extraction
        const ocrText = await ocrExtractText(base64Image, mimeType);
        console.log("Step 2 complete. OCR text length:", ocrText.length);

        // Step 3: Final verification combining both results
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
