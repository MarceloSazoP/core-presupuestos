# CorePresupuesto MVP - Alcance Exacto

**Fecha:** 2026-10-03  
**Estado:** Definición Inicial

---

## Propósito

Aplicación para capturar información en terreno, preparar presupuestos comerciales y enviarlos a clientes.

**Problema resuelto:** "No olvides nada de lo que viste en terreno."

**Flujo:** Captura → Presupuesta → Envía → Seguimiento → Sigue trabajando

---

## Alcance: Incluido en MVP

### 1. Autenticación/Verificación
- SMS o Email (sin contraseña)
- Teléfono, nombre, email obligatorios
- Verificación de código simple

### 2. Clientes
- Crear cliente
- Teléfono, email, dirección, nombre
- Listar clientes del usuario
- Sin duplicación automática

### 3. Presupuestos (Documentos Comerciales)
- **No son documentos tributarios**
- No generan boletas, facturas, DTE

#### Etapa 1: Cliente y Ubicación
- Seleccionar o crear cliente
- Dirección, descripción inicial

#### Etapa 2: Levantamiento
- Notas de texto
- Fotografías
- Mediciones simples
- Grabación de voz (sin transcripción automática)
- Guardar parcialmente, continuar después

#### Etapa 3: Presupuesto
- Descripción de trabajos
- Cantidad, precio unitario
- Subtotal, descuento, total
- Garantía, vigencia, observaciones
- Firma opcional (imagen, no e-firma avanzada)

### 4. Generación de PDF
- Logo opcional
- Datos profesional + cliente
- Número, fecha, items, totales
- Garantía, vigencia, observaciones
- QR opcional (solo lectura)

### 5. Envío/Compartición
- Generar PDF
- Vista web pública (solo lectura)
- Compartir nativo del dispositivo
- Email cuando esté disponible
- WhatsApp (no Business API, solo nativo)

### 6. Acceso
- **Cliente:** Enlace público + QR (solo lectura)
- **Profesional:** ID + código seguro para editar O enlace privado

### 7. Seguimiento Comercial Mínimo
- Estados: ENVIADO, SEGUIMIENTO, ACEPTADO, RECHAZADO
- Próximo contacto (fecha)
- Notas
- Llamar, WhatsApp, reenviar
- Aceptación manual (NO crea trabajo automático)

### 8. Dashboard
- Botón "Nuevo presupuesto"
- Secciones: Pendientes, Seguimiento, Finalizados
- Indicadores opcionales (total, aceptados, tasa)

---

## Alcance: EXCLUIDO de MVP

### No Incluir
- Contraseña compleja
- Login social
- RUT, razón social
- PFX/P12, CAF, asesor tributario
- Facturación/DTE
- CRM completo
- Entidad "Trabajo" (es opcional post-MVP)
- Transcripción automática de voz
- Integración con CoreTrabajos (futura)
- WhatsApp Business API
- Firma electrónica avanzada (FEA)
- Múltiples firmas
- Plantillas de presupuesto
- Descuentos automáticos
- Impuestos tributarios

---

## Plataformas

### Web (Next.js + TypeScript)
- Revisar presupuestos
- Preparar presupuestos
- Editar información
- Gestionar clientes
- Revisar seguimiento
- Descargar documentos

### Mobile (React Native + Expo)
- Android (APK en desarrollo, AAB para Play Store futura)
- iOS/iPadOS (builds de desarrollo, distribución futura)

#### Capacidades Específicas Móvil
- Cámara
- Fotografías
- Almacenamiento local
- Notificaciones
- GPS
- Captura offline
- Sincronización posterior

### Backend
- API común para Web y Mobile
- PostgreSQL
- Aislamiento por usuario
- Seguridad de acceso

---

## Estados

### Estado Documental
- `DRAFT` — No finalizado
- `PENDING` — Esperando revisión
- `FINALIZED` — Listo para enviar

### Estado Comercial
- `NONE` — Sin seguimiento
- `SENT` — Enviado
- `FOLLOW_UP` — En seguimiento
- `ACCEPTED` — Aceptado
- `REJECTED` — Rechazado

**Nota:** Un presupuesto puede estar FINALIZED y cambiar su estado comercial después.

---

## Datos Iniciales No Requeridos

- Contraseña
- RUT
- Razón social
- Datos bancarios
- Configuración tributaria
- Firma (es opcional)
- Logo (es opcional)

---

## MVP Completeness Check

✅ Capturar información en terreno  
✅ Preparar presupuesto comercial  
✅ Enviar a cliente  
✅ Seguimiento básico  
✅ Acceso cliente (solo lectura)  
✅ Acceso profesional (editar)  
✅ Funcionamiento offline (mobile)  

---

## Criterio de Éxito

El MVP está completo cuando:

1. Un usuario puede capturar presupuesto en terreno (mobile)
2. Puede editarlo en escritorio (web)
3. Puede enviarlo a cliente
4. Puede hacer seguimiento
5. Cliente puede verlo (solo lectura)
