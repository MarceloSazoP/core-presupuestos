# CorePresupuesto

## Definición Funcional del Producto — v1.0

**Estado:** Definición funcional
**Producto:** CorePresupuesto
**Evolución futura:** CoreTrabajos
**Mercado inicial:** Chile
**Tipo:** Microaplicación de presupuestos comerciales

---

# 1. Propósito

CorePresupuesto es una aplicación simple para profesionales independientes y pequeños prestadores de servicios que necesitan:

1. Registrar lo observado en terreno.
2. Guardar especificaciones, fotografías, medidas y notas.
3. Preparar rápidamente un presupuesto.
4. Generar un documento profesional.
5. Enviarlo inmediatamente al cliente.
6. Hacer un seguimiento comercial básico.
7. Permitir que el cliente consulte el presupuesto online.
8. Mantener un historial simple de presupuestos por cliente.

CorePresupuesto **no es un ERP, sistema contable ni sistema tributario**.

Su propósito es concreto:

> **Del terreno al presupuesto y del presupuesto al seguimiento.**

El concepto central del producto es:

> **Cliente → Presupuestos → Seguimiento**

Un mismo cliente puede tener múltiples presupuestos a lo largo del tiempo.

---

# 2. Público objetivo

Principalmente profesionales independientes y pequeños prestadores de servicios:

* Electricistas.
* Gasfíteres.
* Instaladores.
* Técnicos de calefacción.
* Técnicos de climatización.
* Técnicos de CCTV.
* Técnicos informáticos.
* Técnicos de mantenimiento.
* Maestros de construcción.
* Profesionales de reparaciones e instalaciones.

El producto debe funcionar especialmente bien en teléfono y tablet.

---

# 3. Filosofía del producto

CorePresupuesto debe sentirse como una herramienta de trabajo, no como un sistema administrativo.

Principios:

* Pocos datos obligatorios.
* Pocas pantallas.
* Acciones rápidas.
* Captura en terreno.
* Presupuesto rápido.
* Envío inmediato.
* Seguimiento comercial simple.
* Historial básico por cliente.
* Sin CRM tradicional.
* Sin contabilidad.
* Sin SII en la primera versión.
* Sin inventario.
* Sin gestión empresarial compleja.

La información finalizada permanece almacenada, pero desaparece de la experiencia de trabajo activa cuando ya no requiere atención.

Por eso el producto conserva su comportamiento:

> **Casi fantasma.**

El usuario registra al cliente, captura la información necesaria, prepara y envía el presupuesto, registra eventualmente el seguimiento y continúa con su siguiente presupuesto.

Los clientes frecuentes permanecen disponibles para reutilizar sus datos y consultar sus presupuestos anteriores.

---

# 4. Plataformas

## Aplicación móvil

Aplicación móvil real.

* React Native.
* Expo.
* Android.
* iPhone/iPad.
* Cámara.
* Fotografías.
* Micrófono.
* GPS.
* Almacenamiento local.
* Funcionamiento offline en determinadas operaciones.
* Sincronización posterior.

Inicialmente no se publicará en Google Play ni App Store.

Android podrá distribuirse mediante APK durante la etapa inicial.

La publicación oficial en tiendas queda para una etapa posterior.

## Aplicación web

Aplicación web independiente.

* Next.js.
* TypeScript.
* Orientada principalmente a computador/notebook.
* También accesible desde otros dispositivos.

La web y la aplicación móvil utilizan el mismo backend y los mismos datos.

La web **no es una versión móvil del producto**.

---

# 5. Onboarding

El onboarding debe ser mínimo.

## Datos

El usuario ingresa:

* Número de teléfono.
* Nombre.
* Correo electrónico.

Opcionalmente:

* Logo.
* Firma.

No se solicita inicialmente:

* RUT de empresa.
* Razón social.
* PFX/P12.
* CAF.
* Datos tributarios.
* Representante legal.
* Dirección comercial.
* Información bancaria.

---

# 6. Verificación

Después del ingreso de datos:

## Confirmación

La aplicación muestra los datos ingresados y solicita confirmación.

El usuario puede:

* Editar.
* Confirmar.

## Método de verificación

El usuario elige:

* SMS.
* Correo electrónico.

Se envía un código de verificación.

El usuario ingresa el código.

Una vez validado:

> **Cuenta verificada.**

El usuario entra directamente a la aplicación.

---

# 7. Logo

Durante el onboarding el usuario puede agregar un logo.

Opciones:

* Tomar fotografía.
* Seleccionar imagen.
* Omitir.

El logo podrá utilizarse posteriormente en:

* Presupuesto PDF.
* Vista web.
* Correo.
* Documentos generados.

El logo no es obligatorio.

---

# 8. Firma

El usuario puede almacenar una imagen de su firma.

Opciones:

* Tomar fotografía.
* Seleccionar imagen.
* Omitir.

Al finalizar cada presupuesto la aplicación podrá preguntar:

> **¿Deseas agregar tu firma al presupuesto final?**

Opciones:

* Sí.
* No.

La firma es solamente una imagen incorporada al presupuesto.

No se presenta como firma electrónica avanzada ni como mecanismo de certificación tributaria.

---

# 9. Dashboard

Después del onboarding, la primera pantalla será un dashboard simple.

Contenido principal:

## Nuevo presupuesto

Botón destacado:

> **+ Nuevo presupuesto**

## Pendientes

Muestra presupuestos que todavía requieren una acción.

Ejemplo:

```text
PENDIENTES

Juan Pérez
Instalación eléctrica
$185.000

Carlos Soto
Mantención calefont
$75.000
```

## Seguimiento

Si existen presupuestos que requieren contacto:

```text
SEGUIMIENTO

2 presupuestos requieren contacto

Juan Pérez
Hace 5 días

María González
Hace 8 días
```

## Finalizados

Muestra presupuestos enviados y que ya no requieren una acción inmediata.

El historial completo puede existir, pero no debe dominar la pantalla.

---

# 10. Dashboard personalizable

El usuario podrá agregar información adicional al dashboard.

Ejemplos:

* Cantidad de presupuestos del mes.
* Monto total presupuestado.
* Monto de presupuestos ganados.
* Cantidad de presupuestos ganados.
* Ticket promedio.
* Presupuestos pendientes.
* Presupuestos en seguimiento.

Estos indicadores son opcionales.

El usuario que solamente quiera hacer presupuestos puede mantener un dashboard extremadamente simple.

---

# 11. Cliente

El **Cliente es una entidad central de CorePresupuesto**.

CorePresupuesto está pensado para profesionales que pueden trabajar repetidamente con los mismos clientes.

Un cliente puede tener múltiples presupuestos.

Ejemplo:

```text
Juan Pérez

Presupuestos
────────────────────

CP-2026-0001
Instalación eléctrica
$185.000
ACEPTADO

CP-2026-0017
Cambio de tablero
$320.000
ENVIADO

CP-2026-0032
Instalación luminarias
$145.000
SEGUIMIENTO
```

## Datos básicos del cliente

* Nombre.
* Teléfono.
* Correo.
* Dirección.

Los datos del cliente pueden reutilizarse al crear un nuevo presupuesto.

El usuario podrá:

* Crear un cliente nuevo.
* Buscar un cliente existente.
* Seleccionar un cliente existente para un nuevo presupuesto.
* Consultar sus presupuestos anteriores.
* Acceder a información básica de seguimiento.

CorePresupuesto no pretende convertirse en un CRM tradicional.

---

# 12. Nuevo presupuesto

La creación de un presupuesto se realizará mediante un wizard de tres etapas.

Las tres etapas representan el flujo funcional, pero **no obligan al usuario a completar todo en una sola sesión**.

El usuario puede guardar información parcial y continuar posteriormente.

Las etapas son:

1. Cliente y ubicación.
2. Levantamiento.
3. Preparación del presupuesto.

---

# 13. Paso 1 — Cliente y ubicación

El primer paso identifica al cliente y el contexto del presupuesto.

El usuario puede:

* Seleccionar un cliente existente.
* Crear un cliente nuevo.

Datos:

* Nombre del cliente.
* Teléfono.
* Correo.
* Dirección.
* Ubicación/GPS opcional.
* Descripción inicial del servicio solicitado.

Ejemplo:

```text
Cliente

Juan Pérez

Teléfono

+56 9 XXXXXXXX

Correo

cliente@email.com

Dirección

Av. XXXXX 1234

Servicio solicitado

Instalación eléctrica
```

La descripción inicial corresponde al servicio o trabajo que se está presupuestando.

No crea una entidad independiente denominada `Trabajo`.

Botón:

> **Siguiente**

---

# 14. Paso 2 — Levantamiento

Esta pantalla representa la captura realizada en terreno para el presupuesto.

El usuario puede ingresar:

* Texto.
* Nota de voz.
* Fotografías.
* Medidas.
* Observaciones.

Ejemplo:

> "Cambiar dos pilas grandes, limpiar chispero y revisar conexión."

La captura puede hacerse mediante:

### Texto

Campo de escritura rápida.

### Voz

Botón de micrófono.

La nota de voz podrá conservarse como parte del presupuesto.

La transcripción automática puede incorporarse posteriormente.

### Fotografías

El usuario puede tomar fotografías directamente desde el dispositivo.

Las fotografías corresponden principalmente a información interna del profesional.

No se incorporan automáticamente al PDF del cliente.

### Medidas

Permite registrar información simple relacionada con el servicio.

No se requiere inicialmente un sistema avanzado de unidades, planos o levantamiento técnico.

---

# 15. Guardar el levantamiento

En esta etapa existen dos caminos:

## Guardar

El usuario guarda la información capturada y termina la sesión.

El presupuesto queda:

> **PENDIENTE**

Podrá volver posteriormente y continuar con su preparación.

## Guardar y preparar presupuesto

La información se guarda y el usuario pasa inmediatamente a la preparación del presupuesto.

La información introducida debe conservarse al avanzar o retroceder entre las etapas.

---

# 16. Paso 3 — Preparación rápida del presupuesto

La preparación debe ser extremadamente rápida.

Ejemplo:

```text
Juan Pérez

Pilas grandes          $5.000

Limpiar chispero       $5.000

TOTAL                 $10.000
```

El usuario puede agregar nuevos conceptos.

Cada concepto contiene:

* Descripción.
* Cantidad.
* Precio unitario.
* Total.

El sistema calcula automáticamente:

* Subtotal.
* Descuento, si existe.
* Total.

---

# 17. Condiciones

El presupuesto puede contener:

## Garantía

Opciones rápidas:

* Sin garantía.
* 7 días.
* 15 días.
* 30 días.
* 3 meses.
* 6 meses.
* 1 año.
* Personalizada.

También podrá escribirse una condición específica.

Ejemplo:

> Garantía de 6 meses por instalación. No incluye daños ocasionados por terceros.

## Validez

Ejemplos:

* 7 días.
* 15 días.
* 30 días.
* Personalizada.

## Observaciones

Campo de texto libre.

---

# 18. Firma del presupuesto

Antes de finalizar, el sistema puede preguntar:

> **¿Deseas agregar tu firma al presupuesto final?**

Si el usuario responde afirmativamente, la imagen de firma almacenada en su perfil se incorpora al documento.

Es opcional en cada presupuesto.

---

# 19. Finalizar y enviar

Acción principal:

> **TERMINAR Y ENVIAR**

Al ejecutarla:

1. Se genera el presupuesto final.
2. Se genera el PDF.
3. Se almacena la versión final.
4. Se genera la vista web.
5. Se preparan los canales de envío.
6. El presupuesto pasa a estado finalizado.
7. Se registra el estado comercial correspondiente al envío.
8. Se puede configurar un seguimiento.

Finalizar y enviar debe distinguirse conceptualmente de:

* Guardar.
* Finalizar.
* Enviar o compartir.

La interfaz puede simplificar estas acciones para el usuario, pero internamente deben conservarse sus responsabilidades diferenciadas.

---

# 20. Envío por correo

Si el usuario dispone de correo y el cliente tiene correo registrado, el sistema puede enviar:

* Mensaje de presentación.
* El presupuesto completo en el cuerpo del correo: ítems, totales y condiciones.
* Los botones **Aceptar el presupuesto** (es la aceptación), **Llamar** y **WhatsApp**.
* El logo del profesional arriba, si lo tiene.
* QR opcional.

El PDF no va en este correo (decisión del 2026-10-10): el cliente lo recibe al aceptar, timbrado «ACEPTADO» (ver §31).

---

# 21. Envío mediante WhatsApp

El usuario podrá compartir inmediatamente el presupuesto mediante WhatsApp utilizando las capacidades de compartir del dispositivo.

No se requiere inicialmente una integración con WhatsApp Business API.

El objetivo inicial es:

> **Preparar y compartir rápidamente.**

---

# 22. Presupuesto online

Cada presupuesto finalizado tendrá una vista web.

Ejemplo:

```text
CorePresupuesto

Presupuesto
CP-8F42K

Cliente
Juan Pérez

Servicio
Mantención calefont

Pilas grandes             $5.000
Limpiar chispero          $5.000

TOTAL                    $10.000

Garantía: 3 meses
Validez: 15 días

[ Descargar PDF ]
```

La vista del cliente será de solo lectura.

La información mostrada pertenece al presupuesto específico.

---

# 23. QR

El QR es una función secundaria y opcional.

No debe ser una atracción principal del producto.

Su finalidad es permitir que el cliente acceda rápidamente a la vista online del presupuesto.

Puede incorporarse:

* En el PDF.
* En el correo.
* En otros medios de entrega.

El QR proporciona acceso de consulta.

No proporciona permisos de edición.

---

# 24. Seguimiento comercial mínimo

CorePresupuesto incorporará un **seguimiento comercial liviano**.

No se pretende crear un CRM tradicional.

El objetivo es resolver una necesidad concreta:

> **Que el profesional no envíe un presupuesto y después se olvide de él.**

El seguimiento se realiza principalmente sobre el presupuesto, conservando el contexto del cliente.

---

# 25. Estados comerciales

Después del envío, el presupuesto podrá tener un estado comercial.

Estados iniciales:

```text
ENVIADO

SEGUIMIENTO

ACEPTADO

RECHAZADO
```

El usuario podrá cambiar el estado manualmente.

El estado comercial pertenece al presupuesto y no al cliente.

El cliente puede tener múltiples presupuestos con diferentes estados simultáneamente.

---

# 26. Próximo contacto

El usuario podrá registrar una fecha de seguimiento para un presupuesto.

Ejemplo:

```text
Juan Pérez

Instalación eléctrica

$185.000

Estado:

ENVIADO

Próximo contacto:

10/10/2026
```

Cuando llegue la fecha, el presupuesto podrá aparecer en:

> **SEGUIMIENTO**

No se requiere inicialmente una automatización compleja.

---

# 27. Acciones de seguimiento

Desde un presupuesto el usuario podrá realizar acciones rápidas:

* Llamar al cliente.
* Abrir WhatsApp.
* Enviar nuevamente el presupuesto.
* Ver presupuesto.
* Descargar PDF.
* Agregar nota.
* Cambiar estado.
* Programar próximo contacto.

El sistema debe utilizar las capacidades disponibles del teléfono cuando corresponda.

---

# 28. Registro de seguimiento

El usuario podrá registrar una nota simple.

Ejemplo:

```text
10/10/2026

Cliente indicó que revisará el presupuesto
con su socio.

Próximo contacto:

15/10/2026
```

Esto permite mantener contexto sin construir una ficha CRM compleja.

Las notas pertenecen al seguimiento del presupuesto.

---

# 29. Historial del cliente

El usuario podrá consultar los presupuestos asociados a un cliente.

Ejemplo:

```text
Juan Pérez

Presupuestos
3

Aceptados
2

En seguimiento
1
```

El historial permite visualizar:

* Presupuestos anteriores.
* Estados comerciales.
* Montos.
* Fechas.
* Seguimientos registrados.

La existencia de historial no transforma CorePresupuesto en un CRM tradicional.

No se pretende implementar inicialmente:

* Pipeline complejo.
* Segmentación avanzada.
* Campañas.
* Marketing.
* Automatización comercial avanzada.
* Lead scoring.
* CRM empresarial.

---

# 30. Dashboard de seguimiento

Cuando existan acciones pendientes, el dashboard podrá mostrar:

```text
SEGUIMIENTO

3 presupuestos requieren contacto

Juan Pérez
$185.000
Hace 5 días

Carlos Soto
$75.000
Hace 8 días

María González
$420.000
Hace 12 días
```

El usuario puede entrar directamente a cada presupuesto.

---

# 31. Presupuesto aceptado

Cuando el cliente acepta, el usuario puede marcar:

> **ACEPTADO**

**El cliente también puede aceptarlo él mismo (decisión del 2026-10-10).** El correo del presupuesto trae dos botones: **Aceptar el presupuesto** y **Llamar** al profesional (no hay botón de rechazar). El botón **Aceptar** del correo es la aceptación: abre la vista del presupuesto, que muestra «Presupuesto aceptado» y que el PDF le llega por correo, sin pedir otra confirmación. El presupuesto queda **ACEPTADO** en la app y en la web, y el cliente recibe otro correo con el mismo presupuesto y un timbre **ACEPTADO** con la fecha (el profesional recibe una copia). Ahí termina el flujo. **El PDF es el documento oficial del profesional:** el primer correo no lo lleva y la vista web del cliente no lo entrega; el cliente lo recibe solo en el correo de aceptación, timbrado, y el profesional lo ve en la app y en su editor web. No se puede aceptar un presupuesto vencido, rechazado o reemplazado por una versión nueva: la vista invita a hablar con el profesional.

Esto permitirá posteriormente utilizar el dato en indicadores como:

* Monto ganado del mes.
* Cantidad de presupuestos ganados.
* Ticket promedio.
* Tasa de aceptación.

La aceptación pertenece al presupuesto.

No implica todavía la creación de una orden de trabajo dentro de CorePresupuesto.

La ejecución del trabajo pertenece a una futura evolución/producto:

> **CoreTrabajos**

---

# 32. Presupuesto rechazado

El usuario podrá marcar:

> **RECHAZADO**

Opcionalmente podrá registrar una nota.

Ejemplo:

> Cliente encontró una alternativa más económica.

No se requiere obligatoriamente registrar un motivo.

---

# 33. Dashboard comercial opcional

El usuario podrá habilitar indicadores como:

```text
Este mes

Presupuestos       12

Ganados             7

En seguimiento      3

Monto presupuestado

$2.850.000

Monto ganado

$1.920.000
```

Estos indicadores no son obligatorios.

---

# 34. PDF

El PDF debe tener presentación profesional y simple.

Contenido:

* Logo, si existe.
* Datos del profesional.
* Datos del cliente.
* Identificador del presupuesto.
* Fecha.
* Descripción del servicio.
* Detalle de ítems.
* Total.
* Garantía.
* Validez.
* Condiciones.
* Firma opcional.
* QR opcional.

El PDF representa un **presupuesto comercial**.

No representa:

* Boleta.
* Factura.
* DTE.
* Documento tributario.

---

# 35. Recuperación y edición

Un presupuesto no debe poder editarse simplemente conociendo su identificador.

Para recuperar un presupuesto se podrá utilizar:

* ID + código privado.

O:

* Enlace privado de edición.

El enlace/QR del cliente será diferente del acceso privado de edición.

El acceso del cliente es exclusivamente de consulta.

El acceso privado del profesional permite recuperar y editar un presupuesto mientras su estado lo permita.

---

# 36. Estados funcionales

El modelo debe distinguir entre el **estado documental del presupuesto** y su **estado comercial**.

## Estado documental

```text
DRAFT
PENDING
FINALIZED
```

### DRAFT

El presupuesto está siendo creado y todavía no requiere estar completo.

### PENDING

Existe información guardada, pero el presupuesto aún no ha sido finalizado.

### FINALIZED

El presupuesto fue terminado y se generó su versión final.

## Estado comercial

```text
NONE
SENT
FOLLOW_UP
ACCEPTED
REJECTED
```

Esto evita mezclar:

> "¿El presupuesto está terminado?"

con:

> "¿Qué ocurrió comercialmente con el presupuesto?"

Un presupuesto puede estar:

```text
FINALIZED + SENT
FINALIZED + FOLLOW_UP
FINALIZED + ACCEPTED
FINALIZED + REJECTED
```

La aceptación o rechazo no modifica la existencia ni la integridad de la versión final enviada.

---

# 37. Relación Cliente → Presupuesto

La relación principal del producto es:

```text
USUARIO
   │
   └── CLIENTES
          │
          ├── PRESUPUESTO
          │      ├── Levantamiento
          │      │    ├── Texto
          │      │    ├── Voz
          │      │    ├── Fotografías
          │      │    ├── Medidas
          │      │    └── Observaciones
          │      │
          │      ├── Ítems
          │      ├── Condiciones
          │      ├── PDF
          │      └── Seguimiento
          │
          ├── PRESUPUESTO
          │
          └── PRESUPUESTO
```

No existe una entidad `Trabajo` requerida por CorePresupuesto para representar esta relación.

El presupuesto representa la propuesta comercial específica realizada para un cliente.

Un mismo cliente puede tener múltiples presupuestos.

Cada presupuesto puede representar un servicio diferente, una nueva visita, una nueva solicitud o una nueva propuesta comercial.

---

# 38. Core Tributario

CorePresupuesto funcionará independientemente de Core Tributario.

En una segunda etapa podrá existir una integración opcional:

```text
CorePresupuesto

      │
      │ integración opcional
      ▼

Core Tributario

      │
      ▼

     SII
```

CorePresupuesto seguirá siendo responsable del presupuesto comercial.

Core Tributario será responsable del proceso tributario correspondiente.

La integración no convierte a CorePresupuesto en un producto tributario ni crea una dependencia estructural entre ambos productos.

---

# 39. Plan Empresa futuro

Una vez que Core Tributario esté operativo, podrá existir un plan empresarial que permita habilitar capacidades tributarias.

En ese proceso sí podrán solicitarse:

* RUT de empresa.
* Razón social.
* Representante.
* Información empresarial.
* PFX/P12.
* CAF.
* Configuración tributaria necesaria.

Estos datos no forman parte del onboarding básico de CorePresupuesto.

---

# 40. Evolución futura: CoreTrabajos

CoreTrabajos será un producto independiente.

Su dominio será la gestión y ejecución completa de trabajos.

CoreTrabajos podrá tener su propio modelo de:

```text
Cliente

   ↓

Trabajo

   ├── Visita
   ├── Especificación
   ├── Fotografías
   ├── Medidas
   ├── Presupuesto
   ├── Aceptación
   ├── Ejecución
   ├── Avance
   └── Finalización
```

Este modelo pertenece a CoreTrabajos y **no forma parte del modelo interno obligatorio de CorePresupuesto**.

CorePresupuesto podrá integrarse opcionalmente con CoreTrabajos.

Por ejemplo:

```text
CorePresupuesto

Presupuesto
     │
     │ Cliente acepta
     ▼
Integración opcional
     │
     ▼
CoreTrabajos
     │
     ▼
Ejecución del trabajo
```

Pero:

> **CorePresupuesto funciona completamente sin CoreTrabajos.**

Y:

> **CoreTrabajos funciona como producto independiente.**

La existencia de CoreTrabajos no modifica el modelo básico de CorePresupuesto.

---

# 41. Fuera del MVP

CorePresupuesto v1.0 no incluye:

* Boletas electrónicas.
* Facturas electrónicas.
* SII.
* F29.
* Contabilidad.
* Inventario.
* Pagos.
* CRM tradicional.
* Marketing.
* IA obligatoria.
* OCR.
* Firma electrónica certificada.
* WhatsApp Business API.
* Automatizaciones comerciales complejas.
* Gestión de equipos.
* Multiempresa avanzada.
* Gestión completa de órdenes de trabajo.
* Gestión de ejecución de trabajos.

Sí incluye **seguimiento comercial básico**, limitado a:

* Estado.
* Próximo contacto.
* Notas.
* Acciones rápidas.
* Historial básico del cliente.
* Indicadores comerciales opcionales.

---

# 42. Experiencia objetivo

La experiencia completa debe poder resumirse en:

> **Captura. Presupuesta. Envía. Haz seguimiento. Sigue trabajando.**

En terreno:

> **No olvides nada de lo que viste.**

En el computador:

> **Arma el presupuesto rápidamente.**

Con el cliente:

> **Envíalo inmediatamente.**

Después:

> **Haz seguimiento cuando corresponda y continúa trabajando.**

CorePresupuesto debe resolver una necesidad concreta sin transformarse en un ERP o CRM.

---

# 43. Resumen del producto

CorePresupuesto es una microaplicación para profesionales independientes que permite:

> **registrar o seleccionar un cliente → capturar la información necesaria para un servicio → preparar rápidamente un presupuesto → enviarlo al cliente → hacer seguimiento comercial básico → conservar el historial del cliente.**

El modelo central del producto es:

```text
CLIENTE
   │
   ├── PRESUPUESTO
   ├── PRESUPUESTO
   └── PRESUPUESTO
```

Cada presupuesto contiene su propio contexto:

```text
PRESUPUESTO
   │
   ├── Cliente
   ├── Ubicación
   ├── Descripción del servicio
   ├── Levantamiento
   │    ├── Texto
   │    ├── Voz
   │    ├── Fotografías
   │    ├── Medidas
   │    └── Observaciones
   ├── Ítems
   ├── Condiciones
   ├── PDF
   └── Seguimiento
```

La aplicación mantiene una experiencia simple y liviana.

Las funcionalidades más complejas quedan para productos o integraciones futuras.

La evolución prevista es:

```text
COREPRESUPUESTO
Presupuestar y realizar seguimiento comercial
        │
        ├──────────── integración opcional ────────────┐
        │                                                │
        ▼                                                ▼
CORETRABAJOS                                      CORE TRIBUTARIO
Gestionar y ejecutar                              Tributación / SII
trabajos
```

Cada producto mantiene su independencia.

**CorePresupuesto = presupuestar y realizar seguimiento comercial básico.**

**CoreTrabajos = gestionar y ejecutar trabajos.**

**Core Tributario = procesos tributarios y comunicación con SII.**
