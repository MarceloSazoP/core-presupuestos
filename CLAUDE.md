\# CorePresupuesto



\## 1. Propósito del proyecto



CorePresupuesto es una aplicación para profesionales independientes y pequeños prestadores de servicios que necesitan levantar información en terreno, preparar presupuestos comerciales y enviarlos a sus clientes de forma simple.



El producto busca resolver principalmente:



> \*\*“No olvides nada de lo que viste en terreno.”\*\*



Flujo principal:



\*\*Captura → Presupuesta → Envía → Haz seguimiento → Sigue trabajando\*\*



CorePresupuesto no es un sistema contable, tributario ni de facturación.



Los presupuestos son documentos comerciales. No generan boletas, facturas, DTE ni información tributaria.



\---



\# 2. Principios del producto



\## 2.1 Simplicidad



CorePresupuesto debe ser rápido de utilizar y evitar convertirse en un ERP o CRM complejo.



No incorporar funcionalidades que no sean necesarias para:



1\. Capturar información.

2\. Preparar un presupuesto.

3\. Finalizarlo.

4\. Enviarlo.

5\. Hacer seguimiento comercial básico.



\## 2.2 Cliente como entidad central



La relación principal del producto es:



```text

Cliente

&#x20;  ↓

Presupuestos

&#x20;  ↓

Seguimiento

```



Un cliente puede tener múltiples presupuestos.



No crear una entidad `Trabajo` como entidad principal de CorePresupuesto.



Un presupuesto puede representar un servicio o trabajo, pero conceptualmente sigue siendo un presupuesto asociado a un cliente.



CoreTrabajos podrá tener posteriormente su propia entidad `Trabajo`.



\---



\# 3. Independencia de los productos Core



CorePresupuesto es un producto independiente.



No depende estructuralmente de:



\* CoreTrabajos

\* Core Tributario

\* CorePyme

\* Core Contador

\* CorePagos

\* cualquier otro producto Core



Cada producto Core tiene:



\* origen independiente

\* contrato independiente

\* dominio independiente

\* funcionamiento independiente



Las integraciones entre productos son opcionales y responden a necesidades concretas del cliente.



Una futura integración con CoreTrabajos, por ejemplo, podría permitir que un presupuesto aceptado origine información en CoreTrabajos, pero CorePresupuesto debe funcionar completamente sin esa integración.



Core Tributario tampoco forma parte del flujo obligatorio de CorePresupuesto.



\---



\# 4. Plataformas



CorePresupuesto se construirá desde el inicio considerando \*\*tres plataformas de cliente\*\*:



```text

&#x20;                   CorePresupuesto

&#x20;                         │

&#x20;            ┌────────────┴────────────┐

&#x20;            │                         │

&#x20;         Web App                  Mobile App

&#x20;            │                         │

&#x20;       Next.js/TS             React Native + Expo

&#x20;            │                         │

&#x20;      Desktop/Web          Android + iOS/iPadOS

&#x20;            │                         │

&#x20;            └────────────┬────────────┘

&#x20;                         │

&#x20;                      Backend

&#x20;                         │

&#x20;                    PostgreSQL

```



\## 4.1 Aplicación Web



La aplicación web será una aplicación independiente desarrollada con:



\* Next.js

\* TypeScript



La web estará orientada principalmente a:



\* computadores

\* notebooks

\* pantallas de escritorio

\* administración y preparación de presupuestos



La web no debe considerarse simplemente una versión ampliada de la aplicación móvil.



\---



\# 5. Aplicación móvil



CorePresupuesto tendrá una aplicación móvil real, desarrollada con:



\* React Native

\* Expo



La aplicación será compatible con:



\* Android

\* iPhone

\* iPad



\## 5.1 Android



La aplicación deberá poder generar builds para:



\* APK para desarrollo, pruebas y distribución controlada.

\* AAB para publicación oficial.



El proyecto deberá quedar preparado desde su arquitectura inicial para una futura publicación en:



\*\*Google Play Store\*\*



La publicación oficial podrá realizarse posteriormente, cuando el producto esté preparado para producción.



\## 5.2 Apple



La aplicación deberá quedar preparada desde el inicio para:



\* iPhone

\* iPad

\* builds de desarrollo

\* builds de distribución



El proyecto deberá poder evolucionar hacia una publicación oficial en:



\*\*Apple App Store\*\*



La publicación oficial podrá realizarse posteriormente, cuando el producto esté preparado para producción.



\## 5.3 No utilizar PWA como aplicación móvil



La aplicación móvil \*\*NO será una PWA\*\*.



Tampoco se desarrollará como una simple versión responsive de la aplicación web.



Debe ser una aplicación móvil real mediante React Native + Expo.



Esto es importante porque CorePresupuesto necesita utilizar capacidades propias del dispositivo, especialmente:



\* cámara

\* fotografías

\* almacenamiento local

\* notificaciones

\* GPS

\* captura sin conexión

\* sincronización posterior



\---



\# 6. Relación entre Web y Mobile



Web y Mobile son clientes diferentes del mismo producto.



Ambos utilizan el mismo backend y modelo de datos.



```text

Web

&#x20;│

&#x20;├── API

&#x20;│

&#x20;└── Backend

&#x20;      │

&#x20;      └── PostgreSQL



Mobile

&#x20;│

&#x20;├── API

&#x20;│

&#x20;└── Backend

&#x20;      │

&#x20;      └── PostgreSQL

```



No duplicar la lógica de negocio entre Web y Mobile.



Las reglas de negocio deben permanecer principalmente en el backend.



La interfaz puede variar según la plataforma.



\---



\# 7. Estructura inicial del repositorio



Repositorio:



`https://github.com/MarceloSazoP/core-prespuestos.git`



Rama principal de desarrollo:



`develop`



Directorio local:



`D:\\Dev\\core-presupuestos-10-2026`



Estructura inicial:



```text

core-presupuestos-10-2026/

│

├── docs/

│

├── frontend/

│   └── Aplicación Web Next.js

│

├── mobile/

│   └── Aplicación React Native + Expo

│

├── backend/

│   └── API y lógica de negocio

│

├── .gitignore

├── CLAUDE.md

└── README.md

```



La carpeta `mobile/` forma parte del proyecto desde el inicio.



No agregarla posteriormente como una adaptación del producto web.



\---



\# 8. Base de datos



Base de datos PostgreSQL local:



```text

Database: core-prespuestos

User: postgres

```



Las credenciales no deben almacenarse en:



\* `CLAUDE.md`

\* documentación pública

\* código fuente

\* Git



Las credenciales deben manejarse mediante variables de entorno.



Ejemplo conceptual:



```text

DATABASE\_URL=...

```



\---



\# 9. Modelo funcional principal



La estructura conceptual mínima es:



```text

Usuario

&#x20;  │

&#x20;  └── Clientes

&#x20;         │

&#x20;         └── Presupuestos

&#x20;                 │

&#x20;                 ├── Levantamiento

&#x20;                 ├── Items

&#x20;                 ├── PDF

&#x20;                 ├── Acceso

&#x20;                 └── Seguimiento

```



No crear `jobs` o `trabajos` solamente porque un presupuesto representa un servicio.



\---



\# 10. Wizard de presupuesto



El proceso de creación tiene tres etapas:



\## Etapa 1 — Cliente y ubicación



Permite identificar:



\* cliente

\* teléfono

\* email

\* dirección

\* descripción inicial del servicio



\## Etapa 2 — Levantamiento



Permite capturar:



\* notas

\* fotografías

\* observaciones

\* mediciones simples

\* grabación de voz



La grabación de voz forma parte del MVP.



La transcripción automática NO forma parte del MVP.



La información puede guardarse parcialmente y continuar posteriormente.



\## Etapa 3 — Preparación del presupuesto



Permite ingresar:



\* descripción de los trabajos/productos

\* cantidad

\* precio unitario

\* total

\* subtotal

\* descuento opcional

\* total final

\* garantía

\* vigencia

\* observaciones

\* firma opcional



Acción final:



\*\*TERMINAR Y ENVIAR\*\*



Las tres etapas no tienen que completarse obligatoriamente en una sola sesión.



\---



\# 11. Captura offline



La aplicación móvil debe contemplar captura básica sin conexión.



Cuando no exista conexión deberá ser posible, dentro del alcance definido:



\* crear cliente

\* iniciar presupuesto

\* registrar notas

\* tomar fotografías

\* registrar mediciones

\* grabar voz



La información se sincronizará cuando vuelva a existir conexión.



No implementar inicialmente un sistema de sincronización distribuida complejo.



La solución debe ser simple y suficientemente robusta para el MVP.



\---



\# 12. Estados



Separar el estado documental del estado comercial.



\## Estado documental



```text

DRAFT

PENDING

FINALIZED

```



\## Estado comercial



```text

NONE

SENT

FOLLOW\_UP

ACCEPTED

REJECTED

```



No mezclar ambos conceptos.



Un presupuesto puede estar finalizado documentalmente y posteriormente cambiar su estado comercial.



\---



\# 13. Seguimiento comercial



CorePresupuesto incluye seguimiento comercial mínimo.



No se pretende construir un CRM tradicional.



El objetivo es:



> \*\*Evitar que el profesional olvide un presupuesto enviado.\*\*



Funciones:



\* fecha del próximo contacto

\* nota

\* estado comercial

\* llamar

\* WhatsApp

\* reenviar

\* visualizar

\* descargar PDF

\* agregar nota

\* programar seguimiento



Estados:



```text

ENVIADO

SEGUIMIENTO

ACEPTADO

RECHAZADO

```



La aceptación o rechazo es manual.



Aceptar un presupuesto no crea automáticamente un `Trabajo`.



Una futura integración con CoreTrabajos podrá hacerlo si el cliente la configura.



\---



\# 14. PDF



El presupuesto final debe generar un PDF comercial profesional y simple.



Debe poder contener:



\* logo opcional

\* datos del profesional

\* datos del cliente

\* identificador/número del presupuesto

\* fecha

\* descripción del servicio

\* items

\* subtotal

\* descuento

\* total

\* garantía

\* vigencia

\* observaciones

\* firma opcional

\* QR opcional



El PDF no es un documento tributario.



\---



\# 15. Envío



Al finalizar un presupuesto se debe poder:



\* generar PDF

\* generar vista web de solo lectura

\* compartir mediante las capacidades del dispositivo

\* enviar por email cuando exista correo del cliente

\* compartir mediante WhatsApp utilizando las capacidades disponibles del dispositivo

\* generar QR opcional



El MVP no utilizará WhatsApp Business API.



El QR solamente permitirá acceder a la vista pública de solo lectura.



No permitirá editar.



\---



\# 16. Acceso



Separar claramente:



\## Acceso del cliente



El cliente puede acceder a una vista de solo lectura mediante:



\* enlace público controlado

\* QR



No puede editar.



\## Acceso del profesional



El profesional podrá recuperar y editar un presupuesto mediante:



\* ID + código seguro



o



\* enlace privado de edición



El ID del presupuesto por sí solo nunca debe permitir edición.



\---



\# 17. Onboarding



Datos iniciales obligatorios:



\* teléfono

\* nombre

\* email



Flujo:



```text

Ingresar datos

&#x20;     ↓

Confirmar datos

&#x20;     ↓

Elegir SMS o Email

&#x20;     ↓

Recibir código

&#x20;     ↓

Validar código

&#x20;     ↓

Entrar a la aplicación

```



El MVP no requiere:



\* contraseña

\* login social

\* RUT

\* razón social

\* PFX/P12

\* CAF

\* representante legal

\* datos bancarios

\* configuración tributaria



El logo y la firma son opcionales.



La firma es una imagen utilizada en el presupuesto comercial.



No constituye una firma electrónica avanzada.



\---



\# 18. Dashboard



El dashboard debe ser simple.



Acción principal:



\*\*+ Nuevo presupuesto\*\*



Secciones principales:



\* Pendientes

\* Seguimiento

\* Finalizados



Opcionalmente podrá mostrar indicadores como:



\* total presupuestado del mes

\* monto aceptado

\* cantidad de presupuestos aceptados

\* ticket promedio

\* seguimientos pendientes

\* tasa de aceptación



Los indicadores no deben transformar el producto en un sistema administrativo complejo.



\---



\# 19. Mobile UX



La experiencia móvil debe estar diseñada principalmente para uso en terreno.



Debe priorizar:



1\. rapidez

2\. cámara

3\. captura de información

4\. lectura simple

5\. pocos pasos

6\. uso con una mano cuando sea posible

7\. funcionamiento con conectividad limitada



No intentar reproducir exactamente la interfaz web en Mobile.



La experiencia visual puede ser diferente mientras mantenga las mismas reglas de negocio.



\---



\# 20. Web UX



La web debe estar orientada principalmente a:



\* revisar presupuestos

\* preparar presupuestos

\* editar información

\* gestionar clientes

\* revisar seguimiento

\* generar y descargar documentos



No debe convertirse en un ERP.



\---



\# 21. Documentación antes del código



Antes de implementar tablas definitivas o lógica de negocio importante, crear y revisar la documentación correspondiente.



Orden mínimo:



```text

CLAUDE.md

&#x20;   ↓

Definición Funcional

&#x20;   ↓

Alcance Exacto del MVP

&#x20;   ↓

Database \& API Contract

&#x20;   ↓

Arquitectura técnica

&#x20;   ↓

Implementación

```



No crear tablas de producción solamente a partir de conversaciones informales.



\---



\# 22. Database \& API Contract



Antes de implementar PostgreSQL se debe definir formalmente:



\* `users`

\* `customers`

\* `quotes`

\* `quote\_items`

\* `follow\_ups`

\* `quote\_access`

\* información de levantamiento

\* fotografías

\* notas

\* mediciones

\* grabaciones de voz



También deben definirse:



\* relaciones

\* identificadores

\* estados

\* transiciones

\* permisos

\* acceso público

\* acceso privado

\* seguridad

\* auditoría mínima

\* eliminación

\* retención

\* archivos

\* límites

\* API

\* errores

\* validaciones



\---



\# 23. Seguridad



Debe existir aislamiento de información por usuario.



Un usuario nunca debe poder consultar o modificar datos pertenecientes a otro usuario.



Las vistas públicas deben ser de solo lectura.



Los mecanismos de edición deben estar protegidos.



No almacenar secretos en el repositorio.



Las variables sensibles deben utilizar configuración de entorno.



\---



\# 24. Testing



Cada funcionalidad relevante debe contar con pruebas adecuadas.



Como mínimo:



\* validaciones

\* reglas de negocio

\* estados

\* permisos

\* API

\* generación de presupuesto

\* seguimiento

\* acceso público

\* acceso privado



Mobile y Web deben probar el consumo de la API sin duplicar reglas de negocio.



\---



\# 25. Git



El desarrollo se realizará inicialmente en:



```text

develop

```



Los cambios deben ser pequeños y coherentes.



No realizar commits gigantes que mezclen:



\* arquitectura

\* base de datos

\* UI

\* autenticación

\* funcionalidades no relacionadas



Cada cambio debe poder revisarse y revertirse razonablemente.



\---



\# 26. Publicación



La publicación en tiendas no es requisito para comenzar el desarrollo.



Sin embargo, la arquitectura debe quedar preparada desde el inicio para:



```text

Android

&#x20;   ↓

APK para desarrollo/pruebas

&#x20;   ↓

AAB

&#x20;   ↓

Google Play Store

```



y:



```text

iOS / iPadOS

&#x20;   ↓

Build de desarrollo/pruebas

&#x20;   ↓

Build de distribución

&#x20;   ↓

Apple App Store

```



La publicación oficial será una etapa de lanzamiento, no una modificación arquitectónica posterior.



\---



\# 27. Alcance inicial de implementación



El primer desarrollo debe concentrarse en:



1\. estructura del repositorio

2\. documentación

3\. contrato de base de datos

4\. contrato de API

5\. backend

6\. PostgreSQL

7\. frontend web

8\. aplicación mobile React Native + Expo

9\. autenticación/verificación

10\. clientes

11\. creación de presupuesto

12\. levantamiento

13\. items

14\. generación de PDF

15\. envío/compartición

16\. seguimiento

17\. acceso público de solo lectura

18\. recuperación privada

19\. pruebas



No incorporar funcionalidades fuera del alcance sin una decisión explícita.



\---



\# 28. Regla fundamental



CorePresupuesto debe mantenerse pequeño, rápido y útil.



La aplicación debe sentirse como una herramienta de trabajo y no como un ERP.



La arquitectura debe permitir crecer posteriormente, pero el MVP no debe implementar complejidad solamente porque técnicamente sea posible.



\*\*Web, Android y Apple son plataformas del mismo producto, pero no deben obligar a convertir CorePresupuesto en un sistema complejo.\*\*



