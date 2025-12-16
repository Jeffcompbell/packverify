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

  // 动态构建更新语句，只更新传入的字段
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (body.name !== undefined) {
    updates.push('name = ?');
    values.push(body.name);
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    values.push(body.status);
  }
  if (body.processedImages !== undefined) {
    updates.push('processed_images = ?');
    values.push(body.processedImages);
  }

  values.push(reportId, uid);

  await env.DB.prepare(
    `UPDATE batch_reports SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

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

// 获取批量报告图片数据（base64）
export async function handleGetReportImageData(request: Request, env: Env, uid: string, reportId: string, imageId: string): Promise<Response> {
  // 验证报告属于当前用户
  const report = await env.DB.prepare('SELECT * FROM batch_reports WHERE id = ? AND user_id = ?').bind(reportId, uid).first();
  if (!report) {
    return new Response(JSON.stringify({ error: 'Report not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 获取图片记录
  const image = await env.DB.prepare('SELECT * FROM batch_report_images WHERE id = ? AND report_id = ?').bind(imageId, reportId).first() as any;
  if (!image) {
    return new Response(JSON.stringify({ error: 'Image not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 从 R2 获取图片
  const obj = await env.IMAGES.get(image.storage_key);
  if (!obj) {
    return new Response(JSON.stringify({ error: 'Image data not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const imageData = await obj.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageData)));
  const mimeType = obj.httpMetadata?.contentType || 'image/png';

  return new Response(JSON.stringify({ base64, mimeType }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 触发批量分析（已废弃，分析逻辑移到前端）
// 保留此接口用于兼容，实际分析由前端并行调用 AI 完成
export async function handleAnalyzeReport(request: Request, env: Env, uid: string, reportId: string, ctx?: ExecutionContext): Promise<Response> {
  const now = Date.now();

  // 更新报告状态为 processing
  await env.DB.prepare(
    'UPDATE batch_reports SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind('processing', now, reportId, uid).run();

  return new Response(JSON.stringify({ success: true, message: '状态已更新' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
