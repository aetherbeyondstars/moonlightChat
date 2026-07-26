<div align="center">

# 🌙 Moonlight Chat

**Aplicación de Mensajeria Instantanea en Tiempo Real para Comunidades, Servidores y Mensajes Directos.**

[![Versión](https://img.shields.io/badge/versión-2026.725.0-7289da.svg?style=for-the-badge)](https://github.com/aetherbeyondstars/moonlightChat)
[![Plataformas](https://img.shields.io/badge/plataforma-Web%20%7C%20Windows%20%7C%20Linux-007ACC.svg?style=for-the-badge)](https://github.com/aetherbeyondstars/moonlightChat)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green.svg?style=for-the-badge)](LICENSE)

---

## ⚠️ Aviso Importante / Descargo de Responsabilidad (Disclaimer)

> [!WARNING]
> **Moonlight Chat** es un proyecto en desarrollo activo y se proporciona "tal cual" (*as is*).
> 
> - **Estado del proyecto**: La aplicación no se encuentra finalizada al 100% y puede presentar fallos de funcionamiento (bugs), interrupciones inesperadas o características incompletas.
> - **Seguridad**: El sistema no ha sido sometido a una auditoría de seguridad formal. Puede contener posibles vulnerabilidades o riesgos de seguridad no identificados, por lo que **no se recomienda su despliegue en entornos de producción críticos** ni el manejo de datos altamente sensibles.
> - **Responsabilidad**: El uso de este software para hospedar servidores comunitarios o privados se realiza bajo la entera responsabilidad del administrador o usuario.

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
  - 🛡️ **Moonlight Staff**: Equipo administrativo de la instancia.
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

#### 🪟 En Windows
Haz doble clic en el ejecutable **`run/run.bat`** o ejecuta en PowerShell:
```powershell
.\run\run.bat
```
Esto abrirá dos ventanas independientes marcadas como **Consola Backend** y **Consola Frontend**.

O manualmente en dos consolas:
- **Backend**: `cd backend && npm run dev`
- **Frontend**: `cd frontend && npm run dev`

#### 🐧 En Linux (Desarrollo Local)
Ejecuta en dos terminales independientes:
- **Terminal 1 (Backend)**:
  ```bash
  cd backend
  npm run dev
  ```
- **Terminal 2 (Frontend)**:
  ```bash
  cd frontend
  npm run dev
  ```

Abre tu navegador en `https://localhost:5173`.

---

## 🌐 Montar el Servidor en Producción en Linux (VPS / Ubuntu / Debian)

Esta guía explica paso a paso cómo alojar el backend de Moonlight en un servidor VPS o dedicado con Linux (Ubuntu/Debian) para que funcione 24/7 con soporte para WebSockets y SSL seguro.

### **Paso 1: Instalar Node.js y PM2 en el Servidor**
```bash
# Actualizar el sistema e instalar dependencias básicas
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 para mantener el servicio funcionando 24/7
sudo npm install -g pm2
```

### **Paso 2: Clonar el Código y Configurar Variables de Entorno**
```bash
# Clonar el proyecto en el servidor
git clone https://github.com/aetherbeyondstars/moonlightChat.git
cd moonlightChat/backend

# Instalar dependencias del backend
npm install

# Crear el archivo de entorno
cp .env.example .env
```

Edita la configuración en el archivo `.env` (`nano .env`):

```env
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="un_secreto_aleatorio_y_muy_seguro_para_produccion"
CLIENT_URL="https://tudominio.com"
```

> 💡 **Consejo de Seguridad:** Puedes generar automáticamente una clave aleatoria y segura para copiar y pegar en `JWT_SECRET` ejecutando este comando en la consola:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### **Paso 3: Inicializar la Base de Datos y Arrancar con PM2**
```bash
# Sincronizar Prisma ORM y la BD SQLite en disco
npx prisma db push

# Iniciar el servicio con PM2
pm2 start src/server.js --name "moonlight-backend"

# Configurar PM2 para que rearranque automáticamente si se reinicia el servidor VPS
pm2 save
pm2 startup
```

### **Paso 4: Configurar Nginx como Reverse Proxy y WebSocket Gateway**
```bash
# Instalar Nginx y Certbot para el certificado SSL gratis
sudo apt install -y nginx certbot python3-certbot-nginx
```

Crea una configuración para Nginx en `/etc/nginx/sites-available/moonlight`:
```bash
sudo nano /etc/nginx/sites-available/moonlight
```

Añade el siguiente bloque de configuración:
```nginx
server {
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        # Cabeceras necesarias para soportar Socket.io y WebSockets en tiempo real
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activa la configuración y recarga Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/moonlight /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### **Paso 5: Activar HTTPS Gratis con Certbot (Let's Encrypt)**
```bash
sudo certbot --nginx -d tudominio.com
```
¡Listo! Tu servidor Moonlight estará corriendo de forma segura 24/7 en HTTPS/WSS.

---

## 💻 Compilar la Aplicación de Escritorio (Windows y Linux)

Moonlight utiliza Electron para generar ejecutables nativos de escritorio para Windows y Linux.

### 🪟 Para Windows (`.exe`)
```bash
cd frontend
npm run dist:win
```
El ejecutable comprimido se guardará en:
`frontend/dist-electron/Moonlight-win32-x64/Moonlight.exe`

---

### 🐧 Para Linux (`.deb` e Instalador Binario)

#### 1. Generar el Binario Ejecutable para Linux
```bash
cd frontend
npm run dist:linux
```
Generará la carpeta ejecutable en:
`frontend/dist-electron/Moonlight-linux-x64/Moonlight`

#### 2. Generar el Paquete Instalador `.deb` (Debian / Ubuntu / Linux Mint)
Para empaquetar la aplicación en un instalador `.deb` que los usuarios puedan instalar haciendo doble clic o usando `dpkg -i`:

```bash
# Instalar globalmente la herramienta de paquetes debian de Electron
sudo npm install -g electron-installer-debian

# Crear el paquete .deb desde la raíz del proyecto
electron-installer-debian \
  --src frontend/dist-electron/Moonlight-linux-x64/ \
  --dest frontend/dist-electron/ \
  --arch amd64 \
  --name moonlight \
  --productName "Moonlight"
```
El archivo de instalación **`moonlight_amd64.deb`** se guardará en `frontend/dist-electron/`.

Para instalarlo en cualquier equipo Ubuntu/Debian:
```bash
sudo dpkg -i frontend/dist-electron/moonlight_amd64.deb
```

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

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.

<div align="center">

**Desarrollado con ❤️ para comunidades y desarrolladores por [Aether](https://github.com/aetherbeyondstars).**

</div>
