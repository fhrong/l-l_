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
  // Quantidade de combos
  let comboQty = 1;
  // Bebidas: { bebidaId: quantidade }
  let selectedDrinks = { b0: 1 };
  let selectedDrink = 'b0'; // compatibilidade legacy
  // extras gerais
  let selectedExtras = new Set();

  // --- Dynamic Offer Banner ---
  function showDynamicOfferBanner() {
    let banner = document.getElementById('dynamicOfferBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dynamicOfferBanner';
      banner.style = 'width:100%;text-align:center;margin:10px 0 18px 0;font-weight:700;font-size:1.08rem;color:#ff7d26;background:#fff7f0;border-radius:8px;padding:8px 0;box-shadow:0 1px 6px #ff7d2622;letter-spacing:0.2px;';
      const orderFlow = document.getElementById('orderFlow');
      if (orderFlow) orderFlow.parentNode.insertBefore(banner, orderFlow);
    }
    // Randomly pick which message to show
    if (Math.random() < 0.5) {
      const viewers = Math.floor(Math.random() * 17) + 7; // 7-23
      banner.textContent = `${viewers} pessoas estão vendo esta oferta agora`;
    } else {
      const stock = Math.floor(Math.random() * 6) + 8; // 8-13
      banner.textContent = `Últimas ${stock} marmitas disponíveis`;
    }
  }

  // --- Step Indicator ---
  function showStepIndicator(currentStep = 1) {
    let stepBar = document.getElementById('stepIndicator');
    if (!stepBar) {
      stepBar = document.createElement('div');
      stepBar.id = 'stepIndicator';
      stepBar.className = 'step-indicator';
      const orderFlow = document.getElementById('orderFlow');
      if (orderFlow) orderFlow.parentNode.insertBefore(stepBar, orderFlow);
    }
    // Responsive, icon-based, always horizontal, short labels
    const steps = [
      { label: 'Combo', icon: '🥡' },
      { label: 'Extras', icon: '➕' },
      { label: 'Bebida', icon: '🥤' },
      { label: 'Endereço', icon: '📦' }
    ];
    stepBar.innerHTML = steps.map((s, i) =>
      `<div class="step${i+1===currentStep?' active':''}">
        <div class="step-circle">${s.icon}</div>
        <div class="step-label">${s.label}</div>
      </div>${i<steps.length-1?'<div class="step-arrow">→</div>':''}`
    ).join('');
  }

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
        @media (min-width: 541px) {
          #perMarmitaExtrasBox img {
            max-width: 48px;
            max-height: 48px;
            width: 48px !important;
            height: 48px !important;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 2px 8px #0002;
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
      let qty = selectedDrinks[b.id] || 0;
      d.innerHTML = `${b.name}${b.price? ' + ' + formatCurrency(b.price): ''}` + (b.id !== 'b0' ? `<span style="margin-left:10px;font-weight:700;">${qty > 0 ? qty : ''}</span> <button class="plus-btn" style="margin-left:6px;font-weight:900;">+</button> <button class="minus-btn" style="margin-left:2px;font-weight:900;">-</button>` : '');
      d.addEventListener('click', (e) => {
        if (b.id === 'b0') {
          selectedDrinks = { b0: comboQty };
          buildBebidas();
          updateSummary();
          return;
        }
      });
      // Plus/minus para bebidas
      if (b.id !== 'b0') {
        d.querySelector('.plus-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectedDrinks[b.id] = (selectedDrinks[b.id] || 0) + 1;
          if (selectedDrinks['b0']) delete selectedDrinks['b0'];
          buildBebidas();
          updateSummary();
        });
        d.querySelector('.minus-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (selectedDrinks[b.id]) selectedDrinks[b.id]--;
          if (selectedDrinks[b.id] <= 0) delete selectedDrinks[b.id];
          if (Object.keys(selectedDrinks).length === 0) selectedDrinks['b0'] = comboQty;
          buildBebidas();
          updateSummary();
        });
      }
      // Destaque se selecionado
      if ((b.id === 'b0' && selectedDrinks['b0']) || (b.id !== 'b0' && selectedDrinks[b.id])) d.style.background = 'rgba(255,107,0,0.08)';
      list.appendChild(d);
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
    // --- Upsell sobremesa after bebidas ---
    let sobremesaBox = document.getElementById('sobremesaBox');
    if (bebidasBox && bebidasBox.style.display !== 'none') {
      if (!sobremesaBox) {
        sobremesaBox = document.createElement('div');
        sobremesaBox.id = 'sobremesaBox';
        sobremesaBox.style = 'margin: 18px 0 18px 0; text-align:center; background:#fff7f0; border-radius:10px; box-shadow:0 1px 6px #ff7d2622; padding:14px 0;';
        bebidasBox.parentNode.insertBefore(sobremesaBox, bebidasBox.nextSibling);
      }
      sobremesaBox.innerHTML = `<label style='font-weight:700;font-size:1.08em;'>Leve a sobremesa do dia por apenas <span style='color:#ff7d26;'>R$2,90</span></label><br><input type='checkbox' id='addSobremesa' style='transform:scale(1.3);margin:10px 6px 0 0;'><label for='addSobremesa' style='font-size:1em;cursor:pointer;'>Sim, quero sobremesa!</label>`;
      const cb = sobremesaBox.querySelector('#addSobremesa');
      cb.checked = !!window.addSobremesa;
      cb.onchange = () => { window.addSobremesa = cb.checked; updateSummary(); };
    } else if (sobremesaBox) { sobremesaBox.remove(); }
    // Cross-sell: banner para 4 combos
    let crossBanner = document.getElementById('crossSellBanner');
    if (comboQty < 4) {
      if (!crossBanner) {
        crossBanner = document.createElement('div');
        crossBanner.id = 'crossSellBanner';
        crossBanner.style = 'margin:18px 0 8px 0;text-align:center;background:#fff7f0;color:#ff7d26;font-weight:700;padding:8px 0;border-radius:8px;box-shadow:0 1px 6px #ff7d2622;';
        summaryBox.insertBefore(crossBanner, summaryBox.firstChild);
      }
      crossBanner.innerHTML = 'Leve <span style="color:#ff3c00;">4 combos</span> e pague só <span style="color:#ff3c00;">R$ 84,90</span>!';
    } else if (crossBanner) { crossBanner.remove(); }
    showDynamicOfferBanner();
    // Detect current step (very simple: based on which box is visible)
    let step = 1;
    if (extrasBox && extrasBox.style.display !== 'none') step = 2;
    if (bebidasBox && bebidasBox.style.display !== 'none') step = 3;
    if (addressBox && addressBox.style.display !== 'none') step = 4;
    showStepIndicator(step);
    // ...existing code...
    const show = (selectedMarmitas.length === 2);
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
    // Adiciona seletor de combos após bebidasBox
    let comboQtyBox = document.getElementById('comboQtyBox');
    if (show && bebidasBox) {
      if (!comboQtyBox) {
        comboQtyBox = document.createElement('div');
        comboQtyBox.id = 'comboQtyBox';
        comboQtyBox.style = 'margin: 28px 0 18px 0; text-align:center;';
        bebidasBox.parentNode.insertBefore(comboQtyBox, bebidasBox.nextSibling);
      }
      comboQtyBox.innerHTML = `<label style=\"font-weight:700;font-size:1.1em;\">Combos de marmita</label><br><button id=\"minusCombo\" style=\"font-size:1.3em;margin:0 8px;\">-</button><span id=\"comboQtyVal\" style=\"font-size:1.2em;font-weight:700;\">${comboQty}</span><button id=\"plusCombo\" style=\"font-size:1.3em;margin:0 8px;\">+</button><div id=\"comboPromoMsg\" style=\"margin-top:8px;color:#ffb43a;font-weight:700;\"></div>`;
      // Promo especial
      const promoMsg = document.getElementById('comboPromoMsg');
      if (comboQty === 3) promoMsg.textContent = 'Aproveite: 3 combos por apenas R$ 64,90!';
      else promoMsg.textContent = '';
      document.getElementById('minusCombo').onclick = () => {
        if (comboQty > 1) { comboQty--; if (selectedDrinks['b0']) selectedDrinks['b0'] = comboQty; updateFlow(); }
      };
      document.getElementById('plusCombo').onclick = () => {
        comboQty++; if (selectedDrinks['b0']) selectedDrinks['b0'] = comboQty; updateFlow();
      };
    } else if (comboQtyBox) { comboQtyBox.remove(); }
    if (addressBox) {
      addressBox.style.display = show ? 'block' : 'none';
      // Always ensure address-fields are visible
      const addressFields = addressBox.querySelector('.address-fields');
      if (addressFields) addressFields.style.display = 'block';
      // Input masks for phone and CEP
      const phone = document.getElementById('phoneInput');
      if (phone && !phone.hasAttribute('data-masked')) {
        phone.setAttribute('pattern', '[0-9]{2} [0-9]{5}-[0-9]{4}');
        phone.setAttribute('placeholder', '11 91234-5678');
        phone.setAttribute('autocomplete', 'tel');
        phone.setAttribute('data-masked', '1');
        phone.addEventListener('input', function(e) {
          let v = phone.value.replace(/\D/g, '');
          if (v.length > 2) v = v.replace(/(\d{2})(\d)/, '$1 $2');
          if (v.length > 8) v = v.replace(/(\d{2}) (\d{5})(\d)/, '$1 $2-$3');
          phone.value = v;
        });
      }
      const cep = document.getElementById('cepInput');
      if (cep && !cep.hasAttribute('data-masked')) {
        cep.setAttribute('pattern', '\d{5}-\d{3}');
        cep.setAttribute('placeholder', '14000-000');
        cep.setAttribute('autocomplete', 'postal-code');
        cep.setAttribute('data-masked', '1');
        cep.addEventListener('input', function(e) {
          let v = cep.value.replace(/\D/g, '');
          if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
          cep.value = v;
        });
      }
    }
  if (summaryBox) summaryBox.style.display = show ? 'block' : 'none';
  // Minimize required fields: hide optional fields (bairro, complemento, etc)
  const bairro = document.getElementById('bairroInput');
  if (bairro) bairro.style.display = 'none';
  // Autofill is already enabled for address/phone fields
    if (show) updateSummary();
  }

  function updateSummary() {
    if (!summaryLines || !promoPriceEl || !orderTotal) return;
    summaryLines.innerHTML = '';
    // Mostrar combos
    for (let c = 0; c < comboQty; c++) {
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
        ln.innerHTML = `<div>${m.name}${extrasText ? ' <span style=\"color:#ffb43a;font-size:0.95em\">+ ' + extrasText + '</span>' : ''}</div><div>incluído</div>`;
        summaryLines.appendChild(ln);
      });
    }
    // Add visual seals to summary if not present (never in addressBox)
    let seals = document.getElementById('visualSeals');
    if (!seals && summaryBox) {
      seals = document.createElement('div');
      seals.id = 'visualSeals';
      seals.style = 'display:flex;gap:10px;justify-content:center;margin:18px 0 8px 0;';
      seals.innerHTML = `
        <span style="background:#eaffea;color:#1a7f37;font-weight:700;padding:4px 12px;border-radius:16px;font-size:14px;display:inline-flex;align-items:center;gap:4px;">🚚 Entrega Rápida</span>
        <span style="background:#fff7f0;color:#ff7d26;font-weight:700;padding:4px 12px;border-radius:16px;font-size:14px;display:inline-flex;align-items:center;gap:4px;">🔒 Pagamento Seguro</span>
        <span style="background:#f0f7ff;color:#1a7f37;font-weight:700;padding:4px 12px;border-radius:16px;font-size:14px;display:inline-flex;align-items:center;gap:4px;">😊 Satisfação Garantida</span>
      `;
      summaryBox.insertBefore(seals, summaryBox.firstChild);
    }
    // Add payment methods row before checkoutBtn
    let payRow = document.getElementById('paymentMethodsRow');
    if (!payRow) {
      payRow = document.createElement('div');
      payRow.id = 'paymentMethodsRow';
      payRow.className = 'payment-methods-row';
      payRow.innerHTML = `
        <div class="pay-label">Aceitamos:</div>
        <div class="pay-icons">
          <img src='https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Logo%E2%80%94pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.svg/800px-Logo%E2%80%94pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.svg.png' alt='Pix'>
          <img src='https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png' alt='Visa'>
          <img src='https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png' alt='Mastercard'>
          <img src='https://upload.wikimedia.org/wikipedia/commons/d/da/Elo_card_association_logo_-_black_text.svg' alt='Elo'>
        </div>
      `;
      summaryBox.appendChild(payRow);
    }
  // Preço combos
  let total = 0;
  let promo = PROMO_PRICE * comboQty;
  // Promo especial 3 combos
  let promoLabel = '';
  if (comboQty === 3) {
    promo = 64.90;
    promoLabel = '<span style=\"color:#ffb43a;font-size:1.1em;font-weight:700;\">Promoção: 3 combos por R$ 64,90!</span>';
  } else if (comboQty === 4) {
    promo = 84.90;
    promoLabel = '<span style=\"color:#ff3c00;font-size:1.1em;font-weight:700;\">Leve 4 combos e pague só R$ 84,90!</span>';
  }
  promoPriceEl.innerHTML = formatCurrency(promo) + (promoLabel ? '<br>' + promoLabel : '');
  total += promo;
    // Sobremesa upsell
    if (window.addSobremesa) {
      const ln = document.createElement('div'); ln.className = 'line';
      ln.innerHTML = `<div>Sobremesa</div><div>R$ 2,90</div>`;
      summaryLines.appendChild(ln);
      total += 2.90;
    }
    // Extras por combo
    for (let c = 0; c < comboQty; c++) {
      selectedMarmitas.forEach(id => {
        if (selectedExtrasByMarmita[id]) {
          selectedExtrasByMarmita[id].forEach(eid => {
            const e = extras.find(x => x.id === eid);
            if (e) total += e.price;
          });
        }
      });
    }
    // Extras gerais
    if (selectedExtras && selectedExtras.size) {
      selectedExtras.forEach(eid => {
        const e = extras.find(x => x.id === eid);
        if (e) {
          const ln = document.createElement('div'); ln.className = 'line';
          ln.innerHTML = `<div>${e.name}</div><div>${formatCurrency(e.price)}</div>`;
          summaryLines.appendChild(ln);
          total += e.price * comboQty;
        }
      });
    }
    // Bebidas
    Object.entries(selectedDrinks).forEach(([bid, qty]) => {
      if (bid === 'b0') return;
      const b = bebidas.find(x => x.id === bid);
      if (b && qty > 0) {
        const ln = document.createElement('div'); ln.className = 'line';
        ln.innerHTML = `<div>${b.name} x${qty}</div><div>${formatCurrency(b.price * qty)}</div>`;
        summaryLines.appendChild(ln);
        total += b.price * qty;
      }
    });
    orderTotal.textContent = formatCurrency(total);
  }

  function formatCurrency(n){ return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

  function resetSelections() {
  selectedMarmitas = [];
  selectedExtras = new Set();
  selectedDrink = 'b0';
  selectedDrinks = { b0: 1 };
  comboQty = 1;
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
    }, 1400);
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



  function getRandomDecimal() {
    let num;
    do {
      num = +(Math.random() * (3.3 - 1.4) + 1.4).toFixed(1);
    } while (num % 1 === 0); // repete se for número inteiro (como 2.0)
    return num;
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
        <div style="color:#9aa4b2;margin-bottom:6px;">Unidade encontra-se há ${getRandomDecimal()} km de você.</div>
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
        <p>Para essa promoção em uma das nossas cozinhas industriais mais próximas de você, é possível selecionar mais de um combo de 2x1 por vez !</p>
        <p>FRETE GRÁTIS !🛵✅</p>
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
