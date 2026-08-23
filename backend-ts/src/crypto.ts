import {
  pbkdf2,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);
const ALGORITHM = 'pbkdf2_sha256';

function constantTimeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(9).toString('base64url').slice(0, 12);
  const iterations = 1_200_000;
  const encoded = await pbkdf2Async(password, salt, iterations, 32, 'sha256');
  return `${ALGORITHM}$${iterations}$${salt}$${encoded.toString('base64')}`;
}

export async function verifyPassword(
  password: string,
  encodedPassword: string,
): Promise<boolean> {
  const [algorithm, iterationText, salt, hash] = encodedPassword.split('$');
  if (algorithm !== ALGORITHM || !iterationText || !salt || !hash) {
    return false;
  }
  const iterations = Number.parseInt(iterationText, 10);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5_000_000) {
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const actual = await pbkdf2Async(
    password,
    salt,
    iterations,
    expected.length || 32,
    'sha256',
  );
  return constantTimeEqual(actual, expected);
}
