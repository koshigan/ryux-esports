// guild-war-force.js
// Logic for the force-specific Guild War view.
// Depends on utils.js and guild-war-core.js

let currentUser = null;
let currentForce = null;
let forceTeams = [];
let guildWarState = null;
let selectedTeamId = null;
let selectedForceId = null;

function isAdmin() {
  return ['admin', 'guild_leader'].includes(currentUser?.role);
}

function isForceCaptain() {
  return currentUser?.role === 'force_captain';
}

function canManageForce() {
  if (isAdmin()) return true;
  if (isForceCaptain() && currentForce.id === currentUser.guildForceId) return true;
  return false;
}

function getSelectedTeam() {
  if (!selectedTeamId || forceTeams.length === 0) return forceTeams[0];
  return forceTeams.find((team) => team.id === selectedTeamId) || forceTeams[0];
}

function canEditTeam(team) {
  return isAdmin() || (isForceCaptain() && team.forceId === currentUser.guildForceId);
}

async function initForcePage() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  buildNavbar(currentUser);

  guildWarState = await getGuildWarState();

  const pathParts = window.location.pathname.split('/');
  const forceId = pathParts[pathParts.length - 1];

  currentForce = getForce(forceId);
  selectedForceId = forceId;
  
  if (!currentForce) {
    toast('Force not found.', 'error');
    setTimeout(() => window.location.href = '/guild-war', 2000);
    return;
  }

  // Find teams for this force
  forceTeams = getTeamsForForce(guildWarState, forceId);

  if (forceTeams.length > 0) {
    selectedTeamId = forceTeams[0].id;
  }

  renderForceInfo();
  renderForceActions();
  renderTeams();
}

function renderForceActions() {
  const actionsContainer = document.getElementById('force-actions');
  
  if (!canManageForce() || forceTeams.length === 0) {
    actionsContainer.style.display = 'none';
    return;
  }

  actionsContainer.innerHTML = `
    <button class="btn btn-primary" onclick="openEditForceModal()">Edit Force Logo</button>
    <button class="btn btn-secondary" onclick="openEditTeamModal()">Edit Team</button>
    <button class="btn btn-secondary" onclick="openPromoteLeaderModal()">Promote Leader</button>
    <button class="btn btn-secondary" onclick="openSetTargetModal()">Set Targets</button>
    <button class="btn btn-secondary" onclick="openAddPlayerModal()">Add Player</button>
    <button class="btn btn-secondary" onclick="openUpdatePlayerPointsModal()">Update Player Points</button>
  `;
  actionsContainer.style.display = 'flex';
}

function renderForceInfo() {
  document.getElementById('force-name').textContent = currentForce.name;
  document.getElementById('force-captain').textContent = `Captaincy: ${currentForce.captain || 'Force Captain'} (${currentForce.post || 'Force'})`;
  
  const logoContainer = document.getElementById('force-logo-container');
  if (logoContainer) {
    if (currentForce.logo_url) {
      logoContainer.innerHTML = `<img src="${currentForce.logo_url}" class="force-card-logo" style="width: 80px; height: 80px; border-radius: 12px; border: 2px solid var(--accent);" onerror="handleImageError(this, '${currentForce.name[0]}')">`;
    } else {
      logoContainer.innerHTML = `<div class="force-logo-placeholder" style="width: 80px; height: 80px; border-radius: 12px; font-size: 2rem;">${currentForce.name[0]}</div>`;
    }
  }

  const badge = document.getElementById('force-badge');
  badge.textContent = currentForce.post || 'Force';
  badge.className = 'eyebrow';
}

function renderTeamImage(team) {
  const initials = team.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  if (team.imageData) {
    return `<img src="${team.imageData}" alt="${escapeHtml(team.name)} team picture" onerror="handleImageError(this, '${initials}')">`;
  }
  return `<span>${escapeHtml(initials || `T${team.id}`)}</span>`;
}

function renderTeams() {
  const grid = document.getElementById('teams-grid');
  
  if (forceTeams.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No teams assigned to this force yet.</p></div>';
    return;
  }

  grid.innerHTML = forceTeams.map(team => {
    const achieved = team.members ? team.members.reduce((sum, member) => sum + Number(member.achievedPoints || 0), 0) : 0;
    const target = team.members ? team.members.reduce((sum, member) => sum + Number(member.targetPoints || 0), 0) : 0;
    const statusClass = team.status === 'Active' ? 'badge-green' : 'badge-muted';

    return `
      <div class="team-card" onclick="selectTeam(${team.id}); window.location.href='/guild-war/team/${team.id}'">
        <div class="team-card-image">${renderTeamImage(team)}</div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
          <span class="badge ${statusClass}">${team.status}</span>
          <span class="badge badge-muted">Slot ${team.id}</span>
        </div>
        <h3 style="margin-bottom: 4px;">${escapeHtml(team.name)}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 4px;">War Leader: ${escapeHtml(team.leaderName)}</p>
        <p style="font-weight: bold; color: #fff;">Progress: ${achieved} / ${target}</p>
      </div>
    `;
  }).join('');
}

function selectTeam(teamId) {
  selectedTeamId = teamId;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

// Modal Functions

function openEditTeamModal() {
  const editableTeams = isAdmin()
    ? forceTeams
    : isForceCaptain()
    ? forceTeams.filter((t) => t.forceId === currentUser.guildForceId)
    : [];

  if (!editableTeams.length) {
    toast('No teams available to edit.', 'error');
    return;
  }

  const initialTeam = editableTeams.find((t) => t.id === selectedTeamId) || editableTeams[0];

  const teamOptions = editableTeams
    .map((t) => `<option value="${t.id}" ${t.id === initialTeam.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
    .join('');

  const forceSelect = isAdmin()
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
      <div class="form-hint">${isAdmin() ? 'Admin can set one picture for each team.' : 'You can update your team picture.'}</div>
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
    <div class="divider"></div>
    <h4 class="mb-8">Edit Players</h4>
    <div id="edit-team-members-list">
      ${team.members.map(member => `
        <div class="form-group">
          <label class="form-label">${member.role}</label>
          <input class="form-input edit-player-name" data-id="${member.id}" value="${escapeHtml(member.name)}">
        </div>
      `).join('')}
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

  const forceSelect = document.getElementById('edit-team-force');
  if (forceSelect) forceSelect.value = team.forceId || guildWarForces[0].id;

  const picInput = document.getElementById('edit-team-picture');
  if (picInput) picInput.value = '';
}

async function clearEditedTeamPicture() {
  const teamId = Number(document.getElementById('edit-team-select')?.value || selectedTeamId);
  const team = guildWarState.teams.find((t) => t.id === teamId) || getSelectedTeam();
  team.imageData = '';
  await saveGuildWarState(guildWarState);
  renderTeams();
  renderEditTeamRemovePicBtn(team);
  toast('Team picture removed.', 'success');
}

async function editSelectedTeam() {
  const teamSelectEl = document.getElementById('edit-team-select');
  const teamId = teamSelectEl ? Number(teamSelectEl.value) : selectedTeamId;
  const team = guildWarState.teams.find((t) => t.id === teamId) || getSelectedTeam();
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

  // Update player names
  const playerInputs = document.querySelectorAll('.edit-player-name');
  playerInputs.forEach(input => {
    const memberId = Number(input.dataset.id);
    const member = team.members.find(m => m.id === memberId);
    if (member) {
      member.name = input.value.trim() || member.name;
    }
  });

  await saveGuildWarState(guildWarState);
  renderTeams();
  document.querySelector('.modal-close')?.click();
  toast('Team details updated.', 'success');
}

function openEditForceModal() {
  const force = currentForce;
  if (!force) return;

  showModal(`
    <div class="modal-header">
      <h3>Edit Force: ${escapeHtml(force.name)}</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="force-edit-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Force Name</label>
      <input id="edit-force-name" class="form-input" value="${escapeHtml(force.name)}" ${force.dbId ? '' : 'disabled'}>
      ${force.dbId ? '' : '<div class="form-hint">Default forces can only have their logos updated here.</div>'}
    </div>
    <div class="form-group">
      <label class="form-label">Force Logo</label>
      <input id="edit-force-logo" type="file" accept="image/*" class="form-input">
      <div class="form-hint">Upload a custom logo for this force.</div>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveForceChanges()">Save Changes</button>
  `);
}

async function saveForceChanges() {
  const force = currentForce;
  const name = document.getElementById('edit-force-name').value.trim();
  const logoInput = document.getElementById('edit-force-logo');
  const error = document.getElementById('force-edit-error');

  if (!name) {
    error.textContent = 'Name is required.';
    error.style.display = 'flex';
    return;
  }

  try {
    let dbId = force.dbId;

    // If force doesn't exist in DB yet, create it
    if (!dbId) {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', force.post);
      
      const res = await fetch('/api/forces', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create force in database');
      dbId = data.id;
    }

    // Update name if changed and force is in DB
    if (dbId && name !== force.name) {
      const res = await fetch(`/api/forces/${dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: force.post }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update force name');
    }

    // Update logo if provided
    if (logoInput.files?.[0]) {
      const formData = new FormData();
      formData.append('logo', logoInput.files[0]);

      const res = await fetch(`/api/forces/${dbId}/logo`, {
        method: 'PUT',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to upload logo');
    }

    toast('Force updated successfully. Refreshing...', 'success');
    document.querySelector('.modal-close')?.click();
    
    // Reload forces and re-render
    await getForces();
    currentForce = getForce(selectedForceId);
    renderForceInfo();
  } catch (err) {
    error.textContent = err.message;
    error.style.display = 'flex';
  }
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
  const editableTeams = forceTeams.filter(t => canEditTeam(t));

  if (!editableTeams.length) {
    toast('No teams available to add players to.', 'error');
    return;
  }

  const initialTeam = editableTeams.find((t) => t.id === selectedTeamId) || editableTeams[0];

  showModal(`
    <div class="modal-header">
      <h3>Add Player</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="player-create-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Select Team</label>
      <select id="add-player-team-select" class="form-select">
        ${editableTeams.map((t) => `<option value="${t.id}" ${t.id === initialTeam.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
      </select>
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

async function addPlayerToSelectedTeam() {
  const teamId = Number(document.getElementById('add-player-team-select').value);
  const team = forceTeams.find(t => t.id === teamId);
  if (!team) return;
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

  await saveGuildWarState(guildWarState);
  renderTeams();
  document.querySelector('.modal-close')?.click();
  toast(`Player added to ${team.name}.`, 'success');
}

function openPromoteLeaderModal() {
  const editableTeams = forceTeams.filter((team) => canEditTeam(team));
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

async function promoteLeader() {
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

  await saveGuildWarState(guildWarState);
  renderTeams();
  document.querySelector('.modal-close')?.click();
  toast(`War leader updated for ${team.name}.`, 'success');
}

function openSetTargetModal() {
  const editableTeams = forceTeams.filter(t => canEditTeam(t));

  if (!editableTeams.length) {
    toast('No teams available to set targets.', 'error');
    return;
  }

  const initialTeam = editableTeams.find((t) => t.id === selectedTeamId) || editableTeams[0];

  showModal(`
    <div class="modal-header">
      <h3>Set Team & Player Targets</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="target-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Select Team</label>
      <select id="target-team-select" class="form-select" onchange="onTargetTeamChange()">
        ${editableTeams.map((t) => `<option value="${t.id}" ${t.id === initialTeam.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div id="team-players-targets-list">
      ${buildPlayersTargetFields(initialTeam)}
    </div>
    <button class="btn btn-primary btn-full" onclick="setTeamTargets()">Save All Targets</button>
  `);
}

function buildPlayersTargetFields(team) {
  if (!team.members.length) return '<p class="empty-state">No players in this team.</p>';
  
  return `
    <div class="divider"></div>
    <p class="mb-16">Set target points for each player (min 150):</p>
    ${team.members.map(member => `
      <div class="form-group">
        <label class="form-label">${member.name} (${member.role})</label>
        <input type="number" min="150" class="form-input player-target-input" data-id="${member.id}" value="${member.targetPoints || 150}">
      </div>
    `).join('')}
  `;
}

function onTargetTeamChange() {
  const teamId = Number(document.getElementById('target-team-select').value);
  const team = forceTeams.find(t => t.id === teamId);
  if (team) {
    document.getElementById('team-players-targets-list').innerHTML = buildPlayersTargetFields(team);
  }
}

async function setTeamTargets() {
  const teamId = Number(document.getElementById('target-team-select').value);
  const team = forceTeams.find(t => t.id === teamId);
  const error = document.getElementById('target-error');

  if (!team) return;

  const targetInputs = document.querySelectorAll('.player-target-input');
  let hasError = false;

  targetInputs.forEach(input => {
    const val = Number(input.value);
    if (val < 150) {
      hasError = true;
    }
  });

  if (hasError) {
    error.textContent = 'All target points must be 150 or more.';
    error.style.display = 'flex';
    return;
  }

  targetInputs.forEach(input => {
    const memberId = Number(input.dataset.id);
    const member = team.members.find(m => m.id === memberId);
    if (member) {
      member.targetPoints = Number(input.value);
    }
  });
  await saveGuildWarState(guildWarState);
  renderTeams();
  document.querySelector('.modal-close')?.click();
  toast(`Target points updated for ${team.name}.`, 'success');
}

function openUpdatePlayerPointsModal(memberId = null) {
  // For admin and force captains to update any player's points in their accessible teams
  const editableTeams = isAdmin()
    ? forceTeams
    : isForceCaptain()
    ? forceTeams.filter((t) => t.forceId === currentUser.guildForceId)
    : [];

  if (!editableTeams.length) {
    toast('No teams available to manage.', 'error');
    return;
  }

  showModal(`
    <div class="modal-header">
      <h3>Update Player Achieved Points</h3>
      <button class="modal-close">X</button>
    </div>
    <div id="player-points-error" class="alert alert-error mb-16" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Select Team</label>
      <select id="update-points-team-select" class="form-select" onchange="updatePlayerPointsTeamOptions()">
        ${editableTeams.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Select Player</label>
      <select id="update-points-player-select" class="form-select" onchange="syncPlayerPointDefaults()">
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Achieved Points</label>
      <input id="player-points-value-input" type="number" min="0" value="0" class="form-input">
    </div>
    <button class="btn btn-primary btn-full" onclick="updateIndividualPlayerPoints()">Save Points</button>
  `);

  updatePlayerPointsTeamOptions();
}

function updatePlayerPointsTeamOptions() {
  const teamId = Number(document.getElementById('update-points-team-select').value);
  const editableTeams = isAdmin()
    ? forceTeams
    : isForceCaptain()
    ? forceTeams.filter((t) => t.forceId === currentUser.guildForceId)
    : [];
  const team = editableTeams.find((t) => t.id === teamId);
  const playerSelect = document.getElementById('update-points-player-select');

  if (!team?.members?.length) {
    playerSelect.innerHTML = '<option value="">No players in this team</option>';
    return;
  }

  playerSelect.innerHTML = team.members.map((member) => `
    <option value="${member.id}" data-achieved="${member.achievedPoints}">
      ${escapeHtml(member.name)} (${member.role}) - Target ${member.targetPoints}
    </option>
  `).join('');

  syncPlayerPointDefaults();
}

function syncPlayerPointDefaults() {
  const select = document.getElementById('update-points-player-select');
  const selected = select.options[select.selectedIndex];
  document.getElementById('player-points-value-input').value = selected.dataset.achieved || '0';
}

async function updateIndividualPlayerPoints() {
  const teamId = Number(document.getElementById('update-points-team-select').value);
  const editableTeams = isAdmin()
    ? forceTeams
    : isForceCaptain()
    ? forceTeams.filter((t) => t.forceId === currentUser.guildForceId)
    : [];
  const team = editableTeams.find((t) => t.id === teamId);
  const memberId = Number(document.getElementById('update-points-player-select').value);
  const newPoints = Number(document.getElementById('player-points-value-input').value);
  const error = document.getElementById('player-points-error');

  if (!team) {
    error.textContent = 'Team not found.';
    error.style.display = 'flex';
    return;
  }

  const member = team.members.find((m) => m.id === memberId);
  if (!member) {
    error.textContent = 'Player not found.';
    error.style.display = 'flex';
    return;
  }

  if (newPoints < 0) {
    error.textContent = 'Achieved points cannot be negative.';
    error.style.display = 'flex';
    return;
  }

  member.achievedPoints = newPoints;
  await saveGuildWarState(guildWarState);
  renderTeams();
  document.querySelector('.modal-close')?.click();
  toast(`${member.name}'s achieved points updated to ${newPoints}.`, 'success');
}

initForcePage();
