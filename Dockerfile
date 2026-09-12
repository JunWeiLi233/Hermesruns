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

# Both Garmin services invoke `python tools/garmin_*.py` from /app.
# Use a virtual environment so the OS-managed Python installation stays intact.
COPY tools/requirements-garmin-runtime.txt /tmp/requirements-garmin-runtime.txt
RUN apk add --no-cache python3 \
    && apk add --no-cache --virtual .garmin-install py3-pip \
    && python3 -m venv /opt/garmin \
    && /opt/garmin/bin/pip install --no-cache-dir --only-binary=:all: -r /tmp/requirements-garmin-runtime.txt \
    && apk del .garmin-install

ENV PATH="/opt/garmin/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1

RUN addgroup -S hermes \
    && adduser -S -G hermes hermes \
    && chown -R hermes:hermes /app

COPY --chown=hermes:hermes --from=backend-build /backend/target/*.jar app.jar

# The race-course bulk seeder and admin bulk scans resolve the race catalog at
# <workdir>/frontend/src/data/worldRaceCatalog.json when the repo-relative path
# is absent; without this copy production silently skips official-course
# seeding (boot log: "catalog unavailable").
COPY --chown=hermes:hermes frontend/src/data/worldRaceCatalog.json ./frontend/src/data/worldRaceCatalog.json

COPY tools/garmin_connect_download.py tools/garmin_wellness_download.py tools/check_garmin_runtime.py ./tools/

USER hermes

# Exercise both stdin/JSON workers with offline fixtures as the runtime user.
# Missing scripts, dependencies, or incompatible provider APIs fail the build.
RUN --network=none python tools/check_garmin_runtime.py

# Lean JVM footprint for small containers. Without these flags the JVM sizes
# its heap from container ergonomics, grows toward that ceiling, and never
# returns RSS - Railway reported 1.6 GB for this app. The heap/GC/metaspace
# settings follow the locally proven profile (tools/run-backend.*, without
# the devtools-driven metaspace headroom); the free-ratio pair makes the JVM
# uncommit heap after spikes. Deployments can override JAVA_OPTS without
# rebuilding the image.
ENV JAVA_OPTS="-Xms64m -Xmx640m -XX:+UseSerialGC \
    -XX:MaxMetaspaceSize=128m \
    -XX:MinHeapFreeRatio=20 -XX:MaxHeapFreeRatio=40 \
    -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
