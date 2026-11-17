FROM redis:7-alpine

CMD ["sh", "-c", "redis-server --requirepass \"$REDIS_PASSWORD\" --maxmemory-policy noeviction --appendonly yes --dir /data"]
