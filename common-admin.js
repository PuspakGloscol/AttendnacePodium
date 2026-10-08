(() => {
  'use strict';

  const cfg = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = String(cfg.url || '').trim();
  const SUPABASE_KEY = String(cfg.key || '').trim();
  const DEPARTMENT_SLUG = String(cfg.departmentSlug || '').trim().toLowerCase();

  const $ = id => document.getElementById(id);

  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value ?? '';
  };

  const show = (id, visible) => {
    const el = $(id);
    if (!el) return;

    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  };

  const escapeHtml = value =>
    String(value ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));

  const formatNumber = value => Number(value ?? 0).toFixed(1);

  let client = null;
  let departmentId = null;
  let departmentName = '';
  let editingId = null;
  let groups = [];
  let loadingSession = false;
  let signingOut = false;

  function setStatus(message, type = 'info') {
    const el = $('adminStatus');
    if (!el) return;

    el.textContent = message || '';
    el.dataset.type = type;

    if (type === 'error') {
      el.style.color = '#ff8298';
    } else {
      el.style.color = '#8eeeff';
    }
  }

  function setLoginError(message) {
    setText('loginError', message || '');
  }

  function showLogin() {
    show('loginView', true);
    show('appView', false);
  }

  function showDashboard() {
    show('loginView', false);
    show('appView', true);
  }

  function resetForm() {
    const form = $('groupForm');

    if (form) {
      form.reset();
    }

    editingId = null;
    setText('saveBtn', 'Add group');
  }

  function renderGroups() {
    const tbody = $('rows');

    if (!tbody) return;

    if (!groups.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-row">No groups have been added yet.</td></tr>';
      return;
    }

    tbody.innerHTML = groups.map(group => `
      <tr>
        <td>${escapeHtml(group.group_name)}</td>
        <td>${formatNumber(group.recent_attendance)}%</td>
        <td>${formatNumber(group.attendance)}%</td>
        <td>${formatNumber(group.punctuality)}%</td>
        <td class="actions">
          <button
            type="button"
            class="edit"
            data-id="${escapeHtml(group.id)}"
          >
            Edit
          </button>

          <button
            type="button"
            class="delete"
            data-id="${escapeHtml(group.id)}"
          >
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit').forEach(button => {
      button.addEventListener('click', () => {
        editGroup(button.dataset.id);
      });
    });

    tbody.querySelectorAll('.delete').forEach(button => {
      button.addEventListener('click', () => {
        deleteGroup(button.dataset.id);
      });
    });
  }

  async function loadGroups() {
    if (!client || !departmentId) {
      return;
    }

    setStatus('Loading groups...');

    const { data, error } = await client
      .from('attendance_groups')
      .select(
        'id,department_id,group_name,recent_attendance,attendance,punctuality,updated_at'
      )
      .eq('department_id', departmentId)
      .order('group_name', { ascending: true });

    if (error) {
      console.error('loadGroups error:', error);

      groups = [];
      renderGroups();

      setStatus(
        `Could not load groups: ${error.message}`,
        'error'
      );

      return;
    }

    groups = data || [];

    renderGroups();

    setStatus(
      `${groups.length} group${groups.length === 1 ? '' : 's'} loaded.`
    );
  }

  function editGroup(id) {
    const group = groups.find(
      row => String(row.id) === String(id)
    );

    if (!group) return;

    editingId = group.id;

    const nameInput = $('groupName');
    const recentAttendanceInput = $('recentAttendance');
    const attendanceInput = $('attendance');
    const punctualityInput = $('punctuality');

    if (nameInput) {
      nameInput.value = group.group_name ?? '';
    }

    if (recentAttendanceInput) {
      recentAttendanceInput.value = group.recent_attendance ?? '';
    }

    if (attendanceInput) {
      attendanceInput.value = group.attendance ?? '';
    }

    if (punctualityInput) {
      punctualityInput.value = group.punctuality ?? '';
    }

    setText('saveBtn', 'Update group');
    setStatus(`Editing ${group.group_name}`);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function deleteGroup(id) {
    const group = groups.find(
      row => String(row.id) === String(id)
    );

    if (!group) return;

    const confirmed = window.confirm(
      `Delete ${group.group_name}?`
    );

    if (!confirmed) return;

    setStatus(`Deleting ${group.group_name}...`);

    const { error } = await client
      .from('attendance_groups')
      .delete()
      .eq('id', id)
      .eq('department_id', departmentId);

    if (error) {
      console.error('deleteGroup error:', error);

      setStatus(
        `Delete failed: ${error.message}`,
        'error'
      );

      return;
    }

    if (String(editingId) === String(id)) {
      resetForm();
    }

    await loadGroups();

    setStatus('Group deleted successfully.');
  }

  async function saveGroup(event) {
    event.preventDefault();

    const name = String(
      $('groupName')?.value || ''
    ).trim();

    const recentAttendance = Number(
      $('recentAttendance')?.value
    );

    const attendance = Number(
      $('attendance')?.value
    );

    const punctuality = Number(
      $('punctuality')?.value
    );

    if (!name) {
      setStatus(
        'Please enter a group name.',
        'error'
      );

      return;
    }

    if (
      !Number.isFinite(recentAttendance) ||
      recentAttendance < 0 ||
      recentAttendance > 100
    ) {
      setStatus(
        'Recent attendance must be between 0 and 100.',
        'error'
      );

      return;
    }

    if (
      !Number.isFinite(attendance) ||
      attendance < 0 ||
      attendance > 100
    ) {
      setStatus(
        'Attendance must be between 0 and 100.',
        'error'
      );

      return;
    }

    if (
      !Number.isFinite(punctuality) ||
      punctuality < 0 ||
      punctuality > 100
    ) {
      setStatus(
        'Punctuality must be between 0 and 100.',
        'error'
      );

      return;
    }

    setStatus(
      editingId
        ? 'Updating group...'
        : 'Adding group...'
    );

    let result;

    if (editingId) {
      result = await client
        .from('attendance_groups')
        .update({
          group_name: name,
          recent_attendance: recentAttendance,
          attendance,
          punctuality
        })
        .eq('id', editingId)
        .eq('department_id', departmentId);
    } else {
      result = await client
        .from('attendance_groups')
        .insert({
          department_id: departmentId,
          group_name: name,
          recent_attendance: recentAttendance,
          attendance,
          punctuality
        });
    }

    if (result.error) {
      console.error('saveGroup error:', result.error);

      setStatus(
        `Save failed: ${result.error.message}`,
        'error'
      );

      return;
    }

    resetForm();

    await loadGroups();

    setStatus('Saved successfully.');
  }

  async function findAdministrator(user) {
    /*
      We intentionally use the administrator's own profile only.
      No automatic sign out happens here.
    */

    const {
      data: profileRows,
      error: profileError
    } = await client
      .from('admin_profiles')
      .select('user_id,department_id')
      .eq('user_id', user.id)
      .limit(1);

    if (profileError) {
      throw new Error(
        `Administrator profile lookup failed: ${profileError.message}`
      );
    }

    const profile = profileRows?.[0];

    if (!profile) {
      throw new Error(
        'This account has not been linked to an administrator profile.'
      );
    }

    if (!profile.department_id) {
      throw new Error(
        'This administrator does not have a department assigned.'
      );
    }

    const {
      data: departmentRows,
      error: departmentError
    } = await client
      .from('departments')
      .select('id,name,slug')
      .eq('id', profile.department_id)
      .limit(1);

    if (departmentError) {
      throw new Error(
        `Department lookup failed: ${departmentError.message}`
      );
    }

    const department = departmentRows?.[0];

    if (!department) {
      throw new Error(
        'The administrator department could not be found.'
      );
    }

    const actualSlug = String(
      department.slug || ''
    ).trim().toLowerCase();

    if (actualSlug !== DEPARTMENT_SLUG) {
      throw new Error(
        `This account is linked to ${department.name}, not ${DEPARTMENT_SLUG}.`
      );
    }

    return {
      profile,
      department
    };
  }

  async function loadUserAndDepartment() {
    if (loadingSession) {
      return false;
    }

    loadingSession = true;

    try {
      setLoginError('');
      setStatus('Checking administrator access...');

      const {
        data: userData,
        error: userError
      } = await client.auth.getUser();

      if (userError) {
        throw new Error(
          `Unable to retrieve the signed in user: ${userError.message}`
        );
      }

      const user = userData?.user;

      if (!user) {
        showLogin();
        return false;
      }

      const result = await findAdministrator(user);

      departmentId = result.profile.department_id;
      departmentName = result.department.name;

      setText(
        'adminEmail',
        user.email || ''
      );

      setText(
        'departmentName',
        departmentName
      );

      /*
        This is the important part.

        Successful authentication stays successful.
        We do not call signOut() here.
      */
      showDashboard();

      await loadGroups();

      return true;

    } catch (error) {
      console.error(
        'Administrator session error:',
        error
      );

      /*
        IMPORTANT:
        Never automatically sign out here.
        Show the actual problem instead.
      */

      showDashboard();

      setStatus(
        error.message || 'Unable to verify administrator access.',
        'error'
      );

      return false;

    } finally {
      loadingSession = false;
    }
  }

  async function signIn(event) {
    event.preventDefault();

    setLoginError('');

    if (!client) {
      setLoginError(
        'Supabase is not configured. Check config.js.'
      );

      return;
    }

    const email = String(
      $('email')?.value || ''
    ).trim();

    const password = String(
      $('password')?.value || ''
    );

    const button = $('loginButton');

    if (button) {
      button.disabled = true;
      button.textContent = 'Signing in...';
    }

    try {
      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      /*
        Authentication has succeeded here.

        Do ONE explicit session load.
        We do not depend on onAuthStateChange
        to load the administrator again.
      */

      if (!data?.user) {
        setLoginError(
          'Authentication completed but no user was returned.'
        );

        return;
      }

      const loaded = await loadUserAndDepartment();

      if (!loaded) {
        setLoginError(
          'You are signed in, but administrator access could not be verified. Check the administrator profile.'
        );
      }

    } catch (error) {
      console.error(
        'Sign in error:',
        error
      );

      setLoginError(
        error.message || 'Sign in failed.'
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Sign in';
      }
    }
  }

  async function signOut() {
    if (signingOut) {
      return;
    }

    signingOut = true;

    try {
      await client.auth.signOut();
    } catch (error) {
      console.error(
        'Sign out error:',
        error
      );
    }

    departmentId = null;
    departmentName = '';
    groups = [];
    editingId = null;

    resetForm();

    setText('adminEmail', '');
    setText('departmentName', DEPARTMENT_SLUG);

    showLogin();

    setStatus('Signed out.');

    signingOut = false;
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

          const row =
            payload.new ||
            payload.old;

          if (!row) return;

          if (
            departmentId &&
            Number(row.department_id) ===
              Number(departmentId)
          ) {
            loadGroups().catch(error => {
              console.error(
                'Realtime refresh error:',
                error
              );
            });
          }
        }
      )
      .subscribe(status => {
        console.log(
          `Attendance realtime status: ${status}`
        );
      });
  }

  function renderConfigError() {
    showLogin();
    setLoginError(
      'Supabase configuration is missing or invalid. Check this department config.js file.'
    );
  }

  async function boot() {

    /*
      Validate configuration before creating the client.
    */

    if (
      !window.supabase ||
      !SUPABASE_URL ||
      !SUPABASE_KEY ||
      !DEPARTMENT_SLUG ||
      SUPABASE_URL.includes('YOUR_') ||
      SUPABASE_KEY.includes('YOUR_')
    ) {
      renderConfigError();
      return;
    }

    /*
      Remove a trailing slash just in case.
    */

    const cleanUrl =
      SUPABASE_URL.replace(/\/+$/, '');

    const storageKey = `gc-attendance-${DEPARTMENT_SLUG}-auth`;

client = window.supabase.createClient(
    cleanUrl,
    SUPABASE_KEY,
    {
        auth: {
            storageKey: storageKey,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);

    const loginForm = $('loginForm');
    const groupForm = $('groupForm');
    const logoutButton = $('logout');

    if (loginForm) {
      loginForm.addEventListener(
        'submit',
        signIn
      );
    }

    if (groupForm) {
      groupForm.addEventListener(
        'submit',
        saveGroup
      );
    }

    if (logoutButton) {
      logoutButton.addEventListener(
        'click',
        signOut
      );
    }

    /*
      IMPORTANT:

      We deliberately do NOT call loadUserAndDepartment()
      inside onAuthStateChange.

      That was causing the login → dashboard → logout loop.
    */

    client.auth.onAuthStateChange(
      event => {

        console.log(
          'Supabase auth event:',
          event
        );

        /*
          Only react when the user has actually signed out.

          SIGNED_IN is handled by signIn().
          INITIAL_SESSION is handled below.
          TOKEN_REFRESHED does not require a reload.
        */

        if (
          event === 'SIGNED_OUT'
        ) {
          departmentId = null;
          departmentName = '';
          groups = [];

          showLogin();
        }
      }
    );

    /*
      On page load, check whether a session
      already exists.

      This allows the admin page to remain
      logged in after a browser refresh.
    */

    const {
      data: sessionData,
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError) {
      console.error(
        'getSession error:',
        sessionError
      );

      showLogin();

      setLoginError(
        `Unable to restore your session: ${sessionError.message}`
      );

      return;
    }

    if (sessionData?.session?.user) {
      await loadUserAndDepartment();
    } else {
      showLogin();
    }

    startRealtime();
  }

  boot().catch(error => {

    console.error(
      'Admin boot failed:',
      error
    );

    showLogin();

    setLoginError(
      `Admin page failed to start: ${error.message || error}`
    );
  });

})();
