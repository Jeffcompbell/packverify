import { Env } from '../middleware/auth';

export async function handleUploadImage(request: Request, env: Env, uid: string): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const sessionId = formData.get('sessionId') as string;
  const fileName = formData.get('fileName') as string;

  if (!file || !sessionId || !fileName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const imageId = crypto.randomUUID();
  const storagePath = `${uid}/${sessionId}/${imageId}`;

  // 上传到 R2
  await env.IMAGES.put(storagePath, file.stream(), {
    httpMetadata: {
      contentType: file.type
    }
  });

  const now = Date.now();

  // 保存到 D1
  await env.DB.prepare(
    'INSERT INTO images (id, session_id, user_id, file_name, mime_type, storage_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(imageId, sessionId, uid, fileName, file.type, storagePath, now, now).run();

  // 更新会话的图片数量
  await env.DB.prepare(
    'UPDATE sessions SET image_count = image_count + 1, updated_at = ? WHERE id = ?'
  ).bind(now, sessionId).run();

  const image = await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(imageId).first();

  return new Response(JSON.stringify(image), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleUpdateImage(request: Request, env: Env, uid: string, imageId: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE images SET description = ?, ocr_text = ?, specs = ?, issues = ?, deterministic_issues = ?, diffs = ?, issues_by_model = ?, status = ?, analyzing_started_at = ?, error_message = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(
    body.description || null,
    body.ocrText || null,
    body.specs ? JSON.stringify(body.specs) : null,
    body.issues ? JSON.stringify(body.issues) : null,
    body.deterministicIssues ? JSON.stringify(body.deterministicIssues) : null,
    body.diffs ? JSON.stringify(body.diffs) : null,
    body.issuesByModel ? JSON.stringify(body.issuesByModel) : null,
    body.status || 'pending',
    body.analyzingStartedAt || null,
    body.errorMessage || null,
    now,
    imageId,
    uid
  ).run();

  const image = await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(imageId).first();

  return new Response(JSON.stringify(image), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleDeleteImage(request: Request, env: Env, uid: string, imageId: string): Promise<Response> {
  const image = await env.DB.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?').bind(imageId, uid).first() as any;

  if (!image) {
    return new Response(JSON.stringify({ error: 'Image not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 从 R2 删除
  await env.IMAGES.delete(image.storage_path);

  // 从 D1 删除
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(imageId).run();

  // 更新会话的图片数量
  await env.DB.prepare(
    'UPDATE sessions SET image_count = image_count - 1, updated_at = ? WHERE id = ?'
  ).bind(Date.now(), image.session_id).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetImageData(request: Request, env: Env, uid: string, imageId: string): Promise<Response> {
  const image = await env.DB.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?').bind(imageId, uid).first() as any;

  if (!image) {
    return new Response(JSON.stringify({ error: 'Image not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 从 R2 获取图片
  const object = await env.IMAGES.get(image.storage_path);

  if (!object) {
    return new Response(JSON.stringify({ error: 'Image file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': image.mime_type,
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}
