import { Env } from '../middleware/auth';

export async function handleCreateReport(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();
  const reportId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO batch_reports (id, user_id, name, config_id, status, total_images, processed_images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(reportId, uid, body.name, body.configId || null, 'pending', body.totalImages || 0, 0, now, now).run();

  const report = await env.DB.prepare('SELECT * FROM batch_reports WHERE id = ?').bind(reportId).first();

  return new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleListReports(request: Request, env: Env, uid: string): Promise<Response> {
  const reports = await env.DB.prepare('SELECT * FROM batch_reports WHERE user_id = ? ORDER BY updated_at DESC').bind(uid).all();

  return new Response(JSON.stringify(reports.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetReport(request: Request, env: Env, uid: string, reportId: string): Promise<Response> {
  const report = await env.DB.prepare('SELECT * FROM batch_reports WHERE id = ? AND user_id = ?').bind(reportId, uid).first();

  if (!report) {
    return new Response(JSON.stringify({ error: 'Report not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const images = await env.DB.prepare('SELECT * FROM batch_report_images WHERE report_id = ? ORDER BY created_at ASC').bind(reportId).all();

  return new Response(JSON.stringify({ ...report, images: images.results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleUpdateReport(request: Request, env: Env, uid: string, reportId: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE batch_reports SET name = ?, status = ?, processed_images = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(body.name, body.status, body.processedImages, now, reportId, uid).run();

  const report = await env.DB.prepare('SELECT * FROM batch_reports WHERE id = ?').bind(reportId).first();

  return new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleDeleteReport(request: Request, env: Env, uid: string, reportId: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM batch_reports WHERE id = ? AND user_id = ?').bind(reportId, uid).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleAddReportImage(request: Request, env: Env, uid: string, reportId: string): Promise<Response> {
  const contentType = request.headers.get('Content-Type') || '';
  const now = Date.now();
  const imageId = crypto.randomUUID();

  let storageKey = '';

  // 支持 FormData 文件上传
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 上传到 R2
    storageKey = `batch-reports/${reportId}/${imageId}`;
    await env.IMAGES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
  }

  // 插入数据库
  await env.DB.prepare(
    'INSERT INTO batch_report_images (id, report_id, image_id, storage_key, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(imageId, reportId, imageId, storageKey, 'pending', null, now).run();

  // 更新报告的 total_images
  await env.DB.prepare(
    'UPDATE batch_reports SET total_images = total_images + 1, updated_at = ? WHERE id = ?'
  ).bind(now, reportId).run();

  return new Response(JSON.stringify({ imageId, storageKey }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleUpdateReportImage(request: Request, env: Env, uid: string, reportId: string, imageId: string): Promise<Response> {
  const body = await request.json() as any;

  await env.DB.prepare(
    'UPDATE batch_report_images SET status = ?, result = ? WHERE id = ? AND report_id = ?'
  ).bind(body.status, body.result ? JSON.stringify(body.result) : null, imageId, reportId).run();

  const image = await env.DB.prepare('SELECT * FROM batch_report_images WHERE id = ?').bind(imageId).first();

  return new Response(JSON.stringify(image), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 触发批量分析
export async function handleAnalyzeReport(request: Request, env: Env, uid: string, reportId: string): Promise<Response> {
  const body = await request.json() as any;
  const { prompt } = body;
  const now = Date.now();

  // 更新报告状态为 processing
  await env.DB.prepare(
    'UPDATE batch_reports SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind('processing', now, reportId, uid).run();

  // 获取所有待处理的图片
  const images = await env.DB.prepare(
    'SELECT * FROM batch_report_images WHERE report_id = ? AND status = ?'
  ).bind(reportId, 'pending').all();

  // 逐个分析图片
  for (const img of images.results as any[]) {
    try {
      // 从 R2 获取图片
      const obj = await env.IMAGES.get(img.storage_key);
      if (!obj) continue;

      const imageData = await obj.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageData)));
      const mimeType = obj.httpMetadata?.contentType || 'image/png';

      // 调用 AI 分析
      const aiResponse = await fetch(env.AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.AI_MODEL || 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt || '请分析这张图片，检查是否存在文字错误、排版问题或其他质量问题。以JSON格式返回：{"issues": [{"type": "类型", "problem": "问题描述", "suggestion": "建议"}]}' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          max_tokens: 1000
        })
      });

      const aiResult = await aiResponse.json() as any;
      const content = aiResult.choices?.[0]?.message?.content || '{}';

      // 解析结果
      let result = { issues: [] };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        result = { issues: [{ type: '解析错误', problem: content, suggestion: '' }] };
      }

      // 更新图片状态
      await env.DB.prepare(
        'UPDATE batch_report_images SET status = ?, result = ? WHERE id = ?'
      ).bind('completed', JSON.stringify(result), img.id).run();

      // 更新已处理数量
      await env.DB.prepare(
        'UPDATE batch_reports SET processed_images = processed_images + 1, updated_at = ? WHERE id = ?'
      ).bind(Date.now(), reportId).run();

    } catch (error: any) {
      await env.DB.prepare(
        'UPDATE batch_report_images SET status = ?, result = ? WHERE id = ?'
      ).bind('failed', JSON.stringify({ error: error.message }), img.id).run();
    }
  }

  // 更新报告状态为 completed
  await env.DB.prepare(
    'UPDATE batch_reports SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('completed', Date.now(), reportId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
