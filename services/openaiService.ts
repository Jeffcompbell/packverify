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

export const diagnoseImage = async (base64Image: string, mimeType: string): Promise<DiagnosisResult> => {
    try {
        const client = getClient();
        const modelId = "openai/gpt-4o";

        const prompt = `
      角色：资深印前专家和包装QC专员。
      任务：对这张包装设计图片进行严格的8点"印前飞行检查"。

      **首先**：用一句话简洁描述这张图片的内容（如：这是一款xxx品牌的xxx产品包装，展示了xxx）。

      然后检查以下8个具体类别：
      1. 文件设置：版面问题、视觉层级、潜在图层错误。
      2. 字体/版权：识别看起来像系统字体（Arial/SimSun/宋体/黑体）可能未转曲的文本，或非常小（<5pt）可能印刷不清晰的文本。
      3. 图像质量：寻找像素化、低分辨率位图或表示缺少嵌入的水印痕迹。
      4. 颜色设置：关键 - 识别可能是"四色黑"（CMYK）而不是"单色黑"（K100）的小黑字。这会导致套准问题。
      5. 出血/边距：检查文字/标志是否太靠近边缘（安全区域违规）或出血区域是否缺失。
      6. 内容/校对：**重点检查以下常见印刷文字错误**：
         - 错别字：形近字混淆（如"已/己/巳"、"戊/戌/戍"、"未/末"、"折/拆"）
         - 同音字错误：如"这里/这理"、"以后/已后"、"做/作"、"的/地/得"
         - 标点符号错误：中英文标点混用、缺少标点、标点位置错误
         - 数字错误：日期、重量、价格等数字是否合理
         - 拼写错误：英文单词拼写、品牌名拼写
         - 重复文字：同一词语意外重复（如"的的"、"了了"）
         - 漏字/多字：句子不完整、多余字符
         - 断句问题：换行位置不当导致的阅读困难
         - 空格问题：缺少空格、多余空格、中英文混排空格
         - 大小写错误：专有名词首字母大小写
         - 格式不一致：同类信息格式不统一（如日期格式）
      7. 注释：刀模线（切割线）、折叠线或尺寸是否可见？是否有清晰标记？
      8. 格式：一般输出格式问题。

      **重要：所有返回内容必须使用中文！**

      返回JSON格式：
      {
        "description": "图片内容的一句话描述",
        "issues": [
          { "type": "color", "text": "成分表文字", "suggestion": "检测到可能的四色黑...", "severity": "high", "box_2d": [400, 100, 450, 300] }
        ]
      }

      type映射到：'file_setting', 'font', 'image_quality', 'color', 'bleed', 'content', 'annotation', 'format', 'compliance'
      box_2d格式：[ymin, xmin, ymax, xmax]，0-1000比例
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
        if (!text) return { description: '', issues: [] };

        const parsed = JSON.parse(text);
        const description = parsed.description || '';
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
        console.error("Diagnosis failed:", error);
        throw error;
    }
};

export const parseSourceText = async (sourceText: string): Promise<SourceField[]> => {
    try {
        const client = getClient();
        const modelId = "openai/gpt-4o";

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
        const modelId = "openai/gpt-4o";

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
        const modelId = "openai/gpt-4o";

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
