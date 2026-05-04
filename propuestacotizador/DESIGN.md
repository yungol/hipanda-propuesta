# DESIGN.md — HiPanda Propuestas

## Referencia base

Toda la especificación de diseño se extrae de `../propuesta-galco-2026.html`. Ese archivo es la fuente de verdad. Lo que está acá es su documentación para que cualquier propuesta nueva sea consistente sin tener que leer el HTML.

---

## Colores

Sistema basado en OKLCH. Los nombres son semánticos, no descriptivos.

```css
:root {
  /* Fondos */
  --paper:        oklch(0.985 0.005 85);   /* Fondo principal. Blanco cálido, no puro. */
  --paper-soft:   oklch(0.969 0.007 82);   /* Fondo de secciones secundarias, cards. */
  --paper-strong: oklch(0.944 0.008 82);   /* Fondo de elementos con más peso visual. */

  /* Texto */
  --ink:   oklch(0.252 0.012 252);         /* Texto principal. Casi negro con tinte azul frío. */
  --muted: oklch(0.53 0.016 250);          /* Texto secundario, labels, descripciones. */

  /* Estructura */
  --line:       oklch(0.865 0.008 80);     /* Bordes, divisores. */
  --slate-soft: oklch(0.95 0.012 245);     /* Fondo alternativo con tinte frío. */
  --slate-line: oklch(0.88 0.014 245);     /* Borde para elementos sobre slate. */

  /* Acento */
  --accent:      oklch(0.59 0.074 46);     /* Amber cálido. Kickers, precios destacados, énfasis. */
  --accent-soft: oklch(0.946 0.022 46);    /* Fondo de callouts y conclusiones ejecutivas. */
}
```

### Estrategia de color: Restrained

Un único acento (amber) que aparece en menos del 10% de la superficie. El resto es papel, tinta y estructura.

El acento nunca se usa en fondos grandes ni en headings principales. Solo en:
- Kickers (etiquetas de sección)
- Números o métricas con énfasis especial
- La línea superior del `.contract-shell`
- Textos de conclusión ejecutiva

### Fondo de página

No es un color plano. Es una composición de gradientes:

```css
background:
  radial-gradient(circle at top left,  oklch(0.96 0.012 50) 0, transparent 28%),
  radial-gradient(circle at top right, oklch(0.958 0.012 235) 0, transparent 30%),
  linear-gradient(180deg, var(--paper) 0%, oklch(0.978 0.006 84) 100%);
```

Dos halos sutiles en las esquinas superiores (uno warm, uno cool) sobre un gradiente vertical casi imperceptible. Le da profundidad al fondo sin que se note.

---

## Tipografía

**Familia única:** Libre Franklin (Google Fonts)

```html
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

No se usa ninguna otra familia. Sin serifs, sin monospace decorativo.

### Escala y roles

| Rol | Tamaño base | Peso | Tracking | Uso |
|-----|-------------|------|----------|-----|
| Kicker | 0.73rem | 700 | 0.18em | Etiquetas de sección en mayúsculas |
| H1 (hero) | 4.6rem desktop / 5xl tablet / 4xl mobile | 800 (extrabold) | -0.04em | Título principal de la propuesta |
| H2 (sección) | 3xl–4xl | 700 (bold) | -0.04em | Títulos de cada sección |
| H3 (contrato) | 2xl | 700 (bold) | -0.03em | Títulos de contratos/artículos |
| Body largo | lg–xl | 400 | normal | Párrafos descriptivos principales |
| Body corto | base | 400 | normal | Texto de apoyo, descripciones |
| Labels | sm | 600–700 | 0.12em | Etiquetas de datos en mayúsculas |
| Datos/valores | base–lg | 600–700 | normal | Montos, vigencias, modalidades |

### `.kicker`

```css
.kicker {
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.73rem;
  font-weight: 700;
}
```

Siempre en `.accent` o `.muted`. Nunca en `.ink`. Nunca con font-size mayor a 0.8rem.

### `.section-title`

```css
.section-title {
  line-height: 1.02;
  letter-spacing: -0.04em;
}
```

Se aplica a todos los H1 y H2 principales. El tracking negativo aprieta las letras y da el efecto editorial característico.

### Medida máxima de cuerpo

```css
.measure { max-width: 72ch; }
```

Los párrafos largos nunca se estiran al ancho completo del contenedor.

---

## Layout

### Contenedor principal

```html
<main class="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-10">
```

`max-w-7xl` (1280px). Padding horizontal responsivo. No se usa `container` de Tailwind.

### Grid asimétrico

El layout no es una columna ni un grid simétrico. Los grids varían por sección:

- Hero: `lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.7fr)]`
- Contexto + Mapa: `lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]`
- Resumen + Tabla: `lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]`
- Próximos pasos: `lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.78fr)]`
- Contratos: `lg:grid-cols-3`

La asimetría es deliberada. Crea tensión visual y jerarquía. No usar `grid-cols-2` simétrico salvo en tablas de datos.

### Separación entre secciones

`mt-8` entre secciones principales. `gap-8` o `gap-10` dentro de grids.

### Bordes y radios

- Sección principal (card grande): `rounded-[2rem]`
- Cards internas (contratos, asides): `rounded-[1.75rem]`
- Callouts internos: `rounded-[1.5rem]` o `rounded-[1.25rem]`
- Elementos pequeños (fecha, etc.): `rounded-[1.5rem]`

El radio decrece con el nivel de anidamiento. Nunca un elemento hijo tiene el mismo radio que su padre.

---

## Componentes

### `.contract-shell`

Card de contrato con línea accent en la parte superior:

```css
.contract-shell::before {
  content: '';
  display: block;
  height: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--accent) 95%, transparent),
    color-mix(in oklab, var(--accent) 30%, transparent)
  );
  margin-bottom: 1.25rem;
  border-radius: 999px;
}
```

La línea va de accent sólido a accent transparente, de izquierda a derecha. Es el único uso de `border-*` como acento visual permitido porque es un `::before`, no un `border-left`.

### `.stat-line`

Grid de dos columnas para métricas con descripción:

```css
.stat-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  padding: 0.95rem 0;
  border-top: 1px solid var(--line);
}
.stat-line:first-child {
  border-top: 0;
  padding-top: 0;
}
```

El valor va a la derecha en `.ink` o `.accent`. La descripción va a la izquierda en `.muted`. En mobile colapsa a columna simple.

### `.flow-index`

Número de paso en listas ordenadas:

```css
.flow-index {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: color-mix(in oklab, var(--paper) 84%, var(--accent-soft));
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 700;
  flex-shrink: 0;
}
```

Círculo con mezcla de paper y accent-soft. Nunca relleno sólido de color.

### Callout / Conclusión ejecutiva

```html
<div class="rounded-[1.5rem] border border-line bg-[color:var(--accent-soft)] p-5 sm:p-6">
  <p class="text-sm font-semibold uppercase tracking-[0.12em] accent">Conclusión ejecutiva</p>
  <p class="mt-3 text-base leading-7 ink">...</p>
</div>
```

Fondo `--accent-soft`, borde `--line`. El label en `.accent`. El cuerpo en `.ink` (no `.muted`).

### Callout neutro ("No incluye", "Resultado esperado")

```html
<div class="rounded-[1.25rem] border border-line bg-[color:var(--paper)] p-4">
  <p class="text-sm font-semibold uppercase tracking-[0.12em] muted">No incluye</p>
  <p class="mt-2 text-sm leading-6 muted">...</p>
</div>
```

Fondo `--paper` (más claro que el padre que es `--paper-soft`). Todo en `.muted`.

### Tabla de datos

Sin `<table>`. Se usa grid responsivo:

```html
<div class="hidden md:grid md:grid-cols-[1.4fr_1fr_1fr] border-b border-line bg-[color:var(--paper-soft)] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] muted">
  <!-- headers -->
</div>
<div class="divide-y divide-[color:var(--line)]">
  <!-- filas con grid-cols-[1.4fr_1fr_1fr] -->
</div>
```

En mobile, los headers se ocultan y cada celda muestra su propio label encima.

---

## Sombras y elevación

Un solo nivel de sombra para las cards principales:

```css
box-shadow: 0 24px 80px rgba(45, 39, 32, 0.08);
```

En Tailwind: `shadow-paper` (configurado en `tailwind.config`). Solo en las cards de primer nivel sobre el fondo de página. No se apila sombra sobre sombra.

En impresión: `box-shadow: none` (clase `.print-shadow`).

---

## El panda

El logo de HiPanda aparece dos veces: en el header de la propuesta junto a la identificación, y en la firma. Es un PNG embebido en base64.

En propuestas nuevas, el logo siempre va acompañado de:
- `class="kicker muted"` → "HiPanda" como kicker sobre el título
- O `class="text-sm font-semibold uppercase tracking-[0.12em] accent"` → "HiPanda" en la firma

Nunca va solo el logo sin el nombre de la empresa.

---

## Impresión

La propuesta tiene que funcionar impresa en A4:

```css
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: var(--paper); }
  .print-btn, .no-print { display: none !important; }
  .print-shadow { box-shadow: none !important; }
  section { break-inside: avoid; page-break-inside: avoid; }
  a { text-decoration: none; color: inherit; }
}
```

Todo lo que sea interactivo o decorativo se oculta al imprimir. El contenido queda intacto.

---

## Stack técnico

- **HTML** semántico (`<main>`, `<section>`, `<article>`, `<aside>`, `<dl>`, `<ol>`)
- **Tailwind CSS** via CDN (`https://cdn.tailwindcss.com`)
- **Libre Franklin** via Google Fonts
- Sin JavaScript de interfaz. El único JS es el botón de impresión.
- Sin dependencias externas adicionales.
- Todo el CSS custom va en `<style>` en el `<head>`.

---

## Lo que no va

- Gradientes de texto (`background-clip: text`)
- `border-left` como acento de color en cards
- Cards idénticas en grid simétrico sin variación
- Glassmorphism
- Animaciones (propuesta estática)
- Iconografía de terceros (sin Font Awesome, sin Heroicons, sin emojis decorativos)
- `#000` o `#fff` en ningún lado
- Sombras apiladas
