-- Ensure the application user can connect from any host in the Docker network
-- Note: MYSQL_USER and MYSQL_PASSWORD from docker-compose handle initial creation.
-- This script ensures '%' host access in case of network changes.
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
