// Número que recebe os pedidos de teste (formato wa.me: DDI+DDD+número). Troque aqui.
const WHATSAPP_VENDAS = '5533998200546';

const TEMPLATES = {
  lembrete: 'Olá, {responsavel}! Aqui é da *{escola}*. Passando para lembrar que a mensalidade de *{aluno}* vence no dia {vencimento} (R$ {valor}). Pague pelo Pix abaixo e pronto! 💚',
  atraso: 'Olá, {responsavel}! Consta na *{escola}* uma mensalidade de *{aluno}* em aberto desde {vencimento} (R$ {valor}). Se já pagou, é só enviar o comprovante por aqui.',
  aniversario: 'Parabéns, {aluno}! 🎉 Toda a equipe da *{escola}* deseja um dia incrível e muito esporte pela frente!',
  boasvindas: 'Seja bem-vindo(a) à *{escola}*, {responsavel}! A matrícula de *{aluno}* foi confirmada. Acesse o portal para ver horários e a carteirinha.',
};
const SAMPLE = { responsavel: 'Carla', aluno: 'Pedro', vencimento: '10/12', valor: '120,00' };

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// {var} -> valor; *negrito* -> <b>
function renderMsg(tpl, escola) {
  const v = { ...SAMPLE, escola: escola || 'Sua Escola' };
  return esc(tpl.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m)).replace(/\*([^*]+)\*/g, '<b>$1</b>');
}
const initials = n => (n || 'E').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function setBrand(hex) { document.documentElement.style.setProperty('--brand', hex); }
function avatar(el, nome, logo) { el.innerHTML = logo ? `<img src="${logo}" alt="">` : initials(nome); }
const PIX = '<div class="pix">💠 Pix copia e cola<br><small>00020126…5204000053039865802BR</small></div>';
