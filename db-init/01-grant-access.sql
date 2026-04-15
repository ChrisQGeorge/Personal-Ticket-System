-- Ensure pts_user can connect from any host in the Docker network
CREATE USER IF NOT EXISTS 'pts_user'@'%' IDENTIFIED BY 'pts_pass_2024';
GRANT ALL PRIVILEGES ON pts_db.* TO 'pts_user'@'%';
FLUSH PRIVILEGES;
