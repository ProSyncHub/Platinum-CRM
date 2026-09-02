module.exports = {
  apps: [
    {
      name: "prosync-crm",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3010 --keepAliveTimeout 70000",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "1G",
      kill_timeout: 30000,
      time: true,
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
