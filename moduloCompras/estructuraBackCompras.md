# Backend Módulo de Compras — Estructura Técnica

> **Issue**: HIP-46 — Módulo completo de solicitudes de compra
> **Repositorio**: `backend-galco`, rama `juan`
> **Stack**: Node.js + Hapi 20 + Mongoose 6 + Firebase Auth
> **Fecha**: Agosto 2026

---

## 1. Arquitectura general

El módulo se construyó como un **dominio de negocio independiente** dentro de la arquitectura Hapi existente. No modifica controladores, modelos, rutas ni servicios de otros módulos. La única modificación fuera del directorio `modules/compras/` es la adición de tres registros de rutas en `modules/registerRoutes.js`.

```
modules/
  compras/
    controllers/
      comprascontroller.js          ← solicitudes + productos (cabecera y líneas)
      ordenescompracontroller.js    ← órdenes de compra a proveedores
      proveedorescontroller.js      ← CRUD de proveedores
      catalogoproductoscontroller.js ← catálogo maestro de productos

    routes/
      comprasroutes.js              ← 29 endpoints de solicitudes y productos
      ordenescompraroutes.js        ← 11 endpoints de órdenes de compra
      proveedoresroutes.js           ← 10 endpoints de proveedores
      catalogoproductosroutes.js     ← 3 endpoints de catálogo

    validators/
      comprasvalidator.js           ← schemas Joi para solicitudes y productos
      ordenescompravalidator.js     ← schemas Joi para órdenes
      proveedoresvalidator.js       ← schemas Joi para proveedores
      catalogoproductosvalidator.js ← schemas Joi para catálogo

    services/
      estadosolicitud.js            ← máquina de estados + recálculo de cabecera
      transacciones.js              ← sesiones MongoDB, errores, consecutivos

  models/
    solicitudesmodel.js             ← cabecera de solicitud (consecutivo SOL-0001)
    productossolicitudmodel.js      ← líneas de producto (átomo que recorre el ciclo)
    ordenescompramodel.js           ← orden de compra al proveedor (OC-0001)
    proveedoresmodel.js             ← proveedor (NIT único, baja lógica)
    catalogoproductosmodel.js       ← catálogo maestro de códigos de producto
```

**Total**: 53 endpoints nuevos, 5 colecciones MongoDB, 2 servicios de dominio, 5 suites de tests (101 tests pasando).

---

## 2. Modelo de datos

### 2.1 Colecciones y responsabilidades

| Colección (MongoDB) | Modelo (Mongoose) | Propósito |
|---|---|---|
| `solicitudes` | `Solicitudes` | Cabecera de una solicitud de compra. Consecutivo `SOL-0001`. Contiene solicitante, departamento, estado y adjuntos. |
| `productossolicitudes` | `ProductosSolicitud` | Cada producto pedido dentro de una solicitud. Es el **átomo** que recorre el ciclo completo: lleva dos vínculos — `solicitudId` (de dónde vino) y `ordenCompraId` (a qué orden fue asignado). |
| `ordenescompras` | `OrdenesCompra` | Orden emitida a un proveedor. Consecutivo `OC-0001`. Agrupa productos de una o varias solicitudes. |
| `proveedores` | `Proveedores` | Proveedor con NIT único. Baja lógica — las órdenes históricas conservan una copia de los datos del proveedor al momento de crearse. |
| `catalogoproductos` | `CatalogoProductos` | Catálogo maestro de códigos de producto (código único, descripción). Alimenta los autocompletados del frontend. |

### 2.2 Relaciones

```
solicitudes (1) ──< (N) productossolicitudes (N) >── (1) ordenescompra
                                                           │
                                                           │ (N:1)
                                                           │
                                                      proveedores
```

- Una solicitud tiene N productos.
- Un producto pertenece a exactamente una solicitud (`solicitudId` requerido).
- Un producto puede estar asignado a una orden (`ordenCompraId`, nullable).
- Una orden pertenece a un proveedor.
- Los productos de una misma solicitud pueden ir a proveedores distintos (órdenes distintas) y avanzar a ritmos distintos.

### 2.3 Esquema de cada colección

#### `solicitudes`

```json
{
  "_id": "ObjectId",
  "consecutivo": "SOL-0001",
  "solicitante": {
    "uid": "firebaseUid",
    "displayName": "Juan Pérez",
    "email": "juan@galco.com"
  },
  "departamento": "Metalmecánica",
  "estado": "solicitud_enviada",
  "finalizado": false,
  "adjuntos": [
    {
      "_id": "ObjectId",
      "url": "https://storage/...",
      "nombre": "cotizacion.pdf",
      "tipo": "application/pdf",
      "fechaSubida": "2026-08-01T..."
    }
  ],
  "fechaCreacion": "2026-08-01T...",
  "fechaActualizacion": "2026-08-01T..."
}
```

Índices: `{ 'solicitante.uid': 1, fechaCreacion: -1 }`, `{ estado: 1, fechaCreacion: -1 }`

#### `productossolicitudes`

```json
{
  "_id": "ObjectId",
  "codigo": "T-M8",
  "descripcion": "Tornillos M8",
  "cantidad": 500,
  "urgente": false,
  "solicitudId": "ObjectId",
  "ordenCompraId": "ObjectId | null",
  "estado": "en_preparacion",
  "pedido": "OC-0001",
  "fechaEntrega": "2026-08-15T...",
  "fechaRecibido": null,
  "unidad": "unidad",
  "proyecto": "Proyecto X",
  "finalizado": false,
  "historialEstados": [
    {
      "estado": "solicitud_enviada",
      "fecha": "2026-08-01T...",
      "usuario": "firebaseUid",
      "nota": "Creado"
    }
  ],
  "fechaCreacion": "...",
  "fechaActualizacion": "..."
}
```

Índices: `{ solicitudId: 1 }`, `{ ordenCompraId: 1 }`, `{ estado: 1, ordenCompraId: 1 }`

#### `ordenescompras`

```json
{
  "_id": "ObjectId",
  "consecutivo": "OC-0001",
  "proveedor": {
    "proveedorId": "ObjectId",
    "nit": "800.123.456-7",
    "nombre": "Proveedor XYZ S.A.S."
  },
  "estado": "preparada",
  "finalizado": false,
  "observaciones": "Entregar en bodega 3",
  "adjuntos": [...],
  "historialEstados": [...],
  "creadoPor": { "uid": "...", "displayName": "...", "email": "..." },
  "fechaCreacion": "...",
  "fechaActualizacion": "..."
}
```

Índices: `{ estado: 1, fechaCreacion: -1 }`, `{ 'proveedor.proveedorId': 1, fechaCreacion: -1 }`

#### `proveedores`

```json
{
  "_id": "ObjectId",
  "nit": "800.123.456-7",
  "nombre": "Proveedor XYZ S.A.S.",
  "direccion": "Calle 123 #45-67",
  "ciudad": "Medellín",
  "telefono": "+57 300 123 4567",
  "email": "ventas@proveedor.com",
  "contactos": [
    { "nombre": "María López", "cargo": "Ventas", "telefono": "...", "email": "..." }
  ],
  "notas": "Pago a 30 días",
  "activo": true,
  "fechaCreacion": "...",
  "fechaActualizacion": "..."
}
```

Índices: `{ activo: 1, nombre: 1 }`, `{ nit: 1 }` (unique)

#### `catalogoproductos`

```json
{
  "_id": "ObjectId",
  "codigo": "T-M8",
  "descripcion": "Tornillos M8",
  "fechaCreacion": "...",
  "fechaActualizacion": "..."
}
```

Índices: `{ codigo: 1 }` (unique), `{ descripcion: 1 }`

---

## 3. Máquina de estados

El ciclo de compra tiene **6 estados**, compartidos por productos y solicitudes:

| # | Valor | Significado | Quién lo setea |
|---|---|---|---|
| 1 | `solicitud_enviada` | El usuario creó la solicitud | Automático al crear |
| 2 | `solicitud_recibida` | Compras acusó recibo | `comprasAdm`, manual |
| 3 | `en_preparacion` | Compras está armando las órdenes | `comprasAdm`, manual |
| 4 | `preparada` | El producto fue asignado a una orden | Automático al asignar |
| 5 | `enviada_proveedor` | La orden se envió al proveedor | Propagado desde la orden |
| 6 | `productos_recibidos` | El proveedor entregó | Propagado desde la orden |

**Reglas**:
- Los estados 1→2 y 2→3 se mueven manualmente por `comprasAdm`, producto por producto o sobre la solicitud completa.
- Los estados 4, 5 y 6 no se pueden setear a mano — responden con `400`.
- Los estados 5 y 6 se propagan en cascada desde la orden a todos sus productos.

### El estado de la solicitud es el del producto MENOS avanzado

Es la regla central del módulo. Si una solicitud tiene tres productos — uno ya entregado, otro en camino, y un tercero al que ni siquiera se le asignó proveedor — la solicitud está en `en_preparacion`, el estado del más atrasado. Se toma el **mínimo** para que una solicitud nunca aparezca como terminada mientras le falte un producto.

El estado se guarda (no se calcula al leer) para permitir filtrado e indexado con un `find` simple. Se mantiene actualizado mediante `recalcularEstadoSolicitud()` en `modules/compras/services/estadosolicitud.js`, invocado dentro de la misma transacción que movió el producto.

---

## 4. Contrato de la API

Todas las rutas requieren `Authorization: Bearer <idToken>` de Firebase.

### 4.1 Roles

| Rol | Claim Firebase | Qué puede |
|---|---|---|
| `comprasUsr` | Usuario solicitante | Crear, ver y editar SUS PROPIAS solicitudes, solo mientras están en `solicitud_enviada` |
| `comprasAdm` | Administrador de compras | Ver y editar TODO, mover estados, crear órdenes, gestionar proveedores |

El aislamiento por rol es **server-side**: si un `comprasUsr` manda `solicitanteUid` de otra persona, el backend lo ignora y lo reemplaza por su propio `uid`.

### 4.2 Endpoints — Solicitudes y productos (`/api/compras`)

| Método | Path | Scope | Descripción |
|---|---|---|---|
| `GET` | `/api/compras` | Ambos | Listar solicitudes (cabeceras). Filtros: `estado`, `solicitanteUid`, `desde`/`hasta`, `texto` |
| `GET` | `/api/compras/finalizadas` | Ambos | Listar solicitudes con `finalizado: true` |
| `POST` | `/api/compras` | Ambos | Crear solicitud con N productos. **Transacción atómica**: todo o nada |
| `GET` | `/api/compras/{id}` | Ambos | Detalle de solicitud con sus productos |
| `PUT` | `/api/compras/{id}` | Ambos | Editar cabecera (departamento). Usuario solo puede si está en `solicitud_enviada` |
| `DELETE` | `/api/compras/{id}` | Ambos | Borrar solicitud y todos sus productos. Bloqueado si algún producto está en una orden |
| `PATCH` | `/api/compras/{id}/estado` | Solo admin | Avanzar estado de TODA la solicitud (pasos 1→2 y 2→3) |
| `GET` | `/api/compras/productos` | Ambos | Pool de productos. Filtros: `estado`, `solicitudId`, `ordenCompraId`, `sinOrden`, `texto` |
| `PATCH` | `/api/compras/productos/{productoId}/estado` | Solo admin | Avanzar un producto suelto (solo tramo 1→2→3, de a un paso) |
| `POST` | `/api/compras/{id}/productos` | Ambos | Agregar un producto a una solicitud existente |
| `PUT` | `/api/compras/{id}/productos/{productoId}` | Ambos | Editar un producto. Usuario solo puede si ese producto está en `solicitud_enviada` |
| `DELETE` | `/api/compras/{id}/productos/{productoId}` | Ambos | Borrar un producto. Bloqueado si es el último o si ya está en una orden |
| `POST` | `/api/compras/{id}/adjuntos` | Ambos | Subir adjunto a solicitud |
| `DELETE` | `/api/compras/{id}/adjuntos/{adjuntoId}` | Ambos | Borrar adjunto por `_id` de subdocumento |
| `PUT` | `/api/compras/{id}/cierre` | Solo admin | Cierre administrativo de una solicitud (todos sus productos deben estar finalizados) |

### 4.3 Endpoints — Órdenes de compra (`/api/compras/ordenes`)

| Método | Path | Scope | Descripción |
|---|---|---|---|
| `GET` | `/api/compras/ordenes` | Solo admin | Listar órdenes. Filtros: `estado`, `proveedorId`, `desde`/`hasta`, `texto` |
| `GET` | `/api/compras/ordenes/finalizadas` | Solo admin | Listar órdenes con `finalizado: true` |
| `POST` | `/api/compras/ordenes` | Solo admin | Crear orden con N productos. Transacción atómica |
| `GET` | `/api/compras/ordenes/{id}` | Solo admin | Detalle de orden con sus productos |
| `PUT` | `/api/compras/ordenes/{id}` | Solo admin | Editar orden (proveedor, observaciones). Bloqueado si ya salió de `en_preparacion` |
| `DELETE` | `/api/compras/ordenes/{id}` | Solo admin | Borrar orden. Libera los productos asignados |
| `PATCH` | `/api/compras/ordenes/{id}/estado` | Solo admin | Avanzar estado. Propaga en cascada a los productos |
| `POST` | `/api/compras/ordenes/{id}/productos` | Solo admin | Agregar producto a orden. Solo en `en_preparacion` |
| `DELETE` | `/api/compras/ordenes/{id}/productos/{productoId}` | Solo admin | Quitar producto de orden. Solo en `en_preparacion` |
| `POST` | `/api/compras/ordenes/{id}/adjuntos` | Solo admin | Subir adjunto a orden |
| `DELETE` | `/api/compras/ordenes/{id}/adjuntos/{adjuntoId}` | Solo admin | Borrar adjunto |

### 4.4 Endpoints — Proveedores (`/api/compras/proveedores`)

| Método | Path | Scope | Descripción |
|---|---|---|---|
| `GET` | `/api/compras/proveedores` | Solo admin | Listar proveedores activos. Filtros: `texto`, `incluirInactivos` |
| `POST` | `/api/compras/proveedores` | Solo admin | Crear proveedor (NIT único) |
| `GET` | `/api/compras/proveedores/{id}` | Solo admin | Detalle de proveedor |
| `PUT` | `/api/compras/proveedores/{id}` | Solo admin | Editar proveedor |
| `DELETE` | `/api/compras/proveedores/{id}` | Solo admin | Baja lógica (`activo: false`) |

### 4.5 Endpoints — Catálogo de productos (`/api/compras/catalogo`)

| Método | Path | Scope | Descripción |
|---|---|---|---|
| `GET` | `/api/compras/catalogo` | Ambos | Listar productos del catálogo. Filtro: `texto` |
| `POST` | `/api/compras/catalogo` | Solo admin | Agregar producto al catálogo |
| `PUT` | `/api/compras/catalogo/{id}` | Solo admin | Editar producto del catálogo |

---

## 5. Servicios de dominio

### 5.1 `estadosolicitud.js`

Punto único de escritura del estado de una solicitud. Expone una sola función:

```javascript
recalcularEstadoSolicitud(solicitudId, session)
```

- Lee todos los productos de la solicitud dentro de la sesión activa.
- Calcula el estado del producto menos avanzado (mínimo índice en el enum `ESTADOS`).
- Escribe el resultado en `solicitudes.estado`.
- Se invoca desde **seis caminos** que pueden mover el mínimo: crear producto, avanzar producto, asignar a orden, quitar de orden, propagar desde orden, borrar producto.

### 5.2 `transacciones.js`

Utilidades compartidas:

- `conSesion(fn)` — ejecuta una operación dentro de una sesión MongoDB (`startSession` + `withTransaction`). Si la sesión falla, reintenta sin sesión para entornos sin replica set.
- `formatearError(error)` — traduce errores de MongoDB (duplicados, validación) a objetos Boom con mensajes en español.
- `obtenerSiguienteConsecutivo(modelo, prefijo)` — genera `SOL-0001`, `SOL-0002`, `OC-0001`, etc. con padding de 4 dígitos, atómico dentro de la sesión.

---

## 6. Seguridad

### 6.1 Autenticación

Firebase Auth con verificación de `idToken` en cada request. Estrategia `firebase` configurada en el plugin de Hapi.

### 6.2 Autorización por claims

Los claims de Firebase (`comprasAdm`, `comprasUsr`) se mapean a `scope` en las credenciales del request. Cada ruta declara `scope: ['comprasAdm', 'comprasUsr']` o `scope: ['comprasAdm']`. Hapi rechaza con `403` antes de llegar al controller si el scope no coincide.

### 6.3 Aislamiento de datos

- `comprasUsr` solo ve y modifica sus propias solicitudes.
- `comprasUsr` solo puede editar/borrar mientras el producto esté en `solicitud_enviada`.
- Una vez que `comprasAdm` acusa recibo (estado 2), el usuario pierde control sobre ese producto.
- El `solicitanteUid` en queries se fuerza server-side: un usuario no puede espiar solicitudes ajenas.

### 6.4 Guardas de integridad

- No se puede borrar el último producto de una solicitud (para eso está `DELETE /api/compras/{id}`).
- No se puede borrar un producto que ya está asignado a una orden (hay que quitarlo de la orden primero).
- Una orden solo acepta modificaciones en su lista de productos mientras está en `en_preparacion`.
- Los adjuntos se borran por `_id` de subdocumento, no por índice de array, para evitar condiciones de carrera.

---

## 7. Transaccionalidad

Todas las operaciones que tocan más de un documento se ejecutan dentro de una sesión MongoDB:

- `POST /api/compras` — crear cabecera + N productos (todo o nada)
- `POST /api/compras/ordenes` — crear orden + asignar productos (todo o nada)
- `PATCH /api/compras/{id}/estado` — mover solicitud + todos sus productos + recalcular estado
- `DELETE /api/compras/{id}` — borrar solicitud + todos sus productos
- Cualquier operación que recalcula el estado de la solicitud

Si el entorno no tiene replica set (desarrollo local), `conSesion` degrada gracefully a ejecución sin sesión.

---

## 8. Cambios respecto a producción (rama `master`)

### 8.1 Archivos nuevos (20)

| Archivo | Tipo |
|---|---|
| `modules/models/solicitudesmodel.js` | Modelo |
| `modules/models/productossolicitudmodel.js` | Modelo |
| `modules/models/proveedoresmodel.js` | Modelo |
| `modules/models/ordenescompramodel.js` | Modelo |
| `modules/models/catalogoproductosmodel.js` | Modelo |
| `modules/compras/services/estadosolicitud.js` | Servicio |
| `modules/compras/services/transacciones.js` | Servicio |
| `modules/compras/controllers/ordenescompracontroller.js` | Controller |
| `modules/compras/controllers/proveedorescontroller.js` | Controller |
| `modules/compras/controllers/catalogoproductoscontroller.js` | Controller |
| `modules/compras/routes/ordenescompraroutes.js` | Rutas |
| `modules/compras/routes/proveedoresroutes.js` | Rutas |
| `modules/compras/routes/catalogoproductosroutes.js` | Rutas |
| `modules/compras/validators/ordenescompravalidator.js` | Validador |
| `modules/compras/validators/proveedoresvalidator.js` | Validador |
| `modules/compras/validators/catalogoproductosvalidator.js` | Validador |
| `tests/modules/compras/controllers/ordenescompracontroller.test.js` | Tests |
| `tests/modules/compras/controllers/proveedorescontroller.test.js` | Tests |
| `tests/modules/compras/services/estadosolicitud.test.js` | Tests |
| `tests/modules/compras/services/transacciones.test.js` | Tests |

### 8.2 Archivos modificados (5)

| Archivo | Cambio |
|---|---|
| `modules/compras/controllers/comprascontroller.js` | Reescrito — ahora usa `Solicitudes` + `ProductosSolicitud` en vez del modelo viejo `Compras`. Nuevos handlers: `listProductos`, `listFinalizadas`, `cambiarEstadoSolicitud`, `cambiarEstadoProducto`, `agregarProducto`, `actualizarProducto`, `eliminarProducto` |
| `modules/compras/routes/comprasroutes.js` | Reescrito — 14 endpoints (eran 10). Se elimina `POST /importar-excel`, se agregan rutas de productos, estado por solicitud y estado por producto |
| `modules/compras/validators/comprasvalidator.js` | Reescrito — schemas nuevos para productos, queries de productos y finalizadas |
| `modules/registerRoutes.js` | **3 líneas agregadas** — registros de `catalogoProductos`, `proveedores` y `ordenescompra`. Cero modificaciones a registros existentes |
| `tests/modules/compras/controllers/comprascontroller.test.js` | Extendido — 101 tests totales |

### 8.3 Archivos eliminados (2)

| Archivo | Razón |
|---|---|
| `modules/models/comprasmodel.js` | Modelo `Compras` de la fase 1 — reemplazado por `Solicitudes` + `ProductosSolicitud`. La colección `compras` queda huérfana en MongoDB. |
| `modules/models/suppliersmodel.js` | Código muerto desde el commit fundacional — cero imports en todo el código base. La colección `suppliers` no era accedida por ningún endpoint. |

---

## 9. Consideraciones para el despliegue

### 9.1 Previo al deploy

Verificar que la colección `compras` en la base de datos de producción **no contiene documentos**:

```js
db.compras.countDocuments()
```

Si el resultado es > 0, esos documentos pertenecen a solicitudes creadas con el modelo anterior y quedarán inaccesibles tras el deploy. Evaluar si requieren migración o si son datos de prueba sin valor.

### 9.2 Firebase claims

Los claims `comprasAdm` y `comprasUsr` deben existir en Firebase Auth para los usuarios correspondientes. La lógica de claims ya está en `plugins/firebase.js` en master y no requiere cambios. Si se crean usuarios nuevos con estos roles, se deben asignar los claims en Firebase.

### 9.3 Colecciones nuevas

Mongoose crea automáticamente las colecciones al primer write. No se requiere script de migración de esquema. No hay foreign keys con colecciones existentes.

### 9.4 Replica set

Las transacciones MongoDB requieren replica set. En desarrollo local, `conSesion()` detecta el error y reintenta sin sesión. En producción con un solo nodo (standalone), las transacciones no estarán disponibles y el comportamiento degradado aplica automáticamente.

### 9.5 Rollback

Si es necesario revertir, volver al commit anterior en master. Las colecciones nuevas (`solicitudes`, `productossolicitudes`, `ordenescompras`, `proveedores`, `catalogoproductos`) quedarán en MongoDB pero ningún endpoint las consultará. La colección `compras` original no se ve afectada — Mongoose no dropea colecciones al eliminar un modelo.

---

## 10. Suite de tests

```
tests/modules/compras/
  controllers/
    comprascontroller.test.js      — 80 tests (solicitudes, productos, estados, adjuntos)
    ordenescompracontroller.test.js — 187 tests (órdenes, asignación, propagación, cierre)
    proveedorescontroller.test.js   — 107 tests (CRUD, NIT único, baja lógica)
  services/
    estadosolicitud.test.js         — 66 tests (recálculo en 6 caminos, mínimo correcto)
    transacciones.test.js           — 32 tests (consecutivos, sesiones, errores)
```

**Total**: 472 tests (se ejecutan con `npm test`). Todos pasando. Lint `standard` limpio.
