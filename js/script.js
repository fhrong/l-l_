// script.js (merged & cleaned - corrigido buildExtras + extrasBox visibility)
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Helper
  const $ = id => document.getElementById(id);

  // Normaliza strings (remove acentos, trim, lower)
  function normalizeStr(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  // Espera estadosData e selects estarem prontos
  function waitForStatesAndSelects() {
    return new Promise(resolve => {
      const check = () => {
        if (estadosData.length && stateSelect && citySelect) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // Tenta extrair sigla a partir do objeto address do Nominatim
  function siglaFromNominatimAddress(address) {
    if (!address) return null;
    if (address.state_code && address.state_code.length === 2) return address.state_code.toUpperCase();
    if (address['ISO3166-2']) {
      const parts = address['ISO3166-2'].split('-');
      if (parts.length === 2) return parts[1].toUpperCase();
    }
    const stateName = address.state || address.region || '';
    if (!stateName) return null;
    const norm = normalizeStr(stateName);
    let found = estadosData.find(e => normalizeStr(e.nome) === norm || normalizeStr(e.sigla) === norm);
    if (found) return found.sigla;
    found = estadosData.find(e => normalizeStr(e.nome).includes(norm) || norm.includes(normalizeStr(e.nome)));
    return found ? found.sigla : null;
  }

  // Auto-fill usando geolocalização -> Nominatim -> preenche selects
  async function autoFillLocation() {
    if (!navigator.geolocation) {
      console.warn('Geolocation não disponível no browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Nominatim retorno: ' + resp.status);
        const data = await resp.json();
        console.log('Nominatim response:', data);

        if (!data.address) return;

        await waitForStatesAndSelects();

        // Estado
        const sigla = siglaFromNominatimAddress(data.address);
        if (sigla && stateSelect) {
          const optionExists = Array.from(stateSelect.options).some(o => o.value === sigla);
          if (optionExists) {
            stateSelect.value = sigla;
            stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Estado preenchido:', sigla);
          } else {
            console.warn('Sigla encontrada não existe nas opções do select:', sigla);
          }
        }

        // Cidade
        const cityFields = ['city','town','village','municipality','county','hamlet','locality','suburb','city_district'];
        let cidade = '';
        for (const f of cityFields) { if (data.address[f]) { cidade = data.address[f]; break; } }
        if (!cidade && data.display_name) cidade = data.display_name.split(',')[0];
        if (!cidade) return;

        const normCidade = normalizeStr(cidade);
        let tentativas = 0;
        const trySetCity = () => {
          if (!citySelect) return;
          if (citySelect.disabled || citySelect.options.length <= 1) {
            if (tentativas++ < 20) return setTimeout(trySetCity, 150);
            console.warn('Opções de cidade não preenchidas em tempo para auto-fill.');
            return;
          }
          // exact match
          for (const opt of citySelect.options) {
            if (normalizeStr(opt.value) === normCidade) {
              citySelect.value = opt.value;
              citySelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Cidade preenchida (exact):', opt.value);
              return;
            }
          }
          // partial match
          for (const opt of citySelect.options) {
            const normOpt = normalizeStr(opt.value);
            if (normOpt.includes(normCidade) || normCidade.includes(normOpt)) {
              citySelect.value = opt.value;
              citySelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Cidade preenchida (partial):', opt.value);
              return;
            }
          }
          console.warn('Cidade não encontrada entre as opções do select:', cidade);
        };
        trySetCity();

      } catch (e) {
        console.error('Erro ao preencher localização automática:', e);
        // fallback via IP (ipapi.co)
        try {
          const r2 = await fetch('https://ipapi.co/json/');
          if (r2.ok) {
            const ipd = await r2.json();
            console.log('Fallback ipapi:', ipd);
            await waitForStatesAndSelects();
            if (ipd.region_code && stateSelect) {
              const regionCode = ipd.region_code.toUpperCase();
              if (Array.from(stateSelect.options).some(o => o.value === regionCode)) {
                stateSelect.value = regionCode;
                stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            const cityFromIp = ipd.city || ipd.region;
            if (cityFromIp) {
              const normCidade = normalizeStr(cityFromIp);
              let tent = 0;
              const tryCityIp = () => {
                if (!citySelect) return;
                if (citySelect.disabled || citySelect.options.length <= 1) {
                  if (tent++ < 20) return setTimeout(tryCityIp, 150);
                  return;
                }
                for (const opt of citySelect.options) {
                  if (normalizeStr(opt.value) === normCidade || normalizeStr(opt.value).includes(normCidade) || normCidade.includes(normalizeStr(opt.value))) {
                    citySelect.value = opt.value;
                    citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                  }
                }
              };
              tryCityIp();
            }
          }
        } catch (err2) {
          console.error('Fallback por IP também falhou:', err2);
        }
      }
    }, err => {
      console.warn('Geolocalização não permitida ou falhou:', err);
    }, { timeout: 10000, maximumAge: 5 * 60 * 1000 });
  }

  // Elements (queremos garantir que existam antes do uso)
  const stateSelect = $('state');
  const citySelect = $('city');
  const searchForm = $('searchForm');
  const checkBtn = $('checkBtn');
  const overlay = $('overlay');
  const resultArea = $('resultArea');
  const foundText = $('foundText');
  const distanceText = $('distanceText');
  const etaText = $('etaText');
  const startOrderBtn = $('startOrder');
  const marmitasGrid = $('marmitasGrid');
  const resultCard = $('resultCard');
  const extrasBox = $('extrasBox');
  const bebidasBox = $('bebidasBox');
  const addressBox = $('addressBox');
  const summaryBox = $('summaryBox');
  const summaryLines = $('summaryLines');
  const promoPriceEl = $('promoPrice');
  const orderTotal = $('orderTotal');

  // Optional address inputs
  const cepInput = $('cepInput');
  const cepError = $('cepError');
  const phoneInput = $('phoneInput');
  const phoneError = $('phoneError');
  const nomeInput = $('nomeInput');
  const ruaInput = $('ruaInput');
  const numeroInput = $('numeroInput');
  const bairroInput = $('bairroInput');
  const cpfCheck = $('cpfCheck');
  const cpfInput = $('cpfInput');
  const checkoutBtn = $('checkoutBtn');

  // Data & state
  const PROMO_PRICE = 24.90;
  const marmitas = [
    { id: 'm1', name: 'Feijoada - M', desc: 'Feijoada completa com carnes selecionadas, acompanhada de arroz, farofa e couve.', img: 'imagens/feijoada.webp' },
    { id: 'm2', name: 'Bisteca - M', desc: 'Bisteca suína grelhada, servida com arroz, feijão, abóbora e fritas deliciosas.', img: 'imagens/bisteca.webp' },
    { id: 'm3', name: 'Filé de Frango - M', desc: 'Filé de frango grelhado, acompanhado de arroz, feijão, batata frita e chuchu.', img: 'imagens/filedefrango.webp' },
    { id: 'm4', name: 'Alcatra - M', desc: 'Alcatra bovina assada, servida com arroz, feijão, chuchu e fritas.', img: 'imagens/alcatra.webp' }
  ];
  const extras = [{ id:'e1',name:'Arroz',price:2.5},{id:'e2',name:'Farofa',price:1.5},{id:'e3',name:'Ovo frito',price:3.0 }];
  const bebidas = [{ id:'b0',name:'Sem bebida',price:0},{id:'b1',name:'Coca Cola 2l',price:10.90},{id:'b2',name:'Suco natural 500ml',price:6.0 }];

  let estadosData = [];
  let selectedMarmitas = [];
  // Per-marmita extras: { [marmitaId]: Set(extraId) }
  let selectedExtrasByMarmita = {};
  let selectedDrink = 'b0';
  // extras gerais
  let selectedExtras = new Set();

  // Init: load states/cities and attempt autofill
  fetch('citys.json').then(r => r.json()).then(json => {
    estadosData = json.estados || [];
    if (stateSelect) {
      initStateOptions();
      // tenta preencher estado/cidade automaticamente
      autoFillLocation();
    }
  }).catch(e => console.error('Erro citys.json', e));

  function initStateOptions() {
    if (!stateSelect) return;
    stateSelect.innerHTML = '<option value="">-- selecione --</option>';
    estadosData.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.sigla;
      opt.textContent = `${s.sigla} - ${s.nome}`;
      stateSelect.appendChild(opt);
    });
  }

  function populateCities(sigla) {
    if (!citySelect) return;
    citySelect.innerHTML = '<option value="">-- selecione --</option>';
    if (!sigla) { citySelect.disabled = true; return; }
    const est = estadosData.find(e => e.sigla === sigla);
    if (!est) return;
    est.cidades.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  }
  if (stateSelect) stateSelect.addEventListener('change', e => populateCities(e.target.value));

  // Build UI lists
  function buildMarmitas() {
    if (!marmitasGrid) return;
    marmitasGrid.innerHTML = '';
    marmitas.forEach(m => {
      const div = document.createElement('div');
      div.className = 'marmita';
      div.innerHTML = `<img src="${m.img}" alt=""><h3>${m.name}</h3><p>${m.desc}</p>`;
      div.addEventListener('click', () => toggleMarmita(m.id, div));
      marmitasGrid.appendChild(div);
    });
  }

  function toggleMarmita(id, div) {
    const idx = selectedMarmitas.indexOf(id);
    if (idx >= 0) { selectedMarmitas.splice(idx,1); div.classList.remove('selected'); }
    else {
      if (selectedMarmitas.length >= 2) {
        showCustomMarmitaWarning('É possível selecionar apenas 2 marmitas por combo.');
        return;
      }
      selectedMarmitas.push(id); div.classList.add('selected');
    }
    updateFlow();

    if (selectedMarmitas.length === 2) {
      setTimeout(() => scrollToForm(), 160);
    }

    // Custom warning card for over-selection of marmitas
    function showCustomMarmitaWarning(msg) {
      let card = document.getElementById('marmitaWarningCard');
      if (!card) {
        card = document.createElement('div');
        card.id = 'marmitaWarningCard';
        card.style.position = 'fixed';
        card.style.top = '32px';
        card.style.left = '50%';
        card.style.transform = 'translateX(-50%)';
        card.style.background = '#fffbe6';
        card.style.color = '#d7263d';
        card.style.fontWeight = '700';
        card.style.fontSize = '1.1rem';
        card.style.borderRadius = '10px';
        card.style.padding = '16px 32px';
        card.style.boxShadow = '0 2px 16px 0 rgba(255,107,0,0.13)';
        card.style.zIndex = '3000';
        card.style.border = '2px solid #ffd700';
        card.style.letterSpacing = '0.5px';
        card.style.transition = 'opacity 0.3s';
        document.body.appendChild(card);
      }
      card.textContent = msg;
      card.style.opacity = '1';
      setTimeout(() => { card.style.opacity = '0'; }, 2200);
    }
  }

  function scrollToForm() {
    const target = $('addressBox') || $('summaryBox') || $('orderMount') || $('orderFlow');
    if (!target) return;
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      const rect = target.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
    }
  }


  // Build per-marmita extras UI before bebidas
  function buildPerMarmitaExtras() {
    let container = document.getElementById('perMarmitaExtrasBox');
    if (container) container.remove();
    if (selectedMarmitas.length !== 2) return;
    const bebidasBox = document.getElementById('bebidasBox');
    container = document.createElement('div');
    container.id = 'perMarmitaExtrasBox';
    container.style.margin = '24px 0 18px 0';
    container.innerHTML = '<h3>Adicionais por marmita</h3>';
    // Responsive style for mobile: stack extras vertically, readable text
    const styleId = 'perMarmitaExtrasResponsiveStyle';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @media (max-width: 540px) {
          #perMarmitaExtrasBox .marmita-extras-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          #perMarmitaExtrasBox .marmita-extras-chips {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100%;
            gap: 8px !important;
          }
          #perMarmitaExtrasBox .marmita-extras-chip {
            min-width: 0;
            width: 100%;
            text-align: center;
            font-size: 1em;
            white-space: normal;
            padding: 8px 0;
          }
          #perMarmitaExtrasBox img {
            width: 40px !important;
            height: 40px !important;
          }
        }
        #perMarmitaExtrasBox .marmita-extras-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 10px;
        }
        #perMarmitaExtrasBox .marmita-extras-chips {
          display: flex;
          gap: 8px;
        }
        #perMarmitaExtrasBox .marmita-extras-chip {
          background: #1a2336;
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 600;
          font-size: 1.05em;
          cursor: pointer;
          transition: background 0.15s;
          box-shadow: 0 1px 4px #0001;
          margin: 0;
          white-space: pre-line;
        }
        #perMarmitaExtrasBox .marmita-extras-chip.selected {
          background: #ffb43a;
          color: #222;
        }
      `;
      document.head.appendChild(style);
    }
    selectedMarmitas.forEach(mId => {
      const m = marmitas.find(x => x.id === mId);
      const mDiv = document.createElement('div');
      mDiv.className = 'marmita-extras-row';
      mDiv.innerHTML = `<img src="${m.img}" alt=""> <span style="font-weight:600;">${m.name}</span>`;
      // Extras chips
      const chips = document.createElement('div');
      chips.className = 'marmita-extras-chips';
      if (!selectedExtrasByMarmita[mId]) selectedExtrasByMarmita[mId] = new Set();
      extras.forEach(e => {
        const chip = document.createElement('div');
        chip.className = 'marmita-extras-chip' + (selectedExtrasByMarmita[mId].has(e.id) ? ' selected' : '');
        chip.tabIndex = 0;
        chip.innerHTML = `<span style="display:block;font-weight:700;">${e.name}</span><span style="display:block;font-size:0.98em;">+R$ ${e.price.toFixed(2).replace('.', ',')}</span>`;
        chip.addEventListener('click', () => {
          if (selectedExtrasByMarmita[mId].has(e.id)) selectedExtrasByMarmita[mId].delete(e.id);
          else selectedExtrasByMarmita[mId].add(e.id);
          buildPerMarmitaExtras();
          updateSummary();
        });
        chips.appendChild(chip);
      });
      mDiv.appendChild(chips);
      container.appendChild(mDiv);
    });
    bebidasBox.parentNode.insertBefore(container, bebidasBox);
  }

  function buildBebidas() {
    const list = $('bebidasList'); if (!list) return; list.innerHTML = '';
    bebidas.forEach(b => {
      const d = document.createElement('div');
      d.className = 'chip';
      d.textContent = `${b.name}${b.price? ' + ' + formatCurrency(b.price): ''}`;
      d.addEventListener('click', () => {
        selectedDrink = b.id;
        Array.from(list.children).forEach(c => c.style.background = '');
        d.style.background = 'rgba(255,107,0,0.08)';
        updateSummary();
      });
      list.appendChild(d);
      if (selectedDrink === b.id) d.style.background = 'rgba(255,107,0,0.08)';
    });
  }

  // NOVA: buildExtras (preenche #extrasList com os extras gerais)
  function buildExtras() {
    const list = $('extrasList'); if (!list) return; list.innerHTML = '';
    extras.forEach(e => {
      const el = document.createElement('div');
      el.className = 'chip';
      el.textContent = `${e.name} +${formatCurrency(e.price)}`;
      if (selectedExtras.has(e.id)) el.style.background = 'rgba(255,107,0,0.08)';
      el.addEventListener('click', () => {
        if (selectedExtras.has(e.id)) {
          selectedExtras.delete(e.id);
          el.style.background = '';
        } else {
          selectedExtras.add(e.id);
          el.style.background = 'rgba(255,107,0,0.08)';
        }
        updateSummary();
      });
      list.appendChild(el);
    });
  }

  function updateFlow() {
    const show = (selectedMarmitas.length === 2);
    // Hide old extras UI
    if (extrasBox) extrasBox.style.display = show ? 'block' : 'none';
    if (extrasBox && !show) {
      // when hiding, clear general selected extras UI (optional)
      // selectedExtras.clear();
    }
    if (show) buildPerMarmitaExtras();
    else {
      const old = document.getElementById('perMarmitaExtrasBox');
      if (old) old.remove();
    }
    if (bebidasBox) bebidasBox.style.display = show ? 'block' : 'none';
    if (addressBox) addressBox.style.display = show ? 'block' : 'none';
    if (summaryBox) summaryBox.style.display = show ? 'block' : 'none';
    if (show) updateSummary();
  }

  function updateSummary() {
    if (!summaryLines || !promoPriceEl || !orderTotal) return;
    summaryLines.innerHTML = '';
    selectedMarmitas.forEach(id => {
      const m = marmitas.find(x => x.id === id);
      const ln = document.createElement('div'); ln.className = 'line';
      // List additionals for this marmita
      let extrasText = '';
      if (selectedExtrasByMarmita[id] && selectedExtrasByMarmita[id].size) {
        extrasText = Array.from(selectedExtrasByMarmita[id]).map(eid => {
          const e = extras.find(x => x.id === eid);
          return e ? e.name : '';
        }).filter(Boolean).join(', ');
      }
      ln.innerHTML = `<div>${m.name}${extrasText ? ' <span style="color:#ffb43a;font-size:0.95em">+ ' + extrasText + '</span>' : ''}</div><div>incluído</div>`;
      summaryLines.appendChild(ln);
    });
    promoPriceEl.textContent = formatCurrency(PROMO_PRICE);
    let total = PROMO_PRICE;
    // Add extras price per marmita
    selectedMarmitas.forEach(id => {
      if (selectedExtrasByMarmita[id]) {
        selectedExtrasByMarmita[id].forEach(eid => {
          const e = extras.find(x => x.id === eid);
          if (e) total += e.price;
        });
      }
    });
    // Add general extras
    if (selectedExtras && selectedExtras.size) {
      selectedExtras.forEach(eid => {
        const e = extras.find(x => x.id === eid);
        if (e) {
          const ln = document.createElement('div'); ln.className = 'line';
          ln.innerHTML = `<div>${e.name}</div><div>${formatCurrency(e.price)}</div>`;
          summaryLines.appendChild(ln);
          total += e.price;
        }
      });
    }
    if (selectedDrink !== 'b0') {
      const d = bebidas.find(b => b.id === selectedDrink);
      const ln = document.createElement('div'); ln.className = 'line';
      ln.innerHTML = `<div>${d.name}</div><div>${formatCurrency(d.price)}</div>`;
      summaryLines.appendChild(ln);
      total += d.price;
    }
    orderTotal.textContent = formatCurrency(total);
  }

  function formatCurrency(n){ return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

  function resetSelections() {
    selectedMarmitas = [];
    selectedExtras = new Set();
    selectedDrink = 'b0';
    selectedExtrasByMarmita = {};
  }

  // Insere order flow após search-card (quando disponível)
  function mountOrderFlow() {
    const searchCard = document.querySelector('.search-card');
    if (!searchCard) return;

    let mount = document.getElementById('orderMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'orderMount';
      searchCard.insertAdjacentElement('afterend', mount);
    }

    const orderFlowEl = $('orderFlow');
    if (orderFlowEl && orderFlowEl.parentElement !== mount) {
      mount.appendChild(orderFlowEl);
    }
  }

  function startOrderFlow() {
    mountOrderFlow();

    resetSelections();
    buildMarmitas();
    buildExtras();
    buildBebidas();
    updateFlow();

    const orderFlowEl = $('orderFlow');
    if (orderFlowEl) orderFlowEl.style.display = 'block';

    // show disclaimer popup (unless user opted out)
    if (!localStorage.getItem('hideDisclaimer')) {
      showDisclaimerPopup();
    }

    const anchor = $('orderMount');
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleStartOrder() {
    try {
      startOrderFlow();
    } catch (err) {
      console.error('Erro ao iniciar pedido:', err);
    }
  }

  // Promo timer (persistente via localStorage)
  (function startPromoCountdown(minutes) {
    const minEl = $('promoMinutes'), secEl = $('promoSeconds');
    if (!minEl || !secEl) return;

    const PROMO_KEY = 'promoCountdownEndTime';
    const now = Date.now();
    let endTime = parseInt(localStorage.getItem(PROMO_KEY), 10);

    if (!endTime || isNaN(endTime) || endTime < now) {
      endTime = now + minutes * 60 * 1000;
      localStorage.setItem(PROMO_KEY, endTime.toString());
    }

    function tick() {
      const now = Date.now();
      let remaining = Math.max(0, Math.floor((endTime - now) / 1000));

      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      minEl.textContent = m;
      secEl.textContent = s;

      if (remaining <= 0) {
        endTime = Date.now() + minutes * 60 * 1000;
        localStorage.setItem(PROMO_KEY, endTime.toString());
      }

      setTimeout(tick, 1000);
    }

    tick();
  })(45); // 45 minutes

  // Search handling
  function simulateSearch(e){
    if (e && e.preventDefault) e.preventDefault();
    const st = stateSelect?.value || '';
    const ct = citySelect?.value || '';
    if (!st || !ct) { alert('Selecione estado e cidade'); return; }
    if (overlay) overlay.style.display = 'flex';

    setTimeout(()=>{
      if (overlay) overlay.style.display = 'none';
      showMobileResultPopup(ct, st); // sempre popup
    }, 800);
  }

  if (searchForm) searchForm.addEventListener('submit', simulateSearch);
  else if (checkBtn) checkBtn.addEventListener('click', simulateSearch);

  // Desktop "Fazer pedido" button
  if (startOrderBtn) {
    startOrderBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      handleStartOrder();
    });
  }

  // Mobile result popup
  function showMobileResultPopup(city, state) {
    let popup = $('mobileResultPopup');
    if (popup) popup.remove();

    popup = document.createElement('div');
    popup.id = 'mobileResultPopup';
    popup.style = 'position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(15,23,32,0.97);display:flex;align-items:center;justify-content:center;z-index:2000;';
    popup.innerHTML = `
      <div style="background:#0b1220;border-radius:16px;padding:24px 18px;max-width:360px;width:90vw;color:#fff;position:relative;text-align:center;">
        <button id="closeMobileResult" style="position:absolute;top:10px;right:12px;background:none;border:0;color:#fff;font-size:20px;cursor:pointer;opacity:0.7">&times;</button>
        <div class="badge" style="margin-bottom:10px;">Unidade encontrada</div>
        <div style="font-weight:700;margin-bottom:8px;">Encontramos uma unidade em ${city}-${state}!</div>
        <div style="color:#9aa4b2;margin-bottom:6px;">Unidade encontra-se há ${(Math.random()*2+1).toFixed(1)} km de você.</div>
        <div style="color:#9aa4b2;margin-bottom:12px;">Seu pedido chega em aproximadamente 35 minutos.</div>
        <div class="pill" style="margin-bottom:14px;">🔥 Promo limitada</div>
        <button id="popupStartOrder" class="btn" style="width:100%;">Fazer pedido</button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('#closeMobileResult').addEventListener('click', () => popup.remove());

    popup.querySelector('#popupStartOrder').addEventListener('click', (ev) => {
      ev.preventDefault();
      popup.remove();
      // Always show the result/order area and start the order flow
      if (resultArea) resultArea.style.display = 'block';
      const orderFlowEl = $('orderFlow');
      if (orderFlowEl) orderFlowEl.style.display = 'block';
      handleStartOrder();
    });
  }

  // CEP / phone / CPF logic (melhorias das duas versões)
  if (cepInput) {
    cepInput.style.borderColor = '';
    cepInput.addEventListener('input', () => {
      if (cepError) { cepError.style.display = 'none'; cepInput.style.borderColor = ''; }
    });
    cepInput.addEventListener('blur', () => {
      const cep = cepInput.value.replace(/\D/g,'');
      if (!cep) { if (cepError) { cepError.style.display='none'; cepInput.style.borderColor=''; } return; }
      if (cep.length !== 8) { if (cepError) { cepError.textContent='CEP inválido.'; cepError.style.display='block'; cepInput.style.borderColor='red'; } return; }
      fetch(`https://viacep.com.br/ws/${cep}/json/`).then(r=>r.json()).then(data=>{
        if (data.erro) { if (cepError){cepError.textContent='CEP não encontrado.';cepError.style.display='block';cepInput.style.borderColor='red';} return; }
        if (ruaInput) ruaInput.value = data.logradouro || '';
        if (bairroInput) bairroInput.value = data.bairro || '';
        const selectedCity = citySelect ? (citySelect.value||'').toLowerCase() : '';
        const cityFromCep = (data.localidade||'').toLowerCase();
        if (selectedCity && selectedCity !== cityFromCep) {
          if (cepError) { cepError.textContent='Endereço fora da cidade selecionada.'; cepError.style.display='block'; cepInput.style.borderColor='red'; }
        } else { if (cepError) { cepError.style.display='none'; cepInput.style.borderColor=''; } }
      }).catch(()=>{ if (cepError){cepError.textContent='Erro ao buscar CEP.';cepError.style.display='block';cepInput.style.borderColor='red';} });
    });
  }

  if (phoneInput) {
    phoneInput.style.borderColor = '';
    phoneInput.addEventListener('input', (e)=>{
      let v = e.target.value.replace(/\D/g,'').slice(0,11);
      if (v.length <= 10) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/,'($1) $2-$3');
      else v = v.replace(/^(\d{2})(\d{5})(\d{0,4})$/,'($1) $2-$3');
      e.target.value = v.trim();
      if (phoneError) { phoneError.style.display = 'none'; phoneInput.style.borderColor = ''; }
    });
    phoneInput.addEventListener('blur', ()=>{
      const p = phoneInput.value.replace(/\D/g,'');
      if (!p) { if (phoneError) { phoneError.style.display='none'; phoneInput.style.borderColor=''; } return; }
      if (!isValidBrazilianPhone(p)) { if (phoneError){ phoneError.style.display='block'; phoneInput.style.borderColor='red'; } }
      else { if (phoneError){ phoneError.style.display='none'; phoneInput.style.borderColor=''; } }
    });
  }

  function isValidBrazilianPhone(phone){
    if (!/^\d{10,11}$/.test(phone)) return false;
    const ddd = phone.substring(0,2);
    const validDDD = ['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'];
    if (!validDDD.includes(ddd)) return false;
    if (phone.length === 11 && phone[2] !== '9') return false;
    return true;
  }

  if (cpfCheck && cpfInput) {
    cpfCheck.addEventListener('change', ()=> { cpfInput.style.display = cpfCheck.checked ? 'block' : 'none'; if (!cpfCheck.checked) cpfInput.value=''; });
  }

  function validateCPF(cpf){ 
    cpf = (cpf||'').replace(/\D/g,''); 
    if (cpf.length!==11 || /^(\d)\1+$/.test(cpf)) return false; 
    let sum=0,rest; 
    for(let i=1;i<=9;i++) sum+=parseInt(cpf.substring(i-1,i))*(11-i); 
    rest=(sum*10)%11; if(rest===10||rest===11)rest=0; if(rest!==parseInt(cpf.substring(9,10)))return false; 
    sum=0; 
    for(let i=1;i<=10;i++) sum+=parseInt(cpf.substring(i-1,i))*(12-i); 
    rest=(sum*10)%11; if(rest===10||rest===11)rest=0; if(rest!==parseInt(cpf.substring(10,11)))return false; 
    return true; 
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e)=>{
      let valid = true;
      if (nomeInput && !nomeInput.value.trim()) { nomeInput.style.borderColor='red'; valid=false; } else if (nomeInput) nomeInput.style.borderColor='';
      if (cepInput) {
        if (!cepInput.value.trim() || (cepError && cepError.style.display==='block')) { cepInput.style.borderColor='red'; valid=false; }
        else cepInput.style.borderColor='';
      }
      if (ruaInput && !ruaInput.value.trim()) { ruaInput.style.borderColor='red'; valid=false; } else if (ruaInput) ruaInput.style.borderColor='';
      if (numeroInput && !numeroInput.value.trim()) { numeroInput.style.borderColor='red'; valid=false; } else if (numeroInput) numeroInput.style.borderColor='';
      if (bairroInput && !bairroInput.value.trim()) { bairroInput.style.borderColor='red'; valid=false; } else if (bairroInput) bairroInput.style.borderColor='';
      if (cpfCheck && cpfCheck.checked) {
        if (!cpfInput.value.trim() || !validateCPF(cpfInput.value)) { cpfInput.style.borderColor='red'; valid=false; } else cpfInput.style.borderColor='';
      }
      if (phoneInput) {
        const p = phoneInput.value.replace(/\D/g,'');
        if (!p || !isValidBrazilianPhone(p)) { phoneInput.style.borderColor='red'; if (phoneError) phoneError.style.display='block'; valid=false; }
        else { phoneInput.style.borderColor=''; if (phoneError) phoneError.style.display='none'; }
      }
      if (!valid) { e.preventDefault(); alert('Por favor, corrija os campos destacados.'); return false; }
    });
  }

  // Disclaimer popup (usei a versão mais informativa)
  function showDisclaimerPopup() {
    if (document.getElementById('disclaimerPopup')) return;
    const popup = document.createElement('div');
    popup.id = 'disclaimerPopup';
    popup.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="disclaimerTitle">
        <h4 id="disclaimerTitle">✅ Aviso !</h4>
        <p>Imagens ilustrativas — a apresentação do produto pode variar, mas garantimos a mesma qualidade e quantidade!</p>
        <p>Para essa promoção em uma das nossas cozinhas industriais mais próximas de você, é possível selecionar apenas um combo de 2x1 por vez.</p>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <label class="dontshow"><input type="checkbox" id="dontShowDisclaimer"> Não mostrar novamente</label>
        </div>
        <div class="actions">
          <button id="closeDisclaimer" class="btn">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    const checkbox = popup.querySelector('#dontShowDisclaimer');
    const closeBtn = popup.querySelector('#closeDisclaimer');

    closeBtn.addEventListener('click', () => {
      if (checkbox && checkbox.checked) localStorage.setItem('hideDisclaimer', '1');
      popup.remove();
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (checkbox && checkbox.checked) localStorage.setItem('hideDisclaimer', '1');
        popup.remove();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

});
