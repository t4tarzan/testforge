// ESM helper. `safelyRedirect` is anything but safe — it forwards its
// second argument straight to res.redirect. Cross-file open-redirect.

export function safelyRedirect(res, to) {
  return res.redirect(to);
}

export const echoBack = (res, msg) => {
  res.send('<h1>' + msg + '</h1>');
};
