import { getJSON } from "./api.js";
import { toast }   from "./app.js";

/* ================= Normalizador ================= */
function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name ?? p.titulo ?? "Producto",
    brand: p.brand ?? p.marca ?? "",
    category_id: p.category_id ?? p.categoryId ?? p.category ?? p.categoria ?? "",
    price: Number(p.price ?? p.precio ?? 0),
    old_price: Number(p.old_price ?? p.precioAnterior ?? 0) || null,
    stock: Number(p.stock ?? 0),
    rating: Number(p.rating ?? 0),
    sold: Number(p.sold ?? p.vendidos ?? 0),
    images: p.images ?? p.imagenes ?? [],
    short_desc: p.short_desc ?? p.descripcion ?? ""
  };
}

/* ================= Estado ================= */
const NS      = "mini.";
const FAV_KEY = NS + "favs";

const state = {
  all: [],
  favs: new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")),
  filter: {
    q: "",
    cat: "",
    brand: "",
    pricePreset: "all",
    rating: null,
    favOnly: false,   // si luego se activa “Solo favoritos” desde UI
    sort: "relevance",
    inStock: false
  }
};

/* ================= Utils ================= */
const fmtCLP = n => "$" + Number(n).toLocaleString("es-CL") + " CLP";
function saveFavs() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs]));
  const el = document.getElementById("favCount");
  if (el) el.textContent = String(state.favs.size);
}

function addOneToCart(product, qty=1){
  const CART_KEY="mini.cart";
  const cart = JSON.parse(localStorage.getItem(CART_KEY)||'{"items":[]}');
  const line = cart.items.find(i=>i.productId===product.id);
  const next = (line?line.qty:0) + qty;
  const max  = Number(product.stock)||1;
  if (next>max) { toast("No hay stock suficiente.", "danger"); return false; }
  if (line) line.qty = next; else cart.items.push({ productId: product.id, qty });
  localStorage.setItem(CART_KEY, JSON.stringify({ ...cart, updatedAt:new Date().toISOString() }));
  return true;
}

function enableImageFallback(rootSelector) {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  if (!root) return;
  root.querySelectorAll("img").forEach(img => {
    img.onerror = () => { img.onerror = null; img.src = "img/placeholder.png"; };
  });
}

function updateSuggestions() {
  const dl = document.getElementById("qList");
  if (!dl) return;
  const q  = (state.filter.q || "").trim().toLowerCase();
  const set = new Set();
  state.all.forEach(p => {
    const name  = p.name || "";
    const brand = p.brand || "";
    if (!q || name.toLowerCase().includes(q) || brand.toLowerCase().includes(q)) {
      if (name)  set.add(name);
      if (brand) set.add(brand);
    }
  });
  dl.innerHTML = [...set].slice(0, 10).map(v => `<option value="${v}">`).join("");
}

/* ================= Cards ================= */
function getDiscountPct(p) {
  const old = Number(p.old_price || 0), now = Number(p.price || 0);
  if (old > now && now > 0) return Math.round((old - now) / old * 100);
  return null;
}

function card(p) {
  const img =
    (p.images && p.images[0]) ||
    "img/placeholder.png";

  const fav = state.favs.has(p.id);
  const heartClass = fav ? "bi-heart-fill text-danger" : "bi-heart";
  const pct = getDiscountPct(p);

  return `
  <div class="col-12 col-sm-6 col-md-4">
    <div class="card h-100 product-card">
      ${pct ? `<span class="badge bg-danger-subtle text-danger badge-discount">-${pct}%</span>` : ""}

      <!-- Acciones flotantes (chips) -->
      <div class="card-actions">
        <!-- Favorito -->
        <button class="card-action ${fav ? "fav-active" : ""}" data-fav="${p.id}" title="Favorito" aria-label="Favorito">
          <i class="bi ${heartClass}"></i>
        </button>
        <!-- Agregar al carrito (antes: rayo) -->
        <button class="card-action" data-buy="${p.id}" title="Agregar al carrito" aria-label="Agregar al carrito">
          <i class="bi bi-cart-plus"></i>
        </button>
        <!-- Vista rápida -->
        <button class="card-action" data-qv="${p.id}" title="Vista rápida" aria-label="Vista rápida">
          <i class="bi bi-eye"></i>
        </button>
      </div>

      <img src="${img}" class="card-img-top" alt="${p.name}"
           onerror="this.onerror=null;this.src='img/placeholder.png';">
      <div class="card-body d-flex flex-column">
        <div class="small text-muted mb-1">${p.brand || ""}</div>
        <h6 class="card-title mb-1 text-truncate" title="${p.name}">${p.name}</h6>
        <div class="small text-muted mb-2">${p.rating ? `★ ${p.rating.toFixed(1)} (${p.sold || 0})` : ""}</div>
        <div class="mt-auto fw-bold">
          ${fmtCLP(p.price)} ${p.old_price ? `<span class="price-old">${fmtCLP(p.old_price)}</span>` : ""}
        </div>

        <!-- Acciones visibles en mobile -->
        <div class="d-flex gap-2 mt-2 d-sm-none">
          <button class="btn btn-dark btn-sm flex-fill" data-buy="${p.id}">Comprar</button>
          <button class="btn btn-outline-secondary btn-sm flex-fill" data-qv="${p.id}">Ver rápido</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ================= Filtros ================= */
function getBrands(list){ return [...new Set(list.map(p => p.brand).filter(Boolean))].sort(); }

const PRICE_PRESETS = [
  { id:"all", label:"Todos", min:null, max:null },
  { id:"p1",  label:"Hasta $50.000", min:0, max:50000 },
  { id:"p2",  label:"$50.000 – $100.000", min:50000, max:100000 },
  { id:"p3",  label:"$100.000 – $200.000", min:100000, max:200000 },
  { id:"p4",  label:"Más de $200.000", min:200000, max:null }
];

function renderRadioList(containerId, name, values, getId, getLabel, selectedId){
  const c = document.getElementById(containerId);
  c.innerHTML = values.map(v => {
    const id = String(getId(v) ?? "");
    const label = getLabel(v);
    const checked = (selectedId ?? "all") === id ? "checked" : "";
    return `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="${name}" id="${name}-${id || "all"}" value="${id}" ${checked}>
        <label class="form-check-label" for="${name}-${id || "all"}">${label}</label>
      </div>`;
  }).join("");
}

function applyFilters() {
  const { q, cat, brand, pricePreset, rating, favOnly, sort, inStock } = state.filter;
  const qnorm = (q||"").trim().toLowerCase();
  const preset = PRICE_PRESETS.find(p => p.id === pricePreset) || PRICE_PRESETS[0];
  const pmin = preset.min, pmax = preset.max;

  let rows = state.all.filter(p => {
    if (favOnly && !state.favs.has(p.id)) return false;
    if (cat && p.category_id !== cat) return false;
    if (brand && p.brand !== brand) return false;
    if (inStock && !(Number(p.stock) > 0)) return false;
    if (pmin != null && p.price < pmin) return false;
    if (pmax != null && p.price > pmax) return false;
    if (rating && (p.rating || 0) < Number(rating)) return false;

    if (qnorm) {
      const hay = (p.name + " " + (p.brand||"")).toLowerCase();
      if (!hay.includes(qnorm)) return false;
    }
    return true;
  });

  switch (sort) {
    case "price_asc":  rows.sort((a,b)=>a.price-b.price); break;
    case "price_desc": rows.sort((a,b)=>b.price-a.price); break;
    case "rating_desc":rows.sort((a,b)=>(b.rating||0)-(a.rating||0)); break;
    case "sold_desc":  rows.sort((a,b)=>(b.sold||0)-(a.sold||0)); break;
    default: /* relevance */ break;
  }
  return rows;
}

const qParam = new URLSearchParams(location.search).get('q');
if (qParam) {
  state.filter.q = qParam;
  const qInput = document.getElementById('q');
  if (qInput) qInput.value = qParam;
}

function renderGrid() {
  const rows = applyFilters();
  const count = document.getElementById("count");
  if (count) count.textContent = String(rows.length);
  const grid = document.getElementById("grid");
  grid.innerHTML = rows.length ? rows.map(card).join("") : `<div class="text-muted">Sin resultados.</div>`;
  enableImageFallback("#grid");
}

/* ================= UI Filtros (aside) ================= */
function wireFilters(cats) {
  const $id = (x) => document.getElementById(x);
  const on  = (id, ev, fn) => { const el = $id(id); if (el) el.addEventListener(ev, fn); };

  // construir listas con guardas
  const brands = getBrands(state.all);

  const catList = $id("catList");
  if (catList) {
    renderRadioList("catList", "catRad",
      [{id:"", name:"Todos"}, ...cats],
      v => (v.id ?? v.slug ?? v.nombre ?? v) || "",
      v => (v.name ?? v.nombre ?? v) || "Todos",
      state.filter.cat || ""
    );
    catList.addEventListener("change", (e)=>{
      if (e.target.matches('input[type="radio"]')) { state.filter.cat = e.target.value; renderGrid(); }
    });
  }

  const brandList = $id("brandList");
  if (brandList) {
    renderRadioList("brandList", "brandRad",
      [{id:"", label:"Todos"}, ...brands.map(b=>({id:b,label:b}))],
      v => v.id ?? "",
      v => v.label ?? "Todos",
      state.filter.brand || ""
    );
    brandList.addEventListener("change", (e)=>{
      if (e.target.matches('input[type="radio"]')) { state.filter.brand = e.target.value; renderGrid(); }
    });
  }

  const priceList = $id("priceList");
  if (priceList) {
    renderRadioList("priceList", "priceRad",
      PRICE_PRESETS, v=>v.id, v=>v.label, state.filter.pricePreset || "all"
    );
    priceList.addEventListener("change", (e)=>{
      if (e.target.matches('input[type="radio"]')) { state.filter.pricePreset = e.target.value; renderGrid(); }
    });
  }

  // búsqueda con datalist
  on("q", "input", (()=>{ let t; return (e)=>{ clearTimeout(t); t=setTimeout(()=>{ state.filter.q=e.target.value; updateSuggestions(); renderGrid(); },250);} })());

  // rating, stock, sort
  on("rating", "change", (e)=>{ state.filter.rating = e.target.value || null; renderGrid(); });
  on("stockOnly","change", (e)=>{ state.filter.inStock = e.target.checked; renderGrid(); });
  on("sort",   "change", (e)=>{ state.filter.sort = e.target.value; renderGrid(); });

  // limpiar
  on("clear","click", ()=>{
    state.filter = { q:"", cat:"", brand:"", pricePreset:"all", rating:null, favOnly:false, sort:"relevance", inStock:false };
    if ($id("q"))      $id("q").value = "";
    if ($id("rating")) $id("rating").value = "";
    if ($id("sort"))   $id("sort").value = "relevance";
    if ($id("stockOnly")) $id("stockOnly").checked = false;

    if (catList)   renderRadioList("catList","catRad",[ {id:"",name:"Todos"},...cats ], v=>v.id??"", v=>v.name??v, "");
    if (brandList) renderRadioList("brandList","brandRad",[ {id:"",label:"Todos"},...brands.map(b=>({id:b,label:b})) ], v=>v.id, v=>v.label, "");
    if (priceList) renderRadioList("priceList","priceRad",PRICE_PRESETS, v=>v.id, v=>v.label, "all");

    updateSuggestions();
    renderGrid();
  });

  // Delegación en grid: favs y quick view (donde existe grid)
  const grid = $id("grid");
  if (grid) {
    document.getElementById("grid").addEventListener("click", (e) => {
  const favBtn = e.target.closest("[data-fav]");
  if (favBtn) {
    const pid = favBtn.getAttribute("data-fav");
    if (state.favs.has(pid)) { state.favs.delete(pid); toast("Quitado de favoritos.", "info"); }
    else { state.favs.add(pid); toast("Agregado a favoritos.", "success"); }
    saveFavs(); renderGrid(); return;
  }

  const buyBtn = e.target.closest("[data-buy]");
  if (buyBtn) {
    const pid = buyBtn.getAttribute("data-buy");
    const p = state.all.find(x => x.id === pid);
    if (!p) return;
    if (Number(p.stock)<=0) { toast("Sin stock.", "danger"); return; }
    if (addOneToCart(p, 1)) {
      toast("Agregado. Vamos a checkout…","success");
      window.location.href = "checkout.html";
    }
    e.preventDefault(); return;
  }

  const qvBtn = e.target.closest("[data-qv]");
  if (qvBtn) {
    const pid = qvBtn.getAttribute("data-qv");
    const p = state.all.find(x => x.id === pid);
    if (p) openProductModal(p);
    e.preventDefault();
  }
});

}

}

/* ================= Quick View ================= */
let qvProduct = null;

function clampQV(delta = 0) {
  const qty = document.getElementById("qvQty");
  const max = Number(qty.max) || 1;
  let v = Number(qty.value) || 1;
  v = Math.min(Math.max(1, v + delta), max);
  qty.value = String(v);
}

function openProductModal(p) {
  qvProduct = p;
  document.getElementById("qvTitle").textContent = p.name;
  document.getElementById("qvBrand").textContent = p.brand || "";
  document.getElementById("qvPrice").textContent = fmtCLP(p.price);
  document.getElementById("qvDesc").textContent  = p.short_desc || "";

  const img = (p.images && p.images[0]) || "img/placeholder.png";
  const qvImg = document.getElementById("qvImg");
  qvImg.src = img; qvImg.onerror = ()=>{ qvImg.onerror=null; qvImg.src="img/placeholder.png"; };

  // thumbs
  const thumbs = document.getElementById("qvThumbs");
  const imgs = Array.isArray(p.images) && p.images.length ? p.images : [img];
  thumbs.innerHTML = imgs.map(src => `
    <img src="${src}" data-src="${src}" class="qv-thumb" style="width:56px;height:56px;object-fit:cover;cursor:pointer;"
         onerror="this.onerror=null;this.src='img/placeholder.png';" alt="">
  `).join("");

  // stock
  const qty = document.getElementById("qvQty");
  const minus = document.getElementById("qvMinus");
  const plus  = document.getElementById("qvPlus");
  const add   = document.getElementById("qvAdd");
  const stockLbl = document.getElementById("qvStock");
  qty.value = "1"; qty.max = String(Math.max(1, p.stock || 1));
  if (Number(p.stock) > 0) {
    stockLbl.innerHTML = `<span class="badge text-bg-success">En stock: ${p.stock}</span>`;
    qty.disabled = false; minus.disabled = false; plus.disabled = false; add.disabled = false;
  } else {
    stockLbl.innerHTML = `<span class="badge text-bg-danger">Sin stock</span>`;
    qty.value = "0";
    qty.disabled = true; minus.disabled = true; plus.disabled = true; add.disabled = true;
  }

  // botón favorito del modal
  const favBtn = document.getElementById("qvFav");
  const isFav = state.favs.has(p.id);
  favBtn.innerHTML = isFav ? `<i class="bi bi-heart-fill text-danger"></i> Favorito` : `<i class="bi bi-heart"></i> Favorito`;

  new bootstrap.Modal(document.getElementById("quickModal")).show();
}

/* ================= Init ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const [prodRaw, catsRaw] = await Promise.all([
    getJSON("data/productos.json"),
    getJSON("data/categorias.json").catch(()=>[])
  ]);

  state.all = (prodRaw || []).map(normalizeProduct);
  saveFavs(); // actualiza contador favoritos

  const cats = Array.isArray(catsRaw) && catsRaw.length
    ? catsRaw
    : [...new Set(state.all.map(p=>p.category_id))].map(x=>({ id:String(x), name:String(x) }));

  renderGrid();
  updateSuggestions();
  wireFilters(cats);

  // Quick view listeners
  const thumbs = document.getElementById("qvThumbs");
  if (thumbs) thumbs.addEventListener("click", (e) => {
    const t = e.target.closest(".qv-thumb");
    if (!t) return;
    const qvImg = document.getElementById("qvImg");
    qvImg.src = t.dataset.src;
  });
  const minus = document.getElementById("qvMinus");
  const plus  = document.getElementById("qvPlus");
  const add   = document.getElementById("qvAdd");
  if (minus) minus.addEventListener("click", ()=>clampQV(-1));
  if (plus)  plus .addEventListener("click", ()=>clampQV(+1));
  if (add)   add  .addEventListener("click", ()=>{
    if (!qvProduct) return;
    const qty = Number(document.getElementById("qvQty").value)||1;
    const CART_KEY="mini.cart";
    const cart = JSON.parse(localStorage.getItem(CART_KEY)||'{"items":[]}');
    const line = cart.items.find(i=>i.productId===qvProduct.id);
    const next = (line?line.qty:0) + qty;
    const max  = Number(qvProduct.stock)||1;
    if (next>max) return toast("No hay stock suficiente.", "danger");
    if (line) line.qty = next; else cart.items.push({ productId:qvProduct.id, qty });
    localStorage.setItem(CART_KEY, JSON.stringify({ ...cart, updatedAt:new Date().toISOString() }));
    toast("Producto agregado al carrito.", "success");
  });
  const favBtn = document.getElementById("qvFav");
  if (favBtn) favBtn.addEventListener("click", ()=>{
    if (!qvProduct) return;
    if (state.favs.has(qvProduct.id)) { state.favs.delete(qvProduct.id); toast("Quitado de favoritos.","info"); }
    else { state.favs.add(qvProduct.id); toast("Agregado a favoritos.","success"); }
    saveFavs();
    favBtn.innerHTML = state.favs.has(qvProduct.id)
      ? `<i class="bi bi-heart-fill text-danger"></i> Favorito`
      : `<i class="bi bi-heart"></i> Favorito`;
    renderGrid();
  });
});