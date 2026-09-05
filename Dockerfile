# Stage 1 - Build frontend
FROM node:26-alpine AS frontend-build
WORKDIR /frontend

# Production source maps must be an explicit opt-in. The build script also
# defaults this to false, but keeping it in the image contract prevents a
# Railway environment variable from accidentally publishing source maps.
ENV VITE_SOURCEMAP=false

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
FROM eclipse-temurin:25-jdk-alpine AS backend-build
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
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

RUN addgroup -S hermes \
    && adduser -S -G hermes hermes \
    && chown -R hermes:hermes /app

COPY --chown=hermes:hermes --from=backend-build /backend/target/*.jar app.jar

# The race-course bulk seeder and admin bulk scans resolve the race catalog at
# <workdir>/frontend/src/data/worldRaceCatalog.json when the repo-relative path
# is absent; without this copy production silently skips official-course
# seeding (boot log: "catalog unavailable").
COPY --chown=hermes:hermes frontend/src/data/worldRaceCatalog.json ./frontend/src/data/worldRaceCatalog.json

USER hermes

# Lean JVM footprint for small containers. Without these flags the JVM sizes
# its heap from container ergonomics, grows toward that ceiling, and never
# returns RSS — Railway reported 1.6 GB for this app. The heap/GC/metaspace
# settings follow the locally proven profile (tools/run-backend.*, without
# the devtools-driven metaspace headroom); the free-ratio pair makes the JVM
# uncommit heap after spikes. Deployments can override JAVA_OPTS without
# rebuilding the image.
ENV JAVA_OPTS="-Xms128m -Xmx768m -XX:+UseSerialGC \
    -XX:MaxMetaspaceSize=256m \
    -XX:MinHeapFreeRatio=20 -XX:MaxHeapFreeRatio=40 \
    -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
