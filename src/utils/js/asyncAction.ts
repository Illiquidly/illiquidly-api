export async function asyncAction(promise: Promise<unknown>): Promise<[any, any]> {
  return await Promise.resolve(promise)
    .then((data): [null, any] => [null, data])
    .catch(error => [error, null]);
}
