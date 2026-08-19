import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * The annotated date must not fall before the named sibling date.
 *
 * The rule no built in decorator can express, because it needs a second field.
 * It appears on leave requests, holidays, and every report date range, and it
 * was enforced only inside each service, meaning the DTO did not describe its
 * own contract and `/api/docs` did not either (D5).
 *
 * Comparison is on the ISO strings, which is safe here because every field
 * carrying this is already `@IsDateString()` and ISO 8601 sorts
 * lexicographically. That avoids constructing a Date and inheriting its
 * timezone questions for what is a calendar comparison.
 *
 * An absent value on either side passes. Requiredness is a separate rule, and
 * combining the two would make a missing endDate report a confusing "cannot be
 * before" error instead of "should not be empty".
 */
export function IsNotBefore(
  siblingProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBefore',
      target: object.constructor,
      propertyName,
      constraints: [siblingProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [sibling] = args.constraints as [string];
          const other = (args.object as Record<string, unknown>)[sibling];
          if (typeof value !== 'string' || typeof other !== 'string') {
            return true;
          }
          if (value === '' || other === '') return true;
          return value >= other;
        },
        defaultMessage(args: ValidationArguments) {
          const [sibling] = args.constraints as [string];
          return `${args.property} cannot be before ${sibling}`;
        },
      },
    });
  };
}
