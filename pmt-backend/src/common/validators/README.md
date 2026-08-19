# Custom validators

Only rules the built in `class-validator` decorators genuinely cannot express
belong here. Two rules that look like candidates are not:

**Conditional requiredness** (`rushReason` when priority is URGENT, `comments`
when a review requests changes, `resolutionNotes` when a blocker is resolved)
**is expressible**, with `@ValidateIf` plus `@IsNotEmpty`:

```ts
@ValidateIf((o) => RUSH_PRIORITIES.includes(o.priority) || o.rushReason !== undefined)
@IsString()
@IsNotEmpty({ message: 'rushReason is required when priority is URGENT or CRITICAL' })
@MaxLength(FieldLength.LONG_TEXT)
rushReason?: string;
```

The predicate has two halves on purpose. The first makes the field required when
the trigger fires. The second keeps the type and length checks running when the
caller supplies the field anyway, which a bare trigger predicate would skip.

A custom `RequiredWhen` decorator was written for this and deleted: `@IsOptional`
short circuits every other validator on a property, so the custom rule never ran
when the value was absent, which is the only case it existed for.

**Cross field date ordering is not expressible**, because a validator needs to
read a sibling property. That is `is-not-before.validator.ts`.

Every validator here carries a co-located spec.
