import { Env, requireAuth } from './middleware/auth';
import { handleGetUser, handleCreateOrUpdateUser } from './handlers/users';
import { handleCreateSession, handleGetSession, handleListSessions, handleUpdateSession } from './handlers/sessions';
import { handleUploadImage, handleUpdateImage, handleDeleteImage, handleGetImageData } from './handlers/images';
import { handleUseQuota, handleGetQuotaHistory } from './handlers/quota';
import { handleCreateConfig, handleListConfigs, handleGetConfig, handleUpdateConfig, handleDeleteConfig } from './handlers/detection-configs';
import { handleCreateReport, handleListReports, handleGetReport, handleUpdateReport, handleDeleteReport, handleAddReportImage, handleUpdateReportImage } from './handlers/batch-reports';

export async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User routes
    if (path === '/api/users' && method === 'POST') {
      const response = await requireAuth(handleCreateOrUpdateUser)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'GET') {
      const response = await requireAuth(handleGetUser)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    // Session routes
    if (path === '/api/sessions' && method === 'POST') {
      const response = await requireAuth(handleCreateSession)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path === '/api/sessions' && method === 'GET') {
      const response = await requireAuth(handleListSessions)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
      const sessionId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleGetSession(req, env, uid, sessionId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/sessions\/[^/]+$/) && method === 'PUT') {
      const sessionId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleUpdateSession(req, env, uid, sessionId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    // Image routes
    if (path === '/api/images' && method === 'POST') {
      const response = await requireAuth(handleUploadImage)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/images\/[^/]+$/) && method === 'PUT') {
      const imageId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleUpdateImage(req, env, uid, imageId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/images\/[^/]+$/) && method === 'DELETE') {
      const imageId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleDeleteImage(req, env, uid, imageId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/images\/[^/]+\/data$/) && method === 'GET') {
      const imageId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleGetImageData(req, env, uid, imageId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    // Quota routes
    if (path === '/api/quota/use' && method === 'POST') {
      const response = await requireAuth(handleUseQuota)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path === '/api/quota/history' && method === 'GET') {
      const response = await requireAuth(handleGetQuotaHistory)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    // Detection config routes
    if (path === '/api/detection-configs' && method === 'POST') {
      const response = await requireAuth(handleCreateConfig)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path === '/api/detection-configs' && method === 'GET') {
      const response = await requireAuth(handleListConfigs)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/detection-configs\/[^/]+$/) && method === 'GET') {
      const configId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleGetConfig(req, env, uid, configId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/detection-configs\/[^/]+$/) && method === 'PUT') {
      const configId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleUpdateConfig(req, env, uid, configId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/detection-configs\/[^/]+$/) && method === 'DELETE') {
      const configId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleDeleteConfig(req, env, uid, configId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    // Batch report routes
    if (path === '/api/batch-reports' && method === 'POST') {
      const response = await requireAuth(handleCreateReport)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path === '/api/batch-reports' && method === 'GET') {
      const response = await requireAuth(handleListReports)(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/batch-reports\/[^/]+$/) && method === 'GET') {
      const reportId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleGetReport(req, env, uid, reportId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/batch-reports\/[^/]+$/) && method === 'PUT') {
      const reportId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleUpdateReport(req, env, uid, reportId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/batch-reports\/[^/]+$/) && method === 'DELETE') {
      const reportId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleDeleteReport(req, env, uid, reportId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/batch-reports\/[^/]+\/images$/) && method === 'POST') {
      const reportId = path.split('/')[3];
      const response = await requireAuth((req, env, uid) => handleAddReportImage(req, env, uid, reportId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    if (path.match(/^\/api\/batch-reports\/[^/]+\/images\/[^/]+$/) && method === 'PUT') {
      const reportId = path.split('/')[3];
      const imageId = path.split('/')[5];
      const response = await requireAuth((req, env, uid) => handleUpdateReportImage(req, env, uid, reportId, imageId))(request, env);
      return addCorsHeaders(response, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function addCorsHeaders(response: Response, corsHeaders: Record<string, string>): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
