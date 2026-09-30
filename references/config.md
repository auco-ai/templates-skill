# Referencia del `config.json`

Lo que se manda en el `PUT`/`POST`. Complementa la documentación oficial del API de plantillas: aquí está resumida y con lo que la documentación **no** cubre, marcado así: *(sin documentar)*.

## Campos de la raíz

| Campo | Qué es |
|---|---|
| `name` | nombre de la plantilla (obligatorio) |
| `description` | descripción, máx. 500 caracteres. No se puede borrar una vez puesta |
| `config` | arreglo de preguntas (obligatorio) |
| `sign` | nombres de las preguntas obligatorias (obligatorio, puede ir vacío) |
| `signatureProfile` | firmantes (obligatorio) |
| `help` | textos de ayuda *(sin documentar)* — ver abajo |
| `custom` | header, footer y márgenes del PDF *(sin documentar)* — ver abajo |
| `preFill` | valores fijos `[{ name, value }]` que resuelven campos sin preguntarlos (p. ej. `country`) |
| `preBuild`, `preBuildData` | prellenado en dos fases; `preBuildData` lista las preguntas de la primera fase |
| `files` | documentos adjuntos que se piden al firmante con `package: true`: `[{ name, approve: "pending", optional? }]`. Un adjunto es obligatorio salvo `optional: true`; `required: false` no existe y el API lo rechaza |
| `pagare`, `pagareData` | camino del pagaré electrónico |

El `build` no se manda: el servidor lo incrementa en cada `PUT`, y eso es lo que invalida la caché del SDK.

## Pregunta

Toda pregunta lleva `name` (snake_case, único), `description` (el enunciado — **no puede ir vacío**, el API lo rechaza) y `type`.

| Tipo | Uso | En el HTML |
|---|---|---|
| `text` | texto libre | un span con `name` |
| `name` | texto que se pinta en MAYÚSCULAS | un span |
| `email`, `phone` | con validación | un span |
| `number`, `currency` | numérico; `currency` escribe el valor en letras salvo `removeText: true` | un span |
| `date` | calendario; se pinta "15 de enero de 2024" | un span |
| `nit` | NIT colombiano, se formatea `XXXXXX-X` | un span |
| `identification` | país + tipo + número; se guarda `"CC 1084340519"` | un span |
| `department` | lista de departamentos | un span |
| `select`, `searchlist` | lista; opciones `{ name, label, value }` | **un** span, recibe el `label` |
| `clausula` | lista que **condiciona** otras preguntas o bloques; opciones `{ name, value }` | **un span por opción** `{name}_{value}` |
| `check` | selección múltiple; usa `values: ["a","b"]` plano, **no** `options` | un span, recibe "a, b" |
| `image` | foto o archivo | un span, recibe un `<img>` |
| `signature` | firma dibujada o escrita | ver `html.md`, firmas |
| `request` | valida contra un endpoint externo | ver la documentación del tipo Request |

### Atributos

`value` (opción por defecto de `clausula`/`select`) · `options` · `values` · `help` · `prereq` · `prereqOptionals` · `removeText` · `endpoint` · `select` · `min` · `max` · `subYears` · `subDays` · `afterSubYears` · `maxlength` · `regex` · `addText` · `country` · `allow` · `groupQuestion`

Cualquier otro atributo hace que el `PUT` rechace **toda** la plantilla.

Lo que hacen los menos obvios:

- `min: "now"` en un `date` *(sin documentar)*: arranca con la fecha de hoy y bloquea las pasadas.
- `subYears: 18` en un `date`: exige que la fecha sea de hace al menos 18 años.
- `country: "co"` en `phone`, `"CO"` en `identification`/`department`: fija el país.
- `allow: ["draw", "font"]` en `signature`: modos de firma permitidos.
- `maxlength`, `regex`: límite y patrón para un `text`.
- `groupQuestion: { id, max, errorMessage? }`: varias preguntas numéricas que juntas no pueden pasar de `max`.

## Condicionales

```json
{ "name": "cual_lesion", "type": "text", "description": "¿Cuál lesión?",
  "prereq": [{ "k": "tiene_lesiones", "v": "si" }] }
```

- `k` tiene que ser una **`clausula`**. Sobre un `check` nunca se cumple: el valor de un check es la lista unida por comas.
- Varias entradas en `prereq` se combinan con Y.
- `prereqOptionals: ["pregunta_valor1", "pregunta_valor2"]` da el O: aparece con cualquiera de esos valores.
- El `prereq` solo decide si se **pregunta**. Para que un bloque tampoco se **imprima**, envuélvelo en el span de la opción en el HTML (ver `html.md`).

## Obligatorias: `sign`

Las preguntas en `sign` no se pueden saltar. Las de tipo `signature` son obligatorias solas.

Una pregunta con `prereq` en `sign` **solo es obligatoria cuando aparece**: si el `prereq` no se cumple, el SDK la salta y no la exige.

Una `clausula` sin `value` arranca sin nada elegido (el SDK muestra "Escoja una opción"). Si no está en `sign`, quien la salte la deja en blanco.

## Textos de ayuda: `help` *(sin documentar)*

Es lo que sale debajo del botón "Siguiente". Vive en la raíz, indexado por nombre, y cada pregunta lo referencia con su propio `help`:

```json
"help": { "correo": "A este correo llega la copia firmada." },
"config": [{ "name": "correo", "type": "email", "description": "...", "help": "correo" }]
```

Si dos preguntas comparten `name`, comparten ayuda. Para separarlas, crea otra clave en `help` y apunta la segunda a ella.

`description` es el enunciado; `help` es la ayuda. Cuando un cliente pide cambiar "el texto que sale abajo", es `help`.

## Firmantes: `signatureProfile`

```json
{ "type": "comprador", "name": "nombre_comprador", "identification": "cedula_comprador",
  "email": "correo_comprador", "phone": "celular_comprador" }
```

Cada campo apunta al **nombre de una pregunta** (o de un `preFill`), no trae el dato.

- `type` es el identificador del firmante y el nombre de su espacio de firma en el HTML.
- `name` va como **un solo string**. El arreglo lo rechaza el API.
- `identification` hace falta en todo firmante que no sea `APPROVER`, o falla el proceso de firma. Acepta varias con `|`: `"cedula|cedula_ext|pasaporte"`.
- `email` o `phone`, al menos uno, salvo si el firmante firma en el momento (`signature`): ahí no se le envía nada. Cuando van, tienen que apuntar a una pregunta `email`/`phone` o a un `preFill`.
- `role: "APPROVER"` aprueba, no firma: no pasa por la resolución de datos.
- `order` (número) hace la firma secuencial: cada participante recibe la invitación cuando firman los de turno anterior.
- `package: true` marca al participante al que se le piden los adjuntos de `files`.
- `country` e `identificationType` son **valores fijos** (`"CO"`, `"CC"`), no nombres de pregunta. Sirven cuando la identificación se pide con una pregunta que no es de tipo `identification` (que ya trae país y tipo).
- `signature` apunta a una pregunta `type: "signature"`, para firmar dentro del formulario. La convención es `pregunta.name == type == signature`.

## Header, footer y márgenes: `custom` *(sin documentar)*

```json
"custom": {
  "noShowHeader": true,
  "header": { "height": "10mm", "contents": { "first": "...", "default": "...", "last": "<div></div>" } },
  "footer": { "height": "18mm", "contents": { "first": "...", "default": "...", "last": "<div></div>" } },
  "border": { "top": "1.2cm", "right": "2cm", "bottom": "1.2cm", "left": "2cm" }
}
```

Lo aplica el generador de PDF de Auco. Trampas, todas vistas en producción:

- **Un `footer` propio reemplaza el pie de verificación de Auco** (el del código de validación de auco.ai/verify), y ese código no se puede replicar. Avisa antes de ponerlo.
- **El certificado de firma recibe el mismo header y footer**: se concatena al mismo HTML. Para que salga limpio, `last` con algo que no se vea.
- **`last: ""` no sirve**: es falso, cae al `default` y se imprime igual. Usa `"<div></div>"`.
- **Declara `first` explícito.** Un documento sin firmar tiene una sola página, que es `first` y `last` a la vez; `first` se evalúa antes.
- **La altura se reserva en todas las páginas**, incluida la última aunque vaya vacía, y se suma al `border`. Ajusta los dos o el contenido se monta o queda muy abajo.
- `{{page}}` y `{{pages}}` sí funcionan dentro del contenido.
- `noShowHeader: true` quita el encabezado de QR y logo del cuerpo; es independiente de `header`.
