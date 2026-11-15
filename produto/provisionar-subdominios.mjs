// Publica o subdomínio de cada escola (<nome>.thayruan.com.br): lê os clientes na Central, grava os domínios no wrangler.toml e faz o deploy.
// O Cloudflare cria o registro DNS e o certificado de cada domínio. Rode sempre que fechar uma escola nova:
//   node provisionar-subdominios.mjs https://esporte.thayruan.com.br <senha-do-dono>
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
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
const clientes = await api('GET', '/api/admin/clientes');
const slug = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'escola';
const ok = (u) => /^https:\/\/[a-z0-9-]+\.thayruan\.com\.br$/.test(u || '');
const usados = new Set(clientes.filter((c) => ok(c.url_sistema)).map((c) => c.url_sistema));
for (const c of clientes) {
  if (ok(c.url_sistema) || (c.url_sistema && !/\.example\./.test(c.url_sistema))) continue; // endereço próprio do cliente fica como está
  let u, i = 1; do { u = `https://${slug(c.escola)}${i > 1 ? '-' + i : ''}.thayruan.com.br`; i++; } while (usados.has(u));
  usados.add(u); c.url_sistema = u;
  await api('PATCH', `/api/admin/clientes/${c.id}`, { url_sistema: u });
  console.log('subdomínio definido:', c.escola, '->', u);
}
const hosts = [...new Set(clientes.map((c) => c.url_sistema).filter(ok).map((u) => u.slice(8)))].sort();
const f = new URL('./wrangler.toml', import.meta.url);
const bloco = `# >>> escolas (gerado por provisionar-subdominios.mjs; não edite)\n${hosts.map((h) => `[[routes]]\npattern = "${h}"\ncustom_domain = true\n`).join('\n')}# <<< escolas`;
let t = readFileSync(f, 'utf8');
t = /# >>> escolas[\s\S]*# <<< escolas/.test(t) ? t.replace(/# >>> escolas[\s\S]*# <<< escolas/, bloco) : t.replace('[[routes]]\npattern = "esporte.thayruan.com.br"\ncustom_domain = true\n', (m) => m + '\n' + bloco + '\n');
writeFileSync(f, t);
console.log(`${hosts.length} subdomínio(s): ${hosts.join(', ')}`);
execSync('npx wrangler deploy', { stdio: 'inherit', cwd: new URL('.', import.meta.url) });
