import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../config/env';
import { prisma } from '../db/client';

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || `${googleId}@gmail.com`;
        const name = profile.displayName || profile.name?.givenName || 'Google User';
        const avatarUrl = profile.photos?.[0]?.value || null;

        // Upsert User in PostgreSQL
        const user = await prisma.user.upsert({
          where: { googleId },
          update: {
            name,
            avatarUrl,
            email,
          },
          create: {
            googleId,
            email,
            name,
            avatarUrl,
          },
        });

        // Ensure the user has at least one Sender attached (using Ethereal credentials)
        const existingSender = await prisma.sender.findFirst({
          where: { userId: user.id },
        });

        if (!existingSender) {
          await prisma.sender.create({
            data: {
              userId: user.id,
              name: `${user.name} (Ethereal)`,
              smtpUser: env.ETHEREAL_USER || user.email,
              smtpPass: env.ETHEREAL_PASS || 'ethereal-pass',
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Session Serialization: store only user.id in express-session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Session Deserialization: fetch full User entity by id from PostgreSQL on each request
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
