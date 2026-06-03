async function apiFetch(path, options) {
  options = options || {};
  var token = localStorage.getItem('token');
  var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var res = await fetch('/api' + path, Object.assign({}, options, { headers: headers }));

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    throw new Error('Unauthenticated');
  }

  var data;
  try { data = await res.json(); } catch (e) { data = {}; }

  if (!res.ok) {
    var err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function requireAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}
