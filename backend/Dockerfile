# =============================================================================
# Stage 1: Build Spring Boot application using Maven and Java 21
# =============================================================================
FROM maven:3.9.9-eclipse-temurin-21-jammy AS builder

WORKDIR /build

# Cache Maven dependencies by copying pom.xml first
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy application source code
COPY src ./src

# Build production executable JAR (skipping test suite during container packaging)
RUN mvn clean package -DskipTests -B

# =============================================================================
# Stage 2: Minimal, secure Java 21 production runtime
# =============================================================================
FROM eclipse-temurin:21-jre-jammy

# Install curl, ca-certificates, and LibreOffice for document conversion (DOC/DOCX/XLS/PPT to PDF)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user and group (UID 1001)
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false -m appuser

WORKDIR /app

# Create writable upload and log directories with non-root ownership
RUN mkdir -p /app/uploads /app/logs && \
    chown -R appuser:appgroup /app

# Copy packaged JAR artifact from builder stage
COPY --from=builder --chown=appuser:appgroup /build/target/zoro-academy-backend-*.jar /app/app.jar

USER appuser

EXPOSE 8080

# Production JVM ergonomics:
# - G1GC for low-latency web request processing
# - MaxRAMPercentage=75.0 allows container memory limits to safely dictate heap
# - /dev/./urandom prevents blocking entropy starvation on virtualized environments
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

# Healthcheck hitting lightweight public /api/time endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f -s http://localhost:8080/api/time > /dev/null || exit 1

# Execute Java with exec to ensure proper OS signal forwarding (SIGTERM / graceful shutdown)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
