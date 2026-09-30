# Referencia del HTML (mask y complete)

El formulario busca los elementos por el atributo `name` y les escribe la respuesta. Sirve cualquier etiqueta — `<span>`, `<b>`, `<div>` —, y un mismo `name` puede repetirse: se llenan todos.

El **mask** es la vista previa mientras se diligencia; el **complete** es el que se vuelve PDF. En las plantillas suelen ser casi idénticos. Cambia los dos igual.

## Campos

```html
<p>Nombre: <span name="nombre_comprador">________</span></p>
```

Lo que haya dentro es solo relleno: se reemplaza por la respuesta.

## Cláusulas

Un span **por opción**, con el nombre `{pregunta}_{valor}`:

```html
<span name="tipo_documento_cc">Cédula de ciudadanía</span>
<span name="tipo_documento_ce" hidden>Cédula de extranjería</span>
```

- La opción que coincide con el `value` va **sin** `hidden`; las demás, con `hidden`.
- Si la cláusula no tiene `value`, **todas** van con `hidden`.
- Un span vacío (`<span name="x_si" hidden><br /></span>`) hace que elegir esa opción no muestre nada. Es la causa más común de "no marca".

En las plantillas viejas el valor de la opción repite el nombre de la pregunta, y el span queda doble: `glp_glp_si`. No lo "arregles": el span tiene que coincidir con el `value` que está en el config.

## Mostrar u ocultar bloques enteros

El SDK solo alterna `hidden` en los spans de una cláusula, sin tocar su contenido. Por eso se puede envolver una sección completa:

```html
<span name="tipo_de_equipo_electrico" hidden>
  <li>
    <p><strong> ESTADO BATERÍA DE TRACCIÓN</strong></p>
    <ul> ... </ul>
  </li>
</span>
```

Al elegir "eléctrico" se muestra; con otra opción queda oculto y no se imprime. Mismo nombre, mismo estado inicial que el span de esa opción en el resto del documento.

Cuida que el span cierre donde debe: uno mal cerrado oculta todo lo que sigue. Después de envolver, confirma que cada span tenga dentro el mismo número de `<li>` que de `</li>`.

## Firmas

**Firma del firmante** — el espacio donde se estampa, uno por `type` del `signatureProfile`:

```html
<div name="comprador" class="sign-margin"></div>
```

- **Usa `name`, no `id`.** El formulario ubica la firma por `name`: con `id` sale en el PDF pero no en la vista previa.
- Si el firmante firma en varios lugares, `name` en cada uno. Nunca mezcles `id` y `name` para el mismo firmante en elementos distintos: los de `name` se ignoran.
- `sign-margin` reserva espacio antes de firmar; al estampar cambia a un margen menor.

**Firma dentro del formulario** — una pregunta `type: "signature"` se pinta en el elemento con su `name`. Para firmar en el momento, la pregunta, el `type` y el `signature` del firmante llevan el mismo nombre.

**Fecha de firma** — `signDate` se llena solo con la fecha en que se completa la firma. No se declara en el config:

```html
Firmado el <span name="signDate">________</span>
```

## Restricciones del PDF

El generador de PDF de Auco soporta un CSS limitado:

- **No usar** flexbox, grid, variables CSS (`var(--x)`), unidades `vw`/`vh`.
- **Sí**: tablas, `display: block`/`inline-block`, `float`, `position`.
- `<meta charset="UTF-8">` y tildes escritas directo (`á`, no `&aacute;`).
- Para ocultar algo que se tiene que quedar en el HTML (por ejemplo los datos de un firmante que no se deben imprimir), usa `style="display:none"`: el atributo `hidden` no es confiable en el PDF fuera de las cláusulas.
- No repitas encabezados por página ni pongas saltos de página a mano: el documento es un flujo continuo. Header y footer por página van en `custom` (ver `config.md`).

## Editar sin romper

- **Muchos HTML viejos usan CRLF.** Si reemplazas texto con un script, acepta `\r?\n` o no va a encontrar nada — y no avisa.
- Cuando cambies un bloque por script, que el patrón coincida **exactamente una vez**, y aborta si no. Un reemplazo a ciegas puede tocar la copia duplicada de un pagaré o de una carta.
- Para cortar texto espaciado, "espacios en blanco" suele ser relleno: `<br/>` sueltos y `<p><span>&nbsp;</span></p>`. Quitarlos y dar margen con un `<style>` al principio recupera mucho espacio sin tocar el diseño.
