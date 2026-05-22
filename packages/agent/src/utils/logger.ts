import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

const isTty = process.stdout.isTTY === true;

export const logger = pino({
  level,
  ...(isTty
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
