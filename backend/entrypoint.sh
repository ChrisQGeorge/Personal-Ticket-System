#!/bin/bash
set -e

echo "Waiting for MySQL to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0

while ! python -c "
import pymysql, os
conn = pymysql.connect(
    host=os.getenv('DB_HOST', 'db'),
    port=int(os.getenv('DB_PORT', '3306')),
    user=os.getenv('DB_USER', 'pts_user'),
    password=os.getenv('DB_PASS', 'pts_pass_2024'),
    database=os.getenv('DB_NAME', 'pts_db'),
)
conn.close()
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "MySQL not ready after $MAX_RETRIES attempts. Trying to start anyway..."
        break
    fi
    echo "MySQL not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES). Waiting 2 seconds..."
    sleep 2
done

echo "MySQL is ready!"
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
