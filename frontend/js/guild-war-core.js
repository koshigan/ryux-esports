/**
 * guild-war-core.js
 * Centralized data and logic for Guild War state management.
 */

const GUILD_WAR_STORAGE_KEY = 'ryuxGuildWarStateV2';

// Default hardcoded forces (used if DB is empty or as base)
const defaultGuildWarForces = [
  { id: 'sukuna', name: 'Sukuna & Co', post: 'Guild Leader', captain: 'Sukuna', teamIds: [1, 2, 3, 4, 5] },
  { id: 'alien', name: 'Alien Force', post: 'Acting Guild Leader', captain: 'Acting Guild Leader', teamIds: [6, 7, 8, 9] },
  { id: 'das', name: 'Das & Co', post: 'Supreme Leader', captain: 'Supreme Leader', teamIds: [10, 11, 12, 13] }
];

let guildWarForces = [...defaultGuildWarForces];

const fallbackGuildWarState = {
  currentRound: 1,
  teams: [
    {
      id: 1,
      name: 'Black Bulls',
      leaderName: 'Raiden',
      leaderEmail: 'blackbulls@ryuxesports.com',
      status: 'Active',
      forceId: 'sukuna',
      members: [
        { id: 1001, name: 'Raiden', role: 'War Leader', targetPoints: 220, achievedPoints: 185 },
        { id: 1002, name: 'Ares', role: 'Player', targetPoints: 180, achievedPoints: 172 },
        { id: 1003, name: 'Nova', role: 'Player', targetPoints: 175, achievedPoints: 160 },
        { id: 1004, name: 'Kairo', role: 'Player', targetPoints: 190, achievedPoints: 188 }
      ]
    },
    {
      id: 2,
      name: 'Red Reapers',
      leaderName: 'Vortex',
      leaderEmail: 'redreapers@ryuxesports.com',
      status: 'Active',
      forceId: 'sukuna',
      members: [
        { id: 2001, name: 'Vortex', role: 'War Leader', targetPoints: 210, achievedPoints: 194 },
        { id: 2002, name: 'Blaze', role: 'Player', targetPoints: 180, achievedPoints: 176 },
        { id: 2003, name: 'Shadow', role: 'Player', targetPoints: 170, achievedPoints: 159 },
        { id: 2004, name: 'Drift', role: 'Player', targetPoints: 165, achievedPoints: 151 }
      ]
    },
    {
      id: 3,
      name: 'Storm Hunters',
      leaderName: 'Cipher',
      leaderEmail: 'stormhunters@ryuxesports.com',
      status: 'Active',
      forceId: 'sukuna',
      members: [
        { id: 3001, name: 'Cipher', role: 'War Leader', targetPoints: 230, achievedPoints: 205 },
        { id: 3002, name: 'Echo', role: 'Player', targetPoints: 185, achievedPoints: 181 },
        { id: 3003, name: 'Frost', role: 'Player', targetPoints: 175, achievedPoints: 163 },
        { id: 3004, name: 'Trigger', role: 'Player', targetPoints: 178, achievedPoints: 174 }
      ]
    },
    {
      id: 4,
      name: 'Iron Phantoms',
      leaderName: 'Kage',
      leaderEmail: 'ironphantoms@ryuxesports.com',
      status: 'Active',
      forceId: 'sukuna',
      members: [
        { id: 4001, name: 'Kage', role: 'War Leader', targetPoints: 200, achievedPoints: 150 },
        { id: 4002, name: 'Slayer', role: 'Player', targetPoints: 180, achievedPoints: 140 }
      ]
    },
    {
      id: 5,
      name: 'Crimson Wolves',
      leaderName: 'Wolf',
      leaderEmail: 'crimsonwolves@ryuxesports.com',
      status: 'Active',
      forceId: 'sukuna',
      members: [
        { id: 5001, name: 'Wolf', role: 'War Leader', targetPoints: 220, achievedPoints: 190 },
        { id: 5002, name: 'Fang', role: 'Player', targetPoints: 180, achievedPoints: 160 }
      ]
    },
    {
      id: 6,
      name: 'Toxic Ravens',
      leaderName: 'Venom',
      leaderEmail: 'toxicravens@ryuxesports.com',
      status: 'Active',
      forceId: 'alien',
      members: [
        { id: 6001, name: 'Venom', role: 'War Leader', targetPoints: 200, achievedPoints: 170 },
        { id: 6002, name: 'Toxin', role: 'Player', targetPoints: 180, achievedPoints: 150 }
      ]
    },
    {
      id: 7,
      name: 'Royal Havoc',
      leaderName: 'King',
      leaderEmail: 'royalhavoc@ryuxesports.com',
      status: 'Active',
      forceId: 'alien',
      members: [
        { id: 7001, name: 'King', role: 'War Leader', targetPoints: 250, achievedPoints: 230 }
      ]
    },
    {
      id: 8,
      name: 'Silent Vipers',
      leaderName: 'Serpent',
      leaderEmail: 'silentvipers@ryuxesports.com',
      status: 'Active',
      forceId: 'alien',
      members: [
        { id: 8001, name: 'Serpent', role: 'War Leader', targetPoints: 200, achievedPoints: 180 }
      ]
    },
    {
      id: 9,
      name: 'Night Raiders',
      leaderName: 'Stalker',
      leaderEmail: 'nightraiders@ryuxesports.com',
      status: 'Active',
      forceId: 'alien',
      members: [
        { id: 9001, name: 'Stalker', role: 'War Leader', targetPoints: 200, achievedPoints: 190 }
      ]
    },
    {
      id: 10,
      name: 'Rift Titans',
      leaderName: 'Goliath',
      leaderEmail: 'rifttitans@ryuxesports.com',
      status: 'Active',
      forceId: 'das',
      members: [
        { id: 10001, name: 'Goliath', role: 'War Leader', targetPoints: 300, achievedPoints: 280 }
      ]
    },
    {
      id: 11,
      name: 'Omega Force',
      leaderName: 'Alpha',
      leaderEmail: 'omegaforce@ryuxesports.com',
      status: 'Active',
      forceId: 'das',
      members: [
        { id: 11001, name: 'Alpha', role: 'War Leader', targetPoints: 240, achievedPoints: 220 }
      ]
    },
    {
      id: 12,
      name: 'Inferno Unit',
      leaderName: 'Pyro',
      leaderEmail: 'infernounit@ryuxesports.com',
      status: 'Active',
      forceId: 'das',
      members: [
        { id: 12001, name: 'Pyro', role: 'War Leader', targetPoints: 220, achievedPoints: 200 }
      ]
    },
    {
      id: 13,
      name: 'Dragon Sentinels',
      leaderName: 'Draco',
      leaderEmail: 'dragonsentinels@ryuxesports.com',
      status: 'Active',
      forceId: 'das',
      members: [
        { id: 13001, name: 'Draco', role: 'War Leader', targetPoints: 260, achievedPoints: 240 }
      ]
    }
  ]
};

/**
 * Normalizes the state to ensure it has all required properties and preserves all teams.
 */
function normalizeGuildWarState(state) {
  const baseState = JSON.parse(JSON.stringify(fallbackGuildWarState));
  if (!state) return baseState;

  const normalized = {
    currentRound: Number(state.currentRound || 1),
    teams: []
  };

  const storedTeams = Array.isArray(state.teams) ? state.teams : [];
  const fallbackTeams = baseState.teams;

  const teamsMap = new Map();

  // 1. Start with fallback teams
  fallbackTeams.forEach(t => teamsMap.set(Number(t.id), { ...t }));

  // 2. Overwrite with stored teams (preserves additions and updates)
  storedTeams.forEach(t => {
    const id = Number(t.id);
    const existing = teamsMap.get(id) || {};
    teamsMap.set(id, {
      ...existing,
      ...t,
      id: id,
      forceId: t.forceId || existing.forceId || getDefaultForceId(id),
      members: Array.isArray(t.members) ? t.members : (existing.members || [])
    });
  });

  normalized.teams = Array.from(teamsMap.values()).sort((a, b) => a.id - b.id);
  
  return normalized;
}

function getDefaultForceId(teamId) {
  const force = guildWarForces.find((f) => f.teamIds && f.teamIds.includes(Number(teamId)));
  return force ? force.id : (guildWarForces[0] ? guildWarForces[0].id : 'sukuna');
}

async function getForces() {
  try {
    const dbForces = await api.get('/api/forces');
    if (dbForces && dbForces.length > 0) {
      // Create a fresh list starting with defaults
      const mergedForces = defaultGuildWarForces.map(df => {
        // Find if this default force exists in DB by name
        const dbMatch = dbForces.find(dbf => dbf.name.toLowerCase() === df.name.toLowerCase());
        if (dbMatch) {
          return {
            ...df,
            dbId: dbMatch.id, // Keep original DB integer ID
            logo_url: dbMatch.logo_url,
            description: dbMatch.description
          };
        }
        return df;
      });
      
      // Add any extra forces from DB that aren't in defaults
      dbForces.forEach(dbf => {
        if (!mergedForces.find(mf => mf.name.toLowerCase() === dbf.name.toLowerCase())) {
          mergedForces.push({
            id: String(dbf.id),
            dbId: dbf.id,
            name: dbf.name,
            post: dbf.description || 'Force',
            captain: 'Force Captain',
            logo_url: dbf.logo_url
          });
        }
      });
      
      guildWarForces = mergedForces;
      return guildWarForces;
    }
  } catch (error) {
    console.debug('[GuildWar] Failed to fetch dynamic forces:', error);
  }
  guildWarForces = [...defaultGuildWarForces];
  return guildWarForces;
}

async function getGuildWarState() {
  // Ensure forces are loaded first
  await getForces();

  // 1. Try Server
  try {
    const data = await api.get('/api/guild-war/state');
    if (data.state) return normalizeGuildWarState(data.state);
  } catch (error) {
    console.debug('[GuildWar] Server fetch failed, trying local storage...', error);
  }

  // 2. Try Local Storage
  try {
    const stored = localStorage.getItem(GUILD_WAR_STORAGE_KEY);
    if (stored) return normalizeGuildWarState(JSON.parse(stored));
  } catch (error) {
    console.debug('[GuildWar] Local storage parse failed', error);
  }

  // 3. Fallback to default
  return normalizeGuildWarState(null);
}

async function saveGuildWarState(state) {
  if (!state) return;
  
  // Save to Server (Aiven database)
  try {
    await api.post('/api/guild-war/state', state);
    console.log('[GuildWar] State saved to Aiven database');
  } catch (error) {
    console.error('[GuildWar] Server save failed:', error.message);
    // Silent fail - data won't be lost, just not synced
  }
}

function getForce(forceId) {
  return guildWarForces.find((f) => String(f.id) === String(forceId)) || guildWarForces[0];
}

function getTeamsForForce(state, forceId) {
  if (!state || !state.teams) return [];
  return state.teams.filter(t => String(t.forceId) === String(forceId));
}

function getTeamForceId(state, teamId) {
  const team = state.teams.find(t => t.id === Number(teamId));
  return team ? team.forceId : getDefaultForceId(teamId);
}

// Global error handler for images to fix broken icons
function handleImageError(img, initials = '') {
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent) {
    const span = document.createElement('span');
    span.textContent = initials || 'T';
    parent.appendChild(span);
  }
}
