# Exportar mis datos y eliminar la cuenta

Estado: **decisión del 2026-10-06**. Reemplaza la decisión 6 del *Contrato de Base de Datos* §10 («eliminación de cuenta, fuera del MVP»): las tiendas piden poder borrar la cuenta desde la app, y la persona tiene derecho a llevarse sus datos.

Ambas acciones viven en **Configurar → Tus datos → Mis datos** (la app) y ambas llegan **solo al correo de la cuenta**, nunca a otro.

## 1. Exportar mis datos

`POST /me/export` arma un archivo Excel (`.xlsx`) con todo lo del usuario y lo envía por correo adjunto. No se descarga en el teléfono: sale del servidor, así que no depende de la memoria ni de los permisos del teléfono.

| Hoja | Contenido |
|------|-----------|
| **Cuenta** | nombre, teléfono, correo, país, zona horaria, datos de contacto, fecha de la exportación |
| **Clientes** | nombre, teléfono, correo, dirección, fecha de creación |
| **Presupuestos** | número, versión, estado del documento y estado comercial, cliente, trabajo, dirección, latitud y longitud, subtotal, descuento, impuesto, total, moneda, garantía, validez, observaciones, fechas (creación, cierre, envío, aceptación, próximo contacto), cantidad de fotos y de notas de voz |
| **Ítems** | por presupuesto: posición, tipo (ítem o tarea), descripción, cantidad, unidad, precio unitario, total de la línea |
| **Visita** | por presupuesto: notas, observaciones de terreno y medidas (nombre y valor) |
| **Seguimiento** | por presupuesto: fecha, estado, nota y próximo contacto de cada seguimiento |

Las fotos, las notas de voz, los PDF, el logo y la firma **no van dentro del Excel** (el correo pesaría demasiado): la hoja de presupuestos dice cuántas hay. Quien las quiera las descarga desde cada presupuesto antes de eliminar la cuenta.

Límite: 3 exportaciones por hora y por usuario (`429`). Si el correo no sale, `502` y no se registra el envío. Auditoría: `DATA_EXPORT_SENT`.

## 2. Eliminar la cuenta

Dos pasos, para que no se pueda hacer por error ni con el teléfono en manos de otra persona:

1. `POST /me/delete-request` envía un **código de 6 dígitos** al correo de la cuenta. Vale **10 minutos**, sirve una sola vez y se guarda solo su hash. Pedir otro invalida el anterior. Máximo 3 pedidos por hora.
2. `POST /me/delete` con ese código elimina la cuenta. Se permiten **5 intentos** por código; al quinto se invalida y hay que pedir otro.

**Qué se elimina, todo y para siempre:** el usuario, sus clientes, **todos sus presupuestos (también los cerrados y enviados)**, las fotos, notas de voz, PDF, logo y firma (también del almacenamiento), las sesiones, los vínculos y códigos de acceso y los QR de recuperación. Los enlaces públicos que ya se enviaron a clientes **dejan de funcionar**: el cliente verá que el presupuesto no existe.

**Qué se conserva:** solo la auditoría mínima sin datos personales (`ACCOUNT_DELETED`, sin usuario asociado), según la retención de 12 meses.

No se envía correo de confirmación al terminar. La app cierra la sesión y borra lo guardado en el teléfono.

## 3. En la app

- **Exportar mi data**: pide confirmación y avisa «Te lo enviamos a j***@correo.cl».
- **Eliminar mi cuenta**: abre una hoja que explica lo que se pierde, envía el código, pide los 6 dígitos y ofrece «Eliminar definitivamente» (rojo). El botón solo se enciende con 6 dígitos.
- Si se pierde el acceso al correo, no se puede eliminar la cuenta desde la app: es a propósito.
