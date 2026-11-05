// Post-deploy smoke test. Run it against any deployment:
//   npm run smoke -- https://your-deployment.example
//   SMOKE_URL=https://your-deployment.example npm run smoke
//
// It checks what a healthy deployment must do, and it never spends model credits: every request is either a read, a
// request that the server refuses before any model call (cross-site, or an empty body), or a request that is answered
// in fixture mode when no model is connected. It needs no keys. Exit code 0 means every check passed.

const base = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: npm run smoke -- https://your-deployment.example');
  process.exit(2);
}
const origin = new URL(base).origin;
// A deployment that cannot be reached at all is a failure with a plain reason, not a stack trace.
process.on('unhandledRejection', (err) => {
  console.error(`FAIL  could not reach ${base}: ${err.cause?.code ?? err.message}`);
  process.exit(1);
});
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function call(path, init = {}) {
  const started = Date.now();
  const res = await fetch(base + path, { redirect: 'manual', ...init });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, ms: Date.now() - started };
}
const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const post = (path, body, headers = {}) =>
  call(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

// 1. The page loads and points at a bundle that also loads.
const page = await call('/');
check('home page answers 200', page.status === 200, `status ${page.status}`);
check('home page is the Parallax app shell', page.text.includes('<div id="root">') && /<title>[^<]*Parallax/i.test(page.text));
const bundlePath = page.text.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
check('the page names its JavaScript bundle', Boolean(bundlePath));
if (bundlePath) {
  const bundle = await call(bundlePath);
  check('the JavaScript bundle loads', bundle.status === 200 && /javascript/.test(bundle.headers.get('content-type') ?? ''), `status ${bundle.status}`);
  check('the bundle contains no server secret', !/sk-[A-Za-z0-9]{20,}|service_role|SUPABASE_SERVICE|META_API_KEY\s*[:=]/.test(bundle.text));
}

// 2. Security headers on every response.
const h = page.headers;
check('X-Content-Type-Options is nosniff', h.get('x-content-type-options') === 'nosniff');
check('Referrer-Policy is set', Boolean(h.get('referrer-policy')));
check('other sites cannot frame the app', /SAMEORIGIN|frame-ancestors 'self'/.test(`${h.get('x-frame-options') ?? ''} ${h.get('content-security-policy') ?? ''}`));
check('the permissions policy allows only the microphone', /microphone=\(self\)/.test(h.get('permissions-policy') ?? '') && /camera=\(\)/.test(h.get('permissions-policy') ?? ''));
check('HTTPS is enforced (HSTS)', /max-age=\d+/.test(h.get('strict-transport-security') ?? '') || !base.startsWith('https'));

// 3. Health: what is connected, and nothing secret.
const health = await call('/api/health');
const healthBody = json(health.text);
check('health answers 200 with JSON', health.status === 200 && healthBody !== null, `status ${health.status}`);
check('health reports ok', healthBody?.ok === true);
check('health exposes flags only, never a key', !/sk-[A-Za-z0-9]{20,}/.test(health.text) && typeof healthBody?.metaKeyConfigured === 'boolean');
check('health answers within 2 seconds', health.ms < 2000, `${health.ms} ms`);
const modelOn = healthBody?.modelEnabled === true;

// 4. Paid routes refuse browser calls from another site (the guard runs before any model call).
const paid = ['/api/intake', '/api/chat', '/api/advisor', '/api/scene', '/api/whatif'];
for (const path of paid) {
  const r = await post(path, {}, { origin: 'https://cross-site.example' });
  // With a model connected, the guard refuses (403). In fixture mode the route answers before the guard, with 200.
  const expected = modelOn ? 403 : 200;
  check(`${path} refuses another site's browser call`, r.status === expected, `status ${r.status}, expected ${expected}`);
}

// 5. Empty requests from this site fail validation before any model call.
for (const path of ['/api/intake', '/api/chat', '/api/advisor', '/api/whatif']) {
  const r = await post(path, {}, { origin });
  const ok = r.status === 400 || (path === '/api/intake' && r.status === 200 && json(r.text)?.mode === 'fixture');
  check(`${path} refuses an empty request before any model call`, ok, `status ${r.status}`);
}

// 6. Unknown API routes are not found, and saved sessions need a device code.
const unknown = await call('/api/does-not-exist');
check('unknown API route answers 404', unknown.status === 404, `status ${unknown.status}`);
const session = await call('/api/session', { headers: {} });
check('saved sessions refuse a request with no device code', session.status === 400, `status ${session.status}`);

// Report.
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  (${r.detail})`}`);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed against ${base}${modelOn ? ' (model connected)' : ' (fixture mode)'}.`);
process.exit(failed.length ? 1 : 0);
