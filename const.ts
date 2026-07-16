export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the login flow. For standalone Sentinel, this navigates to the login page.
export const startLogin = () => {
  window.location.href = "/login";
};
