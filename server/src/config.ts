import 'dotenv/config';

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

export const config = {
  port: readPort(process.env.PORT),
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
