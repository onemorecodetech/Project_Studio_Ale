// Studio Alessandra — comportamento comum a todas as páginas
(function () {
  const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const ORDEM = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const NOMES = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

  const ICONES = {
    whats: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.2-3.6.94.96-3.5-.23-.36a9.46 9.46 0 0 1-1.45-5.05c0-5.24 4.27-9.5 9.52-9.5 2.54 0 4.93 1 6.73 2.79a9.43 9.43 0 0 1 2.78 6.72c0 5.24-4.27 9.5-9.51 9.5m8.1-17.6A11.4 11.4 0 0 0 12.05.53C5.73.53.6 5.66.6 11.97c0 2.02.53 3.99 1.53 5.72L.5 23.67l6.13-1.6a11.43 11.43 0 0 0 5.42 1.38h.01c6.31 0 11.45-5.13 11.45-11.45 0-3.06-1.19-5.93-3.36-8.1"/></svg>',
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (v) => {
    const s = String(v || '').trim();
    if (!s) return '#';
    return /^https?:\/\//i.test(s) ? s : 'https://' + s;
  };
  const whatsLink = (numero, mensagem) =>
    `https://wa.me/${String(numero || '').replace(/\D/g, '')}${mensagem ? '?text=' + encodeURIComponent(mensagem) : ''}`;

  // Dia e hora atuais no horário de Brasília
  function agoraBrasil() {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => partes.find((p) => p.type === t).value;
    const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { dia: DIAS[idx], hora: `${get('hour').replace('24', '00')}:${get('minute')}` };
  }

  // ── Header e menu ─────────────────────────────────────
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 8);
    document.querySelector('.whats-float')?.classList.toggle('visivel', window.scrollY > 300 && !!window.__whats);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = document.querySelector('.menu-btn');
  const links = document.querySelector('.nav-links');
  menuBtn?.addEventListener('click', () => {
    const aberto = links.classList.toggle('aberto');
    menuBtn.setAttribute('aria-expanded', String(aberto));
  });
  links?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { links.classList.remove('aberto'); menuBtn?.setAttribute('aria-expanded', 'false'); }
  });

  // Marca o link da página atual
  const atual = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a:not(.nav-cta)').forEach((a) => {
    const destino = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (destino === atual) a.setAttribute('aria-current', 'page');
  });

  // ── Renderizações reutilizáveis ───────────────────────
  function renderHorarios(alvo, horarios) {
    const { dia } = agoraBrasil();
    alvo.innerHTML = ORDEM.map((d) => {
      const h = horarios[d] || {};
      const classes = [h.ativo ? '' : 'fechado', d === dia ? 'hoje' : ''].join(' ').trim();
      const valor = h.ativo ? `${esc(h.abertura)} às ${esc(h.fechamento)}` : 'Fechado';
      return `<li class="${classes}"><span>${NOMES[d]}</span><span>${valor}</span></li>`;
    }).join('');
  }

  function renderStatus(alvo, horarios) {
    const { dia, hora } = agoraBrasil();
    const h = horarios[dia];
    const aberto = h && h.ativo && h.abertura && h.fechamento && hora >= h.abertura && hora < h.fechamento;
    let texto;
    if (aberto) {
      texto = `Aberto agora, até ${esc(h.fechamento)}`;
    } else {
      // Procura o próximo dia com atendimento
      const hojeIdx = ORDEM.indexOf(dia);
      let proximo = null;
      if (h && h.ativo && hora < h.abertura) proximo = { nome: 'hoje', h };
      for (let i = 1; !proximo && i <= 7; i++) {
        const d = ORDEM[(hojeIdx + i) % 7];
        if (horarios[d]?.ativo) proximo = { nome: i === 1 ? 'amanhã' : NOMES[d].toLowerCase(), h: horarios[d] };
      }
      texto = proximo ? `Fechado agora. Abre ${proximo.nome} às ${esc(proximo.h.abertura)}` : 'Fechado no momento';
    }
    alvo.classList.toggle('aberto', !!aberto);
    alvo.innerHTML = `<span class="dot"></span>${texto}`;
  }

  function cardServico(s, whatsapp) {
    const msg = `Olá! Gostaria de agendar: ${s.nome}`;
    const preco = /^\d/.test(s.preco) ? `R$ ${s.preco}` : s.preco;
    return `
      <article class="service">
        <div class="service-photo">
          <img src="${esc(s.foto)}" alt="${esc(s.nome)}" loading="lazy" onerror="this.style.opacity=0">
        </div>
        <h3>${esc(s.nome)}</h3>
        <div class="price">${esc(preco)}</div>
        <p>${esc(s.descricao)}</p>
        ${whatsapp ? `<a class="book" href="${whatsLink(whatsapp, msg)}" target="_blank" rel="noopener">${ICONES.whats}Agendar este serviço</a>` : ''}
      </article>`;
  }

  // ── Dados do painel ───────────────────────────────────
  const dados = fetch('/api/dados', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); });

  dados.then((d) => {
    const c = d.contato || {};

    document.querySelectorAll('[data-link="instagram"]').forEach((a) => (a.href = url(c.instagram)));
    document.querySelectorAll('[data-link="agendamento"]').forEach((a) => (a.href = url(c.agendamento)));
    document.querySelectorAll('[data-link="whatsapp"]').forEach((a) => (a.href = whatsLink(c.whatsapp, a.dataset.msg || 'Olá! Gostaria de agendar um horário.')));
    window.__whats = !!c.whatsapp;
    onScroll();

    const promo = document.querySelector('.promo');
    if (promo && d.promocoes?.length) {
      promo.innerHTML = `<div class="wrap">${d.promocoes
        .map((p) => `<div><strong>${esc(p.titulo)}</strong>${p.descricao ? ' ' + esc(p.descricao) : ''}</div>`)
        .join('')}</div>`;
      promo.hidden = false;
    }

    document.querySelectorAll('[data-horarios]').forEach((el) => renderHorarios(el, d.horarios || {}));
    document.querySelectorAll('[data-status]').forEach((el) => renderStatus(el, d.horarios || {}));

    document.querySelectorAll('[data-servicos]').forEach((el) => {
      const limite = parseInt(el.dataset.servicos, 10) || Infinity;
      const lista = (d.servicos || []).slice(0, limite);
      el.innerHTML = lista.length
        ? lista.map((s) => cardServico(s, c.whatsapp)).join('')
        : '<div class="empty">Os serviços estão sendo atualizados. Fale com a gente pelo WhatsApp para saber valores.</div>';
    });
  }).catch(() => {
    document.querySelectorAll('[data-servicos]').forEach((el) => {
      el.innerHTML = '<div class="empty">Não foi possível carregar os serviços agora. Atualize a página em alguns instantes.</div>';
    });
  });
})();
