import OpenAI from 'openai';
import { DiagnosisIssue, DiffResult, SourceField, DiagnosisResult, DeterministicCheck, TokenUsage } from "../types";

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

// 行业检查规则配置
interface IndustryRules {
    name: string;
    checkItems: string[];
    examples: string[];
}

export const INDUSTRY_RULES: Record<string, IndustryRules> = {
    cosmetics: {
        name: '化妆品',
        checkItems: [
            'INCI 成分名称拼写（如 Ceteareth-25, Glycerin）',
            '功效宣称合规性（不得宣称医疗功效）',
            '警示用语（如"请置于儿童接触不到的地方"）',
            '生产许可证号格式',
            '净含量单位（ml/g）',
            '保质期/限期使用日期格式',
            '过敏原标注'
        ],
        examples: [
            'Cetareth-25 → Ceteareth-25',
            '美白祛斑 → 需符合特殊化妆品要求',
            '500ML → 500ml'
        ]
    },
    food: {
        name: '食品',
        checkItems: [
            '配料表顺序（按含量递减）',
            '过敏原标注（如含麸质、花生）',
            '营养成分表格式（能量、蛋白质等）',
            'QS/SC 生产许可证号',
            '贮存条件',
            '生产日期/保质期格式',
            '添加剂使用规范'
        ],
        examples: [
            '配料未按含量排序',
            '缺少"含麸质"警告',
            '营养成分表缺少钠含量'
        ]
    },
    pharma: {
        name: '药品',
        checkItems: [
            '药品批准文号格式',
            '通用名/商品名规范',
            '适应症/功能主治表述',
            '用法用量准确性',
            '禁忌症/注意事项',
            '不良反应说明',
            '贮藏条件',
            '有效期格式'
        ],
        examples: [
            '国药准字格式错误',
            '禁忌症缺失',
            '用法用量模糊'
        ]
    },
    general: {
        name: '通用',
        checkItems: [
            '拼写错误',
            '标点错误（中英文混用、多余空格）',
            '语法错误（主谓不一致、缺字漏字）',
            '格式错误（日期格式、单位错误）'
        ],
        examples: [
            '中文后使用英文逗号',
            '日期格式不统一'
        ]
    }
};

// 模型配置 - 支持不同的 baseURL
interface ModelConfig {
    id: string;
    name: string;
    description: string;
    baseURL: string;
    apiKeyEnv?: string; // 使用的 API Key 环境变量
}

// 可用的模型列表
export const AVAILABLE_MODELS: ModelConfig[] = [
    // PackyAPI Gemini（默认，使用新代理）
    {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        description: "最新版本（推荐）",
        baseURL: "https://api-slb.packyapi.com/v1",
        apiKeyEnv: "VITE_GEMINI_API_KEY"
    },
    // Zenmux Gemini 系列（备选）
    {
        id: "google/gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        description: "备用线路",
        baseURL: "https://zenmux.ai/api/v1"
    },
    {
        id: "google/gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "稳定版本",
        baseURL: "https://zenmux.ai/api/v1"
    },
    {
        id: "google/gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "快速版本",
        baseURL: "https://zenmux.ai/api/v1"
    },
    // OpenAI 系列（备选）
    {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "多模态模型",
        baseURL: "https://zenmux.ai/api/v1"
    },
];

// 默认使用 PackyAPI Gemini 3 Pro
let currentModelId = import.meta.env.VITE_OPENAI_MODEL || "gemini-3-pro-preview";

export const getModelId = () => currentModelId;

export const setModelId = (modelId: string) => {
    currentModelId = modelId;
    console.log("Model changed to:", currentModelId);
};

// 根据模型 ID 获取对应的 client
const getClient = () => {
    const modelConfig = AVAILABLE_MODELS.find(m => m.id === currentModelId);
    const baseURL = modelConfig?.baseURL || "https://api-slb.packyapi.com/v1";

    // 根据模型配置选择 API Key
    let apiKey: string;
    if (modelConfig?.apiKeyEnv === "VITE_GEMINI_API_KEY") {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    } else {
        apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    }

    if (!apiKey) {
        console.error("API Key not found");
    }

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
// 快速预检：判断是否为包装设计图片
// ============================================
export const quickCheckImage = async (
    base64Image: string,
    mimeType: string
): Promise<{ isPackaging: boolean; description: string; confidence: 'high' | 'medium' | 'low' }> => {
    const startTime = Date.now();
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log(`[QuickCheck] Starting with model: ${modelId}`);

        const prompt = `请快速判断这张图片是否是商品包装设计相关图片。

**包装设计相关内容（返回 true）：**
- 产品包装盒、瓶子、罐子、袋子
- 标签、贴纸、吊牌
- 说明书、插页、使用说明
- 包装袋、纸箱、展示盒
- **包装上的成分表、配料表、营养成分表**
- **包装上的文字信息（产品名称、警告语、说明文字等）**
- **任何印刷在包装上的文字内容**

**非包装内容（返回 false）：**
- 风景、人物、动物照片
- 建筑、街景、室内装修
- 艺术作品、插画（非包装用途）
- 纯文档、Word/PDF 截图
- 网页截图、聊天记录

返回 JSON：
{
  "isPackaging": true/false,
  "description": "一句话描述图片内容",
  "confidence": "high/medium/low"
}

**重要：**
- 只要是包装相关的文字、标签、成分表等，都返回 true
- 如果看到成分、配料、Ingredients、Directions 等字样，必定是包装
- 不确定时优先返回 true（宁可漏判，不可误判）`;

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
                                detail: "low" // 使用低精度，加快速度
                            }
                        }
                    ]
                }
            ],
            max_tokens: 100, // 限制 token 数量，节省成本
            timeout: 15000 // 15秒超时
        });

        const elapsed = Date.now() - startTime;
        console.log(`[QuickCheck] Completed in ${elapsed}ms`);

        const text = response.choices[0].message.content;
        if (!text) {
            console.warn('[QuickCheck] No response text, defaulting to packaging');
            return { isPackaging: true, description: '无法识别', confidence: 'low' };
        }

        const parsed = parseJSON(text);
        const result = {
            isPackaging: parsed.isPackaging !== false, // 默认当作包装（避免误判）
            description: parsed.description || '图片内容',
            confidence: parsed.confidence || 'medium'
        };

        console.log('[QuickCheck] Result:', result);
        return result;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[QuickCheck] Failed after ${elapsed}ms:`, error);
        // 出错时默认当作包装，继续分析
        return { isPackaging: true, description: '预检失败', confidence: 'low' };
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
// 单步分析：OCR + 问题检测 + 规格提取（一次调用完成）
// ============================================
export const analyzeImageSinglePass = async (
    base64Image: string,
    mimeType: string,
    industry: string = 'general',
    includeOcr: boolean = false  // 是否包含 OCR 原文
): Promise<{ description: string; ocrText: string; issues: DiagnosisIssue[]; specs: SourceField[]; tokenUsage?: TokenUsage }> => {
    // 性能埋点
    const perfLog: { [key: string]: number } = {};
    const overallStart = Date.now();

    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("╔══════════════════════════════════════════════════════════╗");
        console.log("║  [Performance Analysis] Single-pass Image Analysis       ║");
        console.log("╚══════════════════════════════════════════════════════════╝");
        console.log(`📊 Model: ${modelId}`);
        console.log(`🏭 Industry: ${industry}`);
        console.log(`📷 Image size: ${(base64Image.length / 1024).toFixed(2)} KB`);

        // 1. 准备 prompt
        const promptStart = Date.now();
        const rules = INDUSTRY_RULES[industry] || INDUSTRY_RULES.general;
        const checkItemsList = rules.checkItems.map((item, idx) => `   ${idx + 1}. ${item}`).join('\n');
        const examplesList = rules.examples.map(ex => `   - ${ex}`).join('\n');

        const prompt = includeOcr
            ? `分析${rules.name}包装图片，返回JSON：
{
  "description": "一句话描述",
  "ocrText": "提取所有文字，换行分隔",
  "issues": [{"original": "错误原文", "problem": "问题", "suggestion": "建议", "severity": "high/medium/low", "box_2d": [ymin,xmin,ymax,xmax]}],
  "specs": [{"key": "项目名", "value": "值", "category": "content/compliance/specs"}]
}

要求：
1. OCR提取所有文字
2. 检查${rules.name}行业错误（100%确定才报告）：
${checkItemsList}
示例：${examplesList}
如无错误返回空数组[]
3. 提取specs：品名、成分、警告、净含量等
4. box_2d坐标：[ymin,xmin,ymax,xmax]，范围0-1000，原点左上角(0,0)`
            : `分析${rules.name}包装图片，返回JSON（无需OCR原文）：
{
  "description": "一句话描述",
  "issues": [{"original": "错误原文", "problem": "问题", "suggestion": "建议", "severity": "high/medium/low", "box_2d": [ymin,xmin,ymax,xmax]}],
  "specs": [{"key": "项目名", "value": "值", "category": "content/compliance/specs"}]
}

要求：
1. 检查${rules.name}行业错误（100%确定才报告）：
${checkItemsList}
示例：${examplesList}
如无错误返回空数组[]
2. 提取specs：品名、成分、警告、净含量等
3. box_2d坐标：[ymin,xmin,ymax,xmax]，范围0-1000，原点左上角(0,0)`;

        perfLog['1_prompt_preparation'] = Date.now() - promptStart;
        console.log(`⏱️  Prompt preparation: ${perfLog['1_prompt_preparation']}ms`);

        // 2. API 调用
        const apiStart = Date.now();
        console.log(`🚀 Calling API...`);
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
            max_tokens: includeOcr ? 4500 : 2500,  // OCR模式需要更多tokens
            temperature: 0.1,
        });
        perfLog['2_api_call'] = Date.now() - apiStart;
        console.log(`⏱️  API call: ${perfLog['2_api_call']}ms`);

        // 3. 提取 token 使用信息
        const tokenStart = Date.now();
        let tokenUsage: TokenUsage | undefined;
        if (response.usage) {
            tokenUsage = {
                promptTokens: response.usage.prompt_tokens || 0,
                completionTokens: response.usage.completion_tokens || 0,
                totalTokens: response.usage.total_tokens || 0,
                model: modelId,
                timestamp: new Date()
            };
            console.log('💰 Token usage:', tokenUsage);
        }
        perfLog['3_token_extraction'] = Date.now() - tokenStart;

        // 4. 解析响应
        const parseStart = Date.now();
        const text = response.choices[0].message.content;
        if (!text) {
            console.warn('⚠️  No response text');
            return { description: '', ocrText: '', issues: [], specs: [], tokenUsage };
        }

        const parsed = parseJSON(text);
        perfLog['4_json_parsing'] = Date.now() - parseStart;
        console.log(`⏱️  JSON parsing: ${perfLog['4_json_parsing']}ms`);

        // 5. 处理 issues
        const issuesStart = Date.now();
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
        perfLog['5_issues_processing'] = Date.now() - issuesStart;

        // 6. 处理 specs
        const specsStart = Date.now();
        const specs: SourceField[] = Array.isArray(parsed.specs)
            ? parsed.specs.map((item: any) => ({
                key: item.key || '',
                value: item.value || '',
                category: item.category || 'content'
            }))
            : [];
        perfLog['6_specs_processing'] = Date.now() - specsStart;

        // 总耗时
        const totalTime = Date.now() - overallStart;
        perfLog['TOTAL'] = totalTime;

        // 输出性能报告
        console.log("\n╔══════════════════════════════════════════════════════════╗");
        console.log("║              Performance Report                           ║");
        console.log("╠══════════════════════════════════════════════════════════╣");
        Object.entries(perfLog).forEach(([step, time]) => {
            const percentage = ((time / totalTime) * 100).toFixed(1);
            console.log(`║  ${step.padEnd(25)} ${String(time).padStart(6)}ms (${percentage.padStart(5)}%)  ║`);
        });
        console.log("╚══════════════════════════════════════════════════════════╝\n");

        return {
            description: parsed.description || '',
            ocrText: parsed.ocrText || '',
            issues,
            specs,
            tokenUsage
        };
    } catch (error) {
        console.error("Single-pass analysis failed:", error);
        throw error;
    }
};

// Main diagnosis function - 单次 AI 调用 + 本地规则检查
export const diagnoseImage = async (
    base64Image: string,
    mimeType: string,
    onStepChange?: (step: number) => void,
    industry: string = 'general',
    includeOcr: boolean = false  // 是否包含 OCR 原文
): Promise<DiagnosisResult> => {
    try {
        console.log("Starting analysis (AI → Rules)...");

        // Step 1: AI 单步分析（OCR + 问题检测 + 规格提取，一次 API 调用）
        onStepChange?.(1);
        const aiResult = await analyzeImageSinglePass(base64Image, mimeType, industry, includeOcr);
        console.log("AI analysis complete. Description:", aiResult.description);
        console.log("OCR text length:", aiResult.ocrText.length);
        console.log("AI issues found:", aiResult.issues.length);
        console.log("Specs extracted:", aiResult.specs.length);
        console.log("=== OCR提取的文字 ===\n", aiResult.ocrText, "\n=== END ===");

        // Step 2: 本地确定性规则检查（100% 准确，不调用 API）
        onStepChange?.(2);
        const deterministicIssues = runDeterministicChecks(aiResult.ocrText);
        console.log("Deterministic checks found:", deterministicIssues.length, "issues");

        return {
            description: aiResult.description,
            ocrText: aiResult.ocrText,
            issues: aiResult.issues,
            deterministicIssues,
            specs: aiResult.specs,
            tokenUsage: aiResult.tokenUsage
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
            // response_format 部分代理不支持，通过 prompt 要求返回 JSON
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
            // response_format 部分代理不支持，通过 prompt 要求返回 JSON
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

      **坐标系统（重要）：**
      - box_2d 格式：[ymin, xmin, ymax, xmax]
      - 坐标范围：0-1000（归一化坐标）
      - 原点：图片左上角 (0,0)
      - x 轴：从左到右，y 轴：从上到下
      - 示例：图片中心 → [400, 400, 600, 600]

      输出JSON格式：
      {
        "diffs": [
          { "field": "产品名称", "sourceValue": "...", "imageValue": "...", "status": "match", "matchType": "strict", "box_2d": [ymin,xmin,ymax,xmax], "reason": "（如有差异，用中文说明原因）" }
        ]
      }

      **重要：field和reason字段必须使用中文！box_2d 必须准确标注文字位置！**
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
            // response_format 部分代理不支持，通过 prompt 要求返回 JSON
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

// 从 QIL 图片中提取规格数据
export const parseQILImage = async (base64Image: string, mimeType: string): Promise<SourceField[]> => {
    try {
        const client = getClient();
        const modelId = getModelId();
        console.log("Parsing QIL image with model:", modelId);

        const prompt = `你是专业的包装规格数据提取专家。请从这张 QIL（质量检验清单）截图中提取所有产品规格信息。

## 任务
分析图片，提取表格或列表中的所有产品规格字段。

## 常见 QIL 字段类型
- **content（内容）**：产品名称、品牌、描述、卖点、使用说明等
- **compliance（合规）**：成分表、配料、警告语、保质期、生产日期、批号、条形码、生产商、产地等
- **specs（规格）**：净含量、重量、尺寸、规格型号、包装规格等

## 输出要求
提取所有可见的键值对信息，返回 JSON 格式：
{
  "fields": [
    { "key": "产品名称", "value": "XXX护肤霜", "category": "content" },
    { "key": "净含量", "value": "50ml", "category": "specs" },
    { "key": "成分", "value": "水、甘油、...", "category": "compliance" }
  ]
}

## 重要
1. key 使用中文描述
2. value 保持原文，不要修改
3. 尽可能提取完整信息
4. 如果是表格，按行提取每个字段`;

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
            // response_format 部分代理不支持，通过 prompt 要求返回 JSON
        });

        const text = response.choices[0].message.content;
        if (!text) return [];

        const parsed = parseJSON(text);
        return parsed.fields || [];

    } catch (error) {
        console.error("Parse QIL image failed:", error);
        throw error;
    }
};

// 本地对比 QIL 和图片规格（不调用 API）
export const localDiffSpecs = (
    qilFields: SourceField[],
    imageSpecs: { key: string; value: string; category?: string }[]
): DiffResult[] => {
    const results: DiffResult[] = [];

    for (const qilField of qilFields) {
        // 在图片规格中查找匹配的 key
        const matchingSpec = imageSpecs.find(spec =>
            spec.key === qilField.key ||
            spec.key.includes(qilField.key) ||
            qilField.key.includes(spec.key)
        );

        if (!matchingSpec) {
            // 图片中未找到该字段
            results.push({
                id: `diff-${results.length}-${Date.now()}`,
                field: qilField.key,
                sourceValue: qilField.value,
                imageValue: null,
                status: 'error',
                matchType: 'strict',
                reason: '图片中未找到该字段'
            });
        } else {
            // 比较值
            const qilValue = qilField.value.trim().toLowerCase();
            const imgValue = matchingSpec.value.trim().toLowerCase();

            if (qilValue === imgValue) {
                // 完全匹配
                results.push({
                    id: `diff-${results.length}-${Date.now()}`,
                    field: qilField.key,
                    sourceValue: qilField.value,
                    imageValue: matchingSpec.value,
                    status: 'match',
                    matchType: 'strict'
                });
            } else if (imgValue.includes(qilValue) || qilValue.includes(imgValue)) {
                // 部分匹配
                results.push({
                    id: `diff-${results.length}-${Date.now()}`,
                    field: qilField.key,
                    sourceValue: qilField.value,
                    imageValue: matchingSpec.value,
                    status: 'warning',
                    matchType: 'semantic',
                    reason: '部分匹配，请人工确认'
                });
            } else {
                // 不匹配
                results.push({
                    id: `diff-${results.length}-${Date.now()}`,
                    field: qilField.key,
                    sourceValue: qilField.value,
                    imageValue: matchingSpec.value,
                    status: 'error',
                    matchType: 'strict',
                    reason: `值不匹配：QIL="${qilField.value}" vs 图片="${matchingSpec.value}"`
                });
            }
        }
    }

    return results;
};
