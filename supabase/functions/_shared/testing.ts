/** The item of a list in a test, failing with a clear message when it is not there. */
export function at<T>(list: ArrayLike<T> | null | undefined, index: number): T {
  const item = list?.[index];
  if (item === undefined) throw new Error(`expected an item at ${index} (the list has ${list?.length ?? 0})`);
  return item;
}
