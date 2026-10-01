(() => {
  'use strict';

  const cfg = window.SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(cfg.url || '').trim();
  const SUPABASE_KEY = String(cfg.key || '').trim();
  const DEPARTMENT_SLUG = String(cfg.departmentSlug || '').trim().toLowerCase();

  const byId = id => document.getElementById(id);
  const setText = (id, value) => {
    const el = byId(id);
    if (el) el.textContent = value ?? '';
  };

  const show = (id, visible) => {
    const el = byId(id);
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
    el.classList.toggle('hidden', !visible);
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));

  const fmt = value => Number(value ?? 0).toFixed(1);

  let client = null;
  let departmentId = null;
  let editingId = null;
  let groups = [];
  let checkingSession = false;

  function setStatus(message, type = 'info') {
    const el = byId('adminStatus');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.type = type;
    el.style.color = type === 'error' ? '#ff8298' : '#8eeeff';
  }

  function setLoginError(message) {
    setText('loginError', message || '');
  }

  function resetForm() {
    const form = byId('groupForm');
    if (form) form.reset();
    editingId = null;
    setText('saveBtn', 'Add group');
  }

  function renderGroups() {
    const tbody = byId('rows');
    if (!tbody) return;

    if (!groups.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-row">No groups have been added yet.</td></tr>';
      return;
    }

    tbody.innerHTML = groups.map(g => `
      <tr>
        <td>${esc(g.group_name)}</td>
        <td>${fmt(g.attendance)}%</td>
        <td>${fmt(g.punctuality)}%</td>
        <td class="actions">
          <button type="button" class="edit" data-id="${esc(g.id)}">Edit</button>
          <button type="button" class="delete" data-id="${esc(g.id)}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => editGroup(btn.dataset.id));
    });

    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteGroup(btn.dataset.id));
    });
  }

  async function loadGroups() {
    if (!client || departmentId == null) return false;

    setStatus('Loading groups…');

    const { data, error } = await client
      .from('attendance_groups')
      .select('id,department_id,group_name,attendance,punctuality,updated_at')
      .eq('department_id', departmentId)
      .order('group_name', { ascending: true });

    if (error) {
      console.error('loadGroups', error);
      groups = [];
      renderGroups();
      setStatus(`Could not load groups: ${error.message}`, 'error');
      return false;
    }

    groups = data || [];
    renderGroups();
    setStatus(`${groups.length} group${groups.length === 1 ? '' : 's'} loaded.`);
    return true;
  }

  function editGroup(id) {
    const g = groups.find(row => String(row.id) === String(id));
    if (!g) return;

    editingId = g.id;
    const name = byId('groupName');
    const att = byId('attendance');
    const punct = byId('punctuality');

    if (name) name.value = g.group_name ?? '';
    if (att) att.value = g.attendance ?? '';
    if (punct) punct.value = g.punctuality ?? '';

    setText('saveBtn', 'Update group');
    setStatus(`Editing ${g.group_name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteGroup(id) {
    const g = groups.find(row => String(row.id) === String(id));
    if (!g) return;

    if (!window.confirm(`Delete ${g.group_name}?`)) return;

    setStatus(`Deleting ${g.group_name}…`);

    const { error } = await client
      .from('attendance_groups')
      .delete()
      .eq('id', id)
      .eq('department_id', departmentId);

    if (error) {
      console.error('deleteGroup', error);
      setStatus(`Delete failed: ${error.message}`, 'error');
      return;
    }

    if (String(editingId) === String(id)) resetForm();
    await loadGroups();
  }

  async function saveGroup(event) {
    event.preventDefault();

    const name = String(byId('groupName')?.value || '').trim();
    const attendance = Number(byId('attendance')?.value);
    const punctuality = Number(byId('punctuality')?.value);

    if (!name) {
      setStatus('Please enter a group name.', 'error');
      return;
    }

    if (!Number.isFinite(attendance) || attendance < 0 || attendance > 100) {
      setStatus('Attendance must be between 0 and 100.', 'error');
      return;
    }

    if (!Number.isFinite(punctuality) || punctuality < 0 || punctuality > 100) {
      setStatus('Punctuality must be between 0 and 100.', 'error');
      return;
    }

    setStatus(editingId ? 'Updating group…' : 'Adding group…');

    const result = editingId
      ? await client
          .from('attendance_groups')
          .update({ group_name: name, attendance, punctuality })
          .eq('id', editingId)
          .eq('department_id', departmentId)
      : await client
          .from('attendance_groups')
          .insert({
            department_id: departmentId,
            group_name: name,
            attendance,
            punctuality
          });

    if (result.error) {
      console.error('saveGroup', result.error);
      setStatus(`Save failed: ${result.error.message}`, 'error');
      return;
    }

    resetForm();
    await loadGroups();
    setStatus('Saved successfully.');
  }

  async function signIn(event) {
    event.preventDefault();
    setLoginError('');

    if (!client) {
      setLoginError('Supabase is not configured. Check config.js.');
      return;
    }

    const email = String(byId('email')?.value || '').trim();
    const password = String(byId('password')?.value || '');
    const button = byId('loginButton');

    if (button) button.disabled = true;
    setLoginError('Signing in…');

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('signIn', error);
      setLoginError(error.message);
      if (button) button.disabled = false;
      return;
    }

    const ok = await loadUserAndDepartment();
    if (button) button.disabled = false;

    if (!ok) {
      console.warn('Login succeeded but administrator profile could not be loaded.');
    }
  }

  async function loadUserAndDepartment() {
    if (!client || checkingSession) return false;

    checkingSession = true;

    try {
      setLoginError('');
      setStatus('Checking administrator access…');

      const { data: userData, error: userError } = await client.auth.getUser();

      if (userError || !userData?.user) {
        show('loginView', true);
        show('appView', false);
        setStatus('');
        return false;
      }

      const user = userData.user;

      const { data: profile, error: profileError } = await client
        .from('admin_profiles')
        .select('user_id,department_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (profileError) {
        console.error('profile lookup', profileError);
        show('loginView', true);
        show('appView', false);
        setLoginError(
          `Administrator profile lookup failed: ${profileError.message}`
        );
        return false;
      }

      if (!profile?.department_id) {
        show('loginView', true);
        show('appView', false);
        setLoginError('This account is not linked to a department.');
        return false;
      }

      const { data: department, error: departmentError } = await client
        .from('departments')
        .select('id,name,slug')
        .eq('id', profile.department_id)
        .maybeSingle();

      if (departmentError) {
        console.error('department lookup', departmentError);
        show('loginView', true);
        show('appView', false);
        setLoginError(`Department lookup failed: ${departmentError.message}`);
        return false;
      }

      if (!department) {
        show('loginView', true);
        show('appView', false);
        setLoginError('The linked department could not be found.');
        return false;
      }

      if (String(department.slug).toLowerCase() !== DEPARTMENT_SLUG) {
        show('loginView', true);
        show('appView', false);
        setLoginError('This account is not authorised for this department.');
        return false;
      }

      departmentId = profile.department_id;
      setText('adminEmail', user.email || '');
      setText('departmentName', department.name || DEPARTMENT_SLUG);

      show('loginView', false);
      show('appView', true);

      await loadGroups();
      return true;
    } catch (error) {
      console.error('loadUserAndDepartment', error);
      show('loginView', true);
      show('appView', false);
      setLoginError(`Unable to load administrator session: ${error.message || error}`);
      return false;
    } finally {
      checkingSession = false;
    }
  }

  async function signOut() {
    await client.auth.signOut();
    departmentId = null;
    groups = [];
    resetForm();
    show('loginView', true);
    show('appView', false);
    setText('adminEmail', '');
    setStatus('Signed out.');
  }

  function startRealtime() {
    if (!client) return;

    client
      .channel(`admin-attendance-${DEPARTMENT_SLUG}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_groups'
        },
        payload => {
          if (departmentId == null) return;
          const row = payload.new || payload.old;
          if (!row) return;

          if (Number(row.department_id) !== Number(departmentId)) return;

          loadGroups().catch(console.error);
        }
      )
      .subscribe();
  }

  function renderConfigError(message) {
    show('loginView', true);
    show('appView', false);
    setLoginError(message);
  }

  async function boot() {
    const supabaseLib = window.supabase;

    if (
      !supabaseLib ||
      !SUPABASE_URL ||
      !SUPABASE_KEY ||
      !DEPARTMENT_SLUG ||
      SUPABASE_URL.includes('YOUR_') ||
      SUPABASE_KEY.includes('YOUR_')
    ) {
      renderConfigError(
        'Supabase configuration is missing or invalid. Check this department config.js file.'
      );
      return;
    }

    client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);

    const loginForm = byId('loginForm');
    const groupForm = byId('groupForm');
    const logout = byId('logout');

    if (loginForm) loginForm.addEventListener('submit', signIn);
    if (groupForm) groupForm.addEventListener('submit', saveGroup);
    if (logout) logout.addEventListener('click', signOut);

    client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        departmentId = null;
        groups = [];
        show('loginView', true);
        show('appView', false);
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED'
      ) {
        setTimeout(() => {
          loadUserAndDepartment().catch(console.error);
        }, 50);
      }
    });

    startRealtime();
    await loadUserAndDepartment();
  }

  boot().catch(error => {
    console.error('Admin boot failed', error);
    show('loginView', true);
    show('appView', false);
    setLoginError(`Admin page failed to start: ${error.message || error}`);
  });
})();
