# Stage 1 - Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci --ignore-scripts

COPY frontend/index.html ./
COPY frontend/vite.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/eslint.config.js ./
COPY frontend/public ./public
COPY frontend/scripts ./scripts
COPY frontend/src ./src

RUN node scripts/run-vite-build.mjs

# Stage 2 - Build backend (with frontend bundle already in static/)
FROM eclipse-temurin:17-jdk-alpine AS backend-build
WORKDIR /backend

COPY backend/pom.xml ./
COPY backend/mvnw ./
COPY backend/.mvn ./.mvn
COPY backend/src ./src

# Bring in the compiled frontend bundle (Vite outDir -> /backend/src/main/resources/static)
COPY --from=frontend-build /backend/src/main/resources/static \
     ./src/main/resources/static

RUN chmod +x ./mvnw && ./mvnw -q -DskipTests package

# Stage 3 - Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=backend-build /backend/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
