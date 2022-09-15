export async function asyncAction(promise: Promise<unknown>) {
  return await Promise.resolve(promise)
    .then(data => [null, data])
    .catch(error => [error]);
}
