# Mecanismo de consulta web mediante ID y QR

**Producto:** CorePresupuesto
**Funcionalidad:** Consulta de presupuestos
**Versión:** 1.1

## 1. Objetivo

CorePresupuesto deberá disponer de una página web de consulta de presupuestos que soporte **obligatoriamente dos formas de acceso al presupuesto**:

1. **Consulta manual:** mediante una caja de texto donde el usuario ingresa el ID del presupuesto y selecciona **Consultar**.
2. **Consulta mediante aplicación móvil:** mediante un QR fijo visible en la misma página, que permite a la aplicación móvil abrir la página web y transferir automáticamente el ID del presupuesto seleccionado.

Ambas modalidades deberán utilizar el **mismo mecanismo de consulta de presupuestos** y deberán entregar el mismo resultado.

---

# 2. Regla funcional obligatoria

La página web de consulta **DEBE soportar ambas formas de consulta**:

### Forma 1 — Caja de texto

El usuario ingresa manualmente el ID:

```text
┌──────────────────────────────────────────────┐
│           Consultar presupuesto              │
│                                              │
│ ID del presupuesto                           │
│ ┌──────────────────────────────┐             │
│ │ CP-8F7K2M91XQ7A...           │             │
│ └──────────────────────────────┘             │
│                                              │
│             [ Consultar ]                    │
│                                              │
└──────────────────────────────────────────────┘
```

La página deberá validar el ID, consultar el presupuesto y mostrarlo.

### Forma 2 — QR desde la aplicación móvil

El usuario selecciona un presupuesto en la aplicación móvil y selecciona **Ver en la web**.

La aplicación abre la cámara y escanea el **QR fijo de la página de consulta**.

La aplicación utiliza el QR para obtener la dirección de la página y posteriormente incorpora el ID del presupuesto seleccionado.

El navegador se abre directamente con el presupuesto correspondiente.

---

# 3. El QR es fijo

El QR mostrado en la página de consulta **NO corresponde a un presupuesto específico**.

El mismo QR será utilizado para todos los presupuestos.

Ejemplo:

```text
QR fijo
   ↓
https://corepresupuesto.cl/consultar
```

El ID del presupuesto es un dato independiente.

```text
ID seleccionado en la App
   ↓
CP-8F7K2M91XQ7A
```

La aplicación combina ambos elementos para abrir la consulta correspondiente.

Conceptualmente:

```text
QR fijo
   +
ID del presupuesto
   ↓
Página de consulta con ID
   ↓
Presupuesto
```

---

# 4. La página debe soportar ambos accesos

La ruta de consulta deberá aceptar tanto una consulta iniciada manualmente como una consulta iniciada desde la aplicación móvil.

### Consulta manual

```text
/consultar
```

El usuario escribe el ID en la caja de texto.

```text
ID → Consultar → Presupuesto
```

### Consulta desde aplicación móvil

```text
/consultar?id=CP-8F7K2M91XQ7A
```

La página detecta el ID recibido y realiza automáticamente la consulta.

```text
QR → App → ID → Web → Presupuesto
```

---

# 5. Interfaz de consulta

La página deberá mantener visible la caja de texto y el QR.

El QR **no reemplaza** la caja de texto.

La interfaz deberá permitir:

```text
                  Consultar presupuesto

       Ingresa el ID de tu presupuesto

       ┌─────────────────────────────┐
       │ ID del presupuesto          │
       └─────────────────────────────┘

                    [ Consultar ]

                         o

                 Escanea este QR
                       ┌─────┐
                       │ QR  │
                       └─────┘
```

El usuario de computador podrá utilizar la caja de texto.

El usuario de la aplicación móvil podrá utilizar el QR.

---

# 6. Resultado equivalente

Las dos modalidades deberán terminar en el mismo flujo interno:

```text
             ┌──────────────────────┐
             │ ID del presupuesto    │
             └──────────┬───────────┘
                        │
                        ▼
               Validar identificador
                        │
                        ▼
                Buscar presupuesto
                        │
                        ▼
              Validar disponibilidad
                        │
                        ▼
               Cargar presupuesto
```

No deberán existir dos mecanismos diferentes para obtener los datos del presupuesto.

---

# 7. Flujo completo desde la aplicación móvil

```text
Aplicación móvil
      │
      ▼
Usuario selecciona presupuesto
      │
      ▼
La aplicación obtiene el ID
      │
      ▼
Selecciona "Ver en la web"
      │
      ▼
Se abre la cámara
      │
      ▼
Escanea QR fijo
      │
      ▼
Obtiene URL de consulta
      │
      ▼
Incorpora el ID del presupuesto
      │
      ▼
Abre navegador
      │
      ▼
Página /consultar
      │
      ▼
Detecta ID
      │
      ▼
Consulta automáticamente
      │
      ▼
Muestra presupuesto
```

---

# 8. Flujo desde computador

```text
Usuario
   │
   ▼
Abre página de consulta
   │
   ▼
Escribe ID
   │
   ▼
Selecciona "Consultar"
   │
   ▼
Sistema valida ID
   │
   ▼
Busca presupuesto
   │
   ▼
Muestra presupuesto
```

---

# 9. Regla de implementación

La implementación de CorePresupuesto **NO deberá diseñarse considerando solamente una de las modalidades**.

La página de consulta deberá ser diseñada desde el inicio para soportar:

* ingreso manual del ID;
* recepción automática del ID desde la aplicación móvil;
* QR fijo de acceso a la página;
* consulta automática cuando el ID sea recibido mediante URL;
* consulta manual mediante el botón **Consultar**.

Ambas modalidades deberán coexistir en producción.

---

# 10. Definición funcional definitiva

> **La página web de consulta de CorePresupuesto DEBE soportar dos formas de consulta: mediante el ingreso manual del ID en una caja de texto y mediante un QR fijo utilizado por la aplicación móvil. El QR será permanente y no estará asociado a un presupuesto específico. La aplicación móvil utilizará el QR para acceder a la página de consulta y transferirá el ID del presupuesto seleccionado. La página deberá ser capaz de recibir el ID automáticamente y cargar el presupuesto sin intervención adicional del usuario. Ambas modalidades deberán utilizar el mismo mecanismo de consulta y producir el mismo resultado.**
