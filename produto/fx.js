// Movimento da landing: parallax em profundidade, painel que levanta com o scroll e a bola 3D (grande no topo, pequena no canto).
// Sem build; o three.js só carrega depois que a página abre. Com "reduzir movimento" tudo fica parado.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- parallax ----------
  const layers = $$('[data-speed]');
  const shot = document.querySelector('.lp-shot');
  const corner = document.getElementById('ball');
  let mx = 0, my = 0, cx = 0, cy = 0, ticking = false;
  function frame() {
    ticking = false;
    const vh = innerHeight;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      const mid = r.top + r.height / 2 - vh / 2, d = +el.dataset.depth || 0;
      el.style.transform = `translate3d(${(cx * d * 46).toFixed(1)}px,${(-mid * (el.dataset.speed || 0) + cy * d * 32).toFixed(1)}px,0) rotate(${el.dataset.rot || 0}deg)`;
    }
    if (shot) { // o painel entra deitado e levanta enquanto você rola
      const r = shot.parentElement.getBoundingClientRect(), p = clamp((vh - r.top) / (vh * .75), 0, 1), e = 1 - Math.pow(1 - p, 3);
      shot.style.transform = `perspective(1400px) rotateX(${((1 - e) * 24).toFixed(2)}deg) scale(${(.9 + .1 * e).toFixed(3)})`;
      shot.style.opacity = (.35 + .65 * e).toFixed(2);
    }
    if (corner) corner.classList.toggle('show', scrollY > vh * .8);
    cx += (mx - cx) * .08; cy += (my - cy) * .08;
    if (Math.abs(mx - cx) + Math.abs(my - cy) > .002) request();
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  if (!reduce) {
    addEventListener('scroll', request, { passive: true }); addEventListener('resize', request);
    addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; request(); }, { passive: true });
  }
  request();

  // ---------- bola 3D ----------
  const holders = $$('[data-ball]');
  if (!holders.length) return;
  const start = () => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = build; s.onerror = () => holders.forEach(h => h.classList.add('noball'));
    document.head.appendChild(s);
  };
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });

  function build() {
    const T = window.THREE;
    // centros dos 12 pentágonos (vértices do icosaedro) e 20 hexágonos (centros das faces): o Voronoi dos 32 é a bola de futebol
    const f = (1 + Math.sqrt(5)) / 2, V = [];
    for (const a of [-1, 1]) for (const b of [-f, f]) V.push([0, a, b], [a, b, 0], [b, 0, a]);
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    const C = V.map(v => new T.Vector3(...v).normalize());
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++)
      if ([d2(V[i], V[j]), d2(V[j], V[k]), d2(V[i], V[k])].every(d => Math.abs(d - 4) < 1e-6))
        C.push(new T.Vector3(...[0, 1, 2].map(n => V[i][n] + V[j][n] + V[k][n])).normalize());
    const material = () => new T.ShaderMaterial({
      uniforms: { C: { value: C } },
      vertexShader: 'varying vec3 vO; varying vec3 vN; void main(){ vO=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 C[32]; varying vec3 vO; varying vec3 vN;
        void main(){
          vec3 p=normalize(vO); float a=-1., b=-1.; int id=0;
          for(int i=0;i<32;i++){ float d=dot(p,C[i]); if(d>a){ b=a; a=d; id=i; } else if(d>b){ b=d; } }
          float seam=smoothstep(0.,.03,a-b);
          vec3 face=id<12? vec3(.05,.09,.12): vec3(.97,.98,.96);
          vec3 col=mix(vec3(.2,.26,.3),face,seam);
          vec3 n=normalize(vN), l=normalize(vec3(-.5,.8,.7));
          float dif=.5+.5*max(dot(n,l),0.);
          float spc=pow(max(dot(reflect(-l,n),vec3(0.,0.,1.)),0.),36.)*.55;
          float rim=pow(1.-max(n.z,0.),3.)*.3;
          gl_FragColor=vec4(col*dif+spc+rim*vec3(.0,.5,.2),1.);
        }`,
    });

    const balls = holders.map(holder => {
      let renderer;
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); } catch { holder.classList.add('noball'); return null; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      holder.appendChild(renderer.domElement);
      const size = () => renderer.setSize(holder.clientWidth, holder.clientWidth, false);
      size(); addEventListener('resize', size);
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .1, 20); cam.position.z = 4.6;
      const mesh = new T.Mesh(new T.SphereGeometry(1, 64, 64), material()); scene.add(mesh);
      const o = { holder, renderer, scene, cam, mesh, vis: true, kick: 0, vk: 0, roll: 0, big: holder.hasAttribute('data-big') };
      new IntersectionObserver(([e]) => { o.vis = e.isIntersecting; }).observe(holder);
      holder.addEventListener('click', () => { o.vk = 9; });
      holder.classList.add('on');
      return o;
    }).filter(Boolean);

    let last = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min((now - last) / 1000, .05); last = now;
      for (const o of balls) {
        if (!o.vis) continue;
        o.roll += ((reduce ? 0 : scrollY * .006) - o.roll) * .12;
        const lookX = o.big ? cy * 1.6 : 0, lookY = o.big ? cx * 2.2 : 0;
        o.mesh.rotation.x = o.roll + lookX; o.mesh.rotation.y = o.roll * .6 + lookY + (reduce ? 0 : now * (o.big ? .00035 : .0002));
        o.vk -= 28 * dt; o.kick = Math.max(0, o.kick + o.vk * dt); if (o.kick === 0 && o.vk < 0) o.vk = 0;
        o.mesh.position.y = o.kick * .12;
        o.holder.style.setProperty('--k', o.kick.toFixed(2));
        o.renderer.render(o.scene, o.cam);
      }
    };
    requestAnimationFrame(loop);
  }
})();
