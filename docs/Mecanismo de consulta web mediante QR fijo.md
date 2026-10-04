# Mecanismo de consulta web mediante código y QR

**Producto:** CorePresupuesto
**Funcionalidad:** Consulta de presupuestos
**Versión:** 1.3 (2026-10-04)

> **Cambio de la v1.3.** La v1.1 pedía un «QR fijo» que abría la página en el navegador del teléfono. No sirve: el profesional quiere ver el presupuesto **en la web del computador**, sin escribir el código. Un QR fijo no puede hacerlo (no sabría a qué computador mandar el presupuesto), así que el QR pasa a ser **uno por visita**, como en WhatsApp Web. El archivo conserva su nombre por compatibilidad. El «ID» de la v1.1 se llama ahora **código** (`7K4M2Q-X9D2P4HTRB`): el ID suelto (6 caracteres) nunca da acceso (CLAUDE.md §16).

## 1. Objetivo

La portada de la web (`/`) ofrece **dos formas equivalentes** de abrir un presupuesto en el computador:

1. **Escribir el código** en la caja de texto y pulsar **Consultar** (ya existe).
2. **Escanear el QR con la app móvil**: en la app, dentro del presupuesto elegido, **Ver en la web** abre la cámara, escanea el QR de la portada y el presupuesto se abre solo en el computador.

Las dos terminan en lo mismo: una sesión `QUOTE_CODE` limitada a ese presupuesto, guardada en una cookie `httpOnly` (Contrato de API §9). La pantalla del presupuesto no sabe cuál de las dos se usó.

## 2. Pantalla (`/`)

Escritorio: la ficha «Consultar presupuesto» muestra la caja de texto a la izquierda y el QR a la derecha, separados por «o». En el teléfono se apilan: caja arriba, QR debajo (donde el QR no sirve, porque el teléfono no puede escanearse a sí mismo, el bloque del QR se reemplaza por una línea: «Para abrirlo sin escribir el código, entra desde un computador»).

```text
┌───────────────────────────────────────────────────────────────┐
│ Consultar presupuesto                                         │
│                                                               │
│  Escribe el código              o      Escanéalo con la app   │
│  ┌─────────────────────┐               ┌─────────┐            │
│  │ 7K4M2Q-X9D2P4HTRB   │               │   QR    │            │
│  └─────────────────────┘               └─────────┘            │
│  [ Consultar ]                         1 Abre la app          │
│                                        2 Elige el presupuesto │
│                                        3 Toca «Ver en la web» │
│                                        Vence en 1:42 · Nuevo  │
└───────────────────────────────────────────────────────────────┘
```

Estados del QR (siempre dicen en palabras lo que pasa; el color no es el único aviso):

| Estado | Qué ve la persona |
|--------|-------------------|
| Esperando | QR + los 3 pasos + cuenta regresiva «Vence en 1:42». |
| Escaneado | «Listo, abriendo tu presupuesto…» y entra solo. |
| Vencido | El QR se difumina y aparece **Generar otro QR** (también se renueva solo al volver a la pestaña). |
| Sin conexión con el servidor | «No pudimos generar el QR. Usa el código.» con **Reintentar**. La caja de texto sigue funcionando. |

## 3. Cómo funciona el QR (por qué es seguro)

```text
Computador                    API                          App del profesional
    │  POST /access/pair       │                                   │
    │ ───────────────────────▶ │  crea vínculo (2 min)             │
    │ ◀── id, código, secreto  │                                   │
    │  muestra el QR(código)   │                                   │
    │                          │         escanea el QR             │
    │                          │ ◀── POST /access/pair/claim ───── │  (sesión USER + presupuesto)
    │  POST /access/pair/poll  │  crea la sesión QUOTE_CODE        │
    │ ───────────────────────▶ │                                   │
    │ ◀── sesión (una sola vez)│                                   │
    │  cookie httpOnly → /presupuesto                              │
```

- El QR contiene solo un **código de vínculo** de un solo uso y 2 minutos. **Nunca** el código del presupuesto ni su secreto.
- El computador guarda aparte un **secreto de espera**. Quien fotografíe el QR no puede recibir la sesión: solo el computador que lo creó puede preguntar por ella.
- Quien vincula debe estar **logueado en la app** (sesión `USER`) y ser dueño del presupuesto. Por eso la app no necesita tener guardado el código del presupuesto.
- La app **pide confirmar** («¿Abrir CP-2026-0012 de Juan Pérez en el computador?») antes de vincular: así nadie te hace escanear un QR ajeno sin que lo notes.
- La sesión entregada es la misma `QUOTE_CODE` de 30 minutos, solo para ese presupuesto, y se entrega **una sola vez**; después el vínculo queda inútil.
- Intentos limitados por IP (Contrato de API §1). Un código de vínculo vencido, usado o inexistente responde siempre lo mismo (404).

## 4. La app (`Ver en la web`)

- En el detalle de **cada presupuesto**: botón **Ver en la web**. Es por presupuesto, no global.
- Abre la cámara con un marco de guía y el texto «Apunta al QR de la pantalla de tu computador». Pide el permiso de cámara con una explicación previa y, si lo niegan, ofrece «Abrir ajustes» y la alternativa del código.
- Solo acepta QR de CorePresupuesto (formato `corepresupuesto://web/<código>`); cualquier otro se rechaza con «Ese QR no es de CorePresupuesto».
- Tras la confirmación: «Listo. Revisa tu computador.» con vibración leve. Si el QR venció: «Ese QR venció. Actualiza la pantalla del computador».
- Requiere conexión (es una operación en línea, como finalizar y enviar).

## 5. Reglas de implementación

- Un solo mecanismo de sesión: escribir el código y escanear el QR terminan en una sesión `QUOTE_CODE` y en la misma cookie.
- La caja de texto **no se reemplaza ni se esconde**: el QR es una alternativa.
- El QR no usa `?id=` ni el código en la URL: nada secreto viaja en direcciones, historial ni registros.
- Accesibilidad: la cuenta regresiva y los estados se anuncian (`aria-live="polite"`); el QR tiene texto alternativo; todo se puede hacer sin él.
- Fuera de alcance de esta versión: abrir el presupuesto en el navegador del teléfono (no sirve al caso de uso) y escaneo con la cámara nativa del teléfono.
