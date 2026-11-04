/**
 * UserFacingError — an error the user can act on, with the translation key
 * of its message. Only these (and a failed download of a screen) reach the
 * global notice; everything else goes to ErrorLog quietly.
 */
export class UserFacingError extends Error {
  public override readonly name = 'UserFacingError';

  constructor(public readonly messageKey: string) {
    super(messageKey);
  }
}
