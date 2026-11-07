import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

loadEnv({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
});

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function readAdminPassword(value: string | undefined): string {
  if (value && value.length >= 8) {
    return value;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test-admin-password';
  }
  throw new Error('ADMIN_PASSWORD is required and must be at least 8 characters');
}

export const config = {
  port: readPort(process.env.PORT),
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  adminPassword: readAdminPassword(process.env.ADMIN_PASSWORD),
  production: process.env.NODE_ENV === 'production',
};
