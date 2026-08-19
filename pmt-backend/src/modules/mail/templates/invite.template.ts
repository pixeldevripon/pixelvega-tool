export function inviteEmailTemplate(params: {
  name: string;
  tempPassword: string;
}) {
  const { name, tempPassword } = params;
  const loginUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

  return {
    subject: "You've been invited to PixelVega",
    html: `
      <p>Hi ${name},</p>
      <p>You've been invited to PixelVega. Your temporary password is:</p>
      <p><strong>${tempPassword}</strong></p>
      <p>Sign in at <a href="${loginUrl}">${loginUrl}</a> — you'll be asked to set a new password on first login.</p>
    `,
  };
}
