import { Env } from '../middleware/auth';

export async function handleCreateSession(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();
  const sessionId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, product_name, created_at, updated_at, image_count, qil_fields, qil_input_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(sessionId, uid, body.productName, now, now, 0, body.qilFields ? JSON.stringify(body.qilFields) : null, body.qilInputText || null).run();

  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();

  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetSession(request: Request, env: Env, uid: string, sessionId: string): Promise<Response> {
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').bind(sessionId, uid).first();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const images = await env.DB.prepare('SELECT * FROM images WHERE session_id = ? ORDER BY created_at ASC').bind(sessionId).all();

  return new Response(JSON.stringify({ ...session, images: images.results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleListSessions(request: Request, env: Env, uid: string): Promise<Response> {
  try {
    const sessions = await env.DB.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC').bind(uid).all();

    // 为每个 session 获取缩略图和实际图片数量
    const sessionsWithThumbnails = await Promise.all(
      (sessions.results || []).map(async (session: any) => {
        try {
          const images = await env.DB.prepare(
            'SELECT id, user_id FROM images WHERE session_id = ? ORDER BY created_at ASC LIMIT 4'
          ).bind(session.id).all();

          const imageCount = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM images WHERE session_id = ?'
          ).bind(session.id).first() as { count: number } | null;

          // 生成公开图片访问 URL
          const thumbnails = (images.results || []).map((img: any) =>
            `https://packverify.likelinxin.workers.dev/api/public/images/${img.id}`
          );

          return {
            ...session,
            image_count: imageCount?.count || 0,
            thumbnails
          };
        } catch {
          return { ...session, image_count: 0, thumbnails: [] };
        }
      })
    );

    return new Response(JSON.stringify(sessionsWithThumbnails), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUpdateSession(request: Request, env: Env, uid: string, sessionId: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE sessions SET product_name = ?, qil_fields = ?, qil_input_text = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(body.productName, body.qilFields ? JSON.stringify(body.qilFields) : null, body.qilInputText || null, now, sessionId, uid).run();

  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();

  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' }
  });
}
