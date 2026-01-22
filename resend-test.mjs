import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  try {
    const result = await resend.emails.send({
      from: 'YieldCraft <dk@yieldcraft.co>',
      to: ['dk@yieldcraft.co'],
      subject: 'YieldCraft Test Email ✅',
      html: `
        <h2>It works 🚀</h2>
        <p>This email was sent successfully via <strong>Resend</strong>.</p>
        <p>If you received this, your API key + DNS are working.</p>
      `,
    });

    console.log('✅ Email sent:', result);
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
}

sendTestEmail();
