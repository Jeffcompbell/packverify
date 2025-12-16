import { Env } from './middleware/auth';
import { handleAPI } from './router';
import { createAuth } from './lib/auth';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for auth routes
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Better Auth 路由
    if (url.pathname.startsWith('/api/auth/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      try {
        const auth = createAuth(env);
        const response = await auth.handler(request);
        // Clone response to read body for debugging
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();
        // Add CORS headers to response
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        // If 500 error with empty body, add debug info
        if (response.status >= 400 && !body) {
          return new Response(JSON.stringify({ error: 'Auth error', status: response.status }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, ctx);
    }

    // SPA 路由 - 这些路由都是 React App 的路由，重定向到 /app/index.html
    const appRoutes = ['/app', '/config', '/reports', '/home', '/reset-password', '/profile'];
    if (appRoutes.some(route => url.pathname === route || url.pathname.startsWith(route + '/'))) {
      return env.ASSETS.fetch(new Request(new URL('/app/index.html', request.url), request));
    }

    try {
      // 静态资源（前端）
      const response = await env.ASSETS.fetch(request);

      // SPA fallback: 如果静态资源不存在，返回 index.html（但不对 JSON/API 请求）
      if (response.status === 404 || response.status === 500) {
        // 不对 JSON、favicon 等资源请求做 SPA fallback
        if (url.pathname.endsWith('.json') || url.pathname.endsWith('.ico')) {
          return new Response('Not found', { status: 404 });
        }
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
      }

      return response;
    } catch (error) {
      // 出错时返回 index.html（SPA fallback）
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
  }
};
