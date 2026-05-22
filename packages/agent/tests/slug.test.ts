import { describe, it, expect } from 'vitest';
import { generateSlug, uniqueSlug } from '../src/modules/landing/slug.js';

describe('generateSlug', () => {
  it('transliterates Russian into Latin kebab-case', () => {
    expect(generateSlug('Китай продлил безвизовый режим')).toBe(
      'kitay-prodlil-bezvizovyy-rezhim',
    );
  });

  it('handles mixed alphabets', () => {
    expect(generateSlug('Visa-free travel to Китай 2027')).toBe(
      'visa-free-travel-to-kitay-2027',
    );
  });

  it('strips special characters and replaces ampersand', () => {
    expect(generateSlug('Турция: Стамбул & Каппадокия!')).toBe(
      'turtsiya-stambul-and-kappadokiya',
    );
  });

  it('handles empty / weird input gracefully', () => {
    expect(generateSlug('')).toBe('post');
    expect(generateSlug('!!!@@@')).toBe('post');
  });

  it('truncates long strings on word boundary', () => {
    const long = 'Очень длинное и подробное название для абсолютно невероятного путешествия в Китай';
    const slug = generateSlug(long, { maxLength: 50 });
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug).not.toMatch(/-$/);
  });

  it('uniqueSlug appends suffix when collision', () => {
    const existing = new Set(['china', 'china-2']);
    expect(uniqueSlug('china', existing)).toBe('china-3');
    expect(uniqueSlug('japan', existing)).toBe('japan');
  });
});
