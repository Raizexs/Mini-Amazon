import { getJSON } from "./api.js";
import { toast }   from "./app.js";

function normalizeProduct(p){return{
  id:p.id,name:p.name??p.titulo??"Producto",brand:p.brand??p.marca??"",
  category_id:p.category_id??p.categoryId??p.category??p.categoria??"",
  price:Number(p.price??p.precio??0),stock:Number(p.stock??0),
  rating:Number(p.rating??0),images:p.images??p.imagenes??[],short_desc:p.short_desc??p.descripcion??""
};}
const FAV_KEY="mini.favs", CART_KEY="mini.cart";
const favs=new Set(JSON.parse(localStorage.getItem(FAV_KEY)||"[]"));

const fmt=n=>"$"+Number(n).toLocaleString("es-CL")+" CLP";
function enableFallback(root){(root||document).querySelectorAll("img").forEach(img=>{
  img.onerror=()=>{img.onerror=null;img.src="img/placeholder.png";}
});}

function render(list){
  const grid=document.getElementById("favGrid");
  if(!list.length){grid.innerHTML='<div class="alert alert-info">Aún no tienes favoritos.</div>';return;}
  grid.innerHTML=list.map(p=>{
    const img=(p.images&&p.images[0])||"img/placeholder.png";
    return `<div class="col-6 col-md-4"><div class="card h-100">
      <img src="${img}" class="card-img-top" alt="${p.name}">
      <div class="card-body d-flex flex-column">
        <h6 class="card-title mb-1">${p.name}</h6>
        <div class="small text-muted mb-2">${p.brand||""}</div>
        <div class="mt-auto">
          <div class="fw-bold">${fmt(p.price)}</div>
          <div class="d-grid gap-2 mt-2">
            <a href="producto.html?id=${p.id}" class="btn btn-outline-secondary btn-sm">Ver detalle</a>
            <button class="btn btn-primary btn-sm" data-move="${p.id}">Mover al carrito</button>
            <button class="btn btn-outline-danger btn-sm" data-del="${p.id}">Quitar</button>
          </div>
        </div>
      </div></div></div>`;
  }).join("");
  enableFallback(grid);
  grid.addEventListener("click",(e)=>{
    const mv=e.target.closest("[data-move]"); const dl=e.target.closest("[data-del]");
    if(mv){ moveToCart(mv.dataset.move); e.preventDefault(); }
    if(dl){ favs.delete(dl.dataset.del); saveFavs(); toast("Quitado de favoritos.","info"); init(); }
  });
}

function saveFavs(){ localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); }

function moveToCart(pid){
  const cart=JSON.parse(localStorage.getItem(CART_KEY)||'{"items":[]}');
  const line=cart.items.find(i=>i.productId===pid);
  if(line) line.qty+=1; else cart.items.push({productId:pid,qty:1});
  localStorage.setItem(CART_KEY, JSON.stringify({ ...cart, updatedAt:new Date().toISOString() }));
  toast("Movido al carrito.","success");
}

async function init(){
  const raw=await getJSON("data/productos.json");
  const all=(raw||[]).map(normalizeProduct).filter(p=>favs.has(p.id));
  render(all);
}
document.addEventListener("DOMContentLoaded", init);