# CorePresupuesto

Aplicación para capturar información en terreno, preparar presupuestos comerciales y hacerles seguimiento.

**Tagline:** "No olvides nada de lo que viste en terreno."

---

## 📁 Estructura del Proyecto

```
core-presupuestos-10-2026/
├── docs/                          # Documentación del producto
│   ├── 01-MVP-SCOPE.md           # Alcance exacto del MVP
│   ├── 02-DATABASE-SCHEMA.md     # Diseño de base de datos
│   └── 03-API-CONTRACT.md        # Contrato de API
├── frontend/                      # Aplicación Web (Next.js + TypeScript)
├── mobile/                        # Aplicación Mobile (React Native + Expo)
├── backend/                       # Backend API (Node.js / Python)
├── CLAUDE.md                      # Instrucciones del proyecto
└── README.md                      # Este archivo
```

---

## 🚀 Inicio Rápido

### 1. Documentación Primero

Lee en este orden:

1. **[01-MVP-SCOPE.md](docs/01-MVP-SCOPE.md)** — Qué incluye y qué no incluye el MVP
2. **[02-DATABASE-SCHEMA.md](docs/02-DATABASE-SCHEMA.md)** — Diseño de base de datos PostgreSQL
3. **[03-API-CONTRACT.md](docs/03-API-CONTRACT.md)** — Endpoints y contratos de API

### 2. Configuración de Ambiente

```bash
# Crear base de datos PostgreSQL
psql -U postgres -c "CREATE DATABASE core_prespuestos;"

# Las credenciales deben usar variables de entorno, no commitarse
```

### 3. Backend

```bash
cd backend
npm install
# o
pip install -r requirements.txt
```

### 4. Frontend Web

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### 5. Mobile

```bash
cd mobile
npm install
npx expo start
# Escanear QR con Expo Go (Android/iOS)
```

---

## 📋 Plataformas

### Web
- **Tech:** Next.js + TypeScript
- **Propósito:** Edición, gestión, revisión
- **Usuarios:** Principalmente escritorio

### Mobile
- **Tech:** React Native + Expo
- **Propósito:** Captura en terreno, revisión rápida
- **Plataformas:** Android (APK/AAB), iOS/iPadOS
- **Capacidades:** Cámara, fotos, grabación de voz, GPS, offline

### Backend
- **API:** REST
- **Base de datos:** PostgreSQL
- **Autenticación:** SMS/Email (sin contraseña en MVP)

---

## 🎯 MVP Scope

**Incluido:**
- ✅ Captura de información (notas, fotos, voz, mediciones)
- ✅ Presupuesto comercial (items, totales, términos)
- ✅ Generación de PDF
- ✅ Envío por email/WhatsApp/Link
- ✅ Seguimiento básico (estados, notas, próximo contacto)
- ✅ Acceso público (solo lectura, enlace + QR)
- ✅ Offline (mobile)

**Excluido:**
- ❌ Tributación, facturación, DTE
- ❌ Transcripción automática de voz
- ❌ Integración con CoreTrabajos
- ❌ CRM completo
- ❌ Firma electrónica avanzada (FEA)

---

## 🔐 Seguridad

- ✅ Aislamiento por usuario (nadie ve datos ajenos)
- ✅ Acceso público de solo lectura (clientes)
- ✅ Acceso privado con autenticación (profesional)
- ✅ Variables de entorno para secretos
- ✅ No guardar credenciales en Git

---

## 🧪 Testing

Cada funcionalidad relevante debe tener pruebas:
- Validaciones
- Reglas de negocio
- Estados y transiciones
- Permisos y acceso
- API endpoints
- Acceso público vs privado

---

## 📚 Documentación Técnica

- **[01-MVP-SCOPE.md](docs/01-MVP-SCOPE.md)** — Funcionalidades exactas
- **[02-DATABASE-SCHEMA.md](docs/02-DATABASE-SCHEMA.md)** — Tablas, relaciones, permisos
- **[03-API-CONTRACT.md](docs/03-API-CONTRACT.md)** — Endpoints y formatos

Siempre documentar ANTES de implementar.

---

## 📦 Dependencias Principales (esperadas)

### Backend
- Node.js / Express o Python / FastAPI
- PostgreSQL
- JWT / Bearer tokens
- Multer / file upload library
- PDF generation (pdfkit, reportlab, etc)

### Frontend Web
- Next.js
- TypeScript
- React
- TailwindCSS (o similar)
- Axios / fetch
- PDF viewer

### Mobile
- React Native
- Expo
- TypeScript
- Axios
- React Navigation
- Camera (expo-camera)
- Image picker (expo-image-picker)
- Audio (expo-av)
- File system (expo-file-system)

---

## 🔄 Flujo Principal

```
Usuario
  ↓
Captura en terreno (mobile)
  ↓
Edita/Prepara presupuesto (web)
  ↓
Genera PDF
  ↓
Envía a cliente
  ↓
Registra seguimiento
  ↓
Cliente accede (solo lectura)
```

---

## 📝 Convenciones

- **Commits:** Pequeños, coherentes, descritos
- **Rama principal:** `develop`
- **Idioma código:** Inglés
- **Comentarios:** Solo lo no obvio
- **Testing:** Funcionalidad relevante siempre tiene tests

---

## 🤝 Contribuir

1. Lee [CLAUDE.md](CLAUDE.md)
2. Lee documentación en `docs/`
3. Crea rama desde `develop`
4. Commit pequeño y coherente
5. Describe el cambio

---

## 📞 Contacto

Proyecto CorePresupuesto  
Repositorio: https://github.com/MarceloSazoP/core-presupuestos

---

**Última actualización:** 2026-10-03
