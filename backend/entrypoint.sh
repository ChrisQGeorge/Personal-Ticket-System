#!/bin/bash
set -e

echo "Waiting for MySQL to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0

while ! python -c "
import pymysql, os
url = os.getenv('DATABASE_URL', 'mysql+pymysql://pts_user:pts_pass_2024@db:3306/pts_db')
# parse host, port, user, password, db from URL
parts = url.split('://')[1]
creds, rest = parts.split('@')
user, password = creds.split(':')
hostport, dbname = rest.split('/')
host, port = hostport.split(':')
conn = pymysql.connect(host=host, port=int(port), user=user, password=password, database=dbname)
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
