export function resetCodeEmailTemplate(params: { code: string }) {
  const { code } = params;

  return {
    subject: 'Your PixelVega password reset code',
    html: `
      <p>Your password reset code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    `,
  };
}
