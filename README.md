<div align="center">

# 🌙 Moonlight Chat

**Plataforma de Comunicación en Tiempo Real para Comunidades, Servidores y Mensajes Directos.**

[![Versión](https://img.shields.io/badge/versión-2026.725.0-7289da.svg?style=for-the-badge)](https://github.com/aetherbeyondstars/moonlightChat)
[![Plataformas](https://img.shields.io/badge/plataforma-Web%20%7C%20Desktop%20(Windows)-007ACC.svg?style=for-the-badge)](https://github.com/aetherbeyondstars/moonlightChat)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green.svg?style=for-the-badge)](LICENSE)

*Inspirada en las mejores experiencias de chat moderno con un diseño oscuro, elegante, ultra fluido y soporte nativo para aplicaciones de escritorio.*

---

</div>

## ✨ Características Destacadas

### 🏰 Comunidades y Servidores
- **Servidores Personalizables**: Creación de servidores con icono de avatar, banner e invitaciones con códigos únicos.
- **Canales de Texto y Voz**: Árboles de categorías dinámicos y ordenables mediante *Drag & Drop*.
- **Control de Permisos y Roles**: Sistema de roles (`Propietario del servidor`, `Administrador`, `Miembro`).
- **Verificación de Enlaces a Mensajes**: Validación de permisos de canal/servidor con modal emergente estilizado de acceso denegado.

### 💬 Mensajería Enriquecida y Tiempo Real
- **Mensajes Directos (DMs)**: Conversaciones privadas 1:1 con lista de amigos e indicadores de no leídos.
- **Respuestas y Reacciones**: Formateo de texto enriquecido, menciones de usuarios/canales, respuestas y reacciones con emojis.
- **Indicador de Escritura**: Muestra en tiempo real cuando los usuarios están escribiendo.

### 🎙️ Chat de Voz y Llamadas
- **Conexión WebRTC de Baja Latencia**: Canales de voz comunitarios y llamadas privadas en DMs.
- **Control Multimedia**: Silenciado de micrófono, ensordecido de audio y selección dinámica de dispositivos de entrada/salida.
- **Transmitir Pantalla**: Comparte tu pantalla o ventanas individuales directamente en los canales de voz.

### 🏅 Insignias Globales (Global Badges)
- **Perfil de Usuario Avanzado**: Visualización de tarjetas de perfil con avatar, banner personalizable, biografía y estado personalizado.
- **Badges Globales Exclusivas**:
  - 👑 **Host Owner**: Propietario del host de la instancia.
  - 🛡️ **Moonlight Staff**: Equipo administrativo oficial.
  - 🐛 **Bug Hunter**: Cazadores de bugs de la comunidad.
- **Gestión por Consola**: Asignación rápida de insignias mediante comando CLI en el backend (`npm run set-badges`).

---

## 🛠️ Tecnologías Utilizadas

### **Frontend & Escritorio**
- **Core**: [React 18](https://react.dev/) + [Vite 5](https://vite.dev/)
- **Escritorio**: [Electron 31](https://www.electronjs.org/) + Electron Packager
- **Estilos**: [TailwindCSS](https://tailwindcss.com/) + [Radix UI / Shadcn UI](https://ui.shadcn.com/)
- **Iconos**: [Lucide React](https://lucide.dev/)
- **Realtime**: [Socket.io Client](https://socket.io/) + WebRTC

### **Backend & API**
- **Servidor**: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- **ORM & BD**: [Prisma ORM](https://www.prisma.io/) + [SQLite](https://www.sqlite.org/)
- **WebSockets**: Socket.io Server
- **Autenticación**: JWT (JSON Web Tokens) + Bcrypt

---

## 📁 Estructura del Proyecto

```plain
moonlight/
├── frontend/                # Aplicación Web React + Vite + Proceso Principal de Electron
│   ├── electron/            # Integración nativa de escritorio (main.js, preload.js, build-icon.js)
│   ├── src/                 # Componentes UI, hooks, store, páginas y contexto de autenticación
│   └── package.json
├── backend/                 # API REST + WebSockets + Servidor HTTP/HTTPS
│   ├── prisma/              # Esquema de BD, migraciones y scripts de seed
│   ├── src/                 # Rutas, controladores, servicios y sockets en tiempo real
│   └── package.json
└── run/                     # Scripts de automatización para Windows
    ├── run.bat              # Lanzador rápido de dos consolas etiquetadas
    ├── startBackend.ps1     # Script de inicio formateado para Backend
    └── startFrontend.ps1    # Script de inicio formateado para Frontend
```

---

## 🚀 Instalación y Ejecución Local

### **Requisitos Previos**
- [Node.js](https://nodejs.org/) (Versión v18 o superior)
- [npm](https://www.npmjs.com/)

---

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/aetherbeyondstars/moonlightChat.git
cd moonlightChat
```

---

### **2. Configurar el Backend**
```bash
cd backend

# Instalar dependencias
npm install

# Copiar archivo de variables de entorno
cp .env.example .env

# Sincronizar la base de datos SQLite con Prisma
npx prisma db push
```

---

### **3. Configurar el Frontend**
```bash
cd ../frontend

# Instalar dependencias
npm install

# Copiar archivo de variables de entorno
cp .env.example .env
```

---

### **4. Iniciar la Aplicación**

#### **En Windows (Recomendado)**
Haz doble clic en el ejecutable **`run/run.bat`** o ejecuta en la consola:
```powershell
.\run\run.bat
```
Esto abrirá dos ventanas independientes marcadas como **Consola Backend** y **Consola Frontend**.

#### **Manualmente desde la Consola**

- **Backend**:
  ```bash
  cd backend
  npm run dev
  ```
- **Frontend**:
  ```bash
  cd frontend
  npm run dev
  ```

Abre tu navegador en `https://localhost:5173`.

---

## 👑 Gestión de Insignias Globales

Para asignar o quitar insignias globales a cualquier usuario directamente desde la consola del backend:

```bash
cd backend

# Asignar insignias a un usuario (ejemplo: @aether)
npm run set-badges -- aether HOST_OWNER,INSTANCE_ADMIN,BUG_HUNTER

# Quitar todas las insignias de un usuario
npm run set-badges -- aether clear
```

---

## 💻 Compilar Aplicación de Escritorio (.exe)

Para empaquetar la aplicación de escritorio nativa para Windows (`Moonlight.exe`):

```bash
cd frontend
npm run dist:win
```

El ejecutable resultante se guardará en:
`frontend/dist-electron/Moonlight-win32-x64/Moonlight.exe`

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.

<div align="center">

**Desarrollado con ❤️ para comunidades y desarrolladores por [Aether](https://github.com/aetherbeyondstars).**

</div>
