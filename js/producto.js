import { getJSON } from "./api.js";
import { store } from "./tienda.js";
import { toast } from "./app.js?v=2";

function $(sel, root = document) { return root.querySelector(sel); }
function fmtCLP(n) { return `$${Number(n).toLocaleString("es-CL")} CLP`; }
function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}


const state = {
  product: null,
  products: [],
  reviews: [],
  qty: 1
};

function enableImageFallback(rootSelector) {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  if (!root) return;
  root.querySelectorAll("img").forEach(img => {
    img.onerror = () => {
      img.onerror = null;                 
      img.src = "img/placeholder.png";  
    };
  });
}

function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name ?? p.titulo ?? "Producto",
    brand: p.brand ?? p.marca ?? "",
    category_id: p.category_id ?? p.categoryId ?? p.category ?? p.categoria ?? "",
    price: Number(p.price ?? p.precio ?? 0),
    list_price: Number(p.list_price ?? p.precio_lista ?? 0),
    stock: Number(p.stock ?? 0),
    rating: Number(p.rating ?? 0),
    images: p.images ?? p.imagenes ?? [],
    short_desc: p.short_desc ?? p.descripcion ?? "",
    tags: Array.isArray(p.tags) ? p.tags : (p.destacado ? ["destacado"] : []),
    specs: p.specs ?? p.especificaciones ?? p.specsList ?? null
  };
}

function renderSpecs(prod){
  const listEl  = document.getElementById("specsList");            // UL (nuevo)
  const tbodyEl = document.querySelector("#specsTable tbody");     // tabla (compat)

  // 1) Convertimos lo que venga a pares [clave, valor]
  let pairs = [];
  const s = prod?.specs;

  if (s && typeof s === "object") {
    if (Array.isArray(s)) {
      // array de objetos o strings
      pairs = s.map(item => {
        if (item && typeof item === "object") {
          const [k, v] = Object.entries(item)[0] || ["", ""];
          return [String(k), String(v)];
        }
        return [String(item), ""];
      });
    } else {
      // objeto {clave: valor}
      pairs = Object.entries(s).map(([k, v]) => [String(k), String(v)]);
    }
  }

  // 2) Fallback por categoría si no hay nada en JSON
  if (!pairs.length) {
    const cat = (prod.category_id || prod.categoria || prod.category || "").toLowerCase();
    const fallback = {
      electronica: [["Garantía", "12 meses"]],
      libros:      [["Encuadernación", "Tapa blanda"]],
      moda:        [["Material", "Algodón"]],
      hogar:       [["Garantía", "6 meses"]],
      juguetes:    [["Edad recomendada", "3+"]],
      deportes:    [["Material", "Sintético"]]
    }[cat] || [];
    pairs = fallback;
  }

  // 3) Pintado seguro (si no hay contenedor, no pasa nada)
  if (listEl) {
    listEl.innerHTML = pairs.length
      ? pairs.map(([k,v]) =>
          `<li class="d-flex gap-2"><span class="text-muted">${k}:</span><span>${v}</span></li>`
        ).join("")
      : `<li class="text-muted">Sin especificaciones.</li>`;
  } else if (tbodyEl) {
    tbodyEl.innerHTML = pairs.length
      ? pairs.map(([k,v]) =>
          `<tr><th class="text-muted fw-normal">${k}</th><td>${v}</td></tr>`
        ).join("")
      : `<tr><td class="text-muted" colspan="2">Sin especificaciones.</td></tr>`;
  }
}

function setQty(n) {
  const input = document.getElementById("qty");
  const maxStock = Number(input?.getAttribute("max")) || 1;
  const val = Math.min(Math.max(1, Number(n) || 1), maxStock);
  if (input) input.value = String(val);

  // (Opcional) deshabilita ± cuando tope/1
  const minus = document.getElementById("qtyMinus");
  const plus  = document.getElementById("qtyPlus");
  if (minus) minus.disabled = val <= 1;
  if (plus)  plus.disabled  = val >= maxStock;

  return val;
}


function renderProduct(p) {
  $("#pName").textContent = p.name;
  $("#bcName").textContent = p.name;
  $("#pBrand").textContent = p.brand || "";
  $("#pPrice").textContent = fmtCLP(p.price);
  $("#pListPrice").textContent = (p.list_price && p.list_price > p.price) ? fmtCLP(p.list_price) : "";
  const ratingEl = $("#pRating");
  if (p.rating) {
    ratingEl.textContent = `★ ${p.rating.toFixed(1)}`;
    ratingEl.hidden = false;
  } else {
    ratingEl.hidden = true;
  }
  $("#pShort").textContent = p.short_desc || "";

  // Stock badge
  const sb = $("#pStockBadge");
  if (p.stock > 0) {
    sb.className = "badge text-bg-success";
    sb.textContent = `En stock (${p.stock} uds)`;
    $("#btnAdd").disabled = false;
  } else {
    sb.className = "badge text-bg-secondary";
    sb.textContent = "Sin stock";
    $("#btnAdd").disabled = true;
  }

  // Imagen principal + thumbs
  const main = document.getElementById("mainImg");
  const imgs = Array.isArray(p.images) && p.images.length ? p.images : ["img/placeholder.png"];
  main.src = imgs[0];
  main.alt = p.name;
  main.onerror = () => { main.onerror = null; main.src = "img/placeholder.png"; };

  const thumbs = $("#thumbs");
  thumbs.innerHTML = imgs.map((src, i) => `
  <img src="${src}" alt="thumb ${i+1}" data-src="${src}"
       class="rounded border" style="height:64px;cursor:pointer;">
  `).join("");
  enableImageFallback("#thumbs");

  thumbs.addEventListener("click", (e) => {
    const img = e.target.closest("img[data-src]");
    if (!img) return;
    main.src = img.dataset.src;
  });

  // Especificaciones
  const tbody = $("#specsTable tbody");
  const specs = p.specs || {};
  tbody.innerHTML = Object.keys(specs).map(k => `
    <tr><th class="w-25 text-capitalize">${k}</th><td>${specs[k]}</td></tr>
  `).join("") || `<tr><td class="text-muted">Sin especificaciones</td></tr>`;
  if (!p) return;
}

const CART_KEY = "mini.cart";
function readCart()  { try { return JSON.parse(localStorage.getItem(CART_KEY)) || { items: [] }; } catch { return { items: [] }; } }
function writeCart(c) { localStorage.setItem(CART_KEY, JSON.stringify({ ...c, updatedAt:new Date().toISOString() })); }

function addToCart(p, qty) {
  const cart = readCart();
  const line = cart.items.find(i => i.productId === p.id);
  const next = (line ? line.qty : 0) + Number(qty || 1);
  const max  = Number(p.stock) || 1;
  if (next > max) { toast("No hay stock suficiente.", "danger"); return false; }
  if (line) line.qty = next; else cart.items.push({ productId: p.id, qty: Number(qty || 1) });
  writeCart(cart);
  toast("Producto agregado al carrito.", "success");
  return true;
}

function getReviewPid(r) {
  if (!r || typeof r !== "object") return null;
  return r.product_id ?? r.productId ?? r.product ?? r.pid ?? r.id_producto ?? r.producto_id ?? null;
}

function renderReviews(allReviews, productId) {
  const list = document.getElementById("reviews");
  const summary = document.getElementById("reviewsSummary");
  if (!list || !summary) return;

  const pidStr = String(productId ?? "");
  const arr = Array.isArray(allReviews) ? allReviews : [];

  console.log("[reviews] pid =", pidStr, "total =", arr.length);

  const rows = arr.filter(r => String(getReviewPid(r) ?? "") === pidStr);

  if (rows.length === 0) {
    summary.textContent = "Aún no hay reseñas.";
    list.innerHTML = "";
    return;
  }

  const avg = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length;
  summary.textContent = `${rows.length} reseña(s) — promedio ${avg.toFixed(1)} ★`;

  list.innerHTML = rows.map(r => `
    <div class="list-group-item">
      <div class="d-flex justify-content-between">
        <strong>${r.user || r.usuario || "Anónimo"}</strong>
        <span class="badge text-bg-warning">★ ${(Number(r.rating)||0).toFixed(1)}</span>
      </div>
      <div class="small text-muted">${r.date || r.fecha || ""}</div>
      <p class="mb-0">${r.comment || r.comentario || ""}</p>
    </div>
  `).join("");
}

const getCategory = (p) => p.category_id ?? p.categoryId ?? p.category ?? p.categoria ?? null;
const getRating   = (p) => Number(p.rating ?? 0);

function cardRelacionado(p) {
  const img = (p.images && p.images[0]) || "img/placeholder.png";
  const precio = (Number(p.price) || 0).toLocaleString("es-CL");
  return `
    <div class="col-6 col-md-3">
      <div class="card h-100">
        <img src="${img}" class="card-img-top" alt="${p.name}">
        <div class="card-body d-flex flex-column">
          <h6 class="card-title mb-1">${p.name}</h6>
          <div class="small text-muted mb-2">${p.brand || ""}</div>
          <div class="mt-auto">
            <div class="fw-bold">$${precio} CLP</div>
            <a href="producto.html?id=${p.id}" class="btn btn-sm btn-outline-secondary mt-2 w-100">Ver detalle</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRelacionados(productos, pActual) {
  const cont = document.getElementById("related");
  if (!cont) return;

  const pool = (productos || []).filter(x => x.id !== pActual.id)
                                .sort((a,b) => (b.rating||0)-(a.rating||0));
  const top = pool.slice(0, 4);

  cont.innerHTML = top.length
    ? top.map(cardRelacionado).join("")
    : `<div class="text-muted">No hay relacionados.</div>`;
}

function cardHTML(p) {
  const img = (p.images && p.images[0]) || "img/placeholder.png";
  const price = fmtCLP(p.price);
  const list = p.list_price && p.list_price > p.price ? `<small class="text-muted text-decoration-line-through ms-1">${fmtCLP(p.list_price)}</small>` : "";
  const badge = p.rating ? `<span class="badge text-bg-warning">★ ${p.rating.toFixed(1)}</span>` : "";
  return `
  <div class="col-6 col-md-3">
    <div class="card h-100">
      <img src="${img}" class="card-img-top" alt="${p.name}">
      <div class="card-body d-flex flex-column">
        <h6 class="card-title mb-1">${p.name}</h6>
        <div class="small text-muted mb-2">${p.brand || ""} ${badge}</div>
        <div class="mt-auto">
          <div class="fw-bold">${price}${list}</div>
          <div class="d-grid gap-2 mt-2">
            <a href="product.html?id=${p.id}" class="btn btn-sm btn-outline-secondary">Ver detalle</a>
            <button class="btn btn-sm btn-primary" data-add="${p.id}" ${p.stock>0?"":"disabled"}>Agregar</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderRelated(all, current) {
  const same = all.filter(x => x.category_id === current.category_id && x.id !== current.id);
  const top = same.slice(0, 4);
  $("#related").innerHTML = top.map(cardHTML).join("") || `<div class="text-muted">No hay relacionados.</div>`;

  $("#related").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-add]");
    if (!btn) return;
    const p = all.find(x => x.id === btn.dataset.add);
    if (!p) return;
    if (addToCart(p, 1)) toast("Producto agregado.", "success");
  }, { once: true });
}

const asNumber = v => Number.parseInt(`${v}`, 10) || 0;

function bindQtyControls() {
  const minus = document.getElementById("qtyMinus");
  const plus  = document.getElementById("qtyPlus");
  const inp   = document.getElementById("qty");

  minus.addEventListener("click", () => setQty(state.qty - 1));
  plus.addEventListener("click",  () => setQty(state.qty + 1));

  // Enforce en TODOS los eventos comunes del input
  ["input","change","blur","keyup"].forEach(evt => {
    inp.addEventListener(evt, () => setQty(inp.value));
  });
}

function paintReviews(rows) {
  const list = document.getElementById("reviews");
  const summary = document.getElementById("reviewsSummary");
  if (!list || !summary) return;

  if (!rows.length) {
    summary.textContent = "Aún no hay reseñas.";
    list.innerHTML = "";
    return;
  }
  const avg = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length;
  summary.textContent = `${rows.length} reseña(s) — promedio ${avg.toFixed(1)} ★`;

  list.innerHTML = rows.map(r => `
    <div class="list-group-item">
      <div class="d-flex justify-content-between">
        <strong>${r.user || "Anónimo"}</strong>
        <span class="badge text-bg-warning">★ ${(Number(r.rating)||0).toFixed(1)}</span>
      </div>
      <div class="small text-muted">${r.date || ""}</div>
      <p class="mb-0">${r.comment || ""}</p>
    </div>
  `).join("");
}



async function init() {
  try {
    const id = getParam("id");
    if (!id) {
      toast("Producto no especificado.", "danger");
      window.location.href = "catalogo.html";
      return;
    }

    const [products, reviews] = await Promise.all([
      getJSON("data/products.json"),
      getJSON("data/reviews.json")
    ]);

    state.products = products;
    state.reviews = reviews;

    const p = products.find(x => x.id === id);
    if (!p) {
      toast("Producto no encontrado.", "danger");
      window.location.href = "catalogo.html";
      return;
    }
    state.product = p;

    renderProduct(p);
    bindQtyControls(p.stock);
    setQty(1);
    renderReviews(reviews, p.id);
    renderRelated(products, p);

    setQty(document.getElementById("qty").value); // vuelve a acotar por si acaso
    if (addToCart(p, state.qty)) { /* ...modal... */ }
    
    const getReviewPid = (r) =>
      r.product_id ?? r.productId ?? r.product ?? r.pid ?? r.id_producto ?? r.producto_id ?? null;

    const qtyInput = document.getElementById("qty");
      qtyInput.setAttribute("max", String(Math.max(1, Number(p.stock || 0))));
      setQty(1); // inicializa visible y limita

// Conecta ± e input para que siempre respete el tope
    document.getElementById("qtyMinus").addEventListener("click", () => {
      setQty(Number(qtyInput.value) - 1);
    });
    document.getElementById("qtyPlus").addEventListener("click", () => {
      setQty(Number(qtyInput.value) + 1);
    });
    ["input","change","blur","keyup"].forEach(evt => {
      qtyInput.addEventListener(evt, () => setQty(qtyInput.value));
    });

// (Opcional) Si no hay stock, se bloquea
    if (Number(p.stock) <= 0) {
      qtyInput.value = "0";
      qtyInput.disabled = true;
    const btnAdd = document.getElementById("btnAdd");
      if (btnAdd) btnAdd.disabled = true;
  }

    // Agregar al carrito
    
    $("#btnAdd").addEventListener("click", () => {
      if (addToCart(p, state.qty)) {
        $("#addedText").textContent = `Se agregó "${p.name}" (x${state.qty}) al carrito.`;
        const modal = new bootstrap.Modal($("#addedModal"));
        modal.show();
      }
    });

  } catch (err) {
    console.error(err);
    toast("No se pudo cargar el producto. Intenta más tarde.", "danger");
  }
}

async function cargarResenas() {
    const id = getParam("id");   // viene de producto.html
        if (!id) return;
    
    const [productos, reviews] = await Promise.all([
        getJSON("data/productos.json"),
        getJSON("data/reviews.json")
    ]);

    const producto = (productos || []).find(p => String(p.id) === String(id));
        if (!producto) return;

    renderReviews(reviews, producto.id);
}

document.addEventListener("DOMContentLoaded", async () => {
  const id = getParam("id");

  try {
    const [productosRaw, reviews] = await Promise.all([
      getJSON("data/productos.json"),
      getJSON("data/reviews.json")
    ]);
    const productos = (productosRaw || []).map(normalizeProduct);

    const p = productos.find(x => String(x.id) === String(id));
    if (!p) {
      toast("Producto no encontrado.", "danger");
      return;
    }

    renderProduct(p);
    renderRelacionados(productos, p);
    enableImageFallback("#related");
    

    const qtyInput = document.getElementById("qty");
    qtyInput.setAttribute("max", String(Math.max(1, Number(p.stock || 0))));
    setQty(1);
    document.getElementById("qtyMinus").addEventListener("click", () => setQty(Number(qtyInput.value) - 1));
    document.getElementById("qtyPlus").addEventListener("click",  () => setQty(Number(qtyInput.value) + 1));
    ["input","change","blur","keyup"].forEach(evt => {
      qtyInput.addEventListener(evt, () => setQty(qtyInput.value));
    });

    const btnAdd = document.getElementById("btnAdd");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const qty = setQty(qtyInput.value); // re-clamp
        if (typeof addToCart === "function") addToCart(p, qty);
      });
    }

    renderReviews(reviews, p.id);

  } catch (err) {
    console.error(err);
    toast("Error cargando datos del producto.", "danger");
  }
});
