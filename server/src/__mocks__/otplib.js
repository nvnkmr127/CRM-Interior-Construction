module.exports = {
  authenticator: {
    generateSecret: () => 'MOCKSECRET123',
    keyuri: (user, service, secret) => `otpauth://totp/${service}:${user}?secret=${secret}&issuer=${service}`,
    generate: (secret) => '123456',
    verify: ({ token, secret }) => token === '123456',
  }
};
