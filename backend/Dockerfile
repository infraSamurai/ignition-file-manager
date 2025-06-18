FROM python:3.9-slim

WORKDIR /app

# Install Flask
RUN pip install flask

# Copy application code
COPY app.py .

# Create a non-root user for OpenShift compatibility
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8080

CMD ["python", "app.py"]