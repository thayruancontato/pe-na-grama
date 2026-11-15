// Republica o endereço de TODAS as escolas pela API do Cloudflare (via Central). Normalmente não é preciso rodar:
// o endereço é publicado sozinho quando a escola assina. Use para reparar (ex.: domínio removido por engano):
//   node provisionar-subdominios.mjs https://esporte.thayruan.com.br <senha-do-dono>
// IMPORTANTE: o wrangler.toml NÃO lista domínios de propósito. Com [[routes]] no arquivo, cada `wrangler deploy` apaga
// os domínios que não estão nele (testado: o domínio criado pela API caiu com erro 530). Sem rotas no arquivo, o deploy os preserva.
const [base, senha] = process.argv.slice(2);
if (!base || !senha) { console.error('Uso: node provisionar-subdominios.mjs <endereço-da-central> <senha-do-dono>'); process.exit(1); }
let cookie = '';
const api = async (m, p, b) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', 'x-pg': '1', cookie }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
};
await api('POST', '/api/admin/login', { senha });
const ok = (u) => /^https:\/\/[a-z0-9-]+\.thayruan\.com\.br$/.test(u || '');
for (const c of await api('GET', '/api/admin/clientes')) {
  if (!ok(c.url_sistema)) { console.log('pulado (sem subdomínio thayruan):', c.escola); continue; }
  const r = await api('POST', `/api/admin/clientes/${c.id}/publicar`, {});
  console.log(r.ok ? 'publicado:' : 'FALHOU:', c.url_sistema, r.ok ? '' : r.motivo);
}
