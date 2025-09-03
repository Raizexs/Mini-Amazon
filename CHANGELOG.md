# Changelog

## [0.1.0] - 2025-09-02

### Added

- Home: 3 productos destacados y hero copy ajustado.
- Catálogo: búsqueda con sugerencias (datalist), filtros en acordeón (categoría, marca, precio, rating, stock), orden por precio/rating, grid responsive.
- Quick View: modal con imagen/miniaturas, precio, stock, qty (±), rail de acciones (favorito/comprar/ver); botones móviles.
- Producto: **tabla de especificaciones** desde `specs` del JSON; miniaturas con fallback; breadcrumb.
- Carrito: cantidades con límite por **stock**, subtotales, IVA (19%), total; **vaciar carrito** con modal; persistencia.
- Checkout:
  - Selects de **Región/Comuna** (`localidades.json`).
  - **Envío** desde `envios.json`, costo bloqueado (readonly/disabled).
  - **Cupones** `fixed`, `percent`, `ship` con recálculo completo (**base imponible** = subtotal − descuento → IVA → total; `ENVIOGRATIS` → `ship=0`).
  - Métodos de pago: **tarjeta** (inputs visibles solo al elegirla) y **transferencia**; pago rápido (PayPal, **BancoEstado**, Amazon Pay, G Pay).
  - **Captcha** simple y **Confirmar** habilitado solo cuando es válido.
  - **Confirmación de orden** con número simulado (`ORD-{timestamp}`).
- Modo oscuro: tokens de color; contraste en navbar/iconos y tabla de especificaciones.
- Normalización de datos: `normalizeProduct()` para claves ES/EN.

### Fixed

- Límite de cantidad por stock en detalle y quick view.
- Recalcular **descuento, IVA y total** al aplicar cupones; envío gratis con `ENVIOGRATIS`.
- Íconos invisibles en dark mode; tabla de especificaciones ilegible.

### Docs

- README con setup XAMPP, estructura, decisiones, flujo de ramas/PRs/issues y guía de estilos.
- `.gitignore` adaptado a proyecto estático.
