const USER_KEY = 'chatUser';

export function getSavedUser() {
  const savedUser = localStorage.getItem(USER_KEY);

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch (err) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem(USER_KEY);
}
