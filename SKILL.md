---
name: auco-templates
description: Edita, crea, valida y publica automatizaciones (plantillas) de Auco a través del API público de templates, con la llave pública y privada del cliente por ambiente (dev.auco.ai / api.auco.ai). Úsalo siempre que alguien pida cambiar una plantilla o formulario de Auco — textos de preguntas, opciones, secciones, campos obligatorios, firmantes, header o footer del PDF, "el campo queda en blanco", "no marca la opción" — o cuando mencione un id de plantilla de 24 caracteres, el mask o el complete, una clausula, un prereq, el signatureProfile, crear una plantilla desde un Word, Excel o PDF, o pasar una plantilla de stage a producción. Úsalo aunque no digan "plantilla": un reporte de cliente del tipo "en el formulario X sale Y" también es para este skill.
---

# Plantillas de Auco por el API

Una automatización de Auco son **tres piezas que tienen que ir sincronizadas**:

| Pieza | Qué es |
|---|---|
| `config.json` | las preguntas (`config`), obligatorias (`sign`), firmantes (`signatureProfile`), textos de ayuda (`help`), header/footer (`custom`)… |
| `mask.html` | lo que ve quien diligencia, con la vista previa en vivo |
| `complete.html` | lo que se convierte en PDF, con los espacios de firma |

Si el config y el HTML se desalinean **nada falla en voz alta**: el campo simplemente queda en blanco. Por eso cada cambio pasa por validar antes y verificar después — los scripts de este skill lo hacen solos.

Todo se hace por el API público, con las llaves de la organización.

## Llaves

Cada cliente tiene **dos llaves por ambiente**, y no son intercambiables:

- **Pública** (`puk_…`): para leer — listar y bajar plantillas.
- **Privada** (`prk_…`): para escribir — crear y actualizar.

Cada llave ve **solo las plantillas de su compañía**. Para tocar la plantilla de un cliente hace falta la llave de ese cliente.

Van en un archivo local que **nunca se comparte ni se sube a un repo**. Los scripts lo buscan en `$AUCO_KEYS_FILE`, luego `./.env.api`, luego `~/.auco/keys.env`:

```
AUCO_PUK_DEV=puk_...
AUCO_PRK_DEV=prk_...
AUCO_PUK_PROD=puk_...
AUCO_PRK_PROD=prk_...
```

Quien maneje varias compañías puede agregar un sufijo por cada una (`AUCO_PRK_PROD_ACME`) y elegirla con `--client acme`. Sin sufijo es la llave por defecto.

Si falta una llave, el script lo dice con el nombre exacto de la variable. **Pídele a la persona que la agregue al archivo; nunca le pidas que la pegue en el chat**, porque la conversación queda guardada. Tampoco imprimas nunca el valor de una llave.

## Flujo

Los scripts están en `scripts/` dentro de este skill. Córrelos con `node` (Node 18+, sin dependencias) desde la carpeta de trabajo de la persona.

**1. Bajar siempre primero**, aunque ya exista una copia local — la de una sesión anterior casi seguro está vieja:

```bash
node <skill>/scripts/pull.js prod <id>
```

Deja `<id>/config.json`, `mask.html`, `complete.html` y un `.source.json` que recuerda ambiente, id y cliente.

**2. Editar** los tres archivos. Para saber cómo, lee `references/config.md` (tipos de pregunta, atributos, `help`, `custom`) y `references/html.md` (cómo se marcan los campos, cláusulas, bloques condicionales, firmas, header y footer). La documentación oficial del API está en https://docs.auco.ai/api/template/introduction (en especial `/api/template/json` y `/api/template/html`); si una duda no se resuelve con las referencias locales, consúltala ahí.

**3. Validar** — muestra lo que el API rechazaría (ERROR) y lo que pasa pero se rompe (warning):

```bash
node <skill>/scripts/validate.js <id>
```

**4. Publicar** — valida otra vez, guarda un backup de lo que está vivo, sube config y HTML y relee del ambiente para comparar:

```bash
node <skill>/scripts/push.js <id>
```

El ambiente, el id y el cliente salen del `.source.json`, así que no se puede publicar por error en otro ambiente. Si termina con algo distinto de `matches`, el cambio no quedó como se mandó: investiga antes de dar por terminado.

**Otros comandos:**

- `list.js <env>` — lista las plantillas de la compañía de la llave. No trae las plantillas creadas con el constructor de Auco.
- `create.js <carpeta> --env <env>` — crea una plantilla nueva. También es la forma de **pasar una plantilla de stage a prod**: se baja con la llave de stage y se crea con la de prod. Queda con **un id nuevo** — avísalo, porque cualquier link o referencia al id viejo no aplica.
- `delete.js <env> <id> --yes` — elimina una plantilla. Primero baja una copia completa a `deleted/<id>-<env>-<fecha>/`; sin `--yes` solo muestra qué borraría. El API se niega (`TEMPLATE_IN_USE`) si algún contrato creado con ella sigue en firma. Si la borra, **también borra sus links de referencia**: avísale a la persona que esos links dejan de funcionar. **No se puede deshacer**: con la copia se puede recrear con `create.js`, pero sale con otro id y los links que apuntaban a la vieja dejan de servir. Confirma siempre con la persona antes de correrlo con `--yes`, en cualquier ambiente.
- `probe-schema.js <env>` — pregunta al API qué campos acepta, sin cambiar nada. Úsalo si el API rechaza algo que el validador dejó pasar, o para confirmar si ya acepta los campos que hoy rechaza.
- `render.js <carpeta> --open` — vista previa local en el navegador: simula el formulario, deja elegir las opciones de cada cláusula para ver qué bloques aparecen, marca los campos sin pregunta y dónde cortaría cada página. Úsalo para revisar un cambio antes de publicar y para mostrárselo a la persona. Las opciones se pueden fijar en la URL (`preview.html#pregunta=valor`). Es una aproximación, no el PDF real.

## Antes de publicar en producción

Confirma con la persona antes de correr `push.js` o `create.js` contra `prod`, a menos que ya te haya dicho explícitamente que publiques. Muéstrale qué cambia en una o dos líneas. Una plantilla en producción la están diligenciando clientes reales.

## Reglas que cuestan caro olvidar

1. **Cambios del cliente: lee todo lo que mandó.** Un Word o PDF de correcciones suele traer **imágenes** con información que el texto no dice (una tabla de opciones, un asterisco de obligatorio). Extráelas y míralas antes de construir.
2. **Una cláusula muestra un `<span name="{pregunta}_{valor}">` por opción.** Si una opción "no marca" o "queda en blanco", el span falta, tiene otro nombre o está vacío — revisa en ese orden.
3. **`prereq` solo funciona sobre una `clausula`**, nunca sobre un `check`. Si algo debe aparecer según una pregunta de selección múltiple, hace falta una cláusula puente.
4. **Mostrar u ocultar un bloque entero del documento** se hace envolviéndolo en el span de la opción: `<span name="tipo_de_equipo_electrico" hidden>…</span>`. El `prereq` evita que se pregunte; el span evita que se imprima. Hacen falta los dos.
5. **El ancla de firma va por `name`, no por `id`.** El formulario ubica la firma por `name`, así que un `<div id="…">` sale en el PDF pero no en la vista previa.
6. **Nombres repetidos en `config`** son legales si las opciones difieren, pero colapsan todo lo que se indexa por nombre, como el `help`.
7. **Los HTML viejos traen saltos CRLF.** Un reemplazo que busque `\n` no encuentra nada y no avisa. Usa patrones con `\r?\n`.
8. **No quites una pregunta que otro caso sigue necesitando.** Si una pregunta nueva "duplica" una vieja pero aplica solo a un caso (por ejemplo solo equipos eléctricos), condiciona la vieja al caso contrario en vez de borrarla, o ese caso se queda sin cobertura.
9. **Los campos de `preBuildData` pueden no tener span y estar bien**: varios son internos del proceso. El validador los muestra como warning.
10. **Antes de dar algo por terminado, que `push.js` diga `matches` en las tres piezas.**

## Criterios de diseño

Estos vienen de correcciones reales del equipo. Aplícalos por defecto:

- **Las cláusulas nuevas no llevan opción preseleccionada.** Con un default, el formulario responde por la persona. Si no tiene default, métela en `sign`, o quien la salte la deja en blanco.
- **Nunca pongas a nadie a escribir "N/A".** Un dato opcional se modela como cláusula Sí/No (sin preseleccionar) más un campo de texto que cuelga de ella con `prereq`.
- **Los textos de ayuda (`help`) solo dicen lo que está en la fuente**: formato (`sin puntos ni espacios`), ejemplos, o cómo usar el control. **No inventes cómo opera el cliente** — ni quién toma una medida, ni para qué se usan unas fotos, ni recomendaciones. Un campo sin ayuda es mejor que uno con una afirmación falsa. Tampoco repitas el enunciado.
- **Si el pedido deja una duda con consecuencias, pregunta.** Sobre todo en documentos legales (pagarés, contratos): no reescribas el articulado por iniciativa propia.

## Lo que el API no permite

Dilo con claridad cuando aplique, en vez de intentar rodearlo:

- **El correo y el celular de cada firmante tienen que salir de una pregunta `email` o `phone`** (o de un `preFill`). Si apuntan a una pregunta `text` o a una que no existe, el API rechaza la plantilla entera (`PROFILE_FIELD_TYPE_INVALID` / `PROFILE_FIELD_NOT_FOUND`). Hay plantillas viejas así: para guardarlas hay que cambiar el tipo de la pregunta a `email`, no quitar el correo. El firmante que firma en el momento (con `signature`) no necesita ni correo ni celular.
- **`signatureProfile.name` como arreglo** (nombre armado con varios campos): el API lo rechaza. Usa un solo campo con el nombre completo.
- **Links de referencia** (`reuseDocuments`), incluida la firma en el momento (`signNow`): no tienen endpoint público.
- **Cambiar la compañía de una plantilla**: la fija la llave.
- **Conservar el id** al pasar de stage a prod: siempre sale uno nuevo.

## Limitaciones

- **El PDF real no se puede generar desde acá** — lo genera el generador de PDF de Auco. `render.js` da una buena aproximación (condicionales, campos en blanco, cortes de página), pero para lo fino —si algo cabe justo en una página, cómo queda el header— pide que generen un documento de prueba.
- **El validador no ve el comportamiento en vivo del formulario.** Cuando un cambio depende de cómo navega o exige el SDK (condicionales, obligatorias), dilo y pide una prueba en stage.
