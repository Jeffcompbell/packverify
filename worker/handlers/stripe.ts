import { Env } from '../middleware/auth';
import Stripe from 'stripe';

// 积分包配置
const CREDIT_PACKAGES = [
  { id: 'credits_50', credits: 50, price: 1990, name: '50 积分包' },
  { id: 'credits_200', credits: 200, price: 5990, name: '200 积分包' },
  { id: 'credits_500', credits: 500, price: 12990, name: '500 积分包' },
];

function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
}

// 创建 Checkout Session
export async function handleCreateCheckout(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as { packageId: string };
  const pkg = CREDIT_PACKAGES.find(p => p.id === body.packageId);

  if (!pkg) {
    return new Response(JSON.stringify({ error: 'Invalid package' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = getStripe(env);
  const baseUrl = env.BETTER_AUTH_URL || 'https://packverify.likelinxin.workers.dev';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'alipay'],
    line_items: [{
      price_data: {
        currency: 'cny',
        unit_amount: pkg.price,
        product_data: {
          name: pkg.name,
          description: `购买 ${pkg.credits} 积分`,
          metadata: { credits: String(pkg.credits) }
        }
      },
      quantity: 1
    }],
    metadata: {
      uid,
      packageId: pkg.id,
      credits: String(pkg.credits)
    },
    success_url: `${baseUrl}/app?payment=success`,
    cancel_url: `${baseUrl}/app?payment=cancelled`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 获取积分包列表
export async function handleGetPackages(request: Request, env: Env): Promise<Response> {
  return new Response(JSON.stringify(CREDIT_PACKAGES), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Stripe Webhook 处理
export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const stripe = getStripe(env);
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const credits = parseInt(session.metadata?.credits || '0', 10);

    if (uid && credits > 0) {
      // 增加用户积分
      await env.DB.prepare(
        'UPDATE users SET quota = quota + ? WHERE uid = ?'
      ).bind(credits, uid).run();

      // 记录购买历史
      await env.DB.prepare(
        'INSERT INTO purchases (id, user_id, package_id, credits, amount, stripe_session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        crypto.randomUUID(),
        uid,
        session.metadata?.packageId,
        credits,
        session.amount_total,
        session.id,
        Date.now()
      ).run();

      console.log(`Added ${credits} credits to user ${uid}`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
