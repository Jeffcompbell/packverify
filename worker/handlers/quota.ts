import { Env } from '../middleware/auth';

// 模型价格配置（每百万 token 的美元价格，已含 30% 利润）
// 基准：1 积分 = $0.01 成本
const MARKUP = 1.3; // 30% 利润
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // PackyAPI 模型（主要使用）
  'gemini-3-pro-preview': { input: 1.2 * MARKUP, output: 7.2 * MARKUP },
  'gpt-5.1': { input: 1.25 * MARKUP, output: 10 * MARKUP },
  // Zenmux 备用模型
  'gpt-5.2': { input: 1.75 * MARKUP, output: 14 * MARKUP },
  'gpt-5.1-zenmux': { input: 1.25 * MARKUP, output: 10 * MARKUP },
  'gemini-3-pro-preview-zenmux': { input: 2 * MARKUP, output: 12 * MARKUP },
  // 旧模型
  'gpt-4o': { input: 2.5 * MARKUP, output: 10 * MARKUP },
  'gpt-4o-mini': { input: 0.15 * MARKUP, output: 0.6 * MARKUP },
  'gemini-2.0-flash-exp': { input: 0.1 * MARKUP, output: 0.4 * MARKUP },
};

// 计算 token 成本（美元）
function calculateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o']; // 默认用 gpt-4o 价格
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export async function handleUseQuota(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;

  // 检查配额
  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first() as any;

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const billingMode = env.BILLING_MODE || 'tokens'; // 默认按 token 计费
  const creditsPerCent = parseFloat(env.CREDITS_PER_CENT || '1'); // 每美分对应多少积分，默认 1

  const tokenUsage = body.tokenUsage && typeof body.tokenUsage === 'object' ? body.tokenUsage : undefined;
  const promptTokens = Number(tokenUsage?.promptTokens ?? 0);
  const completionTokens = Number(tokenUsage?.completionTokens ?? 0);
  const model = tokenUsage?.model || 'gpt-4o';

  // 默认按 count 计费；若启用 tokens，则按实际成本换算为积分
  let debit = Number(body.count || 1);
  if (billingMode === 'tokens') {
    if (promptTokens > 0 || completionTokens > 0) {
      const costUsd = calculateTokenCost(model, promptTokens, completionTokens);
      const costCents = costUsd * 100;
      debit = Math.max(1, Math.ceil(costCents * creditsPerCent));
    } else {
      debit = Math.max(1, debit);
    }
  } else {
    debit = Math.max(1, debit);
  }

  if ((user.used + debit) > user.quota) {
    return new Response(JSON.stringify({ error: 'Quota exceeded' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const now = Date.now();
  const usageId = crypto.randomUUID();

  // 计算成本信息（用于日志）
  const costInfo = (promptTokens > 0 || completionTokens > 0)
    ? { costUsd: calculateTokenCost(model, promptTokens, completionTokens), model, billingMode, creditsPerCent }
    : { billingMode };

  // 记录使用
  await env.DB.prepare(
    'INSERT INTO quota_usage (id, user_id, type, image_name, count, timestamp, token_usage) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    usageId,
    uid,
    body.type,
    body.imageName,
    debit,
    now,
    tokenUsage ? JSON.stringify({ ...tokenUsage, ...costInfo }) : null
  ).run();

  // 更新用户配额
  await env.DB.prepare(
    'UPDATE users SET used = used + ? WHERE uid = ?'
  ).bind(debit, uid).run();

  const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();

  return new Response(JSON.stringify(updatedUser), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetQuotaHistory(request: Request, env: Env, uid: string): Promise<Response> {
  const history = await env.DB.prepare(
    'SELECT * FROM quota_usage WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100'
  ).bind(uid).all();

  return new Response(JSON.stringify(history.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}
