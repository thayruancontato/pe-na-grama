// Copia os dados do emulador (escola fictícia) para o banco de uma escola no Cloudflare e cria o administrador dela.
// Uso: node scripts/demo/exportar-para-escola.mjs <central> <senha-do-dono> <subdominio> <senha-do-admin-da-escola>
const [central, senhaDono, tenant, senhaAdmin] = process.argv.slice(2);
const EMU = 'http://127.0.0.1:8089/v1/projects/demo-rumo/databases/(default)/documents';
const COLS = ['system_settings', 'rumo_ao_esporte_2026_plans', 'turmas', 'rumo_ao_esporte_2026_registrations', 'financial_payments'];
const val = (v) => {
  if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null;
  if ('timestampValue' in v) { const ms = Date.parse(v.timestampValue); return { __t: [Math.floor(ms / 1000), (ms % 1000) * 1e6] }; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return null;
};
const docs = [];
for (const col of COLS) {
  let token = '';
  do {
    const j = await (await fetch(`${EMU}/${col}?pageSize=300${token ? '&pageToken=' + token : ''}`)).json();
    for (const d of j.documents || []) docs.push({ col, id: d.name.split('/').pop(), data: Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, val(x)])) });
    token = j.nextPageToken || '';
  } while (token);
}
let cookie = '';
const api = async (p, b) => {
  const r = await fetch(central + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pg': '1', cookie }, body: JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + JSON.stringify(j)); return j;
};
await api('/api/admin/login', { senha: senhaDono });
await api('/api/admin/sys-import', { tenant, users: [{ email: 'rumoaoesporte@admin.com', password: senhaAdmin, role: 'admin' }] });
let total = { usuarios: 0, docs: 0 };
for (let i = 0; i < docs.length; i += 60) { const r = await api('/api/admin/sys-import', { tenant, docs: docs.slice(i, i + 60) }); total.docs += r.docs; }
console.log(`importado para ${tenant}: ${total.docs} documentos de ${COLS.length} coleções`);
