// guild-war.js
// Logic for the main Guild War dashboard.
// Depends on utils.js and guild-war-core.js

let currentUser = null;
let selectedTeamId = 1;
let selectedForceId = null;

let guildWarState = null;

async function initGuildWarPage() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  buildNavbar(currentUser);
  
  guildWarState = await getGuildWarState();
  // guild-war-core.js's getGuildWarState now calls getForces() internally

  if (currentUser.role === 'war_leader' && currentUser.guildTeamId) {
    selectedTeamId = currentUser.guildTeamId;
    selectedForceId = getTeamForceId(selectedTeamId);
  } else if (currentUser.role === 'force_captain' && currentUser.guildForceId) {
    selectedForceId = currentUser.guildForceId;
    selectedTeamId = getTeamsForForce(guildWarState, selectedForceId)[0]?.id || selectedTeamId;
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

function getTeamsForForceLocal(forceId) {
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
    adminActions.innerHTML = ``;
    adminActions.style.display = 'none';
    if (endRoundBtn) endRoundBtn.style.display = 'none';
  } else {
    const team = guildWarState.teams.find((entry) => entry.id === getAccessibleTeamId());
    roleChip.textContent = 'War Leader Access';
    teamChip.textContent = team ? team.name : 'Own Team Only';
    adminActions.innerHTML = ``;
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

async function saveRoundEdit() {
  const value = Number(document.getElementById('edit-round-input').value);
  const error = document.getElementById('round-edit-error');

  if (value < 1) {
    error.textContent = 'Round must be 1 or higher.';
    error.style.display = 'flex';
    return;
  }

  guildWarState.currentRound = value;
  await saveGuildWarState(guildWarState);
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

async function executeEndRound() {
  exportReport('pdf');

  guildWarState.currentRound++;
  guildWarState.teams.forEach(team => {
    team.members.forEach(member => {
      member.achievedPoints = 0;
    });
  });

  await saveGuildWarState(guildWarState);
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
    const teams = getTeamsForForce(guildWarState, force.id);
    const accessible = isForceAccessible(force);
    const achieved = teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.achievedPoints || 0), 0), 0);
    const target = teams.reduce((teamSum, team) => teamSum + team.members.reduce((sum, member) => sum + Number(member.targetPoints || 0), 0), 0);

    const editBtn = isAdmin() 
      ? `<button class="btn-ghost" onclick="openEditForceModal('${force.id}', event)" title="Edit Force Logo" style="padding: 4px; margin-left: auto;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
         </button>` 
      : '';

    return `
      <article class="force-card ${selectedForceId === force.id ? 'selected' : ''} ${accessible ? '' : 'restricted'}" onclick="selectForce('${force.id}')" tabindex="0" onkeydown="handleForceCardKey(event, '${force.id}')">
        <div class="force-card-header">
           ${force.logo_url ? `<img src="${force.logo_url}" class="force-card-logo" onerror="handleImageError(this, '${force.name[0]}')">` : `<div class="force-logo-placeholder">${force.name[0]}</div>`}
           <span class="badge ${force.id === 'sukuna' ? 'badge-red' : force.id === 'alien' ? 'badge-blue' : 'badge-gold'}">${force.post}</span>
           ${editBtn}
        </div>
        <h3>${escapeHtml(force.name)}</h3>
        <p>Captaincy: ${escapeHtml(force.captain || 'Force Captain')}</p>
        <strong>${teams.length} Teams</strong>
        <p>${achieved} / ${target || 0} force points</p>
      </article>
    `;
  }).join('');
}

function openEditForceModal(forceId, event) {
  if (event) event.stopPropagation();
  const force = getForce(forceId);
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
    <button class="btn btn-primary btn-full" onclick="saveForceChanges('${forceId}')">Save Changes</button>
  `);
}

async function saveForceChanges(forceId) {
  const force = getForce(forceId);
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
    renderForceGrid();
  } catch (err) {
    error.textContent = err.message;
    error.style.display = 'flex';
  }
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
  const initials = team.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (team.imageData) {
    return `<img src="${team.imageData}" alt="${escapeHtml(team.name)} team picture" onerror="handleImageError(this, '${initials}')">`;
  }

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
  await saveGuildWarState(guildWarState);
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast('Team created successfully.', 'success');
}

function openEditTeamModal() {
  const editableTeams = isAdmin()
    ? guildWarState.teams
    : isForceCaptain()
    ? guildWarState.teams.filter((t) => t.forceId === currentUser.guildForceId)
    : currentUser.guildTeamId
    ? guildWarState.teams.filter((t) => t.id === currentUser.guildTeamId)
    : [];

  if (!editableTeams.length) {
    toast('No teams available to edit.', 'error');
    return;
  }

  // Pick the initially displayed team
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
      <div class="form-hint">${isAdmin() ? 'Admin can set one picture for each of the 13 team slots.' : 'You can update your team picture.'}</div>
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

  // Update force selector if present
  const forceSelect = document.getElementById('edit-team-force');
  if (forceSelect) forceSelect.value = team.forceId || guildWarForces[0].id;

  // Reset file input
  const picInput = document.getElementById('edit-team-picture');
  if (picInput) picInput.value = '';
}

async function clearEditedTeamPicture() {
  const teamId = Number(document.getElementById('edit-team-select')?.value || selectedTeamId);
  const team = guildWarState.teams.find((t) => t.id === teamId) || getSelectedTeam();
  team.imageData = '';
  await saveGuildWarState(guildWarState);
  renderAll();
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
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast('Team details updated.', 'success');
}

async function clearSelectedTeamPicture() {
  const team = getSelectedTeam();
  team.imageData = '';
  await saveGuildWarState(guildWarState);
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

async function addPlayerToSelectedTeam() {
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

  await saveGuildWarState(guildWarState);
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

async function setTeamTargets() {
  const team = getSelectedTeam();
  const value = Number(document.getElementById('team-target-input').value);
  const error = document.getElementById('target-error');

  if (value < 150) {
    error.textContent = 'Target points must be 150 or more.';
    error.style.display = 'flex';
    return;
  }

  team.members = team.members.map((member) => ({ ...member, targetPoints: value }));
  await saveGuildWarState(guildWarState);
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

function openUpdatePlayerPointsModal(memberId = null) {
  // For admin and force captains to update any player's points in their accessible teams
  const editableTeams = isAdmin()
    ? guildWarState.teams
    : isForceCaptain()
    ? guildWarState.teams.filter((t) => t.forceId === currentUser.guildForceId)
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
    ? guildWarState.teams
    : isForceCaptain()
    ? guildWarState.teams.filter((t) => t.forceId === currentUser.guildForceId)
    : [];
  const team = editableTeams.find((t) => t.id === teamId);
  const playerSelect = document.getElementById('update-points-player-select');

  if (!team || !team.members.length) {
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
    ? guildWarState.teams
    : isForceCaptain()
    ? guildWarState.teams.filter((t) => t.forceId === currentUser.guildForceId)
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
  renderAll();
  document.querySelector('.modal-close')?.click();
  toast(`${member.name}'s achieved points updated to ${newPoints}.`, 'success');
}

function openUpdateMyTeamPointsModal(memberId = null) {
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
      <h3>Update Team Achieved Points</h3>
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
      <div class="form-hint">War leaders can update achieved points for their team members.</div>
    </div>
    <button class="btn btn-primary btn-full" onclick="updatePlayerPoints()">Update Points</button>
  `);
}

function syncMemberPointDefaults() {
  const select = document.getElementById('points-player-select');
  const selected = select.options[select.selectedIndex];
  document.getElementById('points-value-input').value = selected.dataset.achieved || '0';
}

async function updatePlayerPoints() {
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
  await saveGuildWarState(guildWarState);
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

/**
 * Resets the entire Guild War state to the sample data.
 */
async function resetToSampleData() {
  if (!isAdmin()) return;
  
  if (!confirm('Are you sure you want to reset all team data to the 13 sample teams? This will overwrite your current progress.')) {
    return;
  }

  // fallbackGuildWarState is defined in guild-war-core.js
  guildWarState = JSON.parse(JSON.stringify(fallbackGuildWarState));
  
  await saveGuildWarState(guildWarState);
  renderAll();
  renderSessionAccess();
  
  toast('Data reset to 13 sample teams successfully.', 'success');
}
