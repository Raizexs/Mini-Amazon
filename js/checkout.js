import { getJSON } from "./api.js";
import { toast }   from "./app.js";

/* ===========================
   Normalizador y utilidades
   =========================== */
function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name ?? p.titulo ?? "Producto",
    brand: p.brand ?? p.marca ?? "",
    category_id: p.category_id ?? p.categoryId ?? p.category ?? p.categoria ?? "",
    price: Number(p.price ?? p.precio ?? 0),
    stock: Number(p.stock ?? 0),
    rating: Number(p.rating ?? 0),
    images: p.images ?? p.imagenes ?? [],
    short_desc: p.short_desc ?? p.descripcion ?? ""
  };
}

const CART_KEY   = "mini.cart";
const ORDERS_KEY = "mini.orders";
const IVA_RATE   = 0.19;
const fmtCLP = n => "$" + Number(n).toLocaleString("es-CL") + " CLP";

const readCart   = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || { items: [] }; } catch { return { items: [] }; } };
const writeCart  = (c) => localStorage.setItem(CART_KEY, JSON.stringify({ ...c, updatedAt: new Date().toISOString() }));
const readOrders = () => { try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch { return []; } };
const writeOrders= (arr) => localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));

/* ===========================
   Ubicaciones (región/comuna)
   =========================== */

async function loadLocations() {
  const data = await getJSON("data/localidades.json");
  return Array.isArray(data) ? data : [];
}
function fillRegions(locations) {
  const sel = document.getElementById("regionSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecciona...</option>` +
    locations.map(r => `<option value="${r.region}">${r.region}</option>`).join("");
}
function fillCities(locations, regionName) {
  const citySel = document.getElementById("citySelect");
  if (!citySel) return;
  const found = locations.find(r => r.region === regionName);
  const cities = found ? found.cities : [];
  citySel.innerHTML = `<option value="">Selecciona...</option>` +
    cities.map(c => `<option value="${c}">${c}</option>`).join("");
}

/* ===========================
   Teléfono: solo + y dígitos
   =========================== */

function enforcePhoneInput(el, min = 8, max = 11) {
  if (!el) return;
  el.addEventListener("input", () => {
    let v = el.value.replace(/[^\d+]/g, "");
    const hasPlus = v.includes("+");
    let digits = v.replace(/\D/g, "").slice(0, max);
    el.value = (hasPlus ? "+" : "") + digits;
    const liveInvalid = digits.length > 0 && digits.length < min;
    el.classList.toggle("is-invalid", liveInvalid);
  });
  el.addEventListener("blur", () => {
    const ok = /^\+?\d{8,15}$/.test(el.value);
    el.classList.toggle("is-invalid", !ok);
  });
}

/* ===========================
   Estado global del checkout
   =========================== */

const state = {
  products: [],
  cart: readCart(),
  shippingOptions: [],
  selectedShip: null,
  totals: { subtotal: 0, iva: 0, ship: 0, total: 0, discount: 0 },
  coupon: null,          // {code,type,value}
  captchaAns: 0,         // respuesta correcta del captcha
  payExpress: null       // "paypal" | "bancoestado" | "amazon" | "gpay"
};

/* ===========================
   Cupones
   =========================== */

async function loadCoupons(){
  try{
    const raw = await getJSON("data/cupones.json");
    const arr = Array.isArray(raw) ? raw : [];
    // Acepta code/codigo/cod y value/valor/monto/descuento; type/tipo
    return arr.map(c => ({
      code:  String(c.code ?? c.codigo ?? c.cod ?? "").toUpperCase(),
      type:  String(c.type ?? c.tipo ?? "").toLowerCase(), // "fixed" | "percent" | "ship"
      value: Number(c.value ?? c.valor ?? c.monto ?? c.descuento ?? 0)
    }));
  }catch(e){
    console.error("[COUPON] error cargando cupones:", e);
    return [];
  }
}

function aplicarCupon(code, allCoupons){
  const msg = document.getElementById("couponMsg");
  const show = (text, cls) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = "form-text " + cls; // reemplaza clases (quita d-none)
  };

  const c = String(code||"").trim().toUpperCase();
  const found = (allCoupons||[]).find(x => String(x.code||"").toUpperCase() === c);

  if (!c || !found){
    state.coupon = null;
    show("Cupón inválido.", "text-danger");
    toast("Cupón inválido", "danger");
    renderSummary();    // <— vuelve a pintar totales SIN descuento
    return;
  }

  state.coupon = found;    // {code, type: 'fixed'|'percent'|'ship', value}
  show(`Cupón aplicado: ${found.code}`, "text-success");
  toast("Cupón aplicado", "success");
  renderSummary();    // <— repinta con descuento/envío gratis
}

function wireCoupon(coupons){
  // Soporta "couponCode"/"btnCoupon" y "coupon"/"applyCoupon" (legacy)
  const input = document.getElementById("couponCode") || document.getElementById("coupon");
  const btn   = document.getElementById("btnCoupon")  || document.getElementById("applyCoupon");

  const apply = (e) => {
    e?.preventDefault?.();
    const code = (input?.value || "").trim();
    aplicarCupon(code, coupons); // setea state.coupon + renderSummary()
  };

  // Conecta ambos (click y Enter)
  btn?.addEventListener("click", apply);
  input?.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(e); });
}

/* ===========================
   Envíos
   =========================== */
async function loadShipping() {
  try {
    const s = await getJSON("data/envios.json");
    return Array.isArray(s) ? s : [];
  } catch { return []; }
}
function fillShippingSelect() {
  const sel = document.getElementById("shipping");
  if (!sel) return;
  const opts = state.shippingOptions
    .map(s => `<option value="${s.id}">${s.name} — ${fmtCLP(s.cost)}</option>`)
    .join("");
  sel.innerHTML = `<option value="">Selecciona...</option>` + opts;
}
function onShippingChange() {
  const sel = document.getElementById("shipping");
  if (!sel) return;
  const id  = sel.value;
  state.selectedShip = state.shippingOptions.find(s => String(s.id) === String(id)) || null;

  const costEl = document.getElementById("shippingCost");
  if (costEl){
    costEl.value    = fmtCLP(Number(state.selectedShip?.cost || 0));
    costEl.readOnly = true;
    costEl.disabled = true;
  }
  renderSummary();
}

/* ===========================
   Resumen (items y totales)
   =========================== */
function renderSummary() {
  const itemsWrap = document.getElementById("orderItems");

  // Unir carrito con catálogo
  const lines = (state.cart?.items || [])
    .map(it => {
      const p = state.products.find(x => String(x.id) === String(it.productId));
      const qty = Math.max(1, Number(it.qty) || 1);
      return p ? { p, qty } : null;
    })
    .filter(Boolean);

  if (!lines.length) {
    toast("Tu carrito está vacío.", "info");
    window.location.href = "cart.html";
    return;
  }

  // Render ítems
  if (itemsWrap) {
    itemsWrap.innerHTML = lines.map(({ p, qty }) => {
      const img = (p.images && p.images[0]) || (p.imagenes && p.imagenes[0]) || "img/placeholder.png";
      return `
        <div class="d-flex align-items-center gap-3">
          <img src="${img}" class="rounded" style="width:48px;height:48px;object-fit:cover"
               onerror="this.onerror=null;this.src='img/placeholder.png';" alt="${p.name}">
          <div class="flex-grow-1">
            <div class="fw-semibold">${p.name}</div>
            <div class="small text-muted">x${qty}</div>
          </div>
          <div class="fw-semibold">${fmtCLP(p.price * qty)}</div>
        </div>`;
    }).join("");
  }

  // Base
  const subtotal = lines.reduce((s, { p, qty }) => s + Number(p.price || 0) * qty, 0);

  // Envío seleccionado
  let ship = Number(state.selectedShip?.cost || 0);
  if (!Number.isFinite(ship) || ship < 0) ship = 0;

  // Cupón
  let discount = 0;
  if (state.coupon) {
    const t = String(state.coupon.type || "").toLowerCase();
    const v = Number(state.coupon.value || 0);
    if (t === "percent" && v > 0) discount = Math.round(subtotal * (v / 100));
    if (t === "fixed"   && v > 0) discount = Math.min(subtotal, v);
    if (t === "ship")               ship = 0; // ENVIOGRATIS
  }
  discount = Math.max(0, Math.min(discount, subtotal));

  // IVA calculado sobre base imponible (subtotal - descuento)
  const base = Math.max(0, subtotal - discount);
  const iva  = Math.round(base * IVA_RATE);
  const total = base + ship + iva;

  state.totals = { subtotal, discount, ship, iva, total };

  // Pintar
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("subTotal", fmtCLP(subtotal));
  set("disc",     fmtCLP(discount));
  set("ship",     fmtCLP(ship));
  set("iva",      fmtCLP(iva));
  set("total",    fmtCLP(total));

  // (Panel derecho alternativo)
  set("coSub",   fmtCLP(subtotal));
  set("coDisc",  discount ? "−" + fmtCLP(discount) : fmtCLP(0));
  set("coShip",  fmtCLP(ship));
  set("coIva",   fmtCLP(iva));
  set("coTotal", fmtCLP(total));
}

/* ===========================
   Validación (incluye CAPTCHA y pago)
   =========================== */

function setInvalid(input, cond) {
  if (!input) return;
  input.classList.toggle("is-invalid", !!cond);
}
function validateForm(showToast=false) {
  const phoneEl = document.getElementById("phone");
  const phoneOk = phoneEl ? /^\+?\d{8,15}$/.test(phoneEl.value) : true;

  const fields = {
    firstName:    document.getElementById("firstName"),
    lastName:     document.getElementById("lastName"),
    email:        document.getElementById("email"),
    address:      document.getElementById("address"),
    citySelect:   document.getElementById("citySelect"),
    regionSelect: document.getElementById("regionSelect"),
    shipping:     document.getElementById("shipping"),
    terms:        document.getElementById("terms")
  };

  setInvalid(fields.firstName,   !fields.firstName?.value.trim() || fields.firstName.value.length > 40);
  setInvalid(fields.lastName,    !fields.lastName?.value.trim()  || fields.lastName.value.length > 40);
  setInvalid(fields.email,       !(fields.email?.checkValidity() ?? true));
  setInvalid(phoneEl,            !phoneOk);
  setInvalid(fields.address,     !fields.address?.value.trim());
  setInvalid(fields.regionSelect,!fields.regionSelect?.value);
  setInvalid(fields.citySelect,  !fields.citySelect?.value);
  setInvalid(fields.shipping,    !fields.shipping?.value);
  setInvalid(fields.terms,       !fields.terms?.checked);

  // Tarjeta solo si paymethod=card (acepta ids cc* o card*)
  const payVal = document.querySelector('input[name="paymethod"]:checked')?.value;
  if (payVal === 'card') {
    const numEl = document.getElementById('ccNumber') || document.getElementById('cardNumber');
    const expEl = document.getElementById('ccExp')    || document.getElementById('cardExp');
    const cvvEl = document.getElementById('ccCvc')    || document.getElementById('cardCvv');

    const numOk = /^\d{13,19}$/.test((numEl?.value||"").replace(/\s+/g,""));
    const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test((expEl?.value||"").trim());
    const cvvOk = /^\d{3,4}$/.test((cvvEl?.value||"").trim());

    setInvalid(numEl, !numOk);
    setInvalid(expEl, !expOk);
    setInvalid(cvvEl, !cvvOk);
  }

  // CAPTCHA

  const capInput = document.getElementById("captchaA");
  const capMsg   = document.getElementById("captchaMsg");
  const capOk    = capInput ? Number(capInput.value) === state.captchaAns : true;
  if (capMsg) capMsg.classList.toggle("d-none", capOk);
  setInvalid(capInput, !capOk);

  const invalids =
    Object.values(fields).some(el => el?.classList.contains("is-invalid")) ||
    (payVal==='card' && (
      (document.getElementById('ccNumber')||document.getElementById('cardNumber'))?.classList.contains('is-invalid') ||
      (document.getElementById('ccExp')   ||document.getElementById('cardExp'))?.classList.contains('is-invalid') ||
      (document.getElementById('ccCvc')   ||document.getElementById('cardCvv'))?.classList.contains('is-invalid')
    )) ||
    !capOk;

  if (invalids && showToast) toast("Revisa los campos marcados.", "danger");
  return !invalids;
}

/* ===========================
   Orden
   =========================== */

function placeOrder() {
  const items = state.cart.items.map(it => {
    const p = state.products.find(x => String(x.id) === String(it.productId));
    return p ? { productId: p.id, name: p.name, price: p.price, qty: Math.max(1, Number(it.qty)||1) } : null;
  }).filter(Boolean);

  const buyer = {
    firstName: document.getElementById("firstName")?.value.trim(),
    lastName:  document.getElementById("lastName")?.value.trim(),
    email:     document.getElementById("email")?.value.trim(),
    phone:     document.getElementById("phone")?.value.trim(),
    address:   document.getElementById("address")?.value.trim(),
    city:      document.getElementById("citySelect")?.value,
    region:    document.getElementById("regionSelect")?.value
  };

  let paymethod = "card";
  if (state.payExpress) {
    paymethod = "express:" + state.payExpress;
  } else {
    paymethod = document.querySelector('input[name="paymethod"]:checked')?.value || "card";
  }

  const order = {
    id: "ORD-" + Date.now(),
    createdAt: new Date().toISOString(),
    items,
    totals: state.totals,
    shipping: {
      id: state.selectedShip?.id || null,
      name: state.selectedShip?.name || "",
      cost: Number(state.selectedShip?.cost || 0)
    },
    buyer,
    paymethod,
    status: "Creada"
  };

  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  writeCart({ items: [] });

  const okText = document.getElementById("orderOkText");
  if (okText) okText.textContent = `Tu orden ${order.id} se creó correctamente por ${fmtCLP(order.totals.total)}.`;
  const modalEl = document.getElementById("orderOkModal");
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

/* ===========================
   CAPTCHA
   =========================== */

function genCaptcha(){
  const a = Math.floor(2 + Math.random()*8);
  const b = Math.floor(2 + Math.random()*8);
  state.captchaAns = a + b;
  const q = document.getElementById("captchaQ");
  if (q) q.textContent = `${a} + ${b} =`;
  const aEl = document.getElementById("captchaA");
  if (aEl) aEl.value = "";
  const m = document.getElementById("captchaMsg");
  if (m) m.classList.add("d-none");
}

/* ===========================
   Pago (radios y express)
   =========================== */

function wirePaymentRadios(){
  const radios  = document.querySelectorAll('input[name="paymethod"]');
  const cardBox = document.getElementById('cardBox'); // tarjeta
  const bankBox = document.getElementById('instBox'); // transferencia 
  const reqIds  = ['ccNumber','ccExp','ccCvc','cardNumber','cardExp','cardCvv']; // soporta ambos

  function toggle(){
    const val = document.querySelector('input[name="paymethod"]:checked')?.value;
    const isCard = (val === 'card');
    cardBox?.classList.toggle('d-none', !isCard);
    bankBox?.classList.toggle('d-none',  isCard);
    reqIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.required = isCard;
    });
  }
  radios.forEach(r => r.addEventListener('change', toggle));
  toggle();
}
function wireExpressPay(){
  document.querySelectorAll('[data-pay]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.payExpress = btn.getAttribute('data-pay'); // paypal | bancoestado | amazon | gpay
      toast("Pago rápido seleccionado: " + state.payExpress, "info");
      // ocultar cajas visualmente
      document.getElementById("cardBox")?.classList.add("d-none");
      document.getElementById("instBox")?.classList.add("d-none");
      // deseleccionar radios
      const checked = document.querySelector('input[name="paymethod"]:checked');
      if (checked) checked.checked = false;
    });
  });
}

/* ===========================
   Init
   =========================== */
   
document.addEventListener("DOMContentLoaded", async () => {
  // ---------- helper: (re)habilitar botón Confirmar ----------
  const enable = () => {
    const btn = document.getElementById("btnPlace");
    if (btn) btn.disabled = !validateForm(false);
  };

  // ---------- Cupones ----------
  const coupons = await loadCoupons();
  wireCoupon(coupons);   // <— usa la función de arriba
  document.getElementById("couponCode")?.addEventListener("input", () => {
  const btn = document.getElementById("btnPlace");
  if (btn) btn.disabled = !validateForm(false);
});

  // ---------- Productos + ubicaciones ----------
  const [productsRaw, locations] = await Promise.all([
    getJSON("data/productos.json"),
    loadLocations()
  ]);
  state.products = (productsRaw || []).map(normalizeProduct);

  // ---------- Envíos ----------
  state.shippingOptions = await loadShipping();
  fillShippingSelect();
  document.getElementById("shipping")?.addEventListener("change", () => {
    onShippingChange();  // pone costo y llama renderSummary()
    enable();
  });
  onShippingChange(); // inicial (también hace renderSummary)

  // ---------- Regiones / Comunas ----------
  fillRegions(locations);
  const regionSel = document.getElementById("regionSelect");
  const citySel   = document.getElementById("citySelect");

  regionSel?.addEventListener("change", (e) => {
    fillCities(locations, e.target.value);
    if (citySel) { citySel.value = ""; setInvalid(citySel, !citySel.value); }
    setInvalid(regionSel, !regionSel.value);
    enable();
  });
  citySel?.addEventListener("change", () => { setInvalid(citySel, !citySel.value); enable(); });

  // ---------- Teléfono ----------
  enforcePhoneInput(document.getElementById("phone"), 8, 11);
  document.getElementById("phone")?.addEventListener("blur", enable);

  // ---------- CAPTCHA ----------
  genCaptcha();
  document.getElementById("captchaRefresh")?.addEventListener("click", () => { genCaptcha(); enable(); });
  document.getElementById("captchaA")?.addEventListener("input", () => enable());

  // ---------- Pago (radios tarjeta/transferencia + express) ----------
  wirePaymentRadios();    // muestra/oculta #cardBox / #instBox
  document.querySelectorAll('input[name="paymethod"]').forEach(r =>
    r.addEventListener("change", enable)
  );
  wireExpressPay?.();     // se cumple esta función en el archivo
  // Asegura enable() al elegir un express
  document.querySelectorAll('[data-pay]').forEach(btn =>
    btn.addEventListener("click", () => setTimeout(enable, 0))
  );

  // ---------- Form submit + botón Confirmar ----------
  // Soporta Enter dentro del form
  document.getElementById("coForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (validateForm(true)) placeOrder();
  });
  // Click en Confirmar
  document.getElementById("btnPlace")?.addEventListener("click", () => {
    if (validateForm(true)) placeOrder();
  });

  // Re-evaluar al interactuar con cualquier control del form
  document.getElementById("coForm")?.addEventListener("input", enable);
  document.getElementById("coForm")?.addEventListener("change", enable);

  // ---------- Render inicial + habilitado inicial ----------
  renderSummary();
  enable();
});