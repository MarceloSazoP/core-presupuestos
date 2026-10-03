import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { generateVerificationCode } from '../utils/crypto';
import { userService } from '../services/UserService';
import { ValidationError } from '../errors/AppError';

const router = Router();

// TODO: Implement SMS/Email sending service
// For now, just log the code
const sendVerificationCode = async (phoneOrEmail: string, code: string) => {
  console.log(`[DEV] Verification code for ${phoneOrEmail}: ${code}`);
  // In production: use Twilio for SMS or SendGrid for Email
};

router.post('/request-code', async (req: Request, res: Response) => {
  try {
    const { phone_or_email, method } = req.body;

    if (!phone_or_email || !method) {
      throw new ValidationError('phone_or_email and method are required');
    }

    if (!['SMS', 'EMAIL'].includes(method)) {
      throw new ValidationError('method must be SMS or EMAIL');
    }

    const code = generateVerificationCode();

    // Store verification code
    await query(
      `INSERT INTO verification_codes (phone_or_email, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [phone_or_email, code]
    );

    await sendVerificationCode(phone_or_email, code);

    res.json({
      expires_in_seconds: 600,
      message: `Verification code sent via ${method}`,
    });
  } catch (error) {
    const statusCode = error instanceof ValidationError ? 400 : 500;
    res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { phone_or_email, code, name } = req.body;

    if (!phone_or_email || !code) {
      throw new ValidationError('phone_or_email and code are required');
    }

    // Find verification code
    const result = await query(
      `SELECT * FROM verification_codes
       WHERE phone_or_email = $1 AND code = $2 AND expires_at > NOW()
       AND verified_at IS NULL`,
      [phone_or_email, code]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('Invalid or expired code');
    }

    // Mark as verified
    await query(
      'UPDATE verification_codes SET verified_at = NOW() WHERE id = $1',
      [result.rows[0].id]
    );

    // Check if user exists
    let user = await userService.findByPhone(phone_or_email).catch(() => null) ||
               await userService.findByEmail(phone_or_email).catch(() => null);

    if (!user) {
      if (!name) {
        throw new ValidationError('name is required for new users');
      }

      // Create new user
      user = await userService.createUser(
        phone_or_email.includes('@') ? 'temp' : phone_or_email,
        phone_or_email.includes('@') ? phone_or_email : `${phone_or_email}@temp.local`,
        name
      );
    }

    // TODO: Generate JWT token
    const token = user.id; // Simplified for MVP

    res.json({
      token,
      user,
    });
  } catch (error) {
    const statusCode = error instanceof ValidationError ? 400 : 500;
    res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

export default router;
