import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  basePath: '/api/auth', // set literally: the library mounts its middleware in
  // onModuleInit(), which runs before main.ts calls app.setGlobalPrefix('api'),
  // so relying on the global prefix to compose the final path doesn't work
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  hooks: {}, // required for @thallesp/nestjs-better-auth's @Hook()/@AfterHook() providers to attach
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: false, // don't create a session when we sign someone up server-side (invite flow)
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'DEVELOPER' },
      status: { type: 'string', required: true, defaultValue: 'INVITED' },
      mustResetPassword: {
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    },
  },

  trustedOrigins: [
    'https://app.zenstack.dev',
    'http://localhost:3000',
    'http://localhost:5173',
  ],

  advanced: {
    // Postman/curl send no Origin header at all, which better-auth rejects
    // with MISSING_OR_NULL_ORIGIN. Only relax this outside production so
    // real deployments still get the CSRF/origin protection.
    // TODO: remove once Postman requests set Origin via a collection level
    // header, or once a real frontend is calling this API instead.
    disableOriginCheck: process.env.NODE_ENV !== 'production',
  },
});
