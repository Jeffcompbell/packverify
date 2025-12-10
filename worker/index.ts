import { Env } from './middleware/auth';
import { handleAPI } from './router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // 静态资源（前端）
    const response = await env.ASSETS.fetch(request);

    // SPA fallback: 如果静态资源不存在，返回 index.html
    if (response.status === 404 || response.status === 500) {
      const indexRequest = new Request(new URL('/', request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return response;
  }
};
