import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

// Dados REAIS da escola original que estão escritos no código (CNPJ, endereço, e-mail, telefone, foro)
// e arquivos dela em public/. No sistema das outras escolas nada disso pode aparecer:
// o texto vira um campo a preencher e os arquivos nem entram no build.
const DADOS_ANTIGOS: [RegExp, string][] = [
  [/60\.642\.277\/0001-40/g, '[CNPJ DA ESCOLA]'],
  [/Av(?:enida|\.) Cota Emerick[^'"<|]*?(?:36\.972-000|Martins Soares\/MG)/g, '[ENDEREÇO DA ESCOLA]'],
  [/36\.972-000/g, '[CEP DA ESCOLA]'],
  [/rumoaoesporte@gmail\.com/g, '[E-MAIL DA ESCOLA]'],
  [/\(33\) 9978-6088/g, '[TELEFONE DA ESCOLA]'],
  [/\+55 33 8414-40\d\d/g, '[TELEFONE DA ESCOLA]'],
  [/Martins Soares\/MG/g, '[CIDADE/UF]'],
  [/Manhumirim\/MG/g, '[CIDADE/UF]'],
  [/5533998200546/g, '5531999990000'], // número de WhatsApp de uma pessoa usado como exemplo/teste
  [/https:\/\/evolution-api-im3d\.onrender\.com/g, ''], // servidor de WhatsApp da escola original
]
const NOME_RE = /Rumo ao Esporte(?: e ao Lazer\s*[-–]\s*REAL)?(?: 2026)?/g
const NOME_RT = "${(globalThis as any).__MARCA__?.nome ?? 'Escola'}"
const ARQUIVOS_ANTIGOS = ['assinatura-associacao.png', 'estatuto-social-real.pdf', 'timbrado-real.jpg', 'horarios-natacao.jpeg', 'aniversario.png',
  'carteirinha.png', 'carteirinha-arena.png', 'verso-carteirinha.png', 'real-logo-transparente.svg', 'patrocinadores', 'rumo-ao-esporte-logo.png', 'logo-dashboard.png', 'pwa']

const semDadosDaEscolaAntiga = (outDir: string): Plugin => ({
  name: 'sem-dados-da-escola-antiga',
  enforce: 'pre',
  transform(code, id) {
    if (!id.split(String.fromCharCode(92)).join('/').includes('/src/') || !/[.](tsx?|jsx?)$/.test(id)) return null
    let out = code
    // lista fixa de patrocinadores (comércios reais, com telefone) da escola original: fora do sistema das outras
    if (id.split(String.fromCharCode(92)).join('/').endsWith('/src/data/sponsors.ts')) out = out.replace(/export const sponsors: Sponsor\[\] = \[[\s\S]*?\n\];/, 'export const sponsors: Sponsor[] = [];')
    for (const [re, novo] of DADOS_ANTIGOS) out = out.replace(re, novo)
    // O nome antigo do sistema, em textos de código (mensagens de WhatsApp, PDFs, recibos), vira o nome da escola em tempo de execução.
    if (!id.split(String.fromCharCode(92)).join('/').endsWith('/src/shim/marca.ts') && /Rumo ao Esporte/.test(out)) {
      // atributo JSX (alt="...") é consumido sem mudar, para o par de aspas não se desencontrar; o DOM (marca.ts) cuida desses
      out = out.replace(/(['"])((?:(?!\1)[^\\\n`])*)\1/g, (lit, _q, corpo, pos, todo) => (!(todo[pos - 1] === '=' && /[\w-]/.test(todo[pos - 2] || '')) && /Rumo ao Esporte/.test(corpo) ? '`' + corpo.replace(NOME_RE, NOME_RT) + '`' : lit))
      out = out.split('\n').map((linha) => linha.split('`').map((trecho, i) => (i % 2 === 1 ? trecho.replace(NOME_RE, NOME_RT) : trecho)).join('`')).join('\n')
    }
    return out === code ? null : { code: out, map: null }
  },
  closeBundle() {
    for (const f of ARQUIVOS_ANTIGOS) fs.rmSync(path.join(outDir, f), { recursive: true, force: true })
  },
})

// `vite build --mode sem-firebase` gera o sistema da escola para o Cloudflare (produto/escola/):
// o "firebase/*" é trocado por src/shim/core.ts, que conversa com as rotas /sys/* do Worker.
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const semFirebase = mode === 'sem-firebase'
  const outDir = 'produto/escola'
  return {
    plugins: [react(), ...(semFirebase ? [semDadosDaEscolaAntiga(outDir)] : [])],
    base: semFirebase ? '/escola/' : '/',
    resolve: semFirebase
      ? { alias: [{ find: /^firebase\/(app|auth|firestore|analytics|storage)$/, replacement: path.resolve(__dirname, 'src/shim/core.ts') }] }
      : {},
    build: semFirebase ? { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, rollupOptions: { output: { entryFileNames: 'assets/s-[name]-[hash].js', chunkFileNames: 'assets/s-[name]-[hash].js', assetFileNames: 'assets/s-[name]-[hash][extname]' } } } : {},
  }
})
