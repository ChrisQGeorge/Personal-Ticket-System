-- Grant the application user minimal privileges on the app database.
-- ALTER and CREATE are needed for startup migrations.
GRANT SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE, INDEX ON pts_db.* TO 'pts_user'@'%';
FLUSH PRIVILEGES;
