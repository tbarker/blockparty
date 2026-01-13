/**
 * Validation utilities for BlockParty forms
 *
 * Uses native browser/JS validation where possible to avoid external dependencies.
 * Designed to work with MUI TextField's error and helperText props.
 *
 * Usage:
 *   const error = validators.required(value);
 *   <TextField error={!!error} helperText={error || 'Helper text'} />
 */

/**
 * Individual validators - return error message string or null if valid
 */
export const validators = {
  /**
   * Check if value is non-empty
   * @param {string} value
   * @param {string} [fieldName='This field'] - Field name for error message
   * @returns {string|null} Error message or null
   */
  required: (value, fieldName = 'This field') => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return `${fieldName} is required`;
    }
    return null;
  },

  /**
   * Check string length constraints
   * @param {string} value
   * @param {object} options - { min, max, fieldName }
   * @returns {string|null} Error message or null
   */
  length: (value, { min = 0, max = Infinity, fieldName = 'This field' } = {}) => {
    if (!value) return null; // Use required() for empty check
    const len = String(value).length;
    if (min > 0 && len < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    if (max < Infinity && len > max) {
      return `${fieldName} must be no more than ${max} characters`;
    }
    return null;
  },

  /**
   * Validate URL format using native URL constructor
   * @param {string} value
   * @param {object} options - { fieldName, allowEmpty, protocols }
   * @returns {string|null} Error message or null
   */
  url: (value, { fieldName = 'URL', allowEmpty = true, protocols = ['http:', 'https:'] } = {}) => {
    if (!value || String(value).trim() === '') {
      return allowEmpty ? null : `${fieldName} is required`;
    }
    try {
      const url = new URL(value);
      if (protocols.length > 0 && !protocols.includes(url.protocol)) {
        return `${fieldName} must use ${protocols.map(p => p.replace(':', '')).join(' or ')}`;
      }
      return null;
    } catch {
      return `${fieldName} must be a valid URL`;
    }
  },

  /**
   * Validate numeric value within range
   * @param {string|number} value
   * @param {object} options - { min, max, fieldName, integer }
   * @returns {string|null} Error message or null
   */
  number: (value, { min = -Infinity, max = Infinity, fieldName = 'Value', integer = false } = {}) => {
    if (value === '' || value === null || value === undefined) {
      return null; // Use required() for empty check
    }
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName} must be a valid number`;
    }
    if (integer && !Number.isInteger(num)) {
      return `${fieldName} must be a whole number`;
    }
    if (num < min) {
      return `${fieldName} must be at least ${min}`;
    }
    if (num > max) {
      return `${fieldName} must be no more than ${max}`;
    }
    return null;
  },

  /**
   * Validate Ethereum address format
   * @param {string} value
   * @param {object} options - { fieldName, allowEmpty }
   * @returns {string|null} Error message or null
   */
  ethereumAddress: (value, { fieldName = 'Address', allowEmpty = false } = {}) => {
    if (!value || String(value).trim() === '') {
      return allowEmpty ? null : `${fieldName} is required`;
    }
    // Basic Ethereum address validation: 0x followed by 40 hex characters
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(value)) {
      return `${fieldName} must be a valid Ethereum address`;
    }
    return null;
  },

  /**
   * Validate that end date is after start date
   * @param {string} endDate - End date value
   * @param {string} startDate - Start date value to compare against
   * @param {object} options - { fieldName }
   * @returns {string|null} Error message or null
   */
  dateAfter: (endDate, startDate, { fieldName = 'End date' } = {}) => {
    if (!endDate || !startDate) return null;
    const end = new Date(endDate);
    const start = new Date(startDate);
    if (end <= start) {
      return `${fieldName} must be after start date`;
    }
    return null;
  },

  /**
   * Validate image file
   * @param {File} file
   * @param {object} options - { maxSizeMB, allowedTypes }
   * @returns {string|null} Error message or null
   */
  imageFile: (file, { maxSizeMB = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] } = {}) => {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `Image must be ${allowedTypes.map(t => t.replace('image/', '').toUpperCase()).join(', ')}`;
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Image must be smaller than ${maxSizeMB}MB`;
    }
    return null;
  },

  /**
   * Validate Twitter/X handle or URL
   * @param {string} value
   * @param {object} options - { fieldName, allowEmpty }
   * @returns {string|null} Error message or null
   */
  twitterHandle: (value, { fieldName = 'Twitter handle', allowEmpty = true } = {}) => {
    if (!value || String(value).trim() === '') {
      return allowEmpty ? null : `${fieldName} is required`;
    }
    const trimmed = String(value).trim();
    // Accept: @handle, handle, or full Twitter/X URL
    const handleRegex = /^@?[a-zA-Z0-9_]{1,15}$/;
    const urlRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]{1,15}\/?$/;
    if (handleRegex.test(trimmed) || urlRegex.test(trimmed)) {
      return null;
    }
    return `${fieldName} must be a valid Twitter handle (e.g., @username) or URL`;
  },
};

/**
 * Validate multiple fields at once
 * @param {object} values - Object with field values
 * @param {object} rules - Object mapping field names to validation functions
 * @returns {object} Object mapping field names to error messages (empty if valid)
 *
 * Example:
 *   const errors = validateFields(
 *     { name: '', deposit: '0.5' },
 *     {
 *       name: (v) => validators.required(v, 'Event name'),
 *       deposit: (v) => validators.number(v, { min: 0.001, max: 10 }),
 *     }
 *   );
 */
export function validateFields(values, rules) {
  const errors = {};
  for (const [field, validate] of Object.entries(rules)) {
    const error = validate(values[field], values);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}

/**
 * Compose multiple validators for a single field
 * @param  {...function} validators - Validator functions to run in order
 * @returns {function} Combined validator that returns first error or null
 *
 * Example:
 *   const validateName = compose(
 *     (v) => validators.required(v, 'Name'),
 *     (v) => validators.length(v, { max: 100 })
 *   );
 */
export function compose(...validatorFns) {
  return (value, allValues) => {
    for (const validate of validatorFns) {
      const error = validate(value, allValues);
      if (error) return error;
    }
    return null;
  };
}

/**
 * Field validation schemas for BlockParty forms
 */
export const schemas = {
  /**
   * Event creation form validation
   */
  eventCreation: {
    name: compose(
      v => validators.required(v, 'Event name'),
      v => validators.length(v, { max: 100, fieldName: 'Event name' })
    ),
    deposit: compose(
      v => validators.required(v, 'Deposit amount'),
      v => validators.number(v, { min: 0.001, max: 10, fieldName: 'Deposit' })
    ),
    limitOfParticipants: compose(
      v => validators.required(v, 'Max participants'),
      v => validators.number(v, { min: 1, max: 1000, fieldName: 'Max participants', integer: true })
    ),
    mapUrl: v => validators.url(v, { fieldName: 'Map URL', allowEmpty: true }),
    websiteUrl: v => validators.url(v, { fieldName: 'Website URL', allowEmpty: true }),
    twitterUrl: v => validators.url(v, { fieldName: 'Twitter URL', allowEmpty: true }),
  },

  /**
   * Metadata editor form validation
   */
  metadataEditor: {
    mapUrl: v => validators.url(v, { fieldName: 'Map URL', allowEmpty: true }),
    websiteUrl: v => validators.url(v, { fieldName: 'Website URL', allowEmpty: true }),
    twitterUrl: v => validators.url(v, { fieldName: 'Twitter URL', allowEmpty: true }),
  },

  /**
   * Registration form validation
   */
  registration: {
    participantName: compose(
      v => validators.required(v, 'Twitter handle'),
      v => validators.twitterHandle(v, { fieldName: 'Twitter handle', allowEmpty: false })
    ),
  },
};

export default validators;
