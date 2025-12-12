# PackVerify 图片识别 Prompt 逻辑文档

## 概述

本项目使用 AI 视觉模型（Gemini 3 Pro / GPT-5.1）对包装设计图片进行 OCR 提取、问题检测和规格提取。

---

## 1. 快速预检 (quickCheckImage)

**用途**：判断图片是否为包装设计相关图片

**Prompt**：
```
请快速判断这张图片是否是商品包装设计相关图片。

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
- 不确定时优先返回 true（宁可漏判，不可误判）
```

**参数**：
- `max_tokens`: 100
- `detail`: "low"（低精度加快速度）
- `timeout`: 15秒

---

## 2. 轻量级 OCR (extractOcrOnly)

**用途**：仅提取图片中的文字（用于 QIL 对比）

**Prompt**：
```
提取图片中的所有文字，按原样输出，保持换行。
返回JSON格式：
{
  "text": "提取的文字内容"
}
```

**参数**：
- `max_tokens`: 2000
- `temperature`: 0.1
- `detail`: "high"

---

## 3. 单步分析 (analyzeImageSinglePass)

**用途**：OCR + 问题检测 + 规格提取（一次 API 调用完成）

### 3.1 包含 OCR 原文的 Prompt

```
分析{行业名称}包装图片，返回JSON：
{
  "description": "一句话描述",
  "ocrText": "提取所有文字，换行分隔",
  "issues": [{"original": "错误原文", "problem": "问题", "suggestion": "建议", "severity": "high/medium/low"}],
  "specs": [{"key": "项目名", "value": "值", "category": "content/compliance/specs"}]
}

要求：
1. OCR提取所有文字
2. 检查{行业名称}行业错误（100%确定才报告）：
   {行业检查项列表}
示例：{行业示例}
如无错误返回空数组[]
3. 提取specs：品名、成分、警告、净含量等
```

### 3.2 不包含 OCR 原文的 Prompt

```
分析{行业名称}包装图片，返回JSON（无需OCR原文）：
{
  "description": "一句话描述",
  "issues": [{"original": "错误原文", "problem": "问题", "suggestion": "建议", "severity": "high/medium/low"}],
  "specs": [{"key": "项目名", "value": "值", "category": "content/compliance/specs"}]
}

要求：
1. 检查{行业名称}行业错误（100%确定才报告）：
   {行业检查项列表}
示例：{行业示例}
如无错误返回空数组[]
2. 提取specs：品名、成分、警告、净含量等
```

**参数**：
- `max_tokens`: 4500（含OCR）/ 4000（不含OCR）
- `temperature`: 0.1
- `detail`: "high"

---

## 4. 行业检查规则配置

### 4.1 化妆品 (cosmetics)

**检查项**：
1. INCI 成分名称拼写（如 Ceteareth-25, Glycerin）
2. 功效宣称合规性（不得宣称医疗功效）
3. 警示用语（如"请置于儿童接触不到的地方"）
4. 生产许可证号格式
5. 净含量单位（ml/g）
6. 保质期/限期使用日期格式
7. 过敏原标注

**示例**：
- Cetareth-25 → Ceteareth-25
- 美白祛斑 → 需符合特殊化妆品要求
- 500ML → 500ml

### 4.2 食品 (food)

**检查项**：
1. 配料表顺序（按含量递减）
2. 过敏原标注（如含麸质、花生）
3. 营养成分表格式（能量、蛋白质等）
4. QS/SC 生产许可证号
5. 贮存条件
6. 生产日期/保质期格式
7. 添加剂使用规范

**示例**：
- 配料未按含量排序
- 缺少"含麸质"警告
- 营养成分表缺少钠含量

### 4.3 药品 (pharma)

**检查项**：
1. 药品批准文号格式
2. 通用名/商品名规范
3. 适应症/功能主治表述
4. 用法用量准确性
5. 禁忌症/注意事项
6. 不良反应说明
7. 贮藏条件
8. 有效期格式

**示例**：
- 国药准字格式错误
- 禁忌症缺失
- 用法用量模糊

### 4.4 通用 (general)

**检查项**：
1. 拼写错误
2. 标点错误（中英文混用、多余空格）
3. 语法错误（主谓不一致、缺字漏字）
4. 格式错误（日期格式、单位错误）

**示例**：
- 中文后使用英文逗号
- 日期格式不统一

---

## 5. 确定性规则检查 (runDeterministicChecks)

**用途**：本地规则检查，不依赖 AI，100% 准确

### 5.1 括号配对检查

检查以下括号是否配对：
- `()` 圆括号
- `[]` 方括号
- `{}` 花括号
- `（）` 中文圆括号
- `【】` 中文方括号

### 5.2 编码问题检查

- `\ufffd` 替换字符（乱码）
- 控制字符 `[\x00-\x08\x0b\x0c\x0e-\x1f]`

---

## 6. 源文本解析 (parseSourceText)

**用途**：将包装源文本解析为结构化键值对

**Prompt**：
```
任务：将以下包装源文本解析为结构化的键值对。
识别类别：'content'（营销文案）、'compliance'（成分、警告）、'specs'（重量、尺寸）。

输入文本：
"{sourceText}"

返回JSON对象，包含一个'fields'键，其值为对象数组，每个对象包含：key（项目名称，中文）、value（值）、category（分类）。

**重要：key字段使用中文描述！**
```

---

## 7. 产品规格提取 (extractProductSpecs)

**用途**：从图片中提取产品规格信息

**Prompt**：
```
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
```

---

## 8. 智能对比 (performSmartDiff)

**用途**：将包装图片上的文本与源数据进行比对

**Prompt**：
```
任务：将包装图片上可见的文本与提供的源数据进行比对。

源数据：{sourceJson}

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
```

---

## 9. QIL 图片解析 (parseQILImage)

**用途**：从 QIL（质量检验清单）截图中提取产品规格信息

**Prompt**：
```
你是专业的包装规格数据提取专家。请从这张 QIL（质量检验清单）截图中提取所有产品规格信息。

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
4. 如果是表格，按行提取每个字段
```

---

## 10. 自定义提示词分析 (analyzeImageWithCustomPrompt)

**用途**：使用用户自定义的提示词分析图片

**Prompt 模板**：
```
{customPrompt}

返回JSON格式：
{
  "description": "一句话描述",
  "ocrText": "提取所有文字，换行分隔",  // 仅当 includeOcr=true
  "issues": [{"original": "错误原文", "problem": "问题", "suggestion": "建议", "severity": "high/medium/low"}],
  "specs": [{"key": "项目名", "value": "值", "category": "content/compliance/specs"}]
}
```

---

## 11. 批量汇总报告 (generateBatchSummary)

**用途**：生成批量检测结果的汇总报告

**Prompt**：
```
基于以下批量检测结果，生成一份简洁的汇总报告（中文）：

{summaryData}

报告应包括：
1. 总体统计（总图片数、总问题数、严重程度分布）
2. 主要问题类型和频率
3. 建议改进措施

请用Markdown格式返回，简洁明了。
```

**参数**：
- `max_tokens`: 1000
- `temperature`: 0.3

---

## 数据结构

### DiagnosisIssue
```typescript
{
  id: string;
  type: 'content';
  original: string;      // 错误原文
  problem: string;       // 问题描述
  suggestion: string;    // 修改建议
  severity: 'high' | 'medium' | 'low';
  confidence: 'likely' | 'possible';
  box_2d?: { ymin, xmin, ymax, xmax };  // 位置坐标
}
```

### SourceField
```typescript
{
  key: string;           // 项目名（中文）
  value: string;         // 值
  category: 'content' | 'compliance' | 'specs';
}
```

### DiffResult
```typescript
{
  id: string;
  field: string;         // 字段名
  sourceValue: string;   // 源数据值
  imageValue: string | null;  // 图片中的值
  status: 'match' | 'warning' | 'error';
  matchType: 'strict' | 'semantic' | 'logic';
  reason?: string;       // 差异原因
  box_2d?: { ymin, xmin, ymax, xmax };
}
```

---

## 模型配置

| 模型 ID | 名称 | API 端点 |
|---------|------|----------|
| gemini-3-pro-preview | Gemini 3 Pro | https://api-slb.packyapi.com/v1 |
| gpt-5.1 | GPT-5.1 | https://api-slb.packyapi.com/v1 |

**备用端点**：https://zenmux.ai/api/v1（使用 google/gemini-2.5-pro）
