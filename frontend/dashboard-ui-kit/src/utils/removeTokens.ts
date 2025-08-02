export const removeTokens = () => {
    localStorage.removeItem('csrfToken');
    localStorage.removeItem('user');
    // Clear any legacy tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
};
  