import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import "dotenv/config";
const fs = require("fs");

async function bootstrap() {
  console.log(process.env.ENVIRONMENT);
  let httpsOptions: any;
  if (process.env.ENVIRONMENT == "PRODUCTION") {
    httpsOptions = {
      cert: fs.readFileSync("/home/illiquidly/identity/fullchain.pem"),
      key: fs.readFileSync("/home/illiquidly/identity/privkey.pem"),
    };
  }

  console.log();

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle("Illiquidlabs API")
    .setDescription("The illiquidlabs API description")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("", app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(3000);
}
bootstrap();
