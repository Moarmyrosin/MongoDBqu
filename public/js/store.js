const TOKEN_KEY = 'survey.token';
const USER_KEY = 'survey.user';

const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const store = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user() {
    return safeParse(localStorage.getItem(USER_KEY));
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  get isLoggedIn() {
    return Boolean(this.token);
  }
};
