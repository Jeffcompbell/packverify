import { Env } from './middleware/auth';
import { handleAPI } from './router';
import { createAuth } from './lib/auth';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Better Auth 路由
    if (url.pathname.startsWith('/api/auth/')) {
      const auth = createAuth(env);
      return auth.handler(request);
    }

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // SPA 路由 - 这些路由都是 React App 的路由，重定向到 /app/index.html
    // /app/:productId, /config, /reports, /home 等
    const appRoutes = ['/app/', '/config', '/reports', '/home'];
    if (appRoutes.some(route => url.pathname.startsWith(route))) {
      return env.ASSETS.fetch(new Request(new URL('/app/index.html', request.url), request));
    }

    try {
      // 静态资源（前端）
      const response = await env.ASSETS.fetch(request);

      // SPA fallback: 如果静态资源不存在，返回 index.html
      if (response.status === 404 || response.status === 500) {
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
      }

      return response;
    } catch (error) {
      // 出错时返回 index.html（SPA fallback）
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
  }
};
