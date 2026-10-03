\# CorePresupuesto



\## Definición Funcional del Producto — v1.0



\### Reemplazo de las secciones 11 a 17: Wizard de Nuevo Presupuesto



\*\*Versión:\*\* 1.1 — Aclaración funcional del wizard

\*\*Producto:\*\* CorePresupuesto

\*\*Alcance:\*\* MVP

\*\*Plataformas:\*\* Aplicación móvil nativa y aplicación web



\---



\# 11. Wizard de Nuevo Presupuesto



\## 11.1. Objetivo



La creación de un presupuesto se realizará mediante un wizard compuesto por \*\*tres etapas funcionales\*\*:



1\. \*\*Cliente y ubicación:\*\* identificar al cliente, el lugar y el trabajo solicitado.

2\. \*\*Levantamiento:\*\* registrar la información recopilada en terreno.

3\. \*\*Preparación del presupuesto:\*\* transformar la información recopilada en un presupuesto comercial con precios y condiciones.



Las etapas deben mantener una separación funcional clara. El usuario no estará obligado a completar las tres en una misma sesión.



El principio de diseño es:



> \*\*Registrar primero. Presupuestar cuando corresponda. Enviar cuando esté listo.\*\*



El wizard debe conservar los datos ingresados al avanzar, retroceder, guardar o abandonar el proceso de manera controlada.



\## 11.2. Indicador de progreso



Durante la creación se mostrará un indicador sencillo:



`1. Cliente y ubicación → 2. Levantamiento → 3. Presupuesto`



La etapa actual debe distinguirse visualmente de las etapas completadas y de las que están pendientes.



El indicador no debe obligar a completar etapas futuras para poder guardar un trabajo.



\---



\# 12. Etapa 1 — Cliente y ubicación



\## 12.1. Objetivo



Identificar a quién se realizará el trabajo, dónde se realizará y cuál es su descripción inicial.



Esta etapa debe ser rápida, especialmente cuando el profesional está atendiendo a un cliente en terreno.



\## 12.2. Campos



| Campo               | Requisito                                   | Descripción                                                        |

| ------------------- | ------------------------------------------- | ------------------------------------------------------------------ |

| Nombre del cliente  | Obligatorio                                 | Persona o entidad que solicita el trabajo.                         |

| Teléfono            | Obligatorio para el flujo inicial           | Número de contacto del cliente.                                    |

| Correo electrónico  | Opcional                                    | Se utilizará para el envío del presupuesto cuando esté disponible. |

| Dirección           | Opcional                                    | Dirección del lugar donde se realizará el trabajo.                 |

| Ubicación GPS       | Opcional                                    | Coordenadas capturadas desde el dispositivo.                       |

| Descripción inicial | Obligatoria para continuar a la preparación | Resumen breve del trabajo solicitado.                              |



La aplicación debe permitir guardar un levantamiento aunque algunos datos opcionales estén incompletos.



La dirección y el GPS son datos diferentes: el usuario podrá registrar una dirección sin coordenadas y también capturar coordenadas sin completar manualmente una dirección.



\## 12.3. Ejemplo



\*\*Cliente:\*\* Juan Pérez

\*\*Teléfono:\*\* +56 9 XXXXXXXX

\*\*Correo:\*\* \[juan@email.com](mailto:juan@email.com)

\*\*Dirección:\*\* Av. XXXXX 1234

\*\*Trabajo:\*\* Mantención de calefont.



\## 12.4. Acciones



\*\*Siguiente\*\*



Guarda temporalmente los datos ingresados y avanza a la etapa 2.



\*\*Guardar y salir\*\*



Guarda el registro como pendiente y permite abandonar el wizard.



\*\*Cancelar\*\*



Permite salir del proceso solicitando confirmación si existen cambios sin guardar.



\## 12.5. Resultado de la etapa



Al terminar esta etapa, CorePresupuesto dispone de una identificación inicial del cliente y del trabajo.



Todavía no existe necesariamente un presupuesto comercial preparado ni un documento final.



\---



\# 13. Etapa 2 — Levantamiento del trabajo



\## 13.1. Objetivo



Registrar lo observado, solicitado o detectado durante la visita, sin exigir que el profesional determine inmediatamente los precios.



Esta etapa es el centro de la experiencia de captura de CorePresupuesto.



> \*\*El profesional debe poder registrar lo que vio y continuar con su jornada, aunque todavía no sepa cuánto cobrará.\*\*



\## 13.2. Información que se puede registrar



\### A. Notas de texto



Campo de texto libre para describir tareas, problemas detectados, materiales necesarios o condiciones del lugar.



Ejemplo:



> Cambiar dos pilas grandes, limpiar el chispero y revisar la conexión.



\### B. Nota de voz



El usuario podrá grabar una nota de voz desde el dispositivo.



La grabación quedará asociada al levantamiento.



La transcripción automática no forma parte del MVP.



\### C. Fotografías



El usuario podrá:



\* Tomar fotografías con la cámara.

\* Seleccionar imágenes del dispositivo.

\* Asociar varias fotografías al mismo levantamiento.



Las fotografías se almacenarán como antecedentes del trabajo. No se incorporarán automáticamente al presupuesto que recibe el cliente.



\### D. Medidas



Se podrán registrar medidas mediante entradas simples de texto.



Ejemplos:



\* Largo: 3,5 m.

\* Alto: 2,4 m.

\* Cantidad de puntos: 6.

\* Diámetro: 20 mm.



El MVP no requiere un sistema avanzado de unidades, planos ni cálculos técnicos especializados.



\### E. Observaciones



Campo de texto libre para registrar restricciones, advertencias o información adicional.



Ejemplo:



> El acceso al tablero eléctrico está parcialmente bloqueado por un mueble.



\## 13.3. Acciones principales



En esta etapa existirán dos acciones principales.



\### Acción A — Guardar



Guarda el levantamiento como pendiente y termina la sesión del wizard.



El registro queda disponible en la sección \*\*Pendientes\*\* del dashboard.



El usuario podrá regresar posteriormente, revisar la información y preparar el presupuesto.



Esta acción no genera un PDF final ni envía un presupuesto al cliente.



\### Acción B — Guardar y preparar presupuesto



Guarda el levantamiento y avanza directamente a la etapa 3.



La información registrada debe conservarse íntegramente.



El usuario no debe volver a ingresar los datos del cliente ni repetir las notas, fotografías o medidas.



\## 13.4. Acciones secundarias



\*\*Volver\*\*



Regresa a la etapa 1 sin perder la información registrada.



\*\*Guardar y salir\*\*



Guarda el levantamiento como pendiente y permite continuar trabajando fuera de la aplicación.



\## 13.5. Funcionamiento sin conexión



En la aplicación móvil, el usuario podrá realizar el levantamiento sin conexión a Internet, dentro de las capacidades offline del MVP.



La información quedará almacenada localmente y se sincronizará cuando vuelva la conectividad.



La interfaz deberá indicar cuándo existen datos pendientes de sincronización, sin impedir que el usuario continúe capturando información.



\## 13.6. Resultado de la etapa



Al terminar esta etapa, existe un levantamiento guardado que puede incluir cliente, ubicación, descripción, notas, voz, fotografías, medidas y observaciones.



\*\*El levantamiento y el presupuesto son conceptos distintos:\*\* guardar un levantamiento no significa que el presupuesto esté preparado, finalizado o enviado.



\---



\# 14. Etapa 3 — Preparación del presupuesto



\## 14.1. Objetivo



Convertir el levantamiento en un presupuesto comercial claro, con conceptos, cantidades, precios y condiciones.



Esta etapa puede iniciarse inmediatamente después de la visita o en otro momento, recuperando el trabajo desde Pendientes.



\## 14.2. Datos de contexto



La pantalla mostrará los datos ya registrados:



\* Cliente.

\* Teléfono.

\* Correo, si existe.

\* Dirección, si existe.

\* Descripción del trabajo.



El usuario podrá corregir estos datos antes de finalizar el presupuesto.



La edición de esta información no debe obligarlo a repetir el levantamiento.



\## 14.3. Detalle de los ítems



Cada ítem tendrá los siguientes campos:



| Campo           | Descripción                                            |

| --------------- | ------------------------------------------------------ |

| Descripción     | Trabajo, material, servicio o concepto que se cobrará. |

| Cantidad        | Número de unidades.                                    |

| Precio unitario | Precio de una unidad.                                  |

| Total del ítem  | Cantidad multiplicada por el precio unitario.          |



El usuario podrá agregar, editar y eliminar ítems antes de finalizar.



\### Ejemplo



| Descripción          | Cantidad | Precio unitario |       Total |

| -------------------- | -------: | --------------: | ----------: |

| Pilas grandes        |        1 |          $5.000 |      $5.000 |

| Limpiar chispero     |        1 |          $5.000 |      $5.000 |

| Revisión de conexión |        1 |         $10.000 |     $10.000 |

| \*\*Subtotal\*\*         |          |                 | \*\*$20.000\*\* |



El sistema calculará automáticamente los totales.



Se podrá aplicar un descuento opcional. Si existe un descuento, deberá reflejarse de forma clara en el resumen y en el documento final.



\## 14.4. Condiciones comerciales



\### Garantía



Opciones iniciales:



\* Sin garantía.

\* 7 días.

\* 15 días.

\* 30 días.

\* 3 meses.

\* 6 meses.

\* 1 año.

\* Personalizada.



El usuario podrá especificar condiciones particulares cuando corresponda.



\### Validez del presupuesto



Opciones iniciales:



\* 7 días.

\* 15 días.

\* 30 días.

\* Personalizada.



\### Observaciones y condiciones



Campo de texto libre para indicar condiciones adicionales del presupuesto.



\## 14.5. Firma



Antes de finalizar, la aplicación preguntará:



\*\*¿Deseas agregar tu firma al presupuesto final?\*\*



Opciones:



\* Sí.

\* No.



Si selecciona Sí y tiene una firma guardada en su perfil, se incorporará al documento.



Si no dispone de una firma, podrá continuar sin ella.



La firma es una imagen incorporada al presupuesto, no una firma electrónica avanzada.



\## 14.6. Revisión final



Antes del envío, el usuario podrá revisar:



\* Datos del profesional.

\* Datos del cliente.

\* Descripción del trabajo.

\* Ítems y precios.

\* Subtotal.

\* Descuento, si existe.

\* Total.

\* Garantía.

\* Validez.

\* Observaciones.

\* Firma, si corresponde.



La aplicación debe permitir volver a editar el contenido antes de confirmar la finalización.



\## 14.7. Acción principal



\*\*TERMINAR Y ENVIAR\*\*



Al confirmar esta acción, CorePresupuesto deberá:



1\. Validar que exista información suficiente para emitir el presupuesto comercial.

2\. Guardar la versión final del presupuesto.

3\. Generar el PDF.

4\. Generar la vista web de consulta.

5\. Generar el QR únicamente si corresponde según la configuración.

6\. Mostrar las opciones de envío disponibles.

7\. Permitir el envío por correo cuando corresponda.

8\. Permitir compartir mediante WhatsApp o las opciones de compartir del dispositivo.

9\. Registrar el estado comercial inicial como Enviado cuando el presupuesto efectivamente se haya enviado o compartido mediante el flujo confirmado.

10\. Permitir establecer un próximo contacto.



La generación del documento y el envío deben tratarse como operaciones distintas: generar un PDF no demuestra, por sí solo, que el cliente lo haya recibido.



Si el usuario genera el presupuesto, pero decide no enviarlo, el sistema deberá conservarlo sin afirmar que fue enviado.



\## 14.8. Resultado de la etapa



Al terminar correctamente, el usuario dispone de un presupuesto comercial finalizado, con PDF y vista web disponibles, y con las opciones de entrega correspondientes.



El presupuesto queda fuera de la lista de trabajos pendientes de preparación. Si requiere contacto posterior, aparecerá en Seguimiento.



CorePresupuesto genera presupuestos comerciales; no genera boletas, facturas ni documentos tributarios en el MVP.



\---



\# 15. Reglas de navegación y persistencia del wizard



Estas reglas se aplican a las tres etapas.



\## 15.1. Conservar los datos



Al avanzar o retroceder, la aplicación conservará los datos ingresados.



El usuario no tendrá que repetir información al cambiar de etapa.



\## 15.2. Guardado parcial



El usuario podrá guardar un registro incompleto cuando la información sea suficiente para identificar y recuperar el trabajo.



Los campos obligatorios para finalizar un presupuesto no deben impedir el guardado de un levantamiento parcial.



\## 15.3. Recuperación



Desde Pendientes, el usuario podrá abrir un registro y continuar desde la información guardada.



Si todavía no existe un presupuesto finalizado, podrá modificar el levantamiento y pasar a la etapa 3 cuando esté listo.



\## 15.4. Validación progresiva



Cada etapa validará únicamente lo necesario para la acción seleccionada.



\* Guardar un levantamiento tendrá requisitos mínimos.

\* Preparar un presupuesto requerirá información suficiente para construirlo.

\* Finalizar requerirá un presupuesto comercial válido.



No se solicitarán datos tributarios ni información empresarial avanzada para completar el wizard.



\## 15.5. Diferencia entre guardar, finalizar y enviar



\* \*\*Guardar:\*\* conserva el trabajo o presupuesto en preparación.

\* \*\*Finalizar:\*\* fija una versión comercial del presupuesto y genera sus documentos.

\* \*\*Enviar o compartir:\*\* entrega el presupuesto al cliente mediante un canal disponible.



Estas acciones no deben confundirse ni producir estados comerciales incorrectos.



\---



\# 16. Resumen funcional del wizard



| Etapa | Nombre                      | Pregunta que resuelve                  | Resultado                                                |

| ----- | --------------------------- | -------------------------------------- | -------------------------------------------------------- |

| 1     | Cliente y ubicación         | ¿Para quién y dónde es el trabajo?     | Identificación inicial.                                  |

| 2     | Levantamiento               | ¿Qué hay que hacer y qué se observó?   | Información de terreno guardada.                         |

| 3     | Preparación del presupuesto | ¿Cuánto cuesta y bajo qué condiciones? | Presupuesto comercial preparado para finalizar y enviar. |



El flujo completo queda así:



```text

&#x20;                NUEVO PRESUPUESTO

&#x20;                        │

&#x20;                        ▼

&#x20;            ┌───────────────────────┐

&#x20;            │ 1. CLIENTE Y UBICACIÓN│

&#x20;            │                       │

&#x20;            │ Cliente, contacto,    │

&#x20;            │ dirección y trabajo   │

&#x20;            └───────────┬───────────┘

&#x20;                        │ Siguiente

&#x20;                        ▼

&#x20;            ┌───────────────────────┐

&#x20;            │ 2. LEVANTAMIENTO      │

&#x20;            │                       │

&#x20;            │ Texto, voz, fotos,    │

&#x20;            │ medidas y notas       │

&#x20;            └───────────┬───────────┘

&#x20;                        │

&#x20;               ┌────────┴────────┐

&#x20;               ▼                 ▼

&#x20;            GUARDAR       GUARDAR Y PREPARAR

&#x20;               │                 │

&#x20;               ▼                 ▼

&#x20;          PENDIENTE      ┌───────────────────┐

&#x20;                         │ 3. PRESUPUESTO    │

&#x20;                         │                   │

&#x20;                         │ Ítems, precios,   │

&#x20;                         │ garantía y validez│

&#x20;                         └─────────┬─────────┘

&#x20;                                   │

&#x20;                                   ▼

&#x20;                           REVISIÓN FINAL

&#x20;                                   │

&#x20;                                   ▼

&#x20;                          TERMINAR Y ENVIAR

&#x20;                                   │

&#x20;                                   ▼

&#x20;                         PDF + VISTA WEB

&#x20;                                   │

&#x20;                                   ▼

&#x20;                         CORREO / WHATSAPP

&#x20;                                   │

&#x20;                                   ▼

&#x20;                        SEGUIMIENTO COMERCIAL

```



\*\*Decisión funcional para el MVP:\*\* el wizard tiene tres etapas, pero no obliga a completar las tres en una sola sesión. La etapa 2 puede terminar con un levantamiento guardado y pendiente; la etapa 3 puede completarse después, cuando el profesional esté preparado para definir precios y condiciones.



