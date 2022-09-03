import { registerDecorator, ValidationArguments } from "class-validator";
import { bech32 } from "bech32";

export function IsAddress() {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isAddress",
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: "The address should be a valid Terra Address",
      },
      validator: {
        validate(value: any, _args: ValidationArguments) {
          try {
            const { prefix: decodedPrefix } = bech32.decode(value); // throw error if checksum is invalid
            // verify address prefix
            return decodedPrefix === "terra";
          } catch {
            // invalid checksum
            return false;
          }
        },
      },
    });
  };
}
