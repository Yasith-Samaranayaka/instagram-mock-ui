import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to users data file
const USERS_FILE = path.join(__dirname, '../Data/users.json');

// Ensure users file exists
async function ensureUsersFile() {
    try {
        await fs.access(USERS_FILE);
    } catch {
        await fs.writeFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    }
}

// Load users from file
async function loadUsers() {
    await ensureUsersFile();
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

// Save users to file
async function saveUsers(usersData) {
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
}

// Find or create user
async function findOrCreateUser(profile) {
    const usersData = await loadUsers();

    // Check if user exists
    let user = usersData.users.find(u => u.googleId === profile.id);

    if (!user) {
        // Create new user
        user = {
            id: `google_${profile.id}`,
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            picture: profile.photos[0]?.value || '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        usersData.users.push(user);
        await saveUsers(usersData);
        console.log('✅ Created new user:', user.email);
    } else {
        // Update last login
        user.lastLogin = new Date().toISOString();
        await saveUsers(usersData);
        console.log('✅ User logged in:', user.email);
    }

    return user;
}

// Configure Passport Google Strategy
export function configurePassport() {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const user = await findOrCreateUser(profile);
                return done(null, user);
            } catch (error) {
                console.error('❌ Error in Google Strategy:', error);
                return done(error, null);
            }
        }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const usersData = await loadUsers();
            const user = usersData.users.find(u => u.id === id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
}
