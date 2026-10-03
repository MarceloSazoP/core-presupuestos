\# CorePresupuesto



\## Alcance Exacto del MVP



\*\*Versión:\*\* MVP 0.1

\*\*Objetivo:\*\* Validar el flujo completo desde el levantamiento en terreno hasta el envío y seguimiento básico de un presupuesto.



\---



\# 1. Objetivo del MVP



El MVP debe resolver exactamente este problema:



> \*\*Un profesional visita a un cliente, registra lo que debe hacer, prepara un presupuesto rápidamente y se lo envía al cliente sin tener que usar un sistema administrativo complejo.\*\*



El flujo principal será:



```text

Ingresar

&#x20;  ↓

Nuevo presupuesto

&#x20;  ↓

Cliente + ubicación

&#x20;  ↓

Capturar trabajo

&#x20;  ↓

Guardar

&#x20;  │

&#x20;  ├── Queda pendiente

&#x20;  │

&#x20;  └── Preparar presupuesto

&#x20;            ↓

&#x20;         Ítems + precios

&#x20;            ↓

&#x20;      Garantía + condiciones

&#x20;            ↓

&#x20;      Terminar y enviar

&#x20;            ↓

&#x20;    PDF + enlace web

&#x20;            ↓

&#x20;     Seguimiento básico

```



\---



\# 2. Plataformas incluidas



\## Mobile



Incluido:



\* Android.

\* iPhone/iPad.

\* React Native + Expo.

\* Aplicación nativa.

\* Cámara.

\* Micrófono.

\* GPS.

\* Almacenamiento local básico.

\* Sincronización con backend.



Durante el MVP:



\* Android puede distribuirse mediante APK.

\* No se publica en Google Play.

\* No se publica en App Store.



\## Web



Incluido:



\* Aplicación web con Next.js.

\* Acceso desde computador.

\* Misma cuenta.

\* Mismos datos.

\* Creación/edición de presupuestos.

\* Consulta de presupuestos.

\* Preparación de PDF.



La web y mobile son \*\*clientes distintos del mismo backend\*\*.



\---



\# 3. Registro y acceso



\## Incluido



Datos iniciales:



\* Teléfono.

\* Nombre.

\* Correo.



Flujo:



```text

Registro

&#x20;  ↓

Confirmar datos

&#x20;  ↓

Elegir SMS o correo

&#x20;  ↓

Recibir código

&#x20;  ↓

Validar

&#x20;  ↓

Entrar

```



\## No incluido



\* Contraseña tradicional.

\* Login social.

\* Google Login.

\* Apple Login.

\* Multiusuario.

\* Roles.

\* Equipos.

\* Multiempresa.



\---



\# 4. Perfil del profesional



\## Incluido



\* Nombre.

\* Teléfono.

\* Correo.

\* Logo opcional.

\* Firma opcional.



El logo y firma podrán:



\* Subirse desde galería.

\* Capturarse mediante cámara.



\## No incluido



\* RUT empresarial.

\* Razón social.

\* PFX.

\* CAF.

\* Representante legal.

\* Configuración tributaria.

\* Datos bancarios.



\---



\# 5. Dashboard



El dashboard MVP tendrá solamente:



\### Acción principal



> \*\*+ Nuevo presupuesto\*\*



\### Pendientes



Trabajos/presupuestos todavía no finalizados.



\### Finalizados



Presupuestos enviados/finalizados.



\### Seguimiento



Presupuestos que requieren contacto.



Ejemplo:



```text

PENDIENTES

2



SEGUIMIENTO

3



FINALIZADOS

8

```



No se implementará inicialmente un dashboard financiero complejo.



\---



\# 6. Nuevo presupuesto



El wizard MVP tendrá \*\*tres grandes etapas\*\*.



\## Etapa 1 — Cliente y trabajo



Campos:



\* Nombre del cliente.

\* Teléfono.

\* Correo opcional.

\* Dirección.

\* GPS opcional.

\* Descripción breve del trabajo.



Ejemplo:



```text

Juan Pérez

+56 9 XXXXXXXX

juan@email.com



Av. XXXXX 1234



Mantención calefont

```



\---



\# 7. Captura en terreno



\## Incluido



El usuario puede agregar:



\### Texto



Notas y descripción.



\### Voz



Grabar una nota de voz.



\### Fotos



Tomar fotografías desde el dispositivo.



\### Medidas



Registrar medidas mediante texto.



\### Observaciones



Texto libre.



\---



\# 8. Guardar trabajo



Habrá dos acciones:



\### Guardar



Guarda el trabajo como pendiente.



El usuario puede salir.



\### Guardar y preparar presupuesto



Guarda y lleva inmediatamente al constructor de presupuesto.



Esto es fundamental para el flujo rápido.



\---



\# 9. Funcionamiento offline



El MVP incluirá \*\*offline básico para captura en terreno\*\*.



El usuario podrá:



\* Crear un trabajo.

\* Registrar cliente.

\* Escribir notas.

\* Grabar información.

\* Tomar fotografías.

\* Registrar medidas.



Aunque no tenga conexión.



Cuando vuelva la conexión:



> Los datos se sincronizan con el backend.



No se intentará resolver en el MVP una sincronización distribuida extremadamente compleja.



\---



\# 10. Constructor de presupuesto



Debe ser extremadamente simple.



Cada ítem contiene:



\* Descripción.

\* Cantidad.

\* Precio unitario.

\* Total.



Ejemplo:



```text

Pilas grandes       1 x $5.000

Limpiar chispero    1 x $5.000



TOTAL                  $10.000

```



Acciones:



> \* Agregar ítem



El sistema calcula:



\* Subtotal.

\* Descuento opcional.

\* Total.



\---



\# 11. Condiciones del presupuesto



Incluido:



\### Garantía



\* Sin garantía.

\* Período predefinido.

\* Período personalizado.



\### Validez



\* Período predefinido.

\* Período personalizado.



\### Observaciones



Texto libre.



\---



\# 12. Firma



Incluido:



Antes de finalizar:



> \*\*¿Deseas agregar tu firma al presupuesto final?\*\*



Sí / No.



Si selecciona sí, se agrega la imagen de firma del perfil.



No se implementa firma electrónica certificada.



\---



\# 13. Generación del PDF



Incluido.



El PDF contendrá:



\* Logo opcional.

\* Datos del profesional.

\* Datos del cliente.

\* Número/ID del presupuesto.

\* Fecha.

\* Trabajo.

\* Ítems.

\* Subtotal.

\* Descuento.

\* Total.

\* Garantía.

\* Validez.

\* Observaciones.

\* Firma opcional.

\* QR opcional.



El resultado debe ser visualmente profesional y listo para enviar.



\---



\# 14. Presupuesto online



Incluido.



Cada presupuesto finalizado tendrá una URL pública/privada de consulta.



El cliente podrá:



\* Ver presupuesto.

\* Descargar PDF.



No podrá editarlo.



\---



\# 15. QR



Incluido, pero secundario.



El sistema podrá generar un QR que apunte al presupuesto online.



El QR podrá incorporarse al PDF.



No será necesario construir una experiencia especial alrededor del QR.



\---



\# 16. Envío



\## Correo



Incluido.



Si existe correo del cliente:



\* Se envía el presupuesto.

\* Se adjunta PDF.

\* Se incluye enlace web.



\## WhatsApp



En el MVP:



\* Compartir mediante las capacidades del dispositivo.

\* Mensaje preparado.

\* Enlace al presupuesto.



No se implementa WhatsApp Business API.



\---



\# 17. Finalización



Al seleccionar:



> \*\*TERMINAR Y ENVIAR\*\*



el sistema:



1\. Guarda una versión final.

2\. Genera PDF.

3\. Genera vista web.

4\. Genera QR si corresponde.

5\. Permite enviar por correo.

6\. Permite compartir por WhatsApp.

7\. Marca el presupuesto como enviado.

8\. Lo saca de la lista de trabajo activo.



\---



\# 18. Seguimiento comercial MVP



Sí forma parte del MVP.



Pero será deliberadamente pequeño.



\## Estados



\* Enviado.

\* Seguimiento.

\* Aceptado.

\* Rechazado.



\## Próximo contacto



El usuario puede establecer una fecha.



Ejemplo:



```text

Juan Pérez

$185.000



Estado: Enviado



Próximo contacto:

10/10/2026

```



\## Nota



Puede registrar una nota:



> Cliente revisará el presupuesto el viernes.



\## Acciones rápidas



\* Llamar.

\* WhatsApp.

\* Enviar nuevamente.

\* Ver presupuesto.

\* Descargar PDF.

\* Agregar nota.

\* Cambiar estado.

\* Programar seguimiento.



\---



\# 19. Recordatorio de seguimiento



Incluido en una forma simple.



Si existe una fecha de seguimiento, el presupuesto aparecerá en:



> \*\*SEGUIMIENTO\*\*



El MVP puede utilizar notificaciones del dispositivo.



No se implementarán inicialmente campañas ni automatizaciones comerciales.



\---



\# 20. Clientes



Incluido un registro básico de clientes.



Se almacenará:



\* Nombre.

\* Teléfono.

\* Correo.

\* Dirección.



Un cliente puede tener varios presupuestos.



Se podrá consultar su historial básico.



No se implementa un CRM completo.



\---



\# 21. Dashboard comercial



En el MVP será mínimo.



Puede mostrar:



\* Presupuestos pendientes.

\* Presupuestos en seguimiento.

\* Presupuestos finalizados.

\* Cantidad de presupuestos aceptados.

\* Monto ganado del mes.



Los KPIs avanzados quedan para una versión posterior.



\---



\# 22. Seguridad



Incluido:



\* Autenticación.

\* Verificación mediante código.

\* Datos separados por usuario.

\* Presupuestos asociados al propietario.

\* Acceso público únicamente a la vista destinada al cliente.

\* Acceso de edición protegido.



El QR y enlace del cliente \*\*no permiten editar\*\*.



\---



\# 23. Recuperación del presupuesto



Incluido:



\* ID del presupuesto.

\* Código privado o enlace privado de edición.



No se permitirá editar utilizando solamente un ID predecible.



\---



\# 24. Backend



El MVP utilizará un backend centralizado.



Componentes previstos:



\* PostgreSQL.

\* Autenticación.

\* Storage para fotografías, logos, firmas y documentos.

\* API.

\* Sincronización mobile/web.



La implementación puede utilizar Supabase inicialmente.



\---



\# 25. Modelo de datos MVP



Entidades principales:



```text

users

customers

jobs

job\_photos

job\_notes

job\_measurements

quotes

quote\_items

quote\_access

follow\_ups

```



\### users



\* id

\* phone

\* email

\* name

\* logo

\* signature

\* created\_at



\### customers



\* id

\* user\_id

\* name

\* phone

\* email

\* address



\### jobs



\* id

\* user\_id

\* customer\_id

\* description

\* address

\* latitude

\* longitude

\* status

\* created\_at

\* updated\_at



\### quotes



\* id

\* user\_id

\* customer\_id

\* job\_id

\* number

\* status

\* commercial\_status

\* subtotal

\* discount

\* total

\* guarantee

\* validity

\* observations

\* finalized\_at



\### quote\_items



\* id

\* quote\_id

\* description

\* quantity

\* unit\_price

\* total



\### follow\_ups



\* id

\* quote\_id

\* scheduled\_at

\* note

\* status



\---



\# 26. Lo que NO entra en el MVP



Esta lista es importante.



\## Tributario



NO:



\* Boletas.

\* Facturas.

\* DTE.

\* SII.

\* CAF.

\* PFX.

\* F29.

\* Libros tributarios.



\## Pagos



NO:



\* Cobros.

\* Links de pago.

\* Transbank.

\* Webpay.

\* Mercado Pago.

\* Conciliación.



\## ERP



NO:



\* Inventario.

\* Compras.

\* Costos.

\* Contabilidad.

\* Remuneraciones.



\## CRM avanzado



NO:



\* Pipeline.

\* Leads.

\* Campañas.

\* Segmentación.

\* Automatizaciones.

\* Scoring.

\* Email marketing.



\## Trabajo



NO:



\* Orden de trabajo completa.

\* Planificación de técnicos.

\* Asignación de trabajadores.

\* Control de horas.

\* Estados de ejecución.

\* Checklist avanzado.



Eso pertenece potencialmente a \*\*CoreTrabajos\*\*.



\## IA



NO es requisito del MVP:



\* Transcripción automática.

\* Generación automática de presupuestos.

\* IA para precios.

\* OCR.

\* Análisis automático de fotografías.



La grabación de voz sí forma parte del MVP; la transcripción automática puede venir después.



\## Integraciones



NO:



\* WhatsApp Business API.

\* Google Calendar.

\* Sistemas externos.

\* Core Tributario.



\---



\# 27. Criterio de éxito del MVP



El MVP será exitoso si un profesional puede realizar este flujo sin asistencia:



```text

Instala

&#x20; ↓

Se registra

&#x20; ↓

Verifica SMS/correo

&#x20; ↓

Nuevo presupuesto

&#x20; ↓

Ingresa cliente

&#x20; ↓

Registra lo visto en terreno

&#x20; ↓

Guarda o prepara presupuesto

&#x20; ↓

Agrega 2-10 ítems

&#x20; ↓

Define garantía/condiciones

&#x20; ↓

Finaliza

&#x20; ↓

Obtiene PDF

&#x20; ↓

Envía al cliente

&#x20; ↓

Programa seguimiento

```



Y el cliente puede:



```text

Recibir correo

&#x20;     ↓

Abrir enlace

&#x20;     ↓

Ver presupuesto

&#x20;     ↓

Descargar PDF

```



\---



\# 28. Regla de oro del MVP



Cada funcionalidad debe pasar esta pregunta:



> \*\*¿Ayuda directamente a capturar el trabajo, preparar el presupuesto, enviarlo o hacer seguimiento?\*\*



Si la respuesta es no:



\*\*queda fuera del MVP.\*\*



\---



\# 29. Resultado esperado



Al terminar el MVP tendremos un producto pequeño pero completo:



```text

&#x20;                 CORE PRESUPUESTO

&#x20;                        │

&#x20;       ┌────────────────┼────────────────┐

&#x20;       │                │                │

&#x20;    TERRENO         PRESUPUESTO      SEGUIMIENTO

&#x20;       │                │                │

&#x20;    Cliente          Ítems             Estado

&#x20;    Fotos            Precios           Fecha

&#x20;    Voz              Garantía          Nota

&#x20;    Medidas          PDF               Contacto

&#x20;    Notas            Web

&#x20;                     QR

&#x20;                     Correo

&#x20;                     WhatsApp

```



La primera versión \*\*no intenta administrar la empresa\*\*.



Resuelve un flujo específico de principio a fin:



> \*\*Levantar → presupuestar → enviar → hacer seguimiento.\*\*



Y deja una base limpia para que, posteriormente, \*\*CoreTrabajos\*\* pueda hacerse cargo de la etapa de ejecución y \*\*Core Tributario\*\* de la etapa tributaria.



