import { validators, validateFields, compose, schemas } from '../../util/validation';

describe('validators', () => {
  describe('required', () => {
    it('returns error for null value', () => {
      expect(validators.required(null)).toBe('This field is required');
    });

    it('returns error for undefined value', () => {
      expect(validators.required(undefined)).toBe('This field is required');
    });

    it('returns error for empty string', () => {
      expect(validators.required('')).toBe('This field is required');
    });

    it('returns error for whitespace-only string', () => {
      expect(validators.required('   ')).toBe('This field is required');
    });

    it('returns null for valid string', () => {
      expect(validators.required('hello')).toBeNull();
    });

    it('uses custom field name', () => {
      expect(validators.required('', 'Event name')).toBe('Event name is required');
    });
  });

  describe('length', () => {
    it('returns null for empty value (use required for empty check)', () => {
      expect(validators.length('')).toBeNull();
    });

    it('returns error when below min length', () => {
      expect(validators.length('ab', { min: 3 })).toBe('This field must be at least 3 characters');
    });

    it('returns error when above max length', () => {
      expect(validators.length('hello', { max: 3 })).toBe('This field must be no more than 3 characters');
    });

    it('returns null for valid length', () => {
      expect(validators.length('hello', { min: 3, max: 10 })).toBeNull();
    });

    it('uses custom field name', () => {
      expect(validators.length('ab', { min: 3, fieldName: 'Name' })).toBe('Name must be at least 3 characters');
    });
  });

  describe('url', () => {
    it('returns null for empty value when allowEmpty is true', () => {
      expect(validators.url('')).toBeNull();
    });

    it('returns error for empty value when allowEmpty is false', () => {
      expect(validators.url('', { allowEmpty: false })).toBe('URL is required');
    });

    it('returns error for invalid URL', () => {
      expect(validators.url('not-a-url')).toBe('URL must be a valid URL');
    });

    it('returns null for valid http URL', () => {
      expect(validators.url('http://example.com')).toBeNull();
    });

    it('returns null for valid https URL', () => {
      expect(validators.url('https://example.com')).toBeNull();
    });

    it('returns error for wrong protocol', () => {
      expect(validators.url('ftp://example.com')).toBe('URL must use http or https');
    });

    it('uses custom field name', () => {
      expect(validators.url('invalid', { fieldName: 'Website' })).toBe('Website must be a valid URL');
    });
  });

  describe('number', () => {
    it('returns null for empty value (use required for empty check)', () => {
      expect(validators.number('')).toBeNull();
    });

    it('returns error for non-numeric value', () => {
      expect(validators.number('abc')).toBe('Value must be a valid number');
    });

    it('returns error when below min', () => {
      expect(validators.number('5', { min: 10 })).toBe('Value must be at least 10');
    });

    it('returns error when above max', () => {
      expect(validators.number('15', { max: 10 })).toBe('Value must be no more than 10');
    });

    it('returns error when not integer but integer required', () => {
      expect(validators.number('5.5', { integer: true })).toBe('Value must be a whole number');
    });

    it('returns null for valid number', () => {
      expect(validators.number('5', { min: 1, max: 10 })).toBeNull();
    });

    it('uses custom field name', () => {
      expect(validators.number('abc', { fieldName: 'Deposit' })).toBe('Deposit must be a valid number');
    });
  });

  describe('ethereumAddress', () => {
    it('returns error for empty value when allowEmpty is false', () => {
      expect(validators.ethereumAddress('')).toBe('Address is required');
    });

    it('returns null for empty value when allowEmpty is true', () => {
      expect(validators.ethereumAddress('', { allowEmpty: true })).toBeNull();
    });

    it('returns error for invalid address', () => {
      expect(validators.ethereumAddress('0x123')).toBe('Address must be a valid Ethereum address');
    });

    it('returns null for valid address', () => {
      expect(validators.ethereumAddress('0x1234567890abcdef1234567890abcdef12345678')).toBeNull();
    });

    it('uses custom field name', () => {
      expect(validators.ethereumAddress('invalid', { fieldName: 'Wallet' })).toBe('Wallet must be a valid Ethereum address');
    });
  });

  describe('dateFuture', () => {
    it('returns null for empty value', () => {
      expect(validators.dateFuture('')).toBeNull();
      expect(validators.dateFuture(null)).toBeNull();
      expect(validators.dateFuture(undefined)).toBeNull();
    });

    it('returns error for past date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      expect(validators.dateFuture(pastDate)).toBe('Date must be in the future');
    });

    it('returns error for current time (edge case)', () => {
      // Use a date slightly in the past to ensure it's definitely past
      const justNow = new Date(Date.now() - 1000).toISOString();
      expect(validators.dateFuture(justNow)).toBe('Date must be in the future');
    });

    it('returns null for future date', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day ahead
      expect(validators.dateFuture(futureDate)).toBeNull();
    });

    it('uses custom field name', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(validators.dateFuture(pastDate, { fieldName: 'Start date' })).toBe('Start date must be in the future');
    });

    it('works with datetime-local format', () => {
      const pastDate = '2020-01-01T12:00';
      expect(validators.dateFuture(pastDate)).toBe('Date must be in the future');

      const futureDate = '2099-12-31T23:59';
      expect(validators.dateFuture(futureDate)).toBeNull();
    });
  });

  describe('dateAfter', () => {
    it('returns null when end date is empty', () => {
      expect(validators.dateAfter('', '2024-01-01')).toBeNull();
      expect(validators.dateAfter(null, '2024-01-01')).toBeNull();
    });

    it('returns null when start date is empty', () => {
      expect(validators.dateAfter('2024-01-02', '')).toBeNull();
      expect(validators.dateAfter('2024-01-02', null)).toBeNull();
    });

    it('returns null when both dates are empty', () => {
      expect(validators.dateAfter('', '')).toBeNull();
    });

    it('returns error when end date equals start date', () => {
      const date = '2024-06-15T14:00';
      expect(validators.dateAfter(date, date)).toBe('End date must be after start date');
    });

    it('returns error when end date is before start date', () => {
      const startDate = '2024-06-15T14:00';
      const endDate = '2024-06-14T14:00';
      expect(validators.dateAfter(endDate, startDate)).toBe('End date must be after start date');
    });

    it('returns null when end date is after start date', () => {
      const startDate = '2024-06-15T14:00';
      const endDate = '2024-06-16T14:00';
      expect(validators.dateAfter(endDate, startDate)).toBeNull();
    });

    it('uses custom field name', () => {
      const startDate = '2024-06-15T14:00';
      const endDate = '2024-06-14T14:00';
      expect(validators.dateAfter(endDate, startDate, { fieldName: 'Event end' })).toBe('Event end must be after start date');
    });

    it('works with ISO format dates', () => {
      const startDate = '2024-06-15T14:00:00.000Z';
      const endDate = '2024-06-16T14:00:00.000Z';
      expect(validators.dateAfter(endDate, startDate)).toBeNull();
    });
  });

  describe('dateRequiresStart', () => {
    it('returns null when end date is empty', () => {
      expect(validators.dateRequiresStart('', '')).toBeNull();
      expect(validators.dateRequiresStart('', '2024-01-01')).toBeNull();
      expect(validators.dateRequiresStart(null, '')).toBeNull();
    });

    it('returns error when end date is set but start date is empty', () => {
      expect(validators.dateRequiresStart('2024-06-15T14:00', '')).toBe('Start date is required when end date is set');
      expect(validators.dateRequiresStart('2024-06-15T14:00', null)).toBe('Start date is required when end date is set');
    });

    it('returns null when both dates are set', () => {
      expect(validators.dateRequiresStart('2024-06-16T14:00', '2024-06-15T14:00')).toBeNull();
    });

    it('uses custom field name', () => {
      expect(validators.dateRequiresStart('2024-06-15T14:00', '', { fieldName: 'Event end' })).toBe('Start date is required when event end is set');
    });
  });

  describe('twitterHandle', () => {
    it('returns null for empty value when allowEmpty is true', () => {
      expect(validators.twitterHandle('')).toBeNull();
    });

    it('returns error for empty value when allowEmpty is false', () => {
      expect(validators.twitterHandle('', { allowEmpty: false })).toBe('Twitter handle is required');
    });

    it('returns null for valid handle with @', () => {
      expect(validators.twitterHandle('@username')).toBeNull();
    });

    it('returns null for valid handle without @', () => {
      expect(validators.twitterHandle('username')).toBeNull();
    });

    it('returns null for valid Twitter URL', () => {
      expect(validators.twitterHandle('https://twitter.com/username')).toBeNull();
    });

    it('returns null for valid X URL', () => {
      expect(validators.twitterHandle('https://x.com/username')).toBeNull();
    });

    it('returns error for handle exceeding 15 characters', () => {
      expect(validators.twitterHandle('@toolongusername1')).toBe('Twitter handle must be a valid Twitter handle (e.g., @username) or URL');
    });

    it('returns error for invalid characters', () => {
      expect(validators.twitterHandle('@user-name')).toBe('Twitter handle must be a valid Twitter handle (e.g., @username) or URL');
    });
  });

  describe('imageFile', () => {
    it('returns null for null/undefined file', () => {
      expect(validators.imageFile(null)).toBeNull();
      expect(validators.imageFile(undefined)).toBeNull();
    });

    it('returns error for non-image file', () => {
      const file = { type: 'text/plain', size: 1000 };
      expect(validators.imageFile(file)).toBe('Please select an image file');
    });

    it('returns error for unsupported image type', () => {
      const file = { type: 'image/bmp', size: 1000 };
      expect(validators.imageFile(file)).toBe('Image must be JPEG, PNG, GIF, WEBP');
    });

    it('returns error for file too large', () => {
      const file = { type: 'image/jpeg', size: 6 * 1024 * 1024 };
      expect(validators.imageFile(file)).toBe('Image must be smaller than 5MB');
    });

    it('returns null for valid image file', () => {
      const file = { type: 'image/jpeg', size: 1024 };
      expect(validators.imageFile(file)).toBeNull();
    });

    it('uses custom maxSizeMB', () => {
      const file = { type: 'image/jpeg', size: 3 * 1024 * 1024 };
      expect(validators.imageFile(file, { maxSizeMB: 2 })).toBe('Image must be smaller than 2MB');
    });
  });
});

describe('validateFields', () => {
  it('returns empty object when all validations pass', () => {
    const values = { name: 'Test', email: 'test@example.com' };
    const rules = {
      name: v => validators.required(v),
      email: v => validators.required(v),
    };
    expect(validateFields(values, rules)).toEqual({});
  });

  it('returns errors for failed validations', () => {
    const values = { name: '', email: '' };
    const rules = {
      name: v => validators.required(v, 'Name'),
      email: v => validators.required(v, 'Email'),
    };
    expect(validateFields(values, rules)).toEqual({
      name: 'Name is required',
      email: 'Email is required',
    });
  });

  it('only includes fields with errors', () => {
    const values = { name: 'Test', email: '' };
    const rules = {
      name: v => validators.required(v, 'Name'),
      email: v => validators.required(v, 'Email'),
    };
    expect(validateFields(values, rules)).toEqual({
      email: 'Email is required',
    });
  });
});

describe('compose', () => {
  it('returns null when all validators pass', () => {
    const validator = compose(
      v => validators.required(v),
      v => validators.length(v, { min: 3 })
    );
    expect(validator('hello')).toBeNull();
  });

  it('returns first error when validation fails', () => {
    const validator = compose(
      v => validators.required(v, 'Name'),
      v => validators.length(v, { min: 3, fieldName: 'Name' })
    );
    expect(validator('')).toBe('Name is required');
  });

  it('stops at first failing validator', () => {
    const validator = compose(
      v => validators.required(v, 'Name'),
      v => validators.length(v, { min: 3, fieldName: 'Name' })
    );
    // Empty string fails required first, not length
    expect(validator('')).toBe('Name is required');
  });

  it('continues to next validator when first passes', () => {
    const validator = compose(
      v => validators.required(v, 'Name'),
      v => validators.length(v, { min: 5, fieldName: 'Name' })
    );
    expect(validator('abc')).toBe('Name must be at least 5 characters');
  });
});

describe('schemas', () => {
  describe('eventCreation', () => {
    it('validates name is required', () => {
      expect(schemas.eventCreation.name('')).toBe('Event name is required');
    });

    it('validates name max length', () => {
      const longName = 'a'.repeat(101);
      expect(schemas.eventCreation.name(longName)).toBe('Event name must be no more than 100 characters');
    });

    it('validates deposit is required', () => {
      expect(schemas.eventCreation.deposit('')).toBe('Deposit amount is required');
    });

    it('validates deposit minimum', () => {
      expect(schemas.eventCreation.deposit('0.0001')).toBe('Deposit must be at least 0.001');
    });

    it('validates deposit maximum', () => {
      expect(schemas.eventCreation.deposit('15')).toBe('Deposit must be no more than 10');
    });

    it('validates limitOfParticipants is required', () => {
      expect(schemas.eventCreation.limitOfParticipants('')).toBe('Max participants is required');
    });

    it('validates limitOfParticipants minimum', () => {
      expect(schemas.eventCreation.limitOfParticipants('0')).toBe('Max participants must be at least 1');
    });

    it('validates limitOfParticipants maximum', () => {
      expect(schemas.eventCreation.limitOfParticipants('2000')).toBe('Max participants must be no more than 1000');
    });

    it('validates limitOfParticipants must be integer', () => {
      expect(schemas.eventCreation.limitOfParticipants('10.5')).toBe('Max participants must be a whole number');
    });
  });

  describe('registration', () => {
    it('validates participantName is required', () => {
      expect(schemas.registration.participantName('')).toBe('Twitter handle is required');
    });

    it('validates participantName format', () => {
      expect(schemas.registration.participantName('invalid-handle')).toBe('Twitter handle must be a valid Twitter handle (e.g., @username) or URL');
    });
  });
});
