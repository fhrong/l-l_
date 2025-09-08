document.addEventListener('DOMContentLoaded', () => {
  // Aguarda até que estadosData esteja carregado e selects estejam prontos
  function waitForStatesAndSelects() {
    return new Promise(resolve => {
      const check = () => {
        if (estadosData.length && stateSelect && citySelect) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // Helpers: normaliza strings (remove acentos, deixa minúsculo)
function normalizeStr(s){
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Tenta extrair a sigla do state retornado pelo Nominatim usando estadosData
function siglaFromNominatimAddress(address) {
  if (!address) return null;
  if (address.state_code && address.state_code.length === 2) return address.state_code.toUpperCase();
  // ISO codes às vezes aparecem como "BR-SP"
  if (address['ISO3166-2']) {
    const parts = address['ISO3166-2'].split('-');
    if (parts.length === 2) return parts[1].toUpperCase();
  }
  const stateName = address.state || address.region || '';
  if (!stateName) return null;
  const norm = normalizeStr(stateName);
  // procura por correspondência exata ou parcial no estadosData
  let found = estadosData.find(e => normalizeStr(e.nome) === norm || normalizeStr(e.sigla) === norm);
  if (found) return found.sigla;
  found = estadosData.find(e => normalizeStr(e.nome).includes(norm) || norm.includes(normalizeStr(e.nome)));
  return found ? found.sigla : null;
}

async function autoFillLocation() {
  if (!navigator.geolocation) {
    console.warn('Geolocation não disponível no browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    try {
      // NÃO tente setar o header User-Agent aqui (navegador bloqueia).
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Nominatim retorno: ' + resp.status);
      const data = await resp.json();
      console.log('Nominatim response:', data);

      if (!data.address) return;

      // garante que estadosData e selects estejam prontos
      await waitForStatesAndSelects();

      // Estado: tenta extrair sigla e setar o select
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

      // Cidade: pega o melhor campo disponível
      const cityFields = ['city','town','village','municipality','county','hamlet','locality','suburb','city_district'];
      let cidade = '';
      for (const f of cityFields) {
        if (data.address[f]) { cidade = data.address[f]; break; }
      }
      if (!cidade && data.display_name) {
        cidade = data.display_name.split(',')[0];
      }
      if (!cidade) return;

      const normCidade = normalizeStr(cidade);
      // Aguarda as cidades serem populadas (populateCities é chamado no change do estado)
      let tentativas = 0;
      const trySetCity = () => {
        if (!citySelect) return;
        if (citySelect.disabled || citySelect.options.length <= 1) {
          if (tentativas++ < 20) return setTimeout(trySetCity, 150);
          console.warn('Opções de cidade não preenchidas em tempo para auto-fill.');
          return;
        }
        // compara normalizado
        for (const opt of citySelect.options) {
          if (normalizeStr(opt.value) === normCidade) {
            citySelect.value = opt.value;
            citySelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Cidade preenchida (exact):', opt.value);
            return;
          }
        }
        // tentativa por inclusão parcial (ex: "sao paulo" vs "são paulo - centro")
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
      // fallback via IP (opcional): tenta ipapi.co se Nominatim falhar
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
            // tenta setar cidade com mesma função de busca
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



  // Helper
  const $ = id => document.getElementById(id);

  // Elements
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


  // A single source of truth where the order flow must live (created after result card)
  function ensureOrderMount() {
    if (!resultArea) return null;
    let mount = document.getElementById('orderMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'orderMount'; // also doubles as scroll anchor
      // If we have a resultCard, place after it; else append to resultArea end
      if (resultCard && resultCard.parentElement === resultArea) {
        resultCard.insertAdjacentElement('afterend', mount);
      } else {
        resultArea.appendChild(mount);
      }
    }
    return mount;
  }

  const PROMO_PRICE = 24.90;

  // Data
  const marmitas = [
    { id: 'm1', name: 'Feijoada - M', desc: 'Feijoada completa com carnes selecionadas, acompanhada de arroz, farofa e couve.', img: 'imagens/feijoada.webp' },
    { id: 'm2', name: 'Bisteca - M', desc: 'Bisteca suína grelhada, servida com arroz, feijão, farofa e salada fresca.', img: 'imagens/bisteca.webp' },
    { id: 'm3', name: 'Filé de Frango - M', desc: 'Filé de frango grelhado, acompanhado de arroz, feijão, batata frita e salada.', img: 'imagens/filedefrango.webp' },
    { id: 'm4', name: 'Alcatra - M', desc: 'Alcatra bovina assada lentamente, servida com arroz, feijão, farofa e vinagrete.', img: 'imagens/alcatra.webp' }
  ];
  const extras = [{ id:'e1',name:'Arroz',price:2.5},{id:'e2',name:'Farofa',price:1.5},{id:'e3',name:'Ovo frito',price:3.0 }];
  const bebidas = [{ id:'b0',name:'Sem bebida',price:0},{id:'b1',name:'Refrigerante 350ml',price:4.5},{id:'b2',name:'Suco natural 300ml',price:6.0 }];

  // State
  let estadosData = [];
  let selectedMarmitas = [];
  let selectedExtras = new Set();
  let selectedDrink = 'b0';

  // Init: load states/cities
  fetch('citys.json').then(r => r.json()).then(json => {
    estadosData = json.estados || [];
    if (stateSelect) {
      initStateOptions();
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

  // Build UI
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
      if (selectedMarmitas.length >= 2) { alert('Promoção é válida para 2 marmitas apenas.'); return; }
      selectedMarmitas.push(id); div.classList.add('selected');
    }
    updateFlow();

    // If user just selected the second marmita, scroll to the address form/summary
    if (selectedMarmitas.length === 2) {
      // small timeout to allow layout/display changes to settle
      setTimeout(() => {
        scrollToForm();
      }, 160);
    }
  }

  // Smoothly scroll to the address/summary area (prefer addressBox, fallback to summaryBox/orderMount)
  function scrollToForm() {
    const target = $('addressBox') || $('summaryBox') || $('orderMount') || $('orderFlow');
    if (!target) return;
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      // fallback for older browsers
      const rect = target.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
    }
  }

  function buildExtras() {
    const list = $('extrasList'); if (!list) return; list.innerHTML = '';
    extras.forEach(e => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = `${e.name} +${formatCurrency(e.price)}`;
      if (selectedExtras.has(e.id)) btn.style.background = 'rgba(255,107,0,0.08)';
      btn.addEventListener('click', () => {
        if (selectedExtras.has(e.id)) { selectedExtras.delete(e.id); btn.style.background = ''; }
        else { selectedExtras.add(e.id); btn.style.background = 'rgba(255,107,0,0.08)'; }
        updateSummary();
      });
      list.appendChild(btn);
    });
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

  function updateFlow() {
    const show = (selectedMarmitas.length === 2);
    if (extrasBox) extrasBox.style.display = show ? 'block' : 'none';
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
      ln.innerHTML = `<div>${m.name}</div><div>incluído</div>`;
      summaryLines.appendChild(ln);
    });
    promoPriceEl.textContent = formatCurrency(PROMO_PRICE);
    let total = PROMO_PRICE;
    if (selectedDrink !== 'b0') {
      const d = bebidas.find(b => b.id === selectedDrink);
      const ln = document.createElement('div'); ln.className = 'line';
      ln.innerHTML = `<div>${d.name}</div><div>${formatCurrency(d.price)}</div>`;
      summaryLines.appendChild(ln);
      total += d.price;
    }
    if (selectedExtras.size) {
      let sum = 0; selectedExtras.forEach(id => sum += extras.find(x => x.id === id).price);
      const ln = document.createElement('div'); ln.className = 'line';
      ln.innerHTML = `<div>Adicionais</div><div>${formatCurrency(sum)}</div>`;
      summaryLines.appendChild(ln);
      total += sum;
    }
    orderTotal.textContent = formatCurrency(total);
  }

  function formatCurrency(n){ return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

  function resetSelections() {
    selectedMarmitas = [];
    selectedExtras = new Set();
    selectedDrink = 'b0';
  }

  // Mounts order flow consistently below the result card
  function mountOrderFlow() {
  const searchCard = document.querySelector('.search-card');
  if (!searchCard) return;

  let mount = document.getElementById('orderMount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'orderMount';
    searchCard.insertAdjacentElement('afterend', mount);
  }

  const orderFlow = $('orderFlow');
  if (orderFlow && orderFlow.parentElement !== mount) {
    mount.appendChild(orderFlow);
  }
}


  function startOrderFlow() {
  mountOrderFlow();

  resetSelections();
  buildMarmitas();
  buildExtras();
  buildBebidas();
  updateFlow();

  const orderFlow = $('orderFlow');
  if (orderFlow) orderFlow.style.display = 'block';

  // show disclaimer popup (unless user opted out)
  if (!localStorage.getItem('hideDisclaimer')) {
    showDisclaimerPopup();
  }

  const anchor = $('orderMount');
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}




  // Public handler for both desktop button and mobile popup
  function handleStartOrder() {
    try {
      startOrderFlow();
    } catch (err) {
      console.error('Erro ao iniciar pedido:', err);
    }
  }

  // Promo timer
  (function startPromoCountdown(minutes) {
  const minEl = $('promoMinutes'), secEl = $('promoSeconds');
  if (!minEl || !secEl) return;

  const PROMO_KEY = 'promoCountdownEndTime';
  const now = Date.now();
  let endTime = parseInt(localStorage.getItem(PROMO_KEY), 10);

  if (!endTime || isNaN(endTime) || endTime < now) {
    // Timer not started or expired, set new one
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
      // Restart timer if you want it to be cyclic
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

  // Desktop "Fazer pedido" button (below the dropdowns)
  if (startOrderBtn) {
    startOrderBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      handleStartOrder();
    });
  }

  // Mobile popup
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

    popup.querySelector('#closeMobileResult')
      .addEventListener('click', () => popup.remove());

    popup.querySelector('#popupStartOrder')
  .addEventListener('click', (ev) => {
    ev.preventDefault();
    popup.remove();

    if (resultArea) resultArea.style.display = 'block';
    handleStartOrder();
  });


  }

  // Address/CEP/phone/CPF logic
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

  function validateCPF(cpf){ cpf = (cpf||'').replace(/\D/g,''); if (cpf.length!==11 || /^(\d)\1+$/.test(cpf)) return false; let sum=0,rest; for(let i=1;i<=9;i++) sum+=parseInt(cpf.substring(i-1,i))*(11-i); rest=(sum*10)%11; if(rest===10||rest===11)rest=0; if(rest!==parseInt(cpf.substring(9,10)))return false; sum=0; for(let i=1;i<=10;i++) sum+=parseInt(cpf.substring(i-1,i))*(12-i); rest=(sum*10)%11; if(rest===10||rest===11)rest=0; if(rest!==parseInt(cpf.substring(10,11)))return false; return true; }

  

  // Creates & shows a small disclaimer modal; respects "don't show again"
  function showDisclaimerPopup() {
    if (document.getElementById('disclaimerPopup')) return;
    const popup = document.createElement('div');
    popup.id = 'disclaimerPopup';
    popup.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="disclaimerTitle">
        <h4 id="disclaimerTitle">✅ Aviso !</h4>
        <p>Para essa promoção em uma das nossas cozinhas industriais mais próximas de você, é possível selecionar apenas um combo de 2x1 por vez !</p>
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

    // allow ESC to close
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

