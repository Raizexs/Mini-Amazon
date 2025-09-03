import { getJSON } from "./api.js";
import { toast }   from "./app.js";

// --- Normalizador ---
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

// --- Utils ---

const NS = "mini.";
const CART_KEY = NS + "cart";
const IVA_RATE = 0.19;

function fmtCLP(n) { return "$" + Number(n).toLocaleString("es-CL") + " CLP"; }
function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || { items: [] }; }
  catch { return { items: [] }; }
}
function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify({ ...cart, updatedAt: new Date().toISOString() }));
}

// Fallback imágenes rotas
function enableImageFallback(rootSelector) {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  if (!root) return;
  root.querySelectorAll("img").forEach(img => {
    img.onerror = () => { img.onerror = null; img.src = "img/placeholder.png"; };
  });
}

// --- Estado ---
const state = {
  products: [],    // normalizados
  cart: readCart(),   // { items:[{productId, qty}] }
  pendingRemove: null
};

// --- Render ---
async function render() {
  const tbody = document.getElementById("cartBody");
  const empty = document.getElementById("empty");
  const wrap  = document.getElementById("cartWrap");

  // Une items con productos
  const lines = state.cart.items
    .map(it => {
      const p = state.products.find(x => x.id === it.productId);
      return p ? { p, qty: Number(it.qty) || 1 } : null;
    })
    .filter(Boolean);

  if (lines.length === 0) {
    empty.classList.remove("d-none");
    wrap.classList.add("d-none");
    document.getElementById("subTotal").textContent = fmtCLP(0);
    document.getElementById("iva").textContent      = fmtCLP(0);
    document.getElementById("total").textContent    = fmtCLP(0);
    return;
  }

  empty.classList.add("d-none");
  wrap.classList.remove("d-none");

  tbody.innerHTML = lines.map(({ p, qty }) => {
    const img = (p.images && p.images[0]) || "img/placeholder.png";
    const max = Math.max(1, Number(p.stock) || 1);
    const unit = p.price;
    const sub = unit * qty;

    return `
      <tr data-id="${p.id}">
        <td><img src="${img}" class="rounded" alt="${p.name}" style="width:48px;height:48px;object-fit:cover;"></td>
        <td>
          <div class="fw-semibold">${p.name}</div>
          <div class="small text-muted">${p.brand || ""}</div>
        </td>
        <td class="text-end">${fmtCLP(unit)}</td>
        <td>
          <div class="input-group input-group-sm" style="max-width:170px;">
            <button class="btn btn-outline-secondary" data-qty="dec">−</button>
            <input type="number" class="form-control text-center" min="1" max="${max}" value="${qty}">
            <button class="btn btn-outline-secondary" data-qty="inc">+</button>
          </div>
          <div class="form-text text-danger d-none" data-err="stock">Máximo stock: ${max}</div>
        </td>
        <td class="text-end">${fmtCLP(sub)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-remove>Quitar</button>
        </td>
      </tr>
    `;
  }).join("");

  // setTotals(subtotal);

  enableImageFallback("#cartBody");

  // Totales
  const subtotal = lines.reduce((s, { p, qty }) => s + p.price * qty, 0);
  const iva = Math.round(subtotal * IVA_RATE);
  const total = subtotal + iva;
  document.getElementById("subTotal").textContent = fmtCLP(subtotal);
  document.getElementById("iva").textContent      = fmtCLP(iva);
  document.getElementById("total").textContent    = fmtCLP(total);
}

// --- Eventos tabla ---
function onTableClick(e) {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const pid = tr.getAttribute("data-id");
  const item = state.cart.items.find(i => i.productId === pid);
  if (!item) return;

  // +/- cantidad
  const btn = e.target.closest("button[data-qty]");
  if (btn) {
    const input = tr.querySelector('input[type="number"]');
    const max = Number(input.getAttribute("max")) || 1;
    let val = Number(input.value) || 1;
    val += (btn.dataset.qty === "inc" ? 1 : -1);
    val = Math.min(Math.max(1, val), max);
    input.value = String(val);
    item.qty = val;
    writeCart(state.cart);
    render();
    if (val === max && btn.dataset.qty === "inc") {
      toast("Alcanzaste el stock disponible.", "info");
    }
    return;
  }

  // eliminar
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const p = state.products.find(x => x.id === pid);
    state.pendingRemove = pid;
    document.getElementById("rmName").textContent = p ? p.name : "este producto";
    new bootstrap.Modal(document.getElementById("removeModal")).show();
  }
}

function onTableInput(e) {
  const input = e.target.closest('tr[data-id] input[type="number"]');
  if (!input) return;
  const tr = e.target.closest("tr[data-id]");
  const pid = tr.getAttribute("data-id");
  const item = state.cart.items.find(i => i.productId === pid);
  if (!item) return;

  const max = Number(input.getAttribute("max")) || 1;
  let val = Number(input.value) || 1;
  if (val > max) {
    val = max;
    input.value = String(val);
    tr.querySelector('[data-err="stock"]').classList.remove("d-none");
    toast("No hay stock suficiente.", "danger");
  } else {
    tr.querySelector('[data-err="stock"]').classList.add("d-none");
  }
  if (val < 1) val = 1;
  item.qty = val;
  writeCart(state.cart);
  render();
}

// --- Acciones globales ---
function clearCart() {
  state.cart = { items: [] };
  writeCart(state.cart);
  render();
  toast("Carrito vaciado.", "info");
}

function confirmRemove() {
  if (!state.pendingRemove) return;
  state.cart.items = state.cart.items.filter(i => i.productId !== state.pendingRemove);
  state.pendingRemove = null;
  writeCart(state.cart);
  render();
  toast("Producto removido del carrito.", "info");
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  // Carga productos y normaliza
  const raw = await getJSON("data/productos.json");
  state.products = (raw || []).map(normalizeProduct);

  // Limpia ítems que no existan o sin stock
  state.cart.items = state.cart.items.filter(it => {
    const p = state.products.find(x => x.id === it.productId);
    return !!p;
  });
  writeCart(state.cart);

  // Eventos
  document.getElementById("cartBody").addEventListener("click", onTableClick);
  document.getElementById("cartBody").addEventListener("input", onTableInput);
  document.getElementById("clearCart").addEventListener("click", clearCart);
  document.getElementById("confirmRemove").addEventListener("click", confirmRemove);

  render();
});