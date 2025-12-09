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
    return env.ASSETS.fetch(request);
  }
};
