# ========================================================
# Dockerfile para Dokploy - CRM daniautoma AI & WhatsApp
# ========================================================

FROM node:20-alpine AS runner

WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma y Node en Alpine
RUN apk add --no-cache openssl libc6-compat

# Copiar manifiestos de dependencias y schema de Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias limpias y generar cliente de Prisma
RUN npm ci
RUN npx prisma generate

# Copiar el código fuente completo
COPY . .

# Desactivar telemetría de Next.js durante la compilación
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compilar la aplicación Next.js
RUN npm run build

# Crear directorios para persistencia de datos (Volúmenes en Dokploy)
RUN mkdir -p /app/baileys_auth /app/data

# Exponer el puerto oficial
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Al arrancar el contenedor: sincronizar base de datos, ejecutar seed si es necesario y levantar Next.js
CMD ["sh", "-c", "npx prisma db push && npm run seed && npm run start"]
