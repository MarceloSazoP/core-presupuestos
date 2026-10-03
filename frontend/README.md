# Web (Next.js 16)

Prototipo del flujo web. Los datos son **provisionales**: viven en `.data/presupuestos.json` (ignorado por Git) y se reemplazan por la API cuando exista; solo cambia `src/lib/presupuestos.ts`.

## Flujo

La app móvil crea el presupuesto y su **código**. En la web, la caja "Consultar presupuesto" recibe ese código y el estado del presupuesto decide qué se puede hacer:

| Estado | Qué ofrece la web |
|--------|-------------------|
| Pendiente | Completar o editar (ítems, descuento, garantía, validez, observaciones). **Guardar** lo deja pendiente; **Terminar y enviar** lo cierra, envía el PDF por correo y ofrece el enlace de WhatsApp. |
| Cerrado | Solo ver, con **Descargar PDF** y **Enviar a correo**. |
| Código inexistente | "No existe un presupuesto con ese código." |

Códigos de demostración: `pre-1` (cerrado) y `pre-2` (pendiente). Los códigos se guardan solo como hash **Argon2id**; los tokens de sesión van en una cookie `httpOnly` firmada.

## Puesta en marcha

Requiere Node 24.

```bash
cd frontend
cp .env.example .env.local   # completar SESSION_SECRET, SMTP_* y los datos de prueba
npm install
npm run dev                  # http://localhost:3012
npm test                     # lógica pura: totales y hash del código
npm run check                # tipos
```

Para volver a los datos de demostración, borra `.data/`.

## Límites conocidos del prototipo

- WhatsApp usa un enlace `wa.me` con el mensaje escrito; el PDF va solo por correo (el MVP no usa la API de WhatsApp Business).
- Los códigos de demostración son adivinables. Los de la app móvil deben ser aleatorios y largos.
- El límite de intentos vive en memoria de un solo proceso.
- El cliente y el correo de envío salen de `.env.local`, no de un formulario.
