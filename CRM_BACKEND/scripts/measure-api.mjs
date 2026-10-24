// Opt-in live diagnostics: authenticates normally, then only performs GETs.
// Credentials/tokens and response records are never printed or saved.
const base = process.env.CRM_DIAGNOSTIC_URL;
if (!base || !process.env.CRM_DIAGNOSTIC_PASSWORD)
  throw new Error('Set CRM_DIAGNOSTIC_URL, CRM_DIAGNOSTIC_EMAIL and CRM_DIAGNOSTIC_PASSWORD');
const started = Date.now();
const auth = await fetch(`${base}/user/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.CRM_DIAGNOSTIC_EMAIL, password: process.env.CRM_DIAGNOSTIC_PASSWORD }),
  signal: AbortSignal.timeout(45000),
});
const login = await auth.json();
console.log(JSON.stringify({ step: 'login', status: auth.status, ms: Date.now() - started }));
const token = login.token || login.user?.token;
if (!auth.ok || !token) throw new Error('Login did not return a valid session');
const month = new Date().toISOString().slice(0, 7);
for (const path of ['/dashboard/summary', `/hrm/bootstrap?month=${month}&section=dashboard&page=1`, '/leads-management/bootstrap?page=1&limit=100']) {
  const start = Date.now();
  try {
    const response = await fetch(`${base}${path}`, { headers: { Authorization: token }, signal: AbortSignal.timeout(55000) });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {}
    console.log(JSON.stringify({ path, status: response.status, ms: Date.now() - start, bytes: text.length, bookings: data?.summary?.totalBookings, message: data?.message }));
  } catch (error) {
    console.log(JSON.stringify({ path, ms: Date.now() - start, error: error.message }));
  }
}
