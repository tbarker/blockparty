# Validation Libraries Research

## Current State in BlockParty

The project currently uses:
- **React 19** with class components
- **MUI 7** (`@mui/material`) for UI components
- **Manual validation** via custom `validateForm()` methods (see `src/components/NewEventDialog.js:176-203`)

Current validation is imperative and scattered:
```javascript
validateForm() {
  if (!name || name.trim().length === 0) {
    return 'Event name is required';
  }
  // ... more checks
}
```

MUI TextField props used: `error`, `helperText`, `required`

---

## Library Options

### 1. React Hook Form + Zod (Recommended)

| Aspect | Details |
|--------|---------|
| **npm downloads** | ~5 million/week (most popular) |
| **Bundle size** | ~9KB (RHF) + ~13KB (Zod) |
| **TypeScript** | First-class support, Zod infers types from schema |
| **MUI integration** | Via `@hookform/resolvers` and `Controller` component |
| **Approach** | Uncontrolled components, minimal re-renders |

**Pros:**
- Best performance (uncontrolled inputs)
- Zod provides runtime validation + TypeScript types from same schema
- Zero dependencies for core RHF
- Active development, large community
- Works with React 19

**Cons:**
- Requires wrapping MUI components with `Controller`
- Learning curve for uncontrolled component pattern
- Class components need refactoring to hooks

**Example schema for BlockParty:**
```javascript
import { z } from 'zod';

const eventSchema = z.object({
  name: z.string().min(1, 'Required').max(100, 'Max 100 chars'),
  deposit: z.coerce.number().min(0.001).max(10),
  limitOfParticipants: z.coerce.number().int().min(1).max(1000),
  coolingPeriod: z.number(),
  date: z.string().optional(),
  mapUrl: z.string().url().optional().or(z.literal('')),
  // ...
});
```

---

### 2. Formik + Yup

| Aspect | Details |
|--------|---------|
| **npm downloads** | ~2.5 million/week |
| **Bundle size** | ~13KB (Formik) + ~14KB (Yup) |
| **TypeScript** | Good support, but Yup doesn't infer types |
| **MUI integration** | Direct, no wrapper needed |
| **Approach** | Controlled components |

**Pros:**
- Mature, battle-tested
- Works directly with MUI controlled components
- Familiar to many developers
- Good documentation

**Cons:**
- Larger bundle size
- More re-renders due to controlled components
- 7 dependencies
- Less active development than RHF

---

### 3. react-hook-form-mui

| Aspect | Details |
|--------|---------|
| **npm downloads** | ~50K/week |
| **Bundle size** | ~15KB (includes bindings) |
| **Description** | Pre-built MUI component wrappers for RHF |

**Pros:**
- Seamless MUI integration out of the box
- Less boilerplate than raw RHF + MUI

**Cons:**
- Additional dependency layer
- May lag behind MUI major versions
- Less flexibility

---

### 4. react-material-ui-form-validator

| Aspect | Details |
|--------|---------|
| **npm downloads** | ~30K/week |
| **Bundle size** | ~8KB |
| **Description** | MUI-specific validation wrapper |

**Pros:**
- MUI-native
- Simple API

**Cons:**
- Less maintained
- Not widely adopted
- May not support MUI 7

---

### 5. Native MUI Validation (Current Approach)

Use MUI TextField's built-in props with manual validation:
- `error` (boolean)
- `helperText` (string)
- `required` (boolean)
- HTML5 attributes: `inputProps={{ min, max, pattern }}`

**Pros:**
- No additional dependencies
- Already in use
- Full control

**Cons:**
- Verbose, repetitive code
- No schema reuse
- Easy to make mistakes
- No TypeScript type inference

---

## Recommendation Matrix

| Scenario | Recommendation |
|----------|----------------|
| Minimal changes, quick win | Keep current MUI native approach, extract validation functions |
| New forms, greenfield | **React Hook Form + Zod** |
| TypeScript migration planned | **React Hook Form + Zod** (type inference) |
| Must keep class components | Formik + Yup (works with class components) |
| Smallest bundle increase | MUI native or react-material-ui-form-validator |

---

## Implementation Effort

| Library | Effort to Integrate |
|---------|---------------------|
| MUI Native (current) | None - already done |
| React Hook Form + Zod | Medium - requires hook conversion |
| Formik + Yup | Low-Medium - works with class components |
| react-hook-form-mui | Medium - requires hook conversion |

---

## BlockParty-Specific Considerations

1. **Class components**: NewEventDialog, MetadataEditor, FormInput are class-based. RHF requires hooks, so migration would need component refactoring.

2. **Ethereum-specific validation**: Address validation, ETH amounts, etc. - custom validators needed regardless of library choice.

3. **Arweave URIs**: Need custom validation for `ar://` URIs.

4. **File uploads**: Banner image validation is already custom; libraries don't help much here.

5. **Form size**: Forms are moderate size (~15 fields max). Performance gains from RHF may not be noticeable.

---

## Sources

- [Form Validation with React Hook Form, Material UI, React and TypeScript 2025](https://codevoweb.com/form-validation-react-hook-form-material-ui-react/)
- [Using Material UI with React Hook Form - LogRocket Blog](https://blog.logrocket.com/using-material-ui-with-react-hook-form/)
- [8 Best React Form Libraries for Developers (2025)](https://snappify.com/blog/best-react-form-libraries)
- [Yup vs Zod: Choosing the Right Validation Library](https://betterstack.com/community/guides/scaling-nodejs/yup-vs-zod/)
- [React Hook Form vs Formik](https://medium.com/@ignatovich.dm/react-hook-form-vs-formik-44144e6a01d8)
- [Supercharge your React Forms with React Hook Form, Zod, and MUI](https://medium.com/@charuwaka/supercharge-your-react-forms-with-react-hook-form-zod-and-mui-a-powerful-trio-47b653e7dce0)
- [react-material-ui-form-validator - npm](https://www.npmjs.com/package/react-material-ui-form-validator)
- [Comparing React Form Libraries - Smashing Magazine](https://www.smashingmagazine.com/2023/02/comparing-react-form-libraries/)
