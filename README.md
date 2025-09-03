# Mini-Amazon (Frontend puro + Apache + JSON)

Proyecto académico de e-commerce **sin framework** (HTML/CSS/JS puro) servido por **Apache (XAMPP/WAMP/LAMP)**.
Datos en **JSON** y estado con **localStorage**. UI con **Bootstrap 5** + modo **claro/oscuro**.

## 🎯 Objetivo

Construir un mini-marketplace funcional (catálogo → detalle → carrito → checkout) cumpliendo la rúbrica:

- Sin frameworks de frontend/backend.
- Servido por Apache; datos consumidos vía `fetch` sobre `http://`.
- Datos en `data/*.json`; sesión/estado en `localStorage`.
- UI responsiva, validaciones visibles, **modales** de confirmación.
- 4–6 vistas mínimas y versionamiento en GitHub.

## 📦 Estructura

/ (raíz del sitio en Apache: htdocs/mini-amazon)
mini-amazon/
├── index.html
├── catalogo.html
├── producto.html
├── cart.html
├── checkout.html
├── favoritos.html
├── orders.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── catalogo.js
│   ├── producto.js
│   ├── cart.js
│   ├── favoritos.js
│   ├── orders.js
│   ├── tienda.js
│   └── checkout.js
├── data/
│   ├── categorias.json
│   ├── cupones.json
│   ├── envios.json
│   ├── localidades.json
│   ├── productos.json
│   └── reviews.json
└── img/
    ├── placeholder.png
    ├── bancoestado.svg
    ├── apay.svg
    ├── gpay.svg
    ├── paypal.svg
    ├── prod1001-1.png
    ├── prod1001-2.png
    ├── prod1002-1.png
    ├── prod1003-1.png
    ├── prod1004-1.png
    ├── prod1005-1.png
    └── prod1006-1.png

## 🚀 Setup (Apache / XAMPP)

1. Copia el proyecto a `C:\xampp\htdocs\mini-amazon` (Windows) o `/Applications/XAMPP/xamppfiles/htdocs/mini-amazon` (macOS).
2. Inicia **Apache** desde XAMPP.
3. Abre `http://localhost/mini-amazon/`.
4. Comprueba en **DevTools > Network** que los JSON responden `200`.

## 🖼 Vistas (4–6)

- **Home** (`index.html`): hero + **3 destacados**.
- **Catálogo** (`catalogo.html`): búsqueda con sugerencias (datalist), filtros (acordeón), ordenamiento, “Quick View”.
- **Producto** (`producto.html`): galería, qty con límite por **stock**, **tabla de especificaciones**, relacionados.
- **Carrito** (`cart.html`): cantidades (±), subtotales, IVA, total, **vaciar** con modal.
- **Checkout** (`checkout.html`): datos, **región/comuna** (JSON), **envío** (select y costo bloqueado), **cupones** (`fixed/percent/ship`), **métodos de pago** (tarjeta/transferencia) + **pago rápido** (PayPal/ **BancoEstado** /Amazon/GPay), **captcha** y **confirmación** de orden.

## 🧠 Lógica destacada

- **Normalización de datos** (`normalizeProduct`): acepta claves ES/EN (`titulo/name`, `imagenes/images`, `categoria/category`).
- **Stock**: qty limitada con `max`; toasts de error si supera.
- **Cupones**: `fixed`, `percent`, `ship`; **base imponible** = `subtotal - descuento`; IVA = `19%`; `ENVIOGRATIS` → `ship=0`.
- **Persistencia**: carrito/favoritos/órdenes en `localStorage`.
- **Modo oscuro**: tokens de color y correcciones de contraste (navbar, iconos, tabla de specs).

## 🗂 Datos (JSONs)

- `data/productos.json`: catálogo (incluye `specs` por producto).
- `data/localidades.json`: regiones/comunas.
- `data/envios.json`: opciones de envío `{ id, name, cost }`.
- `data/cupones.json`: `{ code, type: fixed|percent|ship, value }`.

## 🧪 Validaciones

- Formularios con `is-invalid` y mensajes visibles.
- Teléfono: solo `+` y dígitos (`+569…`).
- En checkout: botón **Confirmar** habilitado solo si todo es válido (incluye captcha).

## 🔔 Modales y feedback

- Quick View (producto).
- Confirmación al vaciar carrito / agregar al carrito.
- Toasts para acciones (favoritos, carrito, cupones).

## 🧭 Flujo de Git (recomendado)

- Ramas: `main` (estable), `feature/*`, `fix/*`, `docs/*`.
- Issues → rama → PR → merge.
- Convenciones de commit: `feat|fix|refactor|docs|chore(scope): mensaje`.

## ✅ Checklist de aceptación (rúbrica)

- [X] 4–6 vistas (Home, Catálogo/Quick View, Producto, Carrito, Checkout, Favoritos).
- [X] Filtros y orden en catálogo; búsqueda con sugerencias y “sin resultados”.
- [X] Validaciones visibles; modales (quick view, confirmaciones).
- [X] JSON + `localStorage`.
- [X] Código JS modular y claro; estilos consistentes con Bootstrap.
- [X] GitHub con commits descriptivos, ramas y PRs; README y CHANGELOG.

## 📸 Screenshots

- `docs/screens/home.png`
- `docs/screens/catalogo.png`
- `docs/screens/producto.png`
- `docs/screens/checkout-cupon.png`

## 📄 Licencia

MIT — Uso académico.

## 👤 Autor

Lukas Flores (@Raizexs)
