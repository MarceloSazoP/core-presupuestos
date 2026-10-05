# Recuperación de la cuenta con un QR enviado por correo

**Versión 1.0 · decisión del 2026-10-05 · rama `internacionalizacion`**

CorePresupuesto no tiene usuario ni contraseña: se entra con un código que llega por SMS o por correo al teléfono y al correo de la cuenta. Eso falla cuando la persona **pierde o cambia de teléfono y ya no se acuerda del número** (o ya no lo tiene). Esta función le deja, desde el registro, un **QR en su correo** que sirve para volver a entrar en un teléfono nuevo sin necesitar el número.

## 1. Flujo

```text
Registro:  Ingresar datos → Confirmar teléfono y correo (se ven en pantalla) → Código → Entra
                                                                                  │
                                                         el QR llega al correo ◄──┘

Teléfono nuevo:  «Entrar con el QR de mi correo» → se lee el QR (o se escribe su código) → entra
                                                           │
                                       llega al correo el QR siguiente ◄─┘
```

1. **Confirmar los datos.** Antes de pedir el código, la app muestra el teléfono y el correo escritos y pregunta si son correctos (ya existía este paso). Se avisa que **a ese correo llegará un QR de recuperación**: un correo mal escrito no recibiría nada útil y la persona lo ve a tiempo.
2. **Al terminar el registro** (código válido, cuenta nueva) el servidor crea un token de recuperación y lo envía **solo al correo de la cuenta**, como imagen QR adjunta y como código de texto.
3. **En un teléfono nuevo**, en la pantalla de ingreso, «Entrar con el QR de mi correo» abre la cámara; leer el QR (o escribir su código) abre sesión sin pedir teléfono ni correo.
4. **Cada uso consume el QR y envía el siguiente** al correo, con un aviso de que se usó. Así un QR viejo (por ejemplo en un correo reenviado) deja de servir.
5. **Cuentas anteriores a esta función** (o quien perdió el correo con el QR) piden uno nuevo en Configurar → «Enviar QR de recuperación a mi correo», con la sesión abierta. Pedir uno nuevo **invalida el anterior**.

## 2. Seguridad

El QR es una **credencial**: quien lo tenga entra a la cuenta. Por eso:

| Medida | Detalle |
|---|---|
| Aleatorio e inadivinable | 256 bits (`randomToken`); **no** contiene el teléfono ni el correo, solo un identificador secreto. Con teléfono y correo no se puede fabricar. |
| Guardado con hash | El servidor guarda `sha256` del token, nunca el token. Una filtración de la base no entrega QR. |
| Un solo uso | Se consume de forma atómica al entrar; dos lecturas simultáneas: una gana, la otra recibe 401. |
| Un solo vigente | Pedir uno nuevo (o usarlo) revoca el anterior. |
| Solo al correo de la cuenta | El destino se lee de la base; la petición nunca lo trae. |
| Mismo nivel que el ingreso por correo | Quien controla el correo ya puede entrar con un código por correo; el QR no abre una puerta nueva, la deja lista para cuando no hay teléfono. |
| Límite de intentos | Por IP, y los envíos por usuario (3 por hora). Respuesta idéntica para un token inexistente, usado o revocado. |
| Cierre de otras sesiones | Entrar con QR cierra por defecto las otras sesiones de la cuenta (`close_other_sessions`): el caso de uso es un teléfono perdido. |
| Auditoría | `RECOVERY_QR_SENT`, `RECOVERY_QR_USED` (sin guardar el token). |

**Riesgo conocido y aceptado:** un correo reenviado o una bandeja comprometida expone un QR vigente hasta que se use o se pida otro. Se mitiga con el uso único y la rotación; no se agrega vencimiento por tiempo porque el caso de uso es justamente un teléfono perdido meses después.

## 3. Contenido del QR

`corepresupuesto://recuperar/<token>` (el esquema de la app). El correo trae además el **código en texto** (el mismo token) por si la cámara no puede leer la imagen o la persona lee el correo en el mismo teléfono.

## 4. Datos (migración `0014`) y API

Ver `Contrato de Base de Datos.md` §23 y `Contrato de API.md` §3 (`POST /auth/recovery`, `POST /me/recovery-qr`).

## 5. Pruebas que acompañan

- Un registro nuevo envía un correo con el QR **solo al correo de la cuenta**; un ingreso de una cuenta existente no.
- Entrar con el QR abre sesión del usuario correcto y cierra las otras; el QR queda **usado** (segundo intento: 401) y llega uno nuevo al correo.
- Un token inventado, usado o revocado responde lo mismo (401). Dos lecturas simultáneas: solo una entra.
- Pedir uno nuevo (`POST /me/recovery-qr`) invalida el anterior y respeta el límite por hora; sin sesión, 401.
- La base guarda el hash, no el token.
- Un fallo al enviar el correo no impide terminar el registro (queda registrado y se puede pedir otro).
