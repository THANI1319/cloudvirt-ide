# Base OS with Python
FROM python:3.12-slim

# Install Java (JDK) and C (GCC) compilers
RUN apt-get update && apt-get install -y \
    default-jdk \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy all your project files into the cloud container
COPY . /app

# Install the Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Command to run the app using Gunicorn
ENV PORT=5000
EXPOSE 5000
CMD gunicorn -w 2 -b 0.0.0.0:$PORT app:app