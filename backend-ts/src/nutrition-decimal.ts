export type Rational = {
  numerator: bigint;
  denominator: bigint;
};

const ZERO: Rational = { numerator: 0n, denominator: 1n };

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1n;
}

function normalize(value: Rational): Rational {
  const divisor = gcd(value.numerator, value.denominator);
  const sign = value.denominator < 0n ? -1n : 1n;
  return {
    numerator: sign * value.numerator / divisor,
    denominator: sign * value.denominator / divisor,
  };
}

export function rational(value: number | bigint): Rational {
  if (!Number.isFinite(value)) {
    throw new Error('A finite decimal value is required');
  }

  const text = value.toString();
  const [coefficientText, exponentText] = text.split(/[eE]/);
  const negative = coefficientText.startsWith('-');
  const unsigned = coefficientText.replace(/^[+-]/, '');
  const [integerDigits, fractionDigits = ''] = unsigned.split('.');
  const digits = `${integerDigits}${fractionDigits}`;
  const exponent = Number(exponentText ?? '0');
  const denominatorPower = fractionDigits.length - exponent;

  let numerator = BigInt(digits || '0');
  let denominator = 1n;
  if (denominatorPower > 0) {
    denominator = 10n ** BigInt(denominatorPower);
  } else if (denominatorPower < 0) {
    numerator *= 10n ** BigInt(-denominatorPower);
  }
  if (negative) {
    numerator = -numerator;
  }
  return normalize({ numerator, denominator });
}

export function addRational(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator +
      right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function multiplyRational(
  left: Rational,
  right: Rational,
): Rational {
  return normalize({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

export function divideRational(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new Error('Cannot divide by zero');
  }
  return normalize({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

export function compareRational(left: Rational, right: Rational): number {
  const difference = addRational(left, negate(right)).numerator;
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}

export function negate(value: Rational): Rational {
  return { numerator: -value.numerator, denominator: value.denominator };
}

export function rationalFromInteger(value: number): Rational {
  return { numerator: BigInt(value), denominator: 1n };
}

// Decimal values use banker's rounding at the storage boundary.
export function roundedNumber(
  value: Rational,
  fractionalDigits = 2,
): number {
  const scale = 10n ** BigInt(fractionalDigits);
  const signedScaled = value.numerator * scale * (
    value.denominator < 0n ? -1n : 1n
  );
  const denominator = value.denominator < 0n
    ? -value.denominator
    : value.denominator;
  const negative = signedScaled < 0n;
  const scaled = negative ? -signedScaled : signedScaled;
  let quotient = scaled / denominator;
  const remainder = scaled % denominator;
  const twiceRemainder = remainder * 2n;
  if (
    twiceRemainder > denominator ||
    (twiceRemainder === denominator && quotient % 2n === 1n)
  ) {
    quotient += 1n;
  }
  return Number((negative ? -quotient : quotient).toString()) /
    Number(scale.toString());
}

export function rationalToNumber(value: Rational): number {
  const normalized = normalize(value);
  const negative = normalized.numerator < 0n;
  const numerator = negative ? -normalized.numerator : normalized.numerator;
  const magnitude = Number(numerator) / Number(normalized.denominator);
  return negative ? -magnitude : magnitude;
}

export function zeroRational(): Rational {
  return { ...ZERO };
}
