import { HttpException, HttpStatus } from "@nestjs/common";

export async function sendBackError(error: any) {
  const jsonError = error.toJSON();

  throw new HttpException(
    {
      errorText: "NFT Info not available",
      error: {
        message: jsonError.message,
        name: jsonError.name,
        status: jsonError.status,
      },
    },
    error?.toJSON().status ?? HttpStatus.NOT_FOUND,
  );
}
