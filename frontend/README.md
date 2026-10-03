# Web (Next.js 16)

La web es un **BFF**: solo el servidor de Next habla con la API del backend (`API_BASE_URL`). El navegador nunca ve el token ni la URL de la API. No tiene reglas de negocio propias (CLAUDE.md §6).

## Flujo

La app móvil crea el presupuesto y su **código** (`7K4M2Q-X9D2P4HTRB`). En la web, la caja "Consultar presupuesto" lo canjea en la API (`POST /access/code/exchange`) por una sesión de 30 minutos limitada a ese presupuesto, que se guarda en una cookie `httpOnly`. El estado del presupuesto decide qué se puede hacer:

| Estado | Qué ofrece la web |
|--------|-------------------|
| Pendiente | Completar o editar (ítems, descuento, garantía, validez, observaciones). **Guardar** lo deja pendiente; **Terminar y enviar** lo cierra, envía el PDF por correo y ofrece el enlace de WhatsApp. |
| Cerrado | Solo ver, con **Descargar PDF**, **Enviar por WhatsApp** y **Enviar a correo**. |
| Código inexistente, equivocado o revocado | "No existe un presupuesto con ese código." |

Además, `/q/[token]` es la **vista pública del cliente** (solo lectura, pensada para el teléfono): es el enlace que lleva el mensaje de WhatsApp y el correo, y desde ahí se descarga el PDF.

## Puesta en marcha

Requiere Node 24 y el backend corriendo (ver `backend/`).

```bash
cd backend && npm run seed:demo   # crea datos de demostración y muestra dos códigos reales
cd frontend
cp .env.example .env.local        # API_BASE_URL (por defecto http://localhost:3013/api/v1)
npm install
npm run dev                       # http://localhost:3012
npm test                          # lógica pura: totales, unidades y adaptación del contrato de la API
npm run check                     # tipos
```

## Notas

- WhatsApp usa un enlace `wa.me` con el mensaje escrito (el MVP no usa la API de WhatsApp Business); al pulsarlo se avisa a la API (`mark-sent`).
- El envío del correo, el PDF, los límites de intentos y la numeración los hace la API.
- El tema claro/oscuro sigue al sistema y se puede cambiar con el botón del encabezado.
