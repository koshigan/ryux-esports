const GUILD_WAR_STORAGE_KEY = 'ryuxGuildWarStateV2';

let currentUser = null;
let selectedTeamId = 1;
let selectedForceId = null;

const guildWarForces = [
  { id: 'sukuna', name: 'Sukuna & Co', post: 'Guild Leader', captain: 'Sukuna', teamIds: [1, 2, 3, 4, 5] },
  { id: 'alien', name: 'Alien Force', post: 'Acting Guild Leader', captain: 'Acting Guild Leader', teamIds: [6, 7, 8, 9] },
  { id: 'das', name: 'Das & Co', post: 'Supreme Leader', captain: 'Supreme Leader', teamIds: [10, 11, 12, 13] }
];

const fallbackGuildWarState = {
  teams: [
    {
      id: 1,
      name: 'Black Bulls',
      leaderName: 'Raiden',
      leaderEmail: 'blackbulls@ryuxesports.com',
      status: 'Active',
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
      members: [
        { id: 3001, name: 'Cipher', role: 'War Leader', targetPoints: 230, achievedPoints: 205 },
        { id: 3002, name: 'Echo', role: 'Player', targetPoints: 185, achievedPoints: 181 },
        { id: 3003, name: 'Frost', role: 'Player', targetPoints: 175, achievedPoints: 163 },
        { id: 3004, name: 'Trigger', role: 'Player', targetPoints: 178, achievedPoints: 174 }
      ]
    },
    { id: 4, name: 'Iron Phantoms', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 5, name: 'Crimson Wolves', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 6, name: 'Toxic Ravens', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 7, name: 'Royal Havoc', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 8, name: 'Silent Vipers', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 9, name: 'Night Raiders', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 10, name: 'Rift Titans', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 11, name: 'Omega Force', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 12, name: 'Inferno Unit', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] },
    { id: 13, name: 'Dragon Sentinels', leaderName: 'Awaiting Leader', leaderEmail: '-', status: 'Pending', members: [] }
  ]
};

function getGuildWarState() {
  try {
    const stored = localStorage.getItem(GUILD_WAR_STORAGE_KEY);
    if (stored) return normalizeGuildWarState(JSON.parse(stored));
  } catch (error) {
    console.debug('Failed to parse guild war state', error);
  }
  return normalizeGuildWarState(JSON.parse(JSON.stringify(fallbackGuildWarState)));
}

function normalizeGuildWarState(state) {
  const fallbackTeams = fallbackGuildWarState.teams;
  const teams = Array.isArray(state?.teams) ? state.teams : [];

  return {
    currentRound: state?.currentRound || 1,
    teams: fallbackTeams.map((fallbackTeam, index) => {
      const storedTeam = teams.find((team) => Number(team.id) === fallbackTeam.id) || teams[index] || {};
      return {
        ...fallbackTeam,
        ...storedTeam,
        id: Number(storedTeam.id || fallbackTeam.id),
        forceId: storedTeam.forceId || getDefaultForceId(fallbackTeam.id),
        imageData: storedTeam.imageData || fallbackTeam.imageData || '',
        members: Array.isArray(storedTeam.members) ? storedTeam.members : fallbackTeam.members
      };
    })
  };
}

function getDefaultForceId(teamId) {
  return guildWarForces.find((force) => force.teamIds.includes(Number(teamId)))?.id || guildWarForces[0].id;
}

function saveGuildWarState() {
  localStorage.setItem(GUILD_WAR_STORAGE_KEY, JSON.stringify(guildWarState));
}

let guildWarState = getGuildWarState();

async function initGuildWarPage() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  buildNavbar(currentUser);

  if (currentUser.role === 'war_leader' && currentUser.guildTeamId) {
    selectedTeamId = currentUser.guildTeamId;
    selectedForceId = getTeamForceId(selectedTeamId);
  } else if (currentUser.role === 'force_captain' && currentUser.guildForceId) {
    selectedForceId = currentUser.guildForceId;
    selectedTeamId = getTeamsForForce(selectedForceId)[0]?.id || selectedTeamId;
  }

  renderSessionAccess();
  renderAll();
}

function isAdmin() {
  return ['admin', 'guild_leader'].includes(currentUser?.role);
}

function isForceCaptain() {
  return currentUser?.role === 'force_captain';
}

function getSelectedTeam() {
  return guildWarState.teams.find((team) => team.id === selectedTeamId) || guildWarState.teams[0];
}

function getAccessibleTeamId() {
  return currentUser?.guildTeamId || null;
}

function isTeamAccessible(team) {
  return isAdmin() || (isForceCaptain() && team.forceId === currentUser.guildForceId) || team.id === getAccessibleTeamId();
}

function canEditTeam(team) {
  return isAdmin() || (isForceCaptain() && team.forceId === currentUser.guildForceId) || team.id === getAccessibleTeamId();
}

function canMoveTeamsAcrossForces() {
  return isAdmin();
}

function isForceAccessible(force) {
  return isAdmin() || (isForceCaptain() && force.id === currentUser.guildForceId) || guildWarState.teams.some((team) => team.forceId === force.id && team.id === getAccessibleTeamId());
}

function getTeamForceId(teamId) {
  return guildWarState.teams.find((team) => team.id === Number(teamId))?.forceId || getDefaultForceId(teamId);
}

function getTeamsForForce(forceId) {
  return guildWarState.teams.filter((team) => team.forceId === forceId);
}

function getForce(forceId) {
  return guildWarForces.find((force) => force.id === forceId) || guildWarForces[0];
}

function renderSessionAccess() {
  const roleChip = document.getElementById('session-role-chip');
  const teamChip = document.getElementById('session-team-chip');
  const adminActions = document.getElementById('admin-actions');
  const progressChip = document.getElementById('total-progress-chip');
  const roundChip = document.getElementById('round-info-chip');

  if (roundChip) roundChip.textContent = `Round ${guildWarState.currentRound} (Ends Sun 11PM)`;

  const totalAchieved = guildWarState.teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.achievedPoints || 0), 0), 0);
  const totalTarget = guildWarState.teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.targetPoints || 0), 0), 0);
  
  if (progressChip) {
    progressChip.textContent = `Total Progress: ${totalAchieved} / ${totalTarget}`;
    progressChip.style.display = 'inline-flex';
  }

  const reportActions = document.querySelector('.report-actions');
  let endRoundBtn = document.getElementById('end-round-btn');

  if (isAdmin()) {
    roleChip.textContent = currentUser.role === 'guild_leader' ? 'Guild Leader Access' : 'Admin Access';
    teamChip.textContent = 'All Teams';
    adminActions.innerHTML = `
      <button class="btn btn-primary" onclick="openCreateTeamModal()">Create Team</button>
      <button class="btn btn-secondary" onclick="openEditTeamModal()">Edit Team</button>
      <button class="btn btn-secondary" onclick="openPromoteLeaderModal()">Promote Leader</button>
      <button class="btn btn-secondary" onclick="openSetTargetModal()">Set Targets</button>
      <button class="btn btn-secondary" onclick="openAddPlayerModal()">Add Player</button>
      <button class="btn btn-secondary" onclick="openEditRoundModal()">Edit Round</button>
    `;
    adminActions.style.display = 'flex';

    if (!endRoundBtn && reportActions) {
      endRoundBtn = document.createElement('button');
      endRoundBtn.id = 'end-round-btn';
      endRoundBtn.className = 'btn btn-primary';
      endRoundBtn.style.marginRight = '10px';
      endRoundBtn.textContent = 'End Round';
      endRoundBtn.onclick = openEndRoundModal;
      reportActions.prepend(endRoundBtn);
    } else if (endRoundBtn) {
      endRoundBtn.style.display = 'inline-block';
    }

  } else if (isForceCaptain()) {
    const force = getForce(currentUser.guildForceId);
    roleChip.textContent = `${force.post} Access`;
    teamChip.textContent = force.name;
    adminActions.innerHTML = `
      <button class="btn btn-secondary" onclick="openEditTeamModal()">Edit Team</button>
      <button class="btn btn-secondary" onclick="openPromoteLeaderModal()">Promote Leader</button>
      <button class="btn btn-secondary" onclick="openSetTargetModal()">Set Targets</button>
      <button class="btn btn-secondary" onclick="openAddPlayerModal()">Add Player</button>
    `;
    adminActions.style.display = 'flex';
    if (endRoundBtn) endRoundBtn.style.display = 'none';
  } else {
    const team = guildWarState.teams.find((entry) => entry.id === getAccessibleTeamId());
    roleChip.textContent = 'War Leader Access';
    teamChip.textContent = team ? team.name : 'Own Team Only';
    adminActions.style.display = 'none';
    if (endRoundBtn) endRoundBtn.style.display = 'none';
  }
}

function openEditRoundModal() {
  if (!isAdmin()) return;
  showModal(`
    <div class="modal-header">
      <h3>Edit Round Info</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="round-edit-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Current Round Number</label>
      <input id="edit-round-input" type="number" min="1" value="${guildWarState.currentRound}" class="form-input" autofocus>
      <div class="form-hint">Updates the round displayed on the dashboard.</div>
    </div>
    <button class="btn btn-primary btn-full mb-16" onclick="saveRoundEdit()">Save Changes</button>
  `);
}

function saveRoundEdit() {
  const value = Number(document.getElementById('edit-round-input').value);
  const error = document.getElementById('round-edit-error');

  if (value < 1) {
    error.textContent = 'Round must be 1 or higher.';
    error.style.display = 'flex';
    return;
  }

  guildWarState.currentRound = value;
  saveGuildWarState();
  renderSessionAccess();
  
  document.querySelector('.modal-close')?.click();
  toast('Round details updated.', 'success');
}

function openEndRoundModal() {
  if (!isAdmin()) return;
  showModal(`
    <div class="modal-header">
      <h3>End Round ${guildWarState.currentRound}</h3>
      <button class="modal-close">X</button>
    </div>
    <div style="margin-bottom: 24px; line-height: 1.6;">
      <p>Ending the round will finalize all scores for <strong>Round ${guildWarState.currentRound}</strong>.</p>
      <p>A complete PDF report will be automatically generated and exported for your records.</p>
      <p style="margin-top: 10px;">Are you ready to start <strong>Round ${guildWarState.currentRound + 1}</strong>?</p>
      <p style="color: var(--accent); margin-top: 10px; font-weight: bold; border-left: 3px solid var(--accent); padding-left: 10px;">Warning: All players' achieved points will be reset to 0.</p>
    </div>
    <button class="btn btn-primary btn-full mb-16" onclick="executeEndRound()">Yes, End Round & Export PDF</button>
    <button class="btn btn-secondary btn-full modal-close" onclick="document.querySelector('.modal-close')?.click()">Cancel</button>
  `);
}

function executeEndRound() {
  exportReport('pdf');

  guildWarState.currentRound++;
  guildWarState.teams.forEach(team => {
    team.members.forEach(member => {
      member.achievedPoints = 0;
    });
  });

  saveGuildWarState();
  renderAll();
  renderSessionAccess();
  
  document.querySelector('.modal-close')?.click();
  toast(`Round ${guildWarState.currentRound - 1} ended. Round ${guildWarState.currentRound} started successfully!`, 'success');
}

function renderAll() {
  renderStats();
  renderForceGrid();
}

function renderStats() {
  const totalPlayers = guildWarState.teams.reduce((sum, team) => sum + team.members.length, 0);
  const activeWars = guildWarState.teams.filter((team) => team.status === 'Active').length;

  document.getElementById('total-teams').textContent = guildWarState.teams.length;
  document.getElementById('total-players').textContent = totalPlayers;
  document.getElementById('active-wars').textContent = activeWars;
}



function renderForceGrid() {
  const grid = document.getElementById('force-grid');
  if (!grid) return;
  
  grid.innerHTML = guildWarForces.map((force) => {
    const teams = getTeamsForForce(force.id);
    const accessible = isForceAccessible(force);
    const achieved = teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.achievedPoints || 0), 0), 0);
    const target = teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.targetPoints || 0), 0), 0);

    return `
      <article class="force-card ${selectedForceId === force.id ? 'selected' : ''} ${accessible ? '' : 'restricted'}" onclick="selectForce('${force.id}')" tabindex="0" onkeydown="handleForceCardKey(event, '${force.id}')">
        <span class="badge ${force.id === 'sukuna' ? 'badge-red' : force.id === 'alien' ? 'badge-blue' : 'badge-gold'}">${force.post}</span>
        <h3>${escapeHtml(force.name)}</h3>
        <p>Captaincy: ${escapeHtml(force.captain)}</p>
        <strong>${teams.length} Teams</strong>
        <p>${achieved} / ${target || 0} force points</p>
      </article>
    `;
  }).join('');
}



function renderTeamDetails() {
  // Removed per user request
}

function renderMemberPointGraph(team) {
  if (!team.members.length) {
    return '<div class="empty-state" style="padding: 12px 0;"><p>No point graph yet.</p></div>';
  }

  const maxPoints = Math.max(...team.members.map((member) => Number(member.achievedPoints || 0)), 1);
  return `
    <div>
      <h3>Member Point Graph</h3>
      <p>Based on achieved points.</p>
    </div>
    ${team.members.map((member) => {
      const achieved = Number(member.achievedPoints || 0);
      const width = Math.max(4, Math.round((achieved / maxPoints) * 100));
      return `
        <div class="chart-row">
          <div class="chart-name">${escapeHtml(member.name)}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div>
          <div class="chart-value">${achieved} pts</div>
        </div>`;
    }).join('')}
  `;
}

function renderTeamImage(team) {
  if (team.imageData) {
    return `<img src="${team.imageData}" alt="${escapeHtml(team.name)} team picture">`;
  }

  const initials = team.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return `<span>${escapeHtml(initials || `T${team.id}`)}</span>`;
}

function handleTeamCardKey(event, teamId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openTeamPage(teamId);
  }
}

function handleForceCardKey(event, forceId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectForce(forceId);
  }
}

function selectForce(forceId) {
  const force = getForce(forceId);
  if (!isForceAccessible(force)) {
    toast('You can only open your assigned force.', 'error');
    return;
  }

  window.location.href = '/guild-war/force/' + forceId;
}



function openTeamPage(teamId, event = null) {
  if (event) event.stopPropagation();
  const team = guildWarState.teams.find((entry) => entry.id === teamId);
  if (!team) return;

  if (!isTeamAccessible(team)) {
    toast('War leaders can only access their own team.', 'error');
    return;
  }

  window.location.href = `/guild-war/team/${team.id}`;
}

function viewTeam(teamId, event = null) {
  openTeamPage(teamId, event);
}

function openCreateTeamModal() {
  if (!isAdmin()) return;
  const defaultForceId = selectedForceId || guildWarForces[0].id;

  showModal(`
    <div class="modal-header">
      <h3>Create Team</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="team-create-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Team Name</label>
      <input id="team-name-input" class="form-input" placeholder="Enter team name" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">War Leader Name</label>
      <input id="team-leader-input" class="form-input" placeholder="Enter leader name">
    </div>
    <div class="form-group">
      <label class="form-label">War Leader Email</label>
      <input id="team-email-input" class="form-input" placeholder="leader@ryuxesports.com">
    </div>
    <div class="form-group">
      <label class="form-label">Force</label>
      <select id="team-force-input" class="form-select">
        ${guildWarForces.map((force) => `<option value="${force.id}" ${force.id === defaultForceId ? 'selected' : ''}>${escapeHtml(force.name)} - ${escapeHtml(force.post)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Team Picture (optional)</label>
      <input id="team-picture-input" type="file" accept="image/*" class="form-input">
    </div>
    <button class="btn btn-primary btn-full" onclick="createTeam()">Create Team</button>
  `);
}

async function createTeam() {
  const teamName = document.getElementById('team-name-input').value.trim();
  const leaderName = document.getElementById('team-leader-input').value.trim() || 'Awaiting Leader';
  const leaderEmail = document.getElementById('team-email-input').value.trim() || '-';
  const forceId = document.getElementById('team-force-input').value;
  const pictureInput = document.getElementById('team-picture-input');
  const error = document.getElementById('team-create-error');

  if (!teamName) {
    error.textContent = 'Team name is required.';
    error.style.display = 'flex';
    return;
  }
  
  let imageData = '';
  if (pictureInput?.files?.[0]) {
    try {
      imageData = await readImageAsDataUrl(pictureInput.files[0]);
    } catch (readError) {
      error.textContent = readError.message || 'Could not read that image.';
      error.style.display = 'flex';
      return;
    }
  }

  const emptySlot = guildWarState.teams.find((team) => team.members.length === 0 && team.leaderName === 'Awaiting Leader');
  const leaderMember = {
    id: Date.now(),
    name: leaderName,
    role: 'War Leader',
    targetPoints: 180,
    achievedPoints: 0
  };

  if (emptySlot) {
    emptySlot.name = teamName;
    emptySlot.leaderName = leaderName;
    emptySlot.leaderEmail = leaderEmail;
    emptySlot.forceId = forceId;
    emptySlot.status = 'Active';
    emptySlot.members = [leaderMember];
    emptySlot.imageData = imageData;
    selectedTeamId = emptySlot.id;
  } else {
    guildWarState.teams.push({
      id: guildWarState.teams.length + 1,
      name: teamName,
      leaderName,
      leaderEmail,
      forceId,
      status: 'Active',
      imageData,
      members: [leaderMember]
    });
    selectedTeamId = guildWarState.teams[guildWarState.teams.length - 1].id;
  }

  selectedForceId = forceId;
  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast('Team created successfully.', 'success');
}

function openEditTeamModal() {
  const editableTeams = isAdmin()
    ? guildWarState.teams
    : guildWarState.teams.filter((t) => canEditTeam(t));

  if (!editableTeams.length) {
    toast('No teams available to edit.', 'error');
    return;
  }

  // Pick the initially displayed team
  const initialTeam = editableTeams.find((t) => t.id === selectedTeamId) || editableTeams[0];

  const teamOptions = editableTeams
    .map((t) => `<option value="${t.id}" ${t.id === initialTeam.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
    .join('');

  const forceSelect = canMoveTeamsAcrossForces()
    ? `<div class="form-group">
        <label class="form-label">Force</label>
        <select id="edit-team-force" class="form-select">
          ${guildWarForces.map((force) => `<option value="${force.id}" ${initialTeam.forceId === force.id ? 'selected' : ''}>${escapeHtml(force.name)} - ${escapeHtml(force.post)}</option>`).join('')}
        </select>
        <div class="form-hint">Admin can move a team to another force.</div>
      </div>`
    : '';

  showModal(`
    <div class="modal-header">
      <h3>Edit Team Identity</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="team-edit-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Select Team</label>
      <select id="edit-team-select" class="form-select" onchange="onEditTeamChange()">
        ${teamOptions}
      </select>
    </div>
    <div id="edit-team-fields">
      ${buildEditTeamFields(initialTeam)}
    </div>
    ${forceSelect}
    <div class="form-group" id="edit-team-picture-group">
      <label class="form-label">Team Picture</label>
      <input id="edit-team-picture" type="file" accept="image/*" class="form-input">
      <div class="form-hint">Admin can set one picture for each of the 13 team slots.</div>
    </div>
    <div id="edit-team-remove-pic"></div>
    <button class="btn btn-primary btn-full" onclick="editSelectedTeam()">Save Changes</button>
  `);

  renderEditTeamRemovePicBtn(initialTeam);
}

function buildEditTeamFields(team) {
  return `
    <div class="form-group">
      <label class="form-label">Team Name</label>
      <input id="edit-team-name" class="form-input" value="${escapeHtml(team.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">War Leader Name</label>
      <input id="edit-leader-name" class="form-input" value="${escapeHtml(team.leaderName)}">
    </div>
    <div class="form-group">
      <label class="form-label">War Leader Email</label>
      <input id="edit-leader-email" class="form-input" value="${escapeHtml(team.leaderEmail)}">
    </div>
  `;
}

function renderEditTeamRemovePicBtn(team) {
  const container = document.getElementById('edit-team-remove-pic');
  if (!container) return;
  container.innerHTML = team.imageData
    ? `<button class="btn btn-secondary btn-full mb-16" onclick="clearEditedTeamPicture()">Remove Team Picture</button>`
    : '';
}

function onEditTeamChange() {
  const teamId = Number(document.getElementById('edit-team-select').value);
  const team = guildWarState.teams.find((t) => t.id === teamId);
  if (!team) return;

  document.getElementById('edit-team-fields').innerHTML = buildEditTeamFields(team);
  renderEditTeamRemovePicBtn(team);

  // Update force selector if present
  const forceSelect = document.getElementById('edit-team-force');
  if (forceSelect) forceSelect.value = team.forceId || guildWarForces[0].id;

  // Reset file input
  const picInput = document.getElementById('edit-team-picture');
  if (picInput) picInput.value = '';
}

function clearEditedTeamPicture() {
  const teamId = Number(document.getElementById('edit-team-select')?.value || selectedTeamId);
  const team = guildWarState.teams.find((t) => t.id === teamId) || getSelectedTeam();
  team.imageData = '';
  saveGuildWarState();
  renderAll();
  renderEditTeamRemovePicBtn(team);
  toast('Team picture removed.', 'success');
}
}

async function editSelectedTeam() {
  const team = getSelectedTeam();
  const name = document.getElementById('edit-team-name').value.trim();
  const leaderName = document.getElementById('edit-leader-name').value.trim();
  const leaderEmail = document.getElementById('edit-leader-email').value.trim() || '-';
  const pictureInput = document.getElementById('edit-team-picture');
  const forceInput = document.getElementById('edit-team-force');
  const error = document.getElementById('team-edit-error');

  if (!name || !leaderName) {
    error.textContent = 'Team and leader name are required.';
    error.style.display = 'flex';
    return;
  }

  team.name = name;
  team.leaderName = leaderName;
  team.leaderEmail = leaderEmail;
  if (forceInput) team.forceId = forceInput.value;
  selectedForceId = team.forceId;
  if (pictureInput?.files?.[0]) {
    try {
      team.imageData = await readImageAsDataUrl(pictureInput.files[0]);
    } catch (readError) {
      error.textContent = readError.message || 'Could not read that image.';
      error.style.display = 'flex';
      return;
    }
  }

  const leaderMember = team.members.find((member) => member.role === 'War Leader');
  if (leaderMember) leaderMember.name = leaderName;

  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast('Team details updated.', 'success');
}

function clearSelectedTeamPicture() {
  const team = getSelectedTeam();
  team.imageData = '';
  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast('Team picture removed.', 'success');
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('Could not load that image.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openAddPlayerModal() {
  const team = getSelectedTeam();
  if (!canEditTeam(team)) {
    toast('Only admin or the respective war leader can add players here.', 'error');
    return;
  }

  showModal(`
    <div class="modal-header">
      <h3>Add Player</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="player-create-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Team</label>
      <input class="form-input" value="${escapeHtml(team.name)}" disabled>
    </div>
    <div class="form-group">
      <label class="form-label">Player Name</label>
      <input id="player-name-input" class="form-input" placeholder="Enter player name" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Target Points</label>
      <input id="player-target-input" type="number" min="150" value="150" class="form-input">
    </div>
    <div class="form-group">
      <label class="form-label">Achieved Points</label>
      <input id="player-achieved-input" type="number" min="0" value="0" class="form-input">
    </div>
    <button class="btn btn-primary btn-full" onclick="addPlayerToSelectedTeam()">Add Player</button>
  `);
}

function addPlayerToSelectedTeam() {
  const team = getSelectedTeam();
  const name = document.getElementById('player-name-input').value.trim();
  const targetPoints = Number(document.getElementById('player-target-input').value);
  const achievedPoints = Number(document.getElementById('player-achieved-input').value);
  const error = document.getElementById('player-create-error');

  if (!name) {
    error.textContent = 'Player name is required.';
    error.style.display = 'flex';
    return;
  }

  if (targetPoints < 150) {
    error.textContent = 'Target points must be at least 150.';
    error.style.display = 'flex';
    return;
  }

  team.members.push({
    id: Date.now(),
    name,
    role: 'Player',
    targetPoints,
    achievedPoints
  });
  team.status = 'Active';

  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast(`Player added to ${team.name}.`, 'success');
}

function openPromoteLeaderModal() {
  const editableTeams = guildWarState.teams.filter((team) => canEditTeam(team));
  if (!editableTeams.length) return;
  const teamOptions = editableTeams.map((team) => `<option value="${team.id}" ${team.id === selectedTeamId ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');

  showModal(`
    <div class="modal-header">
      <h3>Promote Leader</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="promote-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Select Team</label>
      <select id="promote-team-select" class="form-select" onchange="fillLeaderCandidates()">${teamOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Select Member</label>
      <select id="promote-player-select" class="form-select"></select>
    </div>
    <button class="btn btn-primary btn-full" onclick="promoteLeader()">Promote to War Leader</button>
  `);

  fillLeaderCandidates();
}

function fillLeaderCandidates() {
  const teamId = Number(document.getElementById('promote-team-select').value);
  const team = guildWarState.teams.find((entry) => entry.id === teamId);
  const playerSelect = document.getElementById('promote-player-select');

  playerSelect.innerHTML = team.members.length
    ? team.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)} (${member.role})</option>`).join('')
    : '<option value="">No members in this team</option>';
}

function promoteLeader() {
  const error = document.getElementById('promote-error');
  const teamId = Number(document.getElementById('promote-team-select').value);
  const playerId = Number(document.getElementById('promote-player-select').value);
  const team = guildWarState.teams.find((entry) => entry.id === teamId);
  const nextLeader = team.members.find((entry) => entry.id === playerId);

  if (!nextLeader) {
    error.textContent = 'Choose a member to promote.';
    error.style.display = 'flex';
    return;
  }

  team.members.forEach((member) => {
    member.role = member.id === playerId ? 'War Leader' : 'Player';
  });
  team.leaderName = nextLeader.name;

  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast(`War leader updated for ${team.name}.`, 'success');
}

function openSetTargetModal() {
  const team = getSelectedTeam();
  if (!canEditTeam(team)) return;

  showModal(`
    <div class="modal-header">
      <h3>Set Team Target</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="target-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Team</label>
      <input class="form-input" value="${escapeHtml(team.name)}" disabled>
    </div>
    <div class="form-group">
      <label class="form-label">Target Points For All Members</label>
      <input id="team-target-input" type="number" min="150" value="180" class="form-input">
    </div>
    <button class="btn btn-primary btn-full" onclick="setTeamTargets()">Apply Target</button>
  `);
}

function setTeamTargets() {
  const team = getSelectedTeam();
  const value = Number(document.getElementById('team-target-input').value);
  const error = document.getElementById('target-error');

  if (value < 150) {
    error.textContent = 'Target points must be 150 or more.';
    error.style.display = 'flex';
    return;
  }

  team.members = team.members.map((member) => ({ ...member, targetPoints: value }));
  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast(`Target points updated for ${team.name}.`, 'success');
}

function openUpdatePointsModal(memberId = null) {
  const team = getSelectedTeam();
  if (!canEditTeam(team)) {
    toast('Only admin or that team war leader can update achieved points.', 'error');
    return;
  }

  const targetMember = memberId
    ? team.members.find((member) => member.id === memberId)
    : team.members[0];

  if (!targetMember) {
    toast('Add a member before updating achieved points.', 'info');
    return;
  }

  showModal(`
    <div class="modal-header">
      <h3>Update Achieved Points</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="points-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Member</label>
      <select id="points-player-select" class="form-select" onchange="syncMemberPointDefaults()">
        ${team.members.map((member) => `
          <option value="${member.id}" data-achieved="${member.achievedPoints}" ${member.id === targetMember.id ? 'selected' : ''}>
            ${escapeHtml(member.name)} (${member.role}) - Target ${member.targetPoints}
          </option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Achieved Points</label>
      <input id="points-value-input" type="number" min="0" value="${targetMember.achievedPoints}" class="form-input">
      <div class="form-hint">War leaders can only update achieved points for their own team members.</div>
    </div>
    <button class="btn btn-primary btn-full" onclick="updatePlayerPoints()">Update Points</button>
  `);
}

function syncMemberPointDefaults() {
  const select = document.getElementById('points-player-select');
  const selected = select.options[select.selectedIndex];
  document.getElementById('points-value-input').value = selected.dataset.achieved || '0';
}

function updatePlayerPoints() {
  const team = getSelectedTeam();
  const memberId = Number(document.getElementById('points-player-select').value);
  const newPoints = Number(document.getElementById('points-value-input').value);
  const error = document.getElementById('points-error');
  const member = team.members.find((entry) => entry.id === memberId);

  if (!member) {
    error.textContent = 'Member not found.';
    error.style.display = 'flex';
    return;
  }

  if (newPoints < 0) {
    error.textContent = 'Achieved points cannot be negative.';
    error.style.display = 'flex';
    return;
  }

  member.achievedPoints = newPoints;
  saveGuildWarState();
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast(`${member.name}'s achieved points updated.`, 'success');
}

function exportReport(type) {
  const rows = guildWarState.teams.flatMap((team) => {
    if (!team.members.length) {
      return [{
        team: team.name,
        leader: team.leaderName,
        email: team.leaderEmail,
        member: 'No members',
        role: '-',
        target: '',
        achieved: '',
        status: team.status
      }];
    }

    return team.members.map((member) => ({
      team: team.name,
      leader: team.leaderName,
      email: team.leaderEmail,
      member: member.name,
      role: member.role,
      target: member.targetPoints,
      achieved: member.achievedPoints,
      status: team.status
    }));
  });

  if (type === 'excel') {
    const header = 'Team,War Leader,Leader Email,Member,Role,Target Points,Achieved Points,Status\n';
    const body = rows.map((row) => [row.team, row.leader, row.email, row.member, row.role, row.target, row.achieved, row.status].join(',')).join('\n');
    downloadFile('ryux-guild-war-report.csv', `${header}${body}`, 'text/csv');
    toast('Excel-ready report exported.', 'success');
    return;
  }

  if (type === 'word') {
    const html = `
      <html><body>
      <h1>RYUX ESPORTS - Guild War Weekly Report</h1>
      <table border="1" cellspacing="0" cellpadding="8">
        <tr><th>Team</th><th>War Leader</th><th>Leader Email</th><th>Member</th><th>Role</th><th>Target</th><th>Achieved</th><th>Status</th></tr>
        ${rows.map((row) => `<tr><td>${escapeHtml(row.team)}</td><td>${escapeHtml(row.leader)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.member)}</td><td>${escapeHtml(row.role)}</td><td>${row.target}</td><td>${row.achieved}</td><td>${row.status}</td></tr>`).join('')}
      </table>
      </body></html>`;
    downloadFile('ryux-guild-war-report.doc', html, 'application/msword');
    toast('Word report exported.', 'success');
    return;
  }

  const printable = window.open('', '_blank', 'width=1000,height=700');
  printable.document.write(`
    <html>
      <head>
        <title>RYUX ESPORTS - Guild War PDF</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f3f3f3; }
        </style>
      </head>
      <body>
        <h1>RYUX ESPORTS - Guild War Weekly Report</h1>
        <table>
          <tr><th>Team</th><th>War Leader</th><th>Leader Email</th><th>Member</th><th>Role</th><th>Target</th><th>Achieved</th><th>Status</th></tr>
          ${rows.map((row) => `<tr><td>${escapeHtml(row.team)}</td><td>${escapeHtml(row.leader)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.member)}</td><td>${escapeHtml(row.role)}</td><td>${row.target}</td><td>${row.achieved}</td><td>${row.status}</td></tr>`).join('')}
        </table>
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
  toast('PDF print view opened.', 'success');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

initGuildWarPage();
