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
  const body = await request.json() as any;
  const now = Date.now();
  const imageId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO batch_report_images (id, report_id, image_id, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(imageId, reportId, body.imageId, body.status || 'pending', body.result ? JSON.stringify(body.result) : null, now).run();

  const image = await env.DB.prepare('SELECT * FROM batch_report_images WHERE id = ?').bind(imageId).first();

  return new Response(JSON.stringify(image), {
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
