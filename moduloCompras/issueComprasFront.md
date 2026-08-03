# HIP-46 — Implementación Frontend del Módulo de Compras

> **Informe técnico generado el 2026-08-03** · Rama `juan` · 7 commits · 13 archivos · 6,392 líneas

---

## Resumen ejecutivo

El módulo completo de Compras fue implementado en `front-galco` (rama `juan`) en 7 commits. La implementación cubre **todas las tareas planeadas de la Fase 2 (Tareas 9–16)** más **funcionalidades adicionales no especificadas originalmente** en HIP-46: catálogo de productos, tracking de urgencia por línea, campos extendidos (unidad, nº pedido, proyecto, fecha entrega), regresión de estados de solicitud, y componente de envío a proveedor con Excel/impresión.

El build (`vite build`) compila limpio y ESLint no reporta hallazgos en los archivos del módulo.

---

## Arquitectura del módulo

```
src/components/compras/
├── AdjuntosCompra.vue          412 líneas   Subida/previsualización de adjuntos (Firebase Storage)
├── ArmarOrden.vue              429 líneas   Agrupación de productos en órdenes de compra
├── CatalogoProductos.vue       371 líneas   CRUD de catálogo de productos con Excel
├── ComprasMenu.vue              80 líneas   Navegación por tabs del módulo
├── EnvioProveedor.vue          355 líneas   Correo al proveedor con Excel corporativo + PDF
├── GestionCompras.vue           64 líneas   Wrapper de gestión (tabs: Solicitudes, Órdenes, Proveedores, Catálogo)
├── GestionOrdenes.vue          743 líneas   Gestión de órdenes de compra (activas/finalizadas)
├── GestionSolicitudes.vue      542 líneas   Gestión de solicitudes (activas/finalizadas)
├── ProveedoresCompras.vue      487 líneas   CRUD de proveedores con contactos y baja lógica
├── SolicitudCompra.vue        1110 líneas   Formulario multiproducto con borrador en localStorage
├── TableroCompras.vue         1502 líneas   Kanban dual (solicitudes + órdenes) con modales
├── estadosCompra.config.js     284 líneas   Dos máquinas de estados (producto/solicitud + orden)
└── formato.js                   13 líneas   Formateo de fechas en zona horaria Colombia

src/components/admin/permissions.config.js   Modificado — sección "Compras"
src/firebase/index.js                        Modificado — claims en puerta de autorización
src/routes/index.js                          Modificado — rutas del módulo
```

---

## Mapeo de commits → funcionalidad

### Commit 1 — `09e3f4c` feat(compras): add purchase request module

Implementación inicial (Fase 1, luego reescrita). Estableció la base del módulo:
- `SolicitudCompra.vue`, `TableroCompras.vue`, `GestionCompras.vue`
- `estados.config.js` (5 estados)
- `AdjuntosCompra.vue`, `ComprasMenu.vue`
- Rutas, permisos y gate de Firebase

### Commit 2 — `71b3775` refactor(compras): multi-product solicitudes and orders kanban

**Reescritura completa a modelo multiproducto (Fase 2):**
- `SolicitudCompra.vue` pasa de single-product a cabecera + N líneas con borrador en `localStorage`
- `GestionCompras.vue` se parte en `GestionSolicitudes.vue` y `GestionOrdenes.vue`
- `TableroCompras.vue` rediseñado como kanban dual (solicitudes + órdenes de compra)
- `ArmarOrden.vue`: agrupa productos del pool en órdenes de compra
- `EnvioProveedor.vue`: correo al proveedor con Excel corporativo
- `ProveedoresCompras.vue`: CRUD completo de proveedores
- `estados.config.js` → `estadosCompra.config.js`: 6 estados de producto + 4 estados de orden
- `formato.js`: utilidades de formateo compartidas

### Commit 3 — `c825054` feat(compras): add tabs for pending/finalized orders and requests

- `GestionSolicitudes.vue` y `GestionOrdenes.vue` dividen sus vistas en activas y finalizadas
- Paginación de 50 items por página en vistas de finalizadas
- Arrays de datos separados por vista

### Commit 4 — `82d857b` feat(compras): extend product lines with unit, order ref, project, and delivery date fields

**Campos adicionales no especificados originalmente en HIP-46:**
- Columna **Unidad** en tablas de productos (`ArmarOrden`, `GestionOrdenes`, `TableroCompras`)
- `SolicitudCompra.vue`: campos **Unidad**, **Nº pedido**, **Proyecto** y **Fecha entrega**
- Validación client-side por campo
- Auto-fill de fecha actual en nuevas líneas
- Importación Excel extendida a 7 columnas

### Commit 5 — `69a5397` feat(compras): add product catalog and urgency tracking

**Catálogo de productos (no especificado en HIP-46):**
- `CatalogoProductos.vue`: CRUD completo con import/export Excel
- Autocompletado de código desde catálogo en `SolicitudCompra.vue`
- Búsqueda por código/descripción con debounce y navegación por teclado

**Tracking de urgencia (no especificado en HIP-46):**
- Checkbox "Urgente" por línea de producto
- Indicadores visuales: tag rojo, fila con fondo `tarjeta-urgente` en kanban
- Filtro de urgencia en todas las vistas
- Propagación de urgencia a tarjetas de solicitud en el tablero

### Commit 6 — `bd4df25` refactor(compras): remove unnecessary table-container wrapper div

Fix visual: eliminado `table-container` de Bulma que recortaba el dropdown de autocompletado.

### Commit 7 — `2488cd5` feat(compras): add solicitud regression and inline editing from tablero

**Regresión de solicitudes (no especificado en HIP-46):**
- `getEstadoAnteriorSolicitud()` y `esSolicitudRegresable()` en `estadosCompra.config.js`
- Botón "Regresar a [estado]" en modal de detalle del tablero (solo `comprasAdm`)
- Bloqueo si hay productos asignados a una orden de compra
- Modal de confirmación con nota opcional
- Warning irreversible en transición a `enviada_proveedor`: _"ATENCIÓN: este paso es IRREVERSIBLE"_

**Edición inline desde tablero (no especificado en HIP-46):**
- `SolicitudCompra.vue` adaptado como componente modal con props/emits
- `props: { solicitudId: String }`, `emits: ['actualizado', 'cerrar-edicion']`
- Departamento ahora requerido en creación de solicitud

---

## Cumplimiento de tareas HIP-46 Fase 2

| Tarea | Descripción HIP-46 | Estado | Commit |
|-------|-------------------|--------|--------|
| 9 | `estadosCompra.config.js` — 6 estados prod + 4 estados orden | ✅ | `71b3775` |
| 10 | `SolicitudCompra.vue` multiproducto con localStorage | ✅ | `71b3775`, `82d857b`, `2488cd5` |
| 11 | `TableroCompras.vue` — 6 columnas, modal de detalle | ✅ | `71b3775`, `2488cd5` |
| 12 | `GestionCompras.vue` — tabla, filtros, Excel | ✅ | `71b3775`, `c825054`, `82d857b` |
| 13 | CRUD de proveedores con contactos, 409, baja lógica | ✅ | `71b3775` |
| 14 | `ArmarOrdenCompra.vue` — pool agrupado por solicitud | ✅ | `71b3775`, `82d857b` |
| 15 | `GestionOrdenesCompra.vue` — tabla, detalle, avance | ✅ | `71b3775`, `c825054`, `82d857b`, `2488cd5` |
| 16 | Adjuntos e importación Excel | ✅ | `09e3f4c`, `71b3775`, `82d857b` |

---

## Funcionalidad adicional (no en HIP-46)

Estas características fueron implementadas durante el desarrollo pero no estaban en la especificación original del issue:

### 1. Catálogo de productos (`CatalogoProductos.vue`)

CRUD completo accesible desde `Gestión > Catálogo` (solo `comprasAdm`):
- Código único normalizado a mayúsculas
- Importación masiva Excel (límite 500 productos) con validación pre-envío
- Exportación Excel con hoja de instrucciones
- Autocompletado opcional en `SolicitudCompra.vue` para ambos roles
- Búsqueda con debounce, máximo 10 resultados, navegación por teclado
- La solicitud conserva captura libre: puede guardar códigos no registrados en catálogo

**Endpoints consumidos:** `GET/POST /compras/catalogo`, `POST /compras/catalogo/lote`

### 2. Tracking de urgencia por línea

Cada línea de producto tiene un flag `urgente` (booleano):
- Checkbox en `SolicitudCompra.vue` durante creación/edición
- Tag visual "Urgente" en color rojo en todas las vistas
- Fila con clase `tarjeta-urgente` (borde izquierdo rojo) en el kanban
- La tarjeta de solicitud en el tablero muestra indicador si **algún** producto es urgente
- Filtro de urgencia en `GestionSolicitudes`

### 3. Campos extendidos en líneas de producto

Campos adicionales en cada línea de producto de una solicitud:

| Campo | Tipo | Validación |
|-------|------|-----------|
| Unidad | string | Libre, máx 20 chars |
| Nº pedido | string | Libre, máx 30 chars |
| Proyecto | string | Libre, máx 100 chars |
| Fecha entrega | date | Auto-fill today, validación de fecha válida |

Estos campos se incluyen en:
- Tabla de productos en `SolicitudCompra.vue`
- Importación Excel (7 columnas)
- Visualización en `TableroCompras.vue` (modal de detalle)
- Tablas en `ArmarOrden.vue` y `GestionOrdenes.vue`

### 4. Regresión de estados de solicitud

Capacidad de devolver una solicitud a su estado anterior:
- `getEstadoAnteriorSolicitud(key)` y `esSolicitudRegresable(key)` en config
- Transiciones: `en_preparacion → solicitud_recibida → solicitud_enviada`
- Bloqueo automático si algún producto tiene `ordenCompraId` asignado
- Modal de confirmación con nota opcional (máx 500 chars)
- Contexto visual según destino (advertencia si vuelve a `solicitud_enviada`)

### 5. Edición inline desde el tablero

`SolicitudCompra.vue` funciona como modal child:
- `props: { solicitudId: String }` — si se pasa, carga la solicitud en modo edición
- `emits: ['actualizado', 'cerrar-edicion']` — notifica al padre al guardar/cerrar
- El modal de detalle en `TableroCompras.vue` abre edición inline sin navegar a otra ruta

### 6. Componente de envío a proveedor (`EnvioProveedor.vue`)

Herramienta para preparar el correo al proveedor desde la orden:
- Campo "Para" con email del proveedor (copiable)
- Asunto pre-rellenado con consecutivo de la orden
- Cuerpo con template que incluye datos del proveedor y tabla de productos
- Botón "Excel para adjuntar": genera `.xlsx` con `xlsx-js-style` usando header corporativo (`#0053A1`)
- Botón "Imprimir / PDF": abre `window.print()` en pestaña nueva
- Copia del cuerpo con confirmación visual

### 7. Separación activas/finalizadas con paginación

`GestionSolicitudes.vue` y `GestionOrdenes.vue` tienen tabs internos:
- **Activas**: items en cualquier estado excepto los terminales
- **Finalizadas**: solo `productos_recibidos`, con paginación de 50 por página
- Arrays de datos independientes para evitar refetch al cambiar de tab

### 8. Departamento obligatorio

El campo `departamento` en `SolicitudCompra.vue` pasó de opcional a requerido, con validación client-side en `validarTodo()` para evitar errores 400 del backend.

### 9. Warning irreversible en envío a proveedor

Al avanzar una orden a `enviada_proveedor` desde `GestionOrdenes.vue`:
- Se muestra un `message is-danger` con ícono ⚠️ y texto _"ATENCIÓN: este paso es IRREVERSIBLE — NO se puede regresar a Preparada ni reabrir"_
- Solo visible cuando el destino es `enviada_proveedor`

---

## Máquina de estados — implementación frontend

`estadosCompra.config.js` centraliza **dos** máquinas de estados independientes:

### Producto / Solicitud (6 estados)

```
solicitud_enviada → solicitud_recibida → en_preparacion → preparada → enviada_proveedor → productos_recibidos
```

- Estados 1–2–3: avance manual por `comprasAdm`, vía `PATCH /compras/{id}/estado` (mueve la solicitud completa)
- Estados 4–5–6: escritos por el backend al asignar productos a órdenes o propagar estado de orden
- `esEstadoManual(key)` → `true` solo para los tres primeros
- `estadoMenosAvanzado(productos)` → replica la regla del backend para mostrar el estado derivado

### Orden de compra (4 estados)

```
en_preparacion → preparada → enviada_proveedor → productos_recibidos
```

- `ordenAceptaCambios(key)` → `true` solo en `en_preparacion` (productos mutables)
- Transiciones lineales de a un paso
- `esOrdenReabrible(key)` para casos de corrección

**Helpers compartidos (29 funciones exportadas):**

| Helper | Dominio | Uso |
|--------|---------|-----|
| `getEstadoConfig(key)` | Producto | Config visual (label, icono, clase) |
| `getEstadoLabel(key)` | Producto | Etiqueta legible |
| `getEstadoIndex(key)` | Producto | Posición en la máquina |
| `esEstadoManual(key)` | Producto | ¿Acepta avance manual? |
| `getEstadoSiguienteManual(key)` | Producto | Siguiente estado manual |
| `getEstadoAnteriorSolicitud(key)` | Producto | Estado anterior para regresión |
| `esSolicitudRegresable(key)` | Producto | ¿Se puede regresar? |
| `esTransicionManualValida(actual, nuevo)` | Producto | Validación de transición |
| `estadoMenosAvanzado(productos)` | Producto | Regla del mínimo |
| `getEstadoOrdenConfig(key)` | Orden | Config visual |
| `getEstadoOrdenLabel(key)` | Orden | Etiqueta legible |
| `getEstadoOrdenIndex(key)` | Orden | Posición en la máquina |
| `getEstadoOrdenSiguiente(key)` | Orden | Siguiente estado |
| `esOrdenReabrible(key)` | Orden | ¿Reabrible? |
| `esTransicionOrdenValida(actual, nuevo)` | Orden | Validación |
| `ordenAceptaCambios(key)` | Orden | ¿Lista de productos mutable? |
| `esProductoAgrupable(producto)` | Ambos | ¿Elegible para orden? |

### Constantes exportadas

```js
ESTADOS_PRODUCTO_KEYS      // ['solicitud_enviada', ..., 'productos_recibidos']
ESTADO_PRODUCTO_INICIAL     // 'solicitud_enviada'
ESTADO_PRODUCTO_FINAL       // 'productos_recibidos'
ESTADOS_AVANCE_POR_SOLICITUD // ['solicitud_enviada', 'solicitud_recibida']
ESTADOS_ORDEN_KEYS          // ['en_preparacion', ..., 'productos_recibidos']
ESTADO_ORDEN_INICIAL        // 'en_preparacion'
```

---

## Flujo de datos y decisiones de arquitectura

### Borrador en localStorage

`SolicitudCompra.vue` persiste el borrador en `localStorage` bajo la clave `compras_borrador_solicitud`:
- Se guarda en cada cambio del formulario (debounced)
- Se recupera al montar el componente si no hay `solicitudId` en props
- Se elimina solo cuando el `POST` devuelve 201
- Esto permite cerrar la pestaña y retomar sin perder datos

### Consumo de API

Siguiendo la convención del repositorio, los componentes consumen `apiServices` (instancia única de axios desde `src/services/yungol-services.js`) directamente:
- `baseURL` ya incluye `/api` → las llamadas usan `/compras`, `/ordenescompra`, `/proveedores`
- Sin capa de servicios intermedia

### Validación client-side

Cada formulario replica las validaciones del backend:
- Contadores de caracteres en inputs
- `validarTodo()` en `SolicitudCompra.vue` que bloquea el envío si hay campos requeridos vacíos
- Importación Excel: validación de filas antes de enviar (obligatorio porque ya no existe respuesta 207)
- Mensajes de error del backend (`409`, `400`) mostrados en el campo correspondiente, no como toast genérico

### Design System

Respetado en todos los componentes:
- **Poppins 400/600**, sin otros pesos
- `fontMono` (Ubuntu Mono) para códigos, consecutivos, NIT
- **Azul Industrial** `#0053a1` como único color de identidad
- Sin sombras en cards, modales ni contenedores
- Sin gradientes ni decoraciones
- `xlsx-js-style` para headers de Excel con fondo `#0053A1` y texto blanco

---

## Rutas

```javascript
// src/routes/index.js
{
  path: '/compras/menu',
  component: ComprasMenu,
  name: 'comprasmenu',
  redirect: { name: 'compras.tablero' },
  menu: {
    section: 'Compras',
    icon: 'shopping_cart',
    title: 'Compras',
    scope: ['comprasAdm', 'comprasUsr']
  },
  meta: { isAuthenticated: true },
  children: [
    { path: '/compras/solicitud', component: SolicitudCompra, name: 'compras.solicitud', ... },
    { path: '/compras/tablero',   component: TableroCompras,  name: 'compras.tablero',   ... },
    { path: '/compras/gestion',   component: GestionCompras,  name: 'compras.gestion',   scope: ['comprasAdm'] }
  ]
}
```

Navegación interna por tabs en `ComprasMenu.vue`:
- **Solicitar** → `/compras/solicitud` (ambos roles)
- **Tablero** → `/compras/tablero` (ambos roles)
- **Gestión** → `/compras/gestion` (solo `comprasAdm`), con sub-tabs: Solicitudes, Órdenes, Proveedores, Catálogo

---

## Permisos

| Claim | Label | Acceso |
|-------|-------|--------|
| `comprasAdm` | Compras Administrador | Módulo completo |
| `comprasUsr` | Compras Usuario | Solo sus solicitudes, tablero, catálogo |

- `permissions.config.js`: sección "Compras" con mutex pair `['comprasAdm', 'comprasUsr']`
- `src/firebase/index.js`: ambos claims en la puerta de autorización
- El claim preexistente `purchasesUsr` fue renombrado de "Usuario Compras" a "Órdenes de Compra Almacén" (solo label/description, key intacta)

---

## Pendiente / no implementado

| Item | Estado |
|------|--------|
| Prueba end-to-end front ↔ back | ⬜ Pendiente |
| Custom claims de Firebase asignados a usuarios reales | ⬜ Pendiente desde `EditUser.vue` |
| Recepción parcial de productos | ⬜ Fuera de alcance |
| Precios unitarios y totales en órdenes | ⬜ Fuera de alcance |
| PDF de orden de compra generado automáticamente | ⬜ Fuera de alcance (se resuelve con `EnvioProveedor.vue`) |
| Notificaciones al solicitante | ⬜ Fuera de alcance |
| Guard de scope en el router | ⬜ Deuda técnica transversal (ticket aparte) |

---

## Verificación

- `vite build`: compila limpio
- ESLint: sin hallazgos en archivos del módulo
- `git diff --check`: sin errores de whitespace
- Los 7 commits forman una secuencia lógica incremental (no squash necesario)

---

## Referencias

- **Linear Issue:** [HIP-46](https://linear.app/hipanda/issue/HIP-46)
- **Rama frontend:** `juan` en `front-galco`
- **Rama backend:** `juan` en `backend-galco` (101 tests, 29 rutas)
- **Contrato API:** documentado en la descripción del issue HIP-46
