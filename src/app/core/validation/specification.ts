/** Specification — a business rule a value either satisfies or not (pure, reusable). */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}

/** Spec — builds and combines specifications. */
export class Spec {
  /** A specification from a predicate. */
  public static of<T>(predicate: (candidate: T) => boolean): Specification<T> {
    return { isSatisfiedBy: predicate };
  }

  /** Satisfied only when every one of the specifications is. */
  public static all<T>(...specs: readonly Specification<T>[]): Specification<T> {
    return Spec.of((candidate) => specs.every((spec) => spec.isSatisfiedBy(candidate)));
  }

  /** Satisfied when the string matches the pattern. */
  public static matches(pattern: RegExp): Specification<string> {
    return Spec.of((candidate) => pattern.test(candidate));
  }

  /** Length in characters (code points, like char_length in Postgres) between min and max. */
  public static length(min: number, max: number): Specification<string> {
    return Spec.of((candidate) => {
      const length = Array.from(candidate).length;
      return length >= min && length <= max;
    });
  }

  /** At least `min` characters matching a one-character pattern (global flag added). */
  public static atLeast(min: number, character: RegExp): Specification<string> {
    const global = new RegExp(character.source, `${character.flags.replace('g', '')}g`);
    return Spec.of((candidate) => (candidate.match(global)?.length ?? 0) >= min);
  }

  /** An integer between min and max. */
  public static integer(min: number, max: number): Specification<number> {
    return Spec.of((candidate) => Number.isInteger(candidate) && candidate >= min && candidate <= max);
  }
}
