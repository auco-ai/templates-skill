# auco-templates

Skill de Claude Code para editar, crear y publicar automatizaciones (plantillas) de Auco a través del API público de templates. Solo necesita las llaves del API de tu organización.

## Instalación

```bash
git clone https://github.com/auco-ai/templates-skill.git ~/.claude/skills/auco-templates
```

Requiere Node 18 o superior. No tiene dependencias.

## Llaves

Cada cliente tiene una llave **pública** (`puk_`, para leer) y una **privada** (`prk_`, para escribir) por ambiente. Van en `~/.auco/keys.env` (o en un `.env.api` dentro de la carpeta donde trabajas):

```
AUCO_PUK_DEV=puk_...
AUCO_PRK_DEV=prk_...
AUCO_PUK_PROD=puk_...
AUCO_PRK_PROD=prk_...
```

Las llaves las encuentras en tu cuenta de Auco. Si manejas varias compañías, agrega un sufijo por cada una (`AUCO_PRK_PROD_ACME`) y elígela con `--client acme`.

- Protégelo: `chmod 600 ~/.auco/keys.env`.
- **Nunca pegues una llave en el chat con Claude**: la conversación queda guardada.
- Nunca subas ese archivo a un repo. El `.gitignore` de este skill ya lo excluye.

## Uso

Abre Claude Code en la carpeta donde vas a trabajar las plantillas (ahí quedan las copias que baja) y pídele el cambio con tus palabras:

> En la plantilla 64f1c2a9e1b3d40012345678 de producción, la opción "Sede Norte" no marca en el formulario.

No hace falta nombrar el skill: Claude lo usa solo cuando el pedido es sobre una plantilla de Auco. Si quieres llamarlo explícitamente, escribe `/auco-templates` seguido del pedido:

```
/auco-templates pasa la plantilla 64f1c2a9e1b3d40012345678 de stage a producción
```

Claude baja la plantilla, la corrige, la valida y, después de confirmarlo contigo, la publica y verifica que quedó igual en el ambiente.

Otros pedidos que puedes hacerle:

- «Crea una plantilla en stage a partir de este Word» (y le pasas la ruta del archivo).
- «Muéstrame cómo se ve la plantilla X antes de publicarla».
- «¿Por qué el campo cédula queda en blanco en el PDF de la plantilla X?»
- «Lista las plantillas de producción».

Los scripts también se pueden correr a mano desde `scripts/`: `list.js`, `pull.js`, `validate.js`, `render.js`, `push.js`, `create.js`, `delete.js`, `probe-schema.js`. Cada uno explica su uso en la cabecera.

`list.js` no trae las plantillas creadas con el constructor de Auco.

Para ver una plantilla antes de publicarla:

```bash
node scripts/pull.js prod <id>
node scripts/render.js <id> --open
```

## Documentación

La referencia completa del API de plantillas está en [docs.auco.ai](https://docs.auco.ai/api/template/introduction):

- [Tu primera plantilla](https://docs.auco.ai/api/template/quickstart)
- [Configuración JSON](https://docs.auco.ai/api/template/json): tipos de pregunta, validaciones, condicionales y firmantes.
- [Configuración HTML](https://docs.auco.ai/api/template/html): cómo se marcan los campos y las firmas.
- [Ambientes](https://docs.auco.ai/api/environment)

## Ambientes

| | API |
|---|---|
| stage (`dev`) | `https://dev.auco.ai/v1.5/ext/template` |
| producción (`prod`) | `https://api.auco.ai/v1.5/ext/template` |

Para actualizarlo:

```bash
git -C ~/.claude/skills/auco-templates pull
```

## Licencia

MIT. Ver [LICENSE](LICENSE).
