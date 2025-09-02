const ORDERS_KEY = "mini.orders";
const fmtCLP = n => "$" + Number(n).toLocaleString("es-CL") + " CLP";

function readOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
  catch { return []; }
}

function render() {
  const list = document.getElementById("ordersList");
  const orders = readOrders();

  if (!orders.length) {
    list.innerHTML = `<div class="alert alert-info">Aún no tienes órdenes.</div>`;
    return;
  }

  list.innerHTML = orders.map(o => `
    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">Orden ${o.id}</div>
            <div class="small text-muted">${new Date(o.createdAt).toLocaleString("es-CL")}</div>
          </div>
          <span class="badge text-bg-success">${o.status || "Creada"}</span>
        </div>
        <hr>
        <div class="row">
          <div class="col-12 col-md-8">
            ${o.items.map(it => `
              <div class="d-flex justify-content-between">
                <div>${it.name} <span class="text-muted">x${it.qty}</span></div>
                <div>${fmtCLP(it.price * it.qty)}</div>
              </div>
            `).join("")}
          </div>
          <div class="col-12 col-md-4">
            <div class="d-flex justify-content-between"><span>Subtotal</span><strong>${fmtCLP(o.totals.subtotal)}</strong></div>
            <div class="d-flex justify-content-between"><span>IVA (19%)</span><strong>${fmtCLP(o.totals.iva)}</strong></div>
            <div class="d-flex justify-content-between"><span>Envío</span><strong>${fmtCLP(o.totals.ship)}</strong></div>
            <hr>
            <div class="d-flex justify-content-between fs-5"><span>Total</span><strong>${fmtCLP(o.totals.total)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", render);
